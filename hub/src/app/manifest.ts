import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frameless Hub",
    short_name: "Hub",
    description: "Pusat keuangan & keputusan grup Frameless.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    icons: [
      { src: "/pwa/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
