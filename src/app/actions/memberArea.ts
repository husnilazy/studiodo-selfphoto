"use server";
import { headers } from "next/headers";
import { q } from "@/lib/db";
import { digits, endMemberSession, startMemberSession } from "@/lib/memberServer";
import { getMemberCfg } from "@/lib/pricingServer";
import { isMemberNow } from "@/lib/pricing";

type R = { ok: true } | { ok: false; error: string };

// Pembatas percobaan login (per instance): maks 8 gagal / 15 menit per nomor atau per IP.
const fails = new Map<string, number[]>();
const blocked = (k: string) => { const now = Date.now(); const a = (fails.get(k) ?? []).filter((t) => now - t < 15 * 60_000); fails.set(k, a); return a.length >= 8; };
const bump = (k: string) => fails.set(k, [...(fails.get(k) ?? []), Date.now()]);

/** Login member: nomor WhatsApp + kode member. */
export async function memberLogin(phone: string, codeRaw: string): Promise<R> {
  const d = digits(String(phone ?? ""));
  const code = String(codeRaw ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
  if (d.length < 9) return { ok: false, error: "Nomor WhatsApp tidak valid." };
  if (!code) return { ok: false, error: "Masukkan kode member." };
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "ip";
  const kPhone = `p:${d.slice(-9)}`, kIp = `i:${ip}`;
  if (blocked(kPhone) || blocked(kIp)) return { ok: false, error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." };

  const rows = await q<{ id: number; is_member: boolean; visits: number }>(
    `select c.id, c.is_member, (select count(*)::int from bookings b where b.customer_id = c.id and b.status = 'done') as visits
       from customers c where upper(c.member_no) = $1 and right(regexp_replace(c.phone, '\D', '', 'g'), 9) = $2`, [code, d.slice(-9)]);
  const c = rows[0];
  const cfg = await getMemberCfg();
  if (!c || !isMemberNow(cfg, c)) {
    bump(kPhone); bump(kIp);
    return { ok: false, error: "Nomor WhatsApp dan kode member tidak cocok. Periksa kartu member kamu." };
  }
  await startMemberSession(c.id);
  return { ok: true };
}

export async function memberLogout() { await endMemberSession(); }
