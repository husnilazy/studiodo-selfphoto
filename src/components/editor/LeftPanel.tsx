"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";
import { ASSETS, EMOJIS, assetUrl, type AssetCat } from "@/lib/editor/assets";
import { LAYOUTS, type CarouselStyle, type LayoutId } from "@/lib/editor/layouts";
import { loadPageImages, renderPage } from "@/lib/editor/render";
import { TEMPLATES, type Brand, type Template } from "@/lib/editor/templates";
import type { Pic } from "@/lib/editor/layouts";

export type PoolItem = Pic & { id: string; thumb: string; sel: boolean };
export type FrameRow = { id: number; name: string; category: string; url: string; w: number; h: number; slots: { x: number; y: number; w: number; h: number }[] };
export type LibRow = { id: number; title: string; customer: string; code: string | null };
export type Tab = "template" | "foto" | "frame" | "layout" | "teks" | "aset";
export type AssetRow = { id: number; name: string; url: string; w: number; h: number };

const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: "template", label: "Template", icon: "star" }, { k: "foto", label: "Foto", icon: "camera" }, { k: "frame", label: "Frame", icon: "layout" },
  { k: "layout", label: "Layout", icon: "box" }, { k: "teks", label: "Teks", icon: "edit" }, { k: "aset", label: "Aset", icon: "gift" },
];

