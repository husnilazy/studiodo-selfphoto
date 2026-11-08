import { currentUser } from "@/lib/auth";
import { loadFacts, profitShare } from "@/lib/metrics";
import { addMonths, fullMonth, pct, rupiah } from "@/lib/format";
import { saveCompanyRules } from "@/app/actions";
import { CompanyDot, Field, PageHead, Stat } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Bagi Hasil" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : addMonths(f.now, -1);
  const owner = user?.role === "owner";
  return (
    <>
      <PageHead title="Bagi hasil" sub="Laba dibagi dengan dua kolam: kolam modal (sesuai modal yang tercatat) dan kolam kerja (sesuai bobot kerja harian). Atur komposisinya per unit agar tidak abu-abu lagi." />
      <div className="mb-5 flex items-center gap-2 text-sm">
        <Link className="btn !min-h-8" href={`/bagi-hasil?m=${addMonths(month, -1)}`}>←</Link>
        <b className="min-w-28 text-center font-display">{fullMonth(month)}</b>
        <Link className="btn !min-h-8" href={`/bagi-hasil?m=${addMonths(month, 1)}`}>→</Link>
      </div>
      <div className="space-y-5">
        {f.companies.map((c) => {
          const r = profitShare(f, c, [month]);
          return (
            <section key={c.id} className="card card-pad">
              <div className="mb-4 flex items-center gap-2"><CompanyDot color={c.color} /><h2 className="font-display text-lg font-semibold">{c.name}</h2></div>
              <div className="statgrid grid-cols-2 lg:grid-cols-4">
                <Stat label="Laba operasional" value={rupiah(r.profit)} tone={r.profit < 0 ? "bad" : undefined} />
                <Stat label={`Cadangan ${c.reserve_pct}%`} value={rupiah(r.reserve)} />
                <Stat label={`Kolam modal ${c.share_capital_pct}%`} value={rupiah(r.capPool)} />
                <Stat label={`Kolam kerja ${c.share_work_pct}%`} value={rupiah(r.workPool)} />
              </div>
              {r.lines.length === 0 ? <p className="mt-4 text-sm text-muted">Belum ada partner di unit ini.</p> : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead><tr><th className="th">Partner</th><th className="th text-right">Porsi modal</th><th className="th text-right">Porsi kerja</th><th className="th text-right">Dari modal</th><th className="th text-right">Dari kerja</th><th className="th text-right">Total</th><th className="th text-right">Sudah ditarik</th></tr></thead>
                    <tbody>
                      {r.lines.map((l) => (
                        <tr key={l.partner.id}>
                          <td className="td font-medium">{l.partner.name}</td>
                          <td className="td tnum text-right">{pct(l.capShare, 1)}</td><td className="td tnum text-right">{pct(l.workShare, 1)}</td>
                          <td className="td tnum text-right">{rupiah(l.fromCap)}</td><td className="td tnum text-right">{rupiah(l.fromWork)}</td>
                          <td className="td tnum text-right font-bold text-accent2">{rupiah(l.total)}</td>
                          <td className="td tnum text-right text-muted">{rupiah(l.paid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {owner && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-accent">Atur aturan bagi hasil unit ini</summary>
                  <form action={saveCompanyRules} className="mt-3 grid gap-3 sm:grid-cols-4">
                    <input type="hidden" name="id" value={c.id} />
                    <Field label="Kolam modal (%)"><input name="cap" type="number" min={0} max={100} defaultValue={c.share_capital_pct} className="input" /></Field>
                    <Field label="Cadangan dari laba (%)"><input name="reserve" type="number" min={0} max={50} defaultValue={c.reserve_pct} className="input" /></Field>
                    <Field label="Mulai beroperasi"><input name="started" type="date" defaultValue={c.started_on ?? ""} className="input" /></Field>
                    <div className="flex items-end"><button className="btn btn-primary w-full">Simpan</button></div>
                    <p className="text-xs text-muted sm:col-span-4">Kolam kerja = 100% − kolam modal. Bobot kerja tiap partner diatur di Pengaturan → Partner. Contoh: SNAPCUP modal 100% milikmu → atur kolam modal 100%.</p>
                  </form>
                </details>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-muted">Perhitungan ini alat bantu keputusan, bukan akta. Sepakati aturan bersama partner, lalu catat penarikan nyata sebagai “Bagi hasil” di Transaksi.</p>
    </>
  );
}
