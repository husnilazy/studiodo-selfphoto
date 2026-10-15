"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { Field } from "@/components/ui";
import { rupiah } from "@/lib/format";
import { addShiftExpense, closeShift, openShift } from "@/app/actions/shift";

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

export function CloseShiftForm({ expected }: { expected: number }) {
  const [counted, setCounted] = useState<number | null>(null);
  const diff = counted === null ? null : counted - expected;
  return (
    <ActionForm action={closeShift} submit="Tutup Shift" confirm="Tutup shift sekarang? Setelah ditutup, rekap tidak bisa diubah.">
      <Field label="Uang tunai fisik di laci (hasil hitung)" hint={`Seharusnya ada ${rupiah(expected)} menurut sistem.`}>
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

export function ShiftExpenseForm({ cats }: { cats: { id: number; name: string }[] }) {
  return (
    <ActionForm action={addShiftExpense} submit="Catat Kas Keluar">
      <Field label="Nominal"><MoneyInput name="amount" required /></Field>
      <Field label="Kategori">
        <select name="account_id" className="input" required>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </Field>
      <Field label="Keperluan"><input name="note" className="input" placeholder="mis. beli kertas foto" required /></Field>
    </ActionForm>
  );
}
