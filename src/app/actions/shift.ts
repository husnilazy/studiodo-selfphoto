"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tx } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { int, req, safe, str } from "@/lib/action";
import { postJournal } from "@/lib/ledger";
import { getOpenShift, shiftTotals } from "@/lib/shift";
import { rupiah, todayWIB } from "@/lib/format";
import type { ActionState } from "@/components/ActionForm";

const refresh = () => { revalidatePath("/shift"); revalidatePath("/dashboard"); revalidatePath("/keuangan", "layout"); };

export async function openShift(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser();
    const cash = int(fd, "opening_cash");
    if (cash < 0) throw new Error("Modal awal tidak boleh negatif.");
    await tx(async (q) => {
      if (await getOpenShift(q)) throw new Error("Masih ada shift yang terbuka. Tutup dulu sebelum membuka yang baru.");
      let sh: { id: number };
      try {
        [sh] = await q<{ id: number }>("insert into shifts (opened_by, opening_cash, open_note) values ($1,$2,$3) returning id", [user.id, cash, str(fd, "note")]);
      } catch {
        throw new Error("Shift baru saja dibuka dari perangkat lain.");
      }
      // Samakan saldo Kas di buku dengan uang yang benar-benar ada di laci saat ini:
      // modal laci yang belum pernah dijurnal dicatat sebagai setoran modal, uang yang diambil pemilik sebagai prive.
      const [bal] = await q<{ b: number }>(
        `select coalesce(sum(l.debit - l.credit),0) as b from journal_lines l join journals j on j.id = l.journal_id
          join accounts a on a.id = l.account_id where a.code = '1101' and not j.voided`);
      const gap = cash - Number(bal.b);
      if (gap !== 0) {
        await postJournal(q, {
          date: todayWIB(), memo: `Penyesuaian kas laci saat buka shift #${sh.id} (${gap > 0 ? "modal laci" : "uang diambil pemilik"})`, refType: "cash", userId: user.id,
          lines: gap > 0 ? [{ account: "1101", debit: gap }, { account: "3101", credit: gap }] : [{ account: "3201", debit: -gap }, { account: "1101", credit: -gap }],
        });
      }
    });
    refresh();
    return { ok: true, message: "Shift dibuka. Selamat bekerja!" };
  });
}

/** Kas keluar dari laci selama shift (beli es batu, bayar ojek, dll) — otomatis jadi pengeluaran & jurnal. */
export async function addShiftExpense(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser();
    const amount = int(fd, "amount");
    if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
    const note = req(str(fd, "note"), "Tulis keperluan pengeluaran.");
    await tx(async (q) => {
      const sh = await getOpenShift(q);
      if (!sh) throw new Error("Buka shift dulu.");
      const [acc] = await q<{ id: number; code: string }>("select id, code from accounts where id = $1 and type = 'expense' and active", [int(fd, "account_id")]);
      if (!acc) throw new Error("Pilih kategori pengeluaran.");
      const [cash] = await q<{ id: number }>("select id from accounts where code = '1101'");
      const date = todayWIB();
      const [e] = await q<{ id: number }>(
        "insert into expenses (date, account_id, paid_from_account_id, amount, vendor, note, created_by) values ($1,$2,$3,$4,'',$5,$6) returning id",
        [date, acc.id, cash.id, amount, note, user.id]);
      const jid = await postJournal(q, {
        date, memo: `Kas keluar laci (shift #${sh.id}) – ${note}`, refType: "expense", refId: e.id, userId: user.id,
        lines: [{ account: acc.code, debit: amount }, { account: "1101", credit: amount }],
      });
      await q("update expenses set journal_id = $1 where id = $2", [jid, e.id]);
      await q("insert into shift_moves (shift_id, amount, note, expense_id, created_by) values ($1,$2,$3,$4,$5)", [sh.id, amount, note, e.id, user.id]);
    });
    refresh();
  });
}

export async function closeShift(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser();
    const counted = int(fd, "counted_cash");
    if (counted < 0) throw new Error("Uang fisik tidak boleh negatif.");
    const msg = await tx(async (q) => {
      const [sh] = await q<{ id: number; opened_by: number | null; opening_cash: number }>(
        "select id, opened_by, opening_cash from shifts where closed_at is null for update");
      if (!sh) throw new Error("Tidak ada shift yang terbuka.");
      if (sh.opened_by !== user.id && user.role === "kasir") throw new Error("Shift ini dibuka kasir lain. Hanya pembukanya, admin, atau owner yang bisa menutup.");
      const t = await shiftTotals(sh.id, Number(sh.opening_cash), q);
      const diff = counted - t.expected;
      const note = str(fd, "note");
      if (diff !== 0 && !note) throw new Error(`Ada selisih ${rupiah(diff)}. Tulis catatan penyebabnya.`);
      let jid: number | null = null;
      if (diff !== 0) {
        // Samakan saldo Kas di buku dengan uang fisik: lebih → pendapatan lain, kurang → beban lain-lain.
        jid = await postJournal(q, {
          date: todayWIB(), memo: `Selisih kas shift #${sh.id} (${diff > 0 ? "lebih" : "kurang"})`, refType: "cash", userId: user.id,
          lines: diff > 0
            ? [{ account: "1101", debit: diff }, { account: "4105", credit: diff }]
            : [{ account: "5109", debit: -diff }, { account: "1101", credit: -diff }],
        });
      }
      await q(
        `update shifts set closed_by=$1, closed_at=now(), expected_cash=$2, counted_cash=$3, difference=$4,
                sales_cash=$5, sales_qris=$6, sales_transfer=$7, cash_out=$8, close_note=$9, diff_journal_id=$10, cash_in=$12 where id=$11`,
        [user.id, t.expected, counted, diff, t.cash, t.qris, t.transfer, t.cashOut, note, jid, sh.id, t.cashIn]);
      return { id: sh.id, diff };
    });
    refresh();
    // redirect dari server: form tutup shift ikut hilang saat halaman di-refresh, jadi redirect di client tidak sempat jalan.
    redirect(`/shift/${msg.id}`);
  });
}
