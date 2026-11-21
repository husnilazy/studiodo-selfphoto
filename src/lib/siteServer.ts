import "server-only";
import { headers } from "next/headers";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { one, q } from "./db";
import { DEFAULT_SITE, sanitizeSite, type SiteConfig } from "./siteConfig";

export async function getSiteConfig(): Promise<SiteConfig> {
  const r = await one<{ value: unknown }>("select value from settings where key = 'site'");
  return r ? sanitizeSite(r.value) : DEFAULT_SITE;
}

export async function saveSiteConfig(cfg: SiteConfig) {
  await q("insert into settings (key, value) values ('site', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(cfg)]);
}

/* ───────── Neon Object Storage (S3-compatible; upload media website) ───────── */
const BUCKET = "website";
const CACHE = "public, max-age=31536000, immutable";

export const storageReady = () =>
  !!(process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim() && process.env.AWS_ENDPOINT_URL_S3?.trim());

let client: S3Client | null = null;
const s3 = () => (client ??= new S3Client({ forcePathStyle: true })); // path-style wajib di Neon; kredensial/endpoint/region dari env AWS_*

/** Asal URL publik media: MEDIA_BASE_URL bila diisi, jika tidak asal request ini. Media dilayani lewat /media/* (lihat next.config.ts). */
async function mediaOrigin() {
  const fixed = process.env.MEDIA_BASE_URL?.trim().replace(/\/$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^localhost|^127\./.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** URL upload bertanda tangan: browser mengunggah langsung ke Neon Object Storage (tanpa melewati server). */
export async function createSignedMediaUpload(name: string, mime: string) {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] ?? "bin").toLowerCase();
  const key = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: mime, CacheControl: CACHE }),
    { expiresIn: 900 },
  );
  return { uploadUrl, publicUrl: `${await mediaOrigin()}/media/${key}`, contentType: mime, cacheControl: CACHE };
}
