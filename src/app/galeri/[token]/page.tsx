import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadGallery } from "@/lib/gallery";
import GalleryClient from "./GalleryClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Galeri", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer",
};

export default async function GalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await loadGallery(token);
  if (!g) notFound();
  return <GalleryClient token={token} g={g} />;
}
