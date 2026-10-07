import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ExportCsv from "@/components/ExportCsv";
import { Badge, Empty, PageHeader, Stat, Tabs } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CATEGORY_LABEL, dateWIB, fmtDateTime, rupiah, timeWIB } from "@/lib/format";
import { promoState, promoText, PROMO_KIND_LABEL } from "@/lib/pricing";
import { getPromos } from "@/lib/pricingServer";
import { CopyBtn, PromoForm, ToggleVoucher, VoucherEdit, VoucherForm, type PkgOpt } from "./forms";

export const metadata = { title: "Promo & Voucher" };

type V = {
  id: number; code: string; name: string; batch: string; kind: "percent" | "amount"; value: number; max_discount: number; min_spend: number; min_people: number;
  package_ids: number[]; categories: string[]; usage_limit: number; per_customer: number; starts_at: string | null; expires_at: string | null;
  member_only: boolean; stackable: boolean; active: boolean; customer_name: string | null; used: number; saved: number;
};

const inp = (d: string | null) => (d ? `${dateWIB(d)}T${timeWIB(d)}` : "");
const STATE_BADGE = { live: ["green", "Berjalan"], soon: ["amber", "Terjadwal"], ended: ["slate", "Berakhir"], off: ["slate", "Nonaktif"] } as const;

function voucherStatus(v: V, now: number): { key: string; label: string; tone: string } {
  if (!v.active) return { key: "nonaktif", label: "Nonaktif", tone: "slate" };
  if (v.expires_at && now >= new Date(v.expires_at).getTime()) return { key: "expired", label: "Kedaluwarsa", tone: "red" };
  if (v.usage_limit > 0 && v.used >= v.usage_limit) return { key: "habis", label: "Habis dipakai", tone: "amber" };
  if (v.starts_at && now < new Date(v.starts_at).getTime()) return { key: "aktif", label: "Belum mulai", tone: "amber" };
  return { key: "aktif", label: "Aktif", tone: "green" };
}

