import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { listEmployees, PAY_TYPE_LABEL, weeksIn } from "@/lib/payroll";
import { createAllPayslips, saveEmployee } from "@/app/actions-hr";
import { addMonths, fullMonth, rupiah, thisMonth } from "@/lib/format";
import { CompanyDot, Empty, Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Gaji & Tim" };

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.p ?? "") ? sp.p! : thisMonth();
  const [f, user, emps, slips] = await Promise.all([
    loadFacts(), currentUser(), listEmployees(),
    q<{ employee_id: number; id: number; net: number; status: string }>("select employee_id, id, net::bigint as net, status from payslips where period = $1", [thisMonthOr(sp.p)]),
  ]);
  const owner = user?.role === "owner";
  const active = emps.filter((e) => e.active);
  const monthly = active.reduce((a, e) => a + (e.pay_type === "monthly" ? e.salary : e.pay_type === "weekly" ? e.salary * weeksIn(period) : 0), 0);
  const slipBy = new Map(slips.map((s) => [s.employee_id, s]));
  const paid = slips.filter((s) => s.status === "dibayar").reduce((a, s) => a + Number(s.net), 0);

  return (
    <>
      <PageHead title="Gaji & tim" sub="Gaji pokok bulanan atau mingguan, bonus dan fee proyek, lalu slip gaji otomatis. Slip yang ditandai dibayar tercatat sebagai biaya gaji di unitnya." />
      <div className="mb-5 flex items-center gap-2 text-sm">
        <Link className="btn !min-h-8" href={`/gaji?p=${addMonths(period, -1)}`}>←</Link>
        <b className="min-w-28 text-center font-display">{fullMonth(period)}</b>
        <Link className="btn !min-h-8" href={`/gaji?p=${addMonths(period, 1)}`}>→</Link>
      </div>
      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat label="Karyawan aktif" value={String(active.length)} />
        <Stat label={`Gaji pokok ${fullMonth(period)}`} value={rupiah(monthly)} sub="Bulanan + mingguan × jumlah gajian" />
        <Stat label="Slip dibuat" value={`${slips.length} / ${active.length}`} />
        <Stat label="Sudah dibayar" value={rupiah(paid)} />
      </div>

      {owner && (
        <form action={createAllPayslips} className="card card-pad mt-4 flex flex-wrap items-center justify-between gap-3">
          <div><b className="font-display">Buat slip semua karyawan</b><p className="text-xs text-muted">Menghitung gaji pokok + bonus/fee/potongan yang tercatat di {fullMonth(period)}. Yang sudah punya slip dilewati.</p></div>
          <input type="hidden" name="period" value={period} />
          <button className="btn btn-primary">Buat slip {fullMonth(period)}</button>
        </form>
      )}

      <div className="mt-5 space-y-4">
        {f.companies.map((c) => {
          const list = emps.filter((e) => e.company_id === c.id);
          return (
            <section key={c.id} className="card card-pad">
              <SectionHead title={c.name} right={<span className="inline-flex items-center gap-2 text-xs text-muted"><CompanyDot color={c.color} />{list.filter((e) => e.active).length} aktif</span>} />
              {list.length === 0 ? <p className="text-sm text-muted">Belum ada karyawan di unit ini.</p> : (
                <ul className="divide-y divide-line">
                  {list.map((e) => {
                    const sl = slipBy.get(e.id);
                    return (
                      <li key={e.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 text-sm ${e.active ? "" : "opacity-50"}`}>
                        <Link href={`/gaji/${e.id}`} className="min-w-0">
                          <b className="font-medium hover:underline">{e.name}</b> <span className="text-xs text-muted">{e.position || e.role}</span>
                          <div className="text-xs text-muted">{PAY_TYPE_LABEL[e.pay_type]}{e.pay_type !== "freelance" && ` · ${rupiah(e.salary)}${e.pay_type === "weekly" ? "/minggu" : "/bulan"}`}</div>
                        </Link>
                        <span className="flex items-center gap-2">
                          {!e.active && <Pill tone="warn">nonaktif</Pill>}
                          {sl ? <Link href={`/slip/${sl.id}`}><Pill tone={sl.status === "dibayar" ? "ok" : "info"}>Slip {sl.status === "dibayar" ? "dibayar" : "draft"} · {rupiah(Number(sl.net))}</Pill></Link> : e.active && <Pill>belum ada slip</Pill>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {emps.length === 0 && <Empty>Belum ada karyawan.</Empty>}
      </div>

      {owner && (
        <section className="card card-pad mt-5">
          <SectionHead title="Tambah karyawan / freelance" note="Data lengkap (rekening, kontak, dll.) bisa diisi di halaman detail tiap karyawan." />
          <form action={saveEmployee} className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2"><Field label="Nama"><input name="name" className="input" required /></Field></div>
            <Field label="Unit"><select name="company" className="input">{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Jabatan"><input name="position" className="input" placeholder="mis. Admin" /></Field>
            <Field label="Jenis gaji"><select name="pay_type" className="input" defaultValue="monthly"><option value="monthly">Bulanan</option><option value="weekly">Mingguan</option><option value="freelance">Freelance (fee proyek)</option></select></Field>
            <Field label="Gaji pokok (Rp)"><input name="salary" inputMode="numeric" className="input tnum" placeholder="1000000" /></Field>
            <div className="sm:col-span-6"><button className="btn btn-primary">Tambah</button></div>
          </form>
        </section>
      )}
    </>
  );
}

function thisMonthOr(p?: string) { return /^\d{4}-\d{2}$/.test(p ?? "") ? p! : thisMonth(); }
