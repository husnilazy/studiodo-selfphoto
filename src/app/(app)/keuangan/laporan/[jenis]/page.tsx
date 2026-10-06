import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart, HBars } from "@/components/charts";
import ExportCsv, { PrintBtn } from "@/components/ExportCsv";
import { Money, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { REPORTS } from "@/lib/reportsMeta";
import { balanceSheet, cashFlow, incomeStatement, ledgerFor, salesSummary, trialBalance } from "@/lib/reports";
import { METHOD_LABEL, addDays, addMonths, fmtDate, monthEnd, monthStart, rupiah, todayWIB } from "@/lib/format";

type SP = { from?: string; to?: string; acc?: string };
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function generateMetadata({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = await params;
  const r = REPORTS.find((x) => x.k === jenis);
  return { title: r ? r.t : "Laporan" };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ jenis: string }>; searchParams: Promise<SP> }) {
  await requireUser(["owner"]);
  const { jenis } = await params;
  const meta = REPORTS.find((r) => r.k === jenis);
  if (!meta) notFound();
  const sp = await searchParams;
  const today = todayWIB();
  const from = isDate(sp.from) ? sp.from! : monthStart(today);
  const to = isDate(sp.to) ? sp.to! : jenis === "neraca" || jenis === "neraca-saldo" ? today : monthEnd(today);
  const asOfOnly = jenis === "neraca";

  const ym = today.slice(0, 7), lastM = addMonths(`${ym}-01`, -1);
  const year = today.slice(0, 4);
  const presets: [string, string, string][] = [
    ["Bulan ini", monthStart(today), monthEnd(today)],
    ["Bulan lalu", monthStart(lastM), monthEnd(lastM)],
    ["3 bulan", monthStart(addMonths(`${ym}-01`, -2)), monthEnd(today)],
    ["Tahun ini", `${year}-01-01`, `${year}-12-31`],
    ["Tahun lalu", `${Number(year) - 1}-01-01`, `${Number(year) - 1}-12-31`],
  ];
  const href = (f: string, t: string) => `/keuangan/laporan/${jenis}?${new URLSearchParams({ from: f, to: t, ...(sp.acc ? { acc: sp.acc } : {}) })}`;
  const periodLabel = asOfOnly ? `Per ${fmtDate(to)}` : `${fmtDate(from)} – ${fmtDate(to)}`;

  return (
    <>
      <PageHeader back="/keuangan/laporan" title={meta.t} subtitle={periodLabel}
        actions={<><ExportCsv name={`${jenis}_${to}`} /><PrintBtn /></>} />

      <form className="no-print card mb-5 flex flex-wrap items-end gap-2 p-3">
        {!asOfOnly && <label className="block"><span className="label">Dari</span><input type="date" name="from" defaultValue={from} className="input !min-h-10" /></label>}
        <label className="block"><span className="label">{asOfOnly ? "Per tanggal" : "Sampai"}</span><input type="date" name="to" defaultValue={to} className="input !min-h-10" /></label>
        {jenis === "buku-besar" && <input type="hidden" name="acc" value={sp.acc ?? ""} />}
        <button className="btn btn-sm !min-h-10">Terapkan</button>
        <div className="flex w-full flex-wrap gap-1.5 pt-1">
          {(asOfOnly ? [["Hari ini", today, today], ["Akhir bulan lalu", monthEnd(lastM), monthEnd(lastM)], ["Akhir tahun lalu", `${Number(year) - 1}-12-31`, `${Number(year) - 1}-12-31`]] as [string, string, string][] : presets)
            .map(([l, f, t]) => <Link key={l} href={href(f, t)} className="chip !min-h-8 !px-3 !text-xs">{l}</Link>)}
        </div>
      </form>

      <div id="report">
        <h2 className="hidden print:block font-display text-xl font-bold">{meta.t} — {periodLabel}</h2>
        {jenis === "laba-rugi" && <IncomeStatement from={from} to={to} />}
        {jenis === "neraca" && <BalanceSheet to={to} />}
        {jenis === "arus-kas" && <CashFlow from={from} to={to} />}
        {jenis === "neraca-saldo" && <TrialBalance to={to} from={from} />}
        {jenis === "buku-besar" && <Ledger from={from} to={to} acc={Number(sp.acc) || 0} />}
        {jenis === "penjualan" && <Sales from={from} to={to} />}
      </div>
    </>
  );
}

