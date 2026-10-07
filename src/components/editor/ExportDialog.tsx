"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import { toast } from "../Toaster";
import { registerExports } from "@/app/actions/studio";
import { composeSheet, download, EXT, exportPage, MIME, openPrintWindow, printBlobs, slug, zipBlobs, type Format } from "@/lib/editor/exporter";
import { canvasToBlob, renderToCanvas } from "@/lib/editor/render";
import { SIZES, sizeById, type Design } from "@/lib/editor/types";
import { uploadToStorage } from "@/lib/uploadClient";

const PAPERS = ["4r", "4rl", "5r", "6r", "8r", "a6", "a5", "a4"];

/** Dialog ekspor: ukuran (sosmed & cetak), format, unduh / ZIP, lembar cetak n-per-kertas, cetak, simpan ke file. */
export default function ExportDialog({ doc, pageIdx, designId, storage, onClose }: {
  doc: Design; pageIdx: number; designId: number | null; storage: boolean; onClose: () => void;
}) {
  const multi = doc.pages.length > 1;
  const cur = doc.pages[pageIdx];
  const [scope, setScope] = useState<"page" | "all">(multi ? "all" : "page");
  const [sizeId, setSizeId] = useState("asli");
  const [cw, setCw] = useState(cur.w), [ch, setCh] = useState(cur.h);
  const [fit, setFit] = useState<"cover" | "contain">("contain");
  const [bg, setBg] = useState("#ffffff");
  const [format, setFormat] = useState<Format>("png");
  const [quality, setQuality] = useState(0.92);
  const [paper, setPaper] = useState("4r");
  const [per, setPer] = useState(1);
  const [margin, setMargin] = useState(0);
  const [cut, setCut] = useState(false);
  const [busy, setBusy] = useState("");
  const prev = useRef<HTMLCanvasElement>(null);

  const size = sizeId === "asli" ? { w: cur.w, h: cur.h } : sizeId === "custom" ? { w: cw, h: ch } : sizeById(sizeId)!;
  const pages = scope === "all" ? doc.pages : [cur];
  const base = slug(doc.name);
  const opts = { w: Math.max(16, Math.round(size.w)), h: Math.max(16, Math.round(size.h)), fit, bg, format, quality };

  useEffect(() => {
    const t = setTimeout(async () => {
      const c = prev.current;
      if (!c) return;
      const k = Math.min(260 / opts.w, 300 / opts.h);
      const small = await renderToCanvas(cur, Math.max(8, Math.round(opts.w * k)), Math.max(8, Math.round(opts.h * k)), fit, bg);
      c.width = small.width; c.height = small.height;
      c.getContext("2d")!.drawImage(small, 0, 0);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, opts.w, opts.h, fit, bg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : "Gagal memproses", "bad"); }
    setBusy("");
  };
  const names = (i: number) => `${base}${pages.length > 1 ? `-${(scope === "all" ? i : pageIdx) + 1}` : ""}.${EXT[format]}`;

  const doDownload = () => run("Menyiapkan file…", async () => {
    const files: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < pages.length; i++) files.push({ name: names(i), blob: (await exportPage(pages[i], opts)).blob });
    if (files.length === 1) download(files[0].blob, files[0].name);
    else download(await zipBlobs(files), `${base}.zip`);
  });

  const paperMm = (): [number, number] => sizeById(paper)!.mm!;
  const sheets = async () => {
    const out: { blob: Blob; wmm: number; hmm: number; name: string }[] = [];
    for (let i = 0; i < pages.length; i++) {
      const { canvas } = await exportPage(pages[i], { ...opts, format: "png" });
      const s = composeSheet(canvas, paperMm(), per, margin, cut);
      out.push({ blob: await canvasToBlob(s.canvas, MIME[format === "webp" ? "png" : format], quality), wmm: s.wmm, hmm: s.hmm, name: `${base}-lembar-${i + 1}.${format === "jpeg" ? "jpg" : "png"}` });
    }
    return out;
  };
  const doSheet = () => run("Menyusun lembar cetak…", async () => {
    const s = await sheets();
    if (s.length === 1) download(s[0].blob, s[0].name); else download(await zipBlobs(s.map((x) => ({ name: x.name, blob: x.blob }))), `${base}-lembar.zip`);
  });
  const doPrint = () => {
    const w = openPrintWindow();
    if (!w) { toast("Izinkan pop-up untuk mencetak", "bad"); return; }
    void run("Menyiapkan cetakan…", async () => {
      const s = await sheets();
      await printBlobs(w, s.map((x) => x.blob), s[0].wmm, s[0].hmm);
    });
  };
  const doSave = () => run("Mengunggah ke file…", async () => {
    const items: { name: string; url: string; w: number; h: number; format: string; size: number }[] = [];
    for (let i = 0; i < pages.length; i++) {
      const { blob } = await exportPage(pages[i], opts);
      const r = await uploadToStorage(new File([blob], names(i), { type: blob.type }), undefined, true);
      if (!r.url) throw new Error(r.error ?? "Upload gagal");
      items.push({ name: names(i), url: r.url, w: opts.w, h: opts.h, format: EXT[format], size: blob.size });
    }
    const r = await registerExports(designId, items);
    if (!r.ok) throw new Error(r.error);
    toast(`${items.length} file tersimpan di menu Studio → File Ekspor`);
  });

  const inp = "input !min-h-10";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" aria-label="Ekspor" className="sheet-panel relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl border border-line bg-panel shadow-2xl sm:max-w-3xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-display text-lg font-semibold">Ekspor, Unduh &amp; Cetak</h2>
          <button className="btn btn-sm !min-h-9 !w-9 !px-0" onClick={onClose} aria-label="Tutup"><Icon name="x" className="size-4" /></button>
        </div>
        <div className="grid min-h-0 gap-5 overflow-y-auto px-5 pb-5 sm:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            {multi && (
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel2 p-1 text-xs font-bold">
                {([["all", `Semua halaman (${doc.pages.length})`], ["page", "Halaman ini saja"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setScope(k)} className={`rounded-lg py-2 transition ${scope === k ? "bg-accent text-accentfg shadow" : "text-muted"}`}>{l}</button>
                ))}
              </div>
            )}
            <div>
              <span className="label">Ukuran hasil</span>
              <select className={inp} value={sizeId} onChange={(e) => { setSizeId(e.target.value); const s = sizeById(e.target.value); if (s) { setCw(s.w); setCh(s.h); } }}>
                <option value="asli">Ukuran asli halaman ({cur.w}×{cur.h})</option>
                <optgroup label="Media sosial">{SIZES.filter((s) => s.group === "sosmed").map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
                <optgroup label="Cetak (300 dpi)">{SIZES.filter((s) => s.group === "cetak").map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
                <option value="custom">Ukuran sendiri…</option>
              </select>
              {sizeId === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className={inp} type="number" value={cw} min={16} max={8000} onChange={(e) => setCw(+e.target.value)} aria-label="Lebar px" />
                  <input className={inp} type="number" value={ch} min={16} max={8000} onChange={(e) => setCh(+e.target.value)} aria-label="Tinggi px" />
                </div>
              )}
              <p className="mt-1 text-xs text-muted">{opts.w} × {opts.h} px{sizeById(sizeId)?.mm ? ` · ${sizeById(sizeId)!.mm![0] / 10} × ${sizeById(sizeId)!.mm![1] / 10} cm` : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">Jika rasio berbeda</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel2 p-1 text-xs font-bold">
                  {([["contain", "Pas (ada tepi)"], ["cover", "Isi (dipotong)"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setFit(k)} className={`rounded-lg py-2 transition ${fit === k ? "bg-accent text-accentfg shadow" : "text-muted"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div><span className="label">Warna tepi</span><input type="color" className="input !p-1" value={bg} onChange={(e) => setBg(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">Format</span>
                <select className={inp} value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  <option value="png">PNG (terbaik)</option><option value="jpeg">JPG (ringan)</option><option value="webp">WebP</option>
                </select>
              </div>
              {format !== "png" && <div><span className="label">Kualitas {Math.round(quality * 100)}%</span><input type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full accent-[var(--accent)]" /></div>}
            </div>

            <div className="rounded-2xl border border-line bg-panel2/50 p-3.5">
              <p className="font-display mb-2 flex items-center gap-2 text-sm font-semibold"><Icon name="printer" className="size-4 text-accent" /> Lembar cetak</p>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="label">Kertas</span>
                  <select className={inp} value={paper} onChange={(e) => setPaper(e.target.value)}>{PAPERS.map((p) => <option key={p} value={p}>{sizeById(p)!.label.split(" · ")[0]}</option>)}</select></div>
                <div><span className="label">Salinan / lembar</span>
                  <select className={inp} value={per} onChange={(e) => setPer(+e.target.value)}>{[1, 2, 3, 4, 6, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><span className="label">Margin (mm)</span><input className={inp} type="number" min={0} max={20} value={margin} onChange={(e) => setMargin(+e.target.value)} /></div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Tambah tanda potong</label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => { setSizeId("4r"); setPaper("4r"); setPer(1); setMargin(0); }}>Preset: 4R penuh</button>
                <button className="btn btn-sm" onClick={() => { setSizeId("strip"); setPaper("4r"); setPer(2); setMargin(0); setCut(true); }}>Preset: 2 strip / 4R</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="editor-checker grid w-full place-items-center rounded-2xl p-3"><canvas ref={prev} className="max-h-72 max-w-full rounded shadow-lg" /></div>
            <p className="text-center text-xs text-muted">Pratinjau halaman {pageIdx + 1}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          {busy && <span className="mr-auto flex items-center gap-2 text-sm font-semibold text-muted"><span className="spinner" /> {busy}</span>}
          {!busy && <span className="mr-auto text-xs text-muted">{pages.length} halaman · {EXT[format].toUpperCase()}</span>}
          <button className="btn btn-sm" disabled={!!busy || !storage} onClick={doSave} title={storage ? "" : "Upload belum aktif"}><Icon name="folder" className="size-4" /> Simpan ke File</button>
          <button className="btn btn-sm" disabled={!!busy} onClick={doSheet}><Icon name="download" className="size-4" /> Unduh lembar</button>
          <button className="btn btn-sm" disabled={!!busy} onClick={doPrint}><Icon name="printer" className="size-4" /> Cetak</button>
          <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={doDownload}><Icon name="download" className="size-4" /> {pages.length > 1 ? "Unduh ZIP" : "Unduh"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
