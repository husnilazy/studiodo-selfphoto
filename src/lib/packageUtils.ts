// Aturan paket yang dipakai bersama oleh server & client (tanpa akses database).

export type PackageRule = {
  price: number; per_person: boolean; max_people: number;
  option_label: string; options: string; room_ids: number[];
};

/** Pilihan varian disimpan satu per baris di database. */
export const parseOptions = (s: string) => s.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 12);

/** Jumlah unit yang ditagih: per orang = jumlah orang, selain itu 1 paket. */
export const unitsFor = (p: Pick<PackageRule, "per_person">, people: number) => (p.per_person ? Math.max(1, people) : 1);

export const packageTotal = (p: Pick<PackageRule, "price" | "per_person">, people: number) => p.price * unitsFor(p, people);

export const priceSuffix = (p: Pick<PackageRule, "per_person">) => (p.per_person ? "/ orang" : "/ sesi");

/** Apakah ruang boleh dipakai paket ini? (tidak ada pembatasan = semua ruang boleh) */
export const roomAllowed = (p: Pick<PackageRule, "room_ids">, roomId: number | null) =>
  p.room_ids.length === 0 || (roomId !== null && p.room_ids.includes(roomId));
