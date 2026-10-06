import "server-only";
import type { Q } from "./db";
import { fmtDateTime, todayWIB } from "./format";

export async function checkConflict(q: Q, roomId: number | null, start: Date, end: Date, excludeId: number | null) {
  if (!roomId) return;
  const [c] = await q<{ code: string; start_at: string; end_at: string }>(
    `select code, start_at, end_at from bookings
      where room_id = $1 and status in ('pending','confirmed','done') and start_at < $3 and end_at > $2
        and ($4::int is null or id <> $4) limit 1`,
    [roomId, start.toISOString(), end.toISOString(), excludeId]);
  if (c) throw new Error(`Ruang bentrok dengan booking ${c.code} (${fmtDateTime(c.start_at)}–${fmtDateTime(c.end_at).split("· ")[1]}).`);
}

export async function genCode(q: Q) {
  const ymd = todayWIB().slice(2).replaceAll("-", "");
  const [r] = await q<{ n: number }>("select count(*)::int as n from bookings where code like $1", [`SD-${ymd}-%`]);
  let n = r.n + 1;
  for (;;) {
    const code = `SD-${ymd}-${String(n).padStart(3, "0")}`;
    const [ex] = await q("select 1 from bookings where code = $1", [code]);
    if (!ex) return code;
    n++;
  }
}

