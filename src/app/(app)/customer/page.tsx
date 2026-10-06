import Link from "next/link";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { Empty, PageHeader } from "@/components/ui";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, dateWIB, rupiah } from "@/lib/format";
import CustomerForm from "./CustomerForm";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const term = ((await searchParams).q ?? "").trim();
  const rows = await q<{ id: number; name: string; phone: string; instagram: string; visits: number; spent: number; last_visit: string | null }>(
    `select c.id, c.name, c.phone, c.instagram,
            count(b.id) filter (where b.status in ('confirmed','done'))::int as visits,
            coalesce(sum(b.total) filter (where b.status = 'done'), 0) as spent,
            max(b.start_at) filter (where b.status in ('confirmed','done')) as last_visit
       from customers c left join bookings b on b.customer_id = c.id
      where $1 = '' or c.name ilike $2 or c.phone ilike $2 or c.instagram ilike $2
      group by c.id order by max(b.start_at) desc nulls last, c.created_at desc limit 200`,
    [term, `%${term.replace(/[%_]/g, "")}%`],
  );

  return (
    <>
      <PageHeader title="Customer" subtitle={`${rows.length} customer${term ? ` untuk “${term}”` : ""}`}
        actions={
          <Sheet title="Customer Baru" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah</button>}>
            <CustomerForm />
          </Sheet>
        } />
      <form className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={term} placeholder="Cari nama, no. HP, atau Instagram…" className="input !pl-10" />
        </div>
        <button className="btn">Cari</button>
      </form>
      {rows.length === 0 ? (
        <Empty title={term ? "Tidak ditemukan" : "Belum ada customer"} hint="Customer otomatis tersimpan saat membuat booking." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/customer/${c.id}`} className="card anim-rise flex items-center gap-3 p-4 transition active:scale-[.98] hover:border-accent">
              <span className="font-display grid size-11 shrink-0 place-items-center rounded-full bg-accentsoft text-lg font-semibold text-accent">{c.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block truncate text-xs text-muted">{c.phone || "tanpa nomor"}{c.instagram && ` · @${c.instagram}`}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {c.visits}x sesi · {rupiah(c.spent)}{c.last_visit && ` · terakhir ${fmtDate(dateWIB(c.last_visit), { short: true })}`}
                </span>
              </span>
              <Icon name="right" className="size-4 shrink-0 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
