import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { addObligation, deleteObligation, payObligation } from "@/app/actions-hr";
import { rupiah, today, fullMonth } from "@/lib/format";
import { listEmployees } from "@/lib/payroll";
import Link from "next/link";
import { Empty, Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Hutang & piutang" };
type Ob = { id: number; kind: string; party: string; company_id: number | null; amount: number; paid: number; due: string | null; note: string; employee_id: number | null; period: string | null };

export default async function Page() {
  const [f, user, rows, emps, drafts] = await Promise.all([
    loadFacts(), currentUser(),
    q<Ob>("select id, kind, party, company_id, amount::bigint amount, paid::bigint paid, to_char(due,'YYYY-MM-DD') as due, note, employee_id, period from obligations order by (amount = paid), period nulls last, due nulls last, id"),
    listEmployees(),
    q<{ id: number; period: string; net: number; name: string }>("select s.id, s.period, s.net::bigint as net, e.name from payslips s join employees e on e.id = s.employee_id where s.status <> 'dibayar' and s.net > 0 order by s.period, e.name"),
  ]);
  const owner = user?.role === "owner";
  const t = today();
  const open = rows.filter((r) => Number(r.amount) > Number(r.paid));
  const left = (k: string) => open.filter((r) => r.kind === k).reduce((a, r) => a + Number(r.amount) - Number(r.paid), 0);
  const hutang = left("hutang"), piutang = left("piutang");
  const co = (id: number | null) => f.companies.find((c) => c.id === id)?.name;
  // Hutang gaji per orang (hutang yang terikat karyawan) + slip yang dibuat tetapi belum dibayar.
  const wageOpen = open.filter((r) => r.kind === "hutang" && r.employee_id);
  const byPerson = new Map<string, number>();
  for (const r of wageOpen) byPerson.set(r.party, (byPerson.get(r.party) ?? 0) + Number(r.amount) - Number(r.paid));
  const wageLeft = wageOpen.reduce((a, r) => a + Number(r.amount) - Number(r.paid), 0);
  const draftTotal = drafts.reduce((a, d) => a + Number(d.net), 0);

  return (
    <>
      <PageHead title="Hutang & piutang" sub="Semua kewajiban dan tagihan di satu tempat: cicilan alat, hutang gaji, piutang proyek. Supaya posisi perusahaan jelas, tidak hanya kas." />
      <div className="statgrid grid-cols-2 lg:grid-cols-3">
        <Stat label="Total hutang (kita bayar)" value={rupiah(hutang)} tone={hutang > 0 ? "warn" : undefined} />
        <Stat label="Total piutang (kita tagih)" value={rupiah(piutang)} />
        <Stat label="Selisih bersih" value={rupiah(piutang - hutang)} tone={piutang - hutang < 0 ? "bad" : "ok"} sub="Piutang − hutang" />
      </div>

      {(wageLeft > 0 || drafts.length > 0) && (
        <section className="card card-pad mt-4">
          <SectionHead title="Hutang gaji" note="Cicilan yang dibayar dari sini otomatis tercatat sebagai biaya gaji & mengurangi kas unit." />
          {wageLeft > 0 && (
            <ul className="divide-y divide-line text-sm">
              {[...byPerson.entries()].map(([name, v]) => (
                <li key={name} className="flex items-center justify-between py-2"><span>{name}</span><b className="tnum">{rupiah(v)}</b></li>
              ))}
              <li className="flex items-center justify-between py-2 font-display"><span>Total hutang gaji</span><b className="tnum">{rupiah(wageLeft)}</b></li>
            </ul>
          )}
          {drafts.length > 0 && (
            <div className={wageLeft > 0 ? "mt-4" : ""}>
              <p className="mb-1 text-xs text-muted">Slip sudah dibuat tetapi belum ditandai dibayar ({rupiah(draftTotal)}). Belum dihitung ke total hutang di atas.</p>
              <ul className="divide-y divide-line text-sm">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2"><Link href={`/slip/${d.id}`} className="hover:underline">{d.name} · {fullMonth(d.period)}</Link><span className="tnum">{rupiah(Number(d.net))}</span></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

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
                      <span className="min-w-0"><b className="font-medium">{r.party}</b> <span className="text-xs text-muted">{co(r.company_id)}{r.period && ` · gaji ${fullMonth(r.period)}`}{r.due && ` · jatuh tempo ${r.due}`}</span>
                        {r.note && <span className="block text-xs text-muted">{r.note}</span>}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tnum">{rest > 0 ? <>sisa <b>{rupiah(rest)}</b> <span className="text-xs text-muted">dari {rupiah(Number(r.amount))}</span></> : <span className="text-muted">{rupiah(Number(r.amount))}</span>}</span>
                        {rest <= 0 ? <Pill tone="ok">lunas</Pill> : late ? <Pill tone="bad">lewat tempo</Pill> : null}
                        {owner && rest > 0 && <form action={payObligation} className="flex items-center gap-1"><input type="hidden" name="id" value={r.id} />{r.employee_id && <input type="date" name="date" defaultValue={t} className="input !min-h-8 !w-36 text-xs" aria-label="Tanggal bayar" />}<input name="amount" inputMode="numeric" defaultValue={rest} className="input !min-h-8 !w-28 tnum text-xs" /><button className="btn !min-h-8 text-xs">{k === "hutang" ? "Bayar" : "Terima"}</button></form>}
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
          <SectionHead title="Catat baru" note="Hutang gaji: pilih karyawan & periode, maka tiap pembayaran otomatis jadi biaya gaji. Hutang/piutang lain: “Bayar/Terima” hanya memperbarui sisa; catat arus kasnya di Transaksi." />
          <form action={addObligation} className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-3"><Field label="Hutang gaji untuk (opsional)"><select name="employee" className="input" defaultValue=""><option value="">— bukan hutang gaji —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}{e.active ? "" : " (nonaktif)"}</option>)}</select></Field></div>
            <div className="sm:col-span-3"><Field label="Periode gaji"><input type="month" name="period" className="input" /></Field></div>
            <Field label="Jenis"><select name="kind" className="input"><option value="hutang">Hutang (kita bayar)</option><option value="piutang">Piutang (kita tagih)</option></select></Field>
            <div className="sm:col-span-2"><Field label="Pihak"><input name="party" className="input" placeholder="mis. Mas Iponk (kosong jika hutang gaji)" /></Field></div>
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
