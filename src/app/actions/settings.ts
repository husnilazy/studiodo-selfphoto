"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser, hashPin } from "@/lib/auth";
import { int, req, safe, str } from "@/lib/action";
import type { ActionState } from "@/components/ActionForm";

export async function saveStudio(_p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner"]);
    const open = str(fd, "open"), close = str(fd, "close");
    if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close) || open >= close) throw new Error("Jam buka harus sebelum jam tutup.");
    const slot = int(fd, "slot");
    if (![15, 20, 30, 60].includes(slot)) throw new Error("Interval slot tidak valid.");
    const value = { name: req(str(fd, "name"), "Nama studio wajib diisi."), address: str(fd, "address"), phone: str(fd, "phone"), open, close, slot, footer: str(fd, "footer") };
    await q("insert into settings (key, value) values ('studio', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(value)]);
    revalidatePath("/", "layout");
  });
}

const ROLES = ["owner", "admin", "kasir"];
const okPin = (pin: string) => {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN harus 6 digit angka.");
  if (/^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "654321") throw new Error("PIN terlalu mudah ditebak.");
};

export async function saveUser(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    const me = await actionUser(["owner"]);
    const name = req(str(fd, "name"), "Nama wajib diisi.");
    const role = str(fd, "role");
    if (!ROLES.includes(role)) throw new Error("Peran tidak valid.");
    const pin = str(fd, "pin");
    const active = fd.get("active") === "on";
    if (id) {
      if (id === me.id && (role !== "owner" || !active)) throw new Error("Anda tidak bisa menurunkan atau menonaktifkan akun sendiri.");
      if (role !== "owner" || !active) {
        const [o] = await q<{ n: number }>("select count(*)::int as n from users where role = 'owner' and active and id <> $1", [id]);
        if (o.n === 0) throw new Error("Harus ada minimal satu Owner aktif.");
      }
      if (pin) { okPin(pin); await q("update users set pin_hash=$1, failed_attempts=0, locked_until=null where id=$2", [hashPin(pin), id]); }
      await q("update users set name=$1, role=$2, active=$3 where id=$4", [name, role, active, id]);
    } else {
      okPin(pin);
      await q("insert into users (name, role, pin_hash, active) values ($1,$2,$3,$4)", [name, role, hashPin(pin), active]);
    }
    revalidatePath("/pengaturan");
  });
}

export async function saveOnline(_p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner"]);
    const url = (k: string) => {
      const v = str(fd, k);
      if (v && !/^https?:\/\//i.test(v)) throw new Error("Link harus diawali http:// atau https://");
      return v;
    };
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
    const value = {
      enabled: fd.get("enabled") === "on",
      dp_percent: clamp(int(fd, "dp_percent"), 0, 100),
      pay_info: str(fd, "pay_info").slice(0, 600),
      lead_min: clamp(int(fd, "lead_min"), 0, 7 * 1440),
      days_ahead: clamp(int(fd, "days_ahead"), 1, 365),
      hold_min: clamp(int(fd, "hold_min"), 0, 7 * 1440),
      whatsapp: str(fd, "whatsapp").replace(/[^\d+]/g, ""),
      instagram: str(fd, "instagram").replace(/^@/, "").replace(/[^\w.]/g, ""),
      maps_url: url("maps_url"),
      tagline: str(fd, "tagline").slice(0, 140),
    };
    await q("insert into settings (key, value) values ('online', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(value)]);
    revalidatePath("/", "layout");
  });
}
