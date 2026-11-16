import { customerByToken, downloadableFiles } from "@/lib/gallery";
import { driveMedia } from "@/lib/gdrive";
import { zipNames, zipResponseStream } from "@/lib/zipStream";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const MAX_FILES = 500;

/**
 * ZIP berisi foto/video galeri. `?ids=1,2,3` = pilihan; tanpa ids = semua (atau satu album bila `album=` diisi).
 * Dialirkan: unduhan langsung mulai dan tidak memenuhi memori server.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const c = await customerByToken((await ctx.params).token);
  if (!c) return new Response("Galeri tidak ditemukan.", { status: 404 });
  const u = new URL(req.url);
  const idsParam = u.searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_FILES) : undefined;
  const albumRaw = u.searchParams.get("album");
  const album = albumRaw === null ? undefined : Number(albumRaw);
  const files = (await downloadableFiles(c.id, ids, Number.isFinite(album) ? album : undefined)).slice(0, MAX_FILES);
  if (!files.length) return new Response("Tidak ada file untuk diunduh.", { status: 404 });

  const names = zipNames(files.map((f) => f.title));
  const stream = zipResponseStream(files.map((f, i) => ({
    name: names[i],
    open: async () => { const r = await driveMedia(f.driveId); return { ok: r.ok, stream: r.body }; },
  })));
  const base = `Galeri ${c.name}`.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "Galeri";
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="galeri.zip"; filename*=UTF-8''${encodeURIComponent(`${base}${files.length < 2 ? "" : ` (${files.length} file)`}.zip`)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
