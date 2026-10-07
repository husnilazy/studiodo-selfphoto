import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ActionForm, { ActionButton } from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import FileForm from "@/components/FileForm";
import FileList, { type FileItem } from "@/components/FileList";
import { Badge, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getStudio } from "@/lib/data";
import { getConfig } from "@/lib/gdrive";
import DriveUploader from "@/components/DriveUploader";
import {
  METHOD_LABEL, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, dateWIB, fmtDate, fmtDateTime, rupiah, timeWIB, todayWIB, waLink,
} from "@/lib/format";
import { addPayment, deleteBooking, refundPayment, setBookingStatus, voidPayment } from "@/app/actions/bookings";

export const metadata = { title: "Detail Booking" };

type B = {
  id: number; code: string; start_at: string; end_at: string; people: number; status: string; source: string; discount: number; total: number; notes: string;
  option_choice: string; customer_id: number; customer_name: string; customer_phone: string; room_name: string | null; room_color: string | null; package_name: string | null; created_by_name: string | null;
};
type Item = { id: number; name: string; qty: number; unit_price: number; amount: number };
type Pay = { id: number; kind: string; method: string; amount: number; paid_at: string; note: string; voided: boolean };

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [b] = await q<B>(
    `select b.id, b.code, b.start_at, b.end_at, b.people, b.status, b.source, b.discount, b.total, b.notes, b.option_choice,
            c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
            r.name as room_name, r.color as room_color, p.name as package_name, u.name as created_by_name
       from bookings b join customers c on c.id = b.customer_id
       left join rooms r on r.id = b.room_id left join packages p on p.id = b.package_id left join users u on u.id = b.created_by
      where b.id = $1`, [id]);
  if (!b) notFound();
  const driveOn = !!(await getConfig());
  const [items, pays, files, studio] = await Promise.all([
    q<Item>("select id, name, qty, unit_price, amount from booking_items where booking_id = $1 order by id", [id]),
    q<Pay>("select id, kind, method, amount, paid_at, note, voided from payments where booking_id = $1 order by paid_at, id", [id]),
    q<FileItem>(
      `select f.*, c.name as customer_name, c.phone as customer_phone, b.code as booking_code from customer_files f
         join customers c on c.id = f.customer_id left join bookings b on b.id = f.booking_id where f.booking_id = $1 order by f.created_at desc`, [id]),
    getStudio(),
  ]);
  const paid = pays.filter((p) => !p.voided).reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0);
  const due = b.total - paid;
  const canManage = user.role !== "kasir";
  const day = dateWIB(b.start_at);

  const waMsg = `Halo ${b.customer_name}, ini konfirmasi booking di ${studio.name}:\n📅 ${fmtDate(day, { weekday: true })}\n🕐 ${timeWIB(b.start_at)}–${timeWIB(b.end_at)}\n📸 ${b.package_name ?? "-"}${b.option_choice ? ` — ${b.option_choice}` : ""}${b.room_name ? ` (${b.room_name})` : ""}\nTotal ${rupiah(b.total)}${due > 0 ? ` · Sisa ${rupiah(due)}` : " · Lunas"}\nKode: ${b.code}\nSampai jumpa!`;

  return (
    <>
      <PageHeader back="/booking" title={b.customer_name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="tnum font-semibold">{b.code}</span><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge></span>}
        actions={<>
          <Link href={`/booking/${b.id}/struk`} className="btn btn-sm"><Icon name="printer" className="size-4" /> Struk</Link>
          {b.customer_phone && <a href={waLink(b.customer_phone, waMsg)} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><Icon name="chat" className="size-4" /> WhatsApp</a>}
          <Link href={`/booking/${b.id}/edit`} className="btn btn-sm"><Icon name="edit" className="size-4" /> Edit</Link>
        </>} />

      {/* Aksi status */}
      <div className="card anim-rise mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="px-1 text-xs font-bold uppercase tracking-wide text-muted">Ubah status</span>
        {b.status === "pending" && <ActionButton action={setBookingStatus.bind(null, b.id, "confirmed")} className="btn btn-sm btn-primary">Konfirmasi</ActionButton>}
        {b.status === "confirmed" && <ActionButton action={setBookingStatus.bind(null, b.id, "done")} className="btn btn-sm btn-primary">Tandai Selesai</ActionButton>}
        {(b.status === "pending" || b.status === "confirmed") && <>
          <ActionButton action={setBookingStatus.bind(null, b.id, "no_show")} confirm="Tandai customer tidak hadir?" className="btn btn-sm">Tidak Hadir</ActionButton>
          <ActionButton action={setBookingStatus.bind(null, b.id, "cancelled")} confirm={paid > 0 ? `Batalkan booking? Sudah ada pembayaran ${rupiah(paid)} — lakukan refund bila perlu.` : "Batalkan booking ini?"} className="btn btn-sm btn-danger">Batalkan</ActionButton>
        </>}
        {(b.status === "cancelled" || b.status === "no_show" || b.status === "done") && (
          <ActionButton action={setBookingStatus.bind(null, b.id, "confirmed")} className="btn btn-sm">Aktifkan Kembali</ActionButton>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card anim-rise p-4 sm:p-5">
          <h2 className="font-display mb-3 font-semibold">Sesi</h2>
          <dl className="space-y-2.5 text-sm">
            <Info k="Tanggal" v={fmtDate(day, { weekday: true })} />
            <Info k="Waktu" v={`${timeWIB(b.start_at)} – ${timeWIB(b.end_at)} WIB`} />
            <Info k="Paket" v={b.package_name ?? "—"} />
            {b.option_choice && <Info k="Pilihan" v={b.option_choice} />}
            <Info k="Ruang" v={b.room_name ? <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: b.room_color ?? "" }} />{b.room_name}</span> : "—"} />
            <Info k="Jumlah orang" v={`${b.people}`} />
            <Info k="Sumber" v={SOURCE_LABEL[b.source] ?? b.source} />
            <Info k="Customer" v={<Link href={`/customer/${b.customer_id}`} className="font-semibold text-accent">{b.customer_name}</Link>} />
            {b.customer_phone && <Info k="WhatsApp" v={b.customer_phone} />}
            {b.created_by_name && <Info k="Dicatat oleh" v={b.created_by_name} />}
          </dl>
          {b.notes && <p className="mt-3 rounded-xl bg-panel2 p-3 text-sm">{b.notes}</p>}
        </section>

        <section className="card anim-rise p-4 sm:p-5">
          <h2 className="font-display mb-3 font-semibold">Tagihan</h2>
          <table className="table !text-sm">
            <tbody>
              {items.map((i) => (
                <tr key={i.id}><td className="!pl-0">{i.name}{i.qty > 1 && <span className="text-muted"> ×{i.qty}</span>}</td><td className="num !pr-0">{rupiah(i.amount)}</td></tr>
              ))}
              {b.discount > 0 && <tr><td className="!pl-0 text-ok">Diskon</td><td className="num !pr-0 text-ok">− {rupiah(b.discount)}</td></tr>}
              <tr className="font-bold"><td className="!pl-0">Total</td><td className="num !pr-0">{rupiah(b.total)}</td></tr>
              <tr><td className="!pl-0 text-muted">Sudah dibayar</td><td className="num !pr-0">{rupiah(paid)}</td></tr>
              <tr className="font-bold"><td className="!pl-0">{due > 0 ? "Sisa tagihan" : due < 0 ? "Kelebihan bayar" : "Status"}</td>
                <td className={`num !pr-0 ${due > 0 ? "text-warn" : "text-ok"}`}>{due === 0 ? "LUNAS" : rupiah(Math.abs(due))}</td></tr>
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap gap-2">
            {due > 0 && b.status !== "cancelled" && (
              <Sheet title="Tambah Pembayaran" trigger={<button className="btn btn-primary btn-sm"><Icon name="dollar" className="size-4" /> Terima Pembayaran</button>}>
                <ActionForm action={addPayment.bind(null, b.id)} submit="Catat Pembayaran">
                  <Field label="Jenis">
                    <select name="kind" className="input" defaultValue={paid > 0 ? "payment" : "dp"}>
                      <option value="dp">DP / Uang muka</option><option value="payment">Pembayaran / Pelunasan</option>
                    </select>
                  </Field>
                  <Field label="Metode">
                    <select name="method" className="input">{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </Field>
                  <Field label="Nominal" hint={`Sisa tagihan ${rupiah(due)}`}><MoneyInput name="amount" defaultValue={due} required /></Field>
                  <Field label="Catatan (opsional)"><input name="note" className="input" /></Field>
                </ActionForm>
              </Sheet>
            )}
            {canManage && paid > 0 && (
              <Sheet title="Refund" trigger={<button className="btn btn-sm">Refund</button>}>
                <ActionForm action={refundPayment.bind(null, b.id)} submit="Catat Refund" danger>
                  <Field label="Dikembalikan lewat">
                    <select name="method" className="input">{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </Field>
                  <Field label="Nominal" hint={`Maksimal ${rupiah(paid)}`}><MoneyInput name="amount" defaultValue={paid} required /></Field>
                  <Field label="Alasan"><input name="note" className="input" placeholder="mis. booking dibatalkan" /></Field>
                </ActionForm>
              </Sheet>
            )}
          </div>
        </section>
      </div>

      <section className="card anim-rise mt-4 p-4 sm:p-5">
        <h2 className="font-display mb-3 font-semibold">Riwayat Pembayaran</h2>
        {pays.length === 0 ? <p className="text-sm text-muted">Belum ada pembayaran.</p> : (
          <ul className="divide-y divide-line">
            {pays.map((p) => (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${p.voided ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1 basis-40">
                  <p className={`font-semibold ${p.voided ? "line-through" : ""}`}>
                    {p.kind === "refund" ? "Refund" : p.kind === "dp" ? "DP" : "Pembayaran"} · {METHOD_LABEL[p.method]}
                  </p>
                  <p className="text-xs text-muted">{fmtDateTime(p.paid_at)}{p.note && ` · ${p.note}`}{p.voided && " · dibatalkan"}</p>
                </div>
                <span className={`tnum font-bold ${p.kind === "refund" ? "text-bad" : ""}`}>{p.kind === "refund" ? "−" : "+"} {rupiah(p.amount)}</span>
                {canManage && !p.voided && <ActionButton action={voidPayment.bind(null, p.id)} confirm="Batalkan catatan pembayaran ini? Jurnal keuangan ikut dibatalkan." className="btn btn-sm btn-danger">Batalkan</ActionButton>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-semibold">File Customer</h2>
          <div className="flex gap-2">
          <Sheet title="Upload ke Google Drive" trigger={<button className="btn btn-sm btn-primary"><Icon name="download" className="size-4 rotate-180" /> Upload</button>}>
            <DriveUploader customerId={b.customer_id} bookingId={b.id} connected={driveOn} />
          </Sheet>
          <Sheet title="Tambah Link File" trigger={<button className="btn btn-sm"><Icon name="plus" className="size-4" /> Link</button>}>
            <FileForm customerId={b.customer_id} bookingId={b.id} bookings={[{ id: b.id, label: `${b.code} · ${fmtDate(day, { short: true })}` }]} />
          </Sheet>
          </div>
        </div>
        {files.length === 0 ? <p className="text-sm text-muted">Belum ada file untuk sesi ini.</p> : <FileList files={files} today={todayWIB()} />}
      </section>

      {canManage && pays.length === 0 && (
        <div className="mt-8"><ActionForm action={deleteBooking.bind(null, b.id)} submit="Hapus booking" danger confirm="Hapus booking ini permanen?" className="max-w-xs" /></div>
      )}
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}
