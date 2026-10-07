import "server-only";
import { q as rootQ, type Q } from "./db";
import {
  bestPromo, computeQuote, memberBenefit, sanitizeMember, tierFor, isMemberNow, nextIsReward, visitsToReward, voucherAmount,
  type MemberCfg, type Promo, type PromoPkg, type Quote, type Voucher,
} from "./pricing";

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

type PromoRow = Omit<Promo, "starts_at" | "ends_at" | "value"> & { value: number; starts_at: unknown; ends_at: unknown };
export const toPromo = (r: PromoRow): Promo => ({ ...r, value: Number(r.value), starts_at: iso(r.starts_at), ends_at: iso(r.ends_at) });

export async function getPromos(q: Q = rootQ): Promise<Promo[]> {
  return (await q<PromoRow>("select * from promos order by active desc, id desc")).map(toPromo);
}

export async function getMemberCfg(q: Q = rootQ): Promise<MemberCfg> {
  const [r] = await q<{ value: unknown }>("select value from settings where key = 'member'");
  return sanitizeMember(r?.value);
}

export const digitsOf = (s: string) => s.replace(/\D/g, "");

/** Cari customer lewat id atau nomor HP, beserta jumlah kunjungan selesai. */
export async function customerStats(q: Q, ref: { customerId?: number | null; phone?: string }) {
  let id = ref.customerId ?? null;
  if (!id && ref.phone && digitsOf(ref.phone).length >= 8) {
    const [c] = await q<{ id: number }>("select id from customers where regexp_replace(phone, '\\D', '', 'g') = $1 limit 1", [digitsOf(ref.phone)]);
    id = c?.id ?? null;
  }
  if (!id) return { id: null as number | null, is_member: false, visits: 0 };
  const [r] = await q<{ is_member: boolean; visits: number }>(
    `select c.is_member, (select count(*)::int from bookings b where b.customer_id = c.id and b.status = 'done') as visits from customers c where c.id = $1`, [id]);
  return { id, is_member: r?.is_member ?? false, visits: r?.visits ?? 0 };
}

type VoucherRow = {
  id: number; code: string; name: string; kind: "percent" | "amount"; value: number; max_discount: number; min_spend: number; min_people: number;
  package_ids: number[]; categories: string[]; usage_limit: number; per_customer: number; starts_at: unknown; expires_at: unknown;
  member_only: boolean; customer_id: number | null; stackable: boolean; active: boolean;
};

export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

/** Periksa voucher untuk situasi tertentu. Melempar Error berisi alasan yang ramah pengguna. */
export async function validateVoucher(q: Q, codeRaw: string, ctx: {
  pkg: PromoPkg | null; people: number; subtotal: number; customerId: number | null; isMember: boolean; excludeBookingId?: number | null; now?: number;
}): Promise<Voucher> {
  const code = normCode(codeRaw);
  if (!code) throw new Error("Masukkan kode voucher.");
  const [v] = await q<VoucherRow>("select * from vouchers where code = $1 for update", [code]);
  if (!v) throw new Error("Kode voucher tidak ditemukan.");
  const now = ctx.now ?? Date.now();
  if (!v.active) throw new Error("Voucher ini sudah tidak aktif.");
  if (v.starts_at && now < new Date(v.starts_at as string).getTime()) throw new Error("Voucher ini belum berlaku.");
  if (v.expires_at && now >= new Date(v.expires_at as string).getTime()) throw new Error("Voucher ini sudah kedaluwarsa.");
  if (v.customer_id && v.customer_id !== ctx.customerId) throw new Error("Voucher ini khusus untuk customer tertentu.");
  if (v.member_only && !ctx.isMember) throw new Error("Voucher ini khusus member STUDIODO.");
  const hasScope = v.package_ids.length > 0 || v.categories.length > 0;
  if (hasScope && !ctx.pkg) throw new Error("Pilih paket dulu untuk memakai voucher ini.");
  if (ctx.pkg) {
    const scoped = v.package_ids.length ? v.package_ids.includes(ctx.pkg.id) : v.categories.length ? v.categories.includes(ctx.pkg.category) : true;
    if (!scoped) throw new Error("Voucher ini tidak berlaku untuk paket yang dipilih.");
  }
  if (ctx.people < v.min_people) throw new Error(`Voucher ini berlaku untuk minimal ${v.min_people} orang.`);
  if (ctx.subtotal < Number(v.min_spend)) throw new Error(`Minimal belanja Rp ${Number(v.min_spend).toLocaleString("id-ID")} untuk voucher ini.`);
  const ex = ctx.excludeBookingId ?? 0;
  const [u] = await q<{ total: number; mine: number }>(
    `select count(*)::int as total, count(*) filter (where r.customer_id = $2)::int as mine
       from voucher_redemptions r join bookings b on b.id = r.booking_id
      where r.voucher_id = $1 and b.status not in ('cancelled','no_show') and b.id <> $3`, [v.id, ctx.customerId ?? 0, ex]);
  if (v.usage_limit > 0 && u.total >= v.usage_limit) throw new Error("Kuota voucher ini sudah habis.");
  if (v.per_customer > 0 && ctx.customerId && u.mine >= v.per_customer) throw new Error("Voucher ini sudah pernah kamu pakai.");
  return { id: v.id, code: v.code, name: v.name, kind: v.kind, value: Number(v.value), max_discount: Number(v.max_discount), stackable: v.stackable };
}

