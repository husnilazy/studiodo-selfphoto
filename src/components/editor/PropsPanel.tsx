"use client";
import Icon from "../Icon";
import { assetUrl } from "@/lib/editor/assets";
import { BG_PRESETS } from "@/lib/editor/layouts";
import { isSlotPhoto, resizePage } from "@/lib/editor/ops";
import { FONTS, NO_FILTER, SIZES, sizeById, type Background, type Filter, type Layer, type Page, type PhotoLayer, type ShapeLayer, type TextLayer } from "@/lib/editor/types";

export const FILTER_PRESETS: { name: string; f: Partial<Filter> }[] = [
  { name: "Normal", f: {} },
  { name: "Cerah", f: { brightness: 110, contrast: 105, saturate: 118 } },
  { name: "Hangat", f: { warmth: 45, saturate: 110 } },
  { name: "Sejuk", f: { warmth: -45 } },
  { name: "Vintage", f: { warmth: 35, contrast: 90, saturate: 80, brightness: 105 } },
  { name: "B&W", f: { grayscale: 100, contrast: 112 } },
  { name: "Dramatis", f: { contrast: 135, saturate: 90, brightness: 92 } },
];
const BASIC = ["#ffffff", "#0b1020", "#ef4444", "#f59e0b", "#fbbf24", "#10b981", "#06b6d4", "#4f4fe8", "#a78bfa", "#ec4899"];

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

/** Pilih warna: input warna + deretan warna brand & umum. */
function Color({ label, value, palette, onChange, clear }: { label: string; value: string; palette: string[]; onChange: (c: string) => void; clear?: () => void }) {
  const all = [...new Set([...palette, ...BASIC])].slice(0, 12);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="color" className="input !min-h-8 !w-12 shrink-0 !p-0.5" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {all.map((c) => <button key={c} type="button" aria-label={c} onClick={() => onChange(c)} className="size-5 rounded-full border border-line" style={{ background: c }} />)}
          {clear && <button type="button" onClick={clear} className="grid size-5 place-items-center rounded-full border border-line text-[10px] text-muted">×</button>}
        </div>
      </div>
    </div>
  );
}

type Common = { patch: (p: Partial<Layer>, key: string) => void; palette: string[] };

export default function PropsPanel({
  page, layer, cropMode, setCropMode, patch, patchPage, remove, duplicate, order, replacePhoto, applyFilterAll, detachSlot, deletePage,
  palette, align, ensureFont, fillPlaceholder, canFill,
}: {
  page: Page; layer: Layer | null; cropMode: boolean; setCropMode: (v: boolean) => void;
  patch: (p: Partial<Layer>, key: string) => void; patchPage: (fn: (p: Page) => Page, key: string) => void;
  remove: () => void; duplicate: () => void; order: (d: 1 | -1 | "top" | "bottom") => void;
  replacePhoto: () => void; applyFilterAll: (f: Filter) => void; detachSlot: () => void; deletePage: () => void;
  palette: string[]; align: (to: "l" | "c" | "r" | "t" | "m" | "b") => void; ensureFont: (f: string) => void;
  fillPlaceholder: () => void; canFill: boolean;
}) {
  if (!layer || layer.type === "frame") return <PagePanel page={page} patchPage={patchPage} deletePage={deletePage} palette={palette} />;
  const k = (s: string) => `${s}-${layer.id}`;
  const common: Common = { patch, palette };

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <p className="font-display truncate font-semibold">{layer.type === "photo" ? (layer.slot !== undefined ? `Foto slot ${layer.slot + 1}` : layer.assetId ? "Elemen" : layer.src ? "Foto" : "Kotak foto") : layer.type === "text" ? "Teks" : "Bentuk"}</p>
        <div className="flex gap-1">
          <button className="btn btn-sm !min-h-8 !px-2" title="Naikkan" onClick={() => order(1)}>↑</button>
          <button className="btn btn-sm !min-h-8 !px-2" title="Turunkan" onClick={() => order(-1)}>↓</button>
          {!isSlotPhoto(layer) && <button className="btn btn-sm !min-h-8 !px-2" title="Duplikat (Ctrl+D)" onClick={duplicate}><Icon name="copy" className="size-4" /></button>}
          <button className="btn btn-sm !min-h-8 !px-2" title="Kunci posisi" onClick={() => patch({ locked: !layer.locked }, k("lock"))}><Icon name="lock" className={`size-4 ${layer.locked ? "text-accent" : ""}`} /></button>
          <button className="btn btn-sm btn-danger !min-h-8 !px-2" title="Hapus" onClick={remove}><Icon name="trash" className="size-4" /></button>
        </div>
      </div>

      {layer.type === "photo" && <PhotoProps l={layer} {...common} k={k} cropMode={cropMode} setCropMode={setCropMode} replacePhoto={replacePhoto} applyFilterAll={applyFilterAll} detachSlot={detachSlot} fillPlaceholder={fillPlaceholder} canFill={canFill} />}
      {layer.type === "text" && <TextProps l={layer} {...common} k={k} ensureFont={ensureFont} />}
      {layer.type === "shape" && <ShapeProps l={layer} {...common} k={k} />}

      <Sect t="Posisi & transformasi">
        <div className="grid grid-cols-6 gap-1">
          {([["l", "⇤", "Rata kiri"], ["c", "⇔", "Tengah horizontal"], ["r", "⇥", "Rata kanan"], ["t", "⤒", "Rata atas"], ["m", "⇕", "Tengah vertikal"], ["b", "⤓", "Rata bawah"]] as const).map(([a, ic, tt]) => (
            <button key={a} title={tt} className="btn btn-sm !min-h-8 !px-0" onClick={() => align(a)}>{ic}</button>
          ))}
        </div>
        <Rng label="Putar" value={layer.rot} min={-180} max={180} unit="°" onChange={(v) => patch({ rot: v }, k("rot"))} />
        <Rng label="Transparansi" value={Math.round(layer.opacity * 100)} min={5} max={100} unit="%" onChange={(v) => patch({ opacity: v / 100 }, k("op"))} />
      </Sect>
    </div>
  );
}

