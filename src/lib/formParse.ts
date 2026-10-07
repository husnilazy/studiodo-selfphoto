import { fromWIB } from "./format";
import { str } from "./action";

const CATS = ["self_photo", "photobox", "photobooth", "wisuda", "keluarga", "lainnya"];

/** Isian datetime-local ("2026-10-07T18:30", dianggap WIB) → Date, atau null bila kosong. */
export function wibInput(fd: FormData, k: string): Date | null {
  const v = str(fd, k);
  if (!v) return null;
  const [d, t] = v.split("T");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t ?? "")) throw new Error("Format tanggal/jam tidak valid.");
  return fromWIB(d, t);
}
export const idList = (fd: FormData, k: string) => [...new Set(fd.getAll(k).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
export const catList = (fd: FormData, k: string) => [...new Set(fd.getAll(k).map(String).filter((c) => CATS.includes(c)))];
