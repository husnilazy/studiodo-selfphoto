import "server-only";
import { q } from "./db";

export type AccRow = { id: number; code: string; name: string; type: string; subtype: string; cf_category: string | null; debit: number; credit: number };

/** Saldo semua akun untuk rentang tanggal [from, to] (jurnal void dikecualikan). */
export async function trialBalance(to: string, from = "1900-01-01"): Promise<AccRow[]> {
  return q<AccRow>(
    `select a.id, a.code, a.name, a.type, a.subtype, a.cf_category,
            coalesce(sum(l.debit),0) as debit, coalesce(sum(l.credit),0) as credit
       from accounts a
       left join (
         select jl.account_id, jl.debit, jl.credit
           from journal_lines jl join journals j on j.id = jl.journal_id
          where not j.voided and j.date >= $1 and j.date <= $2
       ) l on l.account_id = a.id
      group by a.id order by a.code`,
    [from, to],
  );
}

const bal = (r: AccRow) => (r.type === "asset" || r.type === "expense" ? r.debit - r.credit : r.credit - r.debit);
const sum = (a: { amount: number }[]) => a.reduce((s, r) => s + r.amount, 0);

export async function incomeStatement(from: string, to: string) {
  const rows = await trialBalance(to, from);
  const withAmt = (f: (r: AccRow) => boolean) =>
    rows.filter(f).map((r) => ({ ...r, amount: bal(r) })).filter((r) => r.amount !== 0);
  const rev = withAmt((r) => r.type === "revenue");
  const cogs = withAmt((r) => r.type === "expense" && r.subtype === "cogs");
  const opex = withAmt((r) => r.type === "expense" && r.subtype !== "cogs");
  const revenue = sum(rev), cost = sum(cogs), expense = sum(opex);
  return { rev, cogs, opex, revenue, cost, gross: revenue - cost, expense, net: revenue - cost - expense };
}

export async function balanceSheet(asOf: string) {
  const rows = await trialBalance(asOf);
  const pick = (t: string) => rows.filter((r) => r.type === t).map((r) => ({ ...r, amount: bal(r) })).filter((r) => r.amount !== 0);
  const assets = pick("asset"), liabilities = pick("liability"), equity = pick("equity");
  const retained =
    rows.filter((r) => r.type === "revenue").reduce((s, r) => s + bal(r), 0) -
    rows.filter((r) => r.type === "expense").reduce((s, r) => s + bal(r), 0);
  const totalAssets = sum(assets), totalLiab = sum(liabilities), totalEquity = sum(equity) + retained;
  return { assets, liabilities, equity, retained, totalAssets, totalLiab, totalEquity, balanced: totalAssets === totalLiab + totalEquity };
}

/** Arus kas metode langsung: setiap jurnal yang menyentuh akun kas dikelompokkan menurut akun lawannya. */
export async function cashFlow(from: string, to: string) {
  const [prev] = await q<{ d: string }>("select ($1::date - 1)::text as d", [from]);
  const openRows = await trialBalance(prev.d);
  const closeRows = await trialBalance(to);
  const cashSum = (rs: AccRow[]) => rs.filter((r) => r.subtype === "cash").reduce((s, r) => s + r.debit - r.credit, 0);
  const lines = await q<{ code: string; name: string; type: string; cf_category: string | null; cash: number }>(
    `select a.code, a.name, a.type, a.cf_category, sum(l.credit - l.debit) as cash
       from journal_lines l
       join journals j on j.id = l.journal_id
       join accounts a on a.id = l.account_id
      where not j.voided and j.date >= $1 and j.date <= $2 and a.subtype <> 'cash'
        and exists (select 1 from journal_lines l2 join accounts a2 on a2.id = l2.account_id
                     where l2.journal_id = j.id and a2.subtype = 'cash')
      group by a.id, a.code, a.name, a.type, a.cf_category
     having sum(l.credit - l.debit) <> 0
      order by a.code`,
    [from, to],
  );
  const group = (cat: string) => lines.filter((l) => (l.cf_category ?? "operating") === cat);
  const operating = group("operating"), investing = group("investing"), financing = group("financing");
  const total = (a: { cash: number }[]) => a.reduce((s, r) => s + r.cash, 0);
  const opening = cashSum(openRows), closing = cashSum(closeRows);
  return {
    operating, investing, financing, opening, closing,
    netOperating: total(operating), netInvesting: total(investing), netFinancing: total(financing),
    net: total(lines), reconciles: opening + total(lines) === closing,
  };
}

