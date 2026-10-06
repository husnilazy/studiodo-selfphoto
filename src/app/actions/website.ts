"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { sanitizeSite } from "@/lib/siteConfig";
import { createSignedMediaUpload, saveSiteConfig, storageReady } from "@/lib/siteServer";

type R = { ok: true } | { ok: false; error: string };

/** Simpan seluruh konfigurasi website. Kontak (WA/IG/Maps) ikut disinkronkan ke pengaturan booking online. */
export async function saveSite(json: string): Promise<R> {
  try {
    await actionUser(["owner", "admin"]);
    if (json.length > 400_000) throw new Error("Konten terlalu besar.");
    const cfg = sanitizeSite(JSON.parse(json));
    await saveSiteConfig(cfg);
    const l = cfg.lokasi;
    await q(
      `insert into settings (key, value) values ('online', $1::jsonb)
       on conflict (key) do update set value = settings.value || excluded.value`,
      [JSON.stringify({ whatsapp: l.whatsapp, instagram: l.instagram, maps_url: l.maps_url })]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

const MAX = 200 * 1024 * 1024;

/** Siapkan upload media (gambar/video) ke Supabase Storage. */
export async function prepareMediaUpload(name: string, mime: string, size: number):
  Promise<{ ok: true; uploadUrl: string; publicUrl: string; anonKey: string } | { ok: false; error: string }> {
  try {
    await actionUser(["owner", "admin"]);
    if (!storageReady()) throw new Error("Upload belum diaktifkan. Tempel link media, atau isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.");
    if (!/^(image|video)\//.test(mime)) throw new Error("Hanya gambar atau video yang bisa diunggah.");
    if (size > MAX) throw new Error("File terlalu besar (maks 200 MB).");
    return { ok: true, ...(await createSignedMediaUpload(name)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyiapkan upload." };
  }
}
