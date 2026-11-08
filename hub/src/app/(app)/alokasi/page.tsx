import { currentUser } from "@/lib/auth";
import { allocation, BUCKETS, DEFAULT_PLAN, lastMonths, loadFacts } from "@/lib/metrics";
import { compact, fullMonth, monthLabel, pct } from "@/lib/format";
import { savePlan } from "@/app/actions";
import { CompanyDot, PageHead } from "@/components/ui";
import { Donut, Legend, Progress } from "@/components/charts";

export const metadata = { title: "Alokasi" };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const owner = user?.role === "owner";
  const m3 = lastMonths(3, f.now);
  const grp = allocation(f, null, [f.now]);
  return (
    <>
      <PageHead title="Alokasi anggaran" sub={`Setiap rupiah pendapatan dibagi ke pos: operasional, gaji, pengembangan, cadangan, bagi hasil. ${fullMonth(f.now)}.`} />
      <section className="card card-pad mb-5">
        <h2 className="mb-4 font-display font-semibold">Seluruh grup · realisasi pemakaian</h2>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <Donut parts={grp.map((a) => ({ label: a.label, value: a.actual, color: a.color }))} center={<><div className="text-[10px] text-muted">Pendapatan</div><div className="font-display text-sm font-bold">{compact(grp.reduce((s, a) => s + a.actual, 0))}</div></>} />
          <ul className="w-full space-y-3">
            {grp.map((a) => (
              <li key={a.key}><div className="mb-1 flex justify-between text-sm"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: a.color }} />{a.label}</span><span className="tnum text-muted">{compact(a.actual)} · {pct(a.usedPct)} dari pendapatan (rencana {pct(a.pct)})</span></div>
                <Progress value={a.pct > 0 ? (a.usedPct / a.pct) * 100 : 0} color={a.color} over={a.key !== "cadangan" && a.usedPct > a.pct * 1.15} /></li>
            ))}
          </ul>
        </div>
      </section>

      <div className="space-y-4">
        {f.companies.map((c) => {
          const plan = f.plans.get(c.id) ?? DEFAULT_PLAN;
          const a = allocation(f, c.id, [f.now]);
          const hist = m3.map((m) => ({ m, a: allocation(f, c.id, [m]) }));
          return (
            <section key={c.id} className="card card-pad">
              <div className="mb-3 flex items-center gap-2"><CompanyDot color={c.color} /><h2 className="font-display font-semibold">{c.name}</h2></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                <thead><tr><th className="th">Pos</th><th className="th text-right">Rencana</th><th className="th text-right">Anggaran</th><th className="th text-right">Terpakai</th>{hist.map((h) => <th key={h.m} className="th text-right">{monthLabel(h.m)}</th>)}</tr></thead>
                <tbody>
                  {a.map((x, i) => (
                    <tr key={x.key}>
                      <td className="td"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: x.color }} />{x.label}</span></td>
                      <td className="td tnum text-right">{pct(x.pct)}</td><td className="td tnum text-right">{compact(x.budget)}</td>
                      <td className={`td tnum text-right font-semibold ${x.key !== "cadangan" && x.actual > x.budget && x.budget > 0 ? "text-bad" : ""}`}>{compact(x.actual)}</td>
                      {hist.map((h) => <td key={h.m} className="td tnum text-right text-muted">{pct(h.a[i].usedPct)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {owner && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-accent">Ubah rencana alokasi</summary>
                  <form action={savePlan} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
                    <input type="hidden" name="company" value={c.id} />
                    {BUCKETS.map((b) => (
                      <label key={b.key} className="block"><span className="label">{b.label} %</span><input name={b.key} type="number" step="0.5" min={0} max={100} defaultValue={plan[b.key] ?? 0} className="input tnum" /></label>
                    ))}
                    <div className="flex items-end"><button className="btn btn-primary w-full">Simpan</button></div>
                    <p className="col-span-full text-xs text-muted">Total harus 100%. “Dana Cadangan” dihitung dari sisa pendapatan yang tidak terpakai.</p>
                  </form>
                </details>
              )}
            </section>
          );
        })}
      </div>
      <div className="mt-4"><Legend items={BUCKETS.map((b) => ({ label: b.label, color: b.color }))} /></div>
    </>
  );
}
