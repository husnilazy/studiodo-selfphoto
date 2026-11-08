import { NextResponse } from "next/server";
import { one, tx } from "@/lib/db";
import { sha256 } from "@/lib/auth";

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
const KINDS = new Set(["revenue", "expense", "asset_purchase", "capital_in", "withdrawal"]);
const NEEDS_PARTNER = new Set(["capital_in", "withdrawal"]);

export async function POST(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "API key wajib (Authorization: Bearer …)" }, { status: 401 });
  const company = await one<{ id: number; slug: string }>("select id, slug from companies where api_key_hash = $1 and active", [sha256(key)]);
  if (!company) return NextResponse.json({ error: "API key tidak valid" }, { status: 401 });

  let body: { events?: unknown; window?: { from?: string; to?: string } };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 }); }
  const events = Array.isArray(body.events) ? body.events : null;
  if (!events) return NextResponse.json({ error: "Field 'events' (array) wajib" }, { status: 400 });
  if (events.length > 1000) return NextResponse.json({ error: "Maksimal 1000 event per permintaan" }, { status: 413 });

  const win = body.window;
  const hasWin = !!win && /^\d{4}-\d{2}-\d{2}$/.test(win.from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(win.to ?? "");
  const errors: { index: number; error: string }[] = [];
  let upserted = 0;
  let removed = 0;
  await tx(async (t) => {
    const linked = await t<{ id: number; name: string }>(
      "select p.id, p.name from partners p join company_partners cp on cp.partner_id = p.id where cp.company_id = $1", [company.id]);
    for (const [i, raw] of events.entries()) {
      const e = raw as Record<string, unknown>;
      const id = String(e.id ?? ""), date = String(e.date ?? ""), kind = String(e.kind ?? "");
      const amount = Math.round(Number(e.amount));
      if (!id || id.length > 120) { errors.push({ index: i, error: "id wajib (≤120 karakter)" }); continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push({ index: i, error: "date harus YYYY-MM-DD" }); continue; }
      if (!KINDS.has(kind)) { errors.push({ index: i, error: "kind tidak dikenal" }); continue; }
      if (!Number.isFinite(amount) || amount < 0) { errors.push({ index: i, error: "amount harus angka ≥ 0" }); continue; }
      // Partner & sumber dana. Penarikan/modal selalu terkait partner; biaya/aset hanya bila dibayar pribadi.
      let funding = e.funding === "partner" ? "partner" : "company";
      if (kind === "revenue") funding = "company";
      const wantsPartner = NEEDS_PARTNER.has(kind) || funding === "partner";
      let partnerId: number | null = null;
      if (wantsPartner) {
        const name = String(e.partner ?? "").trim().toLowerCase();
        const hit = name ? linked.find((p) => p.name.toLowerCase() === name) : linked.length === 1 ? linked[0] : undefined;
        if (!hit) { errors.push({ index: i, error: name ? `partner "${e.partner}" tidak ada di unit ini` : "partner wajib diisi (unit punya lebih dari satu partner)" }); continue; }
        partnerId = hit.id;
      }
      await t(
        `insert into transactions (company_id,date,kind,category,amount,funding,partner_id,memo,source,external_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'api',$9)
         on conflict (company_id, external_id) where external_id is not null
         do update set date=excluded.date, kind=excluded.kind, category=excluded.category, amount=excluded.amount,
                       funding=excluded.funding, partner_id=excluded.partner_id, memo=excluded.memo`,
        [company.id, date, kind, String(e.category ?? "lainnya").slice(0, 40), amount, funding, partnerId, String(e.memo ?? "").slice(0, 200), id],
      );
      upserted++;
    }
    // Jendela sinkron: baris API di rentang tanggal itu yang tidak lagi dikirim (mis. transaksi di-void di kasir) dihapus.
    if (hasWin && !errors.length) {
      const keep = events.map((e) => String((e as Record<string, unknown>).id ?? ""));
      const del = await t<{ id: number }>(
        "delete from transactions where company_id=$1 and source='api' and date between $2 and $3 and not (external_id = any($4)) returning id",
        [company.id, win!.from, win!.to, keep]);
      removed = del.length;
    }
    await t("update companies set last_sync_at = now() where id = $1", [company.id]);
  });
  return NextResponse.json({ ok: errors.length === 0, company: company.slug, upserted, removed, errors }, { status: errors.length && !upserted ? 422 : 200 });
}

export async function GET(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const c = key && (await one<{ slug: string; name: string }>("select slug, name from companies where api_key_hash = $1 and active", [sha256(key)]));
  if (!c) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, company: c.slug, name: c.name, service: "frameless-hub-core", version: 1 });
}
