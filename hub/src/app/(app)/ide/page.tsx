import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { deleteNote, saveNote } from "@/app/actions";
import { Empty, Field, PageHead, Pill } from "@/components/ui";

export const metadata = { title: "Ide & Rencana" };
const KIND: Record<string, string> = { ide: "Ide", rencana: "Rencana", dokumen: "Dokumen", pitching: "Materi pitching", keputusan: "Keputusan" };

const SEEDS = [
  ["Studio berlangganan (member bulanan)", "Paket member sudah ada di STUDIODO. Dorong paket langganan bulanan untuk pendapatan berulang yang bisa diprediksi, lalu jadikan metrik MRR di materi pitching."],
  ["Lisensi Photobooth APP per studio", "Jual aplikasi photobooth sebagai SaaS: biaya setup + langganan bulanan per unit. Margin tinggi, tidak butuh stok."],
  ["Paket konten SNAPCUP × Frameless", "Frameless memproduksi konten untuk SNAPCUP dan dicatat sebagai transaksi antar-unit agar margin tiap unit jujur."],
  ["Rapikan modal berjalan", "Setiap beli alat untuk proyek: catat sebagai 'Beli aset' + sumber dana (kas / pribadi). Ini kunci agar bagi hasil adil."],
];

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const notes = await q<{ id: number; kind: string; title: string; body: string; company_id: number | null; created_at: string }>("select * from notes order by id desc");
  const owner = user?.role === "owner";
  return (
    <>
      <PageHead title="Ide, rencana & dokumentasi" sub="Satu tempat untuk ide pengembangan, rencana, keputusan, dan bahan dokumentasi perusahaan. Materi di sini bisa dipakai untuk pitching investor." />
      {owner && (
        <form action={saveNote} className="card card-pad grid gap-3 sm:grid-cols-4">
          <Field label="Jenis"><select name="kind" className="input">{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Unit"><select name="company" className="input" defaultValue=""><option value="">Seluruh grup</option>{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Judul"><input name="title" className="input" required /></Field></div>
          <div className="sm:col-span-4"><Field label="Isi"><textarea name="body" className="input" rows={4} /></Field></div>
          <div className="sm:col-span-4"><button className="btn btn-primary">Simpan catatan</button></div>
        </form>
      )}
      <div className="mt-5 space-y-3">
        {notes.map((n) => (
          <article key={n.id} className="card card-pad">
            <div className="flex items-start justify-between gap-3">
              <div><div className="mb-1 flex items-center gap-2"><Pill tone="info">{KIND[n.kind] ?? n.kind}</Pill><span className="text-xs text-muted">{n.company_id ? f.companies.find((c) => c.id === n.company_id)?.name : "Grup"}</span></div><h2 className="font-display font-semibold">{n.title}</h2></div>
              {owner && <form action={deleteNote}><input type="hidden" name="id" value={n.id} /><button className="text-xs text-muted hover:text-bad">Hapus</button></form>}
            </div>
            {n.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{n.body}</p>}
          </article>
        ))}
        {notes.length === 0 && <Empty>Belum ada catatan.</Empty>}
      </div>
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Ide dari Hub untuk dipertimbangkan</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {SEEDS.map(([t, b]) => (
          <article key={t} className="card card-pad"><h3 className="font-display font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{b}</p>
            {owner && <form action={saveNote} className="mt-3"><input type="hidden" name="kind" value="ide" /><input type="hidden" name="title" value={t} /><input type="hidden" name="body" value={b} /><button className="btn !min-h-8 text-xs">+ Simpan ke catatan</button></form>}</article>
        ))}
      </div>
    </>
  );
}
