import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { checkToken } from "@/lib/auth";
import { q } from "@/lib/db";
import { getSiteData } from "@/lib/siteData";
import { dateWIB, fmtDate, rupiah, timeWIB, waLink } from "@/lib/format";

export const metadata = { title: "Booking Diterima", robots: { index: false, follow: false } };

export default async function DonePage({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const { c = "", t = "" } = await searchParams;
  if (!checkToken(c, t)) notFound();
  const [b] = await q<{ id: number; code: string; start_at: string; end_at: string; status: string; total: number; people: number; customer: string; room: string | null; package_name: string | null; paid: number; option_choice: string }>(
    `select b.option_choice, b.id, b.code, b.start_at, b.end_at, b.status, b.total, b.people, cu.name as customer, r.name as room, p.name as package_name,
            coalesce((select sum(case when y.kind='refund' then -y.amount else y.amount end) from payments y where y.booking_id = b.id and not y.voided),0) as paid
       from bookings b join customers cu on cu.id = b.customer_id left join rooms r on r.id = b.room_id left join packages p on p.id = b.package_id
      where b.code = $1`, [c]);
  if (!b) notFound();
  const { studio, online } = await getSiteData();
  const day = dateWIB(b.start_at);
  const dp = Math.round((b.total * online.dp_percent) / 100);
  const cancelled = b.status === "cancelled";
  const confirmed = b.status === "confirmed" || b.status === "done";

  const msg = `Halo ${studio.name}, saya ${b.customer}. Booking ${b.code} untuk ${fmtDate(day, { weekday: true })} pukul ${timeWIB(b.start_at)}.${online.dp_percent > 0 ? ` Saya ingin konfirmasi DP ${rupiah(dp)}.` : " Mohon konfirmasinya."}`;
  const cal = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE", text: `${b.package_name ?? "Sesi foto"} — ${studio.name}`,
    dates: `${day.replaceAll("-", "")}T${timeWIB(b.start_at).replace(":", "")}00/${dateWIB(b.end_at).replaceAll("-", "")}T${timeWIB(b.end_at).replace(":", "")}00`,
    ctz: "Asia/Jakarta", details: `Kode booking ${b.code}`, location: studio.address || studio.name,
  })}`;

  return (
    <main className="px-4 pb-24 pt-28 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <span className={`pop-in mx-auto grid size-20 place-items-center rounded-full ${cancelled ? "bg-badsoft text-bad" : confirmed ? "bg-oksoft text-ok" : "bg-accentsoft text-accent"}`}>
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d={cancelled ? "M18 6 6 18M6 6l12 12" : "M20 6 9 17l-5-5"} />
            </svg>
          </span>
          <h1 className="font-display mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            {cancelled ? "Booking dibatalkan" : confirmed ? "Booking terkonfirmasi!" : "Booking diterima!"}
          </h1>
          <p className="mt-2 text-muted">
            {cancelled ? "Batas waktu DP terlewati. Silakan buat booking baru." : confirmed ? "Sampai jumpa di studio. Kami tunggu kedatanganmu." : online.dp_percent > 0 ? "Selesaikan DP agar jadwalmu terkunci." : "Tim kami akan segera mengonfirmasi lewat WhatsApp."}
          </p>
        </div>

        <div className="glass mt-8 rounded-3xl p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Kode booking</span>
            <span className="font-display tnum text-lg font-bold">{b.code}</span>
          </div>
          <dl className="space-y-3 text-sm">
            {([
              ["Layanan", b.package_name ?? "—"],
              ...(b.option_choice ? [["Pilihan", b.option_choice] as [string, string]] : []),
              ["Background", b.room ?? "—"],
              ["Tanggal", fmtDate(day, { weekday: true })],
              ["Jam", `${timeWIB(b.start_at)} – ${timeWIB(b.end_at)} WIB`],
              ["Jumlah orang", `${b.people} orang`],
            ] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
          </dl>
          <div className="mt-5 flex items-end justify-between border-t border-line pt-5">
            <span className="font-semibold text-muted">Total</span>
            <span className="font-display text-2xl font-bold">{rupiah(b.total)}</span>
          </div>
        </div>

        {!cancelled && !confirmed && online.dp_percent > 0 && (
          <div className="mt-5 rounded-3xl border-2 border-dashed border-accent/50 bg-accentsoft p-6">
            <p className="font-display text-lg font-semibold">Bayar DP {rupiah(dp)}</p>
            {online.pay_info
              ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{online.pay_info}</p>
              : <p className="mt-2 text-sm">Hubungi kami lewat WhatsApp untuk informasi pembayaran.</p>}
            {online.hold_min > 0 && <p className="mt-3 text-xs text-muted">Jadwal ditahan {Math.round((online.hold_min / 60) * 10) / 10} jam. Tanpa DP, slot akan dilepas otomatis.</p>}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {online.whatsapp && !cancelled && (
            <a href={waLink(online.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-hero btn-glow">
              <Icon name="chat" className="size-5" /> {confirmed ? "Hubungi kami" : "Konfirmasi lewat WhatsApp"}
            </a>
          )}
          {!cancelled && <a href={cal} target="_blank" rel="noopener noreferrer" className="btn btn-hero glass"><Icon name="calendar" className="size-5" /> Tambah ke kalender</a>}
          <Link href={cancelled ? "/book" : "/"} className="btn btn-hero">{cancelled ? "Booking ulang" : "Kembali ke beranda"}</Link>
        </div>
        <p className="mt-6 text-center text-xs text-muted">Simpan halaman ini atau kode booking Anda untuk keperluan perubahan jadwal.</p>
      </div>
    </main>
  );
}
