import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { addCompany, addPartner, addUserAction, clearDemo, loadDemo, savePartnerLink } from "@/app/actions";
import { ApiKeyButton } from "@/components/clientForms";
import { CompanyDot, Field, PageHead, Pill } from "@/components/ui";

export const metadata = { title: "Pengaturan" };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const users = await q<{ id: number; name: string; role: string }>("select id, name, role from users where active order by id");
  const demo = (await q<{ n: number }>("select count(*)::int as n from transactions where source='demo'"))[0]?.n ?? 0;
  const owner = user?.role === "owner";
  const base = process.env.APP_URL || "https://<domain-hub-kamu>";
  if (!owner) return <><PageHead title="Pengaturan" /><p className="text-sm text-muted">Hanya Owner yang bisa mengubah pengaturan.</p></>;
  return (
    <>
      <PageHead title="Pengaturan" sub="Perusahaan, partner & bobot kerja, sambungan API Core, dan pengguna." />

      <h2 className="mb-3 font-display text-lg font-semibold">Sambungan API Core per perusahaan</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {f.companies.map((c) => (
          <section key={c.id} className="card card-pad">
            <div className="mb-2 flex items-center justify-between"><span className="inline-flex items-center gap-2 font-display font-semibold"><CompanyDot color={c.color} />{c.name}</span>
              <Pill tone={c.last_sync_at ? "ok" : "info"}>{c.last_sync_at ? `Sinkron ${new Date(c.last_sync_at).toLocaleString("id-ID")}` : "Belum tersambung"}</Pill></div>
            <p className="mb-3 text-xs text-muted">Key: {c.api_key_prefix ? `${c.api_key_prefix}…` : "belum dibuat"}</p>
            <ApiKeyButton id={c.id} has={!!c.api_key_prefix} />
          </section>
        ))}
      </div>
      <details className="card card-pad mt-3" open>
        <summary className="cursor-pointer font-display font-semibold">Cara kirim data dari kasir</summary>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-panel2 p-3 text-xs leading-relaxed">{`POST ${base}/api/core/v1/ingest
Authorization: Bearer fh_xxxxxxxx
Content-Type: application/json

{ "events": [
  { "id": "2026-11-08:revenue", "date": "2026-11-08", "kind": "revenue",
    "category": "penjualan", "amount": 1250000, "memo": "Omzet harian" },
  { "id": "2026-11-08:exp:bahan", "date": "2026-11-08", "kind": "expense",
    "category": "bahan", "amount": 300000 } ] }`}</pre>
        <p className="mt-2 text-xs text-muted"><code>id</code> sama = menimpa data lama, jadi aman dikirim berulang. <code>kind</code> juga bisa <code>capital_in</code> dan <code>withdrawal</code>; tambahkan <code>"funding":"partner"</code> + <code>"partner":"Nama"</code> untuk alat/biaya yang dibayar pribadi (nama boleh dikosongkan bila unit hanya punya satu partner). Kirim <code>window</code> (<code>from</code> dan <code>to</code>, format YYYY-MM-DD) agar data yang dibatalkan di kasir ikut hilang. Kasir STUDIODO sudah punya konektor bawaan (HUB_URL + HUB_API_KEY). Tes koneksi: <code>GET /api/core/v1/ingest</code> dengan key yang sama.</p>
      </details>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Partner & bobot kerja</h2>
      <p className="mb-3 text-sm text-muted"><b>Porsi disepakati</b> = kepemilikan yang kalian sepakati (%). <b>Bobot kerja</b> = seberapa besar kontribusi kerja harian (angka relatif, mis. kamu 3, teman 1).</p>
      <div className="space-y-3">
        {f.companies.map((c) => (
          <section key={c.id} className="card card-pad">
            <div className="mb-3 inline-flex items-center gap-2 font-display font-semibold"><CompanyDot color={c.color} />{c.name}</div>
            <div className="space-y-2">
              {f.partners.map((p) => {
                const m = f.cps.find((x) => x.company_id === c.id && x.partner_id === p.id);
                return (
                  <form key={p.id} action={savePartnerLink} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
                    <input type="hidden" name="company" value={c.id} /><input type="hidden" name="partner" value={p.id} />
                    <div className="col-span-2 text-sm font-medium">{p.name}<div className="text-xs text-muted">{p.role}</div></div>
                    <Field label="Porsi %"><input name="equity" type="number" step="0.5" min={0} max={100} defaultValue={m ? Number(m.equity_pct) : 0} className="input" /></Field>
                    <Field label="Bobot kerja"><input name="work" type="number" step="0.5" min={0} defaultValue={m ? Number(m.work_weight) : 1} className="input" /></Field>
                    <button className="btn btn-primary !min-h-10">{m ? "Perbarui" : "Tambahkan"}</button>
                    {m && <button name="remove" value="1" className="btn btn-danger !min-h-10">Keluarkan</button>}
                  </form>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <form action={addPartner} className="card card-pad grid gap-3"><h3 className="font-display font-semibold">Tambah partner</h3>
          <Field label="Nama"><input name="name" className="input" required placeholder="Nama temanmu" /></Field><Field label="Peran"><input name="role" className="input" placeholder="mis. Co-founder" /></Field><button className="btn btn-primary">Tambah partner</button></form>
        <form action={addCompany} className="card card-pad grid gap-3"><h3 className="font-display font-semibold">Tambah perusahaan baru</h3>
          <Field label="Nama usaha"><input name="name" className="input" required /></Field><Field label="Bidang"><input name="kind" className="input" placeholder="mis. Properti" /></Field>
          <Field label="Warna"><input name="color" type="color" defaultValue="#b8c4ff" className="input !p-1" /></Field><button className="btn btn-primary">Tambah usaha</button></form>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Pengguna</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="card card-pad"><ul className="space-y-2 text-sm">{users.map((u) => <li key={u.id} className="flex justify-between"><span>{u.name}</span><Pill>{u.role}</Pill></li>)}</ul></section>
        <form action={addUserAction} className="card card-pad grid gap-3"><h3 className="font-display font-semibold">Tambah pengguna (mis. partner, lihat saja)</h3>
          <Field label="Nama"><input name="name" className="input" required /></Field><Field label="PIN 6 digit"><input name="pin" inputMode="numeric" maxLength={6} className="input" required /></Field>
          <Field label="Peran"><select name="role" className="input"><option value="partner">Partner (lihat saja)</option><option value="owner">Owner (bisa ubah)</option></select></Field><button className="btn btn-primary">Tambah</button></form>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Data contoh</h2>
      <section className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Isi 6 bulan data fiktif untuk mencoba grafik & rekomendasi. Ditandai “demo” dan bisa dihapus tanpa mengganggu data aslimu.{demo > 0 && ` Saat ini ada ${demo} baris contoh.`}</p>
        <div className="flex gap-2"><form action={loadDemo}><button className="btn">Muat data contoh</button></form>{demo > 0 && <form action={clearDemo}><button className="btn btn-danger">Hapus data contoh</button></form>}</div>
      </section>
    </>
  );
}
