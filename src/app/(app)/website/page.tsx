import { requireUser } from "@/lib/auth";
import { getOnline } from "@/lib/online";
import { getSiteConfig, storageReady } from "@/lib/siteServer";
import { getStudio } from "@/lib/data";
import SiteEditor from "./SiteEditor";

export const metadata = { title: "Website (CMS)" };

export default async function WebsitePage() {
  await requireUser(["owner", "admin"]);
  const [cfg, online, studio] = await Promise.all([getSiteConfig(), getOnline(), getStudio()]);
  // Kontak sumbernya pengaturan booking online; tampilkan di editor agar bisa diubah dari sini.
  cfg.lokasi.whatsapp ||= online.whatsapp;
  cfg.lokasi.instagram ||= online.instagram;
  cfg.lokasi.maps_url ||= online.maps_url;
  cfg.lokasi.address ||= studio.address;
  return <SiteEditor initial={cfg} storage={storageReady()} />;
}
