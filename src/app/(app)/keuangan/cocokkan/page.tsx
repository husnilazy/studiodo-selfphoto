import ActionForm, { ActionButton } from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate, rupiah, todayWIB } from "@/lib/format";
import { settleQris, voidManualJournal } from "@/app/actions/finance";
import AdjustForm from "./AdjustForm";

export const metadata = { title: "Cocokkan Saldo" };

export default async function Page() {
  await requireUser(["owner"]);
  const today = todayWIB();
  const [accts, hist] = await Promise.all([
    q<{ id: number; code: string; name: string; book: number }>(
      `select a.id, a.code, a.name, coalesce(sum(l.debit - l.credit) filter (where not j.voided), 0) as book
         from accounts a left join journal_lines l on l.account_id = a.id left join journals j on j.id = l.journal_id
        where a.subtype = 'cash' and a.active group by a.id order by a.code`),
    q<{ id: number; date: string; memo: string; voided: boolean; amount: number }>(
      `select j.id, j.date, j.memo, j.voided, (select sum(debit) from journal_lines where journal_id = j.id) as amount
         from journals j where j.ref_type = 'adjustment' order by j.date desc, j.id desc limit 15`),
  ]);
  const total = accts.reduce((s, a) => s + Number(a.book), 0);

  return (
    <>
      <PageHeader title="Cocokkan Saldo" subtitle="Samakan saldo di aplikasi dengan uang yang benar-benar ada: laci kas, rekening bank, dan saldo QRIS/e-wallet." />

      <section className="card anim-rise mb-4 p-4 text-sm sm:p-5">
        <h2 className="font-display mb-2 font-semibold">Kenapa saldo bisa beda?</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li><b className="text-fg">Aplikasi dipakai belakangan.</b> Uang yang sudah ada sebelum hari pertama belum tercatat. Catat sebagai <b>saldo awal</b> per akun.</li>
          <li><b className="text-fg">QRIS belum dicairkan.</b> Pembayaran QRIS masuk ke akun QRIS dulu; saat dana cair ke bank, catat lewat <b>Pencairan QRIS</b> di bawah (potongan MDR otomatis jadi biaya).</li>
          <li><b className="text-fg">Biaya admin bank</b> atau transaksi pribadi lewat rekening yang sama belum dicatat.</li>
        </ul>
        <p className="mt-2 text-xs text-muted">Setiap penyesuaian dicatat sebagai jurnal yang bisa dibatalkan, jadi aman dicoba.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {accts.map((a) => (
          <section key={a.id} className="card anim-rise p-4 sm:p-5">
            <div className="mb-3">
              <div className="text-xs font-semibold text-muted">{a.name}</div>
              <div className="font-display tnum text-2xl font-semibold">{rupiah(Number(a.book))}</div>
              <div className="text-xs text-muted">saldo menurut buku</div>
            </div>
            <AdjustForm id={a.id} name={a.name} book={Number(a.book)} today={today} others={accts.filter((x) => x.id !== a.id).map((x) => ({ id: x.id, name: x.name }))} />
          </section>
        ))}
      </div>
      <p className="mt-2 text-right text-xs text-muted">Total kas & bank menurut buku: <b className="tnum text-fg">{rupiah(total)}</b></p>

      <section className="card anim-rise mt-4 p-4 sm:p-5">
        <h2 className="font-display mb-1 font-semibold">Pencairan QRIS / e-wallet ke bank</h2>
        <p className="mb-3 text-xs text-muted">Catat setiap dana QRIS cair ke rekening. Isi nominal kotor (sebelum potongan) dan potongan MDR bila ada.</p>
        <ActionForm action={settleQris} submit="Catat pencairan">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Dari"><select name="from_id" className="input" defaultValue={accts.find((a) => a.code === "1103")?.id}>{accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <Field label="Ke"><select name="to_id" className="input" defaultValue={accts.find((a) => a.code === "1102")?.id}>{accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <Field label="Nominal kotor"><MoneyInput name="gross" required /></Field>
            <Field label="Potongan / MDR"><MoneyInput name="fee" /></Field>
            <Field label="Tanggal"><input type="date" name="date" className="input" defaultValue={today} required /></Field>
            <div className="sm:col-span-3"><Field label="Catatan"><input name="note" className="input" placeholder="mis. settlement QRIS 5–8 Nov" /></Field></div>
          </div>
        </ActionForm>
      </section>

      <section className="card anim-rise mt-4 p-4 sm:p-5">
        <h2 className="font-display mb-2 font-semibold">Riwayat penyesuaian</h2>
        {hist.length === 0 ? <Empty title="Belum ada penyesuaian" hint="Penyesuaian dan pencairan yang kamu catat tampil di sini." /> : (
          <ul className="divide-y divide-line">
            {hist.map((h) => (
              <li key={h.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${h.voided ? "opacity-50" : ""}`}>
                <span className="min-w-0"><span className="block truncate font-semibold">{h.memo}</span><span className="text-xs text-muted">{fmtDate(h.date, { short: true })} · #{h.id}</span></span>
                <span className="flex items-center gap-2">
                  {h.voided ? <Badge tone="red">Dibatalkan</Badge> : <ActionButton action={voidManualJournal.bind(null, h.id)} confirm="Batalkan penyesuaian ini?" className="btn btn-sm btn-danger">Batalkan</ActionButton>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
