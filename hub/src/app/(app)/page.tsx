import Link from "next/link";
import { buildInsights } from "@/lib/insights";
import { cashBalance, lastMonths, loadFacts, NON_CAPITAL, summary, sum, targetFor } from "@/lib/metrics";
import { addMonths, compact, fullMonth, monthLabel, pct, rupiah } from "@/lib/format";
import { CompanyDot, Empty, Pill, SectionHead, Stat } from "@/components/ui";
import { Legend, Progress, StackedBars, TrendChart } from "@/components/charts";
import LiveRefresh from "@/components/LiveRefresh";

export const metadata = { title: "Ringkasan" };

export default async function Home() {
  const f = await loadFacts();
  const months = lastMonths(6, f.now), prev = addMonths(f.now, -1);
  const g = summary(f.rows, null, [f.now]), gp = summary(f.rows, null, [prev]);
  const cash = cashBalance(f.rows, null);
  const assets = sum(f.rows, { kind: "asset_purchase" });
  const capital = sum(f.rows, { kind: "capital_in", notCat: NON_CAPITAL }) + sum(f.rows, { kind: ["asset_purchase", "expense"], funding: "partner" });
  const delta = gp.revenue > 0 ? ((g.revenue - gp.revenue) / gp.revenue) * 100 : null;
  const insights = buildInsights(f).filter((i) => i.level !== "ok").slice(0, 3);
  const gTarget = targetFor(f, null, f.now, "revenue");
  const tone = { bad: "bad", warn: "warn", info: "info", ok: "ok" } as const;

  const perCompany = f.companies.map((c) => ({
    c, s: summary(f.rows, c.id, [f.now]), cash: cashBalance(f.rows, c.id),
    series: months.map((m) => summary(f.rows, c.id, [m]).revenue),
  }));

  return (
    <>
      <section className="card card-pad rise">
        <SectionHead title="Posisi perusahaan" note={`${fullMonth(f.now)} · ${f.companies.length} unit usaha dalam satu pandangan`} right={<LiveRefresh />} />
        <div className="statgrid grid-cols-2 lg:grid-cols-4">
          <Stat big label="Total kas grup" value={rupiah(cash)} tone={cash < 0 ? "bad" : undefined} sub="Pendapatan + modal − biaya − penarikan" />
          <Stat big label="Pendapatan bulan ini" value={rupiah(g.revenue)} sub={delta == null ? "Belum ada pembanding" : <span className={delta >= 0 ? "text-ok" : "text-bad"}>{delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))} vs bulan lalu</span>} />
          <Stat big label="Laba bulan ini" value={rupiah(g.profit)} tone={g.profit < 0 ? "bad" : g.profit > 0 ? "ok" : undefined} sub={`Margin ${pct(g.margin)}`} />
          <Stat big label="Aset tercatat" value={rupiah(assets)} sub={`Modal masuk ${compact(capital)}`} />
        </div>
      </section>

      {f.rows.length === 0 && (
        <div className="mt-4"><Empty>Belum ada data. Buka <Link href="/pengaturan" className="text-accent underline">Pengaturan</Link> untuk memuat data contoh atau menyambungkan kasir, atau <Link href="/transaksi" className="text-accent underline">catat transaksi pertama</Link>.</Empty></div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad rise">
          <SectionHead title="Pendapatan per unit" note="6 bulan terakhir" />
          <StackedBars labels={months.map(monthLabel)} series={f.companies.map((c, i) => ({ name: c.name, color: c.color, values: perCompany[i].series }))} />
          <Legend items={f.companies.map((c) => ({ label: c.name, color: c.color }))} />
        </section>
        <section className="card card-pad rise">
          <SectionHead title="Pendapatan, biaya & laba" note="Seluruh grup" />
          <TrendChart height={230} labels={months.map(monthLabel)} series={[
            { name: "Pendapatan", color: "#b8c4ff", values: months.map((m) => summary(f.rows, null, [m]).revenue) },
            { name: "Biaya", color: "#ff8a9a", values: months.map((m) => summary(f.rows, null, [m]).opex) },
            { name: "Laba", color: "#5fd1c4", values: months.map((m) => summary(f.rows, null, [m]).profit) },
          ]} />
          <Legend items={[{ label: "Pendapatan", color: "#b8c4ff" }, { label: "Biaya", color: "#ff8a9a" }, { label: "Laba", color: "#5fd1c4" }]} />
        </section>
      </div>

      <section className="card card-pad mt-4 rise">
        <SectionHead title="Unit usaha" note="Klik untuk melihat detail dan mencatat transaksi" />
        <div className="grid gap-3 sm:grid-cols-2">
          {perCompany.map(({ c, s, cash: k }) => (
            <Link key={c.id} href={`/perusahaan/${c.slug}`} className="block rounded-xl border border-line bg-panel2 p-4 transition hover:border-[color-mix(in_srgb,var(--fg)_26%,transparent)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><CompanyDot color={c.color} /><span className="font-medium">{c.name}</span></div>
                <Pill tone={c.last_sync_at ? "ok" : "info"}>{c.last_sync_at ? "Tersambung" : "Manual"}</Pill>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-[11px] uppercase tracking-wider text-muted">Pendapatan</div><div className="stat-value tnum mt-1 text-lg">{compact(s.revenue)}</div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-muted">Laba</div><div className={`stat-value tnum mt-1 text-lg ${s.profit < 0 ? "text-bad" : ""}`}>{compact(s.profit)}</div></div>
                <div><div className="text-[11px] uppercase tracking-wider text-muted">Kas</div><div className={`stat-value tnum mt-1 text-lg ${k < 0 ? "text-bad" : ""}`}>{compact(k)}</div></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad rise">
          <SectionHead title="Perlu perhatian" right={<Link href="/rekomendasi" className="text-xs text-muted hover:text-fg">Semua →</Link>} />
          {insights.length === 0 ? <p className="text-sm text-muted">Tidak ada peringatan. Kondisi terpantau baik.</p> : (
            <ul className="space-y-4">
              {insights.map((i, k) => (
                <li key={k} className="text-sm"><div className="flex flex-wrap items-center gap-2"><Pill tone={tone[i.level]}>{i.scope}</Pill><span className="font-medium">{i.title}</span></div><p className="mt-1.5 text-muted">{i.action}</p></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card card-pad rise">
          <SectionHead title="Target pendapatan" note={fullMonth(f.now)} right={<Link href="/target" className="text-xs text-muted hover:text-fg">Atur →</Link>} />
          {gTarget ? (
            <div><div className="mb-2 flex justify-between text-sm"><span className="tnum">{rupiah(g.revenue)}</span><span className="tnum text-muted">{rupiah(gTarget)}</span></div>
              <Progress value={(g.revenue / gTarget) * 100} color="var(--accent-2)" /><p className="mt-2 text-xs text-muted">{pct((g.revenue / gTarget) * 100)} tercapai</p></div>
          ) : <p className="text-sm text-muted">Belum ada target grup untuk {fullMonth(f.now)}. Target membantu Hub menilai apakah kamu on-track.</p>}
        </section>
      </div>
    </>
  );
}
