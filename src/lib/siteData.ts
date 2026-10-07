import "server-only";
import { q } from "./db";
import { getStudio } from "./data";
import { getOnline } from "./online";
import { getSiteConfig } from "./siteServer";
import { getPromos } from "./pricingServer";
import { promoAmount, promoApplies, promoState, promoText, type Deal, type GroupDeal, type Promo } from "./pricing";
import { rupiah } from "./format";

export type SitePackage = { deal: Deal | null; group: GroupDeal | null; id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string; image_size: string; image_fit: string; image_x: number; image_y: number; per_person: boolean; bookable_online: boolean; option_label: string; options: string; room_ids: number[] };
export type SiteRoom = { id: number; name: string; color: string; description: string; image_url: string };
export type SiteAddon = { id: number; name: string; price: number };

export async function getSiteData() {
  const [studio, online, site, rawPackages, rooms, addons, promos] = await Promise.all([
    getStudio(),
    getOnline(),
    getSiteConfig(),
    q<Omit<SitePackage, "deal" | "group">>(
      `select p.id, p.name, p.category, p.description, p.includes, p.price, p.duration_min, p.max_people, p.image_url, p.image_size, p.image_fit, p.image_x, p.image_y, p.per_person, p.bookable_online, p.option_label, p.options,
        coalesce((select array_agg(pr.room_id order by pr.room_id) from package_rooms pr where pr.package_id = p.id), '{}') as room_ids
       from packages p where p.active
        order by case p.category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, p.price`),
    q<SiteRoom>("select id, name, color, description, image_url from rooms where active order by sort, id"),
    q<SiteAddon>("select id, name, price from addons where active order by sort, id"),
    getPromos(),
  ]);
  const packages = rawPackages.map((p) => ({ ...p, price: Number(p.price), ...dealsFor(p, promos) }));
  return { studio, online, site, packages, rooms, addons };
}

export { roomGradient } from "./siteUtils";

/** Promo yang tampil di kartu paket: harga coret + countdown (min 1 orang) dan info diskon rombongan (min >1 orang). */
function dealsFor(p: Omit<SitePackage, "deal" | "group">, promos: Promo[]): { deal: Deal | null; group: GroupDeal | null } {
  const pkg = { id: p.id, category: p.category, price: Number(p.price), per_person: p.per_person };
  const now = Date.now();
  const live = promos.filter((x) => x.show_on_site && promoState(x, now) === "live" && promoApplies(x, pkg));
  let deal: Deal | null = null, dealAmt = 0;
  let group: GroupDeal | null = null, groupUnit = Infinity;
  for (const x of live) {
    if (x.min_people <= 1) {
      const a = promoAmount(x, pkg, 1);
      if (a > dealAmt) {
        dealAmt = a;
        deal = { label: x.label || x.name, text: promoText(x, rupiah), salePrice: pkg.price - a, percent: Math.round((a / pkg.price) * 100), endsAt: x.ends_at, countdown: x.show_countdown && !!x.ends_at };
      }
    } else if (x.min_people <= p.max_people) {
      const total = pkg.price * (pkg.per_person ? x.min_people : 1) - promoAmount(x, pkg, x.min_people);
      const unit = Math.round(total / (pkg.per_person ? x.min_people : 1));
      if (unit < groupUnit) { groupUnit = unit; group = { text: promoText(x, rupiah), minPeople: x.min_people, unitPrice: unit }; }
    }
  }
  return { deal, group };
}
