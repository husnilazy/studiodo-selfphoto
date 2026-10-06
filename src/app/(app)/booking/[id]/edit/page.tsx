import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import BookingForm, { type BookingInit } from "@/components/BookingForm";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { activeAddons, activePackages, activeRooms, getStudio } from "@/lib/data";
import { dateWIB, timeWIB, todayWIB } from "@/lib/format";

export const metadata = { title: "Edit Booking" };

export default async function EditBooking({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [b] = await q<{ id: number; customer_id: number; package_id: number | null; room_id: number | null; start_at: string; people: number; source: string; discount: number; notes: string; name: string; phone: string }>(
    `select b.id, b.customer_id, b.package_id, b.room_id, b.start_at, b.people, b.source, b.discount, b.notes, c.name, c.phone
       from bookings b join customers c on c.id = b.customer_id where b.id = $1`, [id]);
  if (!b) notFound();
  const items = await q<{ kind: string; ref_id: number | null; qty: number; name: string; unit_price: number }>("select kind, ref_id, qty, name, unit_price from booking_items where booking_id = $1", [id]);
  const addonQty: Record<number, number> = {};
  let customName = "", customPrice = 0;
  for (const i of items) {
    if (i.kind === "addon" && i.ref_id) addonQty[i.ref_id] = i.qty;
    if (i.kind === "custom") { customName = i.name; customPrice = i.unit_price; }
  }
  let [packages, rooms, addons, studio] = await Promise.all([activePackages(), activeRooms(), activeAddons(), getStudio()]);
  // Paket/ruang/add-on lama yang sudah dinonaktifkan tetap ditampilkan agar booking lama bisa diedit.
  const need = async (list: { id: number }[], ids: number[], sql: string) => {
    const missing = ids.filter((x) => !list.some((l) => l.id === x));
    return missing.length ? q<any>(sql, [missing]) : [];
  };
  packages = [...packages, ...(await need(packages, b.package_id ? [b.package_id] : [], "select id, name, category, price, duration_min, max_people from packages where id = any($1)"))];
  rooms = [...rooms, ...(await need(rooms, b.room_id ? [b.room_id] : [], "select id, name, color from rooms where id = any($1)"))];
  addons = [...addons, ...(await need(addons, Object.keys(addonQty).map(Number), "select id, name, price from addons where id = any($1)"))];

  const init: BookingInit = {
    id: b.id, customer: { id: b.customer_id, name: b.name, phone: b.phone }, package_id: b.package_id, room_id: b.room_id,
    date: dateWIB(b.start_at), time: timeWIB(b.start_at), people: b.people, source: b.source, discount: b.discount, notes: b.notes,
    addons: addonQty, custom_name: customName, custom_price: customPrice,
  };
  return (
    <>
      <PageHeader back={`/booking/${id}`} title="Edit Booking" subtitle="Perubahan harga tidak mengubah pembayaran yang sudah tercatat." />
      <BookingForm mode="edit" booking={init} packages={packages} rooms={rooms} addons={addons}
        studio={{ open: studio.open, close: studio.close, slot: studio.slot }} today={todayWIB()} nowTime="" />
    </>
  );
}
