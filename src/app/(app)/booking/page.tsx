import Link from "next/link";
import Icon from "@/components/Icon";
import BookingRow from "@/components/BookingRow";
import { Empty, PageHeader, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { expireStalePending } from "@/lib/online";
import { activeRooms, getStudio, listBookings, type BookingListRow } from "@/lib/data";
import { STATUS_LABEL, addDays, dateWIB, fmtDate, timeWIB, todayWIB } from "@/lib/format";

export const metadata = { title: "Booking" };

type SP = { view?: string; date?: string; status?: string; q?: string; range?: string };

export default async function BookingPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  await expireStalePending();
  const sp = await searchParams;
  const view = sp.view === "daftar" ? "daftar" : "jadwal";
  const today = todayWIB();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  return (
    <>
      <PageHeader title="Booking" subtitle="Jadwal sesi per ruang & daftar semua booking."
        actions={<>
          <Link href="/booking/baru" className="btn btn-primary"><Icon name="plus" className="size-4" /> Walk-in</Link>
          <Link href="/booking/baru?mode=booking" className="btn"><Icon name="calendar" className="size-4" /> Booking</Link>
        </>} />
      <Tabs active={view} items={[
        { key: "jadwal", label: "Jadwal Harian", href: `/booking?view=jadwal&date=${date}` },
        { key: "daftar", label: "Daftar Booking", href: "/booking?view=daftar" },
      ]} />
      {view === "jadwal" ? <Schedule date={date} today={today} /> : <List sp={sp} today={today} />}
    </>
  );
}