const Section = ({ title, cols = 2 }: { title: string; cols?: number }) => (
  <tr><td colSpan={cols} className="!bg-panel2 !py-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</td></tr>
);
const Line = ({ label, v, v2, bold, indent, tone }: { label: string; v: number; v2?: number; bold?: boolean; indent?: boolean; tone?: string }) => (
  <tr className={bold ? "font-bold" : ""}>
    <td className={indent ? "!pl-6" : ""}>{label}</td>
    <td className={`num ${tone ?? ""}`}><Money v={v} /></td>
    {v2 !== undefined && <td className="num text-muted"><Money v={v2} /></td>}
  </tr>
);

async function IncomeStatement({ from, to }: { from: string; to: string }) {
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  const pTo = addDays(from, -1), pFrom = addDays(pTo, -(days - 1));
  const [cur, prev] = await Promise.all([incomeStatement(from, to), incomeStatement(pFrom, pTo)]);
  const pv = (list: { code: string; amount: number }[], code: string) => list.find((x) => x.code === code)?.amount ?? 0;
  const codes = (a: { code: string }[], b: { code: string }[]) => [...new Set([...a, ...b].map((x) => x.code))].sort();
  const nameOf = (code: string, ...lists: { code: string; name: string }[][]) => lists.flat().find((x) => x.code === code)?.name ?? code;
  const margin = cur.revenue > 0 ? (cur.net / cur.revenue) * 100 : 0;

  return (
    <>
      <div className="no-print mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Pendapatan" value={rupiah(cur.revenue)} />
        <Stat label="Laba bersih" value={rupiah(cur.net)} tone={cur.net >= 0 ? "ok" : "bad"} />
        <Stat label="Margin laba" value={`${margin.toFixed(1)}%`} />
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Keterangan</th><th className="num">Periode ini</th><th className="num">Sebelumnya</th></tr></thead>
          <tbody>
            <Section title="Pendapatan" cols={3} />
            {codes(cur.rev, prev.rev).map((c) => <Line key={c} indent label={nameOf(c, cur.rev, prev.rev)} v={pv(cur.rev, c)} v2={pv(prev.rev, c)} />)}
            <Line bold label="Total Pendapatan" v={cur.revenue} v2={prev.revenue} />
            {(cur.cost !== 0 || prev.cost !== 0) && <>
              <Section title="Harga Pokok Penjualan" cols={3} />
              {codes(cur.cogs, prev.cogs).map((c) => <Line key={c} indent label={nameOf(c, cur.cogs, prev.cogs)} v={pv(cur.cogs, c)} v2={pv(prev.cogs, c)} />)}
              <Line bold label="Total HPP" v={cur.cost} v2={prev.cost} />
            </>}
            <Line bold label="LABA KOTOR" v={cur.gross} v2={prev.gross} />
            <Section title="Beban Operasional" cols={3} />
            {codes(cur.opex, prev.opex).map((c) => <Line key={c} indent label={nameOf(c, cur.opex, prev.opex)} v={pv(cur.opex, c)} v2={pv(prev.opex, c)} />)}
            <Line bold label="Total Beban Operasional" v={cur.expense} v2={prev.expense} />
            <Line bold label="LABA (RUGI) BERSIH" v={cur.net} v2={prev.net} tone={cur.net >= 0 ? "text-ok" : "text-bad"} />
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Kolom “Sebelumnya” = periode dengan lama yang sama tepat sebelum periode ini ({fmtDate(pFrom, { short: true })} – {fmtDate(pTo, { short: true })}). Pendapatan diakui saat uang diterima (basis kas).</p>
    </>
  );
}