export async function cashBalances() {
  const rows = await trialBalance("2999-12-31");
  return rows.filter((r) => r.subtype === "cash").map((r) => ({ code: r.code, name: r.name, amount: r.debit - r.credit }));
}

export async function ledgerFor(accountId: number, from: string, to: string) {
  const [acc] = await q<{ id: number; code: string; name: string; type: string }>(
    "select id, code, name, type from accounts where id = $1", [accountId]);
  if (!acc) return null;
  const debitNormal = acc.type === "asset" || acc.type === "expense";
  const [o] = await q<{ d: number; c: number }>(
    `select coalesce(sum(l.debit),0) d, coalesce(sum(l.credit),0) c
       from journal_lines l join journals j on j.id = l.journal_id
      where l.account_id = $1 and not j.voided and j.date < $2`, [accountId, from]);
  const opening = debitNormal ? o.d - o.c : o.c - o.d;
  const rows = await q<{ id: number; date: string; memo: string; debit: number; credit: number }>(
    `select j.id, j.date, j.memo, l.debit, l.credit
       from journal_lines l join journals j on j.id = l.journal_id
      where l.account_id = $1 and not j.voided and j.date >= $2 and j.date <= $3
      order by j.date, j.id, l.id`, [accountId, from, to]);
  let run = opening;
  const lines = rows.map((r) => {
    run += debitNormal ? r.debit - r.credit : r.credit - r.debit;
    return { ...r, balance: run };
  });
  return { acc, opening, lines, closing: run };
}

export async function salesSummary(from: string, to: string) {
  const inRange = "(b.start_at at time zone 'Asia/Jakarta')::date between $1 and $2";
  const byPackage = await q<{ name: string; n: number; total: number }>(
    `select coalesce(p.name,'(tanpa paket)') as name, count(*) as n, sum(b.total) as total
       from bookings b left join packages p on p.id = b.package_id
      where b.status in ('confirmed','done') and ${inRange}
      group by 1 order by 3 desc`, [from, to]);
  const byRoom = await q<{ name: string; n: number; hours: number }>(
    `select coalesce(r.name,'(tanpa ruang)') as name, count(*) as n,
            round(sum(extract(epoch from (b.end_at - b.start_at))/3600)::numeric,1) as hours
       from bookings b left join rooms r on r.id = b.room_id
      where b.status in ('confirmed','done') and ${inRange}
      group by 1 order by 2 desc`, [from, to]);
  const byMethod = await q<{ method: string; total: number }>(
    `select method, sum(case when kind = 'refund' then -amount else amount end) as total
       from payments where not voided and (paid_at at time zone 'Asia/Jakarta')::date between $1 and $2
      group by method order by 2 desc`, [from, to]);
  const byDay = await q<{ d: string; total: number }>(
    `select (paid_at at time zone 'Asia/Jakarta')::date::text as d,
            sum(case when kind = 'refund' then -amount else amount end) as total
       from payments where not voided and (paid_at at time zone 'Asia/Jakarta')::date between $1 and $2
      group by 1 order by 1`, [from, to]);
  const [tot] = await q<{ n: number; people: number }>(
    `select count(*) as n, coalesce(sum(b.people),0) as people from bookings b
      where b.status in ('confirmed','done') and ${inRange}`, [from, to]);
  return { byPackage, byRoom, byMethod, byDay, sessions: tot.n, people: tot.people };
}
