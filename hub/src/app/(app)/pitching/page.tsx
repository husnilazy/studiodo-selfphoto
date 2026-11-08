import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { makeInvestorLink, revokeInvestorLink } from "@/app/actions";
import { PageHead } from "@/components/ui";
import PitchBody from "@/components/PitchBody";
import CopyField from "@/components/CopyField";

export const metadata = { title: "Pitching" };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const t = (await q<{ value: string }>("select value from settings where key='investor_token'"))[0]?.value;
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  return (
    <>
      <PageHead title="Materi pitching investor" sub="Ringkasan traksi yang dihitung dari data nyata Hub. Bagikan sebagai link baca-saja atau cetak jadi PDF."
        right={<a href="javascript:window.print()" className="btn no-print">Cetak / PDF</a>} />
      {user?.role === "owner" && (
        <section className="card card-pad no-print mb-4">
          <h2 className="font-display font-semibold">Link investor (baca-saja)</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Investor melihat traksi (pendapatan, laba, pertumbuhan, per unit) tanpa login. Saldo kas, modal internal, dan transaksi tidak ditampilkan. Cabut kapan saja.</p>
          {t ? (
            <div className="space-y-3"><CopyField path={`/investor/${t}`} base={base} />
              <form action={revokeInvestorLink}><button className="btn btn-danger !min-h-9 text-xs">Cabut link</button></form></div>
          ) : <form action={makeInvestorLink}><button className="btn btn-primary">Buat link investor</button></form>}
        </section>
      )}
      <PitchBody f={f} />
      <p className="mt-4 text-xs text-muted">Tambahkan narasi (masalah, solusi, pasar, rencana dana) lewat Ide & Rencana → jenis “Materi pitching”; otomatis muncul di sini dan di link investor.</p>
    </>
  );
}
