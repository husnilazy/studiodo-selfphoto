"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type C = { id: number; name: string; phone: string };

/**
 * Cari customer lama atau isi customer baru.
 * Mengirim: customer_id (jika dipilih) atau new_name + new_phone (jika baru).
 */
export default function CustomerPicker({ allowNew = true, initial }: { allowNew?: boolean; initial?: C | null }) {
  const [sel, setSel] = useState<C | null>(initial ?? null);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<C[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/customers?q=${encodeURIComponent(term)}`);
        const j = (await r.json()) as C[];
        if (id === seq.current) setRows(j);
      } finally { if (id === seq.current) setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [term, open]);

  if (sel) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel2 px-3 py-2.5">
        <input type="hidden" name="customer_id" value={sel.id} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{sel.name}</p>
          <p className="truncate text-xs text-muted">{sel.phone || "tanpa nomor"}</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => { setSel(null); setTerm(""); }}>Ganti</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          className="input !pl-10" placeholder="Cari nama / no. HP customer…" value={term}
          onFocus={() => setOpen(true)} onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        />
        {open && (
          <div className="anim-fade absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-xl">
            {loading && rows.length === 0 && <p className="p-3 text-sm text-muted">Mencari…</p>}
            {!loading && rows.length === 0 && <p className="p-3 text-sm text-muted">Tidak ada yang cocok.</p>}
            {rows.map((c) => (
              <button type="button" key={c.id} onClick={() => { setSel(c); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-panel2">
                <span className="truncate font-semibold">{c.name}</span>
                <span className="shrink-0 text-xs text-muted">{c.phone}</span>
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-lg px-3 py-2 text-center text-xs font-semibold text-muted hover:bg-panel2">Tutup</button>
          </div>
        )}
      </div>
      {allowNew && (
        <div className="rounded-xl border border-dashed border-line p-3">
          <p className="mb-2 text-xs font-semibold text-muted">…atau customer baru</p>
          <div className="grid grid-cols-2 gap-2">
            <input name="new_name" className="input" placeholder="Nama" />
            <input name="new_phone" className="input" inputMode="tel" placeholder="No. WhatsApp" />
          </div>
        </div>
      )}
    </div>
  );
}
