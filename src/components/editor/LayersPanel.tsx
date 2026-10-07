"use client";
import Icon from "../Icon";
import { layerName } from "@/lib/editor/ops";
import type { Page } from "@/lib/editor/types";

/** Daftar layer (paling atas di baris pertama): pilih, sembunyikan, kunci, naik/turun. */
export default function LayersPanel({ page, selId, onSelect, onToggle, onMove }: {
  page: Page; selId: string | null; onSelect: (id: string) => void;
  onToggle: (id: string, k: "hidden" | "locked") => void; onMove: (id: string, d: 1 | -1) => void;
}) {
  const rows = [...page.layers].reverse();
  return (
    <div className="p-2.5">
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">Belum ada layer. Tambahkan foto, teks, atau elemen.</p>}
      <ul className="space-y-1">
        {rows.map((l) => (
          <li key={l.id}>
            <div onClick={() => l.type !== "frame" && onSelect(l.id)}
              className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${l.id === selId ? "border-accent bg-accentsoft" : "border-line bg-panel hover:border-accent/50"} ${l.hidden ? "opacity-50" : ""}`}>
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-panel2 text-[11px] text-muted">{l.type === "text" ? "T" : l.type === "photo" ? "▣" : l.type === "frame" ? "▤" : "◆"}</span>
              <span className="min-w-0 flex-1 truncate">{layerName(l)}</span>
              {l.type !== "frame" && (
                <span className="flex shrink-0 items-center gap-0.5 text-muted">
                  <button className="rounded p-1 hover:text-fg" title="Naikkan" onClick={(e) => { e.stopPropagation(); onMove(l.id, 1); }}>↑</button>
                  <button className="rounded p-1 hover:text-fg" title="Turunkan" onClick={(e) => { e.stopPropagation(); onMove(l.id, -1); }}>↓</button>
                  <button className={`rounded p-1 ${l.locked ? "text-accent" : "hover:text-fg"}`} title="Kunci" onClick={(e) => { e.stopPropagation(); onToggle(l.id, "locked"); }}><Icon name="lock" className="size-3.5" /></button>
                  <button className={`rounded p-1 ${l.hidden ? "text-accent" : "hover:text-fg"}`} title="Sembunyikan" onClick={(e) => { e.stopPropagation(); onToggle(l.id, "hidden"); }}>{l.hidden ? "◌" : "◉"}</button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
