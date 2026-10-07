import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { accessToken } from "@/lib/gdrive";
import { driveId } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";
const MAX = 30 * 1024 * 1024;

const privateHost = (h: string) => /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/i.test(h) || h.endsWith(".local") || h.endsWith(".internal");

/**
 * Proxy gambar file customer (Google Drive / link) agar bisa dipakai di canvas editor tanpa terblokir CORS.
 * ?file=<id file customer>&w=<lebar thumbnail opsional>
 */
export async function GET(req: Request) {
  if (!(await currentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const id = Number(sp.get("file"));
  const w = Math.min(3000, Math.max(0, Number(sp.get("w")) || 0));
  if (!Number.isInteger(id)) return new NextResponse("Bad request", { status: 400 });
  const [f] = await q<{ url: string; drive_file_id: string | null }>("select url, drive_file_id from customer_files where id = $1", [id]);
  if (!f) return new NextResponse("Not found", { status: 404 });

  let res: Response;
  try {
    if (f.drive_file_id) {
      res = await fetch(`https://www.googleapis.com/drive/v3/files/${f.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    } else {
      const dId = driveId(f.url);
      const target = dId ? `https://lh3.googleusercontent.com/d/${dId}=w${w || 2400}` : f.url;
      const u = new URL(target);
      if (u.protocol !== "https:" || privateHost(u.hostname)) return new NextResponse("Link tidak diizinkan", { status: 400 });
      res = await fetch(u, { redirect: "follow" });
    }
  } catch {
    return new NextResponse("Gagal mengambil gambar", { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new NextResponse("Bukan gambar yang bisa dibuka", { status: 415 });
  let buf: Buffer = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) return new NextResponse("Gambar terlalu besar", { status: 413 });
  let out = type;
  if (w > 0) {
    try {
      const sharp = (await import("sharp")).default;
      buf = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      out = "image/webp";
    } catch { /* tanpa sharp: kirim apa adanya */ }
  }
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": out, "Cache-Control": "private, max-age=3600" } });
}
