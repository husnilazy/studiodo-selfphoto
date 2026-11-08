import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { bookBalance } from "@/lib/recon";
import { deleteCheck, reconcile } from "@/app/actions";
import { rupiah, today } from "@/lib/format";
import { CompanyDot, Field, PageHead, Pill, SectionHead } from "@/components/ui";

export const metadata = { title: "Rekonsiliasi" };
type Check = { id: number; date: string; book: number; actual: number; diff: number; adjusted: boolean; note: string };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const owner = user?.role === "owner";
  const t = today();
  const rows = await Promise.all(f.companies.map(async (c) => ({
    c, book: await bookBalance(c.id, t),
    checks: await q<Check>("select id, date, book, actual, diff, adjusted, note from balance_checks where company_id=$1 order by date desc, id desc limit 4", [c.id]),
  })));
  return (
    <>
      <PageHead title="Rekonsiliasi saldo" sub="Cocokkan saldo kas + bank yang sebenarnya (lihat di m-banking dan laci) dengan saldo menurut catatan Hub. Selisih = ada transaksi yang belum atau salah tercatat." />
      <div className="space-y-4">
        {rows.map(({ c, book, checks }) => {
          const last = checks[0];
          return (
            <section key={c.id} className="card card-pad rise">
              <SectionHead title={c.name} note={`Saldo menurut Hub hari ini`} right={last && <Pill tone={last.diff === 0 ? "ok" : last.adjusted ? "info" : "warn"}>{last.diff === 0 ? "Cocok" : last.adjusted ? "Selisih disesuaikan" : `Selisih ${rupiah(last.diff)}`} · {last.date}</Pill>} />
              <div className="stat-value tnum mb-4 flex items-center gap-2 text-2xl"><CompanyDot color={c.color} />{rupiah(book)}</div>
              {owner && (
                <form action={reconcile} className="grid gap-3 sm:grid-cols-6">
                  <input type="hidden" name="company" value={c.id} />
                  <div className="sm:col-span-2"><Field label="Saldo aktual (kas + bank)"><input name="actual" inputMode="numeric" className="input tnum" placeholder="mis. 12500000" required /></Field></div>
                  <Field label="Per tanggal"><input name="date" type="date" defaultValue={t} className="input" /></Field>
                  <div className="sm:col-span-2"><Field label="Catatan"><input name="note" className="input" placeholder="mis. cek m-banking + hitung laci" /></Field></div>
                  <div className="flex items-end"><button className="btn btn-primary w-full">Cocokkan</button></div>
                  <label className="flex items-center gap-2 text-xs text-muted sm:col-span-6"><input type="checkbox" name="adjust" className="size-4 accent-[var(--accent)]" />Catat selisihnya sebagai transaksi “penyesuaian” agar saldo Hub sama dengan saldo aktual (kalau penyebabnya sudah jelas, lebih baik catat transaksi aslinya).</label>
                </form>
              )}
              {checks.length > 0 && (
                <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-sm">
                  <thead><tr><th className="th">Tanggal</th><th className="th text-right">Menurut Hub</th><th className="th text-right">Aktual</th><th className="th text-right">Selisih</th><th className="th">Catatan</th>{owner && <th className="th" />}</tr></thead>
                  <tbody>{checks.map((k) => (
                    <tr key={k.id}>
                      <td className="td tnum">{k.date}</td><td className="td tnum text-right">{rupiah(k.book)}</td><td className="td tnum text-right">{rupiah(k.actual)}</td>
                      <td className={`td tnum text-right font-medium ${k.diff === 0 ? "text-ok" : k.diff < 0 ? "text-bad" : "text-warn"}`}>{k.diff === 0 ? "0" : rupiah(k.diff)}{k.adjusted && <span className="ml-1 text-xs text-muted">(disesuaikan)</span>}</td>
                      <td className="td max-w-[14rem] truncate text-muted">{k.note}</td>
                      {owner && <td className="td"><form action={deleteCheck}><input type="hidden" name="id" value={k.id} /><button className="text-xs text-muted hover:text-bad" aria-label="Hapus">✕</button></form></td>}
                    </tr>))}</tbody>
                </table></div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
