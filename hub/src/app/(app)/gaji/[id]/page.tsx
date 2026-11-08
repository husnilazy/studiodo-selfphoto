import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { EMP_COLS, ITEM_KIND, PAY_TYPE_LABEL, weeksIn, type Emp, type PayItem, type Slip } from "@/lib/payroll";
import { addPayItem, createPayslip, deletePayItem, deletePayslip, markPayslipPaid, saveEmployee, toggleEmployee } from "@/app/actions-hr";
import { fullMonth, rupiah, thisMonth, today } from "@/lib/format";
import { Field, PageHead, Pill, SectionHead } from "@/components/ui";

export const metadata = { title: "Detail karyawan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eid = Number(id);
  const [f, user, emps] = await Promise.all([loadFacts(), currentUser(), q<Emp>(`select ${EMP_COLS} from employees where id = $1`, [eid])]);
  const emp = emps[0];
  if (!emp) notFound();
  emp.salary = Number(emp.salary);
  const [items, slips] = await Promise.all([
    q<PayItem>("select id, employee_id, to_char(date,'YYYY-MM-DD') as date, kind, amount::bigint as amount, project, note, payslip_id from pay_items where employee_id = $1 order by date desc, id desc limit 60", [eid]),
    q<Slip>("select id, employee_id, company_id, period, base::bigint base, weeks, bonus::bigint bonus, fee::bigint fee, deduction::bigint deduction, net::bigint net, status, to_char(paid_on,'YYYY-MM-DD') as paid_on, tx_id, note, created_at from payslips where employee_id = $1 order by period desc", [eid]),
  ]);
  const owner = user?.role === "owner";
  const company = f.companies.find((c) => c.id === emp.company_id);
  const period = thisMonth();

  return (
    <>
      <PageHead title={emp.name} sub={`${emp.position || emp.role || "Karyawan"} · ${company?.name ?? ""} · ${PAY_TYPE_LABEL[emp.pay_type]}${emp.pay_type !== "freelance" ? ` ${rupiah(emp.salary)}${emp.pay_type === "weekly" ? "/minggu" : "/bulan"}` : ""}`}
        right={<Link href="/gaji" className="btn !min-h-9 text-xs">← Semua karyawan</Link>} />

      <section className="card card-pad">
        <SectionHead title="Slip gaji" note="Slip dihitung dari gaji pokok + bonus/fee − potongan pada bulan itu." />
        {owner && (
          <form action={createPayslip} className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="employee" value={emp.id} />
            <Field label="Periode"><input type="month" name="period" defaultValue={period} className="input" /></Field>
            {emp.pay_type === "weekly" && <Field label="Jumlah gajian"><input name="weeks" type="number" min={1} max={5} defaultValue={weeksIn(period)} className="input !w-24" /></Field>}
            <button className="btn btn-primary">Buat slip</button>
          </form>
        )}
        {slips.length === 0 ? <p className="text-sm text-muted">Belum ada slip.</p> : (
          <ul className="divide-y divide-line">
            {slips.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><b className="font-medium">{fullMonth(s.period)}</b> <span className="tnum text-muted">· bersih {rupiah(Number(s.net))}</span></span>
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone={s.status === "dibayar" ? "ok" : "info"}>{s.status === "dibayar" ? `Dibayar ${s.paid_on}` : "Draft"}</Pill>
                  <Link href={`/slip/${s.id}`} className="btn !min-h-8 text-xs">Lihat</Link> <a href={`/api/pdf/slip/${s.id}?dl=1`} download className="btn btn-primary !min-h-8 text-xs">PDF</a>
                  {owner && s.status !== "dibayar" && (
                    <form action={markPayslipPaid} className="flex items-center gap-1"><input type="hidden" name="id" value={s.id} /><input type="date" name="date" defaultValue={today()} className="input !min-h-8 !w-36 text-xs" /><button className="btn btn-primary !min-h-8 text-xs">Tandai dibayar</button></form>
                  )}
                  {owner && <form action={deletePayslip}><input type="hidden" name="id" value={s.id} /><button className="btn btn-danger !min-h-8 text-xs">Hapus</button></form>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Bonus, fee proyek, potongan" note="Dicatat di sini lalu otomatis masuk slip bulan tanggalnya." />
        {owner && (
          <form action={addPayItem} className="mb-4 grid gap-3 sm:grid-cols-6">
            <input type="hidden" name="employee" value={emp.id} />
            <Field label="Jenis"><select name="kind" className="input" defaultValue="fee_proyek">{Object.entries(ITEM_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field label="Nominal (Rp)"><input name="amount" inputMode="numeric" className="input tnum" required /></Field>
            <Field label="Tanggal"><input type="date" name="date" defaultValue={today()} className="input" /></Field>
            <Field label="Proyek"><input name="project" className="input" placeholder="mis. Satpol PP" /></Field>
            <Field label="Catatan"><input name="note" className="input" /></Field>
            <div className="flex items-end"><button className="btn btn-primary w-full">Tambah</button></div>
          </form>
        )}
        {items.length === 0 ? <p className="text-sm text-muted">Belum ada.</p> : (
          <ul className="divide-y divide-line text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><b className="font-medium">{ITEM_KIND[i.kind]?.label ?? i.kind}</b> <span className="text-muted">{i.project && `· ${i.project} `}{i.note && `· ${i.note}`} · {i.date}</span></span>
                <span className="flex items-center gap-2">
                  <span className={`tnum font-medium ${ITEM_KIND[i.kind]?.sign === -1 ? "text-bad" : "text-ok"}`}>{ITEM_KIND[i.kind]?.sign === -1 ? "−" : "+"}{rupiah(Number(i.amount))}</span>
                  {i.payslip_id ? <Pill tone="info">di slip</Pill> : owner && <form action={deletePayItem}><input type="hidden" name="id" value={i.id} /><button className="text-xs text-muted hover:text-bad" aria-label="Hapus">✕</button></form>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {owner && (
        <section className="card card-pad mt-4">
          <SectionHead title="Data karyawan" note="Dipakai di slip gaji. Isi bertahap; yang kosong tidak ditampilkan." right={
            <form action={toggleEmployee}><input type="hidden" name="id" value={emp.id} /><button className="btn !min-h-8 text-xs">{emp.active ? "Nonaktifkan" : "Aktifkan"}</button></form>} />
          <form action={saveEmployee} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={emp.id} />
            <Field label="Nama"><input name="name" defaultValue={emp.name} className="input" required /></Field>
            <Field label="Unit"><select name="company" defaultValue={emp.company_id} className="input">{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Jabatan"><input name="position" defaultValue={emp.position || emp.role} className="input" /></Field>
            <Field label="Jenis gaji"><select name="pay_type" defaultValue={emp.pay_type} className="input"><option value="monthly">Bulanan</option><option value="weekly">Mingguan</option><option value="freelance">Freelance (fee proyek)</option></select></Field>
            <Field label="Gaji pokok (Rp)"><input name="salary" inputMode="numeric" defaultValue={emp.salary} className="input tnum" /></Field>
            <Field label="Tanggal masuk"><input type="date" name="join_date" defaultValue={emp.join_date ?? ""} className="input" /></Field>
            <Field label="No. HP / WhatsApp"><input name="phone" defaultValue={emp.phone} className="input" /></Field>
            <Field label="Bank"><input name="bank_name" defaultValue={emp.bank_name} className="input" placeholder="mis. BCA" /></Field>
            <Field label="No. rekening"><input name="bank_account" defaultValue={emp.bank_account} className="input" /></Field>
            <Field label="No. identitas (KTP)"><input name="id_number" defaultValue={emp.id_number} className="input" /></Field>
            <Field label="Kontak darurat"><input name="emergency_contact" defaultValue={emp.emergency_contact} className="input" /></Field>
            <Field label="Alamat"><input name="address" defaultValue={emp.address} className="input" /></Field>
            <div className="sm:col-span-3"><Field label="Catatan"><textarea name="notes" defaultValue={emp.notes} className="input" rows={2} /></Field></div>
            <div className="sm:col-span-3"><button className="btn btn-primary">Simpan data</button></div>
          </form>
        </section>
      )}
    </>
  );
}
