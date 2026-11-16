"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import PackageCardView, { type CardPkg } from "./PackageCardView";
import { IMAGE_SIZES, imageSizeKey, packageImages, type ImageSize } from "@/lib/packageUtils";
import { imageSrc } from "@/lib/siteConfig";
import { shrinkImage, uploadToStorage } from "@/lib/uploadClient";

type Img = { image_size: string; image_fit: string; image_x: number; image_y: number };
const MAX = 8;

/**
 * Foto paket: beberapa foto (foto pertama = sampul), upload banyak sekaligus atau tempel link,
 * atur urutan, ukuran, mode isi/utuh, dan titik fokus. Pratinjau kartu (slide) ikut berubah langsung.
 */
export default function PackageImageEditor({ initial, storage }: { initial: CardPkg & Img; storage: boolean }) {
  const [urls, setUrls] = useState<string[]>(() => packageImages(initial));
  const [img, setImg] = useState<Img>({
    image_size: imageSizeKey(initial.image_size), image_fit: initial.image_fit === "contain" ? "contain" : "cover", image_x: initial.image_x ?? 50, image_y: initial.image_y ?? 50,
  });
  const [live, setLive] = useState<CardPkg>(initial);
  const [active, setActive] = useState(0);
  const [prog, setProg] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [link, setLink] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Img>) => setImg((x) => ({ ...x, ...p }));

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

  async function upload(files: File[]) {
    const list = files.filter((f) => f.type.startsWith("image/"));
    if (!list.length) { setErr("Pilih file gambar (JPG, PNG, atau WebP)."); return; }
    const room = MAX - urls.length;
    if (room <= 0) { setErr(`Maksimal ${MAX} foto per paket.`); return; }
    setErr("");
    const take = list.slice(0, room);
    if (list.length > room) setErr(`Hanya ${room} foto pertama yang diunggah (maksimal ${MAX}).`);
    const added: string[] = [];
    for (let i = 0; i < take.length; i++) {
      setProg({ done: i, total: take.length, pct: 0 });
      const small = await shrinkImage(take[i]);
      const r = await uploadToStorage(small, (pct) => setProg({ done: i, total: take.length, pct }));
      if (r.url) added.push(r.url); else { setErr(r.error ?? "Upload gagal."); break; }
    }
    if (added.length) { setUrls((u) => [...u, ...added]); setActive(urls.length); }
    setProg(null);
  }
  const addLink = () => {
    const v = link.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) { setErr("Link foto harus diawali http:// atau https://"); return; }
    if (urls.length >= MAX) { setErr(`Maksimal ${MAX} foto per paket.`); return; }
    setErr(""); setUrls((u) => [...u, v]); setActive(urls.length); setLink("");
  };
  const remove = (i: number) => { setUrls((u) => u.filter((_, k) => k !== i)); setActive((a) => Math.max(0, Math.min(a, urls.length - 2))); };
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= urls.length) return;
    setUrls((u) => { const n = [...u]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    setActive(j);
  };
  const pickFocus = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
    set({ image_x: c(((e.clientX - r.left) / r.width) * 100), image_y: c(((e.clientY - r.top) / r.height) * 100) });
  };

  const cur = urls[Math.min(active, urls.length - 1)];
  const busy = prog !== null;

  return (
    <div ref={root} className="space-y-3 rounded-2xl border border-line bg-panel2/50 p-3.5">
      <input type="hidden" name="image_url" value={urls[0] ?? ""} />
      <input type="hidden" name="images" value={JSON.stringify(urls.slice(1))} />
      <input type="hidden" name="image_size" value={img.image_size} />
      <input type="hidden" name="image_fit" value={img.image_fit} />
      <input type="hidden" name="image_x" value={img.image_x} />
      <input type="hidden" name="image_y" value={img.image_y} />

      <div className="flex items-center justify-between gap-2">
        <span className="label !mb-0">Foto paket ({urls.length}/{MAX})</span>
        <span className="text-[11px] text-muted">Foto pertama = sampul. Lebih dari satu foto jadi slide otomatis.</span>
      </div>

      {urls.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {urls.map((u, i) => (
            <div key={u + i} className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition ${i === active ? "border-accent" : "border-line"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <button type="button" onClick={() => setActive(i)} className="size-full" aria-label={`Foto ${i + 1}`}><img src={imageSrc(u)} alt="" draggable={false} className="size-full object-cover" /></button>
              {i === 0 && <span className="pointer-events-none absolute left-1 top-1 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accentfg">SAMPUL</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                <span className="flex gap-0.5">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-6 place-items-center rounded-md bg-black/50 text-xs text-white disabled:opacity-30" aria-label="Geser ke kiri">←</button>
                  <button type="button" disabled={i === urls.length - 1} onClick={() => move(i, 1)} className="grid size-6 place-items-center rounded-md bg-black/50 text-xs text-white disabled:opacity-30" aria-label="Geser ke kanan">→</button>
                </span>
                <button type="button" onClick={() => remove(i)} className="grid size-6 place-items-center rounded-md bg-bad text-xs text-white" aria-label="Hapus foto">✕</button>
              </div>
            </div>
          ))}
          {urls.length < MAX && storage && (
            <button type="button" disabled={busy} onClick={() => file.current?.click()} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-muted transition hover:border-accent hover:text-accent disabled:opacity-50" aria-label="Tambah foto">
              <span className="text-2xl leading-none">+</span>
            </button>
          )}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = [...(e.dataTransfer.files ?? [])]; if (f.length) void upload(f); }}
        className={`relative grid place-items-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${drag ? "border-accent bg-accentsoft" : "border-line bg-panel"} ${cur ? "h-auto" : "h-32"}`}
      >
        {cur ? (
          <div className="relative w-full cursor-crosshair touch-none select-none" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pickFocus(e); }} onPointerMove={(e) => e.buttons && pickFocus(e)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(cur)} alt="" draggable={false} className="max-h-64 w-full object-contain" />
            <span className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow-lg ring-2 ring-black/30" style={{ left: `${img.image_x}%`, top: `${img.image_y}%` }} />
          </div>
        ) : (
          <button type="button" disabled={!storage || busy} onClick={() => file.current?.click()} className="flex flex-col items-center gap-1 text-sm font-semibold text-muted transition hover:text-accent disabled:cursor-default">
            <Icon name="camera" className="size-7" />
            {storage ? "Klik atau seret beberapa foto ke sini" : "Upload belum aktif — tempel link di bawah"}
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-panel/80 backdrop-blur-sm">
            <div className="w-48 text-center text-sm font-bold">
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${prog.pct}%` }} /></div>
              Mengunggah foto {prog.done + 1} dari {prog.total} · {prog.pct}%
            </div>
          </div>
        )}
      </div>
      {cur && <p className="-mt-1 text-[11px] text-muted">Klik/geser pada foto untuk memilih bagian terpenting (titik fokus); berlaku untuk semua foto saat dipotong.</p>}

      <div className="flex flex-wrap gap-2">
        {storage && (
          <>
            <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void upload(f); }} />
            <button type="button" className="btn btn-sm" disabled={busy || urls.length >= MAX} onClick={() => file.current?.click()}>{urls.length ? "Tambah foto" : "Upload foto"}</button>
          </>
        )}
        <input className="input !min-h-9 min-w-0 flex-1 !py-1 !text-xs" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} placeholder="atau tempel link gambar (https://…) lalu Enter" />
        <button type="button" className="btn btn-sm" disabled={!link.trim()} onClick={addLink}>Tambah link</button>
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
          <PackageCardView p={{ ...live, ...img, image_url: urls[0] ?? "", images: urls.slice(1) }} />
        </div>
      </div>
    </div>
  );
}
