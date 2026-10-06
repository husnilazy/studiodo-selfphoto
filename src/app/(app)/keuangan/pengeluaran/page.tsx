import Link from "next/link";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { ActionButton } from "@/components/ActionForm";
import { ExpenseForm } from "@/components/FinanceForms";
import { HBars } from "@/components/charts";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { addMonths, fmtDate, fmtMonth, monthEnd, monthStart, rupiah, todayWIB } from "@/lib/format";
import { voidExpense } from "@/app/actions/finance";

export const metadata = { title: "Pengeluaran" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser(["owner", "admin"]);
  const today = todayWIB();
  const m = /^\d{4}-\d{2}$/.test((await searchParams).m ?? "") ? (await searchParams).m! : today.slice(0, 7);
  const first = `${m}-01`;
  const rows = await q<{ id: number; date: string; vendor: string; note: string; amount: number; receipt_url: string; category: string; source: string; voided: boolean }>(
    `select e.id, e.date, e.vendor, e.note, e.amount, e.receipt_url, e.voided, a.name as category, s.name as source
       from expenses e join accounts a on a.id = e.account_id join accounts s on s.id = e.paid_from_account_id
      where e.date >= $1 and e.date <= $2 order by e.date desc, e.id desc`, [monthStart(first), monthEnd(first)]);
  const live = rows.filter((r) => !r.voided);
  const total = live.reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, number>();
  for (const r of live) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);

  return (
    <>
      <PageHeader title="Pengeluaran" subtitle="Catat biaya operasional & pembelian harian."
        actions={<Sheet title="Catat Pengeluaran" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Catat</button>}><ExpenseForm /></Sheet>} />
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/keuangan/pengeluaran?m=${addMonths(first, -1).slice(0, 7)}`} className="btn !px-3" aria-label="Bulan sebelumnya"><Icon name="left" className="size-4" /></Link>
        <p className="font-display flex-1 text-center font-semibold">{fmtMonth(first)}</p>
        <Link href={`/keuangan/pengeluaran?m=${addMonths(first, 1).slice(0, 7)}`} className="btn !px-3" aria-label="Bulan berikutnya"><Icon name="right" className="size-4" /></Link>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Total pengeluaran" value={rupiah(total)} hint={`${live.length} transaksi`} tone="bad" icon="wallet" />
        <div className="card p-4">
          <p className="mb-3 text-xs font-semibold text-muted">Per kategori</p>
          {byCat.size === 0 ? <p className="text-sm text-muted">—</p> : <HBars rows={[...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }))} />}
        </div>
      </div>
      {rows.length === 0 ? <Empty title="Belum ada pengeluaran" hint="Catat pembelian kertas, listrik, sewa, gaji, dan biaya lainnya." /> : (
        <div className="card divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 p-4 ${r.voided ? "opacity-45" : ""}`}>
              <div className="min-w-0 flex-1 basis-48">
                <p className={`truncate font-semibold ${r.voided ? "line-through" : ""}`}>{r.category}{r.vendor && ` · ${r.vendor}`}</p>
                <p className="truncate text-xs text-muted">{fmtDate(r.date, { short: true })} · dari {r.source}{r.note && ` · ${r.note}`}{r.voided && " · dibatalkan"}</p>
              </div>
              <span className="tnum font-bold">{rupiah(r.amount)}</span>
              {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" aria-label="Lihat nota"><Icon name="external" className="size-4" /></a>}
              {!r.voided && <ActionButton action={voidExpense.bind(null, r.id)} confirm="Batalkan pengeluaran ini? Jurnalnya ikut dibatalkan." className="btn btn-sm btn-danger">Batalkan</ActionButton>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
