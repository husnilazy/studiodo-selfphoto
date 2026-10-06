import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { SCOPES, oauthReady, redirectUri } from "@/lib/gdrive";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await currentUser();
  const origin = new URL(req.url).origin;
  if (!u || u.role !== "owner") return NextResponse.redirect(`${origin}/login`);
  if (!oauthReady()) return NextResponse.redirect(`${origin}/pengaturan?drive=error&msg=${encodeURIComponent("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diisi.")}`);
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("gd_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: await redirectUri(), response_type: "code",
    scope: SCOPES, access_type: "offline", prompt: "consent", state,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
}