async function BalanceSheet({ to }: { to: string }) {
  const b = await balanceSheet(to);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Aset</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              {b.assets.map((a) => <Line key={a.code} indent label={`${a.code} ${a.name}`} v={a.amount} />)}
              <Line bold label="TOTAL ASET" v={b.totalAssets} />
            </tbody>
          </table>
        </div>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Kewajiban & Ekuitas</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              <Section title="Kewajiban" />
              {b.liabilities.map((a) => <Line key={a.code} indent label={`${a.code} ${a.name}`} v={a.amount} />)}
              <Line bold label="Total Kewajiban" v={b.totalLiab} />
              <Section title="Ekuitas" />
              {b.equity.map((a) => <Line key={a.code} indent label={`${a.code} ${a.name}`} v={a.amount} />)}
              <Line indent label="Laba ditahan & berjalan" v={b.retained} />
              <Line bold label="Total Ekuitas" v={b.totalEquity} />
              <Line bold label="TOTAL KEWAJIBAN & EKUITAS" v={b.totalLiab + b.totalEquity} />
            </tbody>
          </table>
        </div>
      </div>
      <p className={`mt-3 text-sm font-semibold ${b.balanced ? "text-ok" : "text-bad"}`}>{b.balanced ? "✓ Neraca seimbang (Aset = Kewajiban + Ekuitas)" : `⚠ Tidak seimbang, selisih ${rupiah(b.totalAssets - b.totalLiab - b.totalEquity)}`}</p>
    </>
  );
}

async function CashFlow({ from, to }: { from: string; to: string }) {
  const c = await cashFlow(from, to);
  const rows = (list: { code: string; name: string; cash: number }[]) =>
    list.length ? list.map((l) => <Line key={l.code} indent label={l.name} v={l.cash} />) : <tr><td colSpan={2} className="!pl-6 text-muted">Tidak ada</td></tr>;
  return (
    <>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Keterangan</th><th className="num">Jumlah</th></tr></thead>
          <tbody>
            <Section title="Arus kas dari aktivitas operasional" />
            {rows(c.operating)}
            <Line bold label="Kas bersih dari operasional" v={c.netOperating} />
            <Section title="Arus kas dari aktivitas investasi" />
            {rows(c.investing)}
            <Line bold label="Kas bersih dari investasi" v={c.netInvesting} />
            <Section title="Arus kas dari aktivitas pendanaan" />
            {rows(c.financing)}
            <Line bold label="Kas bersih dari pendanaan" v={c.netFinancing} />
            <Line bold label="KENAIKAN (PENURUNAN) KAS" v={c.net} tone={c.net >= 0 ? "text-ok" : "text-bad"} />
            <Line label="Saldo kas awal periode" v={c.opening} />
            <Line bold label="SALDO KAS AKHIR PERIODE" v={c.closing} />
          </tbody>
        </table>
      </div>
      <p className={`mt-3 text-sm font-semibold ${c.reconciles ? "text-ok" : "text-bad"}`}>{c.reconciles ? "✓ Cocok dengan saldo kas & bank di neraca" : "⚠ Tidak cocok dengan saldo kas — periksa jurnal manual"}</p>
      <p className="mt-1 text-xs text-muted">Metode langsung. Perpindahan antar kas/bank/QRIS tidak dihitung sebagai arus kas.</p>
    </>
  );
}

async function TrialBalance({ to, from }: { to: string; from: string }) {
  void from;
  const rows = (await trialBalance(to)).filter((r) => r.debit !== 0 || r.credit !== 0);
  const dSide = rows.map((r) => Math.max(0, r.debit - r.credit));
  const cSide = rows.map((r) => Math.max(0, r.credit - r.debit));
  const D = dSide.reduce((s, v) => s + v, 0), C = cSide.reduce((s, v) => s + v, 0);
  return (
    <>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Akun</th><th className="num">Debit</th><th className="num">Kredit</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.code}><td><span className="tnum text-muted">{r.code}</span> {r.name}</td><td className="num">{dSide[i] ? <Money v={dSide[i]} /> : ""}</td><td className="num">{cSide[i] ? <Money v={cSide[i]} /> : ""}</td></tr>
            ))}
            <tr className="font-bold"><td>TOTAL</td><td className="num"><Money v={D} /></td><td className="num"><Money v={C} /></td></tr>
          </tbody>
        </table>
      </div>
      <p className={`mt-3 text-sm font-semibold ${D === C ? "text-ok" : "text-bad"}`}>{D === C ? "✓ Debit = Kredit" : "⚠ Debit ≠ Kredit"}</p>
    </>
  );
}

