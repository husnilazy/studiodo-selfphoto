import Link from "next/link";
import { q } from "@/lib/db";
import { forecast } from "@/lib/forecast";
import { loadFacts } from "@/lib/metrics";
import { compact, fullMonth, monthLabel, pct, rupiah } from "@/lib/format";
import { Empty, PageHead, Pill, Stat } from "@/components/ui";
import { Legend, TrendChart } from "@/components/charts";

export const metadata = { title: "Proyeksi" };

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const f = await loadFacts();
  const company = f.companies.find((c) => c.id === Number(sp.c)) ?? null;
  const pay = await q<{ company_id: number; t: number }>("select company_id, sum(salary)::bigint as t from employees where active group by 1");
  const fc = forecast(f, company?.id ?? null, new Map(pay.map((p) => [p.company_id, Number(p.t)])));
  const base = fc.scenarios[1], cons = fc.scenarios[0];
  const labels = ["Sekarang", ...base.months.map((x) => monthLabel(x.m))];
  const worst = cons.zeroAt;

  return (
    <>
      <PageHead title="Proyeksi arus kas" sub="Perkiraan kas 3 bulan ke depan dalam tiga skenario, dihitung dari 3 bulan penuh terakhir. Gunakan untuk memutuskan kapan aman membeli alat atau menarik bagi hasil." />
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/proyeksi" className={`btn !min-h-8 ${!company ? "btn-primary" : ""}`}>Seluruh grup</Link>
        {f.companies.map((c) => <Link key={c.id} href={`/proyeksi?c=${c.id}`} className={`btn !min-h-8 ${company?.id === c.id ? "btn-primary" : ""}`}>{c.name}</Link>)}
      </div>

      {!fc.hasData ? <Empty>Belum cukup data. Proyeksi butuh transaksi pada bulan-bulan penuh sebelumnya.</Empty> : (
        <>
          <div className="statgrid grid-cols-2 lg:grid-cols-4">
            <Stat label="Kas sekarang" value={rupiah(fc.start)} tone={fc.start < 0 ? "bad" : undefined} />
            <Stat label="Kas akhir (dasar)" value={rupiah(base.months.at(-1)!.cash)} tone={base.months.at(-1)!.cash < 0 ? "bad" : "ok"} sub={fullMonth(base.months.at(-1)!.m)} />
            <Stat label="Tren bulanan" value={pct(fc.growth * 100, 1)} sub="Rata-rata, dibatasi −10% s/d +15%" tone={fc.growth < 0 ? "warn" : undefined} />
            <Stat label="Gaji per bulan" value={rupiah(fc.salary)} sub={fc.fromPlan ? "Daftar karyawan + rata-rata unit tanpa daftar" : "Rata-rata historis"} />
          </div>

          <section className="card card-pad mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-semibold">Saldo kas · 3 skenario</h2>
              {worst ? <Pill tone="bad">Skenario konservatif: kas habis di {fullMonth(worst)}</Pill> : <Pill tone="ok">Kas tetap positif di semua skenario</Pill>}
            </div>
            <TrendChart height={250} fit area={false} labels={labels} series={fc.scenarios.map((s) => ({ name: s.label, color: s.color, values: [fc.start, ...s.months.map((x) => x.cash)] }))} />
            <Legend items={fc.scenarios.map((s) => ({ label: s.label, color: s.color }))} />
          </section>

          <section className="card card-pad mt-4 overflow-x-auto">
            <h2 className="mb-3 font-display font-semibold">Rincian per bulan</h2>
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr><th className="th">Skenario</th><th className="th">Bulan</th><th className="th text-right">Pendapatan</th><th className="th text-right">Biaya</th><th className="th text-right">Gaji</th><th className="th text-right">Bersih</th><th className="th text-right">Saldo kas</th></tr></thead>
              <tbody>
                {fc.scenarios.flatMap((s) => s.months.map((x, i) => (
                  <tr key={s.key + x.m}>
                    <td className="td font-medium" style={{ color: i === 0 ? s.color : "transparent" }}>{s.label}</td>
                    <td className="td">{monthLabel(x.m)}</td>
                    <td className="td tnum text-right">{compact(x.rev)}</td><td className="td tnum text-right">{compact(x.cost)}</td><td className="td tnum text-right">{compact(x.salary)}</td>
                    <td className={`td tnum text-right ${x.net < 0 ? "text-bad" : ""}`}>{compact(x.net)}</td>
                    <td className={`td tnum text-right font-semibold ${x.cash < 0 ? "text-bad" : ""}`}>{compact(x.cash)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </section>
          <p className="mt-4 text-xs text-muted">Asumsi: pendapatan = rata-rata {compact(fc.avgRev)}/bulan × tren × faktor skenario (0,85 / 1 / 1,1). Biaya non-gaji {compact(fc.avgNonSalary)}/bulan, setengahnya ikut pendapatan. Belum memasukkan pembelian aset dan bagi hasil, jadi kurangi dari saldo kas bila kamu berencana melakukannya.</p>
        </>
      )}
    </>
  );
}
