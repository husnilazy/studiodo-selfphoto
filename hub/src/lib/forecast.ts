import "server-only";
import { cashBalance, lastMonths, summary, sum, type Facts } from "./metrics";
import { addMonths } from "./format";

export type Scenario = {
  key: "konservatif" | "dasar" | "optimis"; label: string; color: string;
  months: { m: string; rev: number; cost: number; salary: number; net: number; cash: number }[];
  zeroAt: string | null;
};

/**
 * Proyeksi kas 3 bulan ke depan dari 3 bulan penuh terakhir.
 * - Pendapatan: rata-rata × tren (rata-rata perubahan bulanan, dibatasi −10%…+15%) × faktor skenario.
 * - Biaya non-gaji: setengahnya tetap, setengahnya ikut pendapatan.
 * - Gaji: dari daftar karyawan aktif (bila ada), kalau tidak dari rata-rata biaya gaji.
 * - Belum memasukkan pembelian aset & bagi hasil (bersifat keputusan, bukan rutin).
 */
export function forecast(f: Facts, company: number | null, salaryPlan: Map<number, number>, horizon = 3) {
  const base = addMonths(f.now, -1);
  const hist = lastMonths(3, base);
  const revs = hist.map((m) => summary(f.rows, company, [m]).revenue);
  const pos = revs.filter((v) => v > 0);
  const avgRev = pos.length ? pos.reduce((a, b) => a + b, 0) / pos.length : 0;
  const mom: number[] = [];
  for (let i = 1; i < revs.length; i++) if (revs[i - 1] > 0 && revs[i] > 0) mom.push(revs[i] / revs[i - 1] - 1);
  const rawG = mom.length ? mom.reduce((a, b) => a + b, 0) / mom.length : 0;
  const growth = Math.max(-0.1, Math.min(0.15, rawG));
  const salaries = hist.map((m) => sum(f.rows, { company, kind: "expense", category: "gaji", months: [m] }));
  const nonSalary = hist.map((m, i) => summary(f.rows, company, [m]).opex - salaries[i]);
  const dataMonths = hist.filter((_, i) => revs[i] > 0 || nonSalary[i] > 0).length || 1;
  const avgNonSalary = nonSalary.reduce((a, b) => a + b, 0) / dataMonths;
  // Per unit: pakai daftar karyawan bila ada, kalau tidak pakai rata-rata gaji historis unit itu.
  const targets = company != null ? [company] : f.companies.map((c) => c.id);
  let fromPlan = false;
  const salary = targets.reduce((acc, id) => {
    const plan = salaryPlan.get(id) ?? 0;
    if (plan > 0) { fromPlan = true; return acc + plan; }
    return acc + hist.reduce((a, m) => a + sum(f.rows, { company: id, kind: "expense", category: "gaji", months: [m] }), 0) / 3;
  }, 0);
  const start = cashBalance(f.rows, company);

  const defs: { key: Scenario["key"]; label: string; color: string; factor: number; g: number }[] = [
    { key: "konservatif", label: "Konservatif", color: "#ff8a9a", factor: 0.85, g: Math.min(growth, 0) },
    { key: "dasar", label: "Dasar", color: "#b8c4ff", factor: 1, g: growth },
    { key: "optimis", label: "Optimis", color: "#5fd1c4", factor: 1.1, g: Math.max(growth, 0.03) },
  ];
  const scenarios: Scenario[] = defs.map((d) => {
    let cash = start, zeroAt: string | null = null;
    const months = Array.from({ length: horizon }, (_, k) => {
      const m = addMonths(f.now, k);
      const rev = avgRev * Math.pow(1 + d.g, k + 1) * d.factor;
      const cost = avgRev > 0 ? avgNonSalary * (0.5 + 0.5 * (rev / avgRev)) : avgNonSalary;
      const net = rev - cost - salary;
      cash += net;
      if (cash < 0 && !zeroAt) zeroAt = m;
      return { m, rev: Math.round(rev), cost: Math.round(cost), salary: Math.round(salary), net: Math.round(net), cash: Math.round(cash) };
    });
    return { key: d.key, label: d.label, color: d.color, months, zeroAt };
  });
  return { start, avgRev, growth, avgNonSalary, salary, fromPlan, hasData: avgRev > 0 || avgNonSalary > 0, scenarios };
}
