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

/** Tampilan foto kartu paket (diatur dari admin, dipakai kartu admin, pratinjau, dan landing page). */
export type PackageImage = { image_url: string; image_size?: string; image_fit?: string; image_x?: number; image_y?: number };
export const IMAGE_SIZES = { sm: { label: "Kecil", h: 132 }, md: { label: "Sedang", h: 184 }, lg: { label: "Besar", h: 248 } } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;
export const imageSizeKey = (s?: string): ImageSize => (s === "sm" || s === "lg" ? s : "md");
export const imageStyle = (p: PackageImage) => ({
  objectFit: (p.image_fit === "contain" ? "contain" : "cover") as "contain" | "cover",
  objectPosition: `${p.image_x ?? 50}% ${p.image_y ?? 50}%`,
});
