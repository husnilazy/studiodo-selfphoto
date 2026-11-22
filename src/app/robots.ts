import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await siteBase();
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      // Halaman pelanggan pribadi dan aplikasi kasir tidak perlu masuk mesin pencari.
      disallow: ["/api/", "/galeri", "/anggota", "/book/selesai", "/book/status", "/login", "/setup", "/live"],
    }],
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  };
}
