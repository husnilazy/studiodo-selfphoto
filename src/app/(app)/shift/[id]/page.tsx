import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/app/(app)/booking/[id]/struk/PrintButton";
import { Badge, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTime, rupiah } from "@/lib/format";
import { getShift, shiftTotals } from "@/lib/shift";

export const metadata = { title: "Rekap Shift" };
const METHOD: Record<string, string> = { cash: "Tunai", qris: "QRIS", transfer: "Transfer" };

export default async function ShiftDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const s = Number.isInteger(id) ? await getShift(id) : null;
  if (!s) notFound();
  const closed = !!s.closed_at;
  // Shift berjalan: hitung langsung. Shift tertutup: pakai angka yang dibekukan saat penutupan.
  const live = closed ? null : await shiftTotals(s.id, Number(s.opening_cash));
  const cash = Number(closed ? s.sales_cash : live!.cash), qris = Number(closed ? s.sales_qris : live!.qris);
  const transfer = Number(closed ? s.sales_transfer : live!.transfer), out = Number(closed ? s.cash_out : live!.cashOut), inn = Number(closed ? (s.cash_in ?? 0) : live!.cashIn);
  const expected = Number(closed ? s.expected_cash : live!.expected);

  const pays = await q<{ id: number; kind: string; method: string; amount: number; paid_at: string; code: string; customer: string; voided: boolean }>(
    `select p.id, p.kind, p.method, p.amount, p.paid_at, p.voided, b.code, c.name as customer
       from payments p join bookings b on b.id = p.booking_id join customers c on c.id = b.customer_id
      where p.shift_id = $1 order by p.paid_at`, [s.id]);
  const moves = await q<{ id: number; amount: number; kind: string; note: string; created_at: string }>("select id, amount, kind, note, created_at from shift_moves where shift_id = $1 and not voided order by id", [s.id]);

  return (
    <>
      <PageHeader title={`Rekap Shift #${s.id}`} back="/shift"
        subtitle={<>Dibuka {fmtDateTime(s.opened_at)} oleh {s.opener ?? "—"}{closed && <> · ditutup {fmtDateTime(s.closed_at!)} oleh {s.closer ?? "—"}</>}</>}
        actions={<><Badge tone={closed ? "slate" : "green"}>{closed ? "Ditutup" : "Berjalan"}</Badge><div className="no-print"><PrintButton /></div></>} />

      <div className="card mb-4 space-y-1.5 p-4 text-sm sm:p-5">
        <Row k="Modal awal" v={rupiah(Number(s.opening_cash))} />
        <Row k="+ Penjualan tunai" v={rupiah(cash)} />
        {inn > 0 && <Row k="+ Uang masuk laci (modal/lainnya)" v={rupiah(inn)} />}
        <Row k="− Uang keluar laci" v={rupiah(out)} />
        <Row k="= Seharusnya di laci" v={rupiah(expected)} bold />
        {closed && <>
          <Row k="Uang fisik dihitung" v={rupiah(Number(s.counted_cash))} bold />
          <Row k="Selisih" v={Number(s.difference) === 0 ? "Pas" : rupiah(Number(s.difference))} bold tone={Number(s.difference) === 0 ? "ok" : "warn"} />
          {s.close_note && <p className="pt-1 text-xs text-muted">Catatan: {s.close_note}</p>}
        </>}
        <div className="my-3 border-t border-line" />
        <Row k="QRIS (masuk rekening/e-wallet)" v={rupiah(qris)} />
        <Row k="Transfer bank" v={rupiah(transfer)} />
        <Row k="Total penjualan semua metode" v={rupiah(cash + qris + transfer)} bold />
      </div>

      <h2 className="font-display mb-2 font-semibold">Transaksi ({pays.length})</h2>
      <div className="card mb-4 divide-y divide-line">
        {pays.length === 0 ? <p className="p-4 text-sm text-muted">Belum ada transaksi di shift ini.</p> : pays.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 p-3 text-sm ${p.voided ? "opacity-45" : ""}`}>
            <div className="min-w-0 flex-1">
              <Link href={`/booking?q=${p.code}`} className="truncate font-semibold hover:underline">{p.customer}</Link>
              <p className="text-xs text-muted">{p.code} · {fmtDateTime(p.paid_at)} · {METHOD[p.method]}{p.kind === "refund" && " · refund"}{p.voided && " · dibatalkan"}</p>
            </div>
            <span className={`tnum font-bold ${p.kind === "refund" ? "text-bad" : ""} ${p.voided ? "line-through" : ""}`}>{p.kind === "refund" ? "−" : ""}{rupiah(p.amount)}</span>
          </div>
        ))}
      </div>

      {moves.length > 0 && <>
        <h2 className="font-display mb-2 font-semibold">Pergerakan uang laci</h2>
        <div className="card divide-y divide-line">
          {moves.map((m) => <div key={m.id} className="flex justify-between gap-3 p-3 text-sm"><span className="truncate text-muted">{fmtDateTime(m.created_at)} · {m.note}</span><span className={`tnum font-semibold ${m.kind === "in" ? "text-ok" : "text-bad"}`}>{m.kind === "in" ? "+" : "−"}{rupiah(m.amount)}</span></div>)}
        </div>
      </>}
    </>
  );
}

function Row({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: "ok" | "warn" }) {
  return <div className="flex justify-between gap-3"><span className={bold ? "font-semibold" : "text-muted"}>{k}</span><span className={`tnum ${bold ? "font-bold" : "font-semibold"} ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : ""}`}>{v}</span></div>;
}
