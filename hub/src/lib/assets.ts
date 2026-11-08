import "server-only";
import { q } from "./db";
import { today } from "./format";

export type Asset = {
  id: number; company_id: number; name: string; category: string; qty: number; acquired_on: string | null; cost: number; life_years: number;
  status: string; est_value: number | null; location: string; holder: string; serial: string; note: string; tx_id: number | null;
  status_on: string | null; sale_price: number | null;
};
export const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  aktif: { label: "Berfungsi", tone: "ok" }, perbaikan: { label: "Diperbaiki", tone: "warn" },
  rusak: { label: "Rusak / tidak berfungsi", tone: "bad" }, dijual: { label: "Dijual", tone: "info" }, hilang: { label: "Hilang", tone: "bad" },
};
export const CATEGORIES = [["kamera", "Kamera & lensa"], ["lighting", "Lighting & studio"], ["drone", "Drone"], ["komputer", "Komputer & gadget"], ["audio", "Audio / mic"], ["tripod", "Tripod & support"],
  ["furnitur", "Furnitur & dekorasi"], ["mesin", "Mesin (kopi, printer, dll)"], ["kendaraan", "Kendaraan"], ["bangunan", "Renovasi / bangunan"], ["alat", "Alat lainnya"]] as const;

export const loadAssets = () => q<Asset>(`select id, company_id, name, category, qty, to_char(acquired_on,'YYYY-MM-DD') as acquired_on, cost::bigint as cost, life_years, status,
  est_value::bigint as est_value, location, holder, serial, note, tx_id, to_char(status_on,'YYYY-MM-DD') as status_on, sale_price::bigint as sale_price
  from assets order by company_id, (status in ('dijual','hilang')), name`);

const RESIDUAL = 0.1; // nilai sisa minimum 10% dari harga beli selama masih berfungsi
/** Nilai sekarang: taksiran manual bila diisi; selain itu penyusutan garis lurus sampai sisa 10%. Rusak/dijual/hilang = 0 kecuali ada taksiran (mis. nilai barang bekas). */
export function currentValue(a: Asset, on = today()): number {
  if (a.status === "dijual" || a.status === "hilang") return 0;
  if (a.est_value != null) return Number(a.est_value);
  if (a.status === "rusak") return 0;
  const cost = Number(a.cost);
  if (!a.acquired_on) return Math.round(cost * 0.5);
  const months = Math.max(0, (Date.parse(on) - Date.parse(a.acquired_on)) / (30.4375 * 86_400_000));
  const left = Math.max(RESIDUAL, 1 - months / (a.life_years * 12));
  return Math.round(cost * left);
}

/** Ringkasan per unit untuk valuasi: nilai aset berfungsi, jumlah item. */
export async function loadInventory() {
  const rows = await loadAssets();
  const out = new Map<number, { value: number; cost: number; items: number }>();
  for (const a of rows) {
    const e = out.get(a.company_id) ?? { value: 0, cost: 0, items: 0 };
    e.items += 1; e.cost += Number(a.cost); e.value += currentValue(a);
    out.set(a.company_id, e);
  }
  return out;
}
export type Inventory = Awaited<ReturnType<typeof loadInventory>>;
