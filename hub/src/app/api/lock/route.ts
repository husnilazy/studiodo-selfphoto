import { NextResponse } from "next/server";
import { lockSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Kunci sesi (cookie sesi dihapus di server). Hanya dari halaman Hub sendiri — permintaan lintas situs ditolak. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await lockSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
