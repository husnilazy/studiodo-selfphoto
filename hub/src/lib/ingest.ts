import "server-only";
import { tx } from "./db";

export const KINDS = new Set(["revenue", "expense", "asset_purchase", "capital_in", "withdrawal"]);
const NEEDS_PARTNER = new Set(["capital_in", "withdrawal"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type Window = { from?: string; to?: string };
export type IngestResult = { upserted: number; removed: number; errors: { index: number; error: string }[] };

/**
 * Menerapkan daftar event ke buku besar satu perusahaan (dipakai endpoint API Core dan penarik langsung).
 * Idempoten lewat `id` unik per perusahaan. `window` = baris API di rentang tanggal itu yang tidak ikut terkirim dihapus.
 */
export async function applyEvents(company: { id: number }, events: unknown[], win?: Window, source = "api"): Promise<IngestResult> {
  const hasWin = !!win && DATE.test(win.from ?? "") && DATE.test(win.to ?? "");
  const errors: IngestResult["errors"] = [];
  let upserted = 0, removed = 0;
  await tx(async (t) => {
    const linked = await t<{ id: number; name: string }>(
      "select p.id, p.name from partners p join company_partners cp on cp.partner_id = p.id where cp.company_id = $1", [company.id]);
    for (const [i, raw] of events.entries()) {
      const e = raw as Record<string, unknown>;
      const id = String(e.id ?? ""), date = String(e.date ?? ""), kind = String(e.kind ?? "");
      const amount = Math.round(Number(e.amount));
      if (!id || id.length > 120) { errors.push({ index: i, error: "id wajib (≤120 karakter)" }); continue; }
      if (!DATE.test(date)) { errors.push({ index: i, error: "date harus YYYY-MM-DD" }); continue; }
      if (!KINDS.has(kind)) { errors.push({ index: i, error: "kind tidak dikenal" }); continue; }
      if (!Number.isFinite(amount) || amount < 0) { errors.push({ index: i, error: "amount harus angka ≥ 0" }); continue; }
      // Partner & sumber dana. Penarikan/modal selalu terkait partner; biaya/aset hanya bila dibayar pribadi.
      let funding = e.funding === "partner" ? "partner" : "company";
      if (kind === "revenue") funding = "company";
      let partnerId: number | null = null;
      if (NEEDS_PARTNER.has(kind) || funding === "partner") {
        const name = String(e.partner ?? "").trim().toLowerCase();
        const hit = name ? linked.find((p) => p.name.toLowerCase() === name) : linked.length === 1 ? linked[0] : undefined;
        if (!hit) { errors.push({ index: i, error: name ? `partner "${e.partner}" tidak ada di unit ini` : "partner wajib diisi (unit punya lebih dari satu partner)" }); continue; }
        partnerId = hit.id;
      }
      await t(
        `insert into transactions (company_id,date,kind,category,amount,funding,partner_id,memo,source,external_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (company_id, external_id) where external_id is not null
         do update set date=excluded.date, kind=excluded.kind, category=excluded.category, amount=excluded.amount,
                       funding=excluded.funding, partner_id=excluded.partner_id, memo=excluded.memo`,
        [company.id, date, kind, String(e.category ?? "lainnya").slice(0, 40), amount, funding, partnerId, String(e.memo ?? "").slice(0, 200), source, id],
      );
      upserted++;
    }
    // Jendela sinkron: baris dari sumber ini di rentang tanggal itu yang tidak lagi dikirim (mis. dibatalkan) dihapus.
    if (hasWin && !errors.length) {
      const keep = events.map((e) => String((e as Record<string, unknown>).id ?? ""));
      const del = await t<{ id: number }>(
        "delete from transactions where company_id=$1 and source=$5 and date between $2 and $3 and not (external_id = any($4)) returning id",
        [company.id, win!.from, win!.to, keep, source]);
      removed = del.length;
    }
    await t("update companies set last_sync_at = now() where id = $1", [company.id]);
  });
  return { upserted, removed, errors };
}
