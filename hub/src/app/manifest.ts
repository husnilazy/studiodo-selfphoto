import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Frameless Hub",
    short_name: "Hub",
    description: "Pusat keuangan & keputusan grup Frameless.",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050608",
    theme_color: "#050608",
    categories: ["finance", "business", "productivity"],
    icons: [
      { src: "/pwa/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ringkasan", url: "/", icons: [{ src: "/pwa/192", sizes: "192x192" }] },
      { name: "Catat transaksi", url: "/transaksi", icons: [{ src: "/pwa/192", sizes: "192x192" }] },
      { name: "Kondisi perusahaan", url: "/kondisi", icons: [{ src: "/pwa/192", sizes: "192x192" }] },
    ],
  };
}