export default async function PromoPage({ searchParams }: { searchParams: Promise<{ tab?: string; st?: string; q?: string; b?: string }> }) {
  await requireUser(["owner", "admin"]);
  const sp = await searchParams;
  const tab = sp.tab === "voucher" ? "voucher" : "promo";
  const packages = await q<PkgOpt>("select id, name, category from packages where active order by category, price");
  const pkgName = new Map(packages.map((p) => [p.id, p.name]));
  const now = Date.now();

  const promos = tab === "promo" ? await getPromos() : [];
  const vouchers = tab === "voucher" ? await q<V>(
    `select v.*, c.name as customer_name, coalesce(r.n, 0)::int as used, coalesce(r.amt, 0) as saved
       from vouchers v left join customers c on c.id = v.customer_id
       left join (select r.voucher_id, count(*) filter (where b.status not in ('cancelled','no_show')) as n, sum(r.amount) filter (where b.status not in ('cancelled','no_show')) as amt
                    from voucher_redemptions r join bookings b on b.id = r.booking_id group by r.voucher_id) r on r.voucher_id = v.id
      order by v.created_at desc, v.id desc limit 500`) : [];

  const term = (sp.q ?? "").trim().toUpperCase();
  const shown = vouchers.filter((v) => (!term || v.code.includes(term) || v.name.toUpperCase().includes(term)) && (!sp.b || v.batch === sp.b) && (!sp.st || sp.st === "all" || voucherStatus(v, now).key === sp.st));
  const batches = [...new Set(vouchers.map((v) => v.batch))];
  const counts = { aktif: 0, used: 0, saved: 0 };
  for (const v of vouchers) { if (voucherStatus(v, now).key === "aktif") counts.aktif++; counts.used += v.used; counts.saved += Number(v.saved); }

  const scopeText = (x: { package_ids: number[]; categories: string[] }) =>
    x.package_ids.length ? x.package_ids.map((i) => pkgName.get(i) ?? `#${i}`).join(", ") : x.categories.length ? x.categories.map((c) => CATEGORY_LABEL[c]).join(", ") : "Semua paket";

  return (
    <>
      <PageHeader title="Promo & Voucher" subtitle="Diskon otomatis (dengan countdown), diskon rombongan, dan kode voucher." />
      <Tabs active={tab} items={[
        { key: "promo", label: "Promo & Diskon", href: "/promo?tab=promo" },
        { key: "voucher", label: "Voucher", href: "/promo?tab=voucher" },
      ]} />

      {tab === "promo" && (
        <section>
          <div className="mb-4 flex justify-end">
            <Sheet title="Promo Baru" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Buat Promo</button>}>
              <PromoForm packages={packages} />
            </Sheet>
          </div>
          {promos.length === 0 ? <Empty title="Belum ada promo" hint="Contoh: diskon 20% sampai Minggu dengan countdown, atau “5 orang atau lebih: Rp 28.000/orang”." /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {promos.map((p, i) => {
                const st = promoState(p, now); const [tone, label] = STATE_BADGE[st];
                return (
                  <Sheet key={p.id} title="Edit Promo" wide trigger={
                    <button className={`card hover-lift anim-rise flex w-full flex-col gap-2 p-4 text-left active:scale-[.98] ${st === "live" ? "" : "opacity-70"}`} style={{ ["--i" as string]: Math.min(i, 8) }}>
                      <div className="flex items-start justify-between gap-2">
                        <Badge tone={tone}>{label}</Badge>
                        <span className="flex gap-1.5 text-muted">
                          {p.show_countdown && <span title="Countdown tampil" className="inline-flex items-center gap-1 text-xs font-semibold"><Icon name="clock" className="size-3.5" />Countdown</span>}
                        </span>
                      </div>
                      <p className="font-display text-lg font-semibold leading-tight">{p.name}</p>
                      <p className="font-display text-xl font-bold text-accent">{promoText(p, rupiah)}</p>
                      <p className="text-xs text-muted">{PROMO_KIND_LABEL[p.kind]} · {scopeText(p)}</p>
                      <p className="text-xs text-muted">
                        {p.starts_at ? fmtDateTime(p.starts_at) : "Sekarang"} → {p.ends_at ? fmtDateTime(p.ends_at) : "tanpa batas"}
                      </p>
                    </button>}>
                    <PromoForm packages={packages} promo={{
                      id: p.id, name: p.name, label: p.label, kind: p.kind, value: p.value, min_people: p.min_people, package_ids: p.package_ids, categories: p.categories,
                      starts_at: inp(p.starts_at), ends_at: inp(p.ends_at), show_countdown: p.show_countdown, show_on_site: p.show_on_site, active: p.active,
                    }} />
                  </Sheet>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "voucher" && (
        <section>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat i={0} label="Total voucher" value={vouchers.length} icon="tag" />
            <Stat i={1} label="Masih aktif" value={counts.aktif} icon="check" tone="ok" />
            <Stat i={2} label="Kali dipakai" value={counts.used} icon="gift" />
            <Stat i={3} label="Total potongan" value={rupiah(counts.saved)} icon="dollar" tone="accent" />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <form className="flex flex-1 gap-2">
              <input type="hidden" name="tab" value="voucher" />
              <div className="relative min-w-40 flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input name="q" defaultValue={sp.q} placeholder="Cari kode atau nama…" className="input !pl-10" />
              </div>
              <select name="st" defaultValue={sp.st ?? "all"} className="input !w-auto">
                <option value="all">Semua status</option><option value="aktif">Aktif</option><option value="habis">Habis dipakai</option><option value="expired">Kedaluwarsa</option><option value="nonaktif">Nonaktif</option>
              </select>
              {batches.length > 1 && (
                <select name="b" defaultValue={sp.b ?? ""} className="input !w-auto max-w-44">
                  <option value="">Semua batch</option>{batches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
              <button className="btn">Filter</button>
            </form>
            <CopyBtn text={shown.map((v) => v.code).join("\n")} label={` Salin ${shown.length} kode`} />
            <ExportCsv name="voucher-studiodo" />
            <Sheet title="Buat Voucher" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Buat Voucher</button>}>
              <VoucherForm packages={packages} />
            </Sheet>
          </div>

          {shown.length === 0 ? <Empty title="Belum ada voucher" hint="Buat voucher massal untuk giveaway/endorse, atau satu kode khusus customer." /> : (
            <div id="report" className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Kode</th><th>Nama / batch</th><th>Potongan</th><th>Syarat</th><th className="num">Dipakai</th><th>Berlaku s/d</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {shown.map((v) => {
                    const st = voucherStatus(v, now);
                    return (
                      <tr key={v.id}>
                        <td>
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono text-sm font-bold tracking-wider">{v.code}</span>
                            <CopyBtn text={v.code} className="no-print grid size-7 place-items-center rounded-lg border border-line text-muted hover:text-accent" />
                          </span>
                        </td>
                        <td><span className="block font-semibold">{v.name || "—"}</span><span className="block text-xs text-muted">{v.batch}{v.customer_name && ` · khusus ${v.customer_name}`}</span></td>
                        <td className="whitespace-nowrap font-semibold text-accent">{v.kind === "percent" ? `${v.value}%${Number(v.max_discount) > 0 ? ` (maks ${rupiah(v.max_discount)})` : ""}` : rupiah(v.value)}</td>
                        <td className="text-xs text-muted">
                          {scopeText(v)}
                          {Number(v.min_spend) > 0 && <><br />Min. belanja {rupiah(v.min_spend)}</>}
                          {v.min_people > 1 && <><br />Min. {v.min_people} orang</>}
                          {v.member_only && <><br />Khusus member</>}
                          {v.stackable && <><br />Bisa digabung</>}
                        </td>
                        <td className="num">{v.used}{v.usage_limit > 0 ? ` / ${v.usage_limit}` : " / ∞"}{Number(v.saved) > 0 && <span className="block text-xs text-muted">{rupiah(v.saved)}</span>}</td>
                        <td className="whitespace-nowrap text-xs">{v.expires_at ? fmtDateTime(v.expires_at) : "Tanpa batas"}</td>
                        <td><Badge tone={st.tone}>{st.label}</Badge></td>
                        <td className="no-print">
                          <span className="flex justify-end gap-1.5">
                            <ToggleVoucher id={v.id} active={v.active} />
                            <Sheet title="Edit Voucher" trigger={<button className="btn btn-sm" aria-label="Edit"><Icon name="edit" className="size-4" /></button>}>
                              <VoucherEdit v={{ id: v.id, code: v.code, name: v.name, usage_limit: v.usage_limit, per_customer: v.per_customer, expires_at: inp(v.expires_at), active: v.active }} />
                            </Sheet>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