export type QuoteInput = {
  packageId: number | null; people: number; extras: number;
  customerId?: number | null; phone?: string; voucherCode?: string; manual?: number; auto?: boolean;
  excludeBookingId?: number | null;
};
export type QuoteResult = Quote & {
  voucher: Voucher | null; voucherError: string;
  member: { isMember: boolean; tier: string; visits: number; nextReward: boolean; toReward: number } | null;
};

/** Hitung harga akhir: promo / member (otomatis) + voucher + diskon manual. Selalu dihitung ulang di server. */
export async function buildQuote(q: Q, i: QuoteInput): Promise<QuoteResult> {
  const [pk] = i.packageId ? await q<PromoPkg>("select id, category, price, per_person from packages where id = $1", [i.packageId]) : [null];
  const pkg = pk ? { ...pk, price: Number(pk.price) } : null;
  const people = Math.max(1, i.people);
  const auto = i.auto !== false;
  const [promos, cfg, cust] = await Promise.all([
    auto ? getPromos(q) : Promise.resolve([] as Promo[]),
    getMemberCfg(q), customerStats(q, { customerId: i.customerId, phone: i.phone }),
  ]);
  const now = Date.now();
  const promo = pkg && auto ? bestPromo(promos, pkg, people, now) : null;
  const member = pkg && auto ? memberBenefit(cfg, cust, pkg, people) : null;

  let voucher: Voucher | null = null, voucherError = "";
  if (i.voucherCode?.trim()) {
    const base = pkg ? pkg.price * (pkg.per_person ? people : 1) : 0;
    try {
      voucher = await validateVoucher(q, i.voucherCode, { pkg, people, subtotal: base + i.extras, customerId: cust.id, isMember: isMemberNow(cfg, cust), excludeBookingId: i.excludeBookingId, now });
    } catch (e) { voucherError = e instanceof Error ? e.message : "Voucher tidak valid."; }
  }
  const quote = computeQuote({ pkg, people, extras: i.extras, promo, member, voucher, manual: i.manual });
  const isM = isMemberNow(cfg, cust);
  return {
    ...quote, voucher: quote.voucherUsed ? voucher : null, voucherError,
    member: cust.id && cfg.enabled ? { isMember: isM, tier: isM ? tierFor(cfg, cust.visits)?.name ?? "" : "", visits: cust.visits, nextReward: isM && nextIsReward(cfg, cust.visits), toReward: visitsToReward(cfg, cust.visits) } : null,
  };
}

export { voucherAmount };
