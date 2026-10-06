import "server-only";
import { headers } from "next/headers";
import { one, q } from "./db";

// Integrasi Google Drive (OAuth akun Gmail). Scope drive.file: aplikasi hanya melihat
// folder & file yang ia buat sendiri, bukan seluruh isi Drive.
export const SCOPES = "openid email https://www.googleapis.com/auth/drive.file";
export type GDriveConfig = { refresh_token: string; email: string; root_id?: string };

export const oauthReady = () => !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

export async function getConfig(): Promise<GDriveConfig | null> {
  const r = await one<{ value: GDriveConfig }>("select value from settings where key = 'gdrive'");
  return r?.value?.refresh_token ? r.value : null;
}
export async function saveConfig(c: GDriveConfig) {
  await q("insert into settings (key, value) values ('gdrive', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(c)]);
  cache = null;
}
export async function clearConfig() {
  await q("delete from settings where key = 'gdrive'");
  cache = null;
}

/** Origin publik aplikasi (untuk redirect OAuth & header CORS upload). */
export async function appOrigin() {
  const env = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
export const redirectUri = async () => `${await appOrigin()}/api/google/callback`;

let cache: { token: string; exp: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cache && cache.exp > Date.now() + 60_000) return cache.token;
  const cfg = await getConfig();
  if (!cfg) throw new Error("Google Drive belum terhubung. Owner bisa menghubungkannya di Pengaturan.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: cfg.refresh_token, grant_type: "refresh_token",
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) {
    throw new Error(j.error === "invalid_grant"
      ? "Izin Google Drive sudah kedaluwarsa/dicabut. Hubungkan ulang di Pengaturan."
      : `Gagal masuk ke Google Drive (${j.error ?? res.status}).`);
  }
  cache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function drive<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok && res.status !== 404) throw new Error(`Google Drive: ${(data as { error?: { message?: string } }).error?.message ?? res.status}`);
  return { status: res.status, data };
}

const clean = (s: string) => s.replace(/[\\/]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100);

async function folderAlive(id: string) {
  const r = await drive<{ id?: string; trashed?: boolean }>(`files/${id}?fields=id,trashed`);
  return r.status === 200 && !r.data.trashed;
}
async function createFolder(name: string, parent?: string) {
  const r = await drive<{ id: string }>("files?fields=id", {
    method: "POST",
    body: JSON.stringify({ name: clean(name), mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }),
  });
  return r.data.id;
}

async function rootFolder(): Promise<string> {
  const cfg = (await getConfig())!;
  if (cfg.root_id && (await folderAlive(cfg.root_id))) return cfg.root_id;
  const id = await createFolder("STUDIODO Kasir");
  await saveConfig({ ...cfg, root_id: id });
  return id;
}

export async function customerFolder(customerId: number): Promise<string> {
  const c = await one<{ name: string; phone: string; drive_folder_id: string | null }>("select name, phone, drive_folder_id from customers where id = $1", [customerId]);
  if (!c) throw new Error("Customer tidak ditemukan.");
  if (c.drive_folder_id && (await folderAlive(c.drive_folder_id))) return c.drive_folder_id;
  const id = await createFolder(`${c.name}${c.phone ? ` – ${c.phone}` : ""}`, await rootFolder());
  await q("update customers set drive_folder_id = $1 where id = $2", [id, customerId]);
  return id;
}

export async function bookingFolder(bookingId: number): Promise<{ id: string; customerId: number }> {
  const b = await one<{ code: string; customer_id: number; drive_folder_id: string | null; day: string }>(
    "select code, customer_id, drive_folder_id, (start_at at time zone 'Asia/Jakarta')::date::text as day from bookings where id = $1", [bookingId]);
  if (!b) throw new Error("Booking tidak ditemukan.");
  if (b.drive_folder_id && (await folderAlive(b.drive_folder_id))) return { id: b.drive_folder_id, customerId: b.customer_id };
  const id = await createFolder(`${b.day} ${b.code}`, await customerFolder(b.customer_id));
  await q("update bookings set drive_folder_id = $1 where id = $2", [id, bookingId]);
  return { id, customerId: b.customer_id };
}

/** Membuat sesi upload resumable; browser mengirim file langsung ke Google. */
export async function createUploadSession(folderId: string, name: string, mime: string, size: number, origin: string) {
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,mimeType", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mime || "application/octet-stream",
      "X-Upload-Content-Length": String(size),
      Origin: origin, // agar PUT dari browser lolos CORS
    },
    body: JSON.stringify({ name: clean(name), parents: [folderId] }),
  });
  const url = res.headers.get("location");
  if (!res.ok || !url) throw new Error(`Google Drive menolak upload (${res.status}).`);
  return url;
}

export async function fileInfo(fileId: string) {
  const r = await drive<{ id: string; name: string; mimeType: string; parents?: string[]; webViewLink?: string }>(
    `files/${fileId}?fields=id,name,mimeType,parents,webViewLink`);
  if (r.status !== 200) throw new Error("File tidak ditemukan di Google Drive.");
  return r.data;
}

export async function shareAnyone(fileId: string) {
  await drive(`files/${fileId}/permissions`, { method: "POST", body: JSON.stringify({ role: "reader", type: "anyone" }) });
}
export async function folderLink(folderId: string) {
  const r = await drive<{ webViewLink?: string }>(`files/${folderId}?fields=webViewLink`);
  return r.data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`;
}
