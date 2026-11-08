import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { applyEvents, type Window } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/**
 * API Core per perusahaan. Setiap perusahaan punya API key sendiri (Pengaturan → Sambungan).
 *
 *   POST /api/core/v1/ingest
 *   Authorization: Bearer fh_xxxxxxxx
 *   { "events": [ { "id": "2026-11-08:revenue", "date": "2026-11-08", "kind": "revenue",
 *                   "category": "penjualan", "amount": 1250000, "memo": "Omzet harian" } ] }
 *
 * `id` unik per perusahaan: mengirim ulang id yang sama MENIMPA data lama (idempoten), jadi aman diulang.
 * kind: revenue | expense | asset_purchase | capital_in | withdrawal
 * `funding`: "company" (default) atau "partner" = dibayar dari uang pribadi partner, dihitung sebagai modal.
 * `partner`: nama partner (tanpa beda huruf besar/kecil). Wajib untuk capital_in, withdrawal, dan funding "partner"
 *   — boleh dikosongkan bila unit itu hanya punya satu partner (mis. SNAPCUP).
 * Opsional `"window": {"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}`: data API di rentang itu yang tidak ikut terkirim akan dihapus
 * (cocok untuk sinkron ulang N hari terakhir; transaksi yang di-void di kasir ikut hilang di Hub).
 */
export async function POST(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "API key wajib (Authorization: Bearer …)" }, { status: 401 });
  const company = await one<{ id: number; slug: string }>("select id, slug from companies where api_key_hash = $1 and active", [sha256(key)]);
  if (!company) return NextResponse.json({ error: "API key tidak valid" }, { status: 401 });

  let body: { events?: unknown; window?: Window };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const events = Array.isArray(body.events) ? body.events : null;
  if (!events) return NextResponse.json({ error: "Field 'events' (array) wajib" }, { status: 400 });
  if (events.length > 1000) return NextResponse.json({ error: "Maksimal 1000 event per permintaan" }, { status: 413 });

  const r = await applyEvents(company, events, body.window, "api");
  return NextResponse.json({ ok: r.errors.length === 0, company: company.slug, ...r }, { status: r.errors.length && !r.upserted ? 422 : 200 });
}

export async function GET(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const c = key && (await one<{ slug: string; name: string }>("select slug, name from companies where api_key_hash = $1 and active", [sha256(key)]));
  if (!c) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, company: c.slug, name: c.name, service: "frameless-hub-core", version: 1 });
}
