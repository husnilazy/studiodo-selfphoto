"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

const Ctx = createContext<{ close: () => void } | null>(null);
export const useSheet = () => useContext(Ctx);

/** Panel geser dari bawah (HP) / dialog tengah (desktop), dengan animasi masuk dan keluar. `trigger` = elemen yang membukanya. */
export default function Sheet({
  trigger, title, children, wide = false, className = "contents",
}: { trigger: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => { timer.current = null; setOpen(false); setClosing(false); }, 210);
  }, []);
  const ctx = useMemo(() => ({ close }), [close]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, close]);

  return (
    <>
      <span className={className} onClick={() => setOpen(true)}>{trigger}</span>
      {open && mounted && createPortal(
        <div className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center ${closing ? "sheet-closing" : ""}`}>
          <div className="sheet-bg anim-fade absolute inset-0 bg-black/45 backdrop-blur-[3px]" onClick={close} />
          <div
            role="dialog" aria-modal="true" aria-label={title}
            className={`sheet-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-panel shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <button type="button" onClick={close} className="btn btn-sm !min-h-9 !w-9 !px-0 hover:rotate-90" aria-label="Tutup"><Icon name="x" className="size-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
              <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
