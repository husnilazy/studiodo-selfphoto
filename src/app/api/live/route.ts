import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getLivePayload } from "@/lib/liveServer";
import { expireStalePending } from "@/lib/online";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await expireStalePending();
  return NextResponse.json(await getLivePayload(), { headers: { "Cache-Control": "no-store" } });
}
