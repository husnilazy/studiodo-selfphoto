import "server-only";
import { q } from "./db";

/**
 * Konektor ke Frameless Hub (API Core). Mengirim ringkasan HARIAN, bukan data pelanggan:
 *  - pendapatan bersih per hari (pembayaran − refund)
 *  - biaya per hari per kategori
 *  - pembelian aset tetap
 * Idempoten: id event stabil + jendela tanggal, jadi aman dijalankan berulang.
 * Env: HUB_URL (mis. https://hub.frameless.id) dan HUB_API_KEY (dibuat di Hub → Pengaturan → Sambungan).
 */
type Ev = { id: string; date: string; kind: "revenue" | "expense" | "asset_purchase"; category: string; amount: number; memo: string };

const catOf = (name: string) => {
  const n = name.toLowerCase();
  if (/gaji|honor|upah/.test(n)) return "gaji";
  if (/sewa/.test(n)) return "sewa";
  if (/listrik|air|internet|utilitas/.test(n)) return "utilitas";
  if (/iklan|marketing|promo/.test(n)) return "marketing";
  if (/bahan|hpp|cetak|kertas|tinta/.test(n)) return "bahan";
  if (/pajak|legal/.test(n)) return "pajak";
  return "operasional";
};

export function hubConfigured() {
  return !!(process.env.HUB_URL?.trim() && process.env.HUB_API_KEY?.trim());
}

export async function syncToHub(days = 45) {
  const url = process.env.HUB_URL?.trim().replace(/\/$/, "");
  const key = process.env.HUB_API_KEY?.trim();
  if (!url || !key) throw new Error("HUB_URL dan HUB_API_KEY belum diisi di Environment.");
  const d = Math.min(400, Math.max(1, Math.floor(days)));

  const rev = await q<{ d: string; net: number }>(
    `select to_char((paid_at at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as d,
            sum(case when kind = 'refund' then -amount else amount end)::bigint as net
     from payments where not voided and (paid_at at time zone 'Asia/Jakarta')::date >= (now() at time zone 'Asia/Jakarta')::date - $1::int
     group by 1`, [d]);
  const exp = await q<{ d: string; name: string; amt: number }>(
    `select to_char(e.date, 'YYYY-MM-DD') as d, a.name, sum(e.amount)::bigint as amt
     from expenses e join accounts a on a.id = e.account_id
     where not e.voided and e.date >= (now() at time zone 'Asia/Jakarta')::date - $1::int group by 1, 2`, [d]);
  const assets = await q<{ id: number; d: string; name: string; cost: number }>(
    `select id, to_char(acquired_on, 'YYYY-MM-DD') as d, name, cost from fixed_assets
     where acquired_on >= (now() at time zone 'Asia/Jakarta')::date - $1::int`, [d]);

  const events: Ev[] = [];
  for (const r of rev) if (r.net > 0) events.push({ id: `rev:${r.d}`, date: r.d, kind: "revenue", category: "penjualan", amount: r.net, memo: "Pendapatan harian STUDIODO" });
  const byCat = new Map<string, Ev>();
  for (const r of exp) {
    const category = catOf(r.name), id = `exp:${r.d}:${category}`;
    const cur = byCat.get(id);
    if (cur) cur.amount += r.amt;
    else byCat.set(id, { id, date: r.d, kind: "expense", category, amount: r.amt, memo: `Biaya ${category}` });
  }
  events.push(...byCat.values());
  for (const a of assets) events.push({ id: `asset:${a.id}`, date: a.d, kind: "asset_purchase", category: "alat", amount: a.cost, memo: a.name });

  const to = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const from = new Date(Date.now() + 7 * 3600e3 - d * 86400e3).toISOString().slice(0, 10);
  const res = await fetch(`${url}/api/core/v1/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ events, window: { from, to } }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Hub menolak (${res.status}): ${body?.error ?? "tidak diketahui"}`);
  return { sent: events.length, ...body };
}
