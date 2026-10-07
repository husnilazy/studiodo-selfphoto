// Mesin harga: diskon promo, member, voucher. Murni (tanpa database) — aman dipakai server & client.
import { unitsFor } from "./packageUtils";

export type PromoKind = "percent" | "amount_unit" | "amount_total" | "free_units";
export type Promo = {
  id: number; name: string; label: string; kind: PromoKind; value: number; min_people: number;
  package_ids: number[]; categories: string[];
  starts_at: string | null; ends_at: string | null;
  show_countdown: boolean; show_on_site: boolean; active: boolean;
};
export type PromoPkg = { id: number; category: string; price: number; per_person: boolean };

export const PROMO_KIND_LABEL: Record<PromoKind, string> = {
  percent: "Persen (%)", amount_unit: "Potongan per orang/unit (Rp)", amount_total: "Potongan total (Rp)", free_units: "Gratis N orang/unit",
};

/** Status waktu promo. */
export function promoState(p: Pick<Promo, "active" | "starts_at" | "ends_at">, now = Date.now()): "off" | "soon" | "live" | "ended" {
  if (!p.active) return "off";
  if (p.starts_at && now < new Date(p.starts_at).getTime()) return "soon";
  if (p.ends_at && now >= new Date(p.ends_at).getTime()) return "ended";
  return "live";
}
export const promoApplies = (p: Pick<Promo, "package_ids" | "categories">, pkg: PromoPkg) =>
  p.package_ids.length ? p.package_ids.includes(pkg.id) : p.categories.length ? p.categories.includes(pkg.category) : true;

const clampInt = (n: number) => Math.max(0, Math.round(n));

/** Nilai potongan sebuah promo pada paket + jumlah orang tertentu (0 bila syarat belum terpenuhi). */
export function promoAmount(p: Pick<Promo, "kind" | "value" | "min_people">, pkg: PromoPkg, people: number): number {
  if (people < Math.max(1, p.min_people)) return 0;
  const units = unitsFor(pkg, people), base = pkg.price * units;
  switch (p.kind) {
    case "percent": return clampInt(base * Math.min(100, p.value) / 100);
    case "amount_unit": return clampInt(Math.min(p.value, pkg.price) * units);
    case "amount_total": return clampInt(Math.min(p.value, base));
    case "free_units": return clampInt(Math.min(p.value, units) * pkg.price);
  }
}

/** Ringkas aturan promo untuk label, mis. "Diskon 20%", "Hemat Rp 5.000 / orang". */
export function promoText(p: Pick<Promo, "kind" | "value" | "min_people">, rp: (n: number) => string): string {
  const who = p.min_people > 1 ? ` untuk ${p.min_people}+ orang` : "";
  switch (p.kind) {
    case "percent": return `Diskon ${p.value}%${who}`;
    case "amount_unit": return `Hemat ${rp(p.value)} / orang${who}`;
    case "amount_total": return `Potongan ${rp(p.value)}${who}`;
    case "free_units": return `Gratis ${p.value} orang${who}`;
  }
}

export function bestPromo(promos: Promo[], pkg: PromoPkg, people: number, now = Date.now()) {
  let best: { promo: Promo; amount: number } | null = null;
  for (const p of promos) {
    if (promoState(p, now) !== "live" || !promoApplies(p, pkg)) continue;
    const amount = promoAmount(p, pkg, people);
    if (amount > 0 && (!best || amount > best.amount)) best = { promo: p, amount };
  }
  return best;
}

/** Tampilan promo di kartu paket (website). */
export type Deal = { label: string; text: string; salePrice: number; percent: number; endsAt: string | null; countdown: boolean };
export type GroupDeal = { text: string; minPeople: number; unitPrice: number };

/* ───────── Member ───────── */
export type MemberTier = { name: string; min_visits: number; percent: number };
export type MemberCfg = {
  enabled: boolean; tiers: MemberTier[];
  reward_every: number; reward_percent: number; // setiap kunjungan ke-N: diskon X% untuk 1 orang/paket (100 = gratis)
  auto_join_visits: number; // 0 = daftar manual saja
};
export const DEFAULT_MEMBER: MemberCfg = {
  enabled: true,
  tiers: [{ name: "Silver", min_visits: 0, percent: 5 }, { name: "Gold", min_visits: 5, percent: 10 }, { name: "Platinum", min_visits: 10, percent: 15 }],
  reward_every: 5, reward_percent: 100, auto_join_visits: 0,
};

export function sanitizeMember(raw: unknown): MemberCfg {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MemberCfg>;
  const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d; };
  const tiers = Array.isArray(r.tiers)
    ? r.tiers.slice(0, 8).map((t) => ({ name: String(t?.name ?? "").trim().slice(0, 24), min_visits: n(t?.min_visits, 0, 999, 0), percent: n(t?.percent, 0, 100, 0) })).filter((t) => t.name)
    : DEFAULT_MEMBER.tiers;
  return {
    enabled: r.enabled !== false, tiers: (tiers.length ? tiers : DEFAULT_MEMBER.tiers).sort((a, b) => a.min_visits - b.min_visits),
    reward_every: n(r.reward_every, 0, 99, DEFAULT_MEMBER.reward_every), reward_percent: n(r.reward_percent, 1, 100, DEFAULT_MEMBER.reward_percent),
    auto_join_visits: n(r.auto_join_visits, 0, 99, 0),
  };
}

