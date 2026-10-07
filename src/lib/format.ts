// Pembantu format & tanggal (zona waktu WIB / Asia/Jakarta). Aman dipakai di server maupun client.
const TZ = "Asia/Jakarta";

export const rupiah = (n: number | null | undefined) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-Rp " : "Rp ") + Math.abs(v).toLocaleString("id-ID");
};
export const num = (n: number) => Math.round(n).toLocaleString("id-ID");

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const o: Record<string, string> = {};
  for (const p of f) o[p.type] = p.value;
  if (o.hour === "24") o.hour = "00";
  return o;
};

/** 'YYYY-MM-DD' di WIB */
export const dateWIB = (d: Date | string) => {
  const p = parts(new Date(d));
  return `${p.year}-${p.month}-${p.day}`;
};
/** 'HH:mm' di WIB */
export const timeWIB = (d: Date | string) => {
  const p = parts(new Date(d));
  return `${p.hour}:${p.minute}`;
};
export const todayWIB = () => dateWIB(new Date());
/** 'YYYY-MM-DD' + 'HH:mm' (WIB) -> Date */
export const fromWIB = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`);

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (date: string, n: number) => {
  const [y, m, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};
export const monthStart = (date: string) => date.slice(0, 8) + "01";
export const monthEnd = (date: string) => {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
export const monthName = (m: number) => MONTHS[m - 1];

export const fmtDate = (date: string, opts: { weekday?: boolean; short?: boolean } = {}) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const wd = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const mn = opts.short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1];
  return `${opts.weekday ? wd + ", " : ""}${d} ${mn} ${y}`;
};
export const fmtDateTime = (d: Date | string) => `${fmtDate(dateWIB(d), { short: true })} · ${timeWIB(d)}`;
export const fmtMonth = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

export const minutesBetween = (a: Date | string, b: Date | string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

export const addMin = (time: string, min: number) => {
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m + min;
  const hh = Math.floor((t % 1440) / 60), mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu", confirmed: "Terkonfirmasi", done: "Selesai", cancelled: "Dibatalkan", no_show: "Tidak Hadir",
};
export const STATUS_TONE: Record<string, string> = {
  pending: "amber", confirmed: "indigo", done: "green", cancelled: "red", no_show: "slate",
};
export const CATEGORY_LABEL: Record<string, string> = {
  self_photo: "Self Photo", photobox: "Photobox", photobooth: "Photobooth", wisuda: "Wisuda", keluarga: "Keluarga & Pas Foto", lainnya: "Lainnya",
};
export const METHOD_LABEL: Record<string, string> = { cash: "Tunai", qris: "QRIS", transfer: "Transfer" };
export const SOURCE_LABEL: Record<string, string> = {
  walkin: "Walk-in", whatsapp: "WhatsApp", instagram: "Instagram", website: "Website", lainnya: "Lainnya",
};
export const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", kasir: "Kasir" };
export const FILE_KIND_LABEL: Record<string, string> = {
  foto_asli: "Foto Asli", foto_edit: "Foto Edit", video: "Video", album: "Album", lainnya: "Lainnya",
};
export const FILE_STATUS_LABEL: Record<string, string> = { proses: "Diproses", siap: "Siap Kirim", terkirim: "Terkirim" };

export const waLink = (phone: string, text: string) => {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
};
