import ActionForm from "./ActionForm";
import CopyLink from "./CopyLink";
import Icon from "./Icon";
import { one, q } from "@/lib/db";
import { appOrigin } from "@/lib/gdrive";
import { waLink, fmtDateTime } from "@/lib/format";
import { disableGallery, enableGallery, regenerateGallery, saveGalleryNote } from "@/app/actions/gallery";

/** Panel studio di halaman customer: buat/salin/kirim link galeri, lihat foto favorit & ulasan dari customer. */
export default async function GalleryPanel({ customerId, name, phone }: { customerId: number; name: string; phone: string }) {
  const c = await one<{ gallery_token: string | null; gallery_note: string }>("select gallery_token, gallery_note from customers where id = $1", [customerId]);
  const [favs, fbs, count] = await Promise.all([
    q<{ title: string }>("select f.title from gallery_favorites g join customer_files f on f.id = g.file_id where g.customer_id = $1 order by g.created_at", [customerId]),
    q<{ rating: number; message: string; name: string; created_at: string }>("select rating, message, name, created_at from gallery_feedback where customer_id = $1 order by created_at desc limit 5", [customerId]),
    one<{ n: number }>("select count(*)::int as n from customer_files where customer_id = $1 and drive_file_id is not null and status in ('siap','terkirim')", [customerId]),
  ]);
  const url = c?.gallery_token ? `${await appOrigin()}/galeri/${c.gallery_token}` : null;
  const msg = url ? `Halo ${name}, galeri foto kamu dari STUDIODO sudah siap ✨\nLihat, pilih favorit, dan unduh di sini:\n${url}\nTerima kasih sudah berfoto di STUDIODO!` : "";

  return (
    <section className="card anim-rise mb-6 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display flex items-center gap-2 font-semibold"><Icon name="camera" className="size-4 text-accent" /> Galeri customer</h2>
        {url && <span className="badge badge-green">Aktif</span>}
      </div>
      {!url ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Halaman galeri khusus {name}: foto &amp; video ditampilkan rapi di aplikasi STUDIODO (tanpa buka Google Drive), bisa pilih favorit, unduh, dan beri ulasan.
            {count && count.n > 0 ? <> Saat ini ada <b className="text-fg">{count.n}</b> file siap tampil.</> : <> Unggah foto/video dulu lewat tombol Upload di bawah.</>}</p>
          <ActionForm action={enableGallery.bind(null, customerId)} submit="Buat galeri" className="space-y-2" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="break-all rounded-xl bg-panel2 px-3 py-2 text-xs">{url}</p>
          <div className="flex flex-wrap gap-2">
            <CopyLink url={url} />
            <a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external" className="size-4" /> Buka galeri</a>
            {phone && <a className="btn btn-sm btn-primary" href={waLink(phone, msg)} target="_blank" rel="noopener noreferrer"><Icon name="chat" className="size-4" /> Kirim ke WhatsApp</a>}
          </div>
          <ActionForm action={saveGalleryNote.bind(null, customerId)} submit="Simpan pesan" className="space-y-2">
            <label className="block"><span className="label">Pesan untuk customer (tampil di atas galeri)</span>
              <textarea name="note" rows={2} maxLength={400} defaultValue={c?.gallery_note} className="input" placeholder="mis. Terima kasih sudah berfoto bareng keluarga! Pilih favoritmu ya ✨" /></label>
          </ActionForm>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Foto favorit ({favs.length})</p>
              {favs.length === 0 ? <p className="text-sm text-muted">Belum ada yang ditandai.</p> : (
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-sm">{favs.map((f, i) => <li key={i} className="truncate">♥ {f.title}</li>)}</ul>
              )}
            </div>
            <div className="rounded-xl border border-line p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Ulasan ({fbs.length})</p>
              {fbs.length === 0 ? <p className="text-sm text-muted">Belum ada ulasan.</p> : (
                <ul className="max-h-32 space-y-1.5 overflow-y-auto text-sm">{fbs.map((f, i) => (
                  <li key={i}><span className="text-warn">{"★".repeat(f.rating)}<span className="text-line">{"★".repeat(5 - f.rating)}</span></span> <span className="text-xs text-muted">{f.name && `${f.name} · `}{fmtDateTime(f.created_at)}</span>{f.message && <p className="text-muted">“{f.message}”</p>}</li>
                ))}</ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <ActionForm action={regenerateGallery.bind(null, customerId)} submit="Ganti link" confirm="Ganti link galeri? Link lama langsung tidak bisa dibuka." className="contents" />
            <ActionForm action={disableGallery.bind(null, customerId)} submit="Matikan galeri" danger confirm="Matikan galeri? Link berhenti bisa dibuka (favorit & ulasan tetap tersimpan)." className="contents" />
          </div>
        </div>
      )}
    </section>
  );
}
