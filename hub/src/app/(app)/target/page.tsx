import { currentUser } from "@/lib/auth";
import { addMonths, fullMonth, pct, rupiah } from "@/lib/format";
import { loadFacts, summary, targetFor } from "@/lib/metrics";
import { saveTarget } from "@/app/actions";
import { CompanyDot, Field, PageHead } from "@/components/ui";
import { Progress } from "@/components/charts";

export const metadata = { title: "Target" };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const owner = user?.role === "owner";
  const rows = [{ id: null as number | null, name: "Seluruh grup", color: "#b8c4ff" }, ...f.companies.map((c) => ({ id: c.id as number | null, name: c.name, color: c.color }))];
  const day = Number(new Date(Date.now() + 7 * 3600e3).toISOString().slice(8, 10));
  const dim = new Date(Number(f.now.slice(0, 4)), Number(f.now.slice(5, 7)), 0).getDate();
  const dbTargets = f.targets.slice().sort((a, b) => b.period.localeCompare(a.period));
  return (
    <>
      <PageHead title="Planning & target" sub={`Target bulanan per unit dan grup. Hub membandingkan laju saat ini dengan target. ${fullMonth(f.now)} hari ke-${day} dari ${dim}.`} />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const s = summary(f.rows, r.id, [f.now]);
          const tr = targetFor(f, r.id, f.now, "revenue"), tp = targetFor(f, r.id, f.now, "profit");
          const proj = day >= 3 ? (s.revenue / day) * dim : null;
          return (
            <section key={r.name} className="card card-pad">
              <div className="mb-3 flex items-center gap-2"><CompanyDot color={r.color} /><b className="font-display">{r.name}</b></div>
              {[["Pendapatan", s.revenue, tr], ["Laba", s.profit, tp]].map(([l, v, t]) => (
                <div key={l as string} className="mb-3">
                  <div className="mb-1 flex justify-between text-sm"><span>{l as string}</span><span className="tnum text-muted">{rupiah(v as number)}{t ? ` / ${rupiah(t as number)}` : ""}</span></div>
                  {t ? <Progress value={((v as number) / (t as number)) * 100} color="var(--accent-2)" /> : <p className="text-xs text-muted">Belum ada target.</p>}
                  {t ? <p className="mt-1 text-xs text-muted">{pct(((v as number) / (t as number)) * 100)} tercapai{l === "Pendapatan" && proj ? ` · proyeksi akhir bulan ${rupiah(proj)} (${pct((proj / (t as number)) * 100)})` : ""}</p> : null}
                </div>
              ))}
            </section>
          );
        })}
      </div>
      {owner && (
        <section className="card card-pad mt-6">
          <h2 className="mb-3 font-display font-semibold">Tetapkan target</h2>
          <form action={saveTarget} className="grid gap-3 sm:grid-cols-5">
            <Field label="Unit"><select name="company" className="input" defaultValue=""><option value="">Seluruh grup</option>{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Periode"><input name="period" className="input" defaultValue={f.now} pattern="\d{4}-\d{2}" required /></Field>
            <Field label="Metrik"><select name="metric" className="input"><option value="revenue">Pendapatan</option><option value="profit">Laba</option></select></Field>
            <Field label="Nilai (Rp)"><input name="value" inputMode="numeric" className="input tnum" required placeholder="50000000" /></Field>
            <div className="flex items-end"><button className="btn btn-primary w-full">Simpan</button></div>
          </form>
          <p className="mt-2 text-xs text-muted">Contoh bulan depan: {addMonths(f.now, 1)}. Menyimpan periode+metrik yang sama akan memperbarui target.</p>
          {dbTargets.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {dbTargets.slice(0, 20).map((t, i) => (
                <li key={i} className="flex items-center justify-between py-2"><span>{t.company_id ? f.companies.find((c) => c.id === t.company_id)?.name : "Grup"} · {t.period} · {t.metric === "revenue" ? "Pendapatan" : "Laba"}</span><span className="tnum">{rupiah(Number(t.value))}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
