import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fromWIB, timeWIB } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Slot terpakai pada suatu ruang di suatu tanggal (WIB). */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json([], { status: 401 });
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? "";
  const room = Number(sp.get("room") ?? 0);
  const exclude = Number(sp.get("exclude") ?? 0) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !room) return NextResponse.json([]);
  const from = fromWIB(date, "00:00"), to = new Date(from.getTime() + 86400000);
  const rows = await q<{ code: string; start_at: string; end_at: string }>(
    `select code, start_at, end_at from bookings
      where room_id = $1 and status in ('pending','confirmed','done') and start_at < $3 and end_at > $2
        and ($4::int is null or id <> $4) order by start_at`,
    [room, from.toISOString(), to.toISOString(), exclude]);
  return NextResponse.json(rows.map((r) => ({ code: r.code, start: timeWIB(r.start_at), end: timeWIB(r.end_at) })));
}
