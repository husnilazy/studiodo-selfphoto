import "server-only";
import { q } from "./db";
import { addMonths, thisMonth } from "./format";

export type Company = {
  id: number; slug: string; name: string; kind: string; color: string; started_on: string | null; active: boolean;
  api_key_prefix: string | null; last_sync_at: string | null;
  share_capital_pct: number; share_work_pct: number; reserve_pct: number;
};
export type Partner = { id: number; name: string; role: string };
export type CP = { company_id: number; partner_id: number; equity_pct: number; work_weight: number };
export type Row = { company_id: number; m: string; kind: string; category: string; funding: string; partner_id: number | null; amt: number };
export type Target = { company_id: number | null; period: string; metric: string; value: number };

export const BUCKETS = [
  { key: "operasional", label: "Operasional", color: "#6ea8ff" },
  { key: "gaji", label: "Gaji & Tim", color: "#34d1bf" },
  { key: "pengembangan", label: "Pengembangan", color: "#b79cff" },
  { key: "cadangan", label: "Dana Cadangan", color: "#e9c46a" },
  { key: "bagi_hasil", label: "Bagi Hasil", color: "#e69ad0" },
] as const;
export const DEFAULT_PLAN: Record<string, number> = { operasional: 40, gaji: 25, pengembangan: 15, cadangan: 5, bagi_hasil: 15 };

export const EXPENSE_CATEGORIES = [
  ["gaji", "Gaji & honor"], ["sewa", "Sewa tempat"], ["bahan", "Bahan baku / HPP"], ["marketing", "Marketing & iklan"],
  ["utilitas", "Listrik, air, internet"], ["operasional", "Operasional lain"], ["pengembangan", "Pengembangan usaha"],
  ["pajak", "Pajak & legal"], ["lainnya", "Lainnya"],
] as const;
export const REVENUE_CATEGORIES = [["penjualan", "Penjualan"], ["proyek", "Proyek / jasa"], ["lainnya", "Lainnya"]] as const;

export const bucketOf = (kind: string, category: string): string => {
  if (kind === "asset_purchase") return "pengembangan";
  if (kind === "withdrawal") return category === "bagi_hasil" ? "bagi_hasil" : "";
  if (kind !== "expense") return "";
  if (category === "gaji") return "gaji";
  if (category === "pengembangan") return "pengembangan";
  return "operasional";
};

export type Facts = {
  companies: Company[]; partners: Partner[]; cps: CP[]; rows: Row[]; targets: Target[];
  plans: Map<number, Record<string, number>>; now: string;
};

export async function loadFacts(): Promise<Facts> {
  const [companies, partners, cps, rows, targets, plans] = await Promise.all([
    q<Company>("select id, slug, name, kind, color, started_on, active, api_key_prefix, last_sync_at, share_capital_pct, share_work_pct, reserve_pct from companies where active order by sort, id"),
    q<Partner>("select id, name, role from partners where active order by id"),
    q<CP>("select company_id, partner_id, equity_pct, work_weight from company_partners"),
    q<Row>(`select company_id, to_char(date,'YYYY-MM') as m, kind, category, funding, partner_id, sum(amount)::bigint as amt
            from transactions group by 1,2,3,4,5,6`),
    q<Target>("select company_id, period, metric, value from targets"),
    q<{ company_id: number; bucket: string; pct: number }>("select company_id, bucket, pct from alloc_plans"),
  ]);
  const pm = new Map<number, Record<string, number>>();
  for (const p of plans) {
    const o = pm.get(p.company_id) ?? {};
    o[p.bucket] = Number(p.pct);
    pm.set(p.company_id, o);
  }
  return { companies, partners, cps, rows, targets, plans: pm, now: thisMonth() };
}

export const NON_CAPITAL = ["saldo_awal", "pinjaman"]; // setoran kas yang bukan modal partner
type Pred = { company?: number | null; months?: string[]; kind?: string | string[]; category?: string; notCat?: string[]; funding?: string; partner?: number };
export function sum(rows: Row[], p: Pred = {}): number {
  const kinds = p.kind ? (Array.isArray(p.kind) ? p.kind : [p.kind]) : null;
  const ms = p.months ? new Set(p.months) : null;
  let t = 0;
  for (const r of rows) {
    if (p.company != null && r.company_id !== p.company) continue;
    if (ms && !ms.has(r.m)) continue;
    if (kinds && !kinds.includes(r.kind)) continue;
    if (p.category && r.category !== p.category) continue;
    if (p.notCat && p.notCat.includes(r.category)) continue;
    if (p.funding && r.funding !== p.funding) continue;
    if (p.partner != null && r.partner_id !== p.partner) continue;
    t += Number(r.amt);
  }
  return t;
}

