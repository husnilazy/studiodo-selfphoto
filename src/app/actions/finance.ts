"use server";
import { revalidatePath } from "next/cache";
import { q as rootQ, tx } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { int, req, safe, str } from "@/lib/action";
import { postJournal, voidJournal } from "@/lib/ledger";
import { fmtMonth, monthEnd, rupiah, todayWIB } from "@/lib/format";
import type { ActionState } from "@/components/ActionForm";

const refresh = () => { revalidatePath("/keuangan", "layout"); revalidatePath("/dashboard"); };
const validDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Tanggal tidak valid.");
  return d;
};

/** Kode akun dari id (untuk jurnal). */
async function codeOf(q: typeof rootQ, id: number, types?: string[]) {
  const [a] = await q<{ code: string; type: string; subtype: string; active: boolean }>("select code, type, subtype, active from accounts where id = $1", [id]);
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
      await postJournal(q, {
        date, memo: `${def.label}${str(fd, "note") ? ` – ${str(fd, "note")}` : ""}`, refType: "cash", userId: user.id,
        lines: def.build(cash.code, null, amount, to),
      });
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
      await postJournal(q, { date, memo, refType: "manual", userId: user.id, lines });
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
      if (!["manual", "cash", "depreciation"].includes(j.ref_type)) throw new Error("Jurnal ini dibuat otomatis dari transaksi lain. Batalkan lewat transaksi asalnya.");
      if (j.ref_type === "depreciation") await q("delete from asset_depreciation where journal_id = $1", [id]);
      await voidJournal(q, id);
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
      const asset = await codeOf(q, int(fd, "asset_account_id"), ["asset"]);
      const from = str(fd, "paid_from");
      const credit = from === "equity" ? { code: "3101" } : await codeOf(q, Number(from));
      if (from !== "equity" && (credit as { subtype: string }).subtype !== "cash") throw new Error("Sumber dana harus akun kas/bank atau modal pemilik.");
      const [a] = await q<{ id: number }>(
        `insert into fixed_assets (name, acquired_on, cost, salvage, life_months, asset_account_id, paid_from_account_id, note, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [name, date, cost, salvage, life, int(fd, "asset_account_id"),
          from === "equity" ? (await q<{ id: number }>("select id from accounts where code='3101'"))[0].id : Number(from), str(fd, "note"), user.id]);
      const jid = await postJournal(q, {
        date, memo: `${from === "equity" ? "Aset awal" : "Pembelian aset"}: ${name}`, refType: "asset", refId: a.id, userId: user.id,
        lines: [{ account: asset.code, debit: cost }, { account: credit.code, credit: cost }],
      });
      await q("update fixed_assets set purchase_journal_id = $1 where id = $2", [jid, a.id]);
    });
    refresh();
  });
}

/** Mencatat penyusutan garis lurus untuk satu bulan (semua aset yang belum disusutkan di bulan itu). */
export async function runDepreciation(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner"]);
    const period = str(fd, "period") || todayWIB().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Periode tidak valid.");
    const end = monthEnd(`${period}-01`);
    const total = await tx(async (q) => {
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
        date: end, memo: `Penyusutan ${fmtMonth(`${period}-01`)}`, refType: "depreciation", userId: user.id,
        lines: [{ account: "5190", debit: sum }, { account: "1590", credit: sum }],
      });
      for (const r of rows) await q("insert into asset_depreciation (asset_id, period, amount, journal_id) values ($1,$2,$3,$4)", [r.id, period, r.amt, jid]);
      return sum;
    });
    if (total === 0) throw new Error("Tidak ada aset yang perlu disusutkan untuk periode itu (sudah dicatat atau belum ada aset).");
    refresh();
    return { ok: true, message: `Penyusutan ${rupiah(total)} dicatat.` };
  });
}

