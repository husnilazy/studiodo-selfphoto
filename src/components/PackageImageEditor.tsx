"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import PackageCardView, { type CardPkg } from "./PackageCardView";
import { IMAGE_SIZES, imageSizeKey, type ImageSize } from "@/lib/packageUtils";
import { shrinkImage, uploadToStorage } from "@/lib/uploadClient";

type Img = { image_url: string; image_size: string; image_fit: string; image_x: number; image_y: number };

/**
 * Foto paket: upload langsung (atau tempel link), atur ukuran, mode isi/utuh, dan titik fokus.
 * Pratinjau kartu website ikut berubah langsung saat form diisi.
 */
export default function PackageImageEditor({ initial, storage }: { initial: CardPkg & Img; storage: boolean }) {
  const [img, setImg] = useState<Img>({
    image_url: initial.image_url, image_size: imageSizeKey(initial.image_size),
    image_fit: initial.image_fit === "contain" ? "contain" : "cover", image_x: initial.image_x ?? 50, image_y: initial.image_y ?? 50,
  });
  const [live, setLive] = useState<CardPkg>(initial);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Img>) => setImg((x) => ({ ...x, ...p }));

  // Ikuti isian form di sekitarnya agar pratinjau kartu selalu sesuai.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const read = () => {
      const fd = new FormData(form);
      const n = (k: string, d: number) => parseInt(String(fd.get(k) ?? "").replace(/\D/g, ""), 10) || d;
      setLive({
        ...initial, name: String(fd.get("name") ?? "") || "Nama paket", category: String(fd.get("category") ?? initial.category),
        price: n("price", 0), duration_min: n("duration_min", 0), max_people: n("max_people", 1),
        per_person: fd.get("pricing") === "per_person", includes: String(fd.get("includes") ?? ""), description: String(fd.get("description") ?? ""),
      });
    };
    read();
    form.addEventListener("input", read); form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(f: File) {
    if (!f.type.startsWith("image/")) { setErr("Pilih file gambar (JPG, PNG, atau WebP)."); return; }
    setErr(""); setPct(0);
    const small = await shrinkImage(f);
    const r = await uploadToStorage(small, setPct);
    if (r.url) set({ image_url: r.url, image_x: 50, image_y: 50 }); else setErr(r.error ?? "Upload gagal.");
    setPct(null);
  }
  const pickFocus = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
    set({ image_x: c(((e.clientX - r.left) / r.width) * 100), image_y: c(((e.clientY - r.top) / r.height) * 100) });
  };

  return (
    <div ref={root} className="space-y-3 rounded-2xl border border-line bg-panel2/50 p-3.5">
      <input type="hidden" name="image_url" value={img.image_url} />
      <input type="hidden" name="image_size" value={img.image_size} />
      <input type="hidden" name="image_fit" value={img.image_fit} />
      <input type="hidden" name="image_x" value={img.image_x} />
      <input type="hidden" name="image_y" value={img.image_y} />

      <div className="flex items-center justify-between gap-2">
        <span className="label !mb-0">Foto paket</span>
        {img.image_url && <button type="button" className="text-xs font-semibold text-bad" onClick={() => set({ image_url: "" })}>Hapus foto</button>}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
        className={`relative grid place-items-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${drag ? "border-accent bg-accentsoft" : "border-line bg-panel"} ${img.image_url ? "h-auto" : "h-32"}`}
      >
        {img.image_url ? (
          <div className="relative w-full cursor-crosshair touch-none select-none" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pickFocus(e); }} onPointerMove={(e) => e.buttons && pickFocus(e)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.image_url} alt="" draggable={false} className="max-h-64 w-full object-contain" />
            <span className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow-lg ring-2 ring-black/30" style={{ left: `${img.image_x}%`, top: `${img.image_y}%` }} />
          </div>
        ) : (
          <button type="button" disabled={!storage || pct !== null} onClick={() => file.current?.click()} className="flex flex-col items-center gap-1 text-sm font-semibold text-muted transition hover:text-accent disabled:cursor-default">
            <Icon name="camera" className="size-7" />
            {storage ? "Klik atau seret foto ke sini" : "Upload belum aktif — tempel link di bawah"}
          </button>
        )}
        {pct !== null && (
          <div className="absolute inset-0 grid place-items-center bg-panel/80 backdrop-blur-sm">
            <div className="w-40 text-center text-sm font-bold">
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} /></div>
              Mengunggah {pct}%
            </div>
          </div>
        )}
      </div>
      {img.image_url && <p className="-mt-1 text-[11px] text-muted">Klik/geser pada foto untuk memilih bagian terpenting (titik fokus) saat foto dipotong.</p>}

      <div className="flex flex-wrap gap-2">
        {storage && (
          <>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            <button type="button" className="btn btn-sm" disabled={pct !== null} onClick={() => file.current?.click()}>{img.image_url ? "Ganti foto" : "Upload foto"}</button>
          </>
        )}
        <input className="input !min-h-9 min-w-0 flex-1 !py-1 !text-xs" value={img.image_url} onChange={(e) => set({ image_url: e.target.value })} placeholder="atau tempel link gambar (https://…)" />
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-bad">{err}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Tinggi foto di kartu</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1">
            {(Object.keys(IMAGE_SIZES) as ImageSize[]).map((k) => (
              <button key={k} type="button" onClick={() => set({ image_size: k })} className={`rounded-lg py-1.5 text-xs font-bold transition ${img.image_size === k ? "bg-accent text-accentfg shadow" : "text-muted hover:text-fg"}`}>{IMAGE_SIZES[k].label}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Tampilan</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1">
            {([["cover", "Penuh"], ["contain", "Utuh"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => set({ image_fit: k })} className={`rounded-lg py-1.5 text-xs font-bold transition ${img.image_fit === k ? "bg-accent text-accentfg shadow" : "text-muted hover:text-fg"}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="label">Pratinjau di website</span>
        <div className="mx-auto max-w-[22rem] rounded-3xl p-2" style={{ background: "var(--bg)" }}>
          <PackageCardView p={{ ...live, ...img }} />
        </div>
      </div>
    </div>
  );
}
