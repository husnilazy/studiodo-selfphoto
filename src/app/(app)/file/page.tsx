import Link from "next/link";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import FileForm from "@/components/FileForm";
import FileList, { type FileItem } from "@/components/FileList";
import { Empty, PageHeader } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FILE_STATUS_LABEL, todayWIB } from "@/lib/format";

export const metadata = { title: "File Customer" };

export default async function FilePage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const status = sp.status && FILE_STATUS_LABEL[sp.status] ? sp.status : "";
  const term = (sp.q ?? "").trim();
  const files = await q<FileItem>(
    `select f.*, c.name as customer_name, c.phone as customer_phone, b.code as booking_code
       from customer_files f join customers c on c.id = f.customer_id
       left join bookings b on b.id = f.booking_id
      where ($1 = '' or f.status = $1) and ($2 = '' or c.name ilike $3 or f.title ilike $3 or c.phone ilike $3)
      order by case f.status when 'proses' then 0 when 'siap' then 1 else 2 end, f.created_at desc limit 200`,
    [status, term, `%${term.replace(/[%_]/g, "")}%`],
  );
  const [counts] = await q<{ proses: number; siap: number; terkirim: number }>(
    `select count(*) filter (where status='proses')::int as proses, count(*) filter (where status='siap')::int as siap,
            count(*) filter (where status='terkirim')::int as terkirim from customer_files`);

  const chips = [{ k: "", l: "Semua" }, ...Object.entries(FILE_STATUS_LABEL).map(([k, l]) => ({ k, l: `${l} (${counts[k as keyof typeof counts]})` }))];

  return (
    <>
      <PageHeader title="File Customer" subtitle="Link foto & video hasil sesi, status pengerjaan, dan pengiriman ke customer."
        actions={
          <Sheet title="Tambah File" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah File</button>}>
            <FileForm />
          </Sheet>
        } />
      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={term} placeholder="Cari customer / judul file…" className="input !pl-10" />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn">Cari</button>
      </form>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {chips.map((c) => (
          <Link key={c.k} href={`/file?${new URLSearchParams({ ...(c.k ? { status: c.k } : {}), ...(term ? { q: term } : {}) })}`}
            className="chip shrink-0" data-on={status === c.k}>{c.l}</Link>
        ))}
      </div>
      {files.length === 0
        ? <Empty title="Belum ada file" hint="Tambahkan link hasil foto (mis. Google Drive) agar mudah dikirim ke customer." />
        : <FileList files={files} today={todayWIB()} showCustomer />}
    </>
  );
}
