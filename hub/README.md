# Frameless Hub

Pusat keuangan & keputusan untuk seluruh perusahaan Frameless: Frameless Creative, STUDIODO Self Photo Studio,
STUDIODO Photobooth APP, SNAPCUP Coffee — dan usaha berikutnya.

## Fitur (tahap 1)
- **Ringkasan grup realtime**: kas, pendapatan, laba, aset, tren 6 bulan, kartu per unit (auto-refresh 20 detik).
- **Satu buku besar** semua unit (`transactions`): pendapatan, biaya, beli aset, setoran modal, penarikan.
- **Modal & kepemilikan**: setoran tunai + alat/biaya yang dibayar pribadi otomatis dihitung sebagai modal partner.
- **Bagi hasil**: kolam modal + kolam kerja (bobot kerja per partner) + cadangan, bisa diatur per unit.
- **Alokasi anggaran**: Operasional / Gaji / Pengembangan / Cadangan / Bagi Hasil, rencana vs realisasi.
- **Target & planning**, **Rekomendasi** (mesin aturan + analisis Claude opsional), **Materi pitching**, **Ide & dokumentasi**.
- **Gaji & Tim**: daftar karyawan per unit, "Catat gaji bulan ini" (idempoten) jadi biaya otomatis.
- **Proyeksi arus kas**: 3 bulan ke depan, 3 skenario (konservatif / dasar / optimis), per unit atau grup, dengan peringatan bila kas habis.
- **Link investor baca-saja** (`/investor/<token>`): traksi tanpa saldo kas & modal internal; bisa dicabut kapan saja.
- **API Core per perusahaan**: `POST /api/core/v1/ingest` dengan API key per unit (lihat Pengaturan).
- PWA: bisa di-install di HP (Add to Home Screen).

## Jalankan lokal
```bash
cd hub
npm install
npm run dev      # http://localhost:3200
```
Tanpa `DATABASE_URL`, Hub memakai database lokal (PGlite) di `hub/.data`. Buka aplikasi → **Setup** (nama + PIN 6 digit).
Pengaturan → **Muat data contoh** untuk mencoba grafik; bisa dihapus kapan saja.

## Pasang dengan Neon + Vercel
1. Neon Console → buat project → **Connect** → salin **Pooled connection** (host `-pooler`, `?sslmode=require`).
2. Vercel → Import repo ini, **Root Directory = `hub`**. Environment Variables:
   - `DATABASE_URL` = connection string Neon
   - `SESSION_SECRET` = string acak panjang
   - `ANTHROPIC_API_KEY` (opsional, analisis AI)
   - `APP_URL` (opsional, untuk contoh URL di Pengaturan)
3. Deploy. Tabel dibuat otomatis saat pertama diakses.

## Menyambungkan kasir
Hub → Pengaturan → Sambungan API Core → **Buat API key** (tampil sekali) untuk unit terkait.
- **Kasir STUDIODO** (repo ini, root): isi `HUB_URL`, `HUB_API_KEY` (dan `CRON_SECRET` untuk cron malam). Sinkron manual: `/api/hub/sync` saat login Owner.
- **SNAPCUP / lainnya**: kirim ringkasan harian ke endpoint yang sama (contoh payload ada di Pengaturan Hub).
  Sertakan `window` agar data yang di-void di kasir ikut hilang dari Hub.
