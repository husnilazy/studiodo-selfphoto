# STUDIODO Kasir

Aplikasi kasir & manajemen untuk STUDIODO (self photo studio, photobox, photobooth).
Next.js 16 + PostgreSQL (Supabase) — responsif untuk HP, bisa di-install sebagai PWA.

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
- Upload gambar/video langsung dari CMS (opsional): isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Bucket `website` dibuat otomatis.
  Tanpa itu, tempel link media (Google Drive, YouTube, dll.).
- **Sesi Live**: papan monitoring per ruang (hitung mundur, +10/+15 menit, Mulai/Selesai, tidak hadir, antrean, perlu tindakan, mode layar penuh).

## Jalankan lokal
```bash
npm install
npm run dev        # http://localhost:3000
```
Tanpa `DATABASE_URL`, aplikasi memakai database lokal (PGlite) di folder `.data` — hapus folder itu untuk mengulang dari nol.
Buka aplikasi → layar **Setup Awal** akan meminta nama & PIN Owner.

## Pasang di Supabase + Vercel
1. Supabase → New project → **Project Settings → Database → Connection string → Transaction pooler** (port 6543). Salin URI-nya.
2. Vercel → Import project → Environment Variables:
   - `DATABASE_URL` = URI Supabase di atas (isi password database)
   - `SESSION_SECRET` = string acak panjang (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
3. Deploy. Tabel dibuat otomatis saat pertama kali diakses. (Opsional: `npm run db:migrate` dengan `.env.local` terisi.)
4. Buka URL → buat akun Owner → tambah Admin/Kasir di **Pengaturan**.

Semua tabel memakai Row Level Security tanpa policy, jadi API publik Supabase (anon key) tidak bisa membaca data; hanya server aplikasi.

## Mulai memakai (urutan disarankan)
1. Pengaturan: nama studio, jam buka/tutup, interval slot.
2. Paket & Ruang: ruang/background, paket, add-on.
3. Keuangan → *Modal / Prive / Transfer* → "Setoran modal / saldo awal" untuk uang tunai & saldo bank yang sudah ada.
4. Keuangan → Aset Tetap: daftarkan kamera/lighting/set (sumber: *Aset awal (Modal pemilik)*). Tiap akhir bulan tekan **Susutkan Bulan**.
