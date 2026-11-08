import "server-only";
import { one, q } from "./db";
import { addMonths } from "./format";
import type { Inventory } from "./assets";
import { cashBalance, lastMonths, sum, summary, type Company, type Facts } from "./metrics";

/**
 * Valuasi indikatif (bukan penilaian resmi). Empat metode yang lazim untuk usaha kecil-menengah dan
 * startup tahap awal, digabung berbobot lalu diberi diskon perusahaan tertutup (DLOM):
 *  1. Multiple pendapatan (EV/Sales)   2. Multiple laba (P/E)   3. DCF (arus kas terdiskonto + nilai terminal)
 *  4. Nilai aset bersih (NAV: kas + aset berdiskon + piutang − hutang)
 * Metode yang tidak bermakna (mis. DCF saat rugi) dilewati dan bobotnya dibagi ulang.
 */
export type Assump = { psr: number; per: number; sam: number; share: number; pipeline: number; growth: number | null };
export type ValCfg = {
  rate: number; tg: number; years: number; dlom: number; haircut: number; reinvest: number; winrate: number;
  w: { psr: number; per: number; dcf: number; nav: number };
  units: Record<string, Partial<Assump>>; configured: boolean;
};
export const DEFAULT_VAL: ValCfg = {
  rate: 25, tg: 5, years: 5, dlom: 25, haircut: 50, reinvest: 15, winrate: 30,
  w: { psr: 30, per: 20, dcf: 30, nav: 20 }, units: {}, configured: false,
};
export const unitDefault = (slug: string): Assump => ({ psr: slug.includes("photobooth") ? 2 : 0.8, per: 4, sam: 0, share: 0, pipeline: 0, growth: null });

export async function getVal(): Promise<ValCfg> {
  const r = await one<{ value: Partial<ValCfg> }>("select value from settings where key = 'valuation'");
  if (!r) return DEFAULT_VAL;
  return { ...DEFAULT_VAL, ...r.value, w: { ...DEFAULT_VAL.w, ...(r.value.w ?? {}) }, units: r.value.units ?? {}, configured: true };
}
const assump = (cfg: ValCfg, slug: string): Assump => ({ ...unitDefault(slug), ...(cfg.units[slug] ?? {}) } as Assump);

export type Raise = { amount: number; scope: string; uses: { label: string; pct: number }[]; note: string };
export async function getRaise(): Promise<Raise> {
  const r = await one<{ value: Partial<Raise> }>("select value from settings where key = 'raise'");
  return { amount: 0, scope: "group", uses: [], note: "", ...(r?.value ?? {}) };
}

type Ob = { company_id: number | null; kind: string; left: number };
export const loadObligations = () => q<Ob>("select company_id, kind, (amount - paid)::bigint as left from obligations where amount > paid");

export type Methods = { psr: number | null; per: number | null; dcf: number | null; nav: number };
export type UnitVal = {
  company: Company; a: Assump; annualRev: number; annualProfit: number; growth: number; monthsData: number; confidence: "rendah" | "sedang" | "tinggi";
  netCash: number; cash: number; piutang: number; hutang: number; assetsCost: number;
  methods: Methods; blended: number; low: number; high: number; fair: number; fairLow: number; fairHigh: number; notes: string[];
};

