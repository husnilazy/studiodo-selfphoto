import "server-only";
import { one, q } from "./db";
import { DEFAULT_SITE, sanitizeSite, type SiteConfig } from "./siteConfig";

export async function getSiteConfig(): Promise<SiteConfig> {
  const r = await one<{ value: unknown }>("select value from settings where key = 'site'");
  return r ? sanitizeSite(r.value) : DEFAULT_SITE;
}

export async function saveSiteConfig(cfg: SiteConfig) {
  await q("insert into settings (key, value) values ('site', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(cfg)]);
}

/* ───────── Supabase Storage (upload media website) ───────── */
const BUCKET = "website";

export const storageReady = () =>
  !!(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.SUPABASE_ANON_KEY?.trim());

const base = () => process.env.SUPABASE_URL!.trim().replace(/\/$/, "");
const svc = () => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()}` });

let bucketOk = false;
async function ensureBucket() {
  if (bucketOk) return;
  const res = await fetch(`${base()}/storage/v1/bucket`, {
    method: "POST", headers: { ...svc(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  // 200 = dibuat, 400/409 = sudah ada
  if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`Supabase Storage menolak membuat bucket (${res.status}).`);
  bucketOk = true;
}

/** URL upload bertanda tangan: browser mengunggah langsung ke Supabase Storage (tanpa melewati server). */
export async function createSignedMediaUpload(name: string) {
  await ensureBucket();
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] ?? "bin").toLowerCase();
  const path = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${base()}/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: "POST", headers: { ...svc(), "Content-Type": "application/json" }, body: "{}" });
  const j = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok || !j.url) throw new Error(`Gagal menyiapkan upload (${j.message ?? res.status}).`);
  return {
    uploadUrl: `${base()}/storage/v1${j.url}`,
    publicUrl: `${base()}/storage/v1/object/public/${BUCKET}/${path}`,
    anonKey: process.env.SUPABASE_ANON_KEY!.trim(),
  };
}
