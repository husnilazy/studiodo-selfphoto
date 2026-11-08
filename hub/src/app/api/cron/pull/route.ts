import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pullAll } from "@/lib/pull";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Tarik data dari database unit usaha (Photobooth, Frameless). Dipanggil Vercel Cron (CRON_SECRET) atau Owner yang login. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  const isCron = !!secret && !!bearer && safeEq(bearer, secret);
  if (!isCron) {
    const u = await currentUser();
    if (!u || u.role !== "owner") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ results: await pullAll() });
}
