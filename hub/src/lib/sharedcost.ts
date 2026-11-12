import "server-only";
import { one, q } from "./db";
import { sum, type Facts } from "./metrics";

/** Beban bersama: sewa ruko, listrik, wifi, dll yang dibayar satu unit (host) tetapi dipakai bersama. */
export type SharedCfg = { host: string; categories: string[]; pct: Record<string, number>; configured: boolean };

export const SHARED_CATEGORY_CHOICES = [
  ["sewa", "Sewa tempat / ruko"], ["utilitas", "Listrik, air, internet"], ["operasional", "Operasional lain"], ["marketing", "Marketing"], ["pajak", "Pajak & legal"],
] as const;
export const DEFAULT_SHARED: SharedCfg = { host: "frameless", categories: ["sewa", "utilitas"], pct: { frameless: 40, studiodo: 50, photobooth: 0, snapcup: 10 }, configured: false };

export async function getShared(): Promise<SharedCfg> {
  const r = await one<{ value: Partial<SharedCfg> }>("select value from settings where key = 'shared_cost'");
  if (!r) return DEFAULT_SHARED;
  return { ...DEFAULT_SHARED, ...r.value, pct: { ...DEFAULT_SHARED.pct, ...(r.value.pct ?? {}) }, configured: true };
}

/** Satu pembayaran biaya bersama; `cover` bulan = berlaku untuk berapa bulan (mulai bulan tanggalnya). */
export type SharedItem = { id: number; date: string; memo: string; category: string; amount: number; cover: number };

export async function loadSharedItems(f: Facts, cfg: SharedCfg): Promise<SharedItem[]> {
  const host = f.companies.find((c) => c.slug === cfg.host);
  if (!host) return [];
  const r = await q<{ id: number; date: string; memo: string; category: string; amount: number; cover: number }>(
    `select id, to_char(date,'YYYY-MM-DD') as date, memo, category, amount::bigint as amount, cover_months as cover
       from transactions where company_id = $1 and kind = 'expense' and category = any($2) order by date desc, id desc`, [host.id, cfg.categories]);
  return r.map((x) => ({ ...x, amount: Number(x.amount), cover: Number(x.cover) || 1 }));
}

const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
/** Apakah pembayaran ini mencakup bulan `m` (YYYY-MM)? */
export const covers = (it: SharedItem, m: string) => { const d = monthIndex(it.date.slice(0, 7)), x = monthIndex(m); return x >= d && x < d + it.cover; };
/** Bagian per bulan (pembulatan ke rupiah). */
export const perMonth = (it: SharedItem) => Math.round(it.amount / it.cover);
/** Rentang bulan yang dicakup, mis. "Jan 26 – Des 26". */
export function coverRange(it: SharedItem) {
  const a = it.date.slice(0, 7), i = monthIndex(a) + it.cover - 1;
  const end = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  return it.cover === 1 ? a : `${a} s/d ${end}`;
}
export const poolFor = (items: SharedItem[], months: string[]) => months.reduce((a, m) => a + items.filter((it) => covers(it, m)).reduce((b, it) => b + perMonth(it), 0), 0);

/** Alokasi satu periode: kolam biaya di unit host dibagi sesuai persentase.
 *  Bila `items` diberikan, biaya yang berlaku beberapa bulan dibagi rata per bulan (mis. ruko setahun ÷ 12). */
export function allocate(f: Facts, cfg: SharedCfg, months: string[], items?: SharedItem[]) {
  const host = f.companies.find((c) => c.slug === cfg.host);
  const pool = !host ? 0 : items ? poolFor(items, months) : cfg.categories.reduce((a, cat) => a + sum(f.rows, { company: host.id, kind: "expense", category: cat, months }), 0);
  const paid = items ? items.filter((it) => months.includes(it.date.slice(0, 7))).reduce((a, it) => a + it.amount, 0) : pool;
  const units = f.companies.map((c) => {
    const pct = Number(cfg.pct[c.slug] ?? 0);
    const share = Math.round((pool * pct) / 100);
    // Efek ke laba: unit menanggung bagiannya; host mendapat kembali yang benar-benar ia keluarkan di periode ini
    // (biaya setahun yang dibayar bulan Januari tidak lagi menumpuk di Januari, dan bulan lain tidak "menerima" uang yang tidak keluar).
    const adjust = -share + (host && c.id === host.id ? paid : 0);
    return { company: c, pct, share, adjust };
  });
  return { host, pool, units, total: units.reduce((a, u) => a + u.pct, 0) };
}
