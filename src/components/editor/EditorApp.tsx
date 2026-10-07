"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../Icon";
import { toast } from "../Toaster";
import ExportDialog from "./ExportDialog";
import LayersPanel from "./LayersPanel";
import LeftPanel, { type AssetRow, type FrameRow, type LibRow, type PoolItem, type Tab } from "./LeftPanel";
import PropsPanel from "./PropsPanel";
import Stage from "./Stage";
import { deleteAsset, saveAsset, saveDesign } from "@/app/actions/studio";
import { buildCarousel, BG_PRESETS, type CarouselStyle, type LayoutId, type Pic } from "@/lib/editor/layouts";
import { addLayer, addPhoto, alignLayer, applyFrame, assignToSlot, clonePage, emptySlots, fillEmptySlots, frameOf, isSlotPhoto, moveLayer, reflow, removeFrame } from "@/lib/editor/ops";
import { assetById } from "@/lib/editor/assets";
import { assetLayer, logoLayer, placeholder, safeSrc, type Brand, type Template } from "@/lib/editor/templates";
import { canvasToBlob, layerHeight, loadImg, renderToCanvas, renderPage, setFontMap } from "@/lib/editor/render";
import { GOOGLE_FONTS, newPage, newPhoto, newShape, newText, uid, type Design, type Filter, type Layer, type Page, type PhotoLayer } from "@/lib/editor/types";
import { shrinkImage, uploadToStorage } from "@/lib/uploadClient";

type Props = {
  initial: Design; designId: number | null; frames: FrameRow[]; storage: boolean; canManageFrames: boolean;
  customer: { id: number; name: string } | null; startFrame: number | null; brand: Brand; assets: AssetRow[];
};

const dims = async (src: string) => { const im = await loadImg(src); return { nw: im.naturalWidth, nh: im.naturalHeight }; };

