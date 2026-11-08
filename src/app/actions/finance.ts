"use server";
import { revalidatePath } from "next/cache";
import { q as rootQ, tx } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { int, req, safe, str } from "@/lib/action";
import { postJournal, voidJournal } from "@/lib/ledger";
import { linkCashMove } from "@/lib/shift";
import { fmtMonth, monthEnd, rupiah, todayWIB } from "@/lib/format";
import type { ActionState } from "@/components/ActionForm";

const refresh = () => { revalidatePath("/keuangan", "layout"); revalidatePath("/dashboard"); };
const validDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Tanggal tidak valid.");
  return d;
};

/** Kode akun dari id (untuk jurnal). */
async function codeOf(q: typeof rootQ, id: number, types?: string[]) {
  const [a] = await q<{ code: string; name: string; type: string; subtype: string; active: boolean }>("select code, name, type, subtype, active from accounts where id = $1", [id]);
  if (!a || !a.active) throw new Error("Akun tidak ditemukan atau nonaktif.");
  if (types && !types.includes(a.type)) throw new Error("Jenis akun tidak sesuai.");
  return a;
}

export async function addExpense(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner", "admin"]);
    const date = validDate(str(fd, "date"));
    const amount = int(fd, "amount");
    if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
    await tx(async (q) => {
      const exp = await codeOf(q, int(fd, "account_id"), ["expense"]);
      const src = await codeOf(q, int(fd, "paid_from"));
      if (src.subtype !== "cash") throw new Error("Sumber dana harus akun kas/bank.");
      const vendor = str(fd, "vendor"), note = str(fd, "note");
      const [e] = await q<{ id: number }>(
        "insert into expenses (date, account_id, paid_from_account_id, amount, vendor, note, receipt_url, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
        [date, int(fd, "account_id"), int(fd, "paid_from"), amount, vendor, note, str(fd, "receipt_url"), user.id]);
      const jid = await postJournal(q, {
        date, memo: `Pengeluaran${vendor ? ` – ${vendor}` : ""}${note ? ` (${note})` : ""}`, refType: "expense", refId: e.id, userId: user.id,
        lines: [{ account: exp.code, debit: amount }, { account: src.code, credit: amount }],
      });
      await q("update expenses set journal_id = $1 where id = $2", [jid, e.id]);
      if (src.code === "1101") await linkCashMove(q, { delta: -amount, note: `Pengeluaran${vendor ? ` – ${vendor}` : ""}${note ? ` (${note})` : ""}`, userId: user.id, expenseId: e.id });
    });
    refresh();
  });
}

export async function voidExpense(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await tx(async (q) => {
      const [e] = await q<{ journal_id: number | null; voided: boolean }>("select journal_id, voided from expenses where id = $1 for update", [id]);
      if (!e) throw new Error("Data tidak ditemukan.");
      if (e.voided) return;
      await q("update expenses set voided = true where id = $1", [id]);
      if (e.journal_id) await voidJournal(q, e.journal_id);
      await q("update shift_moves set voided = true where expense_id = $1", [id]);
    });
    refresh();
  });
}

const CASH_TYPES: Record<string, { label: string; build: (cash: string, other: string | null, amt: number, to: string | null) => { account: string; debit?: number; credit?: number }[] }> = {
  modal: { label: "Setoran modal", build: (c, _o, a) => [{ account: c, debit: a }, { account: "3101", credit: a }] },
  prive: { label: "Prive (penarikan pemilik)", build: (c, _o, a) => [{ account: "3201", debit: a }, { account: c, credit: a }] },
  income: { label: "Pendapatan lain-lain", build: (c, _o, a) => [{ account: c, debit: a }, { account: "4105", credit: a }] },
  loan_in: { label: "Terima pinjaman", build: (c, _o, a) => [{ account: c, debit: a }, { account: "2301", credit: a }] },
  loan_pay: { label: "Bayar pinjaman", build: (c, _o, a) => [{ account: "2301", debit: a }, { account: c, credit: a }] },
  transfer: { label: "Transfer antar kas", build: (c, _o, a, to) => [{ account: to!, debit: a }, { account: c, credit: a }] },
};

