import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
  async headers() {
    const secure = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" }, // tautan investor berisi token: jangan bocor lewat Referer
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      { source: "/:path*", headers: secure },
      // Halaman & data keuangan tidak boleh tersimpan di cache browser/proxy (mis. tombol Back setelah keluar/kunci).
      { source: "/((?!_next/static|_next/image|pwa|icon\\.svg|logo-.*|offline\\.html|sw\\.js|manifest\\.webmanifest).*)", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;
