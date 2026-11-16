import { customerByToken, downloadableFiles } from "@/lib/gallery";
import { driveMedia } from "@/lib/gdrive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Unduh satu file dari galeri (dialirkan lewat server, nama file asli, tanpa halaman peringatan virus Google). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await ctx.params;
  const c = await customerByToken(token);
  if (!c) return new Response("Galeri tidak ditemukan.", { status: 404 });
  const id = Number(fileId);
  const [f] = Number.isInteger(id) ? await downloadableFiles(c.id, [id]) : [];
  if (!f) return new Response("File tidak ditemukan.", { status: 404 });
  const up = await driveMedia(f.driveId).catch(() => null);
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
