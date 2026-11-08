import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { loadFacts, profitShare } from "@/lib/metrics";
import { listEmployees } from "@/lib/payroll";
import { loadAssets } from "@/lib/assets";
import { DEFAULT_RATE_CARD, allocate, type RateCard } from "@/lib/ratecard";
import { compact } from "@/lib/format";
import { PageHead, SectionHead } from "@/components/ui";
import ProjectCalc from "@/components/ProjectCalc";

export const metadata = { title: "Kalkulator proyek" };

export default async function Page() {
  const [f, user, emps, assets, saved] = await Promise.all([
    loadFacts(), currentUser(), listEmployees(), loadAssets(),
    one<{ value: Partial<RateCard> }>("select value from settings where key = 'rate_card'"),
  ]);
  const card: RateCard = { ...DEFAULT_RATE_CARD, ...(saved?.value ?? {}), roles: saved?.value?.roles?.length ? saved.value.roles : DEFAULT_RATE_CARD.roles };
  const fc = f.companies.find((c) => c.slug === "frameless") ?? f.companies[0];
  const ps = fc ? profitShare(f, fc, [f.now]) : null;
  const names = [...new Set([...emps.filter((e) => e.active).map((e) => e.name), ...f.partners.map((p) => p.name)])];
  const toolsHint = assets.filter((a) => a.company_id === fc?.id && (a.status === "aktif" || a.status === "perbaikan")).reduce((t, a) => t + Number(a.cost) / (a.life_years * 12), 0);
  const owner = user?.role === "owner";

  // Indeks tarif: budget umum × peran default (semua peran aktif sesuai kartu)
  const tiers = [3_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000];
  const act = Object.fromEntries(card.roles.map((r) => [r.key, { on: r.on, weight: r.weight }]));
  const idx = tiers.map((b) => allocate(b, card, null, act));
  const roles = card.roles.filter((r) => r.on);

  return (
    <>
      <PageHead title="Kalkulator proyek & indeks crew" sub="Masukkan budget dari klien, pilih peran, lihat otomatis pembagian: biaya, margin Frameless, honor tiap peran, sampai terima bersih tiap orang." />
      <ProjectCalc card={card} names={names} owner={owner} companyName={fc?.name ?? "Frameless"} toolsHint={toolsHint}
        share={{ reserve: Number(fc?.reserve_pct ?? 0), capital: Number(fc?.share_capital_pct ?? 50), work: Number(fc?.share_work_pct ?? 50),
          members: ps ? ps.lines.map((l) => ({ name: l.partner.name, capShare: l.capShare, workShare: l.workShare })) : [] }} />

      <section className="card card-pad mt-4">
        <SectionHead title="Indeks crew (acuan cepat)" note="Honor per peran untuk budget umum, memakai persen & bobot standar saat ini. Pakai sebagai patokan negosiasi dan penawaran." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr><th className="th">Peran (% kolam honor)</th>{tiers.map((b) => <th key={b} className="th text-right">Budget {compact(b)}</th>)}</tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.key}><td className="td">{r.label} <span className="text-xs text-muted">{(idx[0].roles.find((x) => x.key === r.key)?.share ?? 0).toFixed(0)}%</span></td>
                  {idx.map((a, i) => <td key={i} className="td tnum text-right">{compact(a.roles.find((x) => x.key === r.key)?.amount ?? 0)}</td>)}</tr>
              ))}
              <tr><td className="td text-muted">Kolam honor total</td>{idx.map((a, i) => <td key={i} className="td tnum text-right text-muted">{compact(a.pool)}</td>)}</tr>
              <tr><td className="td text-muted">Margin {fc?.name} ({card.margin}%)</td>{idx.map((a, i) => <td key={i} className="td tnum text-right text-muted">{compact(a.margin)}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Biaya langsung diperkirakan {card.direct}% dan alat {card.tools}% dari budget. Kalau satu orang merangkap peran, jumlahkan honornya. Untuk proyek kecil biasanya hanya 2–3 peran aktif, sehingga honor per peran lebih besar dari tabel.</p>
      </section>
    </>
  );
}
