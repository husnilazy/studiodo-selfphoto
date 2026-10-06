import "server-only";
import { listBookings, activeRooms } from "./data";
import { addDays, todayWIB } from "./format";
import type { LivePayload } from "./live";

/** Sesi hari ini (dan sesi semalam yang masih berjalan) + daftar ruang aktif. */
export async function getLivePayload(): Promise<LivePayload> {
  const today = todayWIB();
  const [rooms, rows] = await Promise.all([activeRooms(), listBookings({ from: addDays(today, -1), to: today, limit: 300 })]);
  const now = Date.now();
  const bookings = rows
    .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
    // sesi kemarin hanya relevan bila masih berjalan (dimulai manual & belum selesai)
    .filter((b) => Date.parse(b.start_at) >= Date.parse(`${today}T00:00:00+07:00`) || (b.started_at && !b.finished_at && now < Date.parse(b.end_at) + 6 * 3600_000))
    .map((b) => ({
      id: b.id, code: b.code, customer_name: b.customer_name, customer_phone: b.customer_phone, package_name: b.package_name,
      room_id: b.room_id, room_name: b.room_name, room_color: b.room_color, people: b.people,
      start_at: new Date(b.start_at).toISOString(), end_at: new Date(b.end_at).toISOString(),
      started_at: b.started_at ? new Date(b.started_at).toISOString() : null, finished_at: b.finished_at ? new Date(b.finished_at).toISOString() : null,
      status: b.status, total: b.total, paid: b.paid,
    }));
  return { serverNow: new Date().toISOString(), rooms, bookings };
}
