"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { ActionButton } from "@/components/ActionForm";
import { effectiveWindow, fmtClock, stateOf, type LiveBooking, type LivePayload, type LiveState } from "@/lib/live";
import { rupiah, timeWIB } from "@/lib/format";
import { extendSession, finishSession, markNoShow, startSession } from "@/app/actions/live";

const hhmm = (ms: number) => timeWIB(new Date(ms));

export default function LiveBoard({ initial }: { initial: LivePayload }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(Date.parse(initial.serverNow));
  const offset = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [updated, setUpdated] = useState(Date.parse(initial.serverNow));

  const apply = useCallback((p: LivePayload) => {
    offset.current = Date.parse(p.serverNow) - Date.now();
    setData(p);
    setUpdated(Date.now() + offset.current);
  }, []);

  useEffect(() => { apply(initial); }, [initial, apply]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let live = true;
    const poll = async () => {
      if (document.hidden) return;
      try { const r = await fetch("/api/live", { cache: "no-store" }); if (r.ok && live) apply(await r.json()); } catch { /* jaringan putus: coba lagi nanti */ }
    };
    const t = setInterval(poll, 15000);
    document.addEventListener("visibilitychange", poll);
    return () => { live = false; clearInterval(t); document.removeEventListener("visibilitychange", poll); };
  }, [apply]);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const withState = useMemo(() => data.bookings.map((b) => ({ b, s: stateOf(b, now) })), [data.bookings, now]);
  const by = (...s: LiveState[]) => withState.filter((x) => s.includes(x.s));
  const running = by("running", "overtime");
  const soon = by("soon");
  const attention = by("late", "missed");
  const upcoming = by("upcoming").sort((a, b) => Date.parse(a.b.start_at) - Date.parse(b.b.start_at)).slice(0, 8);
  const done = by("done");
  const clock = new Date(now);
  const hh = timeWIB(clock);
  const sec = String(Math.floor(((now / 1000) % 60 + 60) % 60)).padStart(2, "0");

  const roomCols = [...data.rooms, ...(data.bookings.some((b) => b.room_id === null) ? [{ id: 0, name: "Tanpa ruang", color: "#94a3b8" }] : [])];

  return (
    <div ref={box} className={full ? "min-h-dvh overflow-auto bg-bg p-6" : ""}>
      <div className="anim-rise mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-ok"><span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-ok" /></span> LIVE · diperbarui otomatis</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Monitoring Sesi</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-display tnum text-4xl font-semibold tracking-tight sm:text-5xl">{hh}<span className="text-2xl text-muted">:{sec}</span></p>
          <button className="btn btn-sm" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())} aria-label="Layar penuh"><Icon name="layout" className="size-4" /> {full ? "Keluar" : "Layar penuh"}</button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Berlangsung" n={running.length} tone="ok" pulse />
        <Count label="Segera tiba" n={soon.length} tone="accent" />
        <Count label="Perlu tindakan" n={attention.length} tone={attention.length ? "bad" : undefined} />
        <Count label="Selesai hari ini" n={done.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roomCols.map((r) => {
          const mine = withState.filter((x) => (r.id === 0 ? x.b.room_id === null : x.b.room_id === r.id));
          const cur = mine.filter((x) => x.s === "running" || x.s === "overtime").sort((a, b) => Date.parse(b.b.start_at) - Date.parse(a.b.start_at))[0];
          const nxt = mine.filter((x) => x.s === "soon" || x.s === "upcoming").sort((a, b) => Date.parse(a.b.start_at) - Date.parse(b.b.start_at))[0];
          return <RoomCard key={r.id} room={r} cur={cur} nxt={nxt} now={now} />;
        })}
      </div>

      {attention.length > 0 && (
        <Section title="Perlu tindakan" tone="bad">
          {attention.map(({ b, s }) => (
            <Row key={b.id} b={b} sub={s === "missed" ? `Lewat jadwal ${hhmm(Date.parse(b.end_at))} — belum dimulai` : `Jadwal ${hhmm(Date.parse(b.start_at))} — belum konfirmasi / belum hadir`}>
              <ActionButton action={startSession.bind(null, b.id)} className="btn btn-sm btn-primary">Mulai</ActionButton>
              <ActionButton action={markNoShow.bind(null, b.id)} confirm="Tandai tidak hadir?" className="btn btn-sm">Tidak hadir</ActionButton>
              {s === "missed" && <ActionButton action={finishSession.bind(null, b.id)} className="btn btn-sm">Tandai selesai</ActionButton>}
            </Row>
          ))}
        </Section>
      )}

      {(soon.length > 0 || upcoming.length > 0) && (
        <Section title="Antrean berikutnya">
          {[...soon, ...upcoming].map(({ b, s }) => (
            <Row key={b.id} b={b} sub={`${hhmm(Date.parse(b.start_at))} · ${s === "soon" ? `mulai ${Math.max(1, Math.ceil((Date.parse(b.start_at) - now) / 60000))} menit lagi` : "terjadwal"}`}>
              {s === "soon" && <ActionButton action={startSession.bind(null, b.id)} className="btn btn-sm btn-primary">Mulai sekarang</ActionButton>}
            </Row>
          ))}
        </Section>
      )}

      {done.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-bold text-muted">Selesai hari ini ({done.length})</summary>
          <div className="mt-3 space-y-2">
            {done.map(({ b }) => <Row key={b.id} b={b} sub={`${hhmm(Date.parse(b.start_at))}–${hhmm(Date.parse(b.end_at))}`} />)}
          </div>
        </details>
      )}
      <p className="mt-6 text-center text-xs text-muted">Terakhir disinkronkan {hhmm(updated)}:{String(new Date(updated).getUTCSeconds()).padStart(2, "0")} · Daftar sesi memuat ulang tiap 15 detik</p>
    </div>
  );
}

