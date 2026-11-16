import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { customerByToken } from "@/lib/gallery";

export const dynamic = "force-dynamic";

/** Customer menandai / melepas favorit di galerinya. Akses hanya dengan token galeri. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const c = await customerByToken((await ctx.params).token);
  if (!c) return NextResponse.json({ error: "Galeri tidak ditemukan." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { fileId?: number; on?: boolean };
  const fileId = Number(body.fileId);
  if (!Number.isInteger(fileId) || fileId <= 0) return NextResponse.json({ error: "File tidak valid." }, { status: 400 });
  const ok = await q("select 1 from customer_files where id = $1 and customer_id = $2 and status in ('siap','terkirim')", [fileId, c.id]);
  if (!ok.length) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  if (body.on === false) await q("delete from gallery_favorites where customer_id = $1 and file_id = $2", [c.id, fileId]);
  else await q("insert into gallery_favorites (customer_id, file_id) values ($1,$2) on conflict do nothing", [c.id, fileId]);
  const [n] = await q<{ n: number }>("select count(*)::int as n from gallery_favorites where customer_id = $1", [c.id]);
  return NextResponse.json({ ok: true, count: n.n }, { headers: { "Cache-Control": "no-store" } });
}
