import { headers } from "next/headers";

/**
 * Alamat dasar situs publik, diambil dari host permintaan (jadi benar di tiap domain: selfphoto, studiodo, dll).
 * Cadangan: env MEDIA_BASE_URL / APP_URL. Kosong bila tidak bisa ditentukan.
 */
export async function siteBase(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (host) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
    const proto = (h.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
    return `${proto}://${host}`;
  }
  return (process.env.MEDIA_BASE_URL || process.env.APP_URL || "").trim().replace(/\/$/, "");
}
