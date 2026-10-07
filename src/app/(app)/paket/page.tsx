import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Empty, Field, PageHeader, Tabs } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";
import { priceSuffix } from "@/lib/packageUtils";
import { deleteCatalog, saveAddon, savePackage, saveRoom } from "@/app/actions/catalog";

export const metadata = { title: "Paket & Ruang" };

type Pkg = { per_person: boolean; bookable_online: boolean; option_label: string; options: string; room_ids: number[]; image_url: string; id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; active: boolean };
type Room = { image_url: string; id: number; name: string; color: string; description: string; active: boolean };
type Addon = { id: number; name: string; price: number; active: boolean };

export default async function PaketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser(["owner", "admin"]);
  const tab = (await searchParams).tab ?? "paket";
  const [pkgs, rooms, addons] = await Promise.all([
    q<Pkg>("select p.*, coalesce((select array_agg(pr.room_id) from package_rooms pr where pr.package_id = p.id), '{}') as room_ids from packages p order by p.active desc, case p.category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, p.price"),
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
        <section>
          <div className="mb-4 flex justify-end">
            <Sheet title="Paket Baru" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Paket</button>}>
              <PackageForm rooms={rooms} />
            </Sheet>
          </div>
          {pkgs.length === 0 ? <Empty title="Belum ada paket" hint="Tambahkan paket pertama, mis. Self Photo 30 menit." /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pkgs.map((p) => (
                <Sheet key={p.id} title="Edit Paket" wide trigger={
                  <button className={`card anim-rise p-4 text-left transition active:scale-[.98] ${p.active ? "" : "opacity-55"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Badge tone="indigo">{CATEGORY_LABEL[p.category]}</Badge>
                      {!p.active && <Badge>Nonaktif</Badge>}
                    </div>
                    <p className="font-display mt-2 text-lg font-semibold leading-tight">{p.name}</p>
                    <p className="font-display tnum mt-1 text-xl font-bold text-accent">{rupiah(p.price)} <span className="text-sm font-semibold text-muted">{priceSuffix(p)}</span></p>
                    {!p.bookable_online && <p className="mt-1 text-xs font-semibold text-warn">Walk-in saja (tanpa booking online)</p>}
                    <p className="mt-1 text-xs text-muted">{p.duration_min} menit · maks {p.max_people} orang</p>
                    {p.includes && <p className="mt-2 line-clamp-2 text-xs text-muted">{p.includes}</p>}
                  </button>}>
                  <PackageForm pkg={p} rooms={rooms} />
                </Sheet>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "ruang" && (
        <section>
          <div className="mb-4 flex justify-end">
            <Sheet title="Ruang Baru" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Ruang</button>}>
              <RoomForm />
            </Sheet>
          </div>
          {rooms.length === 0 ? <Empty title="Belum ada ruang" hint="Satu ruang = satu set/background yang dipakai bergantian. Jadwal tidak boleh bentrok di ruang yang sama." /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <Sheet key={r.id} title="Edit Ruang" trigger={
                  <button className={`card anim-rise flex items-center gap-3 p-4 text-left transition active:scale-[.98] ${r.active ? "" : "opacity-55"}`}>
                    <span className="size-10 shrink-0 rounded-xl" style={{ background: r.color }} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="block truncate text-xs text-muted">{r.description || (r.active ? "Aktif" : "Nonaktif")}</span>
                    </span>
                  </button>}>
                  <RoomForm room={r} />
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

function PackageForm({ pkg, rooms }: { pkg?: Pkg; rooms: Room[] }) {
  return (
    <>
      <ActionForm action={savePackage.bind(null, pkg?.id ?? null)}>
        <Field label="Nama paket"><input name="name" className="input" required defaultValue={pkg?.name} placeholder="mis. Self Photo Basic" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <select name="category" className="input" defaultValue={pkg?.category ?? "self_photo"}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Harga"><MoneyInput name="price" defaultValue={pkg?.price} required /></Field>
          <Field label="Dihitung">
            <select name="pricing" className="input" defaultValue={pkg?.per_person ? "per_person" : "per_sesi"}>
              <option value="per_sesi">Per sesi / paket</option>
              <option value="per_person">Per orang (× jumlah orang)</option>
            </select>
          </Field>
          <Field label="Durasi (menit)"><input name="duration_min" inputMode="numeric" className="input" required defaultValue={pkg?.duration_min ?? 30} /></Field>
          <Field label="Maks. orang"><input name="max_people" inputMode="numeric" className="input" defaultValue={pkg?.max_people ?? 2} /></Field>
        </div>
        <Field label="Termasuk (opsional)"><textarea name="includes" className="input" defaultValue={pkg?.includes} placeholder="mis. 1 cetak 4R, semua soft file" /></Field>
        <Field label="Deskripsi (opsional, tampil di website)"><textarea name="description" className="input" defaultValue={pkg?.description} /></Field>
        <Field label="Link foto (opsional)" hint="Tempel link gambar (https://…) untuk tampil di website."><input name="image_url" type="url" className="input" defaultValue={pkg?.image_url} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama pilihan (opsional)" hint="mis. Warna background, Tema"><input name="option_label" className="input" defaultValue={pkg?.option_label} placeholder="Warna background" /></Field>
          <Field label="Daftar pilihan" hint="Satu per baris"><textarea name="options" className="input !min-h-[4.5rem]" defaultValue={pkg?.options} placeholder={"Soft Pink\nAesthetic Beige\nWarm Grey"} /></Field>
        </div>
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
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="bookable_online" defaultChecked={pkg?.bookable_online ?? true} className="size-5 accent-[var(--accent)]" /> Bisa dipesan online (hilangkan centang untuk paket walk-in saja)
        </label>
        <ActiveToggle on={pkg?.active ?? true} />
      </ActionForm>
      {pkg && <DeleteRow table="packages" id={pkg.id} />}
    </>
  );
}

function RoomForm({ room }: { room?: Room }) {
  return (
    <>
      <ActionForm action={saveRoom.bind(null, room?.id ?? null)}>
        <Field label="Nama ruang / background"><input name="name" className="input" required defaultValue={room?.name} placeholder="mis. Studio A – Putih Polos" /></Field>
        <Field label="Warna penanda di jadwal"><input name="color" type="color" className="input !p-1" defaultValue={room?.color ?? "#4f4fe8"} /></Field>
        <Field label="Keterangan (tampil di website)"><input name="description" className="input" defaultValue={room?.description} /></Field>
        <Field label="Link foto contoh (opsional)" hint="Tempel link gambar (https://…) agar customer bisa melihat background ini."><input name="image_url" type="url" className="input" defaultValue={room?.image_url} /></Field>
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