function PhotoProps({ l, patch, palette, k, cropMode, setCropMode, replacePhoto, applyFilterAll, detachSlot, fillPlaceholder, canFill }: Common & {
  l: PhotoLayer; k: (s: string) => string; cropMode: boolean; setCropMode: (v: boolean) => void;
  replacePhoto: () => void; applyFilterAll: (f: Filter) => void; detachSlot: () => void; fillPlaceholder: () => void; canFill: boolean;
}) {
  const f = l.filter;
  const setF = (p: Partial<Filter>, key: string) => patch({ filter: { ...f, ...p } }, k(key));
  const slot = l.slot !== undefined;

  if (l.assetId) {
    return (
      <Sect t="Elemen">
        <Color label="Warna" value={l.color ?? "#4f4fe8"} palette={palette} onChange={(c) => patch({ color: c, src: assetUrl(l.assetId!, c) } as Partial<Layer>, k("acol"))} />
        <div className="flex gap-1.5"><Toggle on={l.flipX} label="↔ Balik" onClick={() => patch({ flipX: !l.flipX }, k("flip"))} /></div>
      </Sect>
    );
  }
  if (!l.src) {
    return (
      <Sect t="Kotak foto kosong">
        <p className="text-xs text-muted">Pilih foto di tab Foto lalu tekan tombol di bawah — atau langsung klik foto di kumpulan saat kotak ini terpilih.</p>
        <button className="btn btn-primary btn-sm w-full" disabled={!canFill} onClick={fillPlaceholder}>Isi dari foto terpilih</button>
        <button className="btn btn-sm w-full" onClick={replacePhoto}>Upload dari perangkat</button>
        <Rng label="Sudut membulat" value={l.radius} min={0} max={Math.round(Math.min(l.w, l.h) / 2)} onChange={(v) => patch({ radius: v }, k("rad"))} />
      </Sect>
    );
  }
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
          <div className="flex flex-wrap gap-1.5">
            <Toggle on={l.radius === 0} label="Kotak" onClick={() => patch({ radius: 0 }, k("rad"))} />
            <Toggle on={l.radius > 0 && l.radius < Math.min(l.w, l.h) / 2 - 1} label="Membulat" onClick={() => patch({ radius: Math.round(Math.min(l.w, l.h) * 0.08) }, k("rad"))} />
            <Toggle on={l.radius >= Math.min(l.w, l.h) / 2 - 1} label="Lingkaran" onClick={() => patch({ radius: Math.round(Math.min(l.w, l.h) / 2) }, k("rad"))} />
          </div>
          <Rng label="Sudut membulat" value={l.radius} min={0} max={Math.round(Math.min(l.w, l.h) / 2)} onChange={(v) => patch({ radius: v }, k("rad"))} />
          <Rng label="Bingkai" value={l.border} min={0} max={80} onChange={(v) => patch({ border: v }, k("bd"))} />
          {l.border > 0 && <Color label="Warna bingkai" value={l.borderColor} palette={palette} onChange={(c) => patch({ borderColor: c }, k("bdc"))} />}
          <Toggle on={l.shadow} label="Bayangan" onClick={() => patch({ shadow: !l.shadow }, k("sh"))} />
        </Sect>
      )}
    </>
  );
}

