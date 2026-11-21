import type { NextConfig } from "next";

// Media (Neon Object Storage, bucket publik "website") dilayani lewat /media/*:
// di-proxy oleh Vercel dan di-cache CDN-nya (cache 1 tahun, nama file unik), sehingga bandwidth keluar dari storage kecil.
const storage = process.env.AWS_ENDPOINT_URL_S3?.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  async rewrites() {
    return storage ? [{ source: "/media/:path*", destination: `${storage}/website/:path*` }] : [];
  },
  async headers() {
    return [{
      source: "/media/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, s-maxage=31536000, immutable" },
        { key: "Access-Control-Allow-Origin", value: "*" },
      ],
    }];
  },
};

export default nextConfig;
