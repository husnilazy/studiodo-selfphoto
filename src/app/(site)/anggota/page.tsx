import Link from "next/link";
import Icon from "@/components/Icon";
import MemberCardView from "@/components/MemberCardView";
import Reveal from "@/components/site/Reveal";
import { q } from "@/lib/db";
import { CATEGORY_LABEL, dateWIB, fmtDate, rupiah, timeWIB, todayWIB } from "@/lib/format";
import { loadMemberCard } from "@/lib/memberCard";
import { getMemberPage, memberSessionId } from "@/lib/memberServer";
import { nextIsReward, promoState, promoText, visitsToReward } from "@/lib/pricing";
import { getPromos } from "@/lib/pricingServer";
import { LoginForm, LogoutButton } from "./MemberLogin";

export const metadata = { title: "Area Member", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type V = { code: string; name: string; kind: "percent" | "amount"; value: number; max_discount: number; min_spend: number; min_people: number; expires_at: string | null; usage_limit: number; per_customer: number; customer_id: number | null; used: number; mine: number };
type H = { code: string; start_at: string; status: string; package_name: string | null; total: number };

export default async function MemberArea({ searchParams }: { searchParams: Promise<{ kode?: string }> }) {
  const sp = await searchParams;
  const id = await memberSessionId();
  const d = id ? await loadMemberCard(id) : null;

  if (!d || !d.isMember) {
    return (
      <main className="px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name="star" className="size-7" /></span>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Area Member</h1>
          <p className="mb-8 mt-2 text-muted">Masuk dengan nomor WhatsApp dan kode member untuk melihat kartu, stempel, voucher, dan info khusus member.</p>
          <LoginForm code={String(sp.kode ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20)} />
          <p className="mt-6 text-sm text-muted">Belum jadi member? Tanyakan ke kasir saat sesi berikutnya — gratis!</p>
        </div>
      </main>
    );
  }

  const { customer: c, cfg, stamps } = d;
  const now = Date.now();
  const [page, promos, vouchers, history] = await Promise.all([
    getMemberPage(),
    getPromos(),
    q<V>(
      `select v.code, v.name, v.kind, v.value, v.max_discount, v.min_spend, v.min_people, v.expires_at, v.usage_limit, v.per_customer, v.customer_id,
              (select count(*)::int from voucher_redemptions r join bookings b on b.id = r.booking_id where r.voucher_id = v.id and b.status not in ('cancelled','no_show')) as used,
              (select count(*)::int from voucher_redemptions r join bookings b on b.id = r.booking_id where r.voucher_id = v.id and r.customer_id = $1 and b.status not in ('cancelled','no_show')) as mine
         from vouchers v
        where v.active and (v.expires_at is null or v.expires_at > now()) and (v.starts_at is null or v.starts_at <= now())
          and (v.customer_id = $1 or (v.customer_id is null and v.member_only and (v.usage_limit = 0 or v.usage_limit > 1)))
        order by (v.customer_id is not null) desc, v.expires_at nulls last limit 20`, [c.id]),
    q<H>(
      `select b.code, b.start_at, b.status, p.name as package_name, b.total from bookings b left join packages p on p.id = b.package_id
        where b.customer_id = $1 and b.status in ('done','confirmed','pending') order by b.start_at desc limit 6`, [c.id]),
  ]);
  const myVouchers = vouchers.filter((v) => !(v.usage_limit > 0 && v.used >= v.usage_limit) && !(v.per_customer > 0 && v.mine >= v.per_customer)).slice(0, 8);
  const livePromos = promos.filter((p) => p.show_on_site && promoState(p, now) === "live").slice(0, 4);
  const today = todayWIB();
  const posts = page.posts.filter((p) => !p.until || p.until >= today);
  const reward = nextIsReward(cfg, c.visits), left = visitsToReward(cfg, c.visits);
  const tierPct = cfg.tiers.find((t) => t.name === d.tier)?.percent ?? 0;
  const first = c.name.split(" ")[0];

  return (
    <main className="px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-accent">⭐ Member {d.tier}</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Halo, {first}!</h1>
              <p className="mt-1 max-w-xl text-muted">{page.intro}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/book" className="btn btn-primary btn-glow !rounded-full">Booking sekarang</Link>
              <LogoutButton />
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <MemberCardView side="front" brand={d.brand} name={c.name} code={c.member_no} tier={d.tier} since={d.since} qrSvg={d.qrSvg} host={d.host} stamps={stamps} />
            <MemberCardView side="back" brand={d.brand} name={c.name} code={c.member_no} tier={d.tier} since={d.since} host={d.host} stamps={stamps} />
          </div>
        </Reveal>

        <Reveal>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile k="Total kunjungan" v={`${c.visits}x`} />
            <Tile k="Level" v={d.tier || "—"} />
            <Tile k="Diskon member" v={tierPct ? `${tierPct}%` : "—"} />
            <Tile k="Hadiah berikutnya" v={cfg.reward_every ? (reward ? "Kunjungan ini! 🎁" : `${left} kunjungan lagi`) : "—"} accent={reward} />
          </div>
        </Reveal>

        {posts.length > 0 && (
          <Reveal>
            <h2 className="font-display mb-3 text-xl font-semibold">Info untuk member</h2>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {posts.map((p, i) => (
                <article key={i} className="glass lift rounded-3xl p-5">
                  <h3 className="font-display text-lg font-semibold leading-tight">{p.title}</h3>
                  {p.body && <p className="mt-2 whitespace-pre-line text-sm text-muted">{p.body}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                    {p.until && <span>Sampai {fmtDate(p.until, { short: true })}</span>}
                    {p.link && <a href={p.link} className="font-bold text-accent" target={p.link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{p.link_label || "Selengkapnya"} →</a>}
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        )}

        {(myVouchers.length > 0 || livePromos.length > 0) && (
          <Reveal>
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {myVouchers.length > 0 && (
                <section>
                  <h2 className="font-display mb-3 text-xl font-semibold">Voucher kamu</h2>
                  <div className="space-y-3">
                    {myVouchers.map((v) => (
                      <div key={v.code} className="glass flex items-center justify-between gap-3 rounded-2xl p-4">
                        <div className="min-w-0">
                          <p className="font-mono text-base font-bold tracking-widest">{v.code}</p>
                          <p className="truncate text-sm font-semibold text-accent">{v.kind === "percent" ? `Diskon ${v.value}%` : `Potongan ${rupiah(v.value)}`}{v.max_discount > 0 && ` (maks ${rupiah(v.max_discount)})`}</p>
                          <p className="text-xs text-muted">
                            {v.name}{v.min_spend > 0 && ` · min. ${rupiah(v.min_spend)}`}{v.min_people > 1 && ` · min. ${v.min_people} orang`}{v.expires_at && ` · s/d ${fmtDate(dateWIB(v.expires_at), { short: true })}`}
                          </p>
                        </div>
                        <Icon name="gift" className="size-6 shrink-0 text-accent" />
                      </div>
                    ))}
                    <p className="text-xs text-muted">Masukkan kode saat booking online atau tunjukkan ke kasir.</p>
                  </div>
                </section>
              )}
              {livePromos.length > 0 && (
                <section>
                  <h2 className="font-display mb-3 text-xl font-semibold">Promo berjalan</h2>
                  <div className="space-y-3">
                    {livePromos.map((p) => (
                      <div key={p.id} className="glass rounded-2xl p-4">
                        <p className="font-semibold">{p.label || p.name}</p>
                        <p className="text-sm font-bold text-accent">{promoText(p, rupiah)}</p>
                        <p className="text-xs text-muted">
                          {p.package_ids.length ? "Paket tertentu" : p.categories.length ? p.categories.map((x) => CATEGORY_LABEL[x]).join(", ") : "Semua paket"}
                          {p.ends_at && ` · s/d ${fmtDate(dateWIB(p.ends_at), { short: true })} ${timeWIB(p.ends_at)}`}
                        </p>
                      </div>
                    ))}
                    <p className="text-xs text-muted">Promo berlaku otomatis; diskon member dipilih yang paling menguntungkan.</p>
                  </div>
                </section>
              )}
            </div>
          </Reveal>
        )}

        <Reveal>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold">Keuntungan member</h2>
              <ul className="glass space-y-2 rounded-3xl p-5 text-sm">
                {page.perks.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accentsoft text-accent"><Icon name="check" className="size-2.5" /></span>{t}</li>)}
                {cfg.tiers.map((t) => <li key={t.name} className="flex gap-2 text-muted"><Icon name="star" className="mt-0.5 size-4 shrink-0 text-accent" />{t.name}: diskon {t.percent}% (mulai {t.min_visits}x kunjungan)</li>)}
              </ul>
            </section>
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold">Riwayat terakhir</h2>
              {history.length === 0 ? <p className="glass rounded-3xl p-5 text-sm text-muted">Belum ada sesi. Yuk booking sesi pertamamu!</p> : (
                <ul className="glass divide-y divide-line rounded-3xl px-5 text-sm">
                  {history.map((h) => (
                    <li key={h.code} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0"><span className="block truncate font-semibold">{h.package_name ?? "Sesi foto"}</span><span className="text-xs text-muted">{fmtDate(dateWIB(h.start_at), { short: true })} · {h.status === "done" ? "Selesai" : "Terjadwal"}</span></span>
                      <span className="tnum shrink-0 font-semibold">{rupiah(h.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Reveal>
      </div>
    </main>
  );
}

function Tile({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="glass lift rounded-2xl p-4">
      <p className="text-xs font-semibold text-muted">{k}</p>
      <p className={`font-display mt-1 text-xl font-bold ${accent ? "text-accent" : ""}`}>{v}</p>
    </div>
  );
}
