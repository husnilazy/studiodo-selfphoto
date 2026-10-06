import type { Metadata } from "next";
import Legal, { LEGAL_UPDATED } from "@/components/site/Legal";
import { getSiteData } from "@/lib/siteData";
import { waLink } from "@/lib/format";

export const metadata: Metadata = { title: "Kebijakan Privasi", robots: { index: true, follow: true } };

export default async function PrivacyPage() {
  const { studio, online, site } = await getSiteData();
  const n = studio.name;
  const email = site.footer.email;
  const contact = (
    <ul>
      {online.whatsapp && <li>WhatsApp: <a href={waLink(online.whatsapp, "Halo, saya ingin bertanya tentang data pribadi saya.")}>{online.whatsapp}</a></li>}
      {email && <li>Email: <a href={`mailto:${email}`}>{email}</a></li>}
      {(site.lokasi.address || studio.address) && <li>Alamat: {site.lokasi.address || studio.address}</li>}
      {!online.whatsapp && !email && <li>Hubungi kami langsung di studio.</li>}
    </ul>
  );

  return (
    <Legal
      title="Kebijakan Privasi"
      updated={LEGAL_UPDATED}
      other={{ href: "/syarat", label: "Syarat & Ketentuan Layanan" }}
      intro={`${n} menghargai privasi Anda. Halaman ini menjelaskan data apa yang kami kumpulkan saat Anda memesan sesi foto, untuk apa data itu dipakai, dan hak Anda atas data tersebut.`}
      sections={[
        { title: "Siapa kami", body: <><p>{n} adalah studio foto yang menyediakan layanan self photo, photobox, dan photobooth, termasuk pemesanan jadwal secara online melalui situs ini.</p><p>Kontak kami untuk urusan data pribadi:</p>{contact}</> },
        {
          title: "Data yang kami kumpulkan", body: (
            <>
              <p>Kami hanya mengumpulkan data yang diperlukan untuk melayani Anda:</p>
              <ul>
                <li><b>Data identitas kontak:</b> nama dan nomor WhatsApp (serta Instagram atau email jika Anda memberikannya).</li>
                <li><b>Data pemesanan:</b> layanan, background, tanggal, jam, jumlah orang, tambahan, dan catatan yang Anda tulis.</li>
                <li><b>Data pembayaran:</b> nominal, metode (tunai, QRIS, transfer), dan waktu pembayaran. Kami <b>tidak</b> menyimpan nomor kartu atau PIN rekening Anda.</li>
                <li><b>Hasil sesi:</b> foto dan video yang dihasilkan selama sesi Anda.</li>
              </ul>
            </>
          ),
        },
        {
          title: "Untuk apa data dipakai", body: (
            <ul>
              <li>Memproses dan mengonfirmasi booking, termasuk menghubungi Anda lewat WhatsApp.</li>
              <li>Mencatat pembayaran dan menyusun pembukuan studio.</li>
              <li>Mengirimkan hasil foto dan video kepada Anda.</li>
              <li>Memberikan layanan pelanggan dan menangani perubahan jadwal.</li>
            </ul>
          ),
        },
        {
          title: "Hasil foto & penyimpanan di Google Drive", body: (
            <>
              <p>Hasil foto dan video disimpan di Google Drive milik studio, dalam folder atas nama Anda, lalu dikirimkan kepada Anda berupa tautan.</p>
              <p>Tautan tersebut dapat dibuka oleh <b>siapa saja yang memegang tautannya</b>. Karena itu, mohon tidak membagikan tautan kepada pihak yang tidak Anda kehendaki. Jika Anda ingin tautan dinonaktifkan atau file dihapus, hubungi kami.</p>
              <p>Kami tidak menampilkan foto Anda di website, media sosial, atau materi promosi tanpa izin Anda.</p>
            </>
          ),
        },
        {
          title: "Pihak ketiga yang membantu layanan kami", body: (
            <>
              <p>Untuk menjalankan layanan, kami memakai penyedia berikut. Mereka hanya memproses data sebatas yang diperlukan untuk fungsi tersebut:</p>
              <ul>
                <li><b>Vercel</b> — hosting situs dan aplikasi.</li>
                <li><b>Supabase</b> — basis data pemesanan dan pembukuan.</li>
                <li><b>Google Drive</b> — penyimpanan hasil foto dan video.</li>
                <li><b>WhatsApp</b> — komunikasi dengan pelanggan.</li>
              </ul>
              <p>Kami tidak menjual data pribadi Anda dan tidak membagikannya untuk keperluan iklan pihak lain.</p>
            </>
          ),
        },
        {
          title: "Penggunaan Google API", body: (
            <>
              <p>Aplikasi internal kami terhubung ke Google Drive milik studio melalui Google Drive API dengan izin <code>drive.file</code>. Izin ini hanya digunakan oleh staf studio untuk membuat folder dan mengunggah hasil sesi, dan aplikasi hanya dapat mengakses file yang dibuatnya sendiri — bukan seluruh isi Drive.</p>
              <p>Penggunaan dan pengalihan informasi yang diterima dari Google API oleh aplikasi ini mematuhi <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, termasuk persyaratan Limited Use. Data dari akun Google tidak dijual, tidak dipakai untuk iklan, dan tidak dibagikan kepada pihak ketiga.</p>
            </>
          ),
        },
        {
          title: "Cookie & penyimpanan di perangkat", body: (
            <>
              <p>Situs publik kami tidak memakai cookie pelacak atau iklan. Kami hanya memakai:</p>
              <ul>
                <li>cookie sesi untuk login staf (tidak dipasang untuk pengunjung biasa), dan</li>
                <li>penyimpanan lokal peramban untuk menyimpan pilihan tampilan terang/gelap.</li>
              </ul>
            </>
          ),
        },
        {
          title: "Keamanan & lama penyimpanan", body: (
            <>
              <p>Akses ke data pemesanan dibatasi untuk staf yang berwenang dan dilindungi login PIN. Komunikasi antara perangkat Anda dan situs ini dienkripsi (HTTPS).</p>
              <p>Kami menyimpan data selama diperlukan untuk melayani Anda dan memenuhi kebutuhan pembukuan. Tidak ada sistem yang sepenuhnya bebas risiko; bila terjadi insiden yang memengaruhi data Anda, kami akan menginformasikannya.</p>
            </>
          ),
        },
        {
          title: "Hak Anda", body: (
            <>
              <p>Anda dapat meminta kami untuk:</p>
              <ul>
                <li>menunjukkan data pribadi Anda yang kami simpan,</li>
                <li>memperbaiki data yang keliru,</li>
                <li>menghapus data atau hasil foto Anda (catatan pembayaran dapat tetap disimpan sepanjang diperlukan untuk pembukuan), dan</li>
                <li>menarik izin penggunaan foto Anda untuk keperluan promosi.</li>
              </ul>
              <p>Ajukan permintaan melalui kontak di bagian 1.</p>
            </>
          ),
        },
        { title: "Perubahan kebijakan", body: <p>Kami dapat memperbarui kebijakan ini sewaktu-waktu. Tanggal pembaruan terakhir selalu tertera di bagian atas halaman.</p> },
      ]}
    />
  );
}
