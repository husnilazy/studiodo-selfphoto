import { capitalByPartner, loadFacts, sum } from "@/lib/metrics";
import { compact, pct, rupiah } from "@/lib/format";
import { CompanyDot, Empty, PageHead, Stat } from "@/components/ui";
import { Donut } from "@/components/charts";
import Link from "next/link";

export const metadata = { title: "Modal" };

export default async function Page() {
  const f = await loadFacts();
  const palette = ["#b8c4ff", "#5fd1c4", "#e9c46a", "#e69ad0", "#6ea8ff"];
  const totalCash = sum(f.rows, { kind: "capital_in" });
  const totalPartner = sum(f.rows, { kind: ["asset_purchase", "expense"], funding: "partner" });
  return (
    <>
      <PageHead title="Modal & kepemilikan" sub="Siapa menaruh berapa di tiap unit — setoran tunai, serta alat/biaya yang dibayar dari kantong pribadi. Ini dasar yang adil untuk bagi hasil." />
      <div className="statgrid grid-cols-2 lg:grid-cols-3">
        <Stat label="Setoran modal tunai" value={rupiah(totalCash)} />
        <Stat label="Dibayar pribadi (alat & biaya)" value={rupiah(totalPartner)} sub="Dihitung sebagai modal partner" />
        <Stat label="Total modal tercatat" value={rupiah(totalCash + totalPartner)} />
      </div>
      <div className="mt-5 space-y-4">
        {f.companies.map((c) => {
          const cap = capitalByPartner(f.rows, c.id);
          const members = f.cps.filter((m) => m.company_id === c.id);
          const parts = members.map((m, i) => { const x = cap.get(m.partner_id); return { m, p: f.partners.find((p) => p.id === m.partner_id)!, x, total: x ? x.cash + x.inKind + x.expenses : 0, color: palette[i % palette.length] }; });
          const tot = parts.reduce((a, b) => a + b.total, 0);
          return (
            <section key={c.id} className="card card-pad">
              <div className="mb-3 flex items-center gap-2"><CompanyDot color={c.color} /><h2 className="font-display font-semibold">{c.name}</h2></div>
              {parts.length === 0 ? <p className="text-sm text-muted">Belum ada partner. Tambahkan di <Link href="/pengaturan" className="text-accent underline">Pengaturan</Link>.</p> : (
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  <Donut size={130} parts={parts.map((x) => ({ label: x.p.name, value: x.total, color: x.color }))} center={tot > 0 ? <><div className="text-[10px] text-muted">Modal</div><div className="font-display text-sm font-bold">{compact(tot)}</div></> : <div className="text-[10px] text-muted">belum ada</div>} />
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead><tr><th className="th">Partner</th><th className="th text-right">Tunai</th><th className="th text-right">Alat (pribadi)</th><th className="th text-right">Biaya (pribadi)</th><th className="th text-right">Porsi modal</th><th className="th text-right">Disepakati</th></tr></thead>
                      <tbody>
                        {parts.map((x) => {
                          const share = tot > 0 ? (x.total / tot) * 100 : 0, gap = share - Number(x.m.equity_pct);
                          return (
                            <tr key={x.p.id}>
                              <td className="td"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: x.color }} />{x.p.name}</span></td>
                              <td className="td tnum text-right">{rupiah(x.x?.cash ?? 0)}</td><td className="td tnum text-right">{rupiah(x.x?.inKind ?? 0)}</td><td className="td tnum text-right">{rupiah(x.x?.expenses ?? 0)}</td>
                              <td className="td tnum text-right font-semibold">{pct(share, 1)}</td>
                              <td className={`td tnum text-right ${Math.abs(gap) > 15 && Number(x.m.equity_pct) > 0 ? "text-warn" : "text-muted"}`}>{pct(Number(x.m.equity_pct))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
      {f.rows.length === 0 && <div className="mt-4"><Empty>Catat setoran modal & pembelian alat di halaman Transaksi.</Empty></div>}
    </>
  );
}
