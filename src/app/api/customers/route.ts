import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json([], { status: 401 });
  const term = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const rows = await q(
    `select id, name, phone from customers
      where $1 = '' or name ilike $2 or phone ilike $2 or instagram ilike $2
      order by created_at desc limit 8`,
    [term, like],
  );
  return NextResponse.json(rows);
}