/** Ringkasan satu periode (satu atau beberapa bulan) untuk satu perusahaan atau seluruh grup. */
export function summary(rows: Row[], company: number | null, months?: string[]) {
  const s = (kind: string | string[], extra: Partial<Pred> = {}) => sum(rows, { company, months, kind, ...extra });
  const revenue = s("revenue");
  const opex = s("expense");
  const assets = s("asset_purchase");
  const profit = revenue - opex; // laba operasional (aset = investasi, bukan biaya)
  return { revenue, opex, assets, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0, withdrawn: s("withdrawal") };
}

/** Kas = pendapatan + modal tunai masuk - biaya & aset dari kas perusahaan - penarikan. */
export function cashBalance(rows: Row[], company: number | null): number {
  const c = { company };
  return (
    sum(rows, { ...c, kind: "revenue" }) + sum(rows, { ...c, kind: "capital_in" }) -
    sum(rows, { ...c, kind: ["expense", "asset_purchase"], funding: "company" }) - sum(rows, { ...c, kind: "withdrawal" })
  );
}

export function lastMonths(n: number, now = thisMonth()): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(now, i - (n - 1)));
}

/** Modal yang dicatat per partner: setoran tunai + biaya/aset yang dibayar pribadi. */
export function capitalByPartner(rows: Row[], company: number | null) {
  const out = new Map<number, { cash: number; inKind: number; expenses: number; withdrawn: number }>();
  const get = (id: number) => out.get(id) ?? out.set(id, { cash: 0, inKind: 0, expenses: 0, withdrawn: 0 }).get(id)!;
  for (const r of rows) {
    if (company != null && r.company_id !== company) continue;
    if (r.partner_id == null) continue;
    const a = Number(r.amt), e = get(r.partner_id);
    if (r.kind === "capital_in") e.cash += a;
    else if (r.kind === "asset_purchase" && r.funding === "partner") e.inKind += a;
    else if (r.kind === "expense" && r.funding === "partner") e.expenses += a;
    else if (r.kind === "withdrawal") e.withdrawn += a;
  }
  return out;
}

/** Pembagian laba: kolam modal (sesuai proporsi modal tercatat) + kolam kerja (sesuai bobot kerja). */
export function profitShare(f: Facts, company: Company, months: string[]) {
  const s = summary(f.rows, company.id, months);
  const reserve = Math.round((Math.max(0, s.profit) * company.reserve_pct) / 100);
  const pool = Math.max(0, s.profit) - reserve;
  const capPool = Math.round((pool * company.share_capital_pct) / 100);
  const workPool = pool - capPool;
  const members = f.cps.filter((c) => c.company_id === company.id);
  const cap = capitalByPartner(f.rows, company.id);
  const capTotals = members.map((m) => {
    const c = cap.get(m.partner_id);
    return c ? c.cash + c.inKind + c.expenses : 0;
  });
  const capSum = capTotals.reduce((a, b) => a + b, 0);
  const wSum = members.reduce((a, m) => a + Number(m.work_weight), 0);
  const lines = members.map((m, i) => {
    const capShare = capSum > 0 ? capTotals[i] / capSum : members.length ? 1 / members.length : 0;
    const workShare = wSum > 0 ? Number(m.work_weight) / wSum : 0;
    const fromCap = Math.round(capPool * capShare), fromWork = Math.round(workPool * workShare);
    return {
      partner: f.partners.find((p) => p.id === m.partner_id)!,
      capital: capTotals[i], capShare: capShare * 100, workShare: workShare * 100, fromCap, fromWork, total: fromCap + fromWork,
      paid: sum(f.rows, { company: company.id, kind: "withdrawal", category: "bagi_hasil", partner: m.partner_id, months }),
    };
  });
  return { ...s, reserve, pool, capPool, workPool, lines };
}

/** Realisasi vs rencana alokasi untuk satu perusahaan dalam satu periode. */
export function allocation(f: Facts, company: number | null, months: string[]) {
  const base = summary(f.rows, company, months).revenue;
  const plan = company != null ? f.plans.get(company) ?? DEFAULT_PLAN : DEFAULT_PLAN;
  const actual: Record<string, number> = { operasional: 0, gaji: 0, pengembangan: 0, cadangan: 0, bagi_hasil: 0 };
  const ms = new Set(months);
  for (const r of f.rows) {
    if (company != null && r.company_id !== company) continue;
    if (!ms.has(r.m)) continue;
    const b = bucketOf(r.kind, r.category);
    if (b) actual[b] += Number(r.amt);
  }
  const spent = Object.values(actual).reduce((a, b) => a + b, 0);
  actual.cadangan = Math.max(0, base - spent);
  return BUCKETS.map((b) => {
    const p = Number(plan[b.key] ?? 0);
    return { ...b, pct: p, budget: Math.round((base * p) / 100), actual: actual[b.key], usedPct: base > 0 ? (actual[b.key] / base) * 100 : 0 };
  });
}

export function targetFor(f: Facts, company: number | null, period: string, metric: string): number | null {
  const t = f.targets.find((x) => (x.company_id ?? null) === company && x.period === period && x.metric === metric);
  return t ? Number(t.value) : null;
}
