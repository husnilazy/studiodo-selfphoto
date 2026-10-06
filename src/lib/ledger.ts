import "server-only";
import type { Q } from "./db";

export type JLine = { account: string; debit?: number; credit?: number };

export const METHOD_ACCOUNT: Record<string, string> = { cash: "1101", transfer: "1102", qris: "1103" };
export const CATEGORY_ACCOUNT: Record<string, string> = {
  self_photo: "4101", photobox: "4102", photobooth: "4103", addon: "4104", lainnya: "4105",
};

/** Mencatat satu jurnal berimbang (debit = kredit). `account` = kode akun. */
export async function postJournal(
  q: Q,
  j: { date: string; memo: string; refType: string; refId?: number | null; userId: number | null; lines: JLine[] },
): Promise<number> {
  const lines = j.lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);
  const d = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const c = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (lines.length < 2 || d !== c) throw new Error(`Jurnal tidak seimbang (debit ${d} ≠ kredit ${c}).`);
  const codes = [...new Set(lines.map((l) => l.account))];
  const accs = await q<{ id: number; code: string }>("select id, code from accounts where code = any($1)", [codes]);
  const map = new Map(accs.map((a) => [a.code, a.id]));
  for (const code of codes) if (!map.has(code)) throw new Error(`Akun ${code} tidak ditemukan.`);
  const [row] = await q<{ id: number }>(
    "insert into journals (date, memo, ref_type, ref_id, created_by) values ($1,$2,$3,$4,$5) returning id",
    [j.date, j.memo, j.refType, j.refId ?? null, j.userId],
  );
  for (const l of lines) {
    await q("insert into journal_lines (journal_id, account_id, debit, credit) values ($1,$2,$3,$4)", [
      row.id, map.get(l.account), l.debit ?? 0, l.credit ?? 0,
    ]);
  }
  return row.id;
}

export async function voidJournal(q: Q, id: number) {
  await q("update journals set voided = true where id = $1", [id]);
}

/** Membagi `amount` ke akun pendapatan sesuai komposisi item booking. */
export function allocateRevenue(items: { category: string; amount: number }[], amount: number) {
  const gross = items.reduce((s, i) => s + i.amount, 0);
  const byAcc = new Map<string, number>();
  for (const i of items) {
    const acc = CATEGORY_ACCOUNT[i.category] ?? "4105";
    byAcc.set(acc, (byAcc.get(acc) ?? 0) + i.amount);
  }
  if (gross <= 0 || byAcc.size === 0) return [{ account: "4105", amount }];
  const entries = [...byAcc.entries()].sort((a, b) => b[1] - a[1]);
  let left = amount;
  const out = entries.map(([account, v]) => {
    const part = Math.floor((amount * v) / gross);
    left -= part;
    return { account, amount: part };
  });
  out[0].amount += left; // sisa pembulatan ke akun terbesar
  return out.filter((o) => o.amount > 0);
}