export const tierFor = (cfg: MemberCfg, visits: number) =>
  [...cfg.tiers].reverse().find((t) => visits >= t.min_visits) ?? cfg.tiers[0] ?? null;

export const isMemberNow = (cfg: MemberCfg, c: { is_member: boolean; visits: number }) =>
  cfg.enabled && (c.is_member || (cfg.auto_join_visits > 0 && c.visits >= cfg.auto_join_visits));

/** Kunjungan berikutnya dapat hadiah? (kunjungan ke-N, 2N, …) */
export const nextIsReward = (cfg: MemberCfg, visits: number) => cfg.reward_every > 0 && (visits + 1) % cfg.reward_every === 0;
export const visitsToReward = (cfg: MemberCfg, visits: number) => (cfg.reward_every > 0 ? cfg.reward_every - (visits % cfg.reward_every) : 0);

export function memberBenefit(cfg: MemberCfg, c: { is_member: boolean; visits: number }, pkg: PromoPkg, people: number) {
  if (!isMemberNow(cfg, c)) return null;
  const units = unitsFor(pkg, people), base = pkg.price * units;
  const tier = tierFor(cfg, c.visits);
  const tierAmt = tier ? clampInt(base * tier.percent / 100) : 0;
  const rewardAmt = nextIsReward(cfg, c.visits) ? clampInt(pkg.price * cfg.reward_percent / 100) : 0;
  if (rewardAmt >= tierAmt && rewardAmt > 0) return { label: cfg.reward_percent >= 100 ? `Member: kunjungan ke-${c.visits + 1} GRATIS` : `Member: hadiah kunjungan ke-${c.visits + 1} (${cfg.reward_percent}%)`, amount: rewardAmt };
  if (tierAmt > 0 && tier) return { label: `Member ${tier.name} ${tier.percent}%`, amount: tierAmt };
  return null;
}

/* ───────── Voucher ───────── */
export type Voucher = {
  id: number; code: string; name: string; kind: "percent" | "amount"; value: number; max_discount: number; stackable: boolean;
};
export function voucherAmount(v: Pick<Voucher, "kind" | "value" | "max_discount">, subtotal: number): number {
  const raw = v.kind === "percent" ? subtotal * Math.min(100, v.value) / 100 : v.value;
  const capped = v.max_discount > 0 ? Math.min(raw, v.max_discount) : raw;
  return clampInt(Math.min(capped, subtotal));
}

/* ───────── Hitung total ───────── */
export type DiscountLine = { type: "promo" | "member" | "voucher" | "manual"; label: string; amount: number };
export type Quote = {
  packageAmount: number; extras: number; subtotal: number; lines: DiscountLine[]; discount: number; total: number;
  voucherUsed: boolean; voucherNote: string;
};

export function computeQuote(i: {
  pkg: PromoPkg | null; people: number; extras: number;
  promo: { promo: Promo; amount: number } | null;
  member: { label: string; amount: number } | null;
  voucher: Voucher | null; manual?: number;
}): Quote {
  const packageAmount = i.pkg ? i.pkg.price * unitsFor(i.pkg, i.people) : 0;
  const subtotal = packageAmount + i.extras;
  const lines: DiscountLine[] = [];
  let auto: DiscountLine | null = null;
  const cands: DiscountLine[] = [];
  if (i.promo) cands.push({ type: "promo", label: i.promo.promo.label || i.promo.promo.name, amount: i.promo.amount });
  if (i.member) cands.push({ type: "member", label: i.member.label, amount: i.member.amount });
  for (const c of cands) if (!auto || c.amount > auto.amount) auto = c;

  let voucherUsed = false, voucherNote = "";
  let vLine: DiscountLine | null = null;
  if (i.voucher) {
    vLine = { type: "voucher", label: `Voucher ${i.voucher.code}`, amount: voucherAmount(i.voucher, subtotal) };
    if (i.voucher.stackable || !auto) { voucherUsed = true; }
    else if (vLine.amount > auto.amount) { voucherUsed = true; voucherNote = `Voucher dipakai karena lebih besar dari “${auto.label}” (tidak digabung).`; auto = null; }
    else { vLine = null; voucherNote = `Voucher tidak dipakai: “${auto.label}” lebih menguntungkan dan voucher ini tidak bisa digabung.`; }
  }
  if (auto) lines.push(auto);
  if (vLine && voucherUsed) lines.push(vLine);
  let left = subtotal;
  const capped: DiscountLine[] = [];
  for (const l of lines) { const a = Math.min(l.amount, left); if (a > 0) { capped.push({ ...l, amount: a }); left -= a; } }
  const manual = Math.min(Math.max(0, Math.round(i.manual ?? 0)), left);
  if (manual > 0) { capped.push({ type: "manual", label: "Diskon manual", amount: manual }); left -= manual; }
  return { packageAmount, extras: i.extras, subtotal, lines: capped, discount: subtotal - left, total: left, voucherUsed, voucherNote };
}

/** Kode voucher: tanpa karakter membingungkan (0/O, 1/I). */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
