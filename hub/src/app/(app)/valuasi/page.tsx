import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { loadInventory } from "@/lib/assets";
import { getVal, loadObligations, unitDefault, valueGroup } from "@/lib/valuation";
import { saveValuation } from "@/app/actions-hr";
import { compact, pct, rupiah } from "@/lib/format";
import { Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Valuasi perusahaan" };
const TONE = { rendah: "bad", sedang: "warn", tinggi: "ok" } as const;

export default async function Page() {
  const [f, user, cfg, obs, inv] = await Promise.all([loadFacts(), currentUser(), getVal(), loadObligations(), loadInventory()]);
  const g = valueGroup(f, cfg, obs, inv);
  const owner = user?.role === "owner";
  const cell = (v: number | null) => (v == null ? <span className="text-muted">–</span> : compact(v));

  return (
    <>
      <PageHead title="Valuasi perusahaan" sub="Nilai wajar grup dan tiap unit, dihitung dari data aktual dengan empat metode yang lazim dipakai investor. Indikatif, bukan penilaian resmi." />

      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat big label="Nilai wajar grup" value={`Rp ${compact(g.fair)}`} sub={`Kisaran Rp ${compact(g.fairLow)} – ${compact(g.fairHigh)} · setelah diskon ${pct(cfg.dlom)}`} />
        <Stat label="Sebelum diskon" value={`Rp ${compact(g.blended)}`} sub="Rata-rata berbobot 4 metode" />
        <Stat label="Pendapatan setahun" value={`Rp ${compact(g.annualRev)}`} sub="12 bulan terakhir (diannualisasi)" />
        <Stat label="Laba setahun" value={`Rp ${compact(g.annualProfit)}`} tone={g.annualProfit < 0 ? "bad" : "ok"} sub="Setelah semua biaya & gaji" />
      </div>

      <section className="card card-pad mt-4">
        <SectionHead title="Nilai per unit usaha" note="Nilai ekuitas (sudah memperhitungkan kas, piutang, dan hutang unit). Metode yang tidak bermakna ditandai “–”." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr><th className="th">Unit</th><th className="th text-right">Pendapatan/thn</th><th className="th text-right">Laba/thn</th><th className="th text-right">× Pendapatan</th><th className="th text-right">× Laba</th><th className="th text-right">DCF</th><th className="th text-right">Aset bersih</th><th className="th text-right">Nilai wajar</th><th className="th">Keyakinan</th></tr></thead>
            <tbody>
              {g.units.map((u) => (
                <tr key={u.company.id}>
                  <td className="td font-medium"><span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: u.company.color }} />{u.company.name}</td>
                  <td className="td tnum text-right">{compact(u.annualRev)}</td>
                  <td className="td tnum text-right">{compact(u.annualProfit)}</td>
                  <td className="td tnum text-right">{cell(u.methods.psr)}</td>
                  <td className="td tnum text-right">{cell(u.methods.per)}</td>
                  <td className="td tnum text-right">{cell(u.methods.dcf)}</td>
                  <td className="td tnum text-right">{cell(u.methods.nav)}</td>
                  <td className="td tnum text-right font-medium">{compact(u.fair)}</td>
                  <td className="td"><Pill tone={TONE[u.confidence]}>{u.confidence} · {u.monthsData} bln</Pill></td>
                </tr>
              ))}
              <tr><td className="td font-medium" colSpan={7}>Grup (jumlah unit{g.looseNet !== 0 ? `, termasuk hutang/piutang tingkat grup ${rupiah(g.looseNet)}` : ""})</td><td className="td tnum text-right font-semibold">{compact(g.fair)}</td><td className="td" /></tr>
            </tbody>
          </table>
        </div>
        {g.units.some((u) => u.notes.length) && (
          <ul className="mt-3 space-y-1 text-xs text-muted">{g.units.flatMap((u) => u.notes.map((n, i) => <li key={u.company.id + "-" + i}>• {u.company.name}: {n}</li>))}</ul>
        )}
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Nilai bagian tiap pihak (indikatif)" note="Nilai wajar unit × porsi kepemilikan di Pengaturan. Porsi yang masih 0% belum dihitung." />
        <ul className="divide-y divide-line text-sm">
          {g.units.flatMap((u) => f.cps.filter((m) => m.company_id === u.company.id && Number(m.equity_pct) > 0).map((m) => {
            const p = f.partners.find((x) => x.id === m.partner_id);
            return (
              <li key={`${u.company.id}-${m.partner_id}`} className="flex items-center justify-between gap-2 py-2.5">
                <span>{p?.name} <span className="text-xs text-muted">di {u.company.name} · {pct(Number(m.equity_pct))}</span></span>
                <b className="tnum font-medium">Rp {compact((u.fair * Number(m.equity_pct)) / 100)}</b>
              </li>
            );
          }))}
        </ul>
        {!f.cps.some((m) => Number(m.equity_pct) > 0) && <p className="text-sm text-muted">Porsi kepemilikan belum diisi. Isi di Pengaturan agar nilai tiap partner muncul.</p>}
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Cara menghitung" />
        <ul className="space-y-2 text-sm text-muted">
          <li><b className="text-fg">× Pendapatan</b>: pendapatan setahun × kelipatan unit (usaha jasa/F&B kecil umumnya sekitar 0,5–1×; produk perangkat lunak lebih tinggi), ditambah kas bersih.</li>
          <li><b className="text-fg">× Laba</b>: laba setahun × kelipatan laba (usaha kecil umumnya 3–6×). Hanya bila laba positif.</li>
          <li><b className="text-fg">DCF</b>: laba tahun berjalan ditumbuhkan {cfg.years} tahun (pertumbuhan menyusut ke {pct(cfg.tg)}), dikurangi reinvestasi {pct(cfg.reinvest)}, didiskontokan {pct(cfg.rate)} per tahun, plus nilai terminal.</li>
          <li><b className="text-fg">Aset bersih</b>: kas + aset tercatat (dipotong {pct(cfg.haircut)} karena bekas) + piutang − hutang. Ini nilai dasar bila usaha dihentikan.</li>
          <li><b className="text-fg">Diskon {pct(cfg.dlom)}</b>: usaha tertutup tidak bisa dijual cepat, jadi nilai dikurangi (discount for lack of marketability).</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Angka akan makin bisa dipercaya seiring data yang masuk (keyakinan “tinggi” bila ada 12 bulan data). Untuk transaksi saham atau pendanaan resmi, minta penilaian akuntan/penilai independen.</p>
      </section>

      {owner && (
        <form action={saveValuation} className="card card-pad mt-4 space-y-5">
          <SectionHead title="Asumsi valuasi" note="Ubah lalu simpan, semua halaman valuasi, proyeksi pasar, dan prospektus ikut berubah." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Tingkat diskonto %"><input name="rate" className="input tnum" defaultValue={cfg.rate} inputMode="decimal" /></Field>
            <Field label="Pertumbuhan terminal %"><input name="tg" className="input tnum" defaultValue={cfg.tg} inputMode="decimal" /></Field>
            <Field label="Tahun proyeksi DCF"><input name="years" className="input tnum" defaultValue={cfg.years} inputMode="numeric" /></Field>
            <Field label="Diskon usaha tertutup %"><input name="dlom" className="input tnum" defaultValue={cfg.dlom} inputMode="decimal" /></Field>
            <Field label="Potongan nilai aset %"><input name="haircut" className="input tnum" defaultValue={cfg.haircut} inputMode="decimal" /></Field>
            <Field label="Reinvestasi dari laba %"><input name="reinvest" className="input tnum" defaultValue={cfg.reinvest} inputMode="decimal" /></Field>
            <Field label="Peluang menang pipeline %"><input name="winrate" className="input tnum" defaultValue={cfg.winrate} inputMode="decimal" /></Field>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Bobot metode (otomatis dibagi ulang)</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="× Pendapatan"><input name="w_psr" className="input tnum" defaultValue={cfg.w.psr} inputMode="decimal" /></Field>
              <Field label="× Laba"><input name="w_per" className="input tnum" defaultValue={cfg.w.per} inputMode="decimal" /></Field>
              <Field label="DCF"><input name="w_dcf" className="input tnum" defaultValue={cfg.w.dcf} inputMode="decimal" /></Field>
              <Field label="Aset bersih"><input name="w_nav" className="input tnum" defaultValue={cfg.w.nav} inputMode="decimal" /></Field>
            </div>
          </div>
          <div className="space-y-4">
            {f.companies.map((c) => {
              const a = { ...unitDefault(c.slug), ...(cfg.units[c.slug] ?? {}) };
              return (
                <div key={c.id} className="rounded-xl border border-line p-3">
                  <div className="mb-2 text-sm font-medium">{c.name}</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <Field label="Kelipatan pendapatan ×"><input name={`psr_${c.slug}`} className="input tnum" defaultValue={a.psr} inputMode="decimal" /></Field>
                    <Field label="Kelipatan laba ×"><input name={`per_${c.slug}`} className="input tnum" defaultValue={a.per} inputMode="decimal" /></Field>
                    <Field label="Pertumbuhan/thn % (kosong = otomatis)"><input name={`growth_${c.slug}`} className="input tnum" defaultValue={cfg.units[c.slug]?.growth ?? ""} inputMode="decimal" /></Field>
                    <Field label="Ukuran pasar/thn (Rp)"><input name={`sam_${c.slug}`} className="input tnum" defaultValue={a.sam || ""} inputMode="numeric" /></Field>
                    <Field label="Pipeline proyek (Rp)"><input name={`pipe_${c.slug}`} className="input tnum" defaultValue={a.pipeline || ""} inputMode="numeric" /></Field>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-primary">Simpan asumsi</button>
        </form>
      )}
    </>
  );
}