export async function cashTxn(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const type = str(fd, "type");
    const def = CASH_TYPES[type];
    if (!def) throw new Error("Jenis transaksi tidak valid.");
    const date = validDate(str(fd, "date"));
    const amount = int(fd, "amount");
    if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
    await tx(async (q) => {
      const cash = await codeOf(q, int(fd, "account_id"));
      if (cash.subtype !== "cash") throw new Error("Pilih akun kas/bank.");
      let to: string | null = null;
      if (type === "transfer") {
        const t = await codeOf(q, int(fd, "to_account_id"));
        if (t.subtype !== "cash") throw new Error("Tujuan harus akun kas/bank.");
        if (t.code === cash.code) throw new Error("Akun asal dan tujuan tidak boleh sama.");
        to = t.code;
      }
      const jid = await postJournal(q, {
        date, memo: `${def.label}${str(fd, "note") ? ` – ${str(fd, "note")}` : ""}`, refType: "cash", userId: user.id,
        lines: def.build(cash.code, null, amount, to),
      });
      // Pengaruh ke laci (akun 1101): debit = uang masuk laci, kredit = uang keluar laci.
      const drawer = def.build(cash.code, null, amount, to).reduce((s, l) => l.account === "1101" ? s + (l.debit ?? 0) - (l.credit ?? 0) : s, 0);
      await linkCashMove(q, { delta: drawer, note: `${def.label}${str(fd, "note") ? ` – ${str(fd, "note")}` : ""}`, userId: user.id, journalId: jid });
    });
    refresh();
  });
}

export async function manualJournal(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const date = validDate(str(fd, "date"));
    const memo = req(str(fd, "memo"), "Keterangan jurnal wajib diisi.");
    const accs = fd.getAll("acc").map((v) => Number(v));
    const deb = fd.getAll("debit").map((v) => parseInt(String(v).replace(/\D/g, "") || "0", 10));
    const cred = fd.getAll("credit").map((v) => parseInt(String(v).replace(/\D/g, "") || "0", 10));
    await tx(async (q) => {
      const lines: { account: string; debit: number; credit: number }[] = [];
      for (let i = 0; i < accs.length; i++) {
        if (!accs[i] || (!deb[i] && !cred[i])) continue;
        if (deb[i] && cred[i]) throw new Error("Satu baris tidak boleh punya debit dan kredit sekaligus.");
        const a = await codeOf(q, accs[i]);
        lines.push({ account: a.code, debit: deb[i], credit: cred[i] });
      }
      const jid = await postJournal(q, { date, memo, refType: "manual", userId: user.id, lines });
      // Jurnal manual yang menyentuh Kas (1101) hari ini harus ikut tercatat di shift, supaya "seharusnya di laci" tetap benar.
      const drawer = lines.reduce((t, l) => (l.account === "1101" ? t + l.debit - l.credit : t), 0);
      if (date === todayWIB()) await linkCashMove(q, { delta: drawer, note: memo, userId: user.id, journalId: jid });
    });
    refresh();
  });
}

export async function voidManualJournal(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner"]);
    await tx(async (q) => {
      const [j] = await q<{ ref_type: string }>("select ref_type from journals where id = $1", [id]);
      if (!j) throw new Error("Jurnal tidak ditemukan.");
      if (!["manual", "cash", "depreciation", "adjustment"].includes(j.ref_type)) throw new Error("Jurnal ini dibuat otomatis dari transaksi lain. Batalkan lewat transaksi asalnya.");
      if (j.ref_type === "depreciation") await q("delete from asset_depreciation where journal_id = $1", [id]);
      await voidJournal(q, id);
      await q("update shift_moves set voided = true where journal_id = $1", [id]);
    });
    refresh();
  });
}

export async function addAccount(_p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner"]);
    const code = req(str(fd, "code"), "Kode akun wajib diisi.");
    if (!/^\d{3,6}$/.test(code)) throw new Error("Kode akun berupa angka 3–6 digit.");
    const name = req(str(fd, "name"), "Nama akun wajib diisi.");
    const kind = str(fd, "kind");
    const MAP: Record<string, [string, string, string | null]> = {
      asset: ["asset", "other", "operating"], fixed: ["asset", "fixed", "investing"], liability: ["liability", "other", "operating"],
      loan: ["liability", "loan", "financing"], equity: ["equity", "other", "financing"], revenue: ["revenue", "other", "operating"],
      expense: ["expense", "opex", "operating"], cogs: ["expense", "cogs", "operating"],
    };
    const m = MAP[kind];
    if (!m) throw new Error("Jenis akun tidak valid.");
    try {
      await rootQ("insert into accounts (code, name, type, subtype, cf_category) values ($1,$2,$3,$4,$5)", [code, name, ...m]);
    } catch {
      throw new Error("Kode akun sudah dipakai.");
    }
    refresh();
  });
}

