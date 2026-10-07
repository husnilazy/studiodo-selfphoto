"use client";
import { useEffect, useMemo, useState } from "react";
import ActionForm from "./ActionForm";
import CustomerPicker from "./CustomerPicker";
import MoneyInput from "./MoneyInput";
import Icon from "./Icon";
import { createBooking, updateBooking } from "@/app/actions/bookings";
import { CATEGORY_LABEL, METHOD_LABEL, SOURCE_LABEL, addMin, rupiah } from "@/lib/format";
import { packageTotal, parseOptions, priceSuffix, roomAllowed, unitsFor } from "@/lib/packageUtils";

type Pkg = { id: number; name: string; category: string; price: number; duration_min: number; max_people: number; per_person: boolean; option_label: string; options: string; room_ids: number[] };
type Room = { id: number; name: string; color: string };
type Addon = { id: number; name: string; price: number };
export type BookingInit = {
  id: number; customer: { id: number; name: string; phone: string }; package_id: number | null; room_id: number | null;
  date: string; time: string; people: number; source: string; discount: number; notes: string;
  addons: Record<number, number>; custom_name: string; custom_price: number; option_choice: string;
};
type Busy = { code: string; start: string; end: string };

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export default function BookingForm({
  packages, rooms, addons, studio, mode, booking, today, nowTime, initialCustomer,
}: {
  packages: Pkg[]; rooms: Room[]; addons: Addon[];
  studio: { open: string; close: string; slot: number };
  mode: "new" | "walkin" | "edit"; booking?: BookingInit; today: string; nowTime: string;
  initialCustomer?: { id: number; name: string; phone: string } | null;
}) {
  const edit = mode === "edit";
  const walkin = mode === "walkin";
  const [pkgId, setPkgId] = useState<number | null>(booking ? booking.package_id : null);
  const [roomId, setRoomId] = useState<number | "">(booking?.room_id ?? rooms[0]?.id ?? "");
  const [date, setDate] = useState(booking?.date ?? today);
  const [time, setTime] = useState(booking?.time ?? (walkin ? nowTime : ""));
  const [people, setPeople] = useState(booking?.people ?? 1);
  const [option, setOption] = useState(booking?.option_choice ?? "");
  const [qty, setQty] = useState<Record<number, number>>(booking?.addons ?? {});
  const [discount, setDiscount] = useState(booking?.discount ?? 0);
  const [customPrice, setCustomPrice] = useState(booking?.custom_price ?? 0);
  const [payFull, setPayFull] = useState(walkin);
  const [dp, setDp] = useState(0);
  const [busy, setBusy] = useState<Busy[]>([]);

  const pkg = packages.find((p) => p.id === pkgId) ?? null;
  const duration = pkg?.duration_min ?? 30;

  useEffect(() => {
    if (!roomId) { setBusy([]); return; }
    let live = true;
    const url = `/api/availability?date=${date}&room=${roomId}${booking ? `&exclude=${booking.id}` : ""}`;
    fetch(url).then((r) => r.json()).then((j: Busy[]) => live && setBusy(j)).catch(() => live && setBusy([]));
    return () => { live = false; };
  }, [date, roomId, booking]);

  const slots = useMemo(() => {
    const out: string[] = [];
    const open = toMin(studio.open), close = toMin(studio.close);
    for (let t = open; t + duration <= close; t += studio.slot) {
      out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
    return out;
  }, [studio, duration]);

  const clash = (t: string) => {
    const s = toMin(t), e = s + duration;
    return busy.find((b) => s < toMin(b.end) && e > toMin(b.start));
  };
  const myClash = time ? clash(time) : undefined;

  const subtotal = (pkg ? packageTotal(pkg, people) : 0)
    + addons.reduce((s, a) => s + (qty[a.id] ?? 0) * a.price, 0) + customPrice;
  const disc = Math.min(discount, subtotal);
  const total = subtotal - disc;
  const paying = edit ? 0 : payFull ? total : Math.min(dp, total);

  const action = edit ? updateBooking.bind(null, booking!.id) : createBooking;
  const grouped = Object.entries(CATEGORY_LABEL).map(([k, label]) => ({ k, label, items: packages.filter((p) => p.category === k) })).filter((g) => g.items.length);

  return (
    <ActionForm action={action} submit={edit ? "Simpan Perubahan" : walkin ? "Simpan Transaksi" : "Simpan Booking"} className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <Card n={1} title="Customer">
          {edit ? (
            <p className="rounded-xl bg-panel2 px-3 py-2.5 font-semibold">{booking!.customer.name} <span className="text-sm font-normal text-muted">{booking!.customer.phone}</span></p>
          ) : <CustomerPicker initial={initialCustomer} />}
        </Card>

        <Card n={2} title="Paket">
          {packages.length === 0 && <p className="text-sm text-muted">Belum ada paket aktif. Tambahkan dulu di menu Paket &amp; Ruang.</p>}
          {grouped.map((g) => (
            <div key={g.k} className="mb-3 last:mb-0">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{g.label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.items.map((p) => (
                  <label key={p.id} className="cursor-pointer">
                    <input type="radio" name="package_id" value={p.id} checked={pkgId === p.id} onChange={() => {
                      setPkgId(p.id); setPeople((c) => Math.min(c, p.max_people)); setOption("");
                      const ok = p.room_ids.length ? rooms.filter((r) => p.room_ids.includes(r.id)) : rooms;
                      setRoomId((cur) => (cur !== "" && ok.some((r) => r.id === cur) ? cur : (ok[0]?.id ?? "")));
                    }} className="peer sr-only" />
                    <span className="flex h-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line bg-panel p-3 transition peer-checked:border-accent peer-checked:bg-accentsoft peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                      <span className="min-w-0">
                        <span className="block font-semibold leading-tight">{p.name}</span>
                        <span className="block text-xs text-muted">{p.duration_min} menit · maks {p.max_people} orang</span>
                      </span>
                      <span className="tnum shrink-0 font-bold text-accent">{rupiah(p.price)}<span className="text-xs font-semibold text-muted"> {priceSuffix(p)}</span></span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </Card>

        <Card n={3} title="Jadwal">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Tanggal</span>
              <input type="date" name="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block"><span className="label">Jumlah orang</span>
              <div className="flex items-center gap-2">
                <Step onClick={() => setPeople((p) => Math.max(1, p - 1))}>−</Step>
                <input name="people" readOnly value={people} className="input tnum text-center font-semibold" />
                <Step onClick={() => setPeople((p) => Math.min(pkg?.max_people ?? 99, p + 1))}>+</Step>
              </div>
            </label>
          </div>

          {pkg && parseOptions(pkg.options).length > 0 && (
            <div className="mt-4">
              <span className="label">{pkg.option_label || "Pilihan"}</span>
              <div className="flex flex-wrap gap-2">
                {parseOptions(pkg.options).map((o) => (
                  <label key={o} className="cursor-pointer">
                    <input type="radio" name="option_choice" value={o} checked={option === o} onChange={() => setOption(o)} className="peer sr-only" />
                    <span className="chip peer-checked:!border-transparent peer-checked:!bg-accent peer-checked:!text-accentfg">{o}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {rooms.length > 0 && (
            <div className="mt-4">
              <span className="label">Ruang / background</span>
              <div className="flex flex-wrap gap-2">
                {rooms.filter((r) => !pkg || roomAllowed(pkg, r.id)).map((r) => (
                  <label key={r.id} className="cursor-pointer">
                    <input type="radio" name="room_id" value={r.id} checked={roomId === r.id} onChange={() => setRoomId(r.id)} className="peer sr-only" />
                    <span className="chip gap-2 peer-checked:!border-transparent peer-checked:!bg-accent peer-checked:!text-accentfg">
                      <span className="size-2.5 rounded-full" style={{ background: r.color }} />{r.name}
                    </span>
                  </label>
                ))}
                {(!pkg || pkg.room_ids.length === 0) && <label className="cursor-pointer">
                  <input type="radio" name="room_id" value="" checked={roomId === ""} onChange={() => setRoomId("")} className="peer sr-only" />
                  <span className="chip peer-checked:!border-transparent peer-checked:!bg-accent peer-checked:!text-accentfg">Tanpa ruang</span>
                </label>}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="mb-1 flex items-end justify-between">
              <span className="label !mb-0">Jam mulai {time && <span className="font-normal normal-case">· selesai {addMin(time, duration)}</span>}</span>
              {roomId !== "" && busy.length > 0 && <span className="text-xs font-medium text-warn">{busy.length} sesi terisi hari ini</span>}
            </div>
            <input type="time" name="time" className="input mb-2" required value={time} onChange={(e) => setTime(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {slots.map((t) => (
                <button type="button" key={t} className="chip !min-h-9 !px-3" data-on={time === t} disabled={!!clash(t)} onClick={() => setTime(t)}>{t}</button>
              ))}
            </div>
            {myClash && (
              <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-badsoft px-3 py-2 text-sm font-medium text-bad">
                <Icon name="alert" className="size-4" /> Bentrok dengan {myClash.code} ({myClash.start}–{myClash.end}) di ruang ini.
              </p>
            )}
          </div>
        </Card>

        {addons.length > 0 && (
          <Card n={4} title="Add-on & Cetak">
            <div className="divide-y divide-line">
              {addons.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="tnum text-xs text-muted">{rupiah(a.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Step onClick={() => setQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))}>−</Step>
                    <input name={`addon_${a.id}`} readOnly value={qty[a.id] ?? 0} className="input tnum !w-14 text-center font-semibold" />
                    <Step onClick={() => setQty((q) => ({ ...q, [a.id]: (q[a.id] ?? 0) + 1 }))}>+</Step>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card n={addons.length > 0 ? 5 : 4} title="Lainnya">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Item tambahan (opsional)</span>
              <input name="custom_name" className="input" defaultValue={booking?.custom_name} placeholder="mis. Sewa properti" />
            </label>
            <label className="block"><span className="label">Harga item</span>
              <MoneyInput name="custom_price" defaultValue={booking?.custom_price} onValue={setCustomPrice} />
            </label>
            <label className="block"><span className="label">Diskon</span>
              <MoneyInput name="discount" defaultValue={booking?.discount} onValue={setDiscount} />
            </label>
            <label className="block"><span className="label">Sumber</span>
              <select name="source" className="input" defaultValue={booking?.source ?? (walkin ? "walkin" : "whatsapp")}>
                {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-3 block"><span className="label">Catatan</span>
            <textarea name="notes" className="input" defaultValue={booking?.notes} placeholder="Permintaan khusus, tema, dll." />
          </label>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-4">
          <p className="font-display mb-3 font-semibold">Ringkasan</p>
          <dl className="space-y-1.5 text-sm">
            <Row k={pkg ? (pkg.per_person ? `${pkg.name} × ${unitsFor(pkg, people)} orang` : pkg.name) : "Paket"} v={rupiah(pkg ? packageTotal(pkg, people) : 0)} />
            {addons.filter((a) => (qty[a.id] ?? 0) > 0).map((a) => <Row key={a.id} k={`${a.name} ×${qty[a.id]}`} v={rupiah(a.price * qty[a.id])} />)}
            {customPrice > 0 && <Row k="Item tambahan" v={rupiah(customPrice)} />}
            {disc > 0 && <Row k="Diskon" v={`− ${rupiah(disc)}`} tone="text-ok" />}
          </dl>
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold text-muted">Total</span>
            <span className="font-display tnum text-2xl font-bold">{rupiah(total)}</span>
          </div>
        </div>

        {!edit && (
          <div className="card space-y-3 p-4">
            <p className="font-display font-semibold">Pembayaran</p>
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Bayar lunas sekarang
              <input type="checkbox" name="pay_full" checked={payFull} onChange={(e) => setPayFull(e.target.checked)} className="size-5 accent-[var(--accent)]" />
            </label>
            {!payFull && (
              <label className="block"><span className="label">DP diterima (opsional)</span>
                <MoneyInput name="dp_amount" onValue={setDp} />
              </label>
            )}
            {paying > 0 && (
              <label className="block"><span className="label">Metode</span>
                <select name="pay_method" className="input" defaultValue="cash">
                  {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            )}
            <label className="block"><span className="label">Status booking</span>
              <select name="status" className="input" defaultValue={walkin ? "done" : "confirmed"}>
                <option value="pending">Menunggu (belum DP)</option>
                <option value="confirmed">Terkonfirmasi</option>
                <option value="done">Selesai</option>
              </select>
            </label>
            <div className="flex items-center justify-between rounded-xl bg-panel2 px-3 py-2 text-sm">
              <span className="font-semibold text-muted">Sisa tagihan</span>
              <span className="tnum font-bold">{rupiah(total - paying)}</span>
            </div>
          </div>
        )}
      </aside>
    </ActionForm>
  );
}

function Card({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card anim-rise p-4 sm:p-5">
      <h2 className="font-display mb-3 flex items-center gap-2.5 font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-accent text-xs text-accentfg">{n}</span>{title}
      </h2>
      {children}
    </section>
  );
}
function Step({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="btn !min-h-11 !w-11 shrink-0 !px-0 text-lg">{children}</button>;
}
function Row({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return <div className="flex justify-between gap-3"><dt className="truncate text-muted">{k}</dt><dd className={`tnum shrink-0 font-semibold ${tone}`}>{v}</dd></div>;
}