export function valueUnit(f: Facts, c: Company, cfg: ValCfg, obs: Ob[], inv?: Inventory): UnitVal {
  const a = assump(cfg, c.slug);
  const win = lastMonths(12, addMonths(f.now, -1)); // 12 bulan penuh terakhir
  const active = win.filter((m) => { const s = summary(f.rows, c.id, [m]); return s.revenue > 0 || s.opex > 0; });
  const monthsData = active.length;
  const s12 = summary(f.rows, c.id, win);
  const k = monthsData > 0 ? 12 / monthsData : 0; // anualisasi bila data belum 12 bulan
  const annualRev = Math.round(s12.revenue * k), annualProfit = Math.round(s12.profit * k);
  const notes: string[] = [];
  if (monthsData < 12) notes.push(`Data baru ${monthsData} bulan, angka tahunan diperkirakan dari rata-rata bulanan.`);
  const confidence = monthsData >= 12 ? "tinggi" : monthsData >= 6 ? "sedang" : "rendah";

  // Pertumbuhan: 6 bulan terakhir vs 6 bulan sebelumnya, dibatasi −20%…+40%; bisa ditimpa manual.
  const h2 = win.slice(6), h1 = win.slice(0, 6);
  const r2 = summary(f.rows, c.id, h2).revenue, r1 = summary(f.rows, c.id, h1).revenue;
  const auto = r1 > 0 ? Math.max(-0.2, Math.min(0.4, r2 / r1 - 1)) : 0.1;
  const growth = a.growth != null ? a.growth / 100 : auto;

  const mine = obs.filter((o) => o.company_id === c.id);
  const piutang = mine.filter((o) => o.kind === "piutang").reduce((t, o) => t + Number(o.left), 0);
  const hutang = mine.filter((o) => o.kind === "hutang").reduce((t, o) => t + Number(o.left), 0);
  const cash = cashBalance(f.rows, c.id);
  const netCash = cash + piutang - hutang;
  const assetsCost = sum(f.rows, { company: c.id, kind: "asset_purchase" });

  const r = cfg.rate / 100, tg = cfg.tg / 100;
  const m: Methods = { psr: null, per: null, dcf: null, nav: 0 };
  if (annualRev > 0) m.psr = annualRev * a.psr + netCash;
  if (annualProfit > 0) {
    m.per = annualProfit * a.per + netCash;
    let pv = 0, fcf = annualProfit;
    for (let t = 1; t <= cfg.years; t++) {
      const g = growth + ((tg - growth) * (t - 1)) / Math.max(1, cfg.years - 1); // pertumbuhan menyusut ke tingkat terminal
      fcf = fcf * (1 + g);
      pv += (fcf * (1 - cfg.reinvest / 100)) / Math.pow(1 + r, t);
    }
    const tv = r > tg ? (fcf * (1 - cfg.reinvest / 100) * (1 + tg)) / (r - tg) : 0;
    m.dcf = pv + tv / Math.pow(1 + r, cfg.years) + netCash;
  } else if (annualRev > 0) notes.push("Laba belum positif: metode laba & DCF tidak dipakai.");
  // Bila inventaris sudah diisi, pakai nilai barang yang masih berfungsi (rusak/hilang/dijual = 0); kalau belum, perkirakan dari harga beli.
  const reg = inv?.get(c.id);
  const assetsValue = reg ? reg.value : assetsCost * (1 - cfg.haircut / 100);
  if (!reg && assetsCost > 0) notes.push("Inventaris aset belum diisi: nilai aset diperkirakan dari harga beli. Isi di Keuangan → Aset & inventaris.");
  m.nav = cash + assetsValue + piutang - hutang;

  const parts = ([["psr", cfg.w.psr], ["per", cfg.w.per], ["dcf", cfg.w.dcf], ["nav", cfg.w.nav]] as const)
    .map(([key, w]) => ({ v: m[key], w })).filter((p): p is { v: number; w: number } => p.v != null && p.w > 0);
  const wTot = parts.reduce((t, p) => t + p.w, 0);
  const blended = wTot > 0 ? Math.max(0, parts.reduce((t, p) => t + p.v * p.w, 0) / wTot) : 0;
  const vals = parts.map((p) => p.v);
  const low = vals.length ? Math.max(0, Math.min(...vals)) : 0, high = vals.length ? Math.max(0, Math.max(...vals)) : 0;
  const d = 1 - cfg.dlom / 100;
  return { company: c, a, annualRev, annualProfit, growth, monthsData, confidence, netCash, cash, piutang, hutang, assetsCost, methods: m,
    blended, low, high, fair: blended * d, fairLow: low * d, fairHigh: high * d, notes };
}

