import "server-only";
import { Pool } from "pg";
import { one } from "./db";
import { applyEvents } from "./ingest";

/**
 * Penarik langsung: Hub membaca ringkasan harian dari database Neon unit usaha lewat role BACA-SAJA (`hub_reader`),
 * lalu menerapkannya ke buku besar. Tidak ada perubahan di aplikasi sumber. Idempoten (id event stabil + jendela tanggal).
 */
type Ev = { id: string; date: string; kind: "revenue" | "expense" | "asset_purchase"; category: string; amount: number; memo: string; project?: string; ref?: string };
type Q = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Semua timestamp di sumber disimpan UTC tanpa zona; +7 jam = tanggal WIB. */
const WIB = (col: string) => `to_char(${col} + interval '7 hours', 'YYYY-MM-DD')`;
const n = (v: unknown) => Math.round(Number(v) || 0);
const s = (v: unknown) => String(v ?? "");

/** Photobooth APP = platform SaaS: pendapatan = langganan tenant (Midtrans, status paid) + pembayaran manual dari admin. */
async function photobooth(q: Q, _since: string): Promise<Ev[]> {
  const out: Ev[] = [];
  const paid = await q(`select ${WIB("paid_at")} as d, sum(amount)::float8 as t, count(*)::int as c
    from billing_orders where status = 'paid' and paid_at is not null group by 1`);
  for (const r of paid) if (n(r.t) > 0) out.push({ id: `pb:sub:${s(r.d)}`, date: s(r.d), kind: "revenue", category: "langganan", amount: n(r.t), memo: `Langganan tenant (${n(r.c)} order)` });
  const man = await q(`select ${WIB("created_at")} as d, sum(amount)::float8 as t, count(*)::int as c from tenant_payments group by 1`);
  for (const r of man) if (n(r.t) > 0) out.push({ id: `pb:man:${s(r.d)}`, date: s(r.d), kind: "revenue", category: "langganan", amount: n(r.t), memo: `Pembayaran manual tenant (${n(r.c)})` });
  return out;
}

const FC_CAT: [RegExp, string][] = [
  [/gaji|honor|upah/i, "gaji"], [/sewa/i, "sewa"], [/utilitas|listrik|internet|air/i, "utilitas"],
  [/iklan|marketing|promo/i, "marketing"], [/bahan|hpp/i, "bahan"], [/pajak|legal/i, "pajak"],
];
const fcCat = (name: string) => FC_CAT.find(([re]) => re.test(name))?.[1] ?? "operasional";

