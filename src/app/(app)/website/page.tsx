import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getOnline } from "@/lib/online";
import { getSiteConfig, storageReady } from "@/lib/siteServer";
import { getStudio } from "@/lib/data";
import SiteEditor from "./SiteEditor";

export const metadata = { title: "Website (CMS)" };

export default async function WebsitePage() {
  await requireUser(["owner", "admin"]);
  const [cfg, online, studio, packages] = await Promise.all([
    getSiteConfig(), getOnline(), getStudio(),
    q<{ id: number; name: string }>("select id, name from packages where active order by case category when 'self_photo' then 0 when 'photobox' then 1 when 'photobooth' then 2 else 3 end, price"),
  ]);
  // Kontak sumbernya pengaturan booking online; tampilkan di editor agar bisa diubah dari sini.
  cfg.lokasi.whatsapp ||= online.whatsapp;
  cfg.lokasi.instagram ||= online.instagram;
  cfg.lokasi.maps_url ||= online.maps_url;
  cfg.lokasi.address ||= studio.address;
  return <SiteEditor initial={cfg} storage={storageReady()} packages={packages} />;
}
