import ActionForm from "./ActionForm";
import MoneyInput from "./MoneyInput";
import { Field } from "./ui";
import { q } from "@/lib/db";
import { todayWIB } from "@/lib/format";
import { addExpense, cashTxn } from "@/app/actions/finance";

export const cashAccounts = () => q<{ id: number; code: string; name: string }>("select id, code, name from accounts where subtype = 'cash' and active order by code");

export async function ExpenseForm() {
  const [cats, cash] = await Promise.all([
    q<{ id: number; code: string; name: string }>("select id, code, name from accounts where type = 'expense' and active and code <> '5190' order by code"),
    cashAccounts(),
  ]);
  return (
    <ActionForm action={addExpense} submit="Simpan Pengeluaran">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tanggal"><input type="date" name="date" className="input" defaultValue={todayWIB()} required /></Field>
        <Field label="Nominal"><MoneyInput name="amount" required /></Field>
      </div>
      <Field label="Kategori">
        <select name="account_id" className="input" required>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Dibayar dari">
        <select name="paid_from" className="input" required>
          {cash.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Penerima / toko (opsional)"><input name="vendor" className="input" placeholder="mis. Toko Kertas Foto" /></Field>
      <Field label="Keterangan"><input name="note" className="input" placeholder="mis. Kertas 4R 10 pack" /></Field>
      <Field label="Link nota/bukti (opsional)"><input name="receipt_url" type="url" className="input" placeholder="https://…" /></Field>
    </ActionForm>
  );
}

export async function CashTxnForm() {
  const cash = await cashAccounts();
  return (
    <ActionForm action={cashTxn} submit="Catat">
      <Field label="Jenis transaksi">
        <select name="type" className="input" required defaultValue="modal">
          <option value="modal">Setoran modal / saldo awal</option>
          <option value="prive">Prive (penarikan pemilik)</option>
          <option value="transfer">Transfer antar kas (kas ↔ bank ↔ QRIS)</option>
          <option value="income">Pendapatan lain-lain</option>
          <option value="loan_in">Terima pinjaman</option>
          <option value="loan_pay">Bayar pinjaman</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tanggal"><input type="date" name="date" className="input" defaultValue={todayWIB()} required /></Field>
        <Field label="Nominal"><MoneyInput name="amount" required /></Field>
      </div>
      <Field label="Akun kas / bank (asal)">
        <select name="account_id" className="input" required>{cash.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </Field>
      <Field label="Tujuan (khusus transfer)">
        <select name="to_account_id" className="input" defaultValue="">
          <option value="">—</option>
          {cash.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Keterangan (opsional)"><input name="note" className="input" placeholder="mis. Saldo awal per 1 Okt" /></Field>
      <p className="rounded-xl bg-panel2 p-3 text-xs text-muted">
        Tips mulai: catat <b>Setoran modal / saldo awal</b> untuk uang tunai & saldo bank yang sudah ada, dan daftarkan peralatan lama di menu <b>Aset Tetap</b> (sumber: Modal pemilik).
      </p>
    </ActionForm>
  );
}