function TextProps({ l, patch, palette, k, ensureFont }: Common & { l: TextLayer; k: (s: string) => string; ensureFont: (f: string) => void }) {
  return (
    <Sect t="Teks">
      <textarea className="input !min-h-20 !text-sm" value={l.text} onChange={(e) => patch({ text: e.target.value }, k("txt"))} />
      <select className="input !min-h-9 !text-sm" value={l.font} onChange={(e) => { ensureFont(e.target.value); patch({ font: e.target.value }, k("font")); }}>
        {FONTS.map((f) => <option key={f}>{f}</option>)}
      </select>
      <Rng label="Ukuran" value={Math.round(l.size)} min={12} max={400} onChange={(v) => patch({ size: v }, k("size"))} />
      <div className="flex flex-wrap items-center gap-1.5">
        <Toggle on={l.weight >= 700} label="B" onClick={() => patch({ weight: l.weight >= 700 ? 400 : 800 }, k("w"))} />
        <Toggle on={l.italic} label="I" onClick={() => patch({ italic: !l.italic }, k("i"))} />
        {(["left", "center", "right"] as const).map((a) => <Toggle key={a} on={l.align === a} label={a === "left" ? "⟸" : a === "center" ? "≡" : "⟹"} onClick={() => patch({ align: a }, k("al"))} />)}
        <Toggle on={l.shadow} label="Bayangan" onClick={() => patch({ shadow: !l.shadow }, k("sh"))} />
        <Toggle on={l.text === l.text.toUpperCase() && l.text !== l.text.toLowerCase()} label="AA" onClick={() => patch({ text: l.text === l.text.toUpperCase() ? l.text.toLowerCase() : l.text.toUpperCase() }, k("case"))} />
      </div>
      <Color label="Warna teks" value={l.color} palette={palette} onChange={(c) => patch({ color: c }, k("col"))} />
      <Color label="Latar teks (pill)" value={l.bg || "#ffffff"} palette={palette} onChange={(c) => patch({ bg: c }, k("bg"))} clear={() => patch({ bg: "" }, k("bg"))} />
      <Color label="Outline" value={l.stroke ?? "#000000"} palette={palette} onChange={(c) => patch({ stroke: c, strokeW: l.strokeW || Math.max(2, Math.round(l.size * 0.05)) }, k("st"))} clear={() => patch({ strokeW: 0 }, k("st"))} />
      <Rng label="Tebal outline" value={l.strokeW ?? 0} min={0} max={30} onChange={(v) => patch({ strokeW: v }, k("sw"))} />
      <Rng label="Jarak huruf" value={l.letter} min={-5} max={30} onChange={(v) => patch({ letter: v }, k("ls"))} />
      <Rng label="Jarak baris" value={l.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => patch({ lineHeight: v }, k("lh"))} />
    </Sect>
  );
}

function ShapeProps({ l, patch, palette, k }: Common & { l: ShapeLayer; k: (s: string) => string }) {
  return (
    <Sect t="Bentuk">
      <Color label="Warna isi" value={l.fill} palette={palette} onChange={(c) => patch({ fill: c }, k("fill"))} />
      {l.shape === "rect" && <Rng label="Sudut membulat" value={l.radius} min={0} max={Math.round(Math.min(l.w, l.h) / 2)} onChange={(v) => patch({ radius: v }, k("rad"))} />}
      <Rng label="Garis tepi" value={l.strokeW ?? 0} min={0} max={40} onChange={(v) => patch({ strokeW: v, stroke: l.stroke ?? "#0b1020" }, k("sw"))} />
      {(l.strokeW ?? 0) > 0 && <Color label="Warna garis tepi" value={l.stroke ?? "#0b1020"} palette={palette} onChange={(c) => patch({ stroke: c }, k("sc"))} />}
    </Sect>
  );
}

function PagePanel({ page, patchPage, deletePage, palette }: { page: Page; patchPage: (fn: (p: Page) => Page, key: string) => void; deletePage: () => void; palette: string[] }) {
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
        <Color label="Warna 1" value={bg.c1} palette={palette} onChange={(c) => setBg({ c1: c })} />
        <Color label="Warna 2 (gradasi)" value={bg.c2} palette={palette} onChange={(c) => setBg({ c2: c, type: "gradient" })} />
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
