import "server-only";
import { q } from "./db";
import { getStudio } from "./data";
import { getOnline } from "./online";
import { getSiteConfig } from "./siteServer";

export type SitePackage = { id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string; image_size: string; image_fit: string; image_x: number; image_y: number; per_person: boolean; bookable_online: boolean; option_label: string; options: string; room_ids: number[] };
export type SiteRoom = { id: number; name: string; color: string; description: string; image_url: string };
export type SiteAddon = { id: number; name: string; price: number };

export async function getSiteData() {
  const [studio, online, site, packages, rooms, addons] = await Promise.all([
    getStudio(),
    getOnline(),
    getSiteConfig(),
    q<SitePackage>(
      `select p.id, p.name, p.category, p.description, p.includes, p.price, p.duration_min, p.max_people, p.image_url, p.image_size, p.image_fit, p.image_x, p.image_y, p.per_person, p.bookable_online, p.option_label, p.options,
        coalesce((select array_agg(pr.room_id order by pr.room_id) from package_rooms pr where pr.package_id = p.id), '{}') as room_ids
       from packages p where p.active
        order by case p.category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, p.price`),
    q<SiteRoom>("select id, name, color, description, image_url from rooms where active order by sort, id"),
    q<SiteAddon>("select id, name, price from addons where active order by sort, id"),
  ]);
  return { studio, online, site, packages, rooms, addons };
}

export { roomGradient } from "./siteUtils";
