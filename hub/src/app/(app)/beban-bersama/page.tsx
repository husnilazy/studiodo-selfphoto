import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { loadFacts, summary } from "@/lib/metrics";
import { allocate, getShared, SHARED_CATEGORY_CHOICES } from "@/lib/sharedcost";
import { saveSharedCost } from "@/app/actions-hr";
import { addMonths, fullMonth, pct, rupiah } from "@/lib/format";
import { CompanyDot, Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Beban bersama" };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const [f, user, cfg] = await Promise.all([loadFacts(), currentUser(), getShared()]);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : f.now;
  const owner = user?.role === "owner";
  const a = allocate(f, cfg, [month]);
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

      {owner && (
        <section className="card card-pad mt-4">
          <SectionHead title="Atur porsi (Owner)" note="Total harus 100%. Contoh: Frameless 40%, STUDIODO 50% (Self Photo + Photobooth), SNAPCUP 10%." />
          <form action={saveSharedCost} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {f.companies.map((c) => (
                <Field key={c.id} label={`${c.name} (%)`}><input name={`pct_${c.slug}`} type="number" step="0.5" min={0} max={100} defaultValue={cfg.pct[c.slug] ?? 0} className="input tnum" /></Field>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Unit yang membayar (host)"><select name="host" defaultValue={cfg.host} className="input">{f.companies.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></Field>
              <div><span className="label">Kategori biaya yang dibagi</span>
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">{SHARED_CATEGORY_CHOICES.map(([k, l]) => (
                  <label key={k} className="inline-flex items-center gap-2"><input type="checkbox" name={`cat_${k}`} defaultChecked={cfg.categories.includes(k)} className="size-4 accent-[var(--accent)]" />{l}</label>))}</div></div>
            </div>
            <button className="btn btn-primary">Simpan porsi</button>
          </form>
        </section>
      )}
      <p className="mt-4 text-xs text-muted">Photobooth APP dan STUDIODO Self Photo bisa dipisah: bagi 50% itu sesuai kesepakatanmu (mis. 40% + 10%). Alokasi ini hanya tampilan analisis; transaksi asli tetap tercatat di unit yang membayar.</p>
    </>
  );
}
