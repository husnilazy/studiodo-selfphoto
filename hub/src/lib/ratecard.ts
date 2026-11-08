/** Kartu tarif crew: bobot tiap peran dalam kolam honor, plus potongan standar proyek. Murni (tanpa DB) supaya dipakai juga di komponen klien. */
export type RoleDef = { key: string; label: string; weight: number; on: boolean };
export type RateCard = { margin: number; tools: number; direct: number; reserve: number; roles: RoleDef[] };

export const DEFAULT_RATE_CARD: RateCard = {
  margin: 20,   // % dari budget untuk laba Frameless (kemudian masuk skema bagi hasil)
  tools: 5,     // % dari budget untuk pemakaian & penyusutan alat
  direct: 15,   // % perkiraan biaya langsung (transport, konsumsi, sewa, musik) bila belum diisi rupiahnya
  reserve: 0,
  roles: [
    { key: "produser", label: "Produser / PM & klien", weight: 15, on: true },
    { key: "director", label: "Director / DOP", weight: 20, on: true },
    { key: "kamera", label: "Kameramen / crew lapangan", weight: 20, on: true },
    { key: "editor", label: "Editor / post-production", weight: 25, on: true },
    { key: "gaffer", label: "Gaffer / lighting", weight: 6, on: false },
    { key: "artistik", label: "Artistik / wardrobe / props", weight: 6, on: false },
    { key: "asisten", label: "Asisten / runner", weight: 8, on: false },
  ],
};

export type Alloc = { pool: number; direct: number; tools: number; margin: number; roles: { key: string; label: string; share: number; amount: number }[] };

/** Budget → potongan → kolam honor → honor per peran (bobot dinormalisasi antar peran yang aktif). */
export function allocate(budget: number, card: RateCard, direct: number | null, active: Record<string, { on: boolean; weight: number }>): Alloc {
  const d = direct ?? Math.round((budget * card.direct) / 100);
  const tools = Math.round((budget * card.tools) / 100), margin = Math.round((budget * card.margin) / 100);
  const pool = budget - d - tools - margin;
  const act = card.roles.filter((r) => active[r.key]?.on);
  const tot = act.reduce((t, r) => t + (active[r.key].weight || 0), 0);
  return {
    pool, direct: d, tools, margin,
    roles: act.map((r) => {
      const share = tot > 0 ? (active[r.key].weight || 0) / tot : 0;
      return { key: r.key, label: r.label, share: share * 100, amount: Math.max(0, Math.round(pool * share)) };
    }),
  };
}