export function valueGroup(f: Facts, cfg: ValCfg, obs: Ob[], inv?: Inventory) {
  const units = f.companies.map((c) => valueUnit(f, c, cfg, obs, inv));
  const loose = obs.filter((o) => o.company_id == null); // hutang/piutang tingkat grup
  const looseNet = loose.reduce((t, o) => t + (o.kind === "piutang" ? 1 : -1) * Number(o.left), 0);
  const d = 1 - cfg.dlom / 100;
  const add = (k: "blended" | "low" | "high") => Math.max(0, units.reduce((t, u) => t + u[k], 0) + looseNet);
  return {
    units, looseNet,
    blended: add("blended"), low: add("low"), high: add("high"),
    fair: add("blended") * d, fairLow: add("low") * d, fairHigh: add("high") * d,
    annualRev: units.reduce((t, u) => t + u.annualRev, 0), annualProfit: units.reduce((t, u) => t + u.annualProfit, 0),
  };
}

/** Proyeksi pasar bottom-up: dari laju pendapatan aktual + skenario pertumbuhan, dibandingkan dengan ukuran pasar yang diisi owner. */
export function marketUnit(u: UnitVal, cfg: ValCfg, years = 3) {
  const g = u.growth;
  const defs = [
    { key: "konservatif", label: "Konservatif", g: Math.max(-0.1, g - 0.1), color: "#ff8a9a" },
    { key: "dasar", label: "Dasar", g, color: "#b8c4ff" },
    { key: "optimis", label: "Optimis", g: g + 0.1, color: "#5fd1c4" },
  ];
  const pipelineWeighted = Math.round((u.a.pipeline * cfg.winrate) / 100);
  return {
    pipelineWeighted,
    rows: defs.map((d) => ({
      ...d,
      rev: Array.from({ length: years }, (_, i) => Math.round(u.annualRev * Math.pow(1 + d.g, i + 1) + (i === 0 && d.key === "dasar" ? pipelineWeighted : 0))),
    })),
    shareNow: u.a.sam > 0 ? (u.annualRev / u.a.sam) * 100 : null,
  };
}

/** Simulasi instrumen investasi: ekuitas vs bagi hasil pendapatan, memakai proyeksi dasar. */
export function simulate(pre: number, amount: number, baseRevs: number[]) {
  const post = pre + amount;
  const equityPct = post > 0 ? (amount / post) * 100 : 0;
  const cap = 1.5; // batas pengembalian bagi hasil: 1,5× modal
  const total3 = baseRevs.reduce((a, b) => a + b, 0);
  const rsPct = total3 > 0 ? Math.min(30, ((amount * cap) / total3) * 100) : 0; // % pendapatan agar balik 1,5× dalam 3 tahun
  let paid = 0, months = 0;
  const target = amount * cap;
  if (rsPct > 0) {
    for (let y = 0; y < baseRevs.length && paid < target; y++)
      for (let mo = 0; mo < 12 && paid < target; mo++) { paid += (baseRevs[y] / 12) * (rsPct / 100); months++; }
  }
  return { post, equityPct, rsPct, rsMonths: paid >= target * 0.999 ? months : null, cap };
}

/** Faktor risiko otomatis dari data aktual (dipakai halaman & PDF prospektus). */
export function risksOf(f: Facts, g: ReturnType<typeof valueGroup>): string[] {
  const risks: string[] = [];
  const top = [...g.units].sort((a, b) => b.annualRev - a.annualRev)[0];
  if (top && g.annualRev > 0 && top.annualRev / g.annualRev > 0.6) risks.push(`Pendapatan terkonsentrasi: ${top.company.name} menyumbang ${Math.round((top.annualRev / g.annualRev) * 100)}% dari total.`);
  if (g.annualProfit <= 0) risks.push("Grup belum laba pada 12 bulan terakhir; valuasi lebih bertumpu pada aset dan prospek.");
  g.units.filter((u) => u.confidence === "rendah").forEach((u) => risks.push(`${u.company.name} baru punya ${u.monthsData} bulan data; proyeksinya masih awal.`));
  const hut = g.units.reduce((t, u) => t + u.hutang, 0);
  if (hut > 0) risks.push(`Ada hutang/kewajiban terbuka Rp ${Math.round(hut).toLocaleString("id-ID")} di tingkat unit.`);
  if (f.cps.filter((m) => Number(m.equity_pct) > 0).length === 0) risks.push("Porsi kepemilikan antarpartner belum dituntaskan secara tertulis.");
  return risks;
}
