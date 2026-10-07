import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { one, q } from "./db";

export type Role = "owner" | "admin" | "kasir";
export type User = { id: number; name: string; role: Role };

const COOKIE = "sd_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 hari

function secret() {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET belum diatur");
  return "dev-only-secret-studiodo-kasir";
}
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}
export function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(scryptSync(pin, salt, 32).toString("hex"));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function startSession(userId: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Dibungkus cache(): layout + halaman + komponen memakai satu query per request, bukan tiga. */
export const currentUser = cache(async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expect = sign(`${id}.${exp}`);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return one<User>("select id, name, role from users where id = $1 and active", [Number(id)]);
});

/** Wajib login (dan role tertentu). Dipakai di setiap halaman & server action. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role)) redirect("/dashboard?akses=ditolak");
  return u;
}
/** Versi untuk server action: melempar error alih-alih redirect. */
export async function actionUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) throw new Error("Sesi berakhir, silakan login ulang.");
  if (roles && !roles.includes(u.role)) throw new Error("Anda tidak punya akses untuk aksi ini.");
  return u;
}

export const hasUsers = async () => ((await q("select 1 from users limit 1")).length > 0);

/** Tanda tangan singkat untuk tautan publik (mis. halaman konfirmasi booking online). */
export const signToken = (v: string) => sign(`pub:${v}`).slice(0, 22);
export const checkToken = (v: string, t: string) => t.length > 0 && t === signToken(v);
