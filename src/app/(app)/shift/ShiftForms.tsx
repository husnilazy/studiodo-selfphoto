"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { Field } from "@/components/ui";
import { rupiah } from "@/lib/format";
import { addDrawerCash, addShiftExpense, closeShift, openShift } from "@/app/actions/shift";

export function OpenShiftForm({ suggested }: { suggested: number }) {
  return (
    <ActionForm action={openShift} submit="Buka Shift">
      <Field label="Modal awal di laci (uang kembalian)" hint={suggested ? `Saldo Kas di buku: ${rupiah(suggested)}. Hitung fisiknya; kalau beda, selisihnya dijurnal otomatis.` : "Hitung uang tunai di laci sebelum mulai."}>
        <MoneyInput name="opening_cash" defaultValue={suggested} required />
      </Field>
      <Field label="Catatan (opsional)"><input name="note" className="input" placeholder="mis. shift pagi" /></Field>
    </ActionForm>
  );
}

export function AddCashForm() {
  return (
    <ActionForm action={addDrawerCash} submit="Tambah ke Laci">
      <Field label="Nominal uang yang dimasukkan ke laci" hint="Modal tambahan / uang kembalian / uang pribadi yang ditaruh di laci. Tercatat sebagai setoran modal pemilik."><MoneyInput name="amount" required /></Field>
      <Field label="Keterangan (opsional)"><input name="note" className="input" placeholder="mis. tambah kembalian" /></Field>
    </ActionForm>
  );
}

export function CloseShiftForm({ expected }: { expected: number }) {
  const [counted, setCounted] = useState<number | null>(null);
  const diff = counted === null ? null : counted - expected;
  return (
    <ActionForm action={closeShift} submit="Tutup Shift" confirm="Tutup shift sekarang? Setelah ditutup, rekap tidak bisa diubah.">
      <Field label="Uang tunai fisik di laci (hasil hitung)" hint={expected < 0 ? `Hitungan sistem minus ${rupiah(-expected)} — catat dulu uang yang ada lewat "Tambah Uang Laci".` : `Seharusnya ada ${rupiah(expected)} menurut sistem. Isi 0 bila laci kosong (tidak bisa minus).`}>
        <MoneyInput name="counted_cash" required onValue={setCounted} />
      </Field>
      {diff !== null && (
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${diff === 0 ? "bg-oksoft text-ok" : "bg-warnsoft text-warn"}`}>
          {diff === 0 ? "Kas pas ✓" : diff > 0 ? `Lebih ${rupiah(diff)}` : `Kurang ${rupiah(-diff)}`}
        </p>
      )}
      <Field label={diff ? "Catatan selisih (wajib)" : "Catatan (opsional)"}><input name="note" className="input" placeholder="mis. salah kembalian" required={!!diff} /></Field>
    </ActionForm>
  );
}

export function ShiftExpenseForm({ cats, inDrawer }: { cats: { id: number; name: string }[]; inDrawer: number }) {
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState<"drawer" | "owner">("drawer");
  const short = source === "drawer" && amount > Math.max(0, inDrawer);
  return (
    <ActionForm action={addShiftExpense} submit="Catat Kas Keluar">
      <div className="rounded-xl bg-panel2 px-3 py-2 text-sm">Uang tunai di laci sekarang: <b className="tnum">{rupiah(Math.max(0, inDrawer))}</b></div>
      <Field label="Nominal"><MoneyInput name="amount" required onValue={setAmount} /></Field>
      <Field label="Uang dari mana?">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${source === "drawer" ? "border-accent" : "border-line"}`}>
            <input type="radio" name="source" value="drawer" checked={source === "drawer"} onChange={() => setSource("drawer")} className="mt-0.5" />
            <span><b>Dari laci</b><span className="block text-xs text-muted">Mengurangi uang di laci</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${source === "owner" ? "border-accent" : "border-line"}`}>
            <input type="radio" name="source" value="owner" checked={source === "owner"} onChange={() => setSource("owner")} className="mt-0.5" />
            <span><b>Dibayar pribadi</b><span className="block text-xs text-muted">Ditalangi pemilik, laci tidak berubah</span></span>
          </label>
        </div>
      </Field>
      {short && <p className="rounded-xl bg-warnsoft px-3 py-2 text-sm font-medium text-warn">Uang di laci hanya {rupiah(Math.max(0, inDrawer))}, kurang dari nominal ini. Pilih “Dibayar pribadi”, atau tambah uang laci dulu.</p>}
      <Field label="Kategori">
        <select name="account_id" className="input" required>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </Field>
      <Field label="Keperluan"><input name="note" className="input" placeholder="mis. beli kertas foto" required /></Field>
    </ActionForm>
  );
}
