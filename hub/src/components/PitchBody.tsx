import { q } from "@/lib/db";
import { cashBalance, lastMonths, NON_CAPITAL, summary, sum, type Facts } from "@/lib/metrics";
import { compact, fullMonth, monthLabel, pct, rupiah } from "@/lib/format";
import { Stat } from "./ui";
import { Legend, StackedBars, TrendChart } from "./charts";

/** Isi materi pitching. `publicView` = tampilan investor: tanpa saldo kas & detail modal internal. */
export default async function PitchBody({ f, publicView }: { f: Facts; publicView?: boolean }) {
  const months = lastMonths(6, f.now), t12 = lastMonths(12, f.now);
  const rev12 = summary(f.rows, null, t12), g = summary(f.rows, null, [f.now]), last = summary(f.rows, null, [months[4]]);
  const growth = last.revenue > 0 ? ((g.revenue - last.revenue) / last.revenue) * 100 : null;
  const capital = sum(f.rows, { kind: "capital_in", notCat: NON_CAPITAL }) + sum(f.rows, { kind: ["asset_purchase", "expense"], funding: "partner" });
  const assets = sum(f.rows, { kind: "asset_purchase" });
  const notes = await q<{ title: string; body: string }>("select title, body from notes where kind = 'pitching' order by id desc");
  return (
    <>
      <section className="card glow card-pad mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent2">Frameless Group</div>
        <h2 className="font-display mt-1 text-2xl font-bold">{f.companies.length} unit usaha, satu sistem keuangan terintegrasi</h2>
        <p className="mt-2 text-sm text-muted">{f.companies.map((c) => c.name).join(" · ")}</p>
      </section>
      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat label="Pendapatan 12 bulan" value={rupiah(rev12.revenue)} />
        <Stat label="Laba 12 bulan" value={rupiah(rev12.profit)} tone={rev12.profit < 0 ? "bad" : "ok"} sub={`Margin ${pct(rev12.margin)}`} />
        <Stat label="Pertumbuhan MoM" value={growth == null ? "–" : pct(growth, 1)} tone={growth != null && growth < 0 ? "bad" : "ok"} sub="Bulan ini vs 2 bulan lalu (parsial)" />
        {publicView ? <Stat label="Aset operasional" value={compact(assets)} sub="Alat & inventaris tercatat" /> : <Stat label="Kas & aset" value={compact(cashBalance(f.rows, null) + assets)} sub={`Modal tercatat ${compact(capital)}`} />}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad"><h3 className="mb-2 font-display font-semibold">Pendapatan per unit</h3>
          <StackedBars labels={months.map(monthLabel)} series={f.companies.map((c) => ({ name: c.name, color: c.color, values: months.map((m) => summary(f.rows, c.id, [m]).revenue) }))} />
          <Legend items={f.companies.map((c) => ({ label: c.name, color: c.color }))} /></section>
        <section className="card card-pad"><h3 className="mb-2 font-display font-semibold">Laba grup</h3>
          <TrendChart labels={months.map(monthLabel)} series={[{ name: "Laba", color: "#5fd1c4", values: months.map((m) => summary(f.rows, null, [m]).profit) }]} /></section>
      </div>
      <section className="card card-pad mt-4">
        <h3 className="mb-3 font-display font-semibold">Unit usaha ({fullMonth(f.now)})</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
          <thead><tr><th className="th">Unit</th><th className="th">Bidang</th><th className="th text-right">Pendapatan</th><th className="th text-right">Laba</th><th className="th text-right">Margin</th></tr></thead>
          <tbody>{f.companies.map((c) => { const s = summary(f.rows, c.id, [f.now]); return <tr key={c.id}><td className="td font-medium">{c.name}</td><td className="td text-muted">{c.kind}</td><td className="td tnum text-right">{rupiah(s.revenue)}</td><td className="td tnum text-right">{rupiah(s.profit)}</td><td className="td tnum text-right">{pct(s.margin)}</td></tr>; })}</tbody>
        </table></div>
      </section>
      {notes.map((n) => <section key={n.title} className="card card-pad mt-4"><h3 className="font-display font-semibold">{n.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{n.body}</p></section>)}
    </>
  );
}
