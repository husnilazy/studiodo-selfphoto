import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "STUDIODO Kasir",
    short_name: "STUDIODO",
    description: "Kasir, booking, customer, dan keuangan STUDIODO.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6fb",
    theme_color: "#4f4fe8",
    icons: [
      { src: "/pwa/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