export default function LeftPanel(p: {
  tab: Tab; setTab: (t: Tab) => void;
  pool: PoolItem[]; toggle: (id: string) => void; removePool: (id: string) => void; selectAll: (on: boolean) => void;
  onFiles: (files: FileList | File[]) => void; uploading: boolean;
  frames: FrameRow[]; canManageFrames: boolean; hasFrame: boolean; applyFrame: (f: FrameRow) => void; removeFrame: () => void;
  emptySlots: number; fillSlots: (same: boolean) => void;
  addSelected: () => void; layout: (id: LayoutId) => void; carousel: (s: CarouselStyle, title: string) => void;
  addText: (kind: "judul" | "sub" | "caption" | "label") => void; addShape: (s: "rect" | "circle") => void;
  customerHint: string; addLibrary: (r: LibRow) => void;
  brand: Brand; assets: AssetRow[]; pageW: number; pageH: number; assetBusy: boolean;
  applyTemplate: (t: Template) => void; addAsset: (id: string) => void; addEmoji: (e: string) => void;
  addBrandLogo: (dark: boolean) => void; addBrandText: (t: string) => void;
  addMyAsset: (a: AssetRow) => void; uploadAssets: (f: FileList | File[]) => void; deleteMyAsset: (id: number) => void;
}) {
  const assetFile = useRef<HTMLInputElement>(null);
  const [assetCat, setAssetCat] = useState<AssetCat>("bentuk");
  const file = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(p.customerHint);
  const [lib, setLib] = useState<LibRow[] | null>(null);
  const [cStyle, setCStyle] = useState<CarouselStyle>("cover");
  const [title, setTitle] = useState("");
  const selected = p.pool.filter((x) => x.sel).length;

  useEffect(() => {
    if (p.tab !== "foto") return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/editor/library?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j: LibRow[]) => live && setLib(Array.isArray(j) ? j : [])).catch(() => live && setLib([]));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, p.tab]);

  const sec = "border-b border-line px-3.5 py-3";
  const h = "mb-2 text-[11px] font-bold uppercase tracking-wide text-muted";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-6 gap-0.5 border-b border-line p-1.5">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => p.setTab(t.k)} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${p.tab === t.k ? "bg-accent text-accentfg shadow" : "text-muted hover:bg-panel2 hover:text-fg"}`}>
            <Icon name={t.icon} className="size-[17px]" />{t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.tab === "template" && (
          <section className={sec}>
            <p className={h}>Template siap pakai</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => p.applyTemplate(t)} className="group overflow-hidden rounded-xl border border-line bg-panel text-left transition hover:border-accent">
                  <TemplateThumb t={t} brand={p.brand} w={p.pageW} h={p.pageH} />
                  <span className="block truncate px-2 py-1.5 text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted">Template menggantikan isi halaman ini (bisa di-undo). Kotak “+ foto” diisi dengan memilih foto di tab Foto lalu klik kotaknya. Warna & logo mengikuti brand studio.</p>
          </section>
        )}

        {p.tab === "aset" && (
          <>
            <section className={sec}>
              <p className={h}>Brand studio</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button className="btn btn-sm !min-h-9" disabled={!p.brand.logo && !p.brand.logoDark} onClick={() => p.addBrandLogo(false)}>Logo (terang)</button>
                <button className="btn btn-sm !min-h-9" disabled={!p.brand.logo && !p.brand.logoDark} onClick={() => p.addBrandLogo(true)}>Logo (gelap)</button>
              </div>
              {!p.brand.logo && !p.brand.logoDark && <p className="mt-1.5 text-[11px] text-muted">Belum ada logo. Unggah di menu Website → Brand &amp; Logo, otomatis muncul di sini.</p>}
              <div className="mt-2 grid gap-1.5">
                <button className="btn btn-sm !min-h-9 !justify-start" onClick={() => p.addBrandText(p.brand.name)}>＋ Nama studio</button>
                {p.brand.instagram && <button className="btn btn-sm !min-h-9 !justify-start" onClick={() => p.addBrandText(`@${p.brand.instagram.replace(/^@/, "")}`)}>＋ @{p.brand.instagram.replace(/^@/, "")}</button>}
                {p.brand.whatsapp && <button className="btn btn-sm !min-h-9 !justify-start" onClick={() => p.addBrandText(`WA ${p.brand.whatsapp}`)}>＋ WhatsApp {p.brand.whatsapp}</button>}
                {p.brand.address && <button className="btn btn-sm !min-h-9 !justify-start" onClick={() => p.addBrandText(p.brand.address)}>＋ Alamat</button>}
              </div>
              <div className="mt-2.5 flex gap-1.5"><span className="size-6 rounded-md border border-line" style={{ background: p.brand.accent }} title="Warna brand 1" /><span className="size-6 rounded-md border border-line" style={{ background: p.brand.accent2 }} title="Warna brand 2" /><span className="self-center text-[11px] text-muted">warna brand tersedia di pemilih warna</span></div>
            </section>

            <section className={sec}>
              <p className={h}>Aset saya (logo, stiker, watermark)</p>
              <input ref={assetFile} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) p.uploadAssets(e.target.files); e.target.value = ""; }} />
              <button className="btn btn-primary btn-sm w-full" disabled={p.assetBusy} onClick={() => assetFile.current?.click()}>{p.assetBusy ? <span className="spinner" /> : <Icon name="plus" className="size-4" />} Upload aset (PNG transparan / SVG)</button>
              {p.assets.length > 0 && (
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  {p.assets.map((a) => (
                    <div key={a.id} className="group relative aspect-square">
                      <button title={a.name} onClick={() => p.addMyAsset(a)} className="editor-checker grid size-full place-items-center overflow-hidden rounded-lg border border-line p-1 transition hover:border-accent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                      </button>
                      <button aria-label="Hapus aset" onClick={() => p.deleteMyAsset(a.id)} className="absolute right-0.5 top-0.5 hidden size-5 place-items-center rounded-full bg-black/65 text-white group-hover:grid"><Icon name="x" className="size-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              {p.assets.length === 0 && <p className="mt-2 text-[11px] text-muted">Aset yang diunggah tersimpan untuk semua desain berikutnya.</p>}
            </section>

            <section className={sec}>
              <p className={h}>Elemen</p>
              <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel2 p-1 text-[11px] font-bold">
                {([["bentuk", "Bentuk"], ["dekorasi", "Dekorasi"], ["bingkai", "Bingkai"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setAssetCat(k)} className={`rounded-lg py-1.5 transition ${assetCat === k ? "bg-accent text-accentfg shadow" : "text-muted"}`}>{l}</button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {ASSETS.filter((a) => a.cat === assetCat).map((a) => (
                  <button key={a.id} title={a.label} onClick={() => p.addAsset(a.id)} className="editor-checker grid aspect-square place-items-center rounded-lg border border-line p-1.5 transition hover:border-accent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(a.id, a.cat === "bingkai" ? "#8d94b0" : a.color)} alt={a.label} className="max-h-full max-w-full object-contain" />
                  </button>
                ))}
              </div>
              {assetCat === "bingkai" && <p className="mt-1.5 text-[11px] text-muted">Bingkai menutupi seluruh halaman; ubah warnanya di panel kanan.</p>}
            </section>

            <section className={sec}>
              <p className={h}>Stiker emoji</p>
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((e) => <button key={e} onClick={() => p.addEmoji(e)} className="grid aspect-square place-items-center rounded-lg border border-line bg-panel text-xl transition hover:scale-110 hover:border-accent">{e}</button>)}
              </div>
            </section>
          </>
        )}

        {p.tab === "foto" && (
          <>
            <section className={sec}>
              <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) p.onFiles(e.target.files); e.target.value = ""; }} />
              <button className="btn btn-primary btn-block" disabled={p.uploading} onClick={() => file.current?.click()}>{p.uploading ? <span className="spinner" /> : <Icon name="plus" className="size-4" />} Upload foto (bisa banyak)</button>
              <p className="mt-1.5 text-center text-[11px] text-muted">atau seret file ke area desain</p>
            </section>

            <section className={sec}>
              <div className="mb-2 flex items-center justify-between">
                <p className={`${h} !mb-0`}>Kumpulan foto ({selected}/{p.pool.length} dipilih)</p>
                {p.pool.length > 0 && <button className="text-[11px] font-bold text-accent" onClick={() => p.selectAll(selected < p.pool.length)}>{selected < p.pool.length ? "Pilih semua" : "Batal pilih"}</button>}
              </div>
              {p.pool.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">Belum ada foto. Upload atau ambil dari foto customer di bawah.</p> : (
                <div className="grid grid-cols-3 gap-1.5">
                  {p.pool.map((it, i) => (
                    <div key={it.id} className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${it.sel ? "border-accent" : "border-transparent"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.thumb} alt="" onClick={() => p.toggle(it.id)} className="size-full cursor-pointer object-cover" draggable={false} />
                      {it.sel && <span className="pointer-events-none absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accentfg">{p.pool.filter((x, j) => x.sel && j <= i).length}</span>}
                      <button aria-label="Hapus dari kumpulan" onClick={() => p.removePool(it.id)} className="absolute right-1 top-1 hidden size-5 place-items-center rounded-full bg-black/65 text-white group-hover:grid"><Icon name="x" className="size-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2.5 grid gap-1.5">
                <button className="btn btn-sm !min-h-9" disabled={!selected} onClick={p.addSelected}>Tambahkan ke halaman ({selected})</button>
                {p.hasFrame && p.emptySlots > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button className="btn btn-sm !min-h-9" disabled={!selected} onClick={() => p.fillSlots(false)}>Isi {p.emptySlots} slot (urut)</button>
                    <button className="btn btn-sm !min-h-9" disabled={!selected} onClick={() => p.fillSlots(true)}>1 foto ke semua slot</button>
                  </div>
                )}
              </div>
            </section>

            <section className={sec}>
              <p className={h}>Foto customer</p>
              <div className="relative mb-2">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input className="input !min-h-9 !pl-9 !text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama, HP, atau kode booking" />
              </div>
              {lib === null ? <div className="skeleton h-20" /> : lib.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">Tidak ada foto. Foto dari Google Drive customer akan muncul di sini.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {lib.map((r) => (
                    <button key={r.id} title={`${r.customer} · ${r.title}`} onClick={() => p.addLibrary(r)} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-panel2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/editor/img?file=${r.id}&w=240`} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] font-semibold text-white">{r.customer}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {p.tab === "frame" && (
          <section className={sec}>
            <p className={h}>Frame photobooth</p>
            {p.frames.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">Belum ada frame. {p.canManageFrames ? <>Upload di <Link className="font-bold text-accent" href="/studio?tab=frame">Studio → Frame</Link> (area foto berwarna hijau).</> : "Minta admin mengunggah frame."}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {p.frames.map((f) => (
                  <button key={f.id} onClick={() => p.applyFrame(f)} className="group overflow-hidden rounded-xl border border-line text-left transition hover:border-accent">
                    <span className="editor-checker block p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.name} loading="lazy" className="mx-auto h-36 w-auto object-contain transition group-hover:scale-105" />
                    </span>
                    <span className="block truncate px-2 py-1.5 text-xs font-semibold">{f.name}<span className="block text-[10px] font-normal text-muted">{f.slots.length} slot · {f.w}×{f.h}</span></span>
                  </button>
                ))}
              </div>
            )}
            {p.hasFrame && <button className="btn btn-sm !min-h-9 mt-3 w-full" onClick={p.removeFrame}>Lepas frame dari halaman</button>}
            {p.canManageFrames && <Link href="/studio?tab=frame" className="mt-3 block text-center text-xs font-bold text-accent">+ Upload frame baru</Link>}
            <p className="mt-3 text-[11px] text-muted">Pilih frame → halaman otomatis berukuran sama dengan frame, lalu isi slot dengan foto dari tab Foto (pilih foto, klik “Isi slot”, atau klik slot kosong).</p>
          </section>
        )}

        {p.tab === "layout" && (
          <>
            <section className={sec}>
              <p className={h}>Susun foto otomatis</p>
              <div className="grid grid-cols-3 gap-1.5">
                {LAYOUTS.map((l) => (
                  <button key={l.id} onClick={() => p.layout(l.id)} className="rounded-xl border border-line bg-panel p-2 text-center text-[11px] font-bold transition hover:border-accent">
                    <LayoutThumb id={l.id} /><span className="mt-1 block">{l.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">Memakai foto yang dipilih di tab Foto; jika tidak ada, foto yang sudah ada di halaman disusun ulang.</p>
            </section>
            <section className={sec}>
              <p className={h}>Carousel otomatis</p>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel2 p-1 text-[11px] font-bold">
                {([["cover", "Cover + grid"], ["single", "1 foto/slide"], ["panorama", "Panorama"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setCStyle(k)} className={`rounded-lg py-1.5 transition ${cStyle === k ? "bg-accent text-accentfg shadow" : "text-muted"}`}>{l}</button>
                ))}
              </div>
              <input className="input !min-h-9 mt-2 !text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul cover (opsional)" />
              <button className="btn btn-primary btn-sm mt-2 w-full" disabled={!selected} onClick={() => p.carousel(cStyle, title)}>Buat carousel dari {selected} foto</button>
              <p className="mt-1.5 text-[11px] text-muted">Halaman desain saat ini diganti. Ukuran 1080×1350 (4:5) bila belum berukuran feed.</p>
            </section>
          </>
        )}

        {p.tab === "teks" && (
          <>
            <section className={sec}>
              <p className={h}>Tambah teks</p>
              <div className="grid gap-1.5">
                <button className="btn !justify-start" onClick={() => p.addText("judul")}><b className="font-display text-lg">Judul besar</b></button>
                <button className="btn !justify-start" onClick={() => p.addText("sub")}><span className="font-semibold">Subjudul</span></button>
                <button className="btn !justify-start" onClick={() => p.addText("caption")}><span className="text-sm">Teks caption kecil</span></button>
                <button className="btn !justify-start" onClick={() => p.addText("label")}><span className="rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accentfg">Label pill</span></button>
              </div>
            </section>
            <section className={sec}>
              <p className={h}>Bentuk</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button className="btn" onClick={() => p.addShape("rect")}>▭ Kotak</button>
                <button className="btn" onClick={() => p.addShape("circle")}>◯ Lingkaran</button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** Miniatur kecil bentuk layout. */
function LayoutThumb({ id }: { id: LayoutId }) {
  const cells: Record<LayoutId, [number, number, number, number, number?][]> = {
    full: [[0, 0, 100, 100]], split2v: [[4, 4, 44, 92], [52, 4, 44, 92]], split2h: [[4, 4, 92, 44], [4, 52, 92, 44]],
    trio: [[4, 4, 92, 56], [4, 64, 44, 32], [52, 64, 44, 32]], stack3: [[4, 4, 92, 28], [4, 36, 92, 28], [4, 68, 92, 28]],
    grid4: [[4, 4, 44, 44], [52, 4, 44, 44], [4, 52, 44, 44], [52, 52, 44, 44]],
    grid6: [[4, 4, 28, 44], [36, 4, 28, 44], [68, 4, 28, 44], [4, 52, 28, 44], [36, 52, 28, 44], [68, 52, 28, 44]],
    polaroid: [[18, 12, 64, 70, -4]], collage: [[4, 6, 60, 36, -6], [36, 32, 60, 36, 5], [8, 58, 60, 36, -2]],
  };
  return (
    <svg viewBox="0 0 100 100" className="mx-auto h-12 w-10 rounded bg-panel2">
      {cells[id].map(([x, y, w, h, r], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={3} fill="currentColor" className="text-accent/70" transform={r ? `rotate(${r} ${x + w / 2} ${y + h / 2})` : undefined} />)}
    </svg>
  );
}

/** Pratinjau template pada rasio halaman saat ini (dirender dengan renderer yang sama dengan editor). */
function TemplateThumb({ t, brand, w, h }: { t: Template; brand: Brand; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const W = 540, H = Math.round((540 * h) / w);
    const page = t.make(W, H, brand);
    const map = new Map<string, HTMLImageElement>();
    const draw = () => { const c = ref.current; if (!c || !live) return; c.width = 220; c.height = Math.round((220 * H) / W); renderPage(c.getContext("2d")!, page, 220 / W, map, true); };
    draw();
    void loadPageImages(page, map).then(draw);
    void document.fonts.ready.then(draw);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, brand.logo, brand.logoDark, brand.accent, brand.accent2, w, h]);
  return <canvas ref={ref} className="block w-full bg-white transition group-hover:brightness-95" />;
}
