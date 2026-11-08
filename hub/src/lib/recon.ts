import "server-only";
import { q } from "./db";

/** Saldo kas menurut catatan Hub sampai (dan termasuk) tanggal tertentu. */
export async function bookBalance(companyId: number, upTo: string): Promise<number> {
  const r = await q<{ c: number }>(
    `select coalesce(sum(case
        when kind in ('revenue','capital_in') then amount
        when kind = 'withdrawal' then -amount
        when kind in ('expense','asset_purchase') and funding = 'company' then -amount
        else 0 end), 0)::bigint as c from transactions where company_id = $1 and date <= $2`, [companyId, upTo]);
  return Number(r[0]?.c) || 0;
}