export default function EditorApp({ initial, designId: initialId, frames, storage, canManageFrames, customer, startFrame, brand, assets: initialAssets }: Props) {
  const [doc, setDocState] = useState<Design>(initial);
  const docRef = useRef(initial);
  const [past, setPast] = useState<Design[]>([]);
  const [future, setFuture] = useState<Design[]>([]);
  const [pi, setPi] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<Tab>(startFrame ? "frame" : "foto");
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [designId, setDesignId] = useState<number | null>(initialId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [drag, setDrag] = useState(false);
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets);
  const [assetBusy, setAssetBusy] = useState(false);
  const [right, setRight] = useState<"props" | "layers">("props");
  const [logoDims, setLogoDims] = useState<Partial<Brand>>({});
  const clip = useRef<Layer | null>(null);
  const [ver, setVer] = useState(0);
  const imgs = useRef(new Map<string, HTMLImageElement>());
  const last = useRef({ key: "", t: 0 });
  const replaceTarget = useRef<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const thumbs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const page = doc.pages[Math.min(pi, doc.pages.length - 1)];
  const sel = page.layers.find((l) => l.id === selId) ?? null;

  /* ───────── dokumen & riwayat ───────── */
  const mutate = useCallback((fn: (d: Design) => Design, key?: string) => {
    const prev = docRef.current, next = fn(prev);
    if (next === prev) return;
    const now = Date.now();
    const merge = !!key && last.current.key === key && now - last.current.t < 900;
    last.current = { key: key ?? "", t: now };
    if (!merge) setPast((p) => [...p.slice(-59), prev]);
    setFuture([]);
    docRef.current = next; setDocState(next); setDirty(true);
  }, []);
  const mutatePage = useCallback((fn: (p: Page) => Page, key?: string) => {
    mutate((d) => { const i = Math.min(pi, d.pages.length - 1); const np = fn(d.pages[i]); return np === d.pages[i] ? d : { ...d, pages: d.pages.map((p, j) => (j === i ? np : p)) }; }, key);
  }, [mutate, pi]);
  const undo = () => setPast((p) => { if (!p.length) return p; const prev = p[p.length - 1]; setFuture((f) => [docRef.current, ...f]); docRef.current = prev; setDocState(prev); setDirty(true); last.current = { key: "", t: 0 }; return p.slice(0, -1); });
  const redo = () => setFuture((f) => { if (!f.length) return f; const nx = f[0]; setPast((p) => [...p, docRef.current]); docRef.current = nx; setDocState(nx); setDirty(true); return f.slice(1); });

  const patchLayer = useCallback((id: string, patch: Partial<Layer>, key: string) =>
    mutatePage((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }), key), [mutatePage]);

  /* ───────── font & gambar ───────── */
  useEffect(() => {
    const cs = getComputedStyle(document.body);
    const sora = cs.getPropertyValue("--font-sora").trim(), jak = cs.getPropertyValue("--font-jakarta").trim();
    setFontMap({ ...(sora ? { Sora: sora } : {}), ...(jak ? { "Plus Jakarta Sans": jak } : {}) });
    void Promise.all(["700 40px " + (sora || "Sora"), "500 40px " + (jak || "Plus Jakarta Sans")].map((f) => document.fonts.load(f).catch(() => null))).then(() => setVer((v) => v + 1));
  }, []);

  useEffect(() => {
    let live = true;
    const missing = doc.pages.flatMap((p) => p.layers).filter((l) => (l.type === "photo" || l.type === "frame") && l.src && !imgs.current.has(l.src));
    if (!missing.length) return;
    void Promise.all([...new Set(missing.map((l) => (l as PhotoLayer).src))].map(async (s) => { try { imgs.current.set(s, await loadImg(s)); } catch { /* abaikan */ } }))
      .then(() => live && setVer((v) => v + 1));
    return () => { live = false; };
  }, [doc]);

  // kumpulan foto awal = foto yang sudah dipakai di desain
  useEffect(() => {
    const seen = new Map<string, PoolItem>();
    for (const l of initial.pages.flatMap((p) => p.layers)) if (l.type === "photo" && !seen.has(l.src)) seen.set(l.src, { id: uid(), src: l.src, nw: l.nw, nh: l.nh, name: l.name, thumb: l.src, sel: false });
    setPool([...seen.values()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── foto ───────── */
  const addPoolPics = (pics: (Pic & { thumb?: string })[], select = true) =>
    setPool((p) => [...p, ...pics.map((x) => ({ id: uid(), src: x.src, nw: x.nw, nh: x.nh, name: x.name, thumb: x.thumb ?? x.src, sel: select }))]);

  const onFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    const pics: Pic[] = [];
    for (const f of list) {
      try {
        const small = await shrinkImage(f, 3400, 0.92);
        const src = URL.createObjectURL(small);
        pics.push({ src, ...(await dims(src)), name: f.name.replace(/\.\w+$/, "") });
      } catch { toast(`Gagal membaca ${f.name}`, "bad"); }
    }
    addPoolPics(pics);
    setUploading(false);
    if (pics.length) toast(`${pics.length} foto ditambahkan`);
  };
  const addLibrary = async (r: LibRow) => {
    const src = `/api/editor/img?file=${r.id}&w=2800`;
    if (pool.some((x) => x.src === src)) { setPool((p) => p.map((x) => (x.src === src ? { ...x, sel: true } : x))); return; }
    try { addPoolPics([{ src, ...(await dims(src)), name: r.title, thumb: `/api/editor/img?file=${r.id}&w=240` }]); }
    catch { toast("Foto tidak bisa dibuka (cek koneksi Google Drive)", "bad"); }
  };
  const selectedPics = (): Pic[] => pool.filter((x) => x.sel).map(({ src, nw, nh, name }) => ({ src, nw, nh, name }));

  const addSelected = () => {
    const pics = selectedPics();
    if (!pics.length) return;
    let id: string | null = null;
    mutatePage((p) => { let cur = p; for (const pic of pics) { const r = addPhoto(cur, pic); cur = r.page; id = r.id; } return cur; });
    setSelId(id); setPool((p) => p.map((x) => ({ ...x, sel: false })));
  };
  const fillSlots = (same: boolean) => {
    const pics = selectedPics();
    if (!pics.length) return;
    mutatePage((p) => fillEmptySlots(p, pics, same));
    setPool((p) => p.map((x) => ({ ...x, sel: false })));
  };
  const onEmptySlot = (idx: number) => {
    const first = pool.find((x) => x.sel);
    if (!first) { setTab("foto"); toast("Pilih foto di panel Foto, lalu klik slot ini"); return; }
    mutatePage((p) => assignToSlot(p, idx, { src: first.src, nw: first.nw, nh: first.nh, name: first.name }));
    setPool((p) => p.map((x) => (x.id === first.id ? { ...x, sel: false } : x)));
  };

  /* ───────── frame, layout, carousel ───────── */
  const doApplyFrame = (f: FrameRow) => {
    const pics = selectedPics();
    mutate((d) => {
      const i = Math.min(pi, d.pages.length - 1);
      const had = d.pages[i].layers.some((l) => l.type === "photo");
      const np = applyFrame(d.pages[i], { id: f.id, url: f.url, w: f.w, h: f.h, slots: f.slots }, had ? [] : pics);
      return { ...d, kind: "frame", pages: d.pages.map((p, j) => (j === i ? np : p)) };
    });
    if (pics.length) setPool((p) => p.map((x) => ({ ...x, sel: false })));
    setSelId(null); setZoom(1);
  };
  const doLayout = (id: LayoutId) => {
    const pics = selectedPics();
    mutatePage((p) => reflow(p, id, pics));
    if (pics.length) setPool((p) => p.map((x) => ({ ...x, sel: false })));
  };
  const doCarousel = (style: CarouselStyle, title: string) => {
    const pics = selectedPics();
    if (!pics.length) return;
    const cur = docRef.current.pages[pi];
    const feedSize = cur.w === 1080 && (cur.h === 1350 || cur.h === 1080);
    const [w, h] = feedSize ? [cur.w, cur.h] : [1080, 1350];
    mutate((d) => ({ ...d, kind: "carousel", pages: buildCarousel(pics, style, w, h, title, cur.bg.c1 === "#ffffff" ? BG_PRESETS[1] : cur.bg) }));
    setPi(0); setSelId(null); setPool((p) => p.map((x) => ({ ...x, sel: false })));
    toast("Carousel dibuat — periksa tiap halaman di bawah");
  };

  /* ───────── teks, bentuk, layer ───────── */
  const addText = (kind: "judul" | "sub" | "caption" | "label") => {
    const w = page.w;
    const base = { judul: { s: w * 0.09, wt: 800, t: "Judul Kamu" }, sub: { s: w * 0.055, wt: 600, t: "Subjudul menarik" }, caption: { s: w * 0.035, wt: 500, t: "Tulis caption di sini" }, label: { s: w * 0.04, wt: 700, t: "NEW" } }[kind];
    const t = newText(base.t, w * 0.1, page.h * 0.4, w * 0.8, { size: Math.round(base.s), weight: base.wt, color: kind === "label" ? "#ffffff" : page.bg.c1 === "#0b1020" ? "#ffffff" : "#0b1020", ...(kind === "label" ? { bg: "#4f4fe8" } : {}) });
    mutatePage((p) => ({ ...p, layers: [...p.layers, t] }));
    setSelId(t.id);
  };
  const addShape = (s: "rect" | "circle") => {
    const sz = page.w * 0.3;
    const l = newShape(s, { x: (page.w - sz) / 2, y: (page.h - sz) / 2, w: sz, h: sz });
    mutatePage((p) => ({ ...p, layers: [...p.layers, l] }));
    setSelId(l.id);
  };
  const removeSel = () => { if (!sel) return; mutatePage((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== sel.id) })); setSelId(null); };
  const duplicateSel = () => {
    if (!sel || isSlotPhoto(sel)) return;
    const c = { ...JSON.parse(JSON.stringify(sel)), id: uid(), x: sel.x + 30, y: sel.y + 30 } as Layer;
    mutatePage((p) => ({ ...p, layers: [...p.layers, c] })); setSelId(c.id);
  };
  const applyFilterAll = (f: Filter) => { mutatePage((p) => ({ ...p, layers: p.layers.map((l) => (l.type === "photo" ? { ...l, filter: { ...f } } : l)) })); toast("Filter diterapkan ke semua foto"); };
  const detachSlot = () => { if (sel) patchLayer(sel.id, { slot: undefined } as Partial<Layer>, "detach"); };

  const replacePhoto = () => { if (!sel) return; replaceTarget.current = sel.id; replaceInput.current?.click(); };
  const onReplaceFile = async (f?: File) => {
    const id = replaceTarget.current; if (!f || !id) return;
    const small = await shrinkImage(f, 3400, 0.92), src = URL.createObjectURL(small), d = await dims(src);
    mutatePage((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id && l.type === "photo" ? { ...l, src, ...d, zoom: 1, ox: 0, oy: 0 } : l)) }));
    addPoolPics([{ src, ...d, name: f.name }], false);
  };

  /* ───────── font, brand, aset, template ───────── */
  const brandFull: Brand = { ...brand, ...logoDims };
  const palette = useMemo(() => [brand.accent, brand.accent2], [brand.accent, brand.accent2]);
  useEffect(() => {
    const dim = async (u: string) => { try { const im = await loadImg(safeSrc(u)); return [im.naturalWidth, im.naturalHeight] as const; } catch { return null; } };
    void (async () => {
      const [a, b] = await Promise.all([brand.logo ? dim(brand.logo) : null, brand.logoDark ? dim(brand.logoDark) : null]);
      setLogoDims({ ...(a ? { logoW: a[0], logoH: a[1] } : {}), ...(b ? { logoDarkW: b[0], logoDarkH: b[1] } : {}) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureFont = useCallback((name: string) => {
    void Promise.all([`400 28px "${name}"`, `800 28px "${name}"`, `italic 500 28px "${name}"`].map((f) => document.fonts.load(f).catch(() => null))).then(() => setVer((v) => v + 1));
  }, []);
  useEffect(() => {
    const names = new Set(initial.pages.flatMap((p) => p.layers).flatMap((l) => (l.type === "text" ? [l.font] : [])));
    names.forEach(ensureFont);
  }, [initial, ensureFont]);

  const centerBox = (w: number, nw: number, nh: number) => { const h = w * (nh / nw); return { x: (page.w - w) / 2, y: (page.h - h) / 2, w, h }; };
  const addNew = (l: Layer) => { mutatePage((p) => addLayer(p, l)); setSelId(l.id); };

  const addAsset = (id: string) => {
    const a = assetById(id)!;
    if (a.cat === "bingkai") { addNew(assetLayer(id, "#ffffff", { x: 0, y: 0, w: page.w, h: page.h })); return; }
    const w = id === "line" ? page.w * 0.6 : id === "wave" || id === "underline" || id === "ribbon" || id === "tape" ? page.w * 0.45 : page.w * 0.26;
    addNew(assetLayer(id, a.color, centerBox(w, a.w, a.h)));
  };
  const addEmoji = (e: string) => {
    const w = page.w * 0.22;
    addNew(newText(e, (page.w - w) / 2, page.h * 0.4, w, { size: Math.round(page.w * 0.16), weight: 400, font: "Arial", color: "#000000" }));
  };
  const addBrandText = (t: string) => {
    const w = page.w * 0.7;
    addNew(newText(t, (page.w - w) / 2, page.h * 0.45, w, { size: Math.round(page.w * 0.05), weight: 700, color: page.bg.c1 === "#0b1020" ? "#ffffff" : "#0b1020", font: "Plus Jakarta Sans" }));
  };
  const addBrandLogo = (dark: boolean) => {
    const l = logoLayer(brandFull, dark, page.w / 2, page.h * 0.08, page.w * 0.4, page.h * 0.12);
    addNew(l);
  };
  const addMyAsset = async (a: AssetRow) => {
    let { w: nw, h: nh } = a;
    if (!nw || !nh) { try { ({ nw, nh } = await dims(a.url)); } catch { nw = 400; nh = 400; } }
    const box = centerBox(page.w * 0.35, nw, nh);
    addNew(newPhoto(a.url, nw, nh, box, { fit: "contain", name: a.name }));
  };
  const uploadAssets = async (files: FileList | File[]) => {
    if (!storage) { toast("Upload belum aktif di server — aset tidak bisa disimpan", "bad"); return; }
    setAssetBusy(true);
    for (const f of [...files]) {
      try {
        const file = f.type === "image/svg+xml" ? f : await shrinkImage(f, 2400, 0.92);
        const up = await uploadToStorage(file, undefined, true);
        if (!up.url) throw new Error(up.error ?? "Upload gagal");
        const d = await dims(up.url);
        const r = await saveAsset({ name: f.name.replace(/\.\w+$/, ""), url: up.url, w: d.nw, h: d.nh });
        if (!r.ok) throw new Error(r.error);
        setAssets((a) => [{ id: r.id, name: f.name.replace(/\.\w+$/, ""), url: up.url!, w: d.nw, h: d.nh }, ...a]);
      } catch (e) { toast(e instanceof Error ? e.message : `Gagal mengunggah ${f.name}`, "bad"); }
    }
    setAssetBusy(false);
  };
  const deleteMyAsset = async (id: number) => { const r = await deleteAsset(id); if (r.ok) setAssets((a) => a.filter((x) => x.id !== id)); else toast(r.error, "bad"); };

  const applyTemplate = (t: Template) => {
    const np = t.make(page.w, page.h, brandFull);
    mutatePage((p) => ({ ...np, id: p.id }));
    np.layers.forEach((l) => l.type === "text" && ensureFont(l.font));
    setSelId(null); setTab("foto"); toast(`Template “${t.label}” diterapkan`);
  };

  const fillWith = (layerId: string, it: { src: string; nw: number; nh: number; name?: string; id?: string }) => {
    patchLayer(layerId, { src: it.src, nw: it.nw, nh: it.nh, name: it.name, zoom: 1, ox: 0, oy: 0, fit: "cover" } as Partial<Layer>, `fill-${layerId}`);
  };
  const fillPlaceholder = () => { const it = pool.find((x) => x.sel); if (it && sel) { fillWith(sel.id, it); setPool((p) => p.map((x) => (x.id === it.id ? { ...x, sel: false } : x))); } };
  const alignSel = (to: "l" | "c" | "r" | "t" | "m" | "b") => { if (sel) patchLayer(sel.id, alignLayer(sel, page, layerHeight(sel), to), "align"); };
  const toggleFlag = (id: string, k: "hidden" | "locked") => mutatePage((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, [k]: !l[k] } : l)) }));

  /* ───────── halaman ───────── */
  const addPage = () => { mutate((d) => ({ ...d, pages: [...d.pages, newPage(page.w, page.h, page.bg)] })); setPi(doc.pages.length); setSelId(null); };
  const dupPage = () => { mutate((d) => ({ ...d, pages: [...d.pages.slice(0, pi + 1), clonePage(d.pages[pi]), ...d.pages.slice(pi + 1)] })); setPi(pi + 1); setSelId(null); };
  const delPage = () => {
    if (doc.pages.length <= 1) { toast("Minimal harus ada satu halaman", "bad"); return; }
    mutate((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pi) })); setPi(Math.max(0, pi - 1)); setSelId(null);
  };
  const movePage = (dir: -1 | 1) => {
    const j = pi + dir; if (j < 0 || j >= doc.pages.length) return;
    mutate((d) => { const pages = [...d.pages]; [pages[pi], pages[j]] = [pages[j], pages[pi]]; return { ...d, pages }; }); setPi(j);
  };

  /* ───────── simpan ───────── */
  const save = async () => {
    setSaving(true);
    try {
      const d: Design = JSON.parse(JSON.stringify(docRef.current));
      const blobs = [...new Set(d.pages.flatMap((p) => p.layers).flatMap((l) => ((l.type === "photo" || l.type === "frame") && l.src.startsWith("blob:") ? [l.src] : [])))];
      if (blobs.length && !storage) throw new Error("Upload belum aktif di server, foto dari perangkat tidak bisa disimpan. Pakai foto customer, atau aktifkan Supabase Storage.");
      let thumb = "";
      if (storage) {
        const c = await renderToCanvas(d.pages[0], 540, Math.round((540 * d.pages[0].h) / d.pages[0].w), "contain", "#ffffff");
        const t = await uploadToStorage(new File([await canvasToBlob(c, "image/jpeg", 0.82)], "thumb.jpg", { type: "image/jpeg" }), undefined, true);
        thumb = t.url ?? "";
      }
      const map = new Map<string, string>();
      for (const b of blobs) {
        const blob = await (await fetch(b)).blob();
        const r = await uploadToStorage(new File([blob], `foto-${uid()}.${blob.type.includes("png") ? "png" : "webp"}`, { type: blob.type || "image/webp" }), undefined, true);
        if (!r.url) throw new Error(r.error ?? "Upload foto gagal");
        map.set(b, r.url); const im = imgs.current.get(b); if (im) imgs.current.set(r.url, im);
      }
      for (const l of d.pages.flatMap((p) => p.layers)) if ((l.type === "photo" || l.type === "frame") && map.has(l.src)) l.src = map.get(l.src)!;
      const res = await saveDesign(designId, { name: d.name, kind: d.kind, data: JSON.stringify(d), thumb_url: thumb, customer_id: customer?.id ?? null });
      if (!res.ok) throw new Error(res.error);
      docRef.current = d; setDocState(d); setDirty(false);
      setPool((p) => p.map((x) => (map.has(x.src) ? { ...x, src: map.get(x.src)!, thumb: x.thumb === x.src ? map.get(x.src)! : x.thumb } : x)));
      if (!designId) { setDesignId(res.id); window.history.replaceState(null, "", `/editor/${res.id}`); }
      toast("Desain tersimpan");
    } catch (e) { toast(e instanceof Error ? e.message : "Gagal menyimpan", "bad"); }
    setSaving(false);
  };

  /* ───────── thumbnail halaman ───────── */
  useEffect(() => {
    const t = setTimeout(() => {
      doc.pages.forEach((p) => {
        const c = thumbs.current[p.id]; if (!c) return;
        const k = 72 / p.h; c.width = Math.max(1, Math.round(p.w * k)); c.height = 72;
        renderPage(c.getContext("2d")!, p, k, imgs.current, true);
      });
    }, 160);
    return () => clearTimeout(t);
  }, [doc, ver]);

  /* ───────── pintasan keyboard & peringatan keluar ───────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); }
      else if (mod && e.key.toLowerCase() === "c" && sel && sel.type !== "frame") { clip.current = JSON.parse(JSON.stringify(sel)); toast("Disalin"); }
      else if (mod && e.key.toLowerCase() === "v" && clip.current) {
        e.preventDefault();
        const c = { ...JSON.parse(JSON.stringify(clip.current)), id: uid(), slot: undefined, x: clip.current.x + 30, y: clip.current.y + 30 } as Layer;
        mutatePage((p) => addLayer(p, c)); setSelId(c.id);
      }
      else if ((e.key === "Delete" || e.key === "Backspace") && sel && !sel.locked) { e.preventDefault(); removeSel(); }
      else if (sel && !sel.locked && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const s = e.shiftKey ? 20 : 2;
        patchLayer(sel.id, { x: sel.x + (e.key === "ArrowRight" ? s : e.key === "ArrowLeft" ? -s : 0), y: sel.y + (e.key === "ArrowDown" ? s : e.key === "ArrowUp" ? -s : 0) }, `nudge-${sel.id}`);
      } else if (e.key === "Escape") setSelId(null);
    };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", onKey); window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  });

  // mulai dengan frame pilihan (dari Studio)
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !startFrame) return;
    started.current = true;
    const f = frames.find((x) => x.id === startFrame);
    if (f) doApplyFrame(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = useMemo(() => emptySlots(page).length, [page]);

  return (
    <div className="editor-root flex h-dvh flex-col bg-bg text-fg"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void onFiles(e.dataTransfer.files); }}>
      {/* bilah atas */}
      <header className="no-print flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
        <Link href="/studio" className="btn btn-sm !min-h-9" onClick={(e) => { if (dirty && !confirm("Ada perubahan yang belum disimpan. Keluar tanpa menyimpan?")) e.preventDefault(); }}><Icon name="left" className="size-4" /> Studio</Link>
        <input value={doc.name} onChange={(e) => mutate((d) => ({ ...d, name: e.target.value }), "name")} className="input !min-h-9 !w-48 !py-1 font-semibold sm:!w-64" aria-label="Nama desain" />
        {customer && <span className="badge badge-indigo hidden sm:inline-flex">Untuk: {customer.name}</span>}
        <span className="text-xs font-semibold text-muted">{dirty ? "● belum disimpan" : designId ? "tersimpan" : ""}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button className="btn btn-sm !min-h-9" disabled={!past.length} onClick={undo} title="Urungkan (Ctrl+Z)">↶</button>
          <button className="btn btn-sm !min-h-9" disabled={!future.length} onClick={redo} title="Ulangi (Ctrl+Y)">↷</button>
          <label className="mx-1 hidden items-center gap-1.5 text-xs font-semibold text-muted md:flex">Zoom
            <input type="range" min={0.5} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-24 accent-[var(--accent)]" />
            <button className="btn btn-sm !min-h-7 !px-2" onClick={() => setZoom(1)}>Pas</button>
          </label>
          <button className="btn btn-sm !min-h-9" disabled={saving} onClick={save}>{saving && <span className="spinner" />} Simpan</button>
          <button className="btn btn-primary btn-sm !min-h-9" onClick={() => setShowExport(true)}><Icon name="download" className="size-4" /> Ekspor / Cetak</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)_19rem]">
        <aside className="no-print flex max-h-[42dvh] min-h-0 flex-col border-b border-line bg-panel lg:max-h-none lg:border-b-0 lg:border-r">
          <LeftPanel tab={tab} setTab={setTab} pool={pool}
            toggle={(id) => { const it = pool.find((x) => x.id === id); if (it && sel?.type === "photo" && !sel.src) fillWith(sel.id, it); else setPool((p) => p.map((x) => (x.id === id ? { ...x, sel: !x.sel } : x))); }}
            removePool={(id) => setPool((p) => p.filter((x) => x.id !== id))}
            selectAll={(on) => setPool((p) => p.map((x) => ({ ...x, sel: on })))}
            onFiles={onFiles} uploading={uploading}
            frames={frames} canManageFrames={canManageFrames} hasFrame={!!frameOf(page)} applyFrame={doApplyFrame}
            removeFrame={() => mutatePage(removeFrame)} emptySlots={empty} fillSlots={fillSlots}
            addSelected={addSelected} layout={doLayout} carousel={doCarousel} addText={addText} addShape={addShape}
            customerHint={customer?.name ?? ""} addLibrary={addLibrary}
            brand={brandFull} assets={assets} pageW={page.w} pageH={page.h} assetBusy={assetBusy}
            applyTemplate={applyTemplate} addAsset={addAsset} addEmoji={addEmoji} addBrandLogo={addBrandLogo} addBrandText={addBrandText}
            addMyAsset={addMyAsset} uploadAssets={uploadAssets} deleteMyAsset={deleteMyAsset} />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          <Stage page={page} imgs={imgs.current} version={ver} selId={selId} cropMode={cropMode} zoom={zoom}
            onSelect={setSelId} onChange={(fn, key) => mutatePage(fn, key)} onEmptySlot={onEmptySlot} />
          {/* strip halaman */}
          <div className="no-print flex items-center gap-2 overflow-x-auto border-t border-line bg-panel px-3 py-2">
            {doc.pages.map((p, i) => (
              <button key={p.id} onClick={() => { setPi(i); setSelId(null); }} className={`relative shrink-0 rounded-lg border-2 p-0.5 transition ${i === pi ? "border-accent" : "border-transparent hover:border-line"}`}>
                <canvas ref={(el) => { thumbs.current[p.id] = el; }} className="block h-[72px] w-auto rounded bg-white" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{i + 1}</span>
              </button>
            ))}
            <button className="btn btn-sm !min-h-9 shrink-0" onClick={addPage}><Icon name="plus" className="size-4" /> Halaman</button>
            <button className="btn btn-sm !min-h-9 shrink-0" onClick={dupPage}><Icon name="copy" className="size-4" /></button>
            <button className="btn btn-sm !min-h-9 shrink-0" disabled={pi === 0} onClick={() => movePage(-1)}>←</button>
            <button className="btn btn-sm !min-h-9 shrink-0" disabled={pi === doc.pages.length - 1} onClick={() => movePage(1)}>→</button>
          </div>
        </main>

        <aside className="no-print flex max-h-[42dvh] min-h-0 flex-col border-t border-line bg-panel lg:max-h-none lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 gap-1 border-b border-line p-1.5 text-xs font-bold">
            {([["props", "Properti"], ["layers", `Layer (${page.layers.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setRight(k)} className={`rounded-lg py-1.5 transition ${right === k ? "bg-accent text-accentfg shadow" : "text-muted hover:text-fg"}`}>{l}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {right === "props" ? (
              <PropsPanel page={page} layer={sel} cropMode={cropMode} setCropMode={setCropMode}
                patch={(p, key) => sel && patchLayer(sel.id, p, key)} patchPage={mutatePage}
                remove={removeSel} duplicate={duplicateSel} order={(d) => sel && mutatePage((p) => moveLayer(p, sel.id, d))}
                replacePhoto={replacePhoto} applyFilterAll={applyFilterAll} detachSlot={detachSlot} deletePage={delPage}
                palette={palette} align={alignSel} ensureFont={ensureFont} fillPlaceholder={fillPlaceholder} canFill={pool.some((x) => x.sel)} />
            ) : (
              <LayersPanel page={page} selId={selId} onSelect={(id) => { setSelId(id); }} onToggle={toggleFlag} onMove={(id, d) => mutatePage((p) => moveLayer(p, id, d))} />
            )}
          </div>
        </aside>
      </div>

      <input ref={replaceInput} type="file" accept="image/*" className="hidden" onChange={(e) => { void onReplaceFile(e.target.files?.[0]); e.target.value = ""; }} />
      {drag && <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-accent/20 text-xl font-bold text-accent backdrop-blur-sm">Lepas untuk menambahkan foto</div>}
      {showExport && <ExportDialog doc={doc} pageIdx={Math.min(pi, doc.pages.length - 1)} designId={designId} storage={storage} onClose={() => setShowExport(false)} />}
    </div>
  );
}