export async function toggleAccount(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner"]);
    await rootQ("update accounts set active = not active where id = $1 and not is_system", [id]);
    refresh();
  });
}

type NewAsset = { name: string; date: string; cost: number; salvage: number; life: number; assetAccountId: number; from: string; note: string };

/** Mencatat satu aset tetap + jurnal pembeliannya. `from` = "equity" (aset awal / modal pemilik) atau id akun kas/bank. */
async function insertAsset(q: typeof rootQ, userId: number, d: NewAsset) {
  const asset = await codeOf(q, d.assetAccountId, ["asset"]);
  const credit = d.from === "equity" ? { code: "3101" } : await codeOf(q, Number(d.from));
  if (d.from !== "equity" && (credit as { subtype: string }).subtype !== "cash") throw new Error("Sumber dana harus akun kas/bank atau modal pemilik.");
  const [a] = await q<{ id: number }>(
    `insert into fixed_assets (name, acquired_on, cost, salvage, life_months, asset_account_id, paid_from_account_id, note, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [d.name, d.date, d.cost, d.salvage, d.life, d.assetAccountId,
      d.from === "equity" ? (await q<{ id: number }>("select id from accounts where code='3101'"))[0].id : Number(d.from), d.note, userId]);
  const jid = await postJournal(q, {
    date: d.date, memo: `${d.from === "equity" ? "Aset awal" : "Pembelian aset"}: ${d.name}`, refType: "asset", refId: a.id, userId,
    lines: [{ account: asset.code, debit: d.cost }, { account: credit.code, credit: d.cost }],
  });
  await q("update fixed_assets set purchase_journal_id = $1 where id = $2", [jid, a.id]);
  // Beli aset tunai hari ini = uang keluar laci.
  if (credit.code === "1101" && d.date === todayWIB()) await linkCashMove(q, { delta: -d.cost, note: `Pembelian aset: ${d.name}`, userId, journalId: jid });
}

export async function addAsset(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const name = req(str(fd, "name"), "Nama aset wajib diisi.");
    const date = validDate(str(fd, "acquired_on"));
    const cost = int(fd, "cost"), salvage = int(fd, "salvage"), life = int(fd, "life_months");
    if (cost <= 0) throw new Error("Harga perolehan harus lebih dari 0.");
    if (salvage < 0 || salvage >= cost) throw new Error("Nilai sisa harus lebih kecil dari harga perolehan.");
    if (life < 1) throw new Error("Umur manfaat minimal 1 bulan.");
    await tx(async (q) => {
      await insertAsset(q, user.id, { name, date, cost, salvage, life, assetAccountId: int(fd, "asset_account_id"), from: str(fd, "paid_from"), note: str(fd, "note") });
    });
    refresh();
  });
}

/**
 * Impor banyak aset awal (modal pemilik) dari CSV: `tanggal,nama,harga,kode_akun_aset,umur_bulan,catatan`.
 * Kode akun aset: 1501 Kamera & Lighting, 1502 Set/Dekorasi/Background, 1503 Perabot & Elektronik.
 * Aman diulang: baris dengan nama + tanggal + harga yang sama dilewati. Semua-atau-tidak-sama-sekali (satu transaksi).
 */
export async function importAssets(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const lines = str(fd, "csv").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^tanggal\b/i.test(l));
    if (!lines.length) throw new Error("CSV kosong.");
    if (lines.length > 200) throw new Error("Maksimal 200 baris sekali impor.");
    let added = 0, skipped = 0;
    await tx(async (q) => {
      const accs = await q<{ id: number; code: string }>("select id, code from accounts where type = 'asset' and subtype = 'fixed' and active");
      for (const [i, line] of lines.entries()) {
        const [date, name, price, code, life, ...note] = line.split(",").map((x) => x.trim());
        const at = `Baris ${i + 1}`;
        validDate(date ?? "");
        if (!name) throw new Error(`${at}: nama kosong.`);
        const cost = parseInt((price ?? "").replace(/[^\d]/g, ""), 10);
        if (!(cost > 0)) throw new Error(`${at}: harga tidak valid.`);
        const acc = accs.find((a) => a.code === (code || "1502"));
        if (!acc) throw new Error(`${at}: kode akun aset "${code}" tidak dikenal (pakai 1501, 1502, atau 1503).`);
        const months = parseInt(life || "48", 10);
        if (!(months >= 1)) throw new Error(`${at}: umur manfaat tidak valid.`);
        const dup = await q("select 1 from fixed_assets where name = $1 and acquired_on = $2 and cost = $3 limit 1", [name, date, cost]);
        if (dup.length) { skipped++; continue; }
        await insertAsset(q, user.id, { name, date, cost, salvage: 0, life: months, assetAccountId: acc.id, from: "equity", note: note.join(",").trim() });
        added++;
      }
    });
    refresh();
    return { ok: true, message: `${added} aset dicatat${skipped ? `, ${skipped} dilewati (sudah ada)` : ""}.` };
  });
}

/** Menyusutkan satu bulan: semua aset yang belum disusutkan di bulan itu, satu jurnal per bulan. Mengembalikan total yang dicatat. */
async function depreciateMonth(q: typeof rootQ, userId: number, period: string): Promise<number> {
  const end = monthEnd(`${period}-01`);
  const assets = await q<{ id: number; name: string; cost: number; salvage: number; life_months: number; acquired_on: string }>(
    "select id, name, cost, salvage, life_months, acquired_on from fixed_assets where disposed_on is null and acquired_on <= $1", [end]);
  let sum = 0;
  const rows: { id: number; amt: number }[] = [];
  for (const a of assets) {
    const [done] = await q<{ n: number; s: number; has: number }>(
      "select count(*)::int as n, coalesce(sum(amount),0) as s, count(*) filter (where period = $2)::int as has from asset_depreciation where asset_id = $1", [a.id, period]);
    if (done.has > 0 || done.n >= a.life_months) continue;
    const base = Math.floor((a.cost - a.salvage) / a.life_months);
    const amt = done.n === a.life_months - 1 ? a.cost - a.salvage - done.s : base; // bulan terakhir menutup sisa pembulatan
    if (amt > 0) { rows.push({ id: a.id, amt }); sum += amt; }
  }
  if (sum === 0) return 0;
  const jid = await postJournal(q, {
    date: end, memo: `Penyusutan ${fmtMonth(`${period}-01`)}`, refType: "depreciation", userId,
    lines: [{ account: "5190", debit: sum }, { account: "1590", credit: sum }],
  });
  for (const r of rows) await q("insert into asset_depreciation (asset_id, period, amount, journal_id) values ($1,$2,$3,$4)", [r.id, period, r.amt, jid]);
  return sum;
}

const nextMonth = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/**
 * Mencatat penyusutan garis lurus. Tanpa `catchup`: hanya satu bulan. Dengan `catchup`: semua bulan sejak aset tertua
 * sampai periode itu yang belum tercatat (aman diulang, bulan yang sudah ada dilewati).
 */
export async function runDepreciation(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const period = str(fd, "period") || todayWIB().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");
    const catchup = fd.get("catchup") === "on";
    const result = await tx(async (q) => {
      let first = period;
      if (catchup) {
        const [m] = await q<{ first: string | null }>("select to_char(min(acquired_on), 'YYYY-MM') as first from fixed_assets where disposed_on is null");
        if (m?.first && m.first < period) first = m.first;
      }
      let total = 0, months = 0;
      for (let p = first; p <= period; p = nextMonth(p)) {
        const sum = await depreciateMonth(q, user.id, p);
        if (sum > 0) { total += sum; months++; }
      }
      return { total, months };
    });
    if (result.total === 0) throw new Error("Tidak ada aset yang perlu disusutkan untuk periode itu (sudah dicatat atau belum ada aset).");
    refresh();
    return { ok: true, message: result.months > 1 ? `Penyusutan ${result.months} bulan (${rupiah(result.total)}) dicatat.` : `Penyusutan ${rupiah(result.total)} dicatat.` };
  });
}



/* ───────── Penyesuaian saldo & pencairan QRIS ───────── */
const ADJ_LABEL: Record<string, string> = { opening: "saldo awal / sebelum aplikasi dipakai", selisih: "selisih tidak diketahui", admin: "biaya admin bank/QRIS", transfer: "pindah antar kas/bank" };

/** Menyamakan saldo satu akun kas/bank di buku dengan saldo sebenarnya (uang fisik / mutasi bank / saldo e-wallet). */
export async function adjustBalance(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const date = validDate(str(fd, "date"));
    const actual = int(fd, "actual");
    if (actual < 0) throw new Error("Saldo sebenarnya tidak boleh negatif.");
    const reason = str(fd, "reason");
    if (!ADJ_LABEL[reason]) throw new Error("Pilih penyebab selisih.");
    const msg = await tx(async (q) => {
      const acc = await codeOf(q, int(fd, "account_id"));
      if (acc.subtype !== "cash") throw new Error("Pilih akun kas/bank.");
      const [b] = await q<{ b: number }>(
        `select coalesce(sum(l.debit - l.credit),0) as b from journal_lines l join journals j on j.id = l.journal_id
          join accounts a on a.id = l.account_id where a.code = $1 and not j.voided`, [acc.code]);
      const book = Number(b.b), diff = actual - book;
      if (diff === 0) throw new Error("Saldo di buku sudah sama dengan saldo sebenarnya. Tidak ada yang perlu disesuaikan.");
      const abs = Math.abs(diff);
      let lines: { account: string; debit?: number; credit?: number }[];
      if (reason === "opening") lines = diff > 0 ? [{ account: acc.code, debit: abs }, { account: "3101", credit: abs }] : [{ account: "3201", debit: abs }, { account: acc.code, credit: abs }];
      else if (reason === "selisih") lines = diff > 0 ? [{ account: acc.code, debit: abs }, { account: "4105", credit: abs }] : [{ account: "5109", debit: abs }, { account: acc.code, credit: abs }];
      else if (reason === "admin") {
        if (diff > 0) throw new Error("Biaya admin hanya untuk saldo yang lebih kecil dari buku.");
        lines = [{ account: "5107", debit: abs }, { account: acc.code, credit: abs }];
      } else {
        const other = await codeOf(q, int(fd, "other_id"));
        if (other.subtype !== "cash" || other.code === acc.code) throw new Error("Pilih akun kas/bank lain sebagai pasangan pindah dana.");
        lines = diff > 0 ? [{ account: acc.code, debit: abs }, { account: other.code, credit: abs }] : [{ account: other.code, debit: abs }, { account: acc.code, credit: abs }];
      }
      const note = str(fd, "note");
      const memo = `Penyesuaian saldo ${acc.name} ke ${rupiah(actual)} (${diff > 0 ? "+" : "−"}${rupiah(abs)}, ${ADJ_LABEL[reason]})${note ? ` – ${note}` : ""}`;
      const jid = await postJournal(q, { date, memo, refType: "adjustment", userId: user.id, lines });
      const drawer = lines.reduce((t, l) => (l.account === "1101" ? t + (l.debit ?? 0) - (l.credit ?? 0) : t), 0);
      if (date === todayWIB()) await linkCashMove(q, { delta: drawer, note: memo, userId: user.id, journalId: jid });
      return `Saldo disesuaikan: selisih ${diff > 0 ? "+" : "−"}${rupiah(abs)} dicatat sebagai ${ADJ_LABEL[reason]}.`;
    });
    refresh();
    return { ok: true, message: msg };
  });
}

/** Pencairan QRIS/e-wallet ke rekening bank: saldo QRIS berkurang, bank bertambah (bersih), potongan MDR jadi biaya. */
export async function settleQris(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const date = validDate(str(fd, "date"));
    const gross = int(fd, "gross"), fee = Math.max(0, int(fd, "fee"));
    if (gross <= 0) throw new Error("Nominal pencairan harus lebih dari 0.");
    if (fee >= gross) throw new Error("Potongan tidak boleh sama atau lebih besar dari nominal.");
    await tx(async (q) => {
      const from = await codeOf(q, int(fd, "from_id")), to = await codeOf(q, int(fd, "to_id"));
      if (from.subtype !== "cash" || to.subtype !== "cash" || from.code === to.code) throw new Error("Pilih dua akun kas/bank yang berbeda.");
      const note = str(fd, "note");
      const jid = await postJournal(q, {
        date, memo: `Pencairan ${from.name} ke ${to.name}${fee ? ` (potongan ${rupiah(fee)})` : ""}${note ? ` – ${note}` : ""}`, refType: "adjustment", userId: user.id,
        lines: [{ account: to.code, debit: gross - fee }, ...(fee > 0 ? [{ account: "5107", debit: fee }] : []), { account: from.code, credit: gross }],
      });
      const drawer = (to.code === "1101" ? gross - fee : 0) - (from.code === "1101" ? gross : 0);
      if (date === todayWIB()) await linkCashMove(q, { delta: drawer, note: "Pencairan dana", userId: user.id, journalId: jid });
    });
    refresh();
    return { ok: true, message: "Pencairan dicatat." };
  });
}
