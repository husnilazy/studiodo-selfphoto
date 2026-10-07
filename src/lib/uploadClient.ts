"use client";
import { prepareMediaUpload } from "@/app/actions/website";

/** Perkecil gambar besar (maks 1800px, WebP) sebelum diunggah agar cepat dimuat di website. */
export async function shrinkImage(file: File, max = 1800): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 600_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch { return file; }
}

/** Unggah satu file ke Supabase Storage (URL bertanda tangan) dan kembalikan URL publiknya. */
export async function uploadToStorage(file: File, onPct?: (n: number) => void): Promise<{ url?: string; error?: string }> {
  const p = await prepareMediaUpload(file.name, file.type, file.size);
  if (!p.ok) return { error: p.error };
  const fd = new FormData();
  fd.append("cacheControl", "31536000");
  fd.append("", file);
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", p.uploadUrl);
    x.setRequestHeader("apikey", p.anonKey);
    x.setRequestHeader("Authorization", `Bearer ${p.anonKey}`);
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => e.lengthComputable && onPct?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => resolve(x.status >= 200 && x.status < 300 ? { url: p.publicUrl } : { error: `Upload gagal (${x.status}). ${x.responseText.slice(0, 120)}` });
    x.onerror = () => resolve({ error: "Koneksi terputus saat upload." });
    x.send(fd);
  });
}
