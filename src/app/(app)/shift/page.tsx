import Link from "next/link";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTime, rupiah } from "@/lib/format";
import { getOpenShift, lastClosingCash, shiftTotals, type Shift } from "@/lib/shift";
import { CloseShiftForm, OpenShiftForm, ShiftExpenseForm } from "./ShiftForms";

export const metadata = { title: "Shift Kasir" };

export default async function ShiftPage() {
  await requireUser();
  const open = await getOpenShift();
  const [history, cats, last] = await Promise.all([
    q<Shift>(`select s.*, u.name as opener, c.name as closer from shifts s left join users u on u.id = s.opened_by left join users c on c.id = s.closed_by
               where s.closed_at is not null order by s.closed_at desc limit 30`),
    q<{ id: number; name: string }>("select id, name from accounts where type = 'expense' and active and code <> '5190' order by code"),
    lastClosingCash(),
  ]);
  const t = open ? await shiftTotals(open.id, Number(open.opening_cash)) : null;
  const moves = open ? await q<{ id: number; amount: number; kind: string; note: string; created_at: string }>("select id, amount, kind, note, created_at from shift_moves where shift_id = $1 and not voided order by id desc", [open.id]) : [];

  return (
    <>
      <PageHeader title="Shift Kasir" subtitle="Buka & tutup laci kas. Semua uang tunai, QRIS, dan transfer tercatat per shift." />

      {!open || !t ? (
        <div className="card anim-rise mb-6 flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-warnsoft text-warn"><Icon name="lock" className="size-7" /></span>
          <p className="font-display text-lg font-semibold">Shift belum dibuka</p>
          <p className="max-w-sm text-sm text-muted">Transaksi pembayaran baru hanya bisa dicatat setelah shift dibuka. Hitung uang kembalian di laci, lalu buka shift.</p>
          <Sheet title="Buka Shift" trigger={<button className="btn btn-primary"><Icon name="clock" className="size-4" /> Buka Shift</button>}>
            <OpenShiftForm suggested={last} />
          </Sheet>
        </div>
      ) : (
        <>
          <div className="card anim-rise mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="flex items-center gap-2 font-display font-semibold"><Badge tone="green">Shift #{open.id} berjalan</Badge></p>
              <p className="mt-1 text-sm text-muted">Dibuka {fmtDateTime(open.opened_at)} oleh {open.opener ?? "—"}{open.open_note && ` · ${open.open_note}`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Sheet title="Kas Keluar dari Laci" trigger={<button className="btn"><Icon name="wallet" className="size-4" /> Kas Keluar</button>}>
                <ShiftExpenseForm cats={cats} />
              </Sheet>
              <Sheet title="Tutup Shift" trigger={<button className="btn btn-primary"><Icon name="lock" className="size-4" /> Tutup Shift</button>}>
                <CloseShiftForm expected={t.expected} />
              </Sheet>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Modal awal" value={rupiah(Number(open.opening_cash))} icon="dollar" i={0} />
            <Stat label="Penjualan tunai" value={rupiah(t.cash)} icon="wallet" tone="ok" i={1} />
            <Stat label="QRIS" value={rupiah(t.qris)} icon="chat" tone="accent" i={2} />
            <Stat label="Transfer" value={rupiah(t.transfer)} icon="link" tone="accent" i={3} />
          </div>
          <div className="card anim-rise mb-6 p-4 sm:p-5">
            <h2 className="font-display mb-3 font-semibold">Uang tunai yang seharusnya ada di laci</h2>
            <dl className="space-y-1.5 text-sm">
              <Row k="Modal awal" v={rupiah(Number(open.opening_cash))} />
              <Row k="+ Penjualan tunai" v={rupiah(t.cash)} />
              {t.cashIn > 0 && <Row k="+ Uang masuk laci (modal/lainnya)" v={rupiah(t.cashIn)} />}
              <Row k="− Uang keluar laci" v={rupiah(t.cashOut)} />
            </dl>
            <div className="mt-3 flex justify-between border-t border-line pt-3">
              <span className="font-semibold">Seharusnya di laci</span>
              <span className="font-display tnum text-lg font-bold">{rupiah(t.expected)}</span>
            </div>
            {moves.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
                {moves.map((m) => <li key={m.id} className="flex justify-between gap-3 py-2"><span className="truncate text-muted">{fmtDateTime(m.created_at)} · {m.note}</span><span className={`tnum font-semibold ${m.kind === "in" ? "text-ok" : "text-bad"}`}>{m.kind === "in" ? "+" : "−"}{rupiah(m.amount)}</span></li>)}
              </ul>
            )}
          </div>
        </>
      )}

      <h2 className="font-display mb-3 font-semibold">Riwayat shift</h2>
      {history.length === 0 ? <p className="text-sm text-muted">Belum ada shift yang ditutup.</p> : (
        <div className="card divide-y divide-line">
          {history.map((s) => (
            <Link key={s.id} href={`/shift/${s.id}`} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-panel2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold">Shift #{s.id} · {s.opener ?? "—"}</p>
                <p className="text-xs text-muted">{fmtDateTime(s.opened_at)} → {s.closed_at && fmtDateTime(s.closed_at)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="tnum font-bold">{rupiah(Number(s.sales_cash) + Number(s.sales_qris) + Number(s.sales_transfer))}</p>
                <p className="text-xs text-muted">total masuk</p>
              </div>
              <Badge tone={Number(s.difference) === 0 ? "green" : "amber"}>{Number(s.difference) === 0 ? "Pas" : `Selisih ${rupiah(Number(s.difference))}`}</Badge>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="tnum font-semibold">{v}</dd></div>;
}
