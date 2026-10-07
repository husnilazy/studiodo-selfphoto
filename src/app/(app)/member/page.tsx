import Link from "next/link";
import ActionForm, { ActionButton } from "@/components/ActionForm";
import CustomerPicker from "@/components/CustomerPicker";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { Badge, Empty, Field, PageHeader, Stat, Tabs } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateWIB, fmtDate, rupiah, waLink } from "@/lib/format";
import { isMemberNow, nextIsReward, tierFor, visitsToReward } from "@/lib/pricing";
import { getMemberCfg } from "@/lib/pricingServer";
import { joinMember, saveMemberCfg, saveMemberPage, setMember } from "@/app/actions/member";
import { getMemberPage, materializeAutoMembers } from "@/lib/memberServer";

export const metadata = { title: "Member" };

type M = { id: number; name: string; phone: string; is_member: boolean; member_no: string; member_since: string | null; visits: number; spent: number; last_visit: string | null };

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireUser(["owner", "admin"]);
  const sp = await searchParams;
  const tab = sp.tab === "atur" ? "atur" : sp.tab === "info" ? "info" : "member";
  const cfg = await getMemberCfg();
  const term = (sp.q ?? "").trim();
  if (tab === "member") await materializeAutoMembers(cfg.auto_join_visits);
  const mpage = tab === "info" ? await getMemberPage() : null;
  const rows = tab === "member" ? await q<M>(
    `select c.id, c.name, c.phone, c.is_member, c.member_no, c.member_since,
            count(b.id) filter (where b.status = 'done')::int as visits,
            coalesce(sum(b.total) filter (where b.status = 'done'), 0) as spent,
            max(b.start_at) filter (where b.status = 'done') as last_visit
       from customers c left join bookings b on b.customer_id = c.id
      where ($1 = '' or c.name ilike $2 or c.phone ilike $2)
      group by c.id
     having c.is_member or ($3 > 0 and count(b.id) filter (where b.status = 'done') >= $3)
      order by count(b.id) filter (where b.status = 'done') desc, c.name limit 300`,
    [term, `%${term.replace(/[%_]/g, "")}%`, cfg.auto_join_visits]) : [];
  const members = rows.filter((m) => isMemberNow(cfg, m));
  const rewardReady = members.filter((m) => nextIsReward(cfg, m.visits)).length;

  return (
    <>
      <PageHeader title="Member STUDIODO" subtitle="Pelanggan setia otomatis dapat diskon, dan hadiah di kunjungan tertentu."
        actions={<Link href="/anggota" target="_blank" className="btn btn-sm"><Icon name="external" className="size-4" /> Lihat halaman member</Link>} />
      <Tabs active={tab} items={[
        { key: "member", label: "Daftar Member", href: "/member?tab=member" },
        { key: "atur", label: "Aturan & Tingkat", href: "/member?tab=atur" },
        { key: "info", label: "Halaman Member", href: "/member?tab=info" },
      ]} />
      {!cfg.enabled && <p className="mb-4 rounded-xl bg-warnsoft px-4 py-3 text-sm font-semibold text-warn">Program member sedang dimatikan — diskon member tidak berlaku. Aktifkan di tab “Aturan & Tingkat”.</p>}

      {tab === "member" && (
        <section>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat i={0} label="Jumlah member" value={members.length} icon="star" />
            <Stat i={1} label="Kunjungan berikutnya dapat hadiah" value={rewardReady} icon="gift" tone="accent" hint={cfg.reward_every ? `tiap kunjungan ke-${cfg.reward_every}` : "hadiah dimatikan"} />
            <Stat i={2} label="Total belanja member" value={rupiah(members.reduce((s, m) => s + Number(m.spent), 0))} icon="dollar" />
            <Stat i={3} label="Rata-rata kunjungan" value={members.length ? (members.reduce((s, m) => s + m.visits, 0) / members.length).toFixed(1) : "0"} icon="chart" />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <form className="flex flex-1 gap-2">
              <input type="hidden" name="tab" value="member" />
              <div className="relative min-w-40 flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input name="q" defaultValue={term} placeholder="Cari member…" className="input !pl-10" />
              </div>
              <button className="btn">Cari</button>
            </form>
            <Sheet title="Daftarkan Member" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Member</button>}>
              <ActionForm action={joinMember} submit="Daftarkan">
                <CustomerPicker />
                <p className="text-xs text-muted">Pilih customer yang sudah ada atau isi nama &amp; nomor WhatsApp untuk customer baru.</p>
              </ActionForm>
            </Sheet>
          </div>

          {members.length === 0 ? <Empty title="Belum ada member" hint="Daftarkan customer yang sering datang, atau atur pendaftaran otomatis setelah N kunjungan di tab Aturan." /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m, i) => {
                const tier = tierFor(cfg, m.visits);
                const reward = nextIsReward(cfg, m.visits);
                const left = visitsToReward(cfg, m.visits);
                const pct = cfg.reward_every ? ((cfg.reward_every - left) / cfg.reward_every) * 100 : 0;
                return (
                  <div key={m.id} className="card hover-lift anim-rise p-4" style={{ ["--i" as string]: Math.min(i, 8) }}>
                    <div className="flex items-start gap-3">
                      <span className="font-display grid size-11 shrink-0 place-items-center rounded-full bg-accentsoft text-lg font-semibold text-accent">{m.name.slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/customer/${m.id}`} className="block truncate font-semibold hover:text-accent">{m.name}</Link>
                        <p className="truncate text-xs text-muted">{m.member_no || "Auto-member"}{m.phone && ` · ${m.phone}`}</p>
                      </div>
                      {tier && <Badge tone="indigo">{tier.name} · {tier.percent}%</Badge>}
                    </div>
                    <p className="mt-3 text-xs text-muted">{m.visits}x sesi · {rupiah(m.spent)}{m.last_visit && ` · terakhir ${fmtDate(dateWIB(m.last_visit), { short: true })}`}</p>
                    {cfg.reward_every > 0 && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs font-semibold">
                          <span className={reward ? "text-ok" : "text-muted"}>{reward ? `🎁 Kunjungan berikutnya: ${cfg.reward_percent >= 100 ? "GRATIS" : `diskon ${cfg.reward_percent}%`}` : `${left} kunjungan lagi → hadiah`}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${reward ? 100 : pct}%` }} /></div>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {m.phone && <a className="btn btn-sm flex-1" target="_blank" rel="noopener noreferrer" href={waLink(m.phone, `Halo ${m.name}, `)}><Icon name="chat" className="size-4" /> WA</a>}
                      <Link className="btn btn-sm flex-1" href={`/booking/baru?customer=${m.id}`}><Icon name="plus" className="size-4" /> Transaksi</Link>
                      {m.member_no && <Link className="btn btn-sm flex-1" href={`/member/${m.id}/kartu`}><Icon name="printer" className="size-4" /> Kartu</Link>}
                      {m.is_member && <ActionButton action={setMember.bind(null, m.id, false)} confirm={`Keluarkan ${m.name} dari member?`} className="btn btn-sm btn-danger" label="Keluarkan" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "atur" && (
        <section className="max-w-2xl">
          <ActionForm action={saveMemberCfg} className="card space-y-5 p-4 sm:p-5">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="size-5 accent-[var(--accent)]" /> Program member aktif</label>
            <div>
              <p className="font-display mb-1 font-semibold">Tingkat member</p>
              <p className="mb-3 text-xs text-muted">Tingkat naik otomatis sesuai jumlah kunjungan selesai. Diskon tingkat berlaku otomatis untuk paket di setiap transaksi.</p>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_6rem_6rem] gap-2 text-xs font-semibold text-muted"><span>Nama</span><span>Min. kunjungan</span><span>Diskon %</span></div>
                {Array.from({ length: 6 }).map((_, i) => {
                  const t = cfg.tiers[i];
                  return (
                    <div key={i} className="grid grid-cols-[1fr_6rem_6rem] gap-2">
                      <input name={`tier_name_${i}`} className="input" defaultValue={t?.name} placeholder={i === 0 ? "mis. Silver" : "(kosongkan jika tidak dipakai)"} />
                      <input name={`tier_min_${i}`} inputMode="numeric" className="input" defaultValue={t?.min_visits} />
                      <input name={`tier_pct_${i}`} inputMode="numeric" className="input" defaultValue={t?.percent} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-panel2/50 p-3.5">
              <p className="font-display mb-1 font-semibold">Hadiah repeat customer</p>
              <p className="mb-3 text-xs text-muted">Setiap kunjungan ke-N, member dapat potongan khusus untuk 1 orang (100% = gratis). Diambil mana yang lebih besar antara hadiah dan diskon tingkat.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Setiap kunjungan ke- (0 = mati)"><input name="reward_every" inputMode="numeric" className="input" defaultValue={cfg.reward_every} /></Field>
                <Field label="Potongan hadiah (%)"><input name="reward_percent" inputMode="numeric" className="input" defaultValue={cfg.reward_percent} /></Field>
              </div>
            </div>
            <Field label="Daftar member otomatis setelah N kunjungan (0 = manual saja)" hint="Customer yang sudah N kali datang langsung dianggap member tanpa perlu didaftarkan.">
              <input name="auto_join_visits" inputMode="numeric" className="input" defaultValue={cfg.auto_join_visits} />
            </Field>
          </ActionForm>
        </section>
      )}
      {tab === "info" && mpage && (
        <section className="max-w-2xl">
          <ActionForm action={saveMemberPage} className="card space-y-5 p-4 sm:p-5">
            <p className="text-sm text-muted">Isi halaman <b>/anggota</b> yang dilihat member setelah login (nomor WhatsApp + kode member). Kartu digital, stempel, voucher pribadi, dan promo berjalan tampil otomatis.</p>
            <Field label="Kalimat sambutan"><textarea name="intro" className="input" defaultValue={mpage.intro} /></Field>
            <Field label="Keuntungan member" hint="Satu per baris."><textarea name="perks" className="input !min-h-28" defaultValue={mpage.perks.join("\n")} /></Field>
            <div>
              <p className="font-display mb-1 font-semibold">Info &amp; pengumuman</p>
              <p className="mb-3 text-xs text-muted">Kabar menarik khusus member: event, promo spesial, jadwal libur, dll. Kosongkan judul untuk menghapus.</p>
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => {
                  const p = mpage.posts[i];
                  return (
                    <div key={i} className="space-y-2 rounded-2xl border border-line bg-panel2/40 p-3">
                      <input name={`post_title_${i}`} className="input" defaultValue={p?.title} placeholder={`Judul info ${i + 1}`} />
                      <textarea name={`post_body_${i}`} className="input !min-h-16" defaultValue={p?.body} placeholder="Isi singkat" />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input name={`post_link_${i}`} className="input" defaultValue={p?.link} placeholder="Link (opsional)" />
                        <input name={`post_label_${i}`} className="input" defaultValue={p?.link_label} placeholder="Teks tombol" />
                        <input name={`post_until_${i}`} type="date" className="input" defaultValue={p?.until} title="Tampil sampai tanggal" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
