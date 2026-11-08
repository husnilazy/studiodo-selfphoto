import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { addObligation, deleteObligation, payObligation } from "@/app/actions-hr";
import { rupiah, today } from "@/lib/format";
import { Empty, Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Hutang & piutang" };
type Ob = { id: number; kind: string; party: string; company_id: number | null; amount: number; paid: number; due: string | null; note: string };

export default async function Page() {
  const [f, user, rows] = await Promise.all([
    loadFacts(), currentUser(),
    q<Ob>("select id, kind, party, company_id, amount::bigint amount, paid::bigint paid, to_char(due,'YYYY-MM-DD') as due, note from obligations order by (amount = paid), due nulls last, id"),
  ]);
  const owner = user?.role === "owner";
  const t = today();
  const open = rows.filter((r) => Number(r.amount) > Number(r.paid));
  const left = (k: string) => open.filter((r) => r.kind === k).reduce((a, r) => a + Number(r.amount) - Number(r.paid), 0);
  const hutang = left("hutang"), piutang = left("piutang");
  const co = (id: number | null) => f.companies.find((c) => c.id === id)?.name;

  return (
    <>
      <PageHead title="Hutang & piutang" sub="Semua kewajiban dan tagihan di satu tempat: cicilan alat, hutang gaji, piutang proyek. Supaya posisi perusahaan jelas, tidak hanya kas." />
      <div className="statgrid grid-cols-2 lg:grid-cols-3">
        <Stat label="Total hutang (kita bayar)" value={rupiah(hutang)} tone={hutang > 0 ? "warn" : undefined} />
        <Stat label="Total piutang (kita tagih)" value={rupiah(piutang)} />
        <Stat label="Selisih bersih" value={rupiah(piutang - hutang)} tone={piutang - hutang < 0 ? "bad" : "ok"} sub="Piutang − hutang" />
      </div>

      {(["hutang", "piutang"] as const).map((k) => {
        const list = rows.filter((r) => r.kind === k);
        return (
          <section key={k} className="card card-pad mt-4">
            <SectionHead title={k === "hutang" ? "Hutang kita" : "Piutang kita"} />
            {list.length === 0 ? <p className="text-sm text-muted">Belum ada.</p> : (
              <ul className="divide-y divide-line text-sm">
                {list.map((r) => {
                  const rest = Number(r.amount) - Number(r.paid), late = rest > 0 && r.due && r.due < t;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span className="min-w-0"><b className="font-medium">{r.party}</b> <span className="text-xs text-muted">{co(r.company_id)}{r.due && ` · jatuh tempo ${r.due}`}</span>
                        {r.note && <span className="block text-xs text-muted">{r.note}</span>}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tnum">{rest > 0 ? <>sisa <b>{rupiah(rest)}</b> <span className="text-xs text-muted">dari {rupiah(Number(r.amount))}</span></> : <span className="text-muted">{rupiah(Number(r.amount))}</span>}</span>
                        {rest <= 0 ? <Pill tone="ok">lunas</Pill> : late ? <Pill tone="bad">lewat tempo</Pill> : null}
                        {owner && rest > 0 && <form action={payObligation} className="flex items-center gap-1"><input type="hidden" name="id" value={r.id} /><input name="amount" inputMode="numeric" defaultValue={rest} className="input !min-h-8 !w-28 tnum text-xs" /><button className="btn !min-h-8 text-xs">{k === "hutang" ? "Bayar" : "Terima"}</button></form>}
                        {owner && <form action={deleteObligation}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted hover:text-bad" aria-label="Hapus">✕</button></form>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {rows.length === 0 && <div className="mt-4"><Empty>Belum ada data.</Empty></div>}

      {owner && (
        <section className="card card-pad mt-4">
          <SectionHead title="Catat baru" note="“Bayar/Terima” hanya memperbarui sisa di sini. Catat arus kas aslinya di Transaksi supaya saldo ikut berubah." />
          <form action={addObligation} className="grid gap-3 sm:grid-cols-6">
            <Field label="Jenis"><select name="kind" className="input"><option value="hutang">Hutang (kita bayar)</option><option value="piutang">Piutang (kita tagih)</option></select></Field>
            <div className="sm:col-span-2"><Field label="Pihak"><input name="party" className="input" required placeholder="mis. Mas Iponk / Satpol PP" /></Field></div>
            <Field label="Unit"><select name="company" className="input" defaultValue=""><option value="">Semua</option>{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Nominal (Rp)"><input name="amount" inputMode="numeric" className="input tnum" required /></Field>
            <Field label="Jatuh tempo"><input type="date" name="due" className="input" /></Field>
            <div className="sm:col-span-5"><Field label="Catatan"><input name="note" className="input" /></Field></div>
            <div className="flex items-end"><button className="btn btn-primary w-full">Simpan</button></div>
          </form>
        </section>
      )}
    </>
  );
}
