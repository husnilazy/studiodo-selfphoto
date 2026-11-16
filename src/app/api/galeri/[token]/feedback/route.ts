import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { customerByToken } from "@/lib/gallery";

export const dynamic = "force-dynamic";

/** Ulasan singkat dari customer (bintang + pesan). Dibatasi agar tidak bisa dibanjiri. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const c = await customerByToken((await ctx.params).token);
  if (!c) return NextResponse.json({ error: "Galeri tidak ditemukan." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { rating?: number; message?: string; name?: string };
  const rating = Math.round(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: "Pilih 1–5 bintang." }, { status: 400 });
  const message = String(b.message ?? "").trim().slice(0, 600);
  const name = String(b.name ?? "").trim().slice(0, 60);
  const [recent] = await q<{ n: number }>("select count(*)::int as n from gallery_feedback where customer_id = $1 and created_at > now() - interval '1 minute'", [c.id]);
  const [total] = await q<{ n: number }>("select count(*)::int as n from gallery_feedback where customer_id = $1", [c.id]);
  if (recent.n > 0 || total.n >= 10) return NextResponse.json({ error: "Terima kasih, ulasanmu sudah kami terima." }, { status: 429 });
  await q("insert into gallery_feedback (customer_id, rating, message, name) values ($1,$2,$3,$4)", [c.id, rating, message, name]);
  return NextResponse.json({ ok: true });
}
