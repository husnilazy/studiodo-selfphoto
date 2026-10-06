import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { appOrigin, getConfig, redirectUri, saveConfig } from "@/lib/gdrive";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = await appOrigin();
  const back = (ok: boolean, msg = "") => NextResponse.redirect(`${origin}/pengaturan?drive=${ok ? "ok" : "error"}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}`);
  const u = await currentUser();
  if (!u || u.role !== "owner") return NextResponse.redirect(`${origin}/login`);

  const sp = new URL(req.url).searchParams;
  const jar = await cookies();
  const expected = jar.get("gd_state")?.value;
  jar.delete("gd_state");
  if (sp.get("error")) return back(false, `Google: ${sp.get("error")}`);
  if (!expected || sp.get("state") !== expected) return back(false, "Sesi otorisasi tidak valid, coba lagi.");
  const code = sp.get("code");
  if (!code) return back(false, "Kode otorisasi tidak ada.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: await redirectUri(), grant_type: "authorization_code",
    }),
  });
  const j = (await res.json()) as { refresh_token?: string; id_token?: string; error_description?: string; error?: string };
  if (!res.ok) return back(false, j.error_description ?? j.error ?? "Gagal menukar kode.");
  if (!j.refresh_token) return back(false, "Google tidak memberi izin offline. Cabut akses aplikasi di akun Google lalu hubungkan ulang.");

  let email = "";
  try { email = JSON.parse(Buffer.from(j.id_token!.split(".")[1], "base64url").toString()).email ?? ""; } catch { /* email opsional */ }
  const prev = await getConfig();
  await saveConfig({ refresh_token: j.refresh_token, email, root_id: prev?.root_id });
  return back(true);
}
