import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Empty, Field, PageHeader, Tabs } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { storageReady } from "@/lib/siteServer";
import PackageImageEditor from "@/components/PackageImageEditor";
import PackageManager, { type PkgItem } from "./PackageManager";
import MultiImageField from "@/components/MultiImageField";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";
import { imageSrc } from "@/lib/siteConfig";
import { deleteCatalog, saveAddon, savePackage, saveRoom } from "@/app/actions/catalog";

export const metadata = { title: "Paket & Ruang" };

type Pkg = { images: string[]; image_size: string; image_fit: string; image_x: number; image_y: number; per_person: boolean; bookable_online: boolean; option_label: string; options: string; room_ids: number[]; image_url: string; id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; active: boolean; min_people: number; included_people: number; extra_person_price: number; is_group: boolean; badge: string; position: number; is_event: boolean; base_hours: number; extra_hour_price: number; max_hours: number; outputs: string; event_addons: string };
type Room = { image_url: string; images: string[]; id: number; name: string; color: string; description: string; active: boolean };
type Addon = { id: number; name: string; price: number; active: boolean };

export default async function PaketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser(["owner", "admin"]);
  const storage = storageReady();
  const tab = (await searchParams).tab ?? "paket";
  const [pkgs, rooms, addons] = await Promise.all([
    q<Pkg>("select p.*, coalesce((select array_agg(pr.room_id) from package_rooms pr where pr.package_id = p.id), '{}') as room_ids from packages p order by p.active desc, case p.category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, p.position, p.price"),
    q<Room>("select * from rooms order by active desc, sort, id"),
    q<Addon>("select * from addons order by active desc, sort, id"),
  ]);

  return (
    <>
      <PageHeader title="Paket & Ruang" subtitle="Atur paket foto, ruang/background, dan add-on yang dijual." />
      <Tabs active={tab} items={[
        { key: "paket", label: `Paket (${pkgs.length})`, href: "/paket?tab=paket" },
        { key: "ruang", label: `Ruang & Background (${rooms.length})`, href: "/paket?tab=ruang" },
        { key: "addon", label: `Add-on (${addons.length})`, href: "/paket?tab=addon" },
      ]} />

      {tab === "paket" && (
        <PackageManager
          items={pkgs.map((p): PkgItem => ({
            id: p.id, name: p.name, category: p.category, price: Number(p.price), per_person: p.per_person, duration_min: p.duration_min, max_people: p.max_people,
            active: p.active, bookable_online: p.bookable_online, image_url: p.image_url, images: Array.isArray(p.images) ? p.images : [], image_fit: p.image_fit,
            image_x: p.image_x, image_y: p.image_y, includes: p.includes ?? "", room_count: p.room_ids.length, option_label: p.option_label ?? "",
            min_people: p.min_people, included_people: p.included_people, extra_person_price: Number(p.extra_person_price), is_group: p.is_group, badge: p.badge ?? "",
            is_event: p.is_event, base_hours: p.base_hours, extra_hour_price: Number(p.extra_hour_price), max_hours: p.max_hours, outputs: p.outputs ?? "",
          }))}
          editors={Object.fromEntries(pkgs.map((p) => [p.id, <PackageForm key={p.id} pkg={p} rooms={rooms} storage={storage} />]))}
          createEditor={<PackageForm rooms={rooms} storage={storage} />}
        />
      )}

      {tab === "ruang" && (
        <section>
          <div className="mb-4 flex justify-end">
            <Sheet title="Ruang Baru" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Ruang</button>}>
              <RoomForm storage={storage} />
            </Sheet>
          </div>
          {rooms.length === 0 ? <Empty title="Belum ada ruang" hint="Satu ruang = satu set/background yang dipakai bergantian. Jadwal tidak boleh bentrok di ruang yang sama." /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <Sheet key={r.id} title="Edit Ruang" trigger={
                  <button className={`card anim-rise flex items-center gap-3 p-4 text-left transition active:scale-[.98] ${r.active ? "" : "opacity-55"}`}>
                    {r.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={imageSrc(r.image_url)} alt="" loading="lazy" className="size-10 shrink-0 rounded-xl object-cover ring-2" style={{ ["--tw-ring-color" as string]: r.color }} />
                      : <span className="size-10 shrink-0 rounded-xl" style={{ background: r.color }} />}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="block truncate text-xs text-muted">{r.description || (r.active ? "Aktif" : "Nonaktif")}</span>
                    </span>
                  </button>}>
                  <RoomForm room={r} storage={storage} />
                </Sheet>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "addon" && (
        <section>
          <div className="mb-4 flex justify-end">
            <Sheet title="Add-on Baru" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Add-on</button>}>
              <AddonForm />
            </Sheet>
          </div>
          {addons.length === 0 ? <Empty title="Belum ada add-on" hint="Contoh: Cetak 4R, Tambah 10 menit, Frame, Soft file edit." /> : (
            <div className="card divide-y divide-line">
              {addons.map((a) => (
                <Sheet key={a.id} title="Edit Add-on" className="block" trigger={
                  <button className={`flex w-full items-center justify-between gap-3 p-4 text-left ${a.active ? "" : "opacity-55"}`}>
                    <span className="font-semibold">{a.name}{!a.active && " (nonaktif)"}</span>
                    <span className="tnum font-semibold text-accent">{rupiah(a.price)}</span>
                  </button>}>
                  <AddonForm addon={a} />
                </Sheet>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ActiveToggle({ on }: { on: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name="active" defaultChecked={on} className="size-5 accent-[var(--accent)]" /> Aktif (tampil saat booking)
    </label>
  );
}

function DeleteRow({ table, id }: { table: "packages" | "rooms" | "addons"; id: number }) {
  return (
    <ActionForm action={deleteCatalog.bind(null, table, id)} submit="Hapus" danger confirm="Hapus item ini?" className="mt-2" />
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line p-3.5">
      <div>
        <h3 className="font-display flex items-center gap-2 text-sm font-semibold"><span className="grid size-5 place-items-center rounded-full bg-accentsoft text-[11px] text-accent">{n}</span>{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ name, on, title, desc }: { name: string; on: boolean; title: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accentsoft">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{desc}</span></span>
    </label>
  );
}

function PackageForm({ pkg, rooms, storage }: { pkg?: Pkg; rooms: Room[]; storage: boolean }) {
  return (
    <>
      <ActionForm action={savePackage.bind(null, pkg?.id ?? null)} submit={pkg ? "Simpan perubahan" : "Buat paket"}>
        <Section n={1} title="Informasi paket" hint="Yang dilihat customer di website dan saat booking.">
          <Field label="Nama paket"><input name="name" className="input" required defaultValue={pkg?.name} placeholder="mis. Self Photo Basic" /></Field>
          <Field label="Kategori">
            <select name="category" className="input" defaultValue={pkg?.category ?? "self_photo"}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Termasuk (poin-poin di kartu)" hint="Satu poin per baris, mis. “1 cetak 4R”, “Semua soft file”."><textarea name="includes" className="input" rows={3} defaultValue={pkg?.includes} placeholder={"1 cetak 4R\nSemua soft file"} /></Field>
          <Field label="Deskripsi singkat (opsional)"><textarea name="description" className="input" rows={2} defaultValue={pkg?.description} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label kartu (opsional)" hint="Mis. Terlaris, Baru, Hemat."><input name="badge" maxLength={24} className="input" defaultValue={pkg?.badge} placeholder="Terlaris" /></Field>
            <Field label="Urutan tampil" hint="Angka kecil tampil lebih dulu dalam kategorinya."><input name="position" inputMode="numeric" className="input" defaultValue={pkg?.position ?? 0} /></Field>
          </div>
        </Section>

        <Section n={2} title="Harga & durasi">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Harga"><MoneyInput name="price" defaultValue={pkg?.price} required /></Field>
            <Field label="Dihitung">
              <select name="pricing" className="input" defaultValue={pkg?.per_person ? "per_person" : "per_sesi"}>
                <option value="per_sesi">Per sesi / paket</option>
                <option value="per_person">Per orang (× jumlah orang)</option>
              </select>
            </Field>
            <Field label="Durasi (menit)"><input name="duration_min" inputMode="numeric" className="input" required defaultValue={pkg?.duration_min ?? 30} /></Field>
          </div>
        </Section>

        <Section n={3} title="Jumlah orang & paket grup" hint="Atur batas orang per sesi. Paket grup otomatis tampil dengan label Grup di website dan bisa difilter di landing page.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimal orang"><input name="min_people" inputMode="numeric" className="input" defaultValue={pkg?.min_people ?? 1} /></Field>
            <Field label="Maksimal orang"><input name="max_people" inputMode="numeric" className="input" defaultValue={pkg?.max_people ?? 2} /></Field>
          </div>
          <Toggle name="is_group" on={pkg?.is_group ?? false} title="Paket grup" desc="Tampil dengan label “Grup” + rentang orang, dan masuk filter Paket Grup di landing page." />
          <div className="rounded-xl border border-dashed border-line p-3">
            <p className="text-sm font-semibold">Tarif orang tambahan <span className="font-normal text-muted">(untuk paket “Per sesi”)</span></p>
            <p className="mt-0.5 text-xs text-muted">Harga sesi sudah termasuk sejumlah orang; tiap orang berikutnya dikenai tarif tambahan sampai batas maksimal. Contoh: harga Rp 250.000 termasuk 4 orang, orang ke-5 dan seterusnya +Rp 30.000. Kosongkan bila tidak dipakai. Diabaikan untuk paket “Per orang”.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Sudah termasuk (orang)"><input name="included_people" inputMode="numeric" className="input" defaultValue={pkg?.included_people || ""} placeholder="mis. 4" /></Field>
              <Field label="Tarif tiap orang tambahan"><MoneyInput name="extra_person_price" defaultValue={pkg?.extra_person_price || undefined} /></Field>
            </div>
          </div>
        </Section>

        <Section n={4} title="Sewa event (per jam)" hint="Untuk photobooth event dan sejenisnya: harga untuk durasi dasar, tambah jam, dan pilihan output. Tidak dipesan lewat slot studio — pelanggan menghitung estimasi lalu bertanya lewat WhatsApp.">
          <Toggle name="is_event" on={pkg?.is_event ?? false} title="Paket sewa event" desc="Tampil di tab Sewa Event pada landing page dan memakai harga per jam. Durasi sesi, hitungan per orang, dan booking online otomatis dinonaktifkan." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Durasi dasar (jam)" hint="Harga di atas berlaku untuk durasi ini. Mis. 4."><input name="base_hours" inputMode="numeric" className="input" defaultValue={pkg?.base_hours || ""} placeholder="4" /></Field>
            <Field label="Tarif tiap jam tambahan"><MoneyInput name="extra_hour_price" defaultValue={pkg?.extra_hour_price || undefined} /></Field>
            <Field label="Maksimal jam (opsional)" hint="Kosong = durasi dasar + 8 jam."><input name="max_hours" inputMode="numeric" className="input" defaultValue={pkg?.max_hours || ""} /></Field>
          </div>
          <Field label="Tambahan & bonus FREE (opsional)" hint="Satu per baris: nama|harga|free|minimal jam. Tanpa “free” = tambahan berbayar yang bisa dipilih pelanggan. Isi “free” untuk bonus gratis (harga = nilai yang dicoret, boleh 0). Minimal jam: FREE hanya bila sewa selama itu atau lebih, di bawahnya jadi berbayar."><textarea name="event_addons" className="input" rows={4} defaultValue={pkg?.event_addons} placeholder={"Properti pesta|75000|free\nTambahan background|200000|free|6\nNeon sign custom|150000"} /></Field>
          <Field label="Pilihan output (opsional)" hint="Satu per baris: nama|selisih harga. Selisih boleh minus."><textarea name="outputs" className="input" rows={3} defaultValue={pkg?.outputs} placeholder={"100 cetak|0\nSoftfile saja|-300000"} /></Field>
        </Section>

        <Section n={5} title="Foto" hint="Tambah beberapa foto: kartu paket akan menampilkannya sebagai slide otomatis.">
          <PackageImageEditor storage={storage} initial={{ name: pkg?.name ?? "", category: pkg?.category ?? "self_photo", description: pkg?.description ?? "", includes: pkg?.includes ?? "", price: pkg?.price ?? 0,
            duration_min: pkg?.duration_min ?? 30, max_people: pkg?.max_people ?? 2, per_person: pkg?.per_person ?? false,
            image_url: pkg?.image_url ?? "", images: Array.isArray(pkg?.images) ? pkg.images : [], image_size: pkg?.image_size ?? "md", image_fit: pkg?.image_fit ?? "cover", image_x: pkg?.image_x ?? 50, image_y: pkg?.image_y ?? 50 }} />
        </Section>

        <Section n={6} title="Pilihan varian (opsional)" hint="Mis. customer memilih warna background atau tema saat booking.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama pilihan"><input name="option_label" className="input" defaultValue={pkg?.option_label} placeholder="Warna background" /></Field>
            <Field label="Daftar pilihan" hint="Satu per baris"><textarea name="options" className="input !min-h-[4.5rem]" defaultValue={pkg?.options} placeholder={"Soft Pink\nAesthetic Beige\nWarm Grey"} /></Field>
          </div>
        </Section>

        <Section n={7} title="Ketersediaan" hint="Kapan dan di mana paket ini bisa dipakai.">
          {rooms.length > 0 && (
            <fieldset>
              <legend className="label">Boleh dipakai di ruang (kosong = semua ruang)</legend>
              <div className="flex flex-wrap gap-2">
                {rooms.filter((r) => r.active || pkg?.room_ids.includes(r.id)).map((r) => (
                  <label key={r.id} className="chip cursor-pointer gap-2 has-[:checked]:!border-transparent has-[:checked]:!bg-accent has-[:checked]:!text-accentfg">
                    <input type="checkbox" name="room_ids" value={r.id} defaultChecked={pkg?.room_ids.includes(r.id)} className="sr-only" />
                    <span className="size-2.5 rounded-full" style={{ background: r.color }} />{r.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Toggle name="bookable_online" on={pkg?.bookable_online ?? true} title="Bisa dipesan online" desc="Matikan untuk paket walk-in saja: tampil di website tanpa tombol Pilih." />
          <Toggle name="active" on={pkg?.active ?? true} title="Aktif" desc="Nonaktif = disembunyikan dari website dan pilihan booking (data lama tetap aman)." />
        </Section>
      </ActionForm>
      {pkg && <DeleteRow table="packages" id={pkg.id} />}
    </>
  );
}

function RoomForm({ room, storage }: { room?: Room; storage: boolean }) {
  return (
    <>
      <ActionForm action={saveRoom.bind(null, room?.id ?? null)}>
        <Field label="Nama ruang / background"><input name="name" className="input" required defaultValue={room?.name} placeholder="mis. Studio A – Putih Polos" /></Field>
        <Field label="Warna penanda di jadwal"><input name="color" type="color" className="input !p-1" defaultValue={room?.color ?? "#1769ff"} /></Field>
        <Field label="Keterangan (tampil di website)"><input name="description" className="input" defaultValue={room?.description} /></Field>
        <MultiImageField label="Foto contoh background (tampil di website)" storage={storage} initial={[room?.image_url ?? "", ...(Array.isArray(room?.images) ? room.images : [])].filter(Boolean)} />
        <ActiveToggle on={room?.active ?? true} />
      </ActionForm>
      {room && <DeleteRow table="rooms" id={room.id} />}
    </>
  );
}

function AddonForm({ addon }: { addon?: Addon }) {
  return (
    <>
      <ActionForm action={saveAddon.bind(null, addon?.id ?? null)}>
        <Field label="Nama add-on"><input name="name" className="input" required defaultValue={addon?.name} placeholder="mis. Cetak 4R" /></Field>
        <Field label="Harga satuan"><MoneyInput name="price" defaultValue={addon?.price} required /></Field>
        <ActiveToggle on={addon?.active ?? true} />
      </ActionForm>
      {addon && <DeleteRow table="addons" id={addon.id} />}
    </>
  );
}