function Count({ label, n, tone, pulse }: { label: string; n: number; tone?: "ok" | "bad" | "accent"; pulse?: boolean }) {
  const c = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : tone === "accent" ? "text-accent" : "";
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`font-display tnum mt-1 flex items-center gap-2 text-3xl font-semibold ${c}`}>{n}{pulse && n > 0 && <span className="size-2 animate-pulse rounded-full bg-ok" />}</p>
    </div>
  );
}

function RoomCard({ room, cur, nxt, now }: { room: { id: number; name: string; color: string }; cur?: { b: LiveBooking; s: LiveState }; nxt?: { b: LiveBooking; s: LiveState }; now: number }) {
  const w = cur ? effectiveWindow(cur.b) : null;
  const remain = w ? w.end - now : 0;
  const pct = w ? Math.max(0, Math.min(100, ((now - w.start) / (w.end - w.start)) * 100)) : 0;
  const over = cur?.s === "overtime" || remain < 0;
  const warn = !over && remain < 5 * 60000;
  const manual = !!cur?.b.started_at;
  return (
    <section className={`card anim-rise relative overflow-hidden p-5 transition-shadow ${cur ? (over ? "ring-2 ring-bad/60" : "ring-1 ring-ok/40") : ""}`}>
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: room.color }} />
      <div className="mb-3 flex items-center justify-between gap-2 pl-2">
        <h2 className="font-display truncate font-semibold">{room.name}</h2>
        {cur ? <span className={`badge ${over ? "badge-red" : "badge-green"}`}><span className={`size-1.5 rounded-full ${over ? "bg-bad" : "bg-ok"} animate-pulse`} />{over ? "LEWAT WAKTU" : "BERLANGSUNG"}</span>
          : nxt?.s === "soon" ? <span className="badge badge-indigo">SEGERA</span> : <span className="badge badge-slate">KOSONG</span>}
      </div>

      {cur && w ? (
        <div className="pl-2">
          <Link href={`/booking/${cur.b.id}`} className="block"><p className="truncate text-lg font-bold">{cur.b.customer_name}</p>
            <p className="truncate text-sm text-muted">{cur.b.package_name ?? "Tanpa paket"} · {cur.b.people} orang</p></Link>
          <p className={`font-display tnum mt-4 text-5xl font-semibold tracking-tight ${over ? "text-bad" : warn ? "text-warn" : ""}`}>{fmtClock(remain)}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">{over ? "melebihi jadwal" : "sisa waktu"} · {hhmm(w.start)}–{hhmm(w.end)}{manual ? " (mulai manual)" : ""}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel2"><div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${over ? "bg-bad" : warn ? "bg-warn" : "bg-ok"}`} style={{ width: `${over ? 100 : pct}%` }} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!manual && <ActionButton action={startSession.bind(null, cur.b.id)} className="btn btn-sm btn-primary">Mulai sekarang</ActionButton>}
            <ActionButton action={extendSession.bind(null, cur.b.id, 10)} className="btn btn-sm">+10 mnt</ActionButton>
            <ActionButton action={extendSession.bind(null, cur.b.id, 15)} className="btn btn-sm">+15 mnt</ActionButton>
            <ActionButton action={finishSession.bind(null, cur.b.id)} className="btn btn-sm btn-primary">Selesai</ActionButton>
            {!manual && <ActionButton action={markNoShow.bind(null, cur.b.id)} confirm="Tandai tidak hadir?" className="btn btn-sm btn-danger">Tidak hadir</ActionButton>}
          </div>
          {cur.b.total - cur.b.paid > 0 && <p className="mt-3 rounded-xl bg-warnsoft px-3 py-2 text-xs font-bold text-warn">Belum lunas: {rupiah(cur.b.total - cur.b.paid)} — <Link href={`/booking/${cur.b.id}`} className="underline">terima pembayaran</Link></p>}
        </div>
      ) : (
        <div className="pl-2">
          <p className="font-display text-3xl font-semibold text-ok">{nxt?.s === "soon" ? "Siap-siap" : "Tersedia"}</p>
          {nxt ? (
            <p className="mt-2 text-sm text-muted">Berikutnya <b className="text-fg">{hhmm(Date.parse(nxt.b.start_at))}</b> · {nxt.b.customer_name}<br />{nxt.b.package_name}</p>
          ) : <p className="mt-2 text-sm text-muted">Tidak ada sesi berikutnya hari ini.</p>}
          {nxt?.s === "soon" && <div className="mt-4"><ActionButton action={startSession.bind(null, nxt.b.id)} className="btn btn-sm btn-primary">Mulai sekarang</ActionButton></div>}
        </div>
      )}
    </section>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "bad"; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className={`mb-2 text-xs font-bold uppercase tracking-[.18em] ${tone === "bad" ? "text-bad" : "text-muted"}`}>{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ b, sub, children }: { b: LiveBooking; sub: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-wrap items-center gap-3 p-3.5">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: b.room_color ?? "var(--line)" }} />
      <Link href={`/booking/${b.id}`} className="min-w-0 flex-1 basis-48">
        <p className="truncate font-semibold">{b.customer_name} <span className="font-normal text-muted">· {b.room_name ?? "tanpa ruang"}</span></p>
        <p className="truncate text-xs text-muted">{b.package_name} · {sub}</p>
      </Link>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
