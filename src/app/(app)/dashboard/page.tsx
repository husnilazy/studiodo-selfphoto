import Link from "next/link";
import Icon from "@/components/Icon";
import BookingRow from "@/components/BookingRow";
import { BarChart, HBars } from "@/components/charts";
import { Empty, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { listBookings } from "@/lib/data";
import { expireStalePending } from "@/lib/online";
import { cashBalances, incomeStatement, salesSummary } from "@/lib/reports";
import { addDays, fmtDate, fmtMonth, monthEnd, monthStart, rupiah, todayWIB } from "@/lib/format";

export const metadata = { title: "Beranda" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ akses?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  await expireStalePending();
  const today = todayWIB();
  const from14 = addDays(today, -13);
  const owner = user.role === "owner";
  const [todayRows, sales14, month] = await Promise.all([
    listBookings({ from: today, to: today }),
    salesSummary(from14, today),
    salesSummary(monthStart(today), today),
  ]);
  const todayPay = sales14.byDay.find((d) => d.d === today)?.total ?? 0;
  const monthIncome = month.byDay.reduce((s, d) => s + d.total, 0);
  const live = todayRows.filter((b) => b.status !== "cancelled" && b.status !== "no_show");

  const [online, owing, upcoming, extra] = await Promise.all([
    listBookings({ status: "pending", limit: 50 }).then((r) => r.filter((b) => b.source === "website")),
    q<{ id: number; code: string; customer: string; due: number; start_at: string }>(
      `select b.id, b.code, c.name as customer, b.total - coalesce(p.paid,0) as due, b.start_at
         from bookings b join customers c on c.id = b.customer_id
         left join (select booking_id, sum(case when kind='refund' then -amount else amount end) paid from payments where not voided group by booking_id) p on p.booking_id = b.id
        where b.status in ('pending','confirmed','done') and b.total - coalesce(p.paid,0) > 0
        order by b.start_at limit 6`),
    listBookings({ from: addDays(today, 1), to: addDays(today, 7), limit: 5 }),
    owner ? Promise.all([incomeStatement(monthStart(today), monthEnd(today)), cashBalances()]) : Promise.resolve(null),
  ]);

  const days = Array.from({ length: 14 }, (_, i) => addDays(from14, i));
  const chart = days.map((d) => ({ label: d.slice(8), value: sales14.byDay.find((x) => x.d === d)?.total ?? 0 }));
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(new Date()));
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  return (
    <>
      {sp.akses === "ditolak" && <p className="mb-4 rounded-xl bg-warnsoft px-4 py-3 text-sm font-semibold text-warn">Akun Anda tidak punya akses ke halaman itu.</p>}
      <div className="anim-rise mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{fmtDate(today, { weekday: true })}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{greet}, {user.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/live" className="btn"><Icon name="clock" className="size-4" /> Sesi Live</Link>
          <Link href="/booking/baru" className="btn btn-primary"><Icon name="plus" className="size-4" /> Walk-in</Link>
          <Link href="/booking/baru?mode=booking" className="btn"><Icon name="calendar" className="size-4" /> Booking</Link>
        </div>
      </div>

      {online.length > 0 && (
        <section className="card anim-rise mb-5 border-accent/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display flex items-center gap-2 font-semibold"><span className="size-2.5 animate-pulse rounded-full bg-accent" /> Booking online menunggu ({online.length})</h2>
            <Link href="/booking?view=daftar&status=pending" className="text-sm font-semibold text-accent">Lihat semua</Link>
          </div>
          <div className="space-y-2">{online.slice(0, 4).map((b) => <BookingRow key={b.id} b={b} showDate />)}</div>
        </section>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat i={0} label="Sesi hari ini" value={live.length} hint={`${live.filter((b) => b.status === "done").length} selesai`} icon="camera" />
        <Stat i={1} label="Pemasukan hari ini" value={rupiah(todayPay)} icon="dollar" tone="accent" />
        <Stat i={2} label={`Pemasukan ${fmtMonth(today).split(" ")[0]}`} value={rupiah(monthIncome)} hint={`${month.sessions} sesi · ${month.people} orang`} icon="chart" />
        {extra ? (
          <Stat i={3} label="Laba bersih bulan ini" value={rupiah(extra[0].net)} tone={extra[0].net >= 0 ? "ok" : "bad"} icon="wallet" hint={`Pendapatan ${rupiah(extra[0].revenue)}`} />
        ) : (
          <Stat i={4} label="Booking 7 hari ke depan" value={upcoming.length >= 5 ? "5+" : upcoming.length} icon="calendar" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-1 font-semibold">Pemasukan 14 hari terakhir</h2>
            <p className="mb-3 text-xs text-muted">Total {rupiah(chart.reduce((s, d) => s + d.value, 0))}</p>
            <BarChart data={chart} />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display font-semibold">Sesi hari ini</h2>
              <Link href={`/booking?view=jadwal&date=${today}`} className="text-sm font-semibold text-accent">Lihat jadwal</Link>
            </div>
            {live.length === 0 ? <Empty title="Belum ada sesi hari ini" hint="Mulai dengan transaksi walk-in atau lihat booking mendatang." /> : (
              <div className="space-y-2">{live.map((b) => <BookingRow key={b.id} b={b} />)}</div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {extra && (
            <section className="card anim-rise p-4 sm:p-5">
              <h2 className="font-display mb-3 font-semibold">Saldo Kas</h2>
              <ul className="space-y-2">
                {extra[1].map((c) => <li key={c.code} className="flex justify-between text-sm"><span className="text-muted">{c.name}</span><span className="tnum font-semibold">{rupiah(c.amount)}</span></li>)}
              </ul>
              <div className="mt-3 flex justify-between border-t border-line pt-3">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-display tnum font-bold">{rupiah(extra[1].reduce((s, c) => s + c.amount, 0))}</span>
              </div>
              <Link href="/keuangan" className="mt-3 inline-block text-sm font-semibold text-accent">Buka Keuangan →</Link>
            </section>
          )}

          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-3 font-semibold">Belum Lunas</h2>
            {owing.length === 0 ? <p className="text-sm text-muted">Semua tagihan lunas 🎉</p> : (
              <ul className="divide-y divide-line">
                {owing.map((o) => (
                  <li key={o.id}>
                    <Link href={`/booking/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0"><span className="block truncate font-semibold">{o.customer}</span><span className="text-xs text-muted">{o.code}</span></span>
                      <span className="tnum shrink-0 font-bold text-warn">{rupiah(o.due)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card anim-rise p-4 sm:p-5">
            <h2 className="font-display mb-3 font-semibold">Paket Terlaris · Bulan Ini</h2>
            {month.byPackage.length === 0 ? <p className="text-sm text-muted">Belum ada data.</p> : (
              <HBars rows={month.byPackage.slice(0, 5).map((p) => ({ label: p.name, value: p.total, sub: `${p.n}x` }))} />
            )}
          </section>

          {upcoming.length > 0 && (
            <section>
              <h2 className="font-display mb-2 font-semibold">7 Hari ke Depan</h2>
              <div className="space-y-2">{upcoming.map((b) => <BookingRow key={b.id} b={b} showDate />)}</div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
