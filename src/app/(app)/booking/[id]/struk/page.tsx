import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getStudio } from "@/lib/data";
import { METHOD_LABEL, fmtDate, dateWIB, rupiah, timeWIB } from "@/lib/format";
import PrintButton from "./PrintButton";

export const metadata = { title: "Struk" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [b] = await q<{ code: string; start_at: string; end_at: string; total: number; discount: number; discount_detail: { label: string; amount: number }[]; customer: string; room: string | null; cashier: string | null; option_choice: string }>(
    `select b.code, b.start_at, b.end_at, b.total, b.discount, b.discount_detail, b.option_choice, c.name as customer, r.name as room, u.name as cashier
       from bookings b join customers c on c.id = b.customer_id left join rooms r on r.id = b.room_id left join users u on u.id = b.created_by where b.id = $1`, [id]);
  if (!b) notFound();
  const [items, pays, studio] = await Promise.all([
    q<{ name: string; qty: number; unit_price: number; amount: number }>("select name, qty, unit_price, amount from booking_items where booking_id = $1 order by id", [id]),
    q<{ kind: string; method: string; amount: number }>("select kind, method, amount from payments where booking_id = $1 and not voided order by paid_at, id", [id]),
    getStudio(),
  ]);
  const paid = pays.reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0);

  return (
    <div className="mx-auto max-w-[320px]">
      <div className="no-print mb-4 flex gap-2">
        <Link href={`/booking/${id}`} className="btn flex-1">Kembali</Link>
        <PrintButton />
      </div>
      <div className="card p-5 text-sm" style={{ fontFamily: "ui-monospace, monospace" }}>
        <div className="text-center">
          <p className="text-lg font-bold">{studio.name}</p>
          {studio.address && <p className="text-xs">{studio.address}</p>}
          {studio.phone && <p className="text-xs">{studio.phone}</p>}
        </div>
        <hr className="my-3 border-dashed border-line" />
        <p>No : {b.code}</p>
        <p>Tgl: {fmtDate(dateWIB(b.start_at), { short: true })} {timeWIB(b.start_at)}–{timeWIB(b.end_at)}</p>
        <p>Cust: {b.customer}</p>
        {b.room && <p>Ruang: {b.room}</p>}
        {b.option_choice && <p>Pilihan: {b.option_choice}</p>}
        {b.cashier && <p>Kasir: {b.cashier}</p>}
        <hr className="my-3 border-dashed border-line" />
        {items.map((i, k) => (
          <div key={k} className="mb-1">
            <p>{i.name}</p>
            <p className="flex justify-between"><span>{i.qty} x {i.unit_price.toLocaleString("id-ID")}</span><span>{i.amount.toLocaleString("id-ID")}</span></p>
          </div>
        ))}
        <hr className="my-3 border-dashed border-line" />
        {b.discount > 0 && (b.discount_detail?.length
          ? b.discount_detail.map((d, k) => <p key={k} className="flex justify-between"><span>{d.label}</span><span>-{d.amount.toLocaleString("id-ID")}</span></p>)
          : <p className="flex justify-between"><span>Diskon</span><span>-{b.discount.toLocaleString("id-ID")}</span></p>)}
        <p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{rupiah(b.total)}</span></p>
        {pays.map((p, k) => (
          <p key={k} className="flex justify-between"><span>{p.kind === "refund" ? "Refund" : p.kind === "dp" ? "DP" : "Bayar"} ({METHOD_LABEL[p.method]})</span><span>{p.amount.toLocaleString("id-ID")}</span></p>
        ))}
        <p className="flex justify-between font-bold"><span>{b.total - paid > 0 ? "SISA" : "STATUS"}</span><span>{b.total - paid > 0 ? rupiah(b.total - paid) : "LUNAS"}</span></p>
        <hr className="my-3 border-dashed border-line" />
        <p className="text-center text-xs">{studio.footer}</p>
      </div>
    </div>
  );
}
