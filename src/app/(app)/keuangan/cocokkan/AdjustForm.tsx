"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { Field } from "@/components/ui";
import { adjustBalance } from "@/app/actions/finance";

const rp = (n: number) => "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
const REASONS = [
  ["opening", "Saldo awal: uang yang sudah ada sebelum aplikasi dipakai"],
  ["selisih", "Selisih tidak diketahui (lebih = pendapatan lain, kurang = beban lain)"],
  ["admin", "Biaya admin bank / potongan (hanya bila saldo kurang)"],
  ["transfer", "Pindah dana dari/ke akun kas lain"],
] as const;

export default function AdjustForm({ id, name, book, today, others }: { id: number; name: string; book: number; today: string; others: { id: number; name: string }[] }) {
  const [actual, setActual] = useState<number | null>(null);
  const [reason, setReason] = useState("opening");
  const diff = actual == null ? null : actual - book;
  return (
    <ActionForm action={adjustBalance} submit={`Samakan saldo ${name}`} confirm={`Catat penyesuaian saldo ${name}?`}>
      <input type="hidden" name="account_id" value={id} />
      <Field label="Saldo sebenarnya sekarang" hint="Hitung uang di laci / lihat saldo di mutasi bank / aplikasi e-wallet.">
        <MoneyInput name="actual" required onValue={setActual} />
      </Field>
      {diff != null && (
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${diff === 0 ? "bg-oksoft text-ok" : "bg-panel2"}`}>
          {diff === 0 ? "Sudah sama dengan buku." : <>Buku {rp(book)} → sebenarnya {rp(actual!)}. Selisih <span className={diff > 0 ? "text-ok" : "text-bad"}>{diff > 0 ? "+" : "−"}{rp(diff)}</span>.</>}
        </p>
      )}
      <Field label="Penyebab selisih">
        <select name="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </Field>
      {reason === "transfer" && (
        <Field label="Pasangan akun" hint="Saldo akun ini naik → akun pasangan turun, dan sebaliknya.">
          <select name="other_id" className="input" required>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tanggal pencatatan"><input type="date" name="date" className="input" defaultValue={today} required /></Field>
        <Field label="Catatan"><input name="note" className="input" placeholder="mis. saldo per 21 Sep" /></Field>
      </div>
    </ActionForm>
  );
}
