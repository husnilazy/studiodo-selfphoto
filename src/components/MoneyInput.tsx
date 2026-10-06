"use client";
import { useState } from "react";

const fmt = (v: string) => {
  const d = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

/** Input rupiah dengan pemisah ribuan otomatis. Nilai mentah dibaca server lewat int(). */
export default function MoneyInput({
  name, defaultValue = 0, required, placeholder = "0", onValue, className = "",
}: { name: string; defaultValue?: number; required?: boolean; placeholder?: string; onValue?: (n: number) => void; className?: string }) {
  const [v, setV] = useState(defaultValue ? fmt(String(defaultValue)) : "");
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">Rp</span>
      <input
        name={name} inputMode="numeric" autoComplete="off" required={required} placeholder={placeholder}
        className={`input tnum !pl-10 ${className}`} value={v}
        onChange={(e) => { const f = fmt(e.target.value); setV(f); onValue?.(Number(f.replace(/\D/g, "")) || 0); }}
      />
    </div>
  );
}
