"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ConfirmOpts = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = tindakan berisiko (hapus, tutup permanen): tombol merah, fokus awal ke Batal. */
  danger?: boolean;
};
type Req = ConfirmOpts & { resolve: (ok: boolean) => void };

/**
 * Pengganti `window.confirm` yang tampil sesuai tema aplikasi.
 * `if (!(await askConfirm({ message: "Hapus file ini?", danger: true }))) return;`
 * Butuh <ConfirmHost /> terpasang di halaman (sudah ada di AppShell, galeri, dan editor).
 * Bila host belum terpasang, jatuh ke dialog bawaan peramban agar aksi tidak macet.
 */
export function askConfirm(o: ConfirmOpts): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let handled = false;
    const req: Req = { ...o, resolve: (ok) => { handled = true; resolve(ok); } };
    window.dispatchEvent(new CustomEvent("sd-confirm", { detail: req }));
    setTimeout(() => { if (!handled && !document.querySelector("[data-confirm-host]")) resolve(window.confirm(o.message)); }, 0);
  });
}

export default function ConfirmHost() {
  const [queue, setQueue] = useState<Req[]>([]);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cur = queue[0];

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, (e as CustomEvent<Req>).detail]);
    window.addEventListener("sd-confirm", on);
    return () => window.removeEventListener("sd-confirm", on);
  }, []);

  const answer = useCallback((ok: boolean) => {
    if (!cur || closing) return;
    setClosing(true);
    setTimeout(() => { cur.resolve(ok); setQueue((q) => q.slice(1)); setClosing(false); }, 160);
  }, [cur, closing]);

  useEffect(() => {
    if (!cur) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (cur.danger ? cancelRef : okRef).current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); answer(false); }
      else if (e.key === "Tab") { // fokus tetap di dalam dialog
        const els = [cancelRef.current, okRef.current].filter(Boolean) as HTMLElement[];
        const i = els.indexOf(document.activeElement as HTMLElement);
        e.preventDefault(); els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length]?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", k); };
  }, [cur, answer]);

  return (
    <>
      <span data-confirm-host hidden />
      {mounted && cur && createPortal(
        <div className={`fixed inset-0 z-[90] grid place-items-center p-4 ${closing ? "confirm-closing" : ""}`}>
          <div className="confirm-bg absolute inset-0" onClick={() => answer(false)} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-msg"
            className="confirm-panel relative w-full max-w-sm rounded-3xl border border-line p-6 text-center shadow-2xl">
            <span className={`mx-auto mb-4 grid size-14 place-items-center rounded-2xl ${cur.danger ? "bg-badsoft text-bad" : "bg-accentsoft text-accent"}`} aria-hidden>
              <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                {cur.danger ? <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /> : <path d="M12 17h.01M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.1-1.3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />}
              </svg>
            </span>
            <h2 id="cf-title" className="font-display text-lg font-semibold">{cur.title ?? (cur.danger ? "Yakin lanjutkan?" : "Konfirmasi")}</h2>
            <p id="cf-msg" className="mt-2 text-sm leading-relaxed text-muted">{cur.message}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button ref={cancelRef} type="button" className="btn" onClick={() => answer(false)}>{cur.cancelLabel ?? "Batal"}</button>
              <button ref={okRef} type="button" className={cur.danger ? "btn confirm-danger" : "btn btn-primary"} onClick={() => answer(true)}>{cur.confirmLabel ?? "Ya, lanjut"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
