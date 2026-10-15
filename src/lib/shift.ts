import "server-only";
import { q as rootQ, type Q } from "./db";

export type Shift = {
  id: number; opened_by: number | null; opener: string | null; opened_at: string; opening_cash: number; open_note: string;
  closed_by: number | null; closer: string | null; closed_at: string | null;
  expected_cash: number | null; counted_cash: number | null; difference: number | null;
  sales_cash: number | null; sales_qris: number | null; sales_transfer: number | null; cash_out: number | null; cash_in: number | null; close_note: string;
};

const SELECT = `select s.*, u.name as opener, c.name as closer from shifts s
  left join users u on u.id = s.opened_by left join users c on c.id = s.closed_by`;

export async function getOpenShift(q: Q = rootQ): Promise<Shift | null> {
  return (await q<Shift>(`${SELECT} where s.closed_at is null limit 1`))[0] ?? null;
}
export async function getShift(id: number, q: Q = rootQ): Promise<Shift | null> {
  return (await q<Shift>(`${SELECT} where s.id = $1`, [id]))[0] ?? null;
}

/** Hitung uang masuk/keluar sebuah shift langsung dari pembayaran & kas keluar. */
export async function shiftTotals(shiftId: number, openingCash: number, q: Q = rootQ) {
  const rows = await q<{ method: string; net: number }>(
    `select method, coalesce(sum(case when kind='refund' then -amount else amount end),0) as net
       from payments where shift_id = $1 and not voided group by method`, [shiftId]);
  const by = (m: string) => rows.find((r) => r.method === m)?.net ?? 0;
  const [o] = await q<{ out: number; inn: number }>(
    `select coalesce(sum(amount) filter (where kind = 'out'),0) as out, coalesce(sum(amount) filter (where kind = 'in'),0) as inn
       from shift_moves where shift_id = $1 and not voided`, [shiftId]);
  const cash = by("cash"), qris = by("qris"), transfer = by("transfer"), cashOut = o.out, cashIn = o.inn;
  return { cash, qris, transfer, cashOut, cashIn, expected: openingCash + cash + cashIn - cashOut };
}

export async function lastClosingCash(): Promise<number> {
  // Saldo akun Kas di buku: sudah memperhitungkan prive/setor bank/pengeluaran di luar shift.
  const [r] = await rootQ<{ b: number }>(
    `select coalesce(sum(l.debit - l.credit),0) as b from journal_lines l join journals j on j.id = l.journal_id
      join accounts a on a.id = l.account_id where a.code = '1101' and not j.voided`);
  return Math.max(0, Number(r?.b ?? 0));
}

/**
 * Uang laci (akun Kas 1101) bergerak saat shift berjalan — pengeluaran tunai, prive, setor ke bank, dll.
 * Dicatat ke shift supaya hitungan "seharusnya di laci" tetap benar. Tidak ada shift terbuka = tidak perlu.
 */
export async function linkCashMove(q: Q, m: { delta: number; note: string; userId: number; expenseId?: number | null; journalId?: number | null }) {
  if (m.delta === 0) return;
  const sh = await getOpenShift(q);
  if (!sh) return;
  await q("insert into shift_moves (shift_id, amount, kind, note, expense_id, journal_id, created_by) values ($1,$2,$3,$4,$5,$6,$7)",
    [sh.id, Math.abs(m.delta), m.delta > 0 ? "in" : "out", m.note, m.expenseId ?? null, m.journalId ?? null, m.userId]);
}
