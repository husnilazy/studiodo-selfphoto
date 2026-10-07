import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import BookingRow from "@/components/BookingRow";
import FileForm from "@/components/FileForm";
import FileList, { type FileItem } from "@/components/FileList";
import { PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { listBookings } from "@/lib/data";
import { getConfig } from "@/lib/gdrive";
import DriveUploader from "@/components/DriveUploader";
import { dateWIB, fmtDate, rupiah, todayWIB, waLink } from "@/lib/format";
import CustomerForm from "../CustomerForm";

export const metadata = { title: "Detail Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [c] = await q<{ id: number; name: string; phone: string; instagram: string; email: string; notes: string; created_at: string }>("select * from customers where id = $1", [id]);
  if (!c) notFound();
  const [bookings, files] = await Promise.all([
    listBookings({ customerId: id, order: "desc", limit: 100 }),
    q<FileItem>(
      `select f.*, c.name as customer_name, c.phone as customer_phone, b.code as booking_code from customer_files f
         join customers c on c.id = f.customer_id left join bookings b on b.id = f.booking_id where f.customer_id = $1 order by f.created_at desc`, [id]),
  ]);
  const driveOn = !!(await getConfig());
  const done = bookings.filter((b) => b.status === "done");
  const spent = done.reduce((s, b) => s + b.total, 0);
  const last = bookings.find((b) => b.status === "done" || b.status === "confirmed");

  return (
    <>
      <PageHeader back="/customer" title={c.name}
        subtitle={<>{c.phone || "tanpa nomor"}{c.instagram && <> · <a className="font-semibold text-accent" href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer">@{c.instagram}</a></>}</>}
        actions={<>
          {c.phone && <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(c.phone, `Halo ${c.name}, `)}><Icon name="chat" className="size-4" /> WhatsApp</a>}
          <Sheet title="Edit Customer" trigger={<button className="btn btn-sm"><Icon name="edit" className="size-4" /> Edit</button>}>
            <CustomerForm customer={c} canDelete={user.role !== "kasir"} />
          </Sheet>
          <Link href={`/booking/baru?customer=${c.id}`} className="btn btn-primary btn-sm"><Icon name="plus" className="size-4" /> Transaksi</Link>
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total sesi" value={done.length} icon="camera" />
        <Stat label="Total belanja" value={rupiah(spent)} icon="dollar" />
        <Stat label="Rata-rata / sesi" value={rupiah(done.length ? Math.round(spent / done.length) : 0)} icon="chart" />
        <Stat label="Terakhir datang" value={<>{last ? fmtDate(dateWIB(last.start_at), { short: true }) : "—"}</>} icon="clock" />
      </div>
      {c.notes && <p className="card mb-5 p-4 text-sm"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Catatan</span>{c.notes}</p>}

      <h2 className="font-display mb-3 font-semibold">Riwayat Booking</h2>
      <div className="mb-6 space-y-2">
        {bookings.length === 0 ? <p className="text-sm text-muted">Belum ada booking.</p> : bookings.map((b) => <BookingRow key={b.id} b={b} showDate />)}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display font-semibold">File</h2>
        <div className="flex gap-2">
        <Sheet title="Upload ke Google Drive" trigger={<button className="btn btn-sm btn-primary"><Icon name="download" className="size-4 rotate-180" /> Upload</button>}>
          <DriveUploader customerId={c.id} connected={driveOn} bookings={bookings.map((b) => ({ id: b.id, label: `${b.code} · ${fmtDate(dateWIB(b.start_at), { short: true })}` }))} />
        </Sheet>
        <Sheet title="Tambah Link File" trigger={<button className="btn btn-sm"><Icon name="plus" className="size-4" /> Link</button>}>
          <FileForm customerId={c.id} bookings={bookings.map((b) => ({ id: b.id, label: `${b.code} · ${fmtDate(dateWIB(b.start_at), { short: true })}` }))} />
        </Sheet>
        </div>
      </div>
      {files.length === 0 ? <p className="text-sm text-muted">Belum ada file.</p> : (
        <FileList files={files} today={todayWIB()} bookings={bookings.map((b) => ({ id: b.id, label: `${b.code} · ${fmtDate(dateWIB(b.start_at), { short: true })}` }))} />
      )}
    </>
  );
}
