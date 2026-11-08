import { buildInsights } from "@/lib/insights";
import { loadFacts } from "@/lib/metrics";
import { PageHead, Pill } from "@/components/ui";
import { AIPanel } from "@/components/clientForms";
import ShareDigest from "@/components/ShareDigest";
import { buildDigest } from "@/lib/digest";
import LiveRefresh from "@/components/LiveRefresh";

export const metadata = { title: "Rekomendasi" };
const TONE = { bad: "bad", warn: "warn", info: "info", ok: "ok" } as const;
const LBL = { bad: "Mendesak", warn: "Perhatian", info: "Info", ok: "Bagus" } as const;

export default async function Page() {
  const f = await loadFacts();
  const list = buildInsights(f);
  return (
    <>
      <PageHead title="Rekomendasi keputusan" sub="Dihitung otomatis dari data terbaru: kas & runway, margin, tren, alokasi, modal, dan target. Setiap temuan disertai langkah konkret." right={<LiveRefresh />} />
      <div className="space-y-3">
        {list.map((i, k) => (
          <article key={k} className="card card-pad rise" style={{ animationDelay: `${k * 40}ms` }}>
            <div className="flex flex-wrap items-center gap-2"><Pill tone={TONE[i.level]}>{LBL[i.level]}</Pill><span className="text-xs text-muted">{i.scope}</span></div>
            <h2 className="mt-2 font-display font-semibold">{i.title}</h2>
            <p className="mt-1 text-sm text-muted">{i.detail}</p>
            <p className="mt-2 rounded-lg bg-panel2 px-3 py-2 text-sm"><b className="text-accent2">Saran:</b> {i.action}</p>
          </article>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="mb-1 font-display text-lg">Ringkasan untuk WhatsApp</h2>
        <p className="mb-3 text-sm text-muted">Posisi grup, tiap unit, dan peringatan terbaru dalam satu pesan. Kirim ke dirimu sendiri, partner, atau grup tim.</p>
        <ShareDigest text={buildDigest(f)} />
      </section>
      <section className="mt-8">
        <h2 className="mb-1 font-display text-lg">Analisis AI</h2>
        <p className="mb-3 text-sm text-muted">Claude membaca ringkasan angka 6 bulan terakhir dan menyusun keputusan prioritas. Butuh <code>ANTHROPIC_API_KEY</code> di server. Bukan nasihat investasi berlisensi.</p>
        <AIPanel />
      </section>
    </>
  );
}
