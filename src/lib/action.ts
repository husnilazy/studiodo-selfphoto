import "server-only";
import type { ActionState } from "@/components/ActionForm";

/** Bungkus server action: error jadi pesan yang rapi, bukan crash. */
export async function safe(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    const r = await fn();
    return r ?? { ok: true };
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error(e);
    return { error: e instanceof Error ? e.message : "Terjadi kesalahan." };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const int = (fd: FormData, k: string) => {
  const raw = String(fd.get(k) ?? "").replace(/[^\d-]/g, "");
  const n = parseInt(raw || "0", 10);
  return Number.isFinite(n) ? n : 0;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const req = (v: string, msg: string) => {
  if (!v) throw new Error(msg);
  return v;
};
