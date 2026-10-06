import Link from "next/link";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { BarChart } from "@/components/charts";
import { CashTxnForm, ExpenseForm } from "@/components/FinanceForms";
import { PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { balanceSheet, cashBalances, incomeStatement } from "@/lib/reports";
import { addMonths, fmtDate, monthEnd, monthName, monthStart, rupiah, todayWIB } from "@/lib/format";

export const metadata = { title: "Keuangan" };

export default async function FinanceHome() {
  await requireUser(["owner"]);
  const today = todayWIB();
  const ms = monthStart(today);
  const sixAgo = monthStart(addMonths(today, -5));
  const [cash, month, bs, byMonth, recent] = await Promise.all([
    cashBalances(),
    incomeStatement(ms, monthEnd(today)),
    balanceSheet(today),
    q<{ m: string; revenue: number; expense: number }>(
      `select to_char(j.date, 'YYYY-MM') as m,
              coalesce(sum(case when a.type = 'revenue' then l.credit - l.debit end), 0) as revenue,
              coalesce(sum(case when a.type = 'expense' then l.debit - l.credit end), 0) as expense
         from journal_lines l join journals j on j.id = l.journal_id join accounts a on a.id = l.account_id
        where not j.voided and j.date >= $1 and a.type in ('revenue','expense') group by 1 order by 1`, [sixAgo]),
    q<{ id: number; date: string; memo: string; amount: number; ref_type: string }>(
      `select j.id, j.date, j.memo, j.ref_type, (select sum(debit) from journal_lines where journal_id = j.id) as amount
         from journals j where not j.voided order by j.date desc, j.id desc limit 8`),
  ]);
  const totalCash = cash.reduce((s, c) => s + c.amount, 0);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(sixAgo, i).slice(0, 7));
  const chart = months.map((m) => ({ label: monthName(Number(m.slice(5))).slice(0, 3), value: Math.max(0, (byMonth.find((x) => x.m === m)?.revenue ?? 0) - (byMonth.find((x) => x.m === m)?.expense ?? 0)) }));

  return (
    <>
      <PageHeader title="Keuangan" subtitle={`Posisi per ${fmtDate(today)}`}
        actions={<>
          <Sheet title="Catat Pengeluaran" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Pengeluaran</button>}><ExpenseForm /></Sheet>
          <Sheet title="Transaksi Kas Lain" trigger={<button className="btn"><Icon name="dollar" className="size-4" /> Modal / Prive / Transfer</button>}><CashTxnForm /></Sheet>
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total kas & bank" value={rupiah(totalCash)} icon="wallet" tone="accent" />
        <Stat label="Pendapatan bulan ini" value={rupiah(month.revenue)} icon="chart" />
        <Stat label="Beban bulan ini" value={rupiah(month.cost + month.expense)} icon="dollar" />
        <Stat label="Laba bersih bulan ini" value={rupiah(month.net)} tone={month.net >= 0 ? "ok" : "bad"} icon="check" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-1 font-semibold">Laba bersih 6 bulan terakhir</h2>
            <p className="mb-3 text-xs text-muted">Pendapatan dikurangi beban per bulan (nilai negatif ditampilkan 0).</p>
            <BarChart data={chart} />
          </section>
          <section className="card anim-rise p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display font-semibold">Transaksi terakhir</h2>
              <Link href="/keuangan/jurnal" className="text-sm font-semibold text-accent">Semua jurnal</Link>
            </div>
            {recent.length === 0 ? <p className="text-sm text-muted">Belum ada transaksi tercatat.</p> : (
              <ul className="divide-y divide-line">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0"><span className="block truncate font-semibold">{r.memo}</span><span className="text-xs text-muted">{fmtDate(r.date, { short: true })}</span></span>
                    <span className="tnum shrink-0 font-semibold">{rupiah(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-3 font-semibold">Saldo kas & bank</h2>
            <ul className="space-y-2.5">
              {cash.map((c) => (
                <li key={c.code} className="flex justify-between text-sm"><span className="text-muted">{c.name}</span><span className="tnum font-semibold">{rupiah(c.amount)}</span></li>
              ))}
            </ul>
          </section>
          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-3 font-semibold">Posisi keuangan</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Total aset</dt><dd className="tnum font-semibold">{rupiah(bs.totalAssets)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Kewajiban</dt><dd className="tnum font-semibold">{rupiah(bs.totalLiab)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Ekuitas</dt><dd className="tnum font-bold">{rupiah(bs.totalEquity)}</dd></div>
            </dl>
            <Link href="/keuangan/laporan/neraca" className="mt-3 inline-block text-sm font-semibold text-accent">Lihat neraca →</Link>
          </section>
          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-3 font-semibold">Laporan</h2>
            <div className="grid grid-cols-2 gap-2">
              {[["laba-rugi", "Laba Rugi"], ["neraca", "Neraca"], ["arus-kas", "Arus Kas"], ["penjualan", "Penjualan"]].map(([k, l]) => (
                <Link key={k} href={`/keuangan/laporan/${k}`} className="btn btn-sm">{l}</Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
