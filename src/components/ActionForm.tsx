"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSheet } from "./Sheet";
import { toast } from "./Toaster";

export type ActionState = { ok?: boolean; error?: string; message?: string; redirect?: string } | null;
export type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const PendingCtx = createContext(false);

/**
 * Form yang memanggil server action, menampilkan error, menutup Sheet saat berhasil.
 * Memakai onSubmit (bukan prop `action`) agar isian TIDAK dikosongkan otomatis saat terjadi error.
 */
export default function ActionForm({
  action, children, submit = "Simpan", className = "space-y-4", danger = false, confirm, hideSubmit = false,
}: {
  action: Action; children?: React.ReactNode; submit?: string; className?: string;
  danger?: boolean; confirm?: string; hideSubmit?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const sheet = useSheet();
  const router = useRouter();
  const handled = useRef<unknown>(null);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      if (!state.redirect) toast(state.message || "Berhasil disimpan");
      sheet?.close();
      if (state.redirect) router.push(state.redirect);
      else router.refresh();
    }
  }, [state, sheet, router]);

  return (
    <PendingCtx.Provider value={pending}>
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          if (pending) return;
          const fd = new FormData(e.currentTarget);
          startTransition(() => run(fd));
        }}
      >
        {children}
        {state?.error && (
          <p role="alert" className="rounded-xl bg-badsoft px-3 py-2 text-sm font-medium text-bad">{state.error}</p>
        )}
        {state?.ok && state.message && (
          <p role="status" className="rounded-xl bg-oksoft px-3 py-2 text-sm font-medium text-ok">{state.message}</p>
        )}
        {!hideSubmit && (
          <button type="submit" disabled={pending} className={`btn btn-block ${danger ? "btn-danger" : "btn-primary"}`}>
            {pending && <span className="spinner" />} {submit}
          </button>
        )}
      </form>
    </PendingCtx.Provider>
  );
}

/** Tombol kecil yang langsung menjalankan server action (dengan konfirmasi opsional). */
export function ActionButton({
  action, label, confirm, className = "btn btn-sm", children,
}: { action: Action; label?: string; confirm?: string; className?: string; children?: React.ReactNode }) {
  return (
    <ActionForm action={action} confirm={confirm} className="contents" hideSubmit>
      <SubmitBtn className={className}>{children ?? label}</SubmitBtn>
    </ActionForm>
  );
}

function SubmitBtn({ className, children }: { className: string; children: React.ReactNode }) {
  const pending = useContext(PendingCtx);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && <span className="spinner" />} {children}
    </button>
  );
}
