"use server";
import { one, q } from "@/lib/db";
import { endSession, hashPin, hasUsers, startSession, verifyPin } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

const MAX_FAILS = 5;
const LOCK_MIN = 5;

export async function loginAction(userId: number, pin: string): Promise<Result> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "PIN harus 6 digit." };
  const u = await one<{ id: number; pin_hash: string; failed_attempts: number; locked_until: string | null }>(
    "select id, pin_hash, failed_attempts, locked_until from users where id = $1 and active", [userId]);
  if (!u) return { ok: false, error: "Pengguna tidak ditemukan." };
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    const m = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 60000);
    return { ok: false, error: `Terlalu banyak percobaan. Coba lagi ${m} menit lagi.` };
  }
  if (!verifyPin(pin, u.pin_hash)) {
    const fails = u.failed_attempts + 1;
    if (fails >= MAX_FAILS) {
      await q("update users set failed_attempts = 0, locked_until = now() + ($2 || ' minutes')::interval where id = $1", [u.id, String(LOCK_MIN)]);
      return { ok: false, error: `PIN salah ${MAX_FAILS}x. Akun dikunci ${LOCK_MIN} menit.` };
    }
    await q("update users set failed_attempts = $2 where id = $1", [u.id, fails]);
    return { ok: false, error: `PIN salah. Sisa percobaan ${MAX_FAILS - fails}.` };
  }
  await q("update users set failed_attempts = 0, locked_until = null where id = $1", [u.id]);
  await startSession(u.id);
  return { ok: true };
}

export async function logoutAction() {
  await endSession();
}

/** Pembuatan owner pertama. Hanya bisa jika belum ada pengguna sama sekali. */
export async function setupOwnerAction(name: string, pin: string): Promise<Result> {
  if (await hasUsers()) return { ok: false, error: "Setup sudah dilakukan." };
  name = name.trim();
  if (!name) return { ok: false, error: "Nama wajib diisi." };
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "PIN harus 6 digit angka." };
  const [u] = await q<{ id: number }>(
    "insert into users (name, role, pin_hash) values ($1,'owner',$2) returning id", [name, hashPin(pin)]);
  await startSession(u.id);
  return { ok: true };
}
