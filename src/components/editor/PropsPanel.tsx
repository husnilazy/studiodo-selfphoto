"use client";
import Icon from "../Icon";
import { FONTS, NO_FILTER, SIZES, sizeById, type Background, type Filter, type Layer, type Page, type PhotoLayer, type ShapeLayer, type TextLayer } from "@/lib/editor/types";
import { BG_PRESETS } from "@/lib/editor/layouts";
import { isSlotPhoto, resizePage } from "@/lib/editor/ops";

export const FILTER_PRESETS: { name: string; f: Partial<Filter> }[] = [
  { name: "Normal", f: {} },
  { name: "Cerah", f: { brightness: 110, contrast: 105, saturate: 118 } },
  { name: "Hangat", f: { warmth: 45, saturate: 110 } },
  { name: "Sejuk", f: { warmth: -45 } },
  { name: "Vintage", f: { warmth: 35, contrast: 90, saturate: 80, brightness: 105 } },
  { name: "B&W", f: { grayscale: 100, contrast: 112 } },
  { name: "Dramatis", f: { contrast: 135, saturate: 90, brightness: 92 } },
];

function Rng({ label, value, min, max, step = 1, unit = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-0.5 flex justify-between text-[11px] font-semibold text-muted"><span>{label}</span><span className="tnum">{Math.round(value * 100) / 100}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--accent)]" />
    </label>
  );
}
const Sect = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="space-y-2.5 border-b border-line px-3.5 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">{t}</p>{children}</section>
);
const Toggle = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${on ? "border-transparent bg-accent text-accentfg" : "border-line bg-panel text-muted hover:text-fg"}`}>{label}</button>
);

export default function PropsPanel({
  page, layer, cropMode, setCropMode, patch, patchPage, remove, duplicate, order, replacePhoto, applyFilterAll, detachSlot, deletePage,
}: {
  page: Page; layer: Layer | null; cropMode: boolean; setCropMode: (v: boolean) => void;
  patch: (p: Partial<Layer>, key: string) => void; patchPage: (fn: (p: Page) => Page, key: string) => void;
  remove: () => void; duplicate: () => void; order: (d: 1 | -1 | "top" | "bottom") => void;
  replacePhoto: () => void; applyFilterAll: (f: Filter) => void; detachSlot: () => void; deletePage: () => void;
}) {
  if (!layer || layer.type === "frame") return <PagePanel page={page} patchPage={patchPage} deletePage={deletePage} />;
  const k = (s: string) => `${s}-${layer.id}`;

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <p className="font-display truncate font-semibold">{layer.type === "photo" ? (isSlotPhoto(layer) ? `Foto slot ${layer.slot! + 1}` : "Foto") : layer.type === "text" ? "Teks" : "Bentuk"}</p>
        <div className="flex gap-1">
          <button className="btn btn-sm !min-h-8 !px-2" title="Naikkan" onClick={() => order(1)}>↑</button>
          <button className="btn btn-sm !min-h-8 !px-2" title="Turunkan" onClick={() => order(-1)}>↓</button>
          {!isSlotPhoto(layer) && <button className="btn btn-sm !min-h-8 !px-2" title="Duplikat" onClick={duplicate}><Icon name="copy" className="size-4" /></button>}
          <button className="btn btn-sm btn-danger !min-h-8 !px-2" title="Hapus" onClick={remove}><Icon name="trash" className="size-4" /></button>
        </div>
      </div>

      {layer.type === "photo" && <PhotoProps l={layer} patch={patch} k={k} cropMode={cropMode} setCropMode={setCropMode} replacePhoto={replacePhoto} applyFilterAll={applyFilterAll} detachSlot={detachSlot} />}
      {layer.type === "text" && <TextProps l={layer} patch={patch} k={k} />}
      {layer.type === "shape" && <ShapeProps l={layer} patch={patch} k={k} />}

      <Sect t="Transformasi">
        <Rng label="Putar" value={layer.rot} min={-180} max={180} unit="°" onChange={(v) => patch({ rot: v }, k("rot"))} />
        <Rng label="Transparansi" value={Math.round(layer.opacity * 100)} min={5} max={100} unit="%" onChange={(v) => patch({ opacity: v / 100 }, k("op"))} />
      </Sect>
    </div>
  );
}

function PhotoProps({ l, patch, k, cropMode, setCropMode, replacePhoto, applyFilterAll, detachSlot }: {
  l: PhotoLayer; patch: (p: Partial<Layer>, key: string) => void; k: (s: string) => string; cropMode: boolean; setCropMode: (v: boolean) => void;
  replacePhoto: () => void; applyFilterAll: (f: Filter) => void; detachSlot: () => void;
}) {
  const f = l.filter;
  const setF = (p: Partial<Filter>, key: string) => patch({ filter: { ...f, ...p } }, k(key));
  const slot = l.slot !== undefined;
  return (
    <>
      <Sect t="Isi foto">
        <Rng label="Zoom" value={l.zoom} min={1} max={6} step={0.01} unit="×" onChange={(v) => patch({ zoom: v }, k("zoom"))} />
        <div className="grid grid-cols-2 gap-2">
          <Rng label="Geser X" value={l.ox} min={-1} max={1} step={0.01} onChange={(v) => patch({ ox: v }, k("ox"))} />
          <Rng label="Geser Y" value={l.oy} min={-1} max={1} step={0.01} onChange={(v) => patch({ oy: v }, k("oy"))} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!slot && <Toggle on={cropMode} label="✋ Geser isi" onClick={() => setCropMode(!cropMode)} />}
          <Toggle on={l.fit === "cover"} label="Penuh" onClick={() => patch({ fit: "cover" }, k("fit"))} />
          <Toggle on={l.fit === "contain"} label="Utuh" onClick={() => patch({ fit: "contain", zoom: 1, ox: 0, oy: 0 }, k("fit"))} />
          <Toggle on={l.flipX} label="↔ Balik" onClick={() => patch({ flipX: !l.flipX }, k("flip"))} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-sm !min-h-8" onClick={replacePhoto}>Ganti foto</button>
          {slot && <button className="btn btn-sm !min-h-8" onClick={detachSlot}>Lepas dari slot</button>}
          <button className="btn btn-sm !min-h-8" onClick={() => patch({ zoom: 1, ox: 0, oy: 0 }, k("reset"))}>Reset posisi</button>
        </div>
        {slot && <p className="text-[11px] text-muted">Seret foto di slot untuk menggeser isinya; roda mouse = zoom.</p>}
      </Sect>

      <Sect t="Filter">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_PRESETS.map((p) => <button key={p.name} className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-bold hover:border-accent" onClick={() => patch({ filter: { ...NO_FILTER, ...p.f } }, k("fp"))}>{p.name}</button>)}
        </div>
        <Rng label="Kecerahan" value={f.brightness} min={40} max={180} unit="%" onChange={(v) => setF({ brightness: v }, "fb")} />
        <Rng label="Kontras" value={f.contrast} min={40} max={180} unit="%" onChange={(v) => setF({ contrast: v }, "fc")} />
        <Rng label="Saturasi" value={f.saturate} min={0} max={200} unit="%" onChange={(v) => setF({ saturate: v }, "fs")} />
        <Rng label="Hangat ⇄ Sejuk" value={f.warmth} min={-100} max={100} onChange={(v) => setF({ warmth: v }, "fw")} />
        <Rng label="Hitam-putih" value={f.grayscale} min={0} max={100} unit="%" onChange={(v) => setF({ grayscale: v }, "fg")} />
        <Rng label="Blur" value={f.blur} min={0} max={20} onChange={(v) => setF({ blur: v }, "fbl")} />
        <button className="btn btn-sm !min-h-8 w-full" onClick={() => applyFilterAll(f)}>Terapkan filter ke semua foto</button>
      </Sect>

      {!slot && (
        <Sect t="Tampilan">
          <Rng label="Sudut membulat" value={l.radius} min={0} max={Math.round(Math.min(l.w, l.h) / 2)} onChange={(v) => patch({ radius: v }, k("rad"))} />
          <Rng label="Bingkai" value={l.border} min={0} max={80} onChange={(v) => patch({ border: v }, k("bd"))} />
          {l.border > 0 && <input type="color" className="input !min-h-9 !p-1" value={l.borderColor} onChange={(e) => patch({ borderColor: e.target.value }, k("bdc"))} />}
          <Toggle on={l.shadow} label="Bayangan" onClick={() => patch({ shadow: !l.shadow }, k("sh"))} />
        </Sect>
      )}
    </>
  );
}

function TextProps({ l, patch, k }: { l: TextLayer; patch: (p: Partial<Layer>, key: string) => void; k: (s: string) => string }) {
  return (
    <Sect t="Teks">
      <textarea className="input !min-h-20 !text-sm" value={l.text} onChange={(e) => patch({ text: e.target.value }, k("txt"))} />
      <select className="input !min-h-9 !text-sm" value={l.font} onChange={(e) => patch({ font: e.target.value }, k("font"))}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
      <Rng label="Ukuran" value={Math.round(l.size)} min={12} max={400} onChange={(v) => patch({ size: v }, k("size"))} />
      <div className="flex flex-wrap items-center gap-1.5">
        <Toggle on={l.weight >= 700} label="B" onClick={() => patch({ weight: l.weight >= 700 ? 400 : 800 }, k("w"))} />
        <Toggle on={l.italic} label="I" onClick={() => patch({ italic: !l.italic }, k("i"))} />
        {(["left", "center", "right"] as const).map((a) => <Toggle key={a} on={l.align === a} label={a === "left" ? "⟸" : a === "center" ? "≡" : "⟹"} onClick={() => patch({ align: a }, k("al"))} />)}
        <Toggle on={l.shadow} label="Bayangan" onClick={() => patch({ shadow: !l.shadow }, k("sh"))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Warna</span><input type="color" className="input !min-h-9 !p-1" value={l.color} onChange={(e) => patch({ color: e.target.value }, k("col"))} /></label>
        <label className="block"><span className="label">Latar teks</span>
          <span className="flex gap-1"><input type="color" className="input !min-h-9 !p-1" value={l.bg || "#ffffff"} onChange={(e) => patch({ bg: e.target.value }, k("bg"))} /><button className="btn btn-sm !min-h-9 !px-2" onClick={() => patch({ bg: "" }, k("bg"))}>×</button></span>
        </label>
      </div>
      <Rng label="Jarak huruf" value={l.letter} min={-5} max={30} onChange={(v) => patch({ letter: v }, k("ls"))} />
      <Rng label="Jarak baris" value={l.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => patch({ lineHeight: v }, k("lh"))} />
    </Sect>
  );
}

function ShapeProps({ l, patch, k }: { l: ShapeLayer; patch: (p: Partial<Layer>, key: string) => void; k: (s: string) => string }) {
  return (
    <Sect t="Bentuk">
      <label className="block"><span className="label">Warna</span><input type="color" className="input !min-h-9 !p-1" value={l.fill} onChange={(e) => patch({ fill: e.target.value }, k("fill"))} /></label>
      {l.shape === "rect" && <Rng label="Sudut membulat" value={l.radius} min={0} max={Math.round(Math.min(l.w, l.h) / 2)} onChange={(v) => patch({ radius: v }, k("rad"))} />}
    </Sect>
  );
}

function PagePanel({ page, patchPage, deletePage }: { page: Page; patchPage: (fn: (p: Page) => Page, key: string) => void; deletePage: () => void }) {
  const bg = page.bg;
  const setBg = (b: Partial<Background>, key = "bg") => patchPage((p) => ({ ...p, bg: { ...p.bg, ...b } }), key);
  return (
    <div className="text-sm">
      <div className="border-b border-line px-3.5 py-2.5"><p className="font-display font-semibold">Halaman</p><p className="text-xs text-muted">{page.w} × {page.h} px · {page.layers.filter((l) => l.type !== "frame").length} elemen</p></div>
      <Sect t="Latar">
        <div className="grid grid-cols-8 gap-1.5">
          {BG_PRESETS.map((b, i) => (
            <button key={i} aria-label="Latar" onClick={() => patchPage((p) => ({ ...p, bg: b }), "bg")} className="aspect-square rounded-lg border border-line"
              style={{ background: b.type === "gradient" ? `linear-gradient(${b.angle}deg, ${b.c1}, ${b.c2})` : b.c1 }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Warna 1</span><input type="color" className="input !min-h-9 !p-1" value={bg.c1} onChange={(e) => setBg({ c1: e.target.value })} /></label>
          <label className="block"><span className="label">Warna 2 (gradasi)</span><input type="color" className="input !min-h-9 !p-1" value={bg.c2} onChange={(e) => setBg({ c2: e.target.value, type: "gradient" })} /></label>
        </div>
        {bg.type === "gradient" && <Rng label="Arah gradasi" value={bg.angle} min={0} max={360} unit="°" onChange={(v) => setBg({ angle: v }, "bga")} />}
        <button className="btn btn-sm !min-h-8" onClick={() => setBg({ type: bg.type === "gradient" ? "color" : "gradient" })}>{bg.type === "gradient" ? "Pakai warna polos" : "Pakai gradasi"}</button>
      </Sect>
      <Sect t="Ukuran halaman">
        <select className="input !min-h-9 !text-sm" value={SIZES.find((s) => s.w === page.w && s.h === page.h)?.id ?? ""} onChange={(e) => { const s = sizeById(e.target.value); if (s) patchPage((p) => resizePage(p, s.w, s.h), "size"); }}>
          <option value="" disabled>Ukuran khusus ({page.w}×{page.h})</option>
          {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <p className="text-[11px] text-muted">Isi halaman ikut diskalakan proporsional.</p>
      </Sect>
      <Sect t="Halaman"><button className="btn btn-sm btn-danger !min-h-8" onClick={deletePage}><Icon name="trash" className="size-4" /> Hapus halaman ini</button></Sect>
    </div>
  );
}
