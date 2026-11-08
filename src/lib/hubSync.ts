import "server-only";
import { q } from "./db";

/**
 * Konektor ke Frameless Hub (API Core). Mengirim ringkasan HARIAN, bukan data pelanggan:
 *  - pendapatan bersih per hari (pembayaran + DP − refund) dan pendapatan lain-lain
 *  - biaya per hari per kategori (yang dibayar dari modal pemilik ditandai sebagai modal partner)
 *  - pembelian aset tetap (dari modal pemilik = modal partner)
 *  - setoran modal dan prive (penarikan pemilik)
 * Idempoten: id event stabil + jendela tanggal, jadi aman dijalankan berulang.
 * Env: HUB_URL (mis. https://frameless-hub.vercel.app), HUB_API_KEY (dibuat di Hub → Pengaturan → Sambungan),
 *      HUB_PARTNER_NAME (opsional; nama partner di Hub untuk modal pemilik, kosong = satu-satunya partner unit ini).
 */
type Ev = {
  id: string; date: string; kind: "revenue" | "expense" | "asset_purchase" | "capital_in" | "withdrawal";
  category: string; amount: number; memo: string; funding?: "partner"; partner?: string;
};

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

const SINCE = "(now() at time zone 'Asia/Jakarta')::date - $1::int";

export async function syncToHub(days = 45) {
  const url = process.env.HUB_URL?.trim().replace(/\/$/, "");
  const key = process.env.HUB_API_KEY?.trim();
  if (!url || !key) throw new Error("HUB_URL dan HUB_API_KEY belum diisi di Environment.");
  const d = Math.min(400, Math.max(1, Math.floor(days)));
  const partner = process.env.HUB_PARTNER_NAME?.trim() || undefined;
  const owner = partner ? { partner } : {};

  const rev = await q<{ d: string; net: number }>(
    `select to_char((paid_at at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as d,
            sum(case when kind = 'refund' then -amount else amount end)::bigint as net
     from payments where not voided and (paid_at at time zone 'Asia/Jakarta')::date >= ${SINCE} group by 1`, [d]);
  const exp = await q<{ d: string; name: string; by_owner: boolean; amt: number }>(
    `select to_char(e.date, 'YYYY-MM-DD') as d, a.name, (pf.type = 'equity') as by_owner, sum(e.amount)::bigint as amt
     from expenses e join accounts a on a.id = e.account_id join accounts pf on pf.id = e.paid_from_account_id
     where not e.voided and e.date >= ${SINCE} group by 1, 2, 3`, [d]);
  const assets = await q<{ id: number; d: string; name: string; cost: number; by_owner: boolean }>(
    `select f.id, to_char(f.acquired_on, 'YYYY-MM-DD') as d, f.name, f.cost, (pf.type = 'equity') as by_owner
     from fixed_assets f join accounts pf on pf.id = f.paid_from_account_id
     where f.acquired_on >= ${SINCE} and f.note not ilike '%sudah di hub%'`, [d]); // catatan "sudah di Hub" = modal yang dicatat manual di Hub (hindari dobel)
  // Setoran modal (3101), prive (3201), dan pendapatan lain-lain (4105) yang dicatat manual lewat Keuangan → Modal/Prive/Transfer.
  const cash = await q<{ id: number; d: string; code: string; net: number; memo: string }>(
    `select j.id, to_char(j.date, 'YYYY-MM-DD') as d, a.code, (jl.credit - jl.debit)::bigint as net, j.memo
     from journals j join journal_lines jl on jl.journal_id = j.id join accounts a on a.id = jl.account_id
     where not j.voided and j.ref_type = 'cash' and a.code in ('3101', '3201', '4105') and j.date >= ${SINCE}`, [d]);

  const events: Ev[] = [];
  for (const r of rev) if (r.net > 0) events.push({ id: `rev:${r.d}`, date: r.d, kind: "revenue", category: "penjualan", amount: r.net, memo: "Pendapatan harian STUDIODO" });
  const byId = new Map<string, Ev>();
  for (const r of exp) {
    const category = catOf(r.name), id = `exp:${r.d}:${category}${r.by_owner ? ":owner" : ""}`;
    const cur = byId.get(id);
    if (cur) cur.amount += r.amt;
    else byId.set(id, { id, date: r.d, kind: "expense", category, amount: r.amt, memo: `Biaya ${category}${r.by_owner ? " (modal pemilik)" : ""}`, ...(r.by_owner ? { funding: "partner" as const, ...owner } : {}) });
  }
  events.push(...byId.values());
  for (const a of assets) events.push({ id: `asset:${a.id}`, date: a.d, kind: "asset_purchase", category: "alat", amount: a.cost, memo: a.name, ...(a.by_owner ? { funding: "partner" as const, ...owner } : {}) });
  for (const c of cash) {
    const memo = (c.memo || "").slice(0, 120);
    if (c.code === "3101" && c.net > 0) events.push({ id: `jr:${c.id}`, date: c.d, kind: "capital_in", category: "modal", amount: c.net, memo, ...owner });
    else if (c.code === "3201" && c.net < 0) events.push({ id: `jr:${c.id}`, date: c.d, kind: "withdrawal", category: "prive", amount: -c.net, memo, ...owner });
    else if (c.code === "4105" && c.net > 0) events.push({ id: `jr:${c.id}`, date: c.d, kind: "revenue", category: "lainnya", amount: c.net, memo });
  }

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
