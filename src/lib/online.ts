import "server-only";
import { one, q } from "./db";
import { getStudio } from "./data";
import { fromWIB, addDays, timeWIB, todayWIB } from "./format";

export type Online = {
  enabled: boolean; dp_percent: number; pay_info: string; lead_min: number; days_ahead: number; hold_min: number;
  whatsapp: string; instagram: string; maps_url: string; tagline: string;
};
export const ONLINE_DEFAULT: Online = {
  enabled: true, dp_percent: 30, pay_info: "", lead_min: 60, days_ahead: 30, hold_min: 180,
  whatsapp: "", instagram: "", maps_url: "", tagline: "",
};

export async function getOnline(): Promise<Online> {
  const r = await one<{ value: Partial<Online> }>("select value from settings where key = 'online'");
  return { ...ONLINE_DEFAULT, ...(r?.value ?? {}) };
}

/** Booking online yang belum dibayar & melewati batas tahan otomatis dibatalkan agar slot terbuka lagi. */
let lastExpire = 0;
export async function expireStalePending() {
  if (Date.now() - lastExpire < 30_000) return; // cukup tiap 30 detik per instance
  lastExpire = Date.now();
  const o = await getOnline();
  if (o.hold_min <= 0 || o.dp_percent <= 0) return; // tanpa DP, booking tidak dilepas otomatis
  await q(
    `update bookings set status = 'cancelled', notes = trim(notes || ' [Dibatalkan otomatis: melewati batas waktu DP]')
      where source = 'website' and status = 'pending' and created_at < now() - ($1 || ' minutes')::interval
        and not exists (select 1 from payments p where p.booking_id = bookings.id and not p.voided)`,
    [String(o.hold_min)]);
}

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Jam mulai yang masih tersedia untuk paket pada tanggal tertentu, beserta ruang yang kosong di jam itu. */
export async function publicSlots(date: string, packageId: number, roomId: number | null) {
  const [o, studio] = await Promise.all([getOnline(), getStudio()]);
  const today = todayWIB();
  if (!o.enabled || date < today || date > addDays(today, o.days_ahead)) return [];
  const pkg = await one<{ duration_min: number }>("select duration_min from packages where id = $1 and active and bookable_online", [packageId]);
  if (!pkg) return [];
  const allowed = (await q<{ room_id: number }>("select room_id from package_rooms where package_id = $1", [packageId])).map((r) => r.room_id);
  const rooms = (await q<{ id: number }>("select id from rooms where active order by sort, id")).map((r) => r.id)
    .filter((id) => (allowed.length === 0 || allowed.includes(id)) && (roomId === null || id === roomId));
  if (!rooms.length) return [];

  const from = fromWIB(date, "00:00"), to = new Date(from.getTime() + 86400000);
  const busy = await q<{ room_id: number; start_at: string; end_at: string }>(
    `select room_id, start_at, end_at from bookings
      where room_id = any($1) and status in ('pending','confirmed','done') and start_at < $3 and end_at > $2`,
    [rooms, from.toISOString(), to.toISOString()]);
  const iv = busy.map((b) => ({ room: b.room_id, s: toMin(timeWIB(b.start_at)), e: toMin(timeWIB(b.end_at)) || 1440 }));

  const earliest = Date.now() + o.lead_min * 60000;
  const out: { t: string; rooms: number[] }[] = [];
  for (let m = toMin(studio.open); m + pkg.duration_min <= toMin(studio.close); m += studio.slot) {
    if (fromWIB(date, hhmm(m)).getTime() < earliest) continue;
    const free = rooms.filter((r) => !iv.some((x) => x.room === r && m < x.e && m + pkg.duration_min > x.s));
    if (free.length) out.push({ t: hhmm(m), rooms: free });
  }
  return out;
}

