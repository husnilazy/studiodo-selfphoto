import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses (IPv4 and IPv6, incl. IPv4-mapped). */
export function isPrivateIp(ip: string): boolean {
  let a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) a = mapped[1];
  if (isIP(a) === 4) {
    const [p, q] = a.split(".").map(Number);
    return p === 0 || p === 10 || p === 127 || p >= 224 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254)
      || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 192 && q === 0) || (p === 198 && (q === 18 || q === 19));
  }
  if (isIP(a) === 6) {
    return a === "::" || a === "::1" || a.startsWith("fc") || a.startsWith("fd") || /^fe[89ab]/.test(a) || a.startsWith("ff") || a.startsWith("64:ff9b");
  }
  return true; // not an IP at all: refuse
}

async function assertPublicHttps(u: URL) {
  if (u.protocol !== "https:") throw new Error("Link tidak diizinkan");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) throw new Error("Link tidak diizinkan");
  if (u.port && u.port !== "443") throw new Error("Link tidak diizinkan");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((x) => isPrivateIp(x.address))) throw new Error("Link tidak diizinkan");
}

/**
 * fetch() for a user-supplied URL: https only, the host must resolve to public addresses, and every redirect hop is checked again
 * (a plain `redirect: "follow"` would let a public page bounce the server to an internal address).
 */
export async function safeFetch(raw: string | URL, init: RequestInit = {}, maxHops = 3): Promise<Response> {
  let u = new URL(raw);
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertPublicHttps(u);
    const res = await fetch(u, { ...init, redirect: "manual", signal: init.signal ?? AbortSignal.timeout(15_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = new URL(res.headers.get("location")!, u);
      continue;
    }
    return res;
  }
  throw new Error("Terlalu banyak pengalihan");
}
