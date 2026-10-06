"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../Icon";
import { createPublicBooking } from "@/app/actions/public";
import { CATEGORY_LABEL, addDays, addMin, fmtDate, rupiah } from "@/lib/format";
import { roomGradient } from "@/lib/siteUtils";

type Pkg = { id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string };
type Room = { id: number; name: string; color: string; description: string; image_url: string };
type Addon = { id: number; name: string; price: number };
type Slot = { t: string; rooms: number[] };

const STEPS = ["Layanan", "Jadwal", "Detail", "Konfirmasi"];
const DAY = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function BookingWizard({
  packages, rooms, addons, studioName, dpPercent, today, maxDate, initialPackage, initialRoom,
}: {
  packages: Pkg[]; rooms: Room[]; addons: Addon[]; studioName: string; dpPercent: number;
  today: string; maxDate: string; initialPackage: number | null; initialRoom: number | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialPackage ? 1 : 0);
  const [dir, setDir] = useState<"f" | "b">("f");
  const [pkgId, setPkgId] = useState<number | null>(initialPackage);
  const [roomId, setRoomId] = useState<number | null>(initialRoom);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [people, setPeople] = useState(1);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const pkg = packages.find((p) => p.id === pkgId) ?? null;
  const total = (pkg?.price ?? 0) + addons.reduce((s, a) => s + (qty[a.id] ?? 0) * a.price, 0);
  const dp = Math.round((total * dpPercent) / 100);

  // Hari yang bisa dipilih (maks 45 hari ke depan dalam strip).
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = today; d <= maxDate && out.length < 45; d = addDays(d, 1)) out.push(d);
    return out;
  }, [today, maxDate]);

  useEffect(() => {
    if (!pkgId) return;
    let live = true;
    setSlots(null);
    fetch(`/api/public/slots?date=${date}&package=${pkgId}${roomId ? `&room=${roomId}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { slots: Slot[] }) => { if (live) { setSlots(j.slots); setTime((t) => (j.slots.some((s) => s.t === t) ? t : "")); } })
      .catch(() => live && setSlots([]));
    return () => { live = false; };
  }, [pkgId, roomId, date, nonce]);

  const go = (n: number) => {
    setDir(n > step ? "f" : "b");
    setStep(n);
    setError("");
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const canNext = [
    !!pkg,
    !!pkg && !!time,
    name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 9,
    true,
  ][step];

  async function submit() {
    if (!pkg || busy) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.set("package_id", String(pkg.id)); fd.set("date", date); fd.set("time", time);
    if (roomId) fd.set("room_id", String(roomId));
    fd.set("people", String(people)); fd.set("name", name); fd.set("phone", phone); fd.set("notes", notes); fd.set("website", hp);
    for (const [id, q] of Object.entries(qty)) if (q > 0) fd.set(`addon_${id}`, String(q));
    const r = await createPublicBooking(fd);
    if (r.ok) { router.push(r.redirect); return; }
    setBusy(false); setError(r.error);
    if (/terisi|jam/i.test(r.error)) { setTime(""); setNonce((n) => n + 1); go(1); }
  }

  const grouped = Object.entries(CATEGORY_LABEL).map(([k, label]) => ({ k, label, items: packages.filter((p) => p.category === k) })).filter((g) => g.items.length);
  const roomName = roomId ? rooms.find((r) => r.id === roomId)?.name : "Bebas (dipilihkan)";

  return (
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-24">
      {/* Indikator langkah */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-sm">
          <Link href="/" className="inline-flex items-center gap-1 font-semibold text-muted hover:text-fg"><Icon name="left" className="size-4" /> Beranda</Link>
          <span className="font-semibold text-muted">Langkah {step + 1} dari {STEPS.length}</span>
        </div>
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-2">
              <span className="h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-accent transition-all duration-700" style={{ width: i <= step ? "100%" : "0%" }} /></span>
              <span className={`hidden text-xs font-bold transition-colors sm:block ${i <= step ? "text-fg" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div key={step} className={dir === "f" ? "step-in" : "step-back"}>
        {step === 0 && (
          <section>
            <Heading t="Pilih layanan" d="Pilih paket yang sesuai kebutuhanmu." />
            {grouped.map((g) => (
              <div key={g.k} className="mb-7">
                <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-accent">{g.label}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {g.items.map((p) => {
                    const on = p.id === pkgId;
                    return (
                      <button key={p.id} type="button" onClick={() => { setPkgId(p.id); setPeople((c) => Math.min(c, p.max_people)); }}
                        className={`glass lift relative overflow-hidden rounded-2xl p-5 text-left ${on ? "!border-accent ring-2 ring-accent/40" : ""}`}>
                        {on && <span className="pop-in absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-accent text-accentfg"><Icon name="check" className="size-4" /></span>}
                        <p className="font-display pr-8 text-lg font-semibold leading-tight">{p.name}</p>
                        <p className="mt-1 text-sm text-muted">{p.duration_min} menit · hingga {p.max_people} orang</p>
                        {(p.description || p.includes) && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description || p.includes}</p>}
                        <p className="font-display mt-3 text-xl font-bold text-accent">{rupiah(p.price)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 1 && pkg && (
          <section>
            <Heading t="Background & jadwal" d={`${pkg.name} · ${pkg.duration_min} menit`} />
            {rooms.length > 0 && (
              <div className="mb-8">
                <p className="mb-3 text-sm font-bold">Background / tema</p>
                <div className="hscroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                  <RoomCard on={roomId === null} onClick={() => setRoomId(null)} name="Bebas" sub="Kami pilihkan yang kosong" bg="linear-gradient(135deg, var(--accent), var(--accent-2))" />
                  {rooms.map((r) => <RoomCard key={r.id} on={roomId === r.id} onClick={() => setRoomId(r.id)} name={r.name} sub={r.description} bg={roomGradient(r.color)} img={r.image_url} />)}
                </div>
              </div>
            )}

            <p className="mb-3 text-sm font-bold">Tanggal</p>
            <div className="hscroll -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00Z`), on = d === date;
                return (
                  <button key={d} type="button" onClick={() => setDate(d)}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition-all duration-300 ${on ? "scale-105 border-transparent bg-accent text-accentfg shadow-lg shadow-accent/30" : "glass hover:border-accent"}`}>
                    <span className="text-[11px] font-bold uppercase opacity-80">{d === today ? "Hari ini" : DAY[dt.getUTCDay()]}</span>
                    <span className="font-display text-2xl font-semibold">{dt.getUTCDate()}</span>
                    <span className="text-[11px] opacity-80">{fmtDate(d, { short: true }).split(" ")[1]}</span>
                  </button>
                );
              })}
            </div>
            <label className="mb-7 flex items-center gap-3 text-sm text-muted">
              Atau pilih tanggal lain
              <input type="date" className="input !min-h-10 !w-auto" min={today} max={maxDate} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>

            <p className="mb-3 text-sm font-bold">Jam mulai <span className="font-normal text-muted">· {fmtDate(date, { weekday: true })}</span></p>
            {slots === null ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton h-11" />)}</div>
            ) : slots.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Tidak ada jam kosong di tanggal ini. Coba tanggal atau background lain.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map((s, i) => (
                  <button key={s.t} type="button" onClick={() => setTime(s.t)} style={{ animation: `rise .4s ${Math.min(i, 12) * 25}ms both` }}
                    className={`min-h-11 rounded-xl border text-sm font-bold transition-all duration-200 ${time === s.t ? "scale-105 border-transparent bg-accent text-accentfg shadow-lg shadow-accent/30" : "glass hover:border-accent"}`}>
                    {s.t}
                  </button>
                ))}
              </div>
            )}
            {time && <p className="pop-in mt-4 text-sm font-semibold text-ok">✓ {time} – {addMin(time, pkg.duration_min)} WIB</p>}
          </section>
        )}

        {step === 2 && pkg && (
          <section>
            <Heading t="Data kamu" d="Kami akan menghubungi lewat WhatsApp." />
            <div className="glass space-y-4 rounded-3xl p-5 sm:p-7">
              <label className="block"><span className="label">Nama lengkap</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="mis. Dewi Lestari" /></label>
              <label className="block"><span className="label">Nomor WhatsApp</span><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="08xxxxxxxxxx" /></label>
              <div>
                <span className="label">Jumlah orang</span>
                <div className="flex items-center gap-3">
                  <Stepper onClick={() => setPeople((p) => Math.max(1, p - 1))}>−</Stepper>
                  <span className="font-display w-10 text-center text-2xl font-semibold">{people}</span>
                  <Stepper onClick={() => setPeople((p) => Math.min(pkg.max_people, p + 1))}>+</Stepper>
                  <span className="text-sm text-muted">maks {pkg.max_people}</span>
                </div>
              </div>
              <label className="block"><span className="label">Catatan (opsional)</span><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tema, permintaan khusus, dll." /></label>
              <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={hp} onChange={(e) => setHp(e.target.value)} />
            </div>

            {addons.length > 0 && (
              <div className="glass mt-5 rounded-3xl p-5 sm:p-7">
                <p className="font-display mb-3 font-semibold">Tambahan (opsional)</p>
                <div className="divide-y divide-line">
                  {addons.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div><p className="font-semibold">{a.name}</p><p className="text-sm text-accent">{rupiah(a.price)}</p></div>
                      <div className="flex items-center gap-2">
                        <Stepper onClick={() => setQty((q) => ({ ...q, [a.id]: Math.max(0, (q[a.id] ?? 0) - 1) }))}>−</Stepper>
                        <span className="w-6 text-center font-bold">{qty[a.id] ?? 0}</span>
                        <Stepper onClick={() => setQty((q) => ({ ...q, [a.id]: Math.min(20, (q[a.id] ?? 0) + 1) }))}>+</Stepper>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {step === 3 && pkg && (
          <section>
            <Heading t="Periksa & kirim" d="Pastikan semuanya sudah benar." />
            <div className="glass rounded-3xl p-5 sm:p-7">
              <dl className="space-y-3 text-sm">
                <Row k="Layanan" v={pkg.name} />
                <Row k="Background" v={roomName ?? "—"} />
                <Row k="Tanggal" v={fmtDate(date, { weekday: true })} />
                <Row k="Jam" v={`${time} – ${addMin(time, pkg.duration_min)} WIB`} />
                <Row k="Jumlah orang" v={`${people} orang`} />
                <Row k="Atas nama" v={`${name} · ${phone}`} />
                {addons.filter((a) => (qty[a.id] ?? 0) > 0).map((a) => <Row key={a.id} k={`${a.name} ×${qty[a.id]}`} v={rupiah(a.price * qty[a.id])} />)}
              </dl>
              <div className="mt-5 flex items-end justify-between border-t border-line pt-5">
                <span className="font-semibold text-muted">Total</span>
                <span className="font-display text-3xl font-bold">{rupiah(total)}</span>
              </div>
              {dpPercent > 0 && (
                <p className="mt-4 rounded-2xl bg-accentsoft p-4 text-sm"><b>DP {dpPercent}% = {rupiah(dp)}</b> untuk mengunci jadwal. Petunjuk pembayaran muncul setelah booking dikirim.</p>
              )}
            </div>
          </section>
        )}
      </div>

      {error && <p role="alert" className="pop-in mt-5 rounded-2xl bg-badsoft px-4 py-3 text-sm font-semibold text-bad">{error}</p>}

      {/* Bilah aksi */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line/70 glass pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          {step > 0 && <button type="button" className="btn !rounded-full" onClick={() => go(step - 1)} disabled={busy}><Icon name="left" className="size-4" /> <span className="hidden sm:inline">Kembali</span></button>}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{pkg ? pkg.name : "Belum memilih"}</p>
            <p className="font-display tnum truncate text-lg font-bold">{rupiah(total)}</p>
          </div>
          {step < 3 ? (
            <button type="button" disabled={!canNext} onClick={() => go(step + 1)} className="btn btn-primary btn-glow !rounded-full !px-7">Lanjut <Icon name="right" className="size-4" /></button>
          ) : (
            <button type="button" disabled={busy} onClick={submit} className="btn btn-primary btn-glow !rounded-full !px-7">
              {busy && <span className="spinner" />} Kirim Booking
            </button>
          )}
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-muted">Dengan mengirim booking, Anda setuju dihubungi {studioName} lewat WhatsApp terkait pesanan ini.</p>
    </div>
  );
}

function Heading({ t, d }: { t: string; d: string }) {
  return <div className="mb-6"><h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t}</h1><p className="mt-1 text-muted">{d}</p></div>;
}
function Stepper({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="btn !min-h-10 !w-10 !rounded-full !px-0 text-lg">{children}</button>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>;
}
function RoomCard({ on, onClick, name, sub, bg, img }: { on: boolean; onClick: () => void; name: string; sub?: string; bg: string; img?: string }) {
  return (
    <button type="button" onClick={onClick} className={`lift group relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl text-left sm:w-44 ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-110" />
      ) : <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110" style={{ background: bg }} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
      {on && <span className="pop-in absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-white text-accent"><Icon name="check" className="size-4" /></span>}
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="font-display text-sm font-semibold leading-tight">{name}</p>
        {sub && <p className="mt-0.5 line-clamp-1 text-[11px] text-white/80">{sub}</p>}
      </div>
    </button>
  );
}
