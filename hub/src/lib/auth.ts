import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { one, q } from "./db";

/** owner: ubah semua · partner: lihat semua · investor: ringkasan + modal sendiri + dokumen · karyawan: slip & dokumen sendiri */
export type Role = "owner" | "partner" | "investor" | "karyawan";
export type User = { id: number; name: string; role: Role; employeeId: number | null; partnerId: number | null };
export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", partner: "Partner (lihat semua)", investor: "Investor", karyawan: "Karyawan" };
export const isTeam = (u: { role: Role }) => u.role === "owner" || u.role === "partner";
const COOKIE = "fh_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET belum diatur");
  return "dev-only-secret-frameless-hub";
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
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function startSession(userId: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${body}.${sign(body)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}
export async function endSession() { (await cookies()).delete(COOKIE); }

export const currentUser = cache(async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expect = sign(`${id}.${exp}`);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return one<User>('select id, name, role, employee_id as "employeeId", partner_id as "partnerId" from users where id = $1 and active', [Number(id)]);
});

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
/** Halaman tim (owner & partner). Investor/karyawan diarahkan ke area mereka. */
export async function requireTeam(): Promise<User> {
  const u = await requireUser();
  if (!isTeam(u)) redirect("/saya");
  return u;
}
/** Hanya Owner yang boleh mengubah data. Partner = lihat saja. */
export async function requireOwner(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new Error("Sesi berakhir, silakan login ulang.");
  if (u.role !== "owner") throw new Error("Hanya Owner yang bisa mengubah data.");
  return u;
}
export const hasUsers = async () => (await q("select 1 from users limit 1")).length > 0;
