"use server";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { buildQuote, type QuoteResult } from "@/lib/pricingServer";

// Pembatas sederhana (per instance) agar kode voucher tidak bisa ditebak lewat pratinjau harga.
const hits: number[] = [];
const throttled = () => { const now = Date.now(); while (hits.length && now - hits[0] > 60_000) hits.shift(); if (hits.length >= 60) return true; hits.push(now); return false; };

type R = { ok: true; quote: QuoteResult } | { ok: false; error: string };

/** Pratinjau harga di form kasir (promo, member, voucher, diskon manual). */
export async function quoteAdmin(i: {
  package_id: number | null; people: number; extras: number; customer_id: number | null; phone: string;
  voucher: string; manual: number; auto: boolean; exclude?: number | null;
}): Promise<R> {
  try {
    await actionUser();
    return { ok: true, quote: await buildQuote(q, {
      packageId: i.package_id, people: i.people, extras: Math.max(0, i.extras), customerId: i.customer_id, phone: i.phone,
      voucherCode: i.voucher, manual: i.manual, auto: i.auto, excludeBookingId: i.exclude ?? null,
    }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghitung harga." };
  }
}

/** Pratinjau harga di booking online. Add-on dihitung dari harga di database, bukan dari klien. */
export async function quotePublic(i: { package_id: number; people: number; addons: Record<number, number>; phone: string; voucher: string }): Promise<R> {
  if (throttled()) return { ok: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." };
  try {
    const ids = Object.keys(i.addons).map(Number).filter((n) => Number.isInteger(n));
    const rows = ids.length ? await q<{ id: number; price: number }>("select id, price from addons where id = any($1) and active", [ids]) : [];
    const extras = rows.reduce((s, a) => s + Number(a.price) * Math.min(20, Math.max(0, Math.round(i.addons[a.id] ?? 0))), 0);
    return { ok: true, quote: await buildQuote(q, {
      packageId: Number(i.package_id) || null, people: Math.max(1, Math.min(99, Math.round(i.people))), extras,
      phone: String(i.phone ?? "").slice(0, 30), voucherCode: String(i.voucher ?? "").slice(0, 40), auto: true,
    }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghitung harga." };
  }
}
