// Logika status sesi live — murni (tanpa server), dipakai server & client agar hitung mundur akurat.

export type LiveBooking = {
  id: number; code: string; customer_name: string; customer_phone: string; package_name: string | null;
  room_id: number | null; room_name: string | null; room_color: string | null; people: number;
  start_at: string; end_at: string; started_at: string | null; finished_at: string | null;
  status: string; total: number; paid: number;
};
export type LiveRoom = { id: number; name: string; color: string };
export type LivePayload = { serverNow: string; rooms: LiveRoom[]; bookings: LiveBooking[] };

export type LiveState = "running" | "overtime" | "soon" | "late" | "missed" | "upcoming" | "done";

const MIN = 60_000;

export function stateOf(b: LiveBooking, now: number): LiveState {
  const start = Date.parse(b.start_at), end = Date.parse(b.end_at);
  if (b.finished_at) return "done";
  if (b.started_at) return now >= end ? "overtime" : "running";
  // belum dimulai manual
  if (b.status === "done") return now >= end ? "done" : now >= start ? "running" : "upcoming";
  if (b.status === "confirmed") {
    if (now >= end) return "missed";
    if (now >= start) return "running";
    return start - now <= 10 * MIN ? "soon" : "upcoming";
  }
  // pending (belum DP / belum konfirmasi)
  if (now >= end) return "missed";
  if (now >= start) return "late";
  return start - now <= 10 * MIN ? "soon" : "upcoming";
}

/** Waktu efektif sesi berjalan (jika dimulai manual, timer dihitung dari tombol Mulai). */
export function effectiveWindow(b: LiveBooking) {
  const start = Date.parse(b.start_at), end = Date.parse(b.end_at);
  if (b.started_at) {
    const s = Date.parse(b.started_at);
    return { start: s, end: s + (end - start) };
  }
  return { start, end };
}

export const fmtClock = (ms: number) => {
  const neg = ms < 0, t = Math.abs(Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return `${neg ? "+" : ""}${h > 0 ? `${h}:` : ""}${mm}:${ss}`;
};
