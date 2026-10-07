import type { Metadata } from "next";
import Legal, { LEGAL_UPDATED } from "@/components/site/Legal";
import { getSiteData } from "@/lib/siteData";
import { waLink } from "@/lib/format";

export const metadata: Metadata = { title: "Syarat & Ketentuan Layanan", robots: { index: true, follow: true } };

export default async function TermsPage() {
  const { studio, online, site } = await getSiteData();
  const n = studio.name;
  const hours = Math.round((online.hold_min / 60) * 10) / 10;
  const email = site.footer.email;

  return (
    <Legal
      title="Syarat & Ketentuan Layanan"
      updated={LEGAL_UPDATED}
      other={{ href: "/privasi", label: "Kebijakan Privasi" }}
      intro={`Dengan memesan atau memakai layanan ${n}, Anda menyetujui syarat dan ketentuan berikut. Mohon dibaca sebelum melakukan booking.`}
      sections={[
        { title: "Layanan kami", body: <p>{n} menyediakan sesi foto self photo, photobox, dan photobooth untuk acara. Daftar layanan, durasi, jumlah orang maksimal, dan harga tertera di halaman Layanan dan dapat berubah sewaktu-waktu.</p> },
        {
          title: "Booking & jadwal", body: (
            <ul>
              <li>Semua sesi foto <b>wajib reservasi slot</b> terlebih dahulu, kecuali Photobooth Outdoor yang bisa langsung datang (walk-in) tanpa antre booking.</li>
              <li>Mohon <b>hadir 10 menit sebelum</b> sesi foto dimulai.</li>
              <li>Booking online berstatus <b>menunggu</b> sampai dikonfirmasi oleh tim kami.</li>
              <li>Satu background (ruang) tidak dapat dipesan oleh dua sesi pada waktu yang sama. Jam yang tampil di website adalah jam yang masih kosong saat itu.</li>
              <li>Durasi sesi mengikuti paket yang Anda pilih. Perpanjangan waktu dapat dilakukan bila jadwal berikutnya di ruang yang sama masih kosong, dengan biaya sesuai tarif tambahan.</li>
              <li>Mohon datang tepat waktu agar sesi Anda dan sesi berikutnya berjalan lancar.</li>
            </ul>
          ),
        },
        {
          title: "Pembayaran & DP", body: (
            <ul>
              <li>Harga dinyatakan dalam rupiah dan berlaku <b>per orang</b>, kecuali paket yang tertulis per sesi atau per paket.</li>
              <li>Kami menerima pembayaran melalui transfer bank, QRIS, dan tunai (cash).</li>
              {online.dp_percent > 0
                ? <li>Untuk mengunci jadwal, diperlukan <b>DP sebesar {online.dp_percent}%</b> dari total. {online.hold_min > 0 && <>Jadwal ditahan selama sekitar {hours} jam; jika DP belum diterima, jadwal dapat dilepas otomatis.</>}</li>
                : <li>Booking online saat ini tidak mewajibkan DP; tim kami akan mengonfirmasi melalui WhatsApp.</li>}
              <li>Simpan bukti pembayaran dan sebutkan kode booking saat melakukan konfirmasi.</li>
            </ul>
          ),
        },
        {
          title: "Perubahan & pembatalan", body: (
            <>
              <p>Untuk mengubah jadwal atau membatalkan booking, hubungi kami lewat WhatsApp dengan menyebutkan kode booking Anda, sedini mungkin sebelum jadwal.</p>
              <p>Perlakuan terhadap DP pada pembatalan atau ketidakhadiran ditetapkan oleh studio dan disampaikan oleh admin saat Anda melakukan booking atau pembatalan.</p>
            </>
          ),
        },
        {
          title: "Hasil foto & hak penggunaan", body: (
            <ul>
              <li>Hasil foto dan video diserahkan berupa tautan unduhan. Anda bebas memakainya untuk keperluan pribadi.</li>
              <li>Tautan dapat dibuka oleh siapa saja yang memilikinya; mohon dijaga sesuai kebutuhan privasi Anda.</li>
              <li>Kami tidak mempublikasikan foto Anda di website, media sosial, atau promosi tanpa izin Anda.</li>
              <li>Simpan hasil foto Anda sendiri; kami tidak menjamin tautan tersedia selamanya, dan masa berlaku tautan dapat tertera pada pesan pengiriman.</li>
            </ul>
          ),
        },
        {
          title: "Tata tertib di studio", body: (
            <ul>
              <li>Jagalah kebersihan serta properti, background, dan perlengkapan studio.</li>
              <li>Kerusakan yang disebabkan kelalaian pengguna dapat dikenai penggantian biaya yang wajar.</li>
              <li>Ikuti arahan tim kami demi keselamatan dan kenyamanan bersama.</li>
            </ul>
          ),
        },
        {
          title: "Batasan tanggung jawab", body: <p>Kami berupaya menyelenggarakan sesi sesuai jadwal. Namun kami tidak bertanggung jawab atas keterlambatan atau pembatalan akibat keadaan di luar kendali (mis. gangguan listrik, jaringan, atau cuaca ekstrem). Dalam hal ini kami akan membantu menjadwalkan ulang sesi Anda. Barang pribadi yang dibawa ke studio menjadi tanggung jawab pemiliknya.</p> },
        { title: "Data pribadi", body: <p>Cara kami mengelola data Anda dijelaskan pada <a href="/privasi">Kebijakan Privasi</a>.</p> },
        { title: "Perubahan syarat & hukum yang berlaku", body: <p>Syarat ini dapat diperbarui sewaktu-waktu; versi terbaru selalu tersedia di halaman ini. Syarat ini tunduk pada hukum yang berlaku di Republik Indonesia.</p> },
        {
          title: "Kontak", body: (
            <ul>
              {online.whatsapp && <li>WhatsApp: <a href={waLink(online.whatsapp, "Halo, saya ingin bertanya.")}>{online.whatsapp}</a></li>}
              {email && <li>Email: <a href={`mailto:${email}`}>{email}</a></li>}
              {(site.lokasi.address || studio.address) && <li>Alamat: {site.lokasi.address || studio.address}</li>}
              {!online.whatsapp && !email && <li>Hubungi kami langsung di studio.</li>}
            </ul>
          ),
        },
      ]}
    />
  );
}
