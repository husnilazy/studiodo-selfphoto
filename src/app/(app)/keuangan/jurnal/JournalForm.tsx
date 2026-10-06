"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import { manualJournal } from "@/app/actions/finance";
import { rupiah } from "@/lib/format";

type A = { id: number; code: string; name: string };
const digits = (s: string) => Number(s.replace(/\D/g, "")) || 0;

export default function JournalForm({ accounts, today }: { accounts: A[]; today: string }) {
  const [rows, setRows] = useState([{ d: "", c: "" }, { d: "", c: "" }]);
  const set = (i: number, k: "d" | "c", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v.replace(/\D/g, "") } : x)));
  const D = rows.reduce((s, r) => s + digits(r.d), 0), C = rows.reduce((s, r) => s + digits(r.c), 0);
  return (
    <ActionForm action={manualJournal} submit="Simpan Jurnal">
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Tanggal</span><input type="date" name="date" className="input" defaultValue={today} required /></label>
        <label className="block"><span className="label">Keterangan</span><input name="memo" className="input" required placeholder="mis. Koreksi saldo" /></label>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-2 text-xs font-bold uppercase tracking-wide text-muted"><span>Akun</span><span>Debit</span><span>Kredit</span></div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-2">
            <select name="acc" className="input !px-2 !text-sm" defaultValue="">
              <option value="">Pilih akun…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
            <input name="debit" inputMode="numeric" className="input tnum !px-2 text-right" value={r.d ? Number(r.d).toLocaleString("id-ID") : ""} onChange={(e) => set(i, "d", e.target.value)} placeholder="0" />
            <input name="credit" inputMode="numeric" className="input tnum !px-2 text-right" value={r.c ? Number(r.c).toLocaleString("id-ID") : ""} onChange={(e) => set(i, "c", e.target.value)} placeholder="0" />
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setRows((r) => [...r, { d: "", c: "" }])}>+ Baris</button>
      </div>
      <div className={`flex justify-between rounded-xl px-3 py-2 text-sm font-semibold ${D === C && D > 0 ? "bg-oksoft text-ok" : "bg-warnsoft text-warn"}`}>
        <span>Debit {rupiah(D)} · Kredit {rupiah(C)}</span><span>{D === C && D > 0 ? "Seimbang ✓" : `Selisih ${rupiah(Math.abs(D - C))}`}</span>
      </div>
    </ActionForm>
  );
}
