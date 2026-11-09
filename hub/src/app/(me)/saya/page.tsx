import Link from "next/link";
import { isTeam, requireUser, ROLE_LABEL } from "@/lib/auth";
import { q } from "@/lib/db";
import { capitalByPartner, loadFacts, profitShare } from "@/lib/metrics";
import { EMP_COLS, ITEM_KIND, PAY_TYPE_LABEL, computeSlip, weeksIn, type Emp } from "@/lib/payroll";
import { addMonths, fullMonth, monthLabel, pct, rupiah, thisMonth } from "@/lib/format";
import { Empty, Pill, SectionHead, Stat } from "@/components/ui";
import PitchBody from "@/components/PitchBody";
import ShareScenario from "@/components/ShareScenario";
import { scenarioFor } from "@/lib/scenario";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Area saya" };
type Doc = { id: number; title: string; kind: string; url: string; body: string; created_at: string };

export default async function Page() {
  const user = await requireUser();
  const vis = user.role === "karyawan" ? ["karyawan", "all"] : user.role === "investor" ? ["investor", "all"] : ["owner", "team", "investor", "karyawan", "all"];
  const docs = await q<Doc>(
    `select id, title, kind, url, body, to_char(created_at,'YYYY-MM-DD') as created_at from documents
     where visibility = any($1) or (employee_id is not null and employee_id = $2) order by created_at desc limit 80`, [vis, user.employeeId]);
  const updates = docs.filter((d) => d.kind === "update"), files = docs.filter((d) => d.kind !== "update");

  const DocList = ({ list, empty }: { list: Doc[]; empty: string }) => list.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
    <ul className="divide-y divide-line text-sm">
      {list.map((d) => (
        <li key={d.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="font-medium">{d.title}</b>
            <span className="flex items-center gap-2 text-xs text-muted">{d.created_at}{d.url && <a href={d.url} target="_blank" rel="noreferrer" className="btn !min-h-8 text-xs">Buka</a>}</span>
          </div>
          {d.body && <p className="mt-1 whitespace-pre-wrap text-muted">{d.body}</p>}
        </li>
      ))}
    </ul>
  );

  /* ───── Karyawan ───── */
  if (user.role === "karyawan") {
    const [emp] = user.employeeId ? await q<Emp>(`select ${EMP_COLS} from employees where id = $1`, [user.employeeId]) : [];
    const [slips, items] = emp ? await Promise.all([
      q<{ id: number; period: string; net: number; status: string }>("select id, period, net::bigint as net, status from payslips where employee_id = $1 order by period desc", [emp.id]),
      q<{ id: number; date: string; kind: string; amount: number; project: string; payslip_id: number | null }>("select id, to_char(date,'YYYY-MM-DD') as date, kind, amount::bigint as amount, project, payslip_id from pay_items where employee_id = $1 order by date desc limit 20", [emp.id]),
    ]) : [[], []];
    const total = slips.filter((s) => s.status === "dibayar").reduce((a, s) => a + Number(s.net), 0);
    // Preview pendapatan bulan berjalan: gaji pokok + bonus/fee yang belum masuk slip (belum final sampai slip diterbitkan)
    const nowM = thisMonth();
    const pending = emp ? await q<{ kind: string; amount: number; project: string; date: string }>("select kind, amount::bigint as amount, project, to_char(date,'YYYY-MM-DD') as date from pay_items where employee_id = $1 and payslip_id is null and to_char(date,'YYYY-MM') = $2 order by date", [emp.id, nowM]) : [];
    const est = emp ? computeSlip(emp, weeksIn(nowM), pending) : null;
    const hasSlipNow = slips.some((s) => s.period === nowM);
    const months = Array.from({ length: 6 }, (_, i) => addMonths(nowM, i - 5));
    const trend = months.map((m) => slips.filter((s) => s.period === m).reduce((a, s) => a + Number(s.net), 0));
    return (
      <>
        <h1 className="font-display text-2xl">Halo, {user.name}</h1>
        <p className="mb-5 text-sm text-muted">{emp ? `${emp.position || emp.role || "Karyawan"} · ${PAY_TYPE_LABEL[emp.pay_type]}${emp.pay_type !== "freelance" ? ` ${rupiah(Number(emp.salary))}${emp.pay_type === "weekly" ? "/minggu" : "/bulan"}` : ""}` : "Akunmu belum dihubungkan ke data karyawan. Hubungi Owner."}</p>
        <div className="statgrid grid-cols-2">
          <Stat label="Total diterima (slip dibayar)" value={rupiah(total)} />
          <Stat label="Slip gaji" value={String(slips.length)} />
        </div>
        {est && (
          <section className="card card-pad mt-4">
            <SectionHead title={`Preview pendapatan ${fullMonth(nowM)}`} note={hasSlipNow ? "Slip bulan ini sudah terbit, lihat di bawah." : "Perkiraan, belum final sampai slip diterbitkan Owner."} />
            <div className="stat-value text-3xl">{rupiah(hasSlipNow ? Number(slips.find((x) => x.period === nowM)!.net) : est.net)}</div>
            {!hasSlipNow && <ul className="mt-3 divide-y divide-line text-sm">
              {est.base > 0 && <li className="flex justify-between py-2"><span className="text-muted">{emp!.pay_type === "weekly" ? `Gaji pokok (${weeksIn(nowM)} minggu)` : "Gaji pokok"}</span><span className="tnum">{rupiah(est.base)}</span></li>}
              {pending.map((i, k) => <li key={k} className="flex justify-between py-2"><span className="text-muted">{ITEM_KIND[i.kind]?.label ?? i.kind}{i.project && ` · ${i.project}`} <span className="text-xs">{i.date}</span></span><span className={`tnum ${ITEM_KIND[i.kind]?.sign === -1 ? "text-bad" : ""}`}>{ITEM_KIND[i.kind]?.sign === -1 ? "−" : "+"}{rupiah(Number(i.amount))}</span></li>)}
              {est.base === 0 && pending.length === 0 && <li className="py-2 text-muted">Belum ada pendapatan tercatat bulan ini.</li>}
            </ul>}
            {trend.some((v) => v > 0) && <div className="mt-4"><div className="mb-1 text-xs text-muted">Diterima 6 bulan terakhir (slip)</div><TrendChart labels={months.map(monthLabel)} height={150} series={[{ name: "Diterima", color: "#5fd1c4", values: trend }]} /></div>}
          </section>
        )}
        <section className="card card-pad mt-4">
          <SectionHead title="Slip gaji saya" />
          {slips.length === 0 ? <p className="text-sm text-muted">Belum ada slip.</p> : (
            <ul className="divide-y divide-line text-sm">{slips.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><b className="font-medium">{fullMonth(s.period)}</b> <span className="tnum text-muted">· {rupiah(Number(s.net))}</span></span>
                <span className="flex items-center gap-2"><Pill tone={s.status === "dibayar" ? "ok" : "info"}>{s.status === "dibayar" ? "Dibayar" : "Diproses"}</Pill><Link href={`/slip/${s.id}`} className="btn !min-h-8 text-xs">Lihat</Link><a href={`/api/pdf/slip/${s.id}?dl=1`} download className="btn btn-primary !min-h-8 text-xs">PDF</a></span>
              </li>))}</ul>
          )}
        </section>
        <section className="card card-pad mt-4">
          <SectionHead title="Bonus & fee proyek" note="Pendapatan tambahan di luar gaji pokok." />
          {items.length === 0 ? <p className="text-sm text-muted">Belum ada.</p> : (
            <ul className="divide-y divide-line text-sm">{items.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5"><span>{ITEM_KIND[i.kind]?.label ?? i.kind}{i.project && <span className="text-muted"> · {i.project}</span>} <span className="text-xs text-muted">{i.date}</span></span>
                <span className={`tnum font-medium ${ITEM_KIND[i.kind]?.sign === -1 ? "text-bad" : "text-ok"}`}>{ITEM_KIND[i.kind]?.sign === -1 ? "−" : "+"}{rupiah(Number(i.amount))}</span></li>))}</ul>
          )}
        </section>
        <section className="card card-pad mt-4"><SectionHead title="Dokumen" /><DocList list={files} empty="Belum ada dokumen untukmu." /></section>
      </>
    );
  }

  /* ───── Investor / partner ───── */
  if (user.role === "investor" || (user.role === "partner" && user.partnerId)) {
    const f = await loadFacts();
    const prev = addMonths(f.now, -1);
    const mine = f.partners.find((p) => p.id === user.partnerId);
    const rows = f.companies.map((c) => {
      const m = f.cps.find((x) => x.company_id === c.id && x.partner_id === user.partnerId);
      if (!m) return null;
      const cap = capitalByPartner(f.rows, c.id).get(user.partnerId!);
      const share = profitShare(f, c, [prev]).lines.find((l) => l.partner.id === user.partnerId);
      return { c, m, total: cap ? cap.cash + cap.inKind + cap.expenses : 0, withdrawn: cap?.withdrawn ?? 0, share };
    }).filter(Boolean) as { c: (typeof f.companies)[number]; m: (typeof f.cps)[number]; total: number; withdrawn: number; share: ReturnType<typeof profitShare>["lines"][number] | undefined }[];
    return (
      <>
        <h1 className="font-display text-2xl">Halo, {mine?.name ?? user.name}</h1>
        <p className="mb-5 text-sm text-muted">{ROLE_LABEL[user.role]} · kondisi terkini dan posisi modalmu di Frameless Group.</p>
        <section className="card card-pad">
          <SectionHead title="Kondisi terkini" note="Update dari Owner" />
          <DocList list={updates} empty="Belum ada update." />
        </section>
        <section className="card card-pad mt-4">
          <SectionHead title="Posisi modalku" note={`Bagi hasil menurut aturan unit, periode ${fullMonth(prev)}`} />
          {rows.length === 0 ? <p className="text-sm text-muted">Belum ada modal atau porsi yang terhubung ke akunmu.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
              <thead><tr><th className="th">Unit</th><th className="th text-right">Modal tercatat</th><th className="th text-right">Porsi disepakati</th><th className="th text-right">Hak bagi hasil</th><th className="th text-right">Sudah ditarik</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.c.id}><td className="td font-medium">{r.c.name}</td><td className="td tnum text-right">{rupiah(r.total)}</td><td className="td tnum text-right">{pct(Number(r.m.equity_pct))}</td>
                  <td className="td tnum text-right font-medium">{r.share ? rupiah(r.share.total) : "—"}</td><td className="td tnum text-right text-muted">{rupiah(r.withdrawn)}</td></tr>))}</tbody>
            </table></div>
          )}
        </section>
        {user.partnerId && (await Promise.all(rows.map((r) => scenarioFor(f, r.c)))).map((sc, i) => sc && <ShareScenario key={rows[i].c.id} {...sc} />)}
        <div className="mt-4"><PitchBody f={f} publicView /></div>
        <section className="card card-pad mt-4"><SectionHead title="Dokumen" /><DocList list={files} empty="Belum ada dokumen." /></section>
      </>
    );
  }

  /* ───── Owner / partner tanpa tautan ───── */
  return (
    <>
      <h1 className="font-display text-2xl">Area investor & karyawan</h1>
      <p className="mb-5 text-sm text-muted">Halaman ini yang dilihat investor dan karyawan setelah login. Kelola akun dan akses di Pengaturan.</p>
      <Empty>Kamu login sebagai {ROLE_LABEL[user.role]}. {isTeam(user) && <>Buka <Link href="/pengaturan" className="text-accent underline">Pengaturan → Akses & pengguna</Link> untuk membuat akun investor/karyawan, atau <Link href="/dokumen" className="text-accent underline">Dokumen</Link> untuk mengatur apa yang mereka lihat.</>}</Empty>
    </>
  );
}
