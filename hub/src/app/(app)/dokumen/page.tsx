import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { listEmployees } from "@/lib/payroll";
import { addDocument, deleteDocument } from "@/app/actions-hr";
import { Empty, Field, PageHead, Pill, SectionHead } from "@/components/ui";

export const metadata = { title: "Dokumen" };
type Doc = { id: number; title: string; kind: string; company_id: number | null; visibility: string; url: string; body: string; employee_id: number | null; created_at: string };
const VIS: Record<string, string> = { owner: "Hanya Owner", team: "Owner & partner", investor: "Investor", karyawan: "Karyawan", all: "Semua akun" };
const KINDS = [["perjanjian", "Perjanjian kemitraan / bagi hasil"], ["kontrak", "Kontrak kerja"], ["sop", "SOP / panduan"], ["laporan", "Laporan"], ["legal", "Legal & izin"], ["dokumen", "Lainnya"]] as const;

export default async function Page() {
  const [f, user, emps, docs] = await Promise.all([
    loadFacts(), currentUser(), listEmployees(),
    q<Doc>("select id, title, kind, company_id, visibility, url, body, employee_id, to_char(created_at,'YYYY-MM-DD') as created_at from documents where kind <> 'update' order by created_at desc, id desc"),
  ]);
  const owner = user?.role === "owner";
  const co = (id: number | null) => f.companies.find((c) => c.id === id)?.name ?? "Grup";
  return (
    <>
      <PageHead title="Dokumen" sub="Perjanjian, kontrak, SOP, dan laporan di satu tempat, dengan pengaturan siapa yang boleh melihat. Simpan tautan (Google Drive, dll.) atau tulis isinya langsung." />
      {owner && (
        <section className="card card-pad">
          <SectionHead title="Tambah dokumen" />
          <form action={addDocument} className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-3"><Field label="Judul"><input name="title" className="input" required placeholder="mis. Perjanjian modal & bagi hasil STUDIODO" /></Field></div>
            <div className="sm:col-span-3"><Field label="Tautan (opsional)"><input name="url" className="input" placeholder="https://drive.google.com/…" /></Field></div>
            <Field label="Jenis"><select name="kind" className="input">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Unit"><select name="company" className="input" defaultValue=""><option value="">Seluruh grup</option>{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Dilihat oleh"><select name="visibility" className="input" defaultValue="owner">{Object.entries(VIS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Khusus karyawan"><select name="employee" className="input" defaultValue=""><option value="">— tidak —</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            <div className="sm:col-span-6"><Field label="Isi / catatan"><textarea name="body" className="input" rows={3} /></Field></div>
            <div className="sm:col-span-6"><button className="btn btn-primary">Simpan dokumen</button></div>
          </form>
        </section>
      )}
      <div className="mt-4 space-y-3">
        {docs.length === 0 && <Empty>Belum ada dokumen.</Empty>}
        {docs.map((d) => (
          <article key={d.id} className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><div className="mb-1 flex flex-wrap items-center gap-2"><Pill tone="info">{KINDS.find(([k]) => k === d.kind)?.[1] ?? d.kind}</Pill><Pill tone={d.visibility === "owner" ? "warn" : "ok"}>{VIS[d.visibility]}{d.employee_id ? ` · ${emps.find((e) => e.id === d.employee_id)?.name ?? ""}` : ""}</Pill><span className="text-xs text-muted">{co(d.company_id)} · {d.created_at}</span></div>
                <h2 className="font-display">{d.title}</h2></div>
              <div className="flex items-center gap-2">{d.url && <a href={d.url} target="_blank" rel="noreferrer" className="btn !min-h-8 text-xs">Buka</a>}
                {owner && <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className="btn btn-danger !min-h-8 text-xs">Hapus</button></form>}</div>
            </div>
            {d.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{d.body}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
