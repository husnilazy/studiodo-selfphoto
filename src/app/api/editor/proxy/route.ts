import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX = 15 * 1024 * 1024;
const privateHost = (h: string) => /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/i.test(h) || h.endsWith(".local") || h.endsWith(".internal");

/** Meneruskan gambar https (mis. logo di Google Drive) lewat server agar bisa dipakai di canvas tanpa terblokir CORS. */
export async function GET(req: Request) {
  if (!(await currentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  let u: URL;
  try { u = new URL(raw); } catch { return new NextResponse("Bad request", { status: 400 }); }
  if (u.protocol !== "https:" || privateHost(u.hostname)) return new NextResponse("Link tidak diizinkan", { status: 400 });
  let res: Response;
  try { res = await fetch(u, { redirect: "follow" }); } catch { return new NextResponse("Gagal mengambil gambar", { status: 502 }); }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new NextResponse("Bukan gambar", { status: 415 });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) return new NextResponse("Gambar terlalu besar", { status: 413 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
