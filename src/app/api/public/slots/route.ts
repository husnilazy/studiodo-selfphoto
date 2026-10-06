import { NextResponse } from "next/server";
import { expireStalePending, publicSlots } from "@/lib/online";

export const dynamic = "force-dynamic";

/** Publik: jam kosong untuk paket pada tanggal tertentu. Tidak membocorkan data customer. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? "";
  const pkg = Number(sp.get("package"));
  const room = Number(sp.get("room")) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(pkg) || pkg <= 0) return NextResponse.json({ slots: [] });
  await expireStalePending();
  return NextResponse.json({ slots: await publicSlots(date, pkg, room) }, { headers: { "Cache-Control": "no-store" } });
}