async function Ledger({ from, to, acc }: { from: string; to: string; acc: number }) {
  const accounts = await q<{ id: number; code: string; name: string }>("select id, code, name from accounts order by code");
  const sel = acc || accounts.find((a) => a.code === "1101")?.id || accounts[0]?.id;
  const data = sel ? await ledgerFor(sel, from, to) : null;
  return (
    <>
      <div className="no-print -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {accounts.map((a) => (
          <Link key={a.id} href={`/keuangan/laporan/buku-besar?${new URLSearchParams({ from, to, acc: String(a.id) })}`} className="chip shrink-0" data-on={a.id === sel}>{a.code} {a.name}</Link>
        ))}
      </div>
      {data && (
        <div className="card overflow-x-auto">
          <p className="border-b border-line px-4 py-3 font-display font-semibold">{data.acc.code} · {data.acc.name}</p>
          <table className="table">
            <thead><tr><th>Tanggal</th><th>Keterangan</th><th className="num">Debit</th><th className="num">Kredit</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              <tr className="text-muted"><td colSpan={4}>Saldo awal</td><td className="num"><Money v={data.opening} /></td></tr>
              {data.lines.map((l, i) => (
                <tr key={i}><td className="whitespace-nowrap">{fmtDate(l.date, { short: true })}</td><td>{l.memo}</td><td className="num">{l.debit ? <Money v={l.debit} /> : ""}</td><td className="num">{l.credit ? <Money v={l.credit} /> : ""}</td><td className="num"><Money v={l.balance} /></td></tr>
              ))}
              <tr className="font-bold"><td colSpan={4}>Saldo akhir</td><td className="num"><Money v={data.closing} /></td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function Sales({ from, to }: { from: string; to: string }) {
  const s = await salesSummary(from, to);
  const omzet = s.byMethod.reduce((x, m) => x + m.total, 0);
  const days = Math.min(31, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const start = addDays(to, -(days - 1));
  const chart = Array.from({ length: days }, (_, i) => { const d = addDays(start, i); return { label: d.slice(8), value: s.byDay.find((x) => x.d === d)?.total ?? 0 }; });
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Pemasukan" value={rupiah(omzet)} tone="accent" />
        <Stat label="Sesi" value={s.sessions} />
        <Stat label="Rata-rata / sesi" value={rupiah(s.sessions ? Math.round(omzet / s.sessions) : 0)} />
      </div>
      <section className="card mb-4 p-4"><h3 className="font-display mb-2 font-semibold">Pemasukan harian</h3><BarChart data={chart} /></section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="font-display mb-3 font-semibold">Per paket</h3>
          <table className="table"><thead><tr><th>Paket</th><th className="num">Sesi</th><th className="num">Nilai booking</th></tr></thead>
            <tbody>{s.byPackage.map((p) => <tr key={p.name}><td>{p.name}</td><td className="num">{p.n}</td><td className="num"><Money v={p.total} /></td></tr>)}</tbody></table>
        </section>
        <section className="card p-4">
          <h3 className="font-display mb-3 font-semibold">Pemakaian ruang</h3>
          <table className="table"><thead><tr><th>Ruang</th><th className="num">Sesi</th><th className="num">Jam</th></tr></thead>
            <tbody>{s.byRoom.map((r) => <tr key={r.name}><td>{r.name}</td><td className="num">{r.n}</td><td className="num">{r.hours}</td></tr>)}</tbody></table>
        </section>
        <section className="card p-4 lg:col-span-2">
          <h3 className="font-display mb-3 font-semibold">Metode pembayaran</h3>
          {s.byMethod.length ? <HBars rows={s.byMethod.map((m) => ({ label: METHOD_LABEL[m.method] ?? m.method, value: m.total }))} /> : <p className="text-sm text-muted">Belum ada pembayaran.</p>}
        </section>
      </div>
    </>
  );
}
