import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hubConfigured, syncToHub } from "@/lib/hubSync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Sinkron ke Frameless Hub. Boleh dipanggil Owner (buka URL ini saat login) atau Vercel Cron (CRON_SECRET). */
export async function GET(req: Request) {
  const cron = process.env.CRON_SECRET?.trim();
  const isCron = !!cron && req.headers.get("authorization") === `Bearer ${cron}`;
  if (!isCron) {
    const u = await currentUser();
    if (!u || u.role !== "owner") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hubConfigured()) return NextResponse.json({ error: "HUB_URL / HUB_API_KEY belum diisi" }, { status: 503 });
  const days = Number(new URL(req.url).searchParams.get("days")) || 45;
  try {
    return NextResponse.json(await syncToHub(days));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "gagal sinkron" }, { status: 502 });
  }
}
