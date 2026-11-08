import "server-only";
import { one } from "./db";
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

/** Alokasi satu periode: kolam biaya di unit host dibagi sesuai persentase. */
export function allocate(f: Facts, cfg: SharedCfg, months: string[]) {
  const host = f.companies.find((c) => c.slug === cfg.host);
  const pool = host ? cfg.categories.reduce((a, cat) => a + sum(f.rows, { company: host.id, kind: "expense", category: cat, months }), 0) : 0;
  const units = f.companies.map((c) => {
    const pct = Number(cfg.pct[c.slug] ?? 0);
    const share = Math.round((pool * pct) / 100);
    // Efek ke laba: unit menanggung bagiannya; host mendapat kembali seluruh kolam yang sudah ia bayar.
    const adjust = -share + (host && c.id === host.id ? pool : 0);
    return { company: c, pct, share, adjust };
  });
  return { host, pool, units, total: units.reduce((a, u) => a + u.pct, 0) };
}
