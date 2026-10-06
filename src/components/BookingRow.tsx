import Link from "next/link";
import { Badge } from "./ui";
import type { BookingListRow } from "@/lib/data";
import { STATUS_LABEL, STATUS_TONE, dateWIB, fmtDate, rupiah, timeWIB } from "@/lib/format";

export default function BookingRow({ b, showDate = false }: { b: BookingListRow; showDate?: boolean }) {
  const due = b.total - b.paid;
  const open = b.status === "pending" || b.status === "confirmed" || b.status === "done";
  return (
    <Link href={`/booking/${b.id}`} className="card anim-rise flex items-center gap-3 p-3.5 transition active:scale-[.985] hover:border-accent sm:p-4">
      <div className="w-14 shrink-0 text-center">
        <p className="font-display tnum text-lg font-semibold leading-none">{timeWIB(b.start_at)}</p>
        <p className="mt-1 text-[11px] text-muted">{showDate ? fmtDate(dateWIB(b.start_at), { short: true }) : `s/d ${timeWIB(b.end_at)}`}</p>
      </div>
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: b.room_color ?? "var(--line)" }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{b.customer_name}</p>
        <p className="truncate text-xs text-muted">{b.package_name ?? "Tanpa paket"}{b.room_name && ` · ${b.room_name}`} · {b.people} org</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
        {open && (due <= 0 ? <span className="text-xs font-semibold text-ok">Lunas</span> : <span className="tnum text-xs font-semibold text-warn">Sisa {rupiah(due)}</span>)}
      </div>
    </Link>
  );
}
