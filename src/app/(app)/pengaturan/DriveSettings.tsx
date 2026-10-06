import ActionForm from "@/components/ActionForm";
import { getConfig, oauthReady, redirectUri } from "@/lib/gdrive";
import { disconnectDrive } from "@/app/actions/drive";

export default async function DriveSettings({ status, msg }: { status?: string; msg?: string }) {
  const [cfg, redirect] = await Promise.all([getConfig(), redirectUri()]);
  const ready = oauthReady();
  return (
    <section className="card anim-rise p-4 sm:p-5 lg:col-span-2">
      <h2 className="font-display mb-1 font-semibold">Google Drive</h2>
      <p className="mb-3 text-sm text-muted">Folder otomatis <b>STUDIODO Kasir / Nama Customer / Tanggal Kode-Booking</b>, upload langsung dari HP/PC.</p>
      {status === "ok" && <p className="mb-3 rounded-xl bg-oksoft px-3 py-2 text-sm font-semibold text-ok">Google Drive berhasil terhubung.</p>}
      {status === "error" && <p className="mb-3 rounded-xl bg-badsoft px-3 py-2 text-sm font-semibold text-bad">{msg || "Gagal menghubungkan Google Drive."}</p>}

      {cfg ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge badge-green">Terhubung</span>
          <span className="text-sm font-semibold">{cfg.email || "akun Google"}</span>
          <a href="/api/google/connect" className="btn btn-sm">Hubungkan ulang</a>
          <ActionForm action={disconnectDrive} submit="Putuskan" danger confirm="Putuskan Google Drive? File yang sudah diunggah tetap ada di Drive." className="contents" />
        </div>
      ) : ready ? (
        <a href="/api/google/connect" className="btn btn-primary">Hubungkan Google Drive</a>
      ) : (
        <p className="rounded-xl bg-warnsoft px-3 py-2 text-sm font-medium text-warn">
          Isi dulu <code>GOOGLE_CLIENT_ID</code> dan <code>GOOGLE_CLIENT_SECRET</code> di environment (lihat langkah di bawah), lalu muat ulang.
        </p>
      )}

      <details className="mt-4 rounded-xl bg-panel2 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Cara menyiapkan (sekali saja)</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
          <li>Buka <b>console.cloud.google.com</b> → buat project baru (mis. “STUDIODO Kasir”).</li>
          <li><b>APIs &amp; Services → Library</b> → aktifkan <b>Google Drive API</b>.</li>
          <li><b>OAuth consent screen</b> → External → isi nama app &amp; email Anda → tambahkan scope <code>drive.file</code>. Lalu klik <b>Publish app</b> (status “In production”) agar izin tidak kedaluwarsa tiap 7 hari.</li>
          <li><b>Credentials → Create credentials → OAuth client ID → Web application</b>. Pada <i>Authorized redirect URIs</i> isi persis:
            <code className="mt-1 block break-all rounded-lg bg-panel px-2 py-1.5 text-fg">{redirect}</code></li>
          <li>Salin <b>Client ID</b> &amp; <b>Client secret</b> ke environment (<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>) — di Vercel: Settings → Environment Variables, lalu redeploy.</li>
          <li>Kembali ke sini, klik <b>Hubungkan Google Drive</b>, pilih akun Gmail studio, izinkan. Jika muncul “Google hasn’t verified this app”, pilih <i>Advanced → Go to … (unsafe)</i> — aman karena aplikasi ini milik Anda sendiri.</li>
        </ol>
      </details>
    </section>
  );
}
