import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { loadFacts, summary } from "@/lib/metrics";
import { allocate, coverRange, covers, getShared, loadSharedItems, perMonth, poolFor, SHARED_CATEGORY_CHOICES } from "@/lib/sharedcost";
import { CoverForm, SharedCostForm } from "@/components/SharedForms";
import { addMonths, fullMonth, pct, rupiah } from "@/lib/format";
import { CompanyDot, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Beban bersama" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const [f, user, cfg] = await Promise.all([loadFacts(), currentUser(), getShared()]);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : f.now;
  const owner = user?.role === "owner";
  const items = await loadSharedItems(f, cfg);
  const a = allocate(f, cfg, [month], items);
  // 12 bulan sekitar bulan terpilih: tunjukkan beban per bulan setelah dibagi rata
  const strip = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 5)).map((m) => ({ m, v: poolFor(items, [m]) }));
  const active = items.filter((it) => covers(it, month));
  const multi = items.filter((it) => it.cover > 1).length;
  const labels = new Map<string, string>(SHARED_CATEGORY_CHOICES.map(([k, l]) => [k, l]));

  return (
    <>
      <PageHead title="Beban bersama" sub="Ruko, listrik, dan wifi dibayar satu unit tetapi dipakai bersama. Atur porsi tiap unit supaya laba setiap unit mencerminkan beban yang sebenarnya ia tanggung." />
      <div className="mb-5 flex items-center gap-2 text-sm">
        <Link className="btn !min-h-8" href={`/beban-bersama?m=${addMonths(month, -1)}`}>←</Link>
        <b className="min-w-28 text-center font-display">{fullMonth(month)}</b>
        <Link className="btn !min-h-8" href={`/beban-bersama?m=${addMonths(month, 1)}`}>→</Link>
      </div>

      <div className="statgrid grid-cols-2 lg:grid-cols-3">
        <Stat label="Kolam beban bersama" value={rupiah(a.pool)} sub={`${cfg.categories.map((c) => labels.get(c) ?? c).join(", ")} · dibayar ${a.host?.name ?? "—"}`} />
        <Stat label="Porsi terpasang" value={pct(a.total)} tone={Math.round(a.total) === 100 ? "ok" : "bad"} sub={cfg.configured ? "Sudah diatur Owner" : "Masih bawaan: belum disimpan"} />
        <Stat label="Ditanggung unit lain" value={rupiah(a.units.filter((u) => u.company.id !== a.host?.id).reduce((x, u) => x + u.share, 0))} sub="Yang dialihkan dari unit host" />
      </div>

      <section className="card card-pad mt-4 overflow-x-auto">
        <SectionHead title="Laba setelah beban bersama" note="Tampilan alokasi (tidak mengubah catatan transaksi)." />
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr><th className="th">Unit</th><th className="th text-right">Porsi</th><th className="th text-right">Beban ditanggung</th><th className="th text-right">Laba tercatat</th><th className="th text-right">Penyesuaian</th><th className="th text-right">Laba setelah alokasi</th></tr></thead>
          <tbody>
            {a.units.map((u) => {
              const profit = summary(f.rows, u.company.id, [month]).profit;
              return (
                <tr key={u.company.id}>
                  <td className="td font-medium"><span className="inline-flex items-center gap-2"><CompanyDot color={u.company.color} />{u.company.name}{u.company.id === a.host?.id && <Pill tone="info">host</Pill>}</span></td>
                  <td className="td tnum text-right">{pct(u.pct)}</td><td className="td tnum text-right">{rupiah(u.share)}</td>
                  <td className="td tnum text-right text-muted">{rupiah(profit)}</td>
                  <td className={`td tnum text-right ${u.adjust < 0 ? "text-bad" : u.adjust > 0 ? "text-ok" : "text-muted"}`}>{u.adjust === 0 ? "0" : `${u.adjust > 0 ? "+" : "−"}${rupiah(Math.abs(u.adjust))}`}</td>
                  <td className={`td tnum text-right font-semibold ${profit + u.adjust < 0 ? "text-bad" : ""}`}>{rupiah(profit + u.adjust)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card card-pad mt-4 overflow-x-auto">
        <SectionHead title="Beban per bulan" note="Biaya yang dibayar sekali untuk beberapa bulan (mis. sewa ruko setahun) dibagi rata per bulan, jadi tiap bulan menanggung bagian yang sama." />
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr>{strip.map((x) => <th key={x.m} className={`th text-right ${x.m === month ? "!text-fg" : ""}`}>{fullMonth(x.m)}</th>)}</tr></thead>
          <tbody><tr>{strip.map((x) => <td key={x.m} className={`td tnum text-right ${x.m === month ? "font-semibold" : "text-muted"}`}>{x.v ? rupiah(x.v) : "–"}</td>)}</tr></tbody>
        </table>
      </section>

      <section className="card card-pad mt-4 overflow-x-auto">
        <SectionHead title={`Rincian beban ${fullMonth(month)}`} note={`${active.length} pembayaran masuk kolam bulan ini · total ${rupiah(a.pool)}`} />
        {active.length === 0 ? <p className="text-sm text-muted">Belum ada biaya kategori ini di unit host untuk bulan ini.</p> : (
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr><th className="th">Dibayar</th><th className="th">Keterangan</th><th className="th text-right">Total dibayar</th><th className="th text-right">Berlaku</th><th className="th text-right">Per bulan</th></tr></thead>
            <tbody>{active.map((it) => (
              <tr key={it.id}>
                <td className="td tnum">{it.date}</td>
                <td className="td"><Link href={`/transaksi/${it.id}`} className="hover:underline">{it.memo || labels.get(it.category) || it.category}</Link><span className="ml-2 text-xs text-muted">{labels.get(it.category) ?? it.category}</span></td>
                <td className="td tnum text-right">{rupiah(it.amount)}</td>
                <td className="td text-right text-muted">{it.cover > 1 ? `${it.cover} bln (${coverRange(it)})` : "1 bulan"}</td>
                <td className="td tnum text-right font-medium">{rupiah(perMonth(it))}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </section>

      {owner && (
        <section className="card card-pad mt-4 overflow-x-auto">
          <SectionHead title="Atur masa berlaku pembayaran" note={multi ? `${multi} pembayaran dibagi lebih dari 1 bulan.` : "Contoh: sewa ruko dibayar setahun sekali → isi 12 bulan. Bagian per bulan = total ÷ bulan."} />
          {items.length === 0 ? <p className="text-sm text-muted">Belum ada biaya di kategori yang dibagi.</p> : (
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr><th className="th">Dibayar</th><th className="th">Keterangan</th><th className="th text-right">Total</th><th className="th text-right">Per bulan</th><th className="th text-right">Berlaku untuk</th></tr></thead>
              <tbody>{items.slice(0, 40).map((it) => (
                <tr key={it.id}>
                  <td className="td tnum">{it.date}</td>
                  <td className="td">{it.memo || labels.get(it.category) || it.category}</td>
                  <td className="td tnum text-right">{rupiah(it.amount)}</td>
                  <td className="td tnum text-right text-muted">{rupiah(perMonth(it))}</td>
                  <td className="td"><CoverForm id={it.id} cover={it.cover} /></td>
                </tr>))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted">Transaksi baru juga punya kolom “Berlaku untuk (bulan)” di halaman Transaksi.</p>
        </section>
      )}

      {owner && (
        <section className="card card-pad mt-4">
          <SectionHead title="Atur porsi (Owner)" note="Total harus 100%. Contoh: Frameless 40%, STUDIODO 50% (Self Photo + Photobooth), SNAPCUP 10%." />
          <SharedCostForm companies={f.companies.map((c) => ({ slug: c.slug, name: c.name }))} cfg={cfg} choices={SHARED_CATEGORY_CHOICES} configured={cfg.configured} />
        </section>
      )}
      <p className="mt-4 text-xs text-muted">Photobooth APP dan STUDIODO Self Photo bisa dipisah: bagi 50% itu sesuai kesepakatanmu (mis. 40% + 10%). Alokasi ini hanya tampilan analisis; transaksi asli tetap tercatat di unit yang membayar.</p>
    </>
  );
}
