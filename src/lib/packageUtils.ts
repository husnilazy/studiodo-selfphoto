// Aturan paket yang dipakai bersama oleh server & client (tanpa akses database).

export type PackageRule = {
  price: number; per_person: boolean; max_people: number;
  option_label: string; options: string; room_ids: number[];
  /** Minimal orang (default 1). Paket sesi: orang yang sudah termasuk di harga + tarif tiap orang tambahan (0 = tidak ada tarif tambahan). */
  min_people?: number; included_people?: number; extra_person_price?: number;
};

/** Pilihan varian disimpan satu per baris di database. */
export const parseOptions = (s: string) => s.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 12);

/** Jumlah unit yang ditagih: per orang = jumlah orang, selain itu 1 paket. */
export const unitsFor = (p: Pick<PackageRule, "per_person">, people: number) => (p.per_person ? Math.max(1, people) : 1);

type Pricing = Pick<PackageRule, "price" | "per_person" | "included_people" | "extra_person_price">;

/** Jumlah orang tambahan yang dikenai tarif tambahan (hanya paket per sesi yang punya "orang termasuk" + tarif tambahan). */
export const extraPeople = (p: Pricing, people: number) =>
  !p.per_person && (p.included_people ?? 0) > 0 && (p.extra_person_price ?? 0) > 0 ? Math.max(0, Math.round(people) - (p.included_people ?? 0)) : 0;

/** Harga paket sebelum diskon: per orang = harga × orang; per sesi = harga + tarif × orang tambahan. SATU-SATUNYA rumus harga paket. */
export const packageBase = (p: Pricing, people: number) => p.price * unitsFor(p, people) + extraPeople(p, people) * (p.extra_person_price ?? 0);
export const packageTotal = packageBase;

/** Harga per unit untuk baris booking (qty × unit_price harus = packageBase). */
export const itemUnitPrice = (p: Pricing, people: number) => (p.per_person ? p.price : packageBase(p, people));
/** Nama baris booking, memberi tahu bila ada orang tambahan. */
export const itemName = (name: string, p: Pricing, people: number) => {
  const n = extraPeople(p, people);
  return n > 0 ? `${name} (+${n} orang)` : name;
};

/** Rentang orang untuk tampilan, mis. "4–6 orang" atau "maks 5 orang". */
export const peopleRange = (p: Pick<PackageRule, "max_people" | "min_people">) =>
  (p.min_people ?? 1) > 1 ? `${p.min_people}–${p.max_people} orang` : `maks ${p.max_people} orang`;

export const priceSuffix = (p: Pick<PackageRule, "per_person">) => (p.per_person ? "/ orang" : "/ sesi");

/** Apakah ruang boleh dipakai paket ini? (tidak ada pembatasan = semua ruang boleh) */
export const roomAllowed = (p: Pick<PackageRule, "room_ids">, roomId: number | null) =>
  p.room_ids.length === 0 || (roomId !== null && p.room_ids.includes(roomId));

/** Tampilan foto kartu paket (diatur dari admin, dipakai kartu admin, pratinjau, dan landing page). */
export type PackageImage = { image_url: string; images?: string[]; image_size?: string; image_fit?: string; image_x?: number; image_y?: number };
/** Semua foto paket berurutan: sampul dulu, lalu foto tambahan. */
export const packageImages = (p: Pick<PackageImage, "image_url" | "images">): string[] =>
  [p.image_url, ...(Array.isArray(p.images) ? p.images : [])].filter((u): u is string => typeof u === "string" && u.length > 0);
export const IMAGE_SIZES = { sm: { label: "Kecil", h: 132 }, md: { label: "Sedang", h: 184 }, lg: { label: "Besar", h: 248 } } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;
export const imageSizeKey = (s?: string): ImageSize => (s === "sm" || s === "lg" ? s : "md");
export const imageStyle = (p: PackageImage) => ({
  objectFit: (p.image_fit === "contain" ? "contain" : "cover") as "contain" | "cover",
  objectPosition: `${p.image_x ?? 50}% ${p.image_y ?? 50}%`,
});

/* ───────── Sewa event (per jam) ───────── */
export type EventRule = { price: number; base_hours: number; extra_hour_price: number; max_hours: number; outputs: string };
export type EventOutput = { label: string; delta: number };

/** Pilihan output disimpan satu per baris: "Nama output|selisih harga" (selisih boleh negatif, mis. "Softfile saja|-300000"). */
export function parseOutputs(s: string): EventOutput[] {
  return s.split(/\r?\n/).map((line) => {
    const [label, raw = ""] = line.split("|");
    const n = Number(raw.replace(/[^\d-]/g, ""));
    return { label: (label ?? "").trim().slice(0, 60), delta: Number.isFinite(n) ? Math.trunc(n) : 0 };
  }).filter((o) => o.label).slice(0, 8);
}
/** Rentang jam yang bisa dipesan: dari jam dasar sampai batas (tanpa batas = dasar + 8 jam). */
export const eventHours = (p: Pick<EventRule, "base_hours" | "max_hours">) => ({
  min: Math.max(1, p.base_hours), max: Math.max(Math.max(1, p.base_hours), p.max_hours > 0 ? p.max_hours : p.base_hours + 8),
});
/** Total sewa: harga jam dasar + tarif jam tambahan + selisih output. SATU-SATUNYA rumus harga event. */
export const eventTotal = (p: EventRule, hours: number, outputDelta = 0) => {
  const { min, max } = eventHours(p);
  const h = Math.min(max, Math.max(min, Math.round(hours)));
  return Math.max(0, p.price + (h - min) * p.extra_hour_price + outputDelta);
};

/* ───────── Tambahan & bonus FREE untuk sewa event ───────── */
export type EventAddon = {
  label: string; price: number;
  /** FREE: tidak dikenai biaya. `price` tetap dicatat sebagai "senilai" untuk gimmick (boleh 0). */
  free: boolean;
  /** FREE hanya berlaku bila durasi sewa >= min_hours (0 = selalu). Di bawah itu item ini jadi tambahan berbayar. */
  min_hours: number;
};

/** Satu baris: "nama|harga|free|minimal jam". Kolom 3 diisi "free"/"gratis" untuk bonus; kolom 4 (opsional) = syarat minimal jam. */
export function parseEventAddons(s: string): EventAddon[] {
  return s.split(/\r?\n/).map((line) => {
    const [label = "", price = "", mode = "", min = ""] = line.split("|");
    const num = (v: string) => { const n = Number(v.replace(/[^\d]/g, "")); return Number.isFinite(n) ? Math.trunc(n) : 0; };
    return { label: label.trim().slice(0, 60), price: num(price), free: /^(free|gratis)$/i.test(mode.trim()), min_hours: num(min) };
  }).filter((a) => a.label).slice(0, 10);
}
export const serializeEventAddons = (a: EventAddon[]) => a.map((x) => `${x.label}|${x.price}|${x.free ? "free" : ""}|${x.min_hours || ""}`).join("\n");

/** Apakah bonus FREE ini sudah berlaku pada durasi sewa tersebut? */
export const freeNow = (a: EventAddon, hours: number) => a.free && hours >= a.min_hours;
/** Biaya tambahan terpilih: bonus FREE yang sudah berlaku tidak dikenai biaya; selebihnya dikenai harga normal. */
export const addonsTotal = (all: EventAddon[], selected: number[], hours: number) =>
  selected.reduce((sum, i) => (all[i] && !freeNow(all[i], hours) ? sum + all[i].price : sum), 0);
