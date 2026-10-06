import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { ActionButton } from "@/components/ActionForm";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate, monthEnd, monthStart, rupiah, todayWIB } from "@/lib/format";
import { voidManualJournal } from "@/app/actions/finance";
import JournalForm from "./JournalForm";

export const metadata = { title: "Jurnal" };

type J = { id: number; date: string; memo: string; ref_type: string; voided: boolean };
type L = { journal_id: number; code: string; name: string; debit: number; credit: number };
const REF: Record<string, string> = { payment: "Pembayaran", expense: "Pengeluaran", cash: "Kas", manual: "Manual", asset: "Aset", depreciation: "Penyusutan" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; v?: string }> }) {
  await requireUser(["owner"]);
  const sp = await searchParams;
  const today = todayWIB();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : monthStart(today);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : monthEnd(today);
  const showVoid = sp.v === "1";
  const [journals, accounts] = await Promise.all([
    q<J>("select id, date, memo, ref_type, voided from journals where date >= $1 and date <= $2 and ($3 or not voided) order by date desc, id desc limit 300", [from, to, showVoid]),
    q<{ id: number; code: string; name: string }>("select id, code, name from accounts where active order by code"),
  ]);
  const lines = journals.length
    ? await q<L>("select l.journal_id, a.code, a.name, l.debit, l.credit from journal_lines l join accounts a on a.id = l.account_id where l.journal_id = any($1) order by l.id", [journals.map((j) => j.id)])
    : [];

  return (
    <>
      <PageHeader title="Jurnal Umum" subtitle="Semua pencatatan akuntansi. Transaksi booking, pengeluaran, dan aset dijurnal otomatis."
        actions={<Sheet title="Jurnal Manual" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Jurnal Manual</button>}><JournalForm accounts={accounts} today={today} /></Sheet>} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="block"><span className="label">Dari</span><input type="date" name="from" defaultValue={from} className="input" /></label>
        <label className="block"><span className="label">Sampai</span><input type="date" name="to" defaultValue={to} className="input" /></label>
        <label className="flex min-h-[2.9rem] items-center gap-2 text-sm font-semibold"><input type="checkbox" name="v" value="1" defaultChecked={showVoid} className="size-5 accent-[var(--accent)]" /> Tampilkan yang dibatalkan</label>
        <button className="btn">Terapkan</button>
      </form>
      {journals.length === 0 ? <Empty title="Tidak ada jurnal" hint="Ubah rentang tanggal." /> : (
        <div className="space-y-3">
          {journals.map((j) => (
            <section key={j.id} className={`card anim-rise overflow-hidden ${j.voided ? "opacity-50" : ""}`}>
              <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel2 px-4 py-2.5">
                <span className="text-xs font-bold text-muted">#{j.id} · {fmtDate(j.date, { short: true })}</span>
                <Badge tone={j.ref_type === "manual" ? "indigo" : "slate"}>{REF[j.ref_type] ?? j.ref_type}</Badge>
                {j.voided && <Badge tone="red">Dibatalkan</Badge>}
                <span className="min-w-0 flex-1 basis-40 truncate text-sm font-semibold">{j.memo}</span>
                {!j.voided && ["manual", "cash", "depreciation"].includes(j.ref_type) && (
                  <ActionButton action={voidManualJournal.bind(null, j.id)} confirm="Batalkan jurnal ini?" className="btn btn-sm btn-danger">Batalkan</ActionButton>
                )}
              </header>
              <table className="table !text-sm">
                <tbody>
                  {lines.filter((l) => l.journal_id === j.id).map((l, i) => (
                    <tr key={i}>
                      <td className={l.credit > 0 ? "!pl-8" : ""}><span className="tnum text-muted">{l.code}</span> {l.name}</td>
                      <td className="num">{l.debit > 0 ? rupiah(l.debit) : ""}</td>
                      <td className="num">{l.credit > 0 ? rupiah(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
