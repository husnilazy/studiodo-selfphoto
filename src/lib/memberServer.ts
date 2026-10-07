import "server-only";
import { cookies, headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { q, one } from "./db";
import { signValue } from "./auth";
import { sanitizePage, type MemberPage } from "./memberPage";

const COOKIE = "sd_member";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function getMemberPage(): Promise<MemberPage> {
  const r = await one<{ value: unknown }>("select value from settings where key = 'member_page'");
  return sanitizePage(r?.value);
}

export const digits = (s: string) => s.replace(/\D/g, "");

export async function startMemberSession(customerId: number) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `${customerId}.${exp}`;
  (await cookies()).set(COOKIE, `${body}.${signValue(`m:${body}`)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}
export async function endMemberSession() { (await cookies()).delete(COOKIE); }

/** id customer dari cookie member yang sah, atau null. */
export async function memberSessionId(): Promise<number | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expect = signValue(`m:${id}.${exp}`);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return Number(id);
}

/** Alamat situs saat ini (untuk QR di kartu). */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { host, origin: `${proto}://${host}` };
}

/** Pastikan customer yang memenuhi syarat auto-member punya nomor member (sekali jalan, murah). */
export async function materializeAutoMembers(minVisits: number) {
  if (minVisits <= 0) return;
  await q(
    `update customers c set is_member = true, member_since = coalesce(member_since, (now() at time zone 'Asia/Jakarta')::date),
            member_no = case when member_no = '' then 'SD-' || lpad(c.id::text, 4, '0') else member_no end
      where not (is_member and member_no <> '')
        and (select count(*) from bookings b where b.customer_id = c.id and b.status = 'done') >= $1`, [minVisits]);
}
