import { currentUser } from "@/lib/auth";
import { loadFacts, summary, lastMonths, sum, NON_CAPITAL } from "@/lib/metrics";
import { getRaise, getVal, loadObligations, marketUnit, risksOf, simulate, valueGroup } from "@/lib/valuation";
import { loadInventory } from "@/lib/assets";
import { getProfiles, legalLines } from "@/lib/profile";
import { saveRaise } from "@/app/actions-hr";
import { compact, fullMonth, pct, rupiah } from "@/lib/format";
import { Field, PageHead, SectionHead, Stat } from "@/components/ui";
import { q } from "@/lib/db";

export const metadata = { title: "Prospektus" };

const IDEAS: [string, string][] = [
  ["Data room satu link", "Bagikan link investor (Materi pitching) + Dokumen berstatus “Investor”. Calon investor melihat traksi, valuasi, dan perjanjian tanpa harus minta file satu-satu."],
  ["Update bulanan otomatis", "Terbitkan “Kondisi terkini” tiap bulan di Kondisi perusahaan. Investor yang dikabari rutin lebih percaya dan lebih mudah diajak tambah modal."],
  ["Investasi per unit, bukan per grup", "Tawarkan SNAPCUP, STUDIODO, atau Photobooth secara terpisah. Investor memilih risiko yang dia pahami, dan unit yang belum terbukti tidak menyeret yang sudah laba."],
  ["Bagi hasil pendapatan (revenue share)", "Cocok untuk unit yang arus kasnya rutin: investor dapat persen dari pendapatan sampai balik 1,5× modal, lalu selesai. Tanpa melepas saham, sederhana dihitung."],
  ["Lisensi & kemitraan Photobooth APP", "Jual aplikasi ke studio lain (setup + langganan). Investor melihat pendapatan berulang (MRR) yang bisa diskalakan tanpa menambah ruko."],
  ["Outlet kemitraan SNAPCUP", "Paket kemitraan stand dengan SOP, bahan baku, dan pelaporan lewat Hub yang sama, sehingga mitra dan pemilik melihat angka yang sama."],
  ["Pendanaan urunan resmi", "Untuk menjangkau banyak investor kecil, ada penyelenggara urun dana (securities crowdfunding) berizin OJK. Syarat dan biayanya perlu dikonsultasikan ke penasihat hukum."],
  ["Kanal investor yang realistis", "Angel/komunitas UMKM, klien proyek yang puas, pemasok, dan investor lokal Jawa Timur. Mulai dari yang sudah kenal kualitas kerja Frameless."],
];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [f, user, cfg, obs, inv, raise] = await Promise.all([loadFacts(), currentUser(), getVal(), loadObligations(), loadInventory(), getRaise()]);
  const owner = user?.role === "owner";
  const g = valueGroup(f, cfg, obs, inv);
  const t12 = lastMonths(12, f.now);
  const s12 = summary(f.rows, null, t12);
  const capital = sum(f.rows, { kind: "capital_in", notCat: NON_CAPITAL }) + sum(f.rows, { kind: ["asset_purchase", "expense"], funding: "partner" });
  const assets = sum(f.rows, { kind: "asset_purchase" });
  const notes = await q<{ title: string; body: string }>("select title, body from notes where kind = 'pitching' order by id desc");

  const scoped = raise.scope === "group" ? null : g.units.find((u) => u.company.slug === raise.scope) ?? null;
  const pre = scoped ? scoped.fair : g.fair;
  const scopeName = scoped ? scoped.company.name : "Frameless Group";
  const baseRevs = scoped ? marketUnit(scoped, cfg).rows.find((r) => r.key === "dasar")!.rev : [0, 1, 2].map((i) => g.units.reduce((t, u) => t + (marketUnit(u, cfg).rows.find((r) => r.key === "dasar")?.rev[i] ?? 0), 0));
  const amt = Math.max(0, parseInt((sp.amt ?? "").replace(/\D/g, "") || String(raise.amount || 0), 10) || 0);
  const sim = simulate(pre, amt, baseRevs);

  // Risiko otomatis dari data aktual
  const profiles = Object.entries(await getProfiles(f.companies.map((c) => c.slug))).filter(([, pr]) => pr.legal_name || pr.credentials);
  const risks = risksOf(f, g);

  return (
    <>
      <PageHead title="Prospektus investor" sub={`Disusun otomatis dari data aktual per ${fullMonth(f.now)}. Cetak jadi PDF atau tunjukkan langsung ke calon investor.`}
        right={<span className="no-print flex flex-wrap gap-2"><a href="/api/pdf/prospektus" target="_blank" rel="noreferrer" className="btn">Lihat PDF</a><a href="/api/pdf/prospektus?dl=1" download className="btn btn-primary">Unduh PDF</a></span>} />

      <section className="card glow card-pad mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent2">Ringkasan eksekutif</div>
        <h2 className="font-display mt-1 text-2xl font-bold">{scopeName}</h2>
        <p className="mt-2 text-sm text-muted">
          {f.companies.length} unit usaha ({f.companies.map((c) => c.name).join(", ")}) dengan pendapatan setahun Rp {compact(g.annualRev)} dan laba Rp {compact(g.annualProfit)} (margin {pct(g.annualRev > 0 ? (g.annualProfit / g.annualRev) * 100 : 0)}).
          Nilai wajar indikatif {scoped ? "unit ini" : "grup"} Rp {compact(pre)}.
          {amt > 0 && <> Sedang mencari pendanaan Rp {compact(amt)}.</>}
        </p>
      </section>

      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat label="Pendapatan setahun" value={`Rp ${compact(g.annualRev)}`} sub={`Aktual 12 bln terakhir: ${compact(s12.revenue)}`} />
        <Stat label="Laba setahun" value={`Rp ${compact(g.annualProfit)}`} tone={g.annualProfit < 0 ? "bad" : "ok"} sub={`Aktual 12 bln terakhir: ${compact(s12.profit)}`} />
        <Stat label="Nilai wajar (pra-dana)" value={`Rp ${compact(pre)}`} sub={`Kisaran ${compact(scoped ? scoped.fairLow : g.fairLow)} – ${compact(scoped ? scoped.fairHigh : g.fairHigh)}`} />
        <Stat label="Modal tercatat & aset" value={`Rp ${compact(capital)}`} sub={`Aset operasional ${compact(assets)}`} />
      </div>

      {profiles.length > 0 && (
        <section className="card card-pad mt-4">
          <SectionHead title="Legalitas & kredensial" note="Dari Profil & legalitas. Dokumen aslinya bisa ditunjukkan saat due diligence." />
          <div className="space-y-4">
            {profiles.map(([slug, pr]) => (
              <div key={slug}>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{legalLines(pr).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}</dl>
                {pr.tagline && <p className="mt-2 text-sm text-muted">{pr.tagline}</p>}
                {pr.credentials && <ul className="mt-2 space-y-1 text-sm text-muted">{pr.credentials.split(/\r?\n/).filter(Boolean).map((c, i) => <li key={i}>• {c}</li>)}</ul>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card card-pad mt-4">
        <SectionHead title="Unit usaha & traksi" />
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
          <thead><tr><th className="th">Unit</th><th className="th">Bidang</th><th className="th text-right">Pendapatan/thn</th><th className="th text-right">Laba/thn</th><th className="th text-right">Nilai wajar</th></tr></thead>
          <tbody>{g.units.map((u) => <tr key={u.company.id}><td className="td font-medium">{u.company.name}</td><td className="td text-muted">{u.company.kind}</td><td className="td tnum text-right">{compact(u.annualRev)}</td><td className="td tnum text-right">{compact(u.annualProfit)}</td><td className="td tnum text-right">{compact(u.fair)}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Skema bagi hasil" note="Berlaku di tiap unit; angkanya langsung dari pengaturan Hub, sama dengan yang dipakai saat membagi laba." />
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
          <thead><tr><th className="th">Unit</th><th className="th text-right">Cadangan</th><th className="th text-right">Kolam modal</th><th className="th text-right">Kolam kerja</th><th className="th">Anggota</th></tr></thead>
          <tbody>{f.companies.map((c) => {
            const reserve = Number(c.reserve_pct), cap = Number(c.share_capital_pct), work = Number(c.share_work_pct);
            const mem = f.cps.filter((m) => m.company_id === c.id).map((m) => f.partners.find((p) => p.id === m.partner_id)?.name).filter(Boolean).join(", ");
            return <tr key={c.id}><td className="td font-medium">{c.name}</td><td className="td tnum text-right">{pct(reserve)}</td><td className="td tnum text-right">{pct(cap)}</td><td className="td tnum text-right">{pct(work)}</td><td className="td text-muted">{mem || "–"}</td></tr>;
          })}</tbody>
        </table></div>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Dari laba bersih unit, sebagian disisihkan sebagai <b className="text-fg">dana cadangan</b>.</li>
          <li>Sisanya dibagi dua kolam: <b className="text-fg">kolam modal</b> sesuai proporsi modal tercatat tiap pihak, dan <b className="text-fg">kolam kerja</b> sesuai bobot kerja.</li>
          <li>Modal tercatat = setoran tunai + alat/biaya yang dibayar pribadi. Semuanya dicatat di Hub, tidak ada “modal abu-abu”.</li>
          <li>Pemilik digaji lewat slip; penarikan kas di luar gaji diawasi (Kondisi perusahaan).</li>
        </ol>
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Penawaran & simulasi" note={amt > 0 ? `Pendanaan Rp ${compact(amt)} untuk ${scopeName}.` : "Isi jumlah dana untuk melihat simulasinya."} />
        <form className="no-print mb-4 flex flex-wrap items-end gap-3">
          <Field label="Jumlah investasi (Rp)"><input name="amt" className="input tnum" inputMode="numeric" defaultValue={amt || ""} placeholder="mis. 100000000" /></Field>
          <button className="btn">Hitung</button>
        </form>
        {amt > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-line p-4">
              <h3 className="font-display font-semibold">A. Ekuitas</h3>
              <div className="stat-value mt-1 text-2xl">{pct(sim.equityPct, 2)}</div>
              <p className="mt-1 text-xs text-muted">Pra-dana Rp {compact(pre)} + dana Rp {compact(amt)} = pasca-dana Rp {compact(sim.post)}. Investor jadi pemilik sebesar porsi ini dan ikut bagi laba.</p>
            </article>
            <article className="rounded-xl border border-line p-4">
              <h3 className="font-display font-semibold">B. Bagi hasil pendapatan</h3>
              <div className="stat-value mt-1 text-2xl">{pct(sim.rsPct, 1)} <span className="text-sm font-normal text-muted">dari pendapatan</span></div>
              <p className="mt-1 text-xs text-muted">Sampai total diterima {sim.cap}× modal (Rp {compact(amt * sim.cap)}){sim.rsMonths ? `, perkiraan tuntas ${sim.rsMonths} bulan (skenario dasar)` : ", belum tuntas dalam 3 tahun pada skenario dasar"}. Tanpa saham.</p>
            </article>
            <article className="rounded-xl border border-line p-4">
              <h3 className="font-display font-semibold">C. Surat konversi</h3>
              <div className="stat-value mt-1 text-2xl">Cap Rp {compact(pre)}</div>
              <p className="mt-1 text-xs text-muted">Dana masuk sekarang, berubah jadi saham pada putaran berikut dengan diskon (mis. 20%) dan batas valuasi (cap) di atas. Cocok bila valuasi belum disepakati.</p>
            </article>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Simulasi untuk diskusi, bukan penawaran efek. Struktur final (akta, perjanjian, pajak) perlu notaris/penasihat hukum.</p>
        {raise.uses.length > 0 && (
          <div className="mt-4"><div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Rencana penggunaan dana</div>
            <ul className="divide-y divide-line text-sm">{raise.uses.map((u, i) => <li key={i} className="flex justify-between gap-2 py-2"><span>{u.label}</span><span className="tnum text-muted">{pct(u.pct)} · {amt > 0 ? `Rp ${compact((amt * u.pct) / 100)}` : ""}</span></li>)}</ul></div>
        )}
        {raise.note && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{raise.note}</p>}
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Faktor risiko (otomatis dari data)" />
        {risks.length === 0 ? <p className="text-sm text-muted">Tidak ada risiko besar yang terdeteksi dari data saat ini.</p> : <ul className="space-y-1.5 text-sm text-muted">{risks.map((r, i) => <li key={i}>• {r}</li>)}</ul>}
        <p className="mt-3 text-xs text-muted">Menyebut risiko apa adanya meningkatkan kepercayaan investor.</p>
      </section>

      {notes.map((n) => <section key={n.title} className="card card-pad mt-4"><h3 className="font-display font-semibold">{n.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{n.body}</p></section>)}

      {owner && (
        <form action={saveRaise} className="card card-pad no-print mt-4 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-4"><SectionHead title="Atur penawaran" note="Disimpan; dipakai prospektus dan simulasi di atas." /></div>
          <Field label="Target dana (Rp)"><input name="amount" className="input tnum" inputMode="numeric" defaultValue={raise.amount || ""} /></Field>
          <Field label="Untuk"><select name="scope" className="input" defaultValue={raise.scope}><option value="group">Seluruh grup</option>{f.companies.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Penggunaan dana (satu baris: Keterangan: persen, total 100)"><textarea name="uses" className="input" rows={4} defaultValue={raise.uses.map((u) => `${u.label}: ${u.pct}`).join("\n")} placeholder={"Peralatan & produksi: 40\nMarketing: 25\nModal kerja: 25\nCadangan: 10"} /></Field></div>
          <div className="sm:col-span-4"><Field label="Catatan untuk investor"><textarea name="note" className="input" rows={3} defaultValue={raise.note} /></Field></div>
          <div className="sm:col-span-4"><button className="btn btn-primary">Simpan penawaran</button></div>
        </form>
      )}

      <h2 className="no-print mb-3 mt-8 font-display text-lg font-semibold">Ide menjangkau investor</h2>
      <div className="no-print grid gap-3 md:grid-cols-2">
        {IDEAS.map(([t, b]) => <article key={t} className="card card-pad"><h3 className="font-display font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{b}</p></article>)}
      </div>
      <p className="mt-4 text-xs text-muted">Angka dalam rupiah dibulatkan. Total kas grup tidak ditampilkan di sini agar aman dibagikan; pakai link investor untuk tampilan baca-saja. Total modal tercatat {rupiah(capital)}.</p>
    </>
  );
}
