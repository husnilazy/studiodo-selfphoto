import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Sesi (booking) milik satu customer, untuk memilih folder tujuan upload. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return NextResponse.json([], { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json([]);
  const rows = await q<{ id: number; code: string; day: string }>(
    `select id, code, (start_at at time zone 'Asia/Jakarta')::date::text as day from bookings
      where customer_id = $1 and status <> 'cancelled' order by start_at desc limit 30`, [id]);
  return NextResponse.json(rows.map((b) => ({ id: b.id, label: `${b.code} · ${fmtDate(b.day, { short: true })}` })), { headers: { "Cache-Control": "no-store" } });
}
