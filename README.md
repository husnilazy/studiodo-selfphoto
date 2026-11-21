# STUDIODO Kasir

Aplikasi kasir & manajemen untuk STUDIODO (self photo studio, photobox, photobooth).
Next.js 16 + PostgreSQL & Object Storage (Neon) — responsif untuk HP, bisa di-install sebagai PWA.

## Fitur
- **Login PIN 6 digit** per pengguna (Owner / Admin / Kasir), kunci otomatis 5 menit setelah 5x salah.
- **Booking & jadwal** per ruang/background (anti-bentrok), walk-in cepat, DP & pelunasan, refund, struk cetak, tombol WhatsApp.
- **Paket, Ruang & Add-on** (cetak, tambah menit, frame, dll.).
- **Customer** dengan riwayat, total belanja, catatan.
- **File Customer**: link hasil foto/video + status Diproses → Siap → Terkirim, kirim via WhatsApp.
- **Keuangan** (akuntansi double-entry, jurnal otomatis dari setiap pembayaran/pengeluaran):
  Laba Rugi (bandingkan periode sebelumnya), Neraca, Arus Kas (metode langsung), Neraca Saldo, Buku Besar,
  Penjualan, Jurnal Umum + jurnal manual, Aset Tetap + penyusutan, Bagan Akun, Pengeluaran, Modal/Prive/Transfer.
  Semua laporan bisa diekspor CSV atau dicetak/PDF.

Pendapatan diakui saat uang diterima (basis kas).

## Website publik & CMS
- `/` landing page, `/book` booking online (live availability, DP, konfirmasi WhatsApp). Admin pindah ke `/dashboard`.
- **Website (CMS)** di menu admin: logo & favicon, warna brand, bar pengumuman, hero (strip foto / video / foto, bingkai atau latar penuh),
  statistik animasi, teks berjalan, reels & video (MP4, YouTube, Drive, Instagram/TikTok), galeri + lightbox, testimoni,
  urutan & judul tiap section, lokasi + Google Maps embed, FAQ, footer & SEO. Ada pratinjau HP/desktop.
- Upload gambar/video langsung dari CMS (opsional): butuh bucket Neon Object Storage (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`; dibuat oleh `neon deploy` dari `neon.ts`). File dilayani lewat `/media/*` (di-proxy dan di-cache CDN Vercel).
  Tanpa itu, tempel link media (Google Drive, YouTube, dll.).
- **Sesi Live**: papan monitoring per ruang (hitung mundur, +10/+15 menit, Mulai/Selesai, tidak hadir, antrean, perlu tindakan, mode layar penuh).

## Jalankan lokal
```bash
npm install
npm run dev        # http://localhost:3000
```
Tanpa `DATABASE_URL`, aplikasi memakai database lokal (PGlite) di folder `.data` — hapus folder itu untuk mengulang dari nol.
Buka aplikasi → layar **Setup Awal** akan meminta nama & PIN Owner.

## Pasang di Neon + Vercel
1. Buat project Neon di region **Singapore** (`aws-ap-southeast-1`), lalu dari folder ini: `neon link`, `neon deploy` (membuat bucket `website` dari `neon.ts`) dan `neon env pull` (mengisi `.env.local`).
2. Izinkan upload langsung dari browser: `node --env-file=.env.local scripts/neon-bucket-cors.mjs https://kasir.studiodo.id https://selfphoto.studiodo.id`
3. Vercel → Environment Variables:
   - `DATABASE_URL` = connection string **pooled** Neon
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` = dari `.env.local`
   - `MEDIA_BASE_URL` = asal publik situs, mis. `https://selfphoto.studiodo.id` (URL media jadi `<asal>/media/<file>`)
   - `SESSION_SECRET` = string acak panjang (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
4. Deploy. Tabel dibuat otomatis saat pertama kali diakses. (Opsional: `npm run db:migrate`.)
5. Buka URL → buat akun Owner → tambah Admin/Kasir di **Pengaturan**.

### Pindah dari Supabase
`scripts/migrate-from-supabase.mjs` menyalin semua tabel, file media, dan menulis ulang URL media di database. Isi `SOURCE_DATABASE_URL` (connection string Postgres Supabase) dan `MEDIA_BASE_URL`, lalu jalankan `node --env-file=.env.local scripts/migrate-from-supabase.mjs --dry` (cek) dan tanpa `--dry` (sungguhan). Supabase harus aktif (tidak terkena 402) selama file media disalin.

## Mulai memakai (urutan disarankan)
1. Pengaturan: nama studio, jam buka/tutup, interval slot.
2. Paket & Ruang: ruang/background, paket, add-on.
3. Keuangan → *Modal / Prive / Transfer* → "Setoran modal / saldo awal" untuk uang tunai & saldo bank yang sudah ada.
4. Keuangan → Aset Tetap: daftarkan kamera/lighting/set (sumber: *Aset awal (Modal pemilik)*). Tiap akhir bulan tekan **Susutkan Bulan**.
