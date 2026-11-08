export const rupiah = (n: number) => (n < 0 ? "-" : "") + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
/** 1.250.000 -> "1,3 jt", 2.400.000.000 -> "2,4 M" */
export function compact(n: number) {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  const f = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (a >= 1e9) return `${s}${f(a / 1e9)} M`;
  if (a >= 1e6) return `${s}${f(a / 1e6)} jt`;
  if (a >= 1e3) return `${s}${f(a / 1e3)} rb`;
  return `${s}${Math.round(a)}`;
}
export const pct = (n: number, d = 0) => `${n.toLocaleString("id-ID", { maximumFractionDigits: d })}%`;
/** Bulan berjalan di zona WIB, format YYYY-MM. */
export const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
export const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export function addMonths(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const monthLabel = (key: string) => `${BLN[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;
export const fullMonth = (key: string) => `${BLN[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
