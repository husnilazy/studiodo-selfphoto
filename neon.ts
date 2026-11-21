import { defineConfig } from "@neon/config/v1";

// Bucket "website" menyimpan semua media (logo, foto layanan, frame, hasil ekspor).
// public_read: dibaca anonim lewat /media/* (di-proxy + di-cache CDN Vercel), ditulis hanya dengan kredensial.
export default defineConfig({
  buckets: {
    website: { access: "public_read" },
  },
});
