import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { q } from "@/lib/db";
import { isTeam, requireUser } from "@/lib/auth";
import { EMP_COLS, ITEM_KIND, PAY_TYPE_LABEL, type Emp, type PayItem, type Slip } from "@/lib/payroll";
import { fullMonth, rupiah } from "@/lib/format";
import { terbilang } from "@/lib/terbilang";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Slip gaji" };

/** Slip gaji berbentuk kertas (putih, siap cetak/PDF). Owner & partner melihat semua; karyawan hanya slip miliknya. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [sl] = await q<Slip>("select id, employee_id, company_id, period, base::bigint base, weeks, bonus::bigint bonus, fee::bigint fee, deduction::bigint deduction, net::bigint net, status, to_char(paid_on,'YYYY-MM-DD') as paid_on, tx_id, note, created_at from payslips where id = $1", [Number(id)]);
  if (!sl) notFound();
  if (!isTeam(user) && !(user.role === "karyawan" && user.employeeId === sl.employee_id)) redirect("/saya");
  const [[emp], [co], items] = await Promise.all([
    q<Emp>(`select ${EMP_COLS} from employees where id = $1`, [sl.employee_id]),
    q<{ name: string; slug: string; kind: string }>("select name, slug, kind from companies where id = $1", [sl.company_id]),
    q<PayItem>("select id, employee_id, to_char(date,'YYYY-MM-DD') as date, kind, amount::bigint as amount, project, note, payslip_id from pay_items where payslip_id = $1 order by date, id", [sl.id]),
  ]);
  const no = `SG-${sl.period.replace("-", "")}-${String(sl.id).padStart(4, "0")}`;
  const net = Number(sl.net);
  const plus = items.filter((i) => ITEM_KIND[i.kind]?.sign === 1), minus = items.filter((i) => ITEM_KIND[i.kind]?.sign === -1);
  const row = (label: string, v: number, sub?: string) => (
    <tr key={label + v}><td className="py-1.5 pr-4">{label}{sub && <span className="block text-xs text-neutral-500">{sub}</span>}</td><td className="py-1.5 text-right tnum">{rupiah(v)}</td></tr>
  );

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={isTeam(user) ? `/gaji/${sl.employee_id}` : "/saya"} className="btn !min-h-9 text-xs">← Kembali</Link>
        <span className="flex flex-wrap items-center gap-2">
          <a href={`/api/pdf/slip/${sl.id}`} target="_blank" rel="noreferrer" className="btn">Lihat PDF</a>
          <a href={`/api/pdf/slip/${sl.id}?dl=1`} download className="btn btn-primary">Unduh PDF</a>
          <PrintButton label="Cetak" />
        </span>
      </div>
      {/* Kertas: selalu putih agar jelas saat dicetak, apa pun tema aplikasi */}
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow-xl print:rounded-none print:shadow-none md:p-10">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-5">
          <div>
            {co.slug === "frameless" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo-black.png" alt="Frameless Creative" className="h-5 w-auto" />
            ) : <b className="text-lg tracking-tight">{co.name}</b>}
            <p className="mt-2 text-xs text-neutral-500">{co.name}{co.slug === "frameless" ? "" : ` · ${co.kind}`}</p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold tracking-wide">SLIP GAJI</h1>
            <p className="text-xs text-neutral-500">{no}</p>
            <p className="text-xs text-neutral-500">Periode {fullMonth(sl.period)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-neutral-200 py-4 text-xs">
          <p><span className="text-neutral-500">Nama</span><br /><b className="text-sm">{emp.name}</b></p>
          <p><span className="text-neutral-500">Jabatan</span><br />{emp.position || emp.role || "—"}</p>
          <p><span className="text-neutral-500">Jenis gaji</span><br />{PAY_TYPE_LABEL[emp.pay_type]}</p>
          <p><span className="text-neutral-500">Status</span><br />{sl.status === "dibayar" ? `Dibayar ${sl.paid_on}` : "Belum dibayar (draft)"}</p>
          {emp.bank_account && <p className="col-span-2"><span className="text-neutral-500">Rekening</span><br />{emp.bank_name} {emp.bank_account}</p>}
        </section>

        <table className="mt-4 w-full">
          <tbody>
            <tr><td colSpan={2} className="pb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Pendapatan</td></tr>
            {Number(sl.base) > 0 && row(emp.pay_type === "weekly" ? `Gaji pokok mingguan (${sl.weeks} × ${rupiah(emp.salary)})` : "Gaji pokok", Number(sl.base))}
            {plus.map((i) => row(ITEM_KIND[i.kind].label, Number(i.amount), [i.project, i.note, i.date].filter(Boolean).join(" · ")))}
            <tr><td colSpan={2} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">Potongan</td></tr>
            {minus.length === 0 && <tr><td className="py-1.5 text-neutral-500" colSpan={2}>Tidak ada potongan</td></tr>}
            {minus.map((i) => row(ITEM_KIND[i.kind].label, -Number(i.amount), [i.project, i.note, i.date].filter(Boolean).join(" · ")))}
            <tr className="border-t-2 border-neutral-900"><td className="pt-3 text-sm font-bold">Total diterima</td><td className="pt-3 text-right text-lg font-bold tnum">{rupiah(net)}</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs italic text-neutral-600">Terbilang: {terbilang(net)} rupiah</p>
        {sl.note && <p className="mt-3 text-xs text-neutral-600">Catatan: {sl.note}</p>}

        <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs">
          <div><p className="text-neutral-500">Penerima</p><div className="h-16" /><p className="border-t border-neutral-400 pt-1 font-medium">{emp.name}</p></div>
          <div><p className="text-neutral-500">{co.name}</p><div className="h-16" /><p className="border-t border-neutral-400 pt-1 font-medium">Owner</p></div>
        </div>
        <p className="mt-8 border-t border-neutral-200 pt-3 text-center text-[11px] text-neutral-400">Dokumen ini dibuat otomatis oleh Frameless Hub · {no} · rahasia, hanya untuk penerima.</p>
      </article>
    </>
  );
}
