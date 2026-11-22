"use client";
import { useRef, useState } from "react";
import { imageSrc } from "@/lib/siteConfig";
import { shrinkImage, uploadToStorage } from "@/lib/uploadClient";

const MAX = 8;

/**
 * Banyak foto untuk satu item (mis. ruang/background): unggah banyak sekaligus atau tempel link, atur urutan, hapus.
 * Foto pertama = sampul. Mengirim field form `image_url` (sampul) dan `images` (sisanya, JSON), sama seperti paket.
 */
export default function MultiImageField({ initial, storage, label = "Foto" }: { initial: string[]; storage: boolean; label?: string }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [prog, setProg] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [err, setErr] = useState("");
  const [link, setLink] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    const list = files.filter((f) => f.type.startsWith("image/"));
    if (!list.length) { setErr("Pilih file gambar (JPG, PNG, atau WebP)."); return; }
    const room = MAX - urls.length;
    if (room <= 0) { setErr(`Maksimal ${MAX} foto.`); return; }
    setErr(list.length > room ? `Hanya ${room} foto pertama yang diunggah (maksimal ${MAX}).` : "");
    const added: string[] = [];
    const take = list.slice(0, room);
    for (let i = 0; i < take.length; i++) {
      setProg({ done: i, total: take.length, pct: 0 });
      const r = await uploadToStorage(await shrinkImage(take[i]), (pct) => setProg({ done: i, total: take.length, pct }));
      if (r.url) added.push(r.url); else { setErr(r.error ?? "Upload gagal."); break; }
    }
    if (added.length) setUrls((u) => [...u, ...added]);
    setProg(null);
  }
  const addLink = () => {
    const v = link.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) { setErr("Link foto harus diawali http:// atau https://"); return; }
    if (urls.length >= MAX) { setErr(`Maksimal ${MAX} foto.`); return; }
    setErr(""); setUrls((u) => [...u, v]); setLink("");
  };
  const remove = (i: number) => setUrls((u) => u.filter((_, k) => k !== i));
  const move = (i: number, d: number) => setUrls((u) => {
    const j = i + d; if (j < 0 || j >= u.length) return u;
    const n = [...u]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const busy = prog !== null;
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-panel2/50 p-3.5">
      <input type="hidden" name="image_url" value={urls[0] ?? ""} />
      <input type="hidden" name="images" value={JSON.stringify(urls.slice(1))} />
      <div className="flex items-center justify-between gap-2">
        <span className="label !mb-0">{label} ({urls.length}/{MAX})</span>
        <span className="text-[11px] text-muted">Foto pertama = sampul. Lebih dari satu jadi slide otomatis.</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {urls.map((u, i) => (
          <div key={u + i} className="group relative aspect-square overflow-hidden rounded-xl border-2 border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(u)} alt="" draggable={false} className="size-full object-cover" />
            {i === 0 && <span className="pointer-events-none absolute left-1 top-1 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accentfg">SAMPUL</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
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
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void upload(f); }} />

      {busy && (
        <div className="space-y-1" role="status">
          <p className="text-xs font-semibold text-muted">Mengunggah {prog.done + 1}/{prog.total}… {prog.pct}%</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-all" style={{ width: `${prog.pct}%` }} /></div>
        </div>
      )}

      <div className="flex gap-2">
        <input className="input !min-h-10 flex-1" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} placeholder="Atau tempel link foto (https://…)" />
        <button type="button" className="btn btn-sm" onClick={addLink}>Tambah</button>
      </div>
      {!storage && <p className="text-xs text-muted">Upload file belum aktif; tempel link foto saja.</p>}
      {err && <p role="alert" className="text-xs font-semibold text-bad">{err}</p>}
    </div>
  );
}
