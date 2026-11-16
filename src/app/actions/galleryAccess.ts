"use server";
import { headers } from "next/headers";
import { q } from "@/lib/db";
import { digits } from "@/lib/memberServer";

type R = { ok: true; token: string } | { ok: false; error: string };

// Pembatas percobaan (per instance): maks 8 gagal / 15 menit per nomor atau per IP — sama seperti login member.
const fails = new Map<string, number[]>();
const blocked = (k: string) => { const now = Date.now(); const a = (fails.get(k) ?? []).filter((t) => now - t < 15 * 60_000); fails.set(k, a); return a.length >= 8; };
const bump = (k: string) => fails.set(k, [...(fails.get(k) ?? []), Date.now()]);

/** Customer membuka galerinya sendiri: nomor WhatsApp + kode booking (ada di struk / konfirmasi). */
export async function findGallery(phone: string, codeRaw: string): Promise<R> {
  const d = digits(String(phone ?? ""));
  const code = String(codeRaw ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  if (d.length < 9) return { ok: false, error: "Nomor WhatsApp tidak valid." };
  if (!code) return { ok: false, error: "Masukkan kode booking." };
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "ip";
  const kPhone = `g:${d.slice(-9)}`, kIp = `gi:${ip}`;
  if (blocked(kPhone) || blocked(kIp)) return { ok: false, error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." };

  const rows = await q<{ gallery_token: string | null }>(
    `select c.gallery_token from bookings b join customers c on c.id = b.customer_id
      where upper(b.code) = $1 and right(regexp_replace(c.phone, '\\D', '', 'g'), 9) = $2 limit 1`, [code, d.slice(-9)]);
  if (!rows.length) {
    bump(kPhone); bump(kIp);
    return { ok: false, error: "Nomor WhatsApp dan kode booking tidak cocok. Periksa struk atau pesan konfirmasimu." };
  }
  if (!rows[0].gallery_token) return { ok: false, error: "Galeri kamu belum tersedia. Studio akan mengabari begitu foto siap ✨" };
  return { ok: true, token: rows[0].gallery_token };
}
