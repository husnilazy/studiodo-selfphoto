import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { driveId } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

/** Foto customer yang sudah diunggah (untuk dipakai di editor). ?q= cari nama/HP/judul/kode booking. */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json([], { status: 401 });
  const term = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const rows = await q<{ id: number; title: string; kind: string; url: string; drive_file_id: string | null; customer: string; code: string | null }>(
    `select f.id, f.title, f.kind, f.url, f.drive_file_id, c.name as customer, b.code
       from customer_files f join customers c on c.id = f.customer_id left join bookings b on b.id = f.booking_id
      where f.kind in ('foto_asli','foto_edit','album')
        and ($1 = '' or c.name ilike $2 or c.phone ilike $2 or f.title ilike $2 or b.code ilike $2)
      order by f.created_at desc limit 120`, [term, like]);
  const isImg = (r: (typeof rows)[number]) => !!r.drive_file_id || !!driveId(r.url) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(r.url);
  return NextResponse.json(rows.filter(isImg).map((r) => ({ id: r.id, title: r.title, customer: r.customer, code: r.code, kind: r.kind })));
}