async function Schedule({ date, today }: { date: string; today: string }) {
  const [rooms, studio, rows] = await Promise.all([activeRooms(), getStudio(), listBookings({ from: date, to: date })]);
  const live = rows.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const open = Math.floor(toMin(studio.open) / 60) * 60;
  const close = Math.ceil(toMin(studio.close) / 60) * 60;
  const PX = 1.15; // px per menit
  const hours = Array.from({ length: (close - open) / 60 + 1 }, (_, i) => open + i * 60);
  const cols: { id: number | null; name: string; color: string }[] = [...rooms.map((r) => ({ id: r.id, name: r.name, color: r.color })), { id: null, name: "Tanpa ruang", color: "#94a3b8" }]
    .filter((c) => c.id !== null || live.some((b) => b.room_id === null));
  const nowMin = date === today ? toMin(timeWIB(new Date())) : -1;

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/booking?view=jadwal&date=${addDays(date, -1)}`} className="btn !px-3" aria-label="Hari sebelumnya"><Icon name="left" className="size-4" /></Link>
        <form className="flex-1">
          <input type="hidden" name="view" value="jadwal" />
          <input type="date" name="date" defaultValue={date} className="input text-center font-semibold" />
          <noscript><button className="btn">Pergi</button></noscript>
        </form>
        <Link href={`/booking?view=jadwal&date=${addDays(date, 1)}`} className="btn !px-3" aria-label="Hari berikutnya"><Icon name="right" className="size-4" /></Link>
        {date !== today && <Link href="/booking?view=jadwal" className="btn">Hari ini</Link>}
      </div>
      <p className="mb-3 text-sm font-semibold text-muted">{fmtDate(date, { weekday: true })} · {live.length} sesi</p>

      {cols.length === 0 ? <Empty title="Belum ada ruang" hint="Tambahkan ruang di Paket & Ruang agar jadwal bisa ditampilkan." /> : (
        <div className="card overflow-x-auto">
          <div className="flex" style={{ minWidth: 56 + cols.length * 150 }}>
            <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-line bg-panel">
              <div className="h-10 border-b border-line" />
              <div className="relative" style={{ height: (close - open) * PX }}>
                {hours.map((h) => (
                  <span key={h} className="tnum absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-muted" style={{ top: (h - open) * PX }}>
                    {String(h / 60).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
            </div>
            {cols.map((c) => (
              <div key={c.id ?? "none"} className="min-w-[150px] flex-1 border-r border-line last:border-r-0">
                <div className="flex h-10 items-center gap-2 border-b border-line px-3 text-sm font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate">{c.name}</span>
                </div>
                <div className="relative" style={{ height: (close - open) * PX }}>
                  {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: (h - open) * PX }} />)}
                  {nowMin >= open && nowMin <= close && <div className="absolute inset-x-0 z-[5] border-t-2 border-bad" style={{ top: (nowMin - open) * PX }} />}
                  {live.filter((b) => b.room_id === c.id).map((b) => {
                    const s = toMin(timeWIB(b.start_at)), e = Math.max(s + 20, toMin(timeWIB(b.end_at)));
                    return (
                      <Link key={b.id} href={`/booking/${b.id}`}
                        className="absolute inset-x-1 overflow-hidden rounded-lg border-l-4 bg-accentsoft px-2 py-1 text-xs leading-tight transition hover:brightness-95 active:scale-[.98]"
                        style={{ top: (s - open) * PX, height: (e - s) * PX - 2, borderColor: c.color }}>
                        <span className="block truncate font-bold">{b.customer_name}</span>
                        <span className="block truncate text-muted">{timeWIB(b.start_at)}–{timeWIB(b.end_at)} · {b.package_name}</span>
                        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-accent">{STATUS_LABEL[b.status]}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Ketuk blok sesi untuk detail. Garis merah = jam sekarang.</p>
    </>
  );
}

async function List({ sp, today }: { sp: SP; today: string }) {
  const range = sp.range ?? "upcoming";
  const status = sp.status && STATUS_LABEL[sp.status] ? sp.status : "";
  const term = (sp.q ?? "").trim();
  const f = range === "today" ? { from: today, to: today }
    : range === "week" ? { from: today, to: addDays(today, 6) }
    : range === "past" ? { to: addDays(today, -1) }
    : range === "all" ? {} : { from: today };
  const rows = await listBookings({ ...f, status, term, limit: 150, order: range === "past" || range === "all" ? "desc" : "asc" });

  const link = (over: Partial<SP>) => `/booking?${new URLSearchParams({ view: "daftar", range, ...(status ? { status } : {}), ...(term ? { q: term } : {}), ...over } as Record<string, string>)}`;
  const ranges = [["upcoming", "Mendatang"], ["today", "Hari ini"], ["week", "7 hari"], ["past", "Lalu"], ["all", "Semua"]];

  const groups = new Map<string, BookingListRow[]>();
  for (const b of rows) { const d = dateWIB(b.start_at); (groups.get(d) ?? groups.set(d, []).get(d)!).push(b); }

  return (
    <>
      <form className="mb-3 flex gap-2">
        <input type="hidden" name="view" value="daftar" /><input type="hidden" name="range" value={range} />
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={term} placeholder="Cari nama, no. HP, atau kode booking…" className="input !pl-10" />
        </div>
        <button className="btn">Cari</button>
      </form>
      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {ranges.map(([k, l]) => <Link key={k} href={link({ range: k })} className="chip shrink-0" data-on={range === k}>{l}</Link>)}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Link href={link({ status: "" })} className="chip shrink-0" data-on={!status}>Semua status</Link>
        {Object.entries(STATUS_LABEL).map(([k, l]) => <Link key={k} href={link({ status: k })} className="chip shrink-0" data-on={status === k}>{l}</Link>)}
      </div>
      {rows.length === 0 ? <Empty title="Tidak ada booking" hint="Ubah filter atau buat booking baru." /> : (
        <div className="space-y-5">
          {[...groups.entries()].map(([d, items]) => (
            <section key={d}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{d === today ? "Hari ini · " : ""}{fmtDate(d, { weekday: true })}</h2>
              <div className="space-y-2">{items.map((b) => <BookingRow key={b.id} b={b} />)}</div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