/** Frameless Creative (frameless super app): pembayaran invoice + pemasukan lain, biaya, dan peralatan. */
async function frameless(q: Q, since: string): Promise<Ev[]> {
  const out: Ev[] = [];
  // Per pembayaran (bukan ringkasan harian) supaya tiap angka bisa ditelusuri ke invoice, klien, dan proyeknya.
  const pay = await q(`select p.id, ${WIB('p."paidAt"')} as d, p.amount::float8 as t, p.method, i.number as inv,
      pr.title as ptitle, pr.client as pclient, c.name as cname
    from payments p join invoices i on i.id = p."invoiceId" left join projects pr on pr.id::text = i."projectId" left join clients c on c.id = i."clientId"
    where ${WIB('p."paidAt"')} >= $1`, [since]);
  for (const r of pay) if (n(r.t) > 0) {
    const who = s(r.cname) || s(r.pclient);
    out.push({ id: `fc:pay:${s(r.id)}`, date: s(r.d), kind: "revenue", category: "proyek", amount: n(r.t), project: s(r.ptitle) || undefined, ref: s(r.inv) || undefined,
      memo: `Pembayaran ${s(r.inv) || "invoice"}${who ? ` · ${who}` : ""}${r.method ? ` (${s(r.method)})` : ""}` });
  }
  const inc = await q(`select to_char(date, 'YYYY-MM-DD') as d, sum(amount)::float8 as t, count(*)::int as c from income_entries where to_char(date, 'YYYY-MM-DD') >= $1 group by 1`, [since]);
  for (const r of inc) if (n(r.t) > 0) out.push({ id: `fc:inc:${s(r.d)}`, date: s(r.d), kind: "revenue", category: "lainnya", amount: n(r.t), memo: `Pemasukan lain (${n(r.c)})` });
  const exp = await q(`select e.id, ${WIB("e.date")} as d, e.category, e.description, e.amount::float8 as t, pr.title as ptitle
    from expenses e left join projects pr on pr.id::text = e."projectId" where ${WIB("e.date")} >= $1`, [since]);
  for (const r of exp) if (n(r.t) > 0) out.push({ id: `fc:exp:${s(r.id)}`, date: s(r.d), kind: "expense", category: fcCat(s(r.category)), amount: n(r.t), project: s(r.ptitle) || undefined, memo: s(r.description).slice(0, 120) || `Biaya ${s(r.category)}` });
  const eq = await q(`select id, name, to_char(purchase_date, 'YYYY-MM-DD') as d, purchase_price::float8 as p from equipment where purchase_price > 0 and purchase_date is not null and to_char(purchase_date, 'YYYY-MM-DD') >= $1`, [since]);
  for (const r of eq) out.push({ id: `fc:eq:${s(r.id)}`, date: s(r.d), kind: "asset_purchase", category: "alat", amount: n(r.p), memo: s(r.name).slice(0, 80) });
  return out;
}

/** `since`: tarikan hanya mengambil data pada/ setelah tanggal ini. Frameless: sebelum itu buku kas Excel adalah sumber utama. */
export const SOURCES: Record<string, { env: string; label: string; since: string; build: (q: Q, since: string) => Promise<Ev[]> }> = {
  photobooth: { env: "PHOTOBOOTH_DATABASE_URL", label: "Neon Photobooth APP", since: "2000-01-01", build: photobooth },
  frameless: { env: "FRAMELESS_DATABASE_URL", label: "Neon Frameless Super App", since: process.env.FRAMELESS_PULL_SINCE?.trim() || "2026-09-01", build: frameless },
};
export const configured = (slug: string) => !!process.env[SOURCES[slug]?.env ?? ""]?.trim();

export async function pullCompany(slug: string): Promise<{ slug: string; sent: number; upserted: number; removed: number; errors: unknown[] }> {
  const src = SOURCES[slug];
  const url = process.env[src?.env ?? ""]?.trim();
  if (!src || !url) throw new Error(`Sumber untuk "${slug}" belum dikonfigurasi (${src?.env ?? "tidak dikenal"}).`);
  const company = await one<{ id: number }>("select id from companies where slug = $1 and active", [slug]);
  if (!company) throw new Error(`Perusahaan "${slug}" tidak ditemukan di Hub.`);
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  try {
    const events = await src.build(async (sql, params) => (await pool.query(sql, params)).rows, src.since);
    if (events.length > 5000) throw new Error("Terlalu banyak event dalam satu tarikan.");
    // Seluruh riwayat sumber ditarik tiap kali, jadi jendela mencakup semua tanggal: baris tarikan yang sudah hilang di sumber ikut dihapus.
    const to = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const r = await applyEvents(company, events, { from: "2000-01-01", to }, `pull:${slug}`);
    return { slug, sent: events.length, ...r };
  } finally {
    await pool.end().catch(() => {});
  }
}

export async function pullAll() {
  const res: (Awaited<ReturnType<typeof pullCompany>> | { slug: string; error: string })[] = [];
  for (const slug of Object.keys(SOURCES)) {
    if (!configured(slug)) continue;
    try { res.push(await pullCompany(slug)); } catch (e) { res.push({ slug, error: e instanceof Error ? e.message : "gagal" }); }
  }
  return res;
}
