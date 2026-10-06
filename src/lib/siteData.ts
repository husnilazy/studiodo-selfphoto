import "server-only";
import { q } from "./db";
import { getStudio } from "./data";
import { getOnline } from "./online";
import { getSiteConfig } from "./siteServer";

export type SitePackage = { id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string };
export type SiteRoom = { id: number; name: string; color: string; description: string; image_url: string };
export type SiteAddon = { id: number; name: string; price: number };

export async function getSiteData() {
  const [studio, online, site, packages, rooms, addons] = await Promise.all([
    getStudio(),
    getOnline(),
    getSiteConfig(),
    q<SitePackage>(
      `select id, name, category, description, includes, price, duration_min, max_people, image_url from packages where active
        order by case category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, price`),
    q<SiteRoom>("select id, name, color, description, image_url from rooms where active order by sort, id"),
    q<SiteAddon>("select id, name, price from addons where active order by sort, id"),
  ]);
  return { studio, online, site, packages, rooms, addons };
}

export { roomGradient } from "./siteUtils";
