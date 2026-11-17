"use client";
import { useState, type ReactNode } from "react";

/** Baris folder yang bisa dibuka: `info` = bagian yang diketuk untuk membuka, `actions` = tombol yang berdiri sendiri. */
export default function FolderToggle({ info, actions, children }: { info: ReactNode; actions: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-xl text-left">{info}
          <span className={`ml-auto shrink-0 text-xs font-semibold text-accent transition ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      </div>
      {open && <div className="divide-y divide-line border-t border-line bg-panel2/30">{children}</div>}
    </div>
  );
}
