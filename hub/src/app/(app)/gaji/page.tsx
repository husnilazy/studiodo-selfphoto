import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { loadFacts, sum } from "@/lib/metrics";
import { runPayroll, saveEmployee, toggleEmployee } from "@/app/actions";
import { fullMonth, rupiah } from "@/lib/format";
import { CompanyDot, Field, PageHead, Pill, Stat } from "@/components/ui";

export const metadata = { title: "Gaji & Tim" };
type E = { id: number; company_id: number; name: string; role: string; salary: number; active: boolean };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const emps = await q<E>("select id, company_id, name, role, salary, active from employees order by active desc, salary desc, id");
  const owner = user?.role === "owner";
  const total = emps.filter((e) => e.active).reduce((a, e) => a + Number(e.salary), 0);
  return (
    <>
      <PageHead title="Gaji & tim" sub="Daftar tim per unit. Satu klik mencatat gaji sebulan sebagai biaya (aman diulang). Totalnya juga dipakai di Proyeksi." />
      <div className="statgrid grid-cols-2 lg:grid-cols-3">
        <Stat label="Total gaji / bulan" value={rupiah(total)} />
        <Stat label="Karyawan aktif" value={String(emps.filter((e) => e.active).length)} />
        <Stat label={`Sudah dicatat ${fullMonth(f.now)}`} value={rupiah(sum(f.rows, { kind: "expense", category: "gaji", months: [f.now] }))} />
      </div>
      <div className="mt-5 space-y-4">
        {f.companies.map((c) => {
          const list = emps.filter((e) => e.company_id === c.id);
          const monthly = list.filter((e) => e.active).reduce((a, e) => a + Number(e.salary), 0);
          return (
            <section key={c.id} className="card card-pad">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display font-semibold"><CompanyDot color={c.color} />{c.name}<span className="text-sm font-normal text-muted">· {rupiah(monthly)}/bln</span></span>
                {owner && monthly > 0 && (
                  <form action={runPayroll} className="flex items-center gap-2">
                    <input type="hidden" name="company" value={c.id} />
                    <input name="month" type="month" defaultValue={f.now} className="input !min-h-9 !w-40 text-sm" />
                    <button className="btn btn-primary !min-h-9 text-xs">Catat gaji bulan ini</button>
                  </form>
                )}
              </div>
              {list.length === 0 ? <p className="text-sm text-muted">Belum ada karyawan di unit ini.</p> : (
                <ul className="divide-y divide-line">
                  {list.map((e) => (
                    <li key={e.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${e.active ? "" : "opacity-50"}`}>
                      <span><b>{e.name}</b> <span className="text-xs text-muted">{e.role}</span></span>
                      <span className="flex items-center gap-3"><span className="tnum">{rupiah(Number(e.salary))}</span>
                        {owner && <form action={toggleEmployee}><input type="hidden" name="id" value={e.id} /><button className="text-xs text-muted hover:text-fg">{e.active ? "Nonaktifkan" : "Aktifkan"}</button></form>}
                        {!e.active && <Pill tone="warn">nonaktif</Pill>}</span>
                    </li>
                  ))}
                </ul>
              )}
              {owner && (
                <form action={saveEmployee} className="mt-3 grid gap-2 sm:grid-cols-5">
                  <input type="hidden" name="company" value={c.id} />
                  <Field label="Nama"><input name="name" className="input" required /></Field>
                  <Field label="Peran"><input name="role" className="input" placeholder="mis. Fotografer" /></Field>
                  <Field label="Gaji / bulan"><input name="salary" inputMode="numeric" className="input tnum" placeholder="3000000" /></Field>
                  <div className="flex items-end sm:col-span-2"><button className="btn !min-h-10">+ Tambah karyawan</button></div>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
