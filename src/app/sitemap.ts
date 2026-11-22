import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteBase();
  if (!base) return [];
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/hasil-foto`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/privasi`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/syarat`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
