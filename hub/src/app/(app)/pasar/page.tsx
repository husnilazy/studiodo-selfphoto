import { loadFacts } from "@/lib/metrics";
import { loadInventory } from "@/lib/assets";
import { getVal, loadObligations, marketUnit, valueGroup } from "@/lib/valuation";
import { compact, pct } from "@/lib/format";
import { PageHead, Pill, SectionHead, Stat } from "@/components/ui";
import { Legend, TrendChart } from "@/components/charts";

export const metadata = { title: "Proyeksi pasar" };

export default async function Page() {
  const [f, cfg, obs, inv] = await Promise.all([loadFacts(), getVal(), loadObligations(), loadInventory()]);
  const g = valueGroup(f, cfg, obs, inv);
  const mk = g.units.map((u) => ({ u, m: marketUnit(u, cfg) }));
  const labels = ["Sekarang", "Tahun 1", "Tahun 2", "Tahun 3"];
  const total = (key: string) => [g.annualRev, ...[0, 1, 2].map((i) => mk.reduce((t, x) => t + (x.m.rows.find((r) => r.key === key)?.rev[i] ?? 0), 0))];
  const base = total("dasar"), cons = total("konservatif"), opt = total("optimis");
  const pipe = mk.reduce((t, x) => t + x.m.pipelineWeighted, 0), pipeRaw = mk.reduce((t, x) => t + x.u.a.pipeline, 0);

  return (
    <>
      <PageHead title="Proyeksi pasar" sub="Dari laju pendapatan nyata tiap unit, diproyeksikan 3 tahun dalam tiga skenario, lalu dibandingkan dengan ukuran pasar yang kamu isi. Pertumbuhan dan pipeline diatur di Valuasi → Asumsi." />

      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat label="Pendapatan sekarang/thn" value={`Rp ${compact(g.annualRev)}`} />
        <Stat label="Tahun 3 (dasar)" value={`Rp ${compact(base[3])}`} tone="ok" sub={`Konservatif ${compact(cons[3])} · Optimis ${compact(opt[3])}`} />
        <Stat label="Pipeline proyek" value={`Rp ${compact(pipeRaw)}`} sub={`Berbobot ${pct(cfg.winrate)} = Rp ${compact(pipe)} (masuk tahun 1)`} />
        <Stat label="Nilai wajar grup" value={`Rp ${compact(g.fair)}`} sub="Lihat halaman Valuasi" />
      </div>

      <section className="card card-pad mt-4">
        <SectionHead title="Pendapatan grup, 3 skenario" />
        <TrendChart labels={labels} height={240} series={[
          { name: "Konservatif", color: "#ff8a9a", values: cons },
          { name: "Dasar", color: "#b8c4ff", values: base },
          { name: "Optimis", color: "#5fd1c4", values: opt },
        ]} />
        <Legend items={[{ label: "Konservatif", color: "#ff8a9a" }, { label: "Dasar", color: "#b8c4ff" }, { label: "Optimis", color: "#5fd1c4" }]} />
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Per unit usaha" note="Pangsa pasar dihitung bila ukuran pasar (Rp/tahun, area layanan yang realistis dijangkau) sudah diisi." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr><th className="th">Unit</th><th className="th text-right">Sekarang</th><th className="th text-right">Th 1 dasar</th><th className="th text-right">Th 2 dasar</th><th className="th text-right">Th 3 dasar</th><th className="th text-right">Pertumbuhan</th><th className="th text-right">Pasar/thn</th><th className="th text-right">Pangsa</th></tr></thead>
            <tbody>
              {mk.map(({ u, m }) => {
                const b = m.rows.find((r) => r.key === "dasar")!;
                const share3 = u.a.sam > 0 ? (b.rev[2] / u.a.sam) * 100 : null;
                return (
                  <tr key={u.company.id}>
                    <td className="td font-medium"><span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: u.company.color }} />{u.company.name}</td>
                    <td className="td tnum text-right">{compact(u.annualRev)}</td>
                    {b.rev.map((v, i) => <td key={i} className="td tnum text-right">{compact(v)}</td>)}
                    <td className="td tnum text-right">{pct(u.growth * 100, 1)}</td>
                    <td className="td tnum text-right">{u.a.sam > 0 ? compact(u.a.sam) : <Pill tone="warn">isi</Pill>}</td>
                    <td className="td tnum text-right">{m.shareNow == null ? "–" : `${pct(m.shareNow, 2)} → ${pct(share3 ?? 0, 2)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Pangsa dibaca “sekarang → tahun 3 (dasar)”. Angka pasar sebaiknya dari sumber yang bisa kamu sebutkan di hadapan investor (data BPS, asosiasi, survei sendiri). Hub tidak mengarang angka pasar.</p>
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Cara membaca" />
        <ul className="space-y-1.5 text-sm text-muted">
          <li>• <b className="text-fg">Dasar</b> memakai pertumbuhan aktual (6 bulan terakhir vs 6 bulan sebelumnya, dibatasi −20%…+40%), atau angka yang kamu isi.</li>
          <li>• <b className="text-fg">Konservatif</b> = pertumbuhan dasar −10 poin, <b className="text-fg">Optimis</b> = +10 poin.</li>
          <li>• <b className="text-fg">Pipeline</b> proyek dikalikan peluang menang, hanya ditambahkan ke tahun 1 skenario dasar. Ke depan angka ini bisa diisi otomatis dari data proyek di Frameless Super App.</li>
        </ul>
      </section>
    </>
  );
}
