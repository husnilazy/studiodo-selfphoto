import { q } from "@/lib/db";
import { driveMedia } from "@/lib/gdrive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/**
 * Unduh satu file galeri. Cepat: satu query lalu langsung arahkan browser ke unduhan Google Drive
 * (file sudah "siapa saja yang punya link"), jadi unduhan mulai seketika tanpa lewat server.
 * `?via=server` = alirkan lewat server (cadangan bila langsung gagal).
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await ctx.params;
  const id = Number(fileId);
  if (!TOKEN.test(token) || !Number.isInteger(id) || id <= 0) return new Response("Tidak ditemukan.", { status: 404 });
  const [f] = await q<{ drive_file_id: string; title: string; mime: string }>(
    `select f.drive_file_id, f.title, f.mime from customer_files f join customers c on c.id = f.customer_id
      where c.gallery_token = $1 and f.id = $2 and f.drive_file_id is not null and f.kind in ('foto_asli','foto_edit','video') and f.status in ('siap','terkirim')`,
    [token, id]);
  if (!f) return new Response("File tidak ditemukan.", { status: 404 });

  if (new URL(req.url).searchParams.get("via") !== "server") {
    return Response.redirect(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(f.drive_file_id)}&export=download&confirm=t`, 302);
  }
  const up = await driveMedia(f.drive_file_id).catch(() => null);
  if (!up || !up.ok || !up.body) return new Response("File belum bisa diambil dari penyimpanan. Coba lagi sebentar.", { status: 502 });
  const h = new Headers({
    "Content-Type": up.headers.get("content-type") ?? (f.mime || "application/octet-stream"),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.title)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const len = up.headers.get("content-length");
  if (len) h.set("Content-Length", len);
  return new Response(up.body, { headers: h });
}
