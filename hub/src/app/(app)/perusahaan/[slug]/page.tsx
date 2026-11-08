import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { allocation, capitalByPartner, cashBalance, EXPENSE_CATEGORIES, lastMonths, loadFacts, summary, sum } from "@/lib/metrics";
import { compact, fullMonth, monthLabel, pct, rupiah } from "@/lib/format";
import { CompanyDot, Empty, PageHead, Pill, Stat } from "@/components/ui";
import { Donut, Legend, Progress, TrendChart } from "@/components/charts";
import TxForm from "@/components/TxForm";
import LiveRefresh from "@/components/LiveRefresh";
import { allocate, getShared } from "@/lib/sharedcost";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [f, user, sharedCfg] = await Promise.all([loadFacts(), currentUser(), getShared()]);
  const c = f.companies.find((x) => x.slug === slug);
  if (!c) notFound();
  const months = lastMonths(6, f.now);
  const s = summary(f.rows, c.id, [f.now]), cash = cashBalance(f.rows, c.id);
  const alloc = allocation(f, c.id, [f.now]);
  const cap = capitalByPartner(f.rows, c.id);
  const cats = EXPENSE_CATEGORIES.map(([k, l]) => ({ k, l, v: sum(f.rows, { company: c.id, kind: "expense", category: k, months: [f.now] }) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const recent = await q<{ id: number; date: string; kind: string; category: string; amount: number; memo: string }>(
    "select id, date, kind, category, amount, memo from transactions where company_id=$1 order by date desc, id desc limit 8", [c.id]);
  const palette = ["#b8c4ff", "#5fd1c4", "#6ea8ff", "#e9c46a", "#e69ad0", "#b79cff", "#7fe0a8", "#8b92aa"];

  return (
    <>
      <PageHead title={c.name} sub={`${c.kind} · ${fullMonth(f.now)}`} right={<div className="flex items-center gap-3"><LiveRefresh /><CompanyDot color={c.color} /></div>} />
      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat label="Kas" value={rupiah(cash)} tone={cash < 0 ? "bad" : undefined} />
        <Stat label="Pendapatan" value={rupiah(s.revenue)} />
        <Stat label="Biaya" value={rupiah(s.opex)} />
        <Stat label="Laba" value={rupiah(s.profit)} tone={s.profit < 0 ? "bad" : s.profit > 0 ? "ok" : undefined} sub={`Margin ${pct(s.margin)}`} />
      </div>

      {(() => {
        const a = allocate(f, sharedCfg, [f.now]);
        const u = a.units.find((x) => x.company.id === c.id);
        if (!u || a.pool === 0) return null;
        return (
          <p className="mt-3 rounded-xl border border-line px-4 py-3 text-sm text-muted">
            Beban bersama bulan ini <b className="text-fg">{rupiah(a.pool)}</b> (dibayar {a.host?.name}). Porsi {c.name}: <b className="text-fg">{pct(u.pct)} = {rupiah(u.share)}</b>
            {" → "}laba setelah alokasi <b className={s.profit + u.adjust < 0 ? "text-bad" : "text-fg"}>{rupiah(s.profit + u.adjust)}</b>. <Link href="/beban-bersama" className="text-accent underline">Atur porsi</Link>
          </p>
        );
      })()}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="card card-pad lg:col-span-3">
          <h2 className="mb-2 font-display font-semibold">Tren 6 bulan</h2>
          <TrendChart labels={months.map(monthLabel)} series={[
            { name: "Pendapatan", color: c.color, values: months.map((m) => summary(f.rows, c.id, [m]).revenue) },
            { name: "Biaya", color: "#ff8a9a", values: months.map((m) => summary(f.rows, c.id, [m]).opex) },
          ]} />
          <Legend items={[{ label: "Pendapatan", color: c.color }, { label: "Biaya", color: "#ff8a9a" }]} />
        </section>
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-3 font-display font-semibold">Biaya bulan ini</h2>
          {cats.length === 0 ? <p className="text-sm text-muted">Belum ada biaya bulan ini.</p> : (
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <Donut parts={cats.map((x, i) => ({ label: x.l, value: x.v, color: palette[i % palette.length] }))} center={<><div className="text-[10px] text-muted">Total</div><div className="font-display text-sm font-bold">{compact(s.opex)}</div></>} />
              <ul className="w-full space-y-1.5 text-sm">{cats.slice(0, 6).map((x, i) => <li key={x.k} className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />{x.l}</span><span className="tnum text-muted">{compact(x.v)}</span></li>)}</ul>
            </div>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 font-display font-semibold">Alokasi bulan ini (realisasi vs rencana)</h2>
          <ul className="space-y-3">
            {alloc.map((a) => (
              <li key={a.key}><div className="mb-1 flex justify-between text-sm"><span>{a.label} <span className="text-xs text-muted">{pct(a.pct)}</span></span><span className="tnum text-muted">{compact(a.actual)} / {compact(a.budget)}</span></div>
                <Progress value={a.budget > 0 ? (a.actual / a.budget) * 100 : 0} color={a.color} over={a.key !== "cadangan" && a.budget > 0 && a.actual > a.budget} /></li>
            ))}
          </ul>
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 font-display font-semibold">Modal per partner</h2>
          {f.cps.filter((x) => x.company_id === c.id).length === 0 ? <p className="text-sm text-muted">Belum ada partner di unit ini (Pengaturan).</p> : (
            <ul className="space-y-2 text-sm">
              {f.cps.filter((x) => x.company_id === c.id).map((m) => {
                const p = f.partners.find((pp) => pp.id === m.partner_id)!, x = cap.get(m.partner_id);
                const total = x ? x.cash + x.inKind + x.expenses : 0;
                return <li key={m.partner_id} className="flex items-center justify-between"><span>{p.name} <span className="text-xs text-muted">· porsi disepakati {pct(Number(m.equity_pct))}</span></span><b className="tnum">{rupiah(total)}</b></li>;
              })}
            </ul>
          )}
        </section>
      </div>

      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Transaksi terakhir</h2>
      {recent.length === 0 ? <Empty>Belum ada transaksi.</Empty> : (
        <div className="card divide-y divide-line">
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0"><div className="truncate font-medium">{r.memo || r.category}</div><div className="text-xs text-muted">{r.date} · {r.category}</div></div>
              <div className="flex items-center gap-2"><Pill tone={r.kind === "revenue" || r.kind === "capital_in" ? "ok" : "warn"}>{r.kind === "revenue" ? "Masuk" : r.kind === "capital_in" ? "Modal" : r.kind === "asset_purchase" ? "Aset" : "Keluar"}</Pill><b className="tnum">{rupiah(r.amount)}</b></div>
            </div>
          ))}
        </div>
      )}
      {user?.role === "owner" && <div className="mt-6"><h2 className="mb-3 font-display text-lg font-semibold">Catat transaksi</h2><TxForm companies={f.companies} partners={f.partners} company={c.id} /></div>}
    </>
  );
}
