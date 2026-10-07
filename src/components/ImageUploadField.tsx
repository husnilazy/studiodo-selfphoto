"use client";
import { useRef, useState } from "react";
import Icon from "./Icon";
import { imageSrc } from "@/lib/siteConfig";
import { shrinkImage, uploadToStorage } from "@/lib/uploadClient";

/**
 * Foto yang diunggah langsung (klik atau seret). Nilainya dikirim lewat input tersembunyi `name`.
 * Tempel link hanya muncul bila upload belum aktif di server.
 */
export default function ImageUploadField({ name, defaultValue = "", storage, label, aspect = "aspect-[16/9]" }: {
  name: string; defaultValue?: string; storage: boolean; label: string; aspect?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function upload(f: File) {
    if (!f.type.startsWith("image/")) { setErr("Pilih file gambar (JPG, PNG, atau WebP)."); return; }
    setErr(""); setPct(0);
    const r = await uploadToStorage(await shrinkImage(f), setPct);
    if (r.url) setUrl(r.url); else setErr(r.error ?? "Upload gagal.");
    setPct(null);
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label !mb-0">{label}</span>
        {url && <button type="button" className="text-xs font-semibold text-bad" onClick={() => setUrl("")}>Hapus foto</button>}
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
        className={`group relative grid ${aspect} place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${drag ? "border-accent bg-accentsoft" : "border-line bg-panel2/60"}`}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(url)} alt="" className="size-full object-cover" />
            {storage && (
              <button type="button" disabled={pct !== null} onClick={() => file.current?.click()} className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur transition hover:bg-black/75">Ganti foto</button>
            )}
          </>
        ) : (
          <button type="button" disabled={!storage || pct !== null} onClick={() => file.current?.click()} className="flex flex-col items-center gap-1 px-4 text-center text-sm font-semibold text-muted transition hover:text-accent disabled:cursor-default">
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
      {storage && <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />}
      {!storage && <input className="input mt-2 !min-h-9 !text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link gambar (https://…)" />}
      {err && <p role="alert" className="mt-1 text-xs font-semibold text-bad">{err}</p>}
    </div>
  );
}
