"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Gallery, GFile } from "@/lib/gallery";
import { waLink } from "@/lib/format";

const thumb = (id: string, w = 700) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;
const full = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w2400`;
const dl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;
const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const Heart = ({ on, className = "size-5" }: { on: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
);
const Ico = ({ d, className = "size-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
  left: "m15 18-6-6 6-6", right: "m9 18 6-6-6-6", x: "M18 6 6 18M6 6l12 12", dl: "M12 3v12m0 0 4-4m-4 4-4-4M4 19h16",
  play: "M8 5v14l11-7z", pause: "M9 5v14M15 5v14", share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14", zoom: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6",
};

function Count({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 900); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

function Tile({ f, i, fav, onFav, onOpen }: { f: GFile; i: number; fav: boolean; onFav: () => void; onOpen: () => void }) {
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-panel2" style={{ animation: `rise .5s ${Math.min(i, 14) * 40}ms cubic-bezier(.2,.8,.2,1) both` }}>
      {!ok && !err && <div className="skeleton absolute inset-0 !rounded-none" style={{ minHeight: 160 }} />}
      <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in text-left" aria-label={`Buka ${f.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(f.driveId)} alt={f.title} loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onLoad={() => setOk(true)} onError={() => setErr(true)}
          className={`w-full transition duration-700 group-hover:scale-[1.03] ${ok ? "opacity-100 blur-0" : "opacity-0 blur-md"} ${err ? "hidden" : ""}`} />
        {err && <div className="grid min-h-40 place-items-center p-4 text-center text-xs text-muted">Pratinjau belum tersedia<br />Ketuk untuk membuka</div>}
        {f.video && <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Ico d={I.play} className="size-6" /></span>}
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2.5 opacity-100 transition duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
        <button type="button" onClick={onFav} aria-pressed={fav} aria-label={fav ? "Lepas favorit" : "Tandai favorit"}
          className={`grid size-9 place-items-center rounded-full backdrop-blur transition active:scale-75 ${fav ? "bg-[#ff3b6b] text-white" : "bg-black/45 text-white hover:bg-black/65"}`}><Heart on={fav} className="size-[18px]" /></button>
        <a href={dl(f.driveId)} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 2500); }} aria-label="Unduh"
          className="grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
          {busy ? <span className="spinner" /> : <Ico d={I.dl} className="size-[18px]" />}
        </a>
      </div>
    </div>
  );
}

export default function GalleryClient({ token, g }: { token: string; g: Gallery }) {
  const [tab, setTab] = useState<"all" | "fav" | number>("all");
  const [favs, setFavs] = useState<Set<number>>(new Set(g.favorites));
  const [open, setOpen] = useState<number | null>(null); // indeks pada daftar tampil
  const [slide, setSlide] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [imgOk, setImgOk] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const touch = useRef<number | null>(null);

  const shown = useMemo(() => g.files.filter((f) => (tab === "all" ? true : tab === "fav" ? favs.has(f.id) : f.albumId === tab)), [g.files, tab, favs]);
  const photos = g.files.filter((f) => !f.video).length, videos = g.files.length - photos;

  const toggleFav = useCallback(async (id: number) => {
    const on = !favs.has(id);
    setFavs((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    try {
      const r = await fetch(`/api/galeri/${token}/fav`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: id, on }) });
      if (!r.ok) throw new Error();
    } catch {
      setFavs((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; }); // batalkan bila gagal
    }
  }, [favs, token]);

  const cur = open !== null ? shown[open] : null;
  const go = useCallback((d: number) => { setZoom(false); setImgOk(false); setOpen((i) => (i === null || !shown.length ? i : (i + d + shown.length) % shown.length)); }, [shown.length]);
  const close = () => { setOpen(null); setSlide(false); setZoom(false); };

  useEffect(() => {
    if (open === null) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === " " ) { e.preventDefault(); setSlide((s) => !s); } };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [open, go]);

  // slideshow: pindah tiap 4 dtk (video tidak ikut diputar otomatis)
  useEffect(() => {
    if (!slide || open === null) return;
    const t = setInterval(() => go(1), 4000);
    return () => clearInterval(t);
  }, [slide, open, go]);

  // pramuat foto berikutnya agar geser terasa instan
  useEffect(() => {
    if (open === null || !shown.length) return;
    const n = shown[(open + 1) % shown.length];
    if (n && !n.video) { const im = new Image(); im.src = full(n.driveId); }
  }, [open, shown]);

  const share = async (f: GFile) => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: g.studio.name, text: `Foto dari ${g.studio.name}`, url }); else { await navigator.clipboard.writeText(url); alert("Link galeri disalin"); } } catch { /* dibatalkan */ }
    void f;
  };

  // ── ulasan ──
  const [rate, setRate] = useState(0);
  const [msg, setMsg] = useState("");
  const [nm, setNm] = useState("");
  const [fb, setFb] = useState<"idle" | "busy" | "done" | "err">(g.reviewed ? "done" : "idle");
  const [fbErr, setFbErr] = useState("");
  async function sendFeedback() {
    if (!rate) { setFbErr("Pilih bintang dulu ya."); return; }
    setFb("busy"); setFbErr("");
    const r = await fetch(`/api/galeri/${token}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: rate, message: msg, name: nm }) }).catch(() => null);
    if (r?.ok) setFb("done"); else { setFb("err"); setFbErr((await r?.json().catch(() => ({})))?.error ?? "Gagal mengirim. Coba lagi."); }
  }

  const favFiles = g.files.filter((f) => favs.has(f.id));
  const waFav = g.studio.phone && favFiles.length
    ? waLink(g.studio.phone, `Halo ${g.studio.name}, ini foto favorit saya (${g.customer.name}):\n${favFiles.map((f) => `• ${f.title}`).join("\n")}`)
    : "";

  if (g.expired) {
    return (
      <main className="gal grid min-h-dvh place-items-center px-6 text-center">
        <div className="aurora" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /></div>
        <div className="relative max-w-sm"><p className="mb-3 text-5xl">⏳</p><h1 className="font-serif-ui text-3xl">Galeri sudah berakhir</h1>
          <p className="mt-3 text-sm text-muted">Masa akses galeri {g.customer.name} telah habis. Hubungi {g.studio.name} untuk membukanya kembali.</p></div>
      </main>
    );
  }

  return (
    <main className="gal relative min-h-dvh">
      <div className="aurora" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /></div>

      {/* hero */}
      <header className="relative mx-auto max-w-6xl px-4 pb-6 pt-10 text-center sm:px-6 sm:pt-16">
        <p className="mb-5 text-sm font-semibold tracking-[.2em] text-muted">{g.studio.name.toUpperCase()}</p>
        <h1 className="font-serif-ui text-4xl sm:text-6xl" style={{ animation: "rise .7s cubic-bezier(.2,.8,.2,1) both" }}>Galeri <span className="text-accent">{g.customer.name}</span></h1>
        {g.note ? <p className="mx-auto mt-4 max-w-xl text-base text-muted" style={{ animation: "rise .7s .1s cubic-bezier(.2,.8,.2,1) both" }}>{g.note}</p>
          : <p className="mx-auto mt-4 max-w-xl text-base text-muted" style={{ animation: "rise .7s .1s cubic-bezier(.2,.8,.2,1) both" }}>Terima kasih sudah berfoto bersama kami. Pilih yang kamu suka, unduh, dan bagikan ✨</p>}
        <div className="mx-auto mt-7 flex max-w-md justify-center gap-3" style={{ animation: "rise .7s .2s cubic-bezier(.2,.8,.2,1) both" }}>
          {[{ n: photos, l: "Foto" }, { n: videos, l: "Video" }, { n: favs.size, l: "Favorit" }].map((s) => (
            <div key={s.l} className="card min-w-24 flex-1 px-3 py-3"><p className="font-serif-ui tnum text-3xl"><Count to={s.n} /></p><p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{s.l}</p></div>
          ))}
        </div>
        {g.expires && <p className="mt-4 text-xs text-muted">Galeri aktif sampai {fmtDay(g.expires)}</p>}
      </header>

      {/* tab album */}
      <nav className="sticky top-0 z-30 border-y border-line bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl" aria-label="Album">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button className="chip shrink-0" data-on={tab === "all"} onClick={() => setTab("all")}>Semua ({g.files.length})</button>
          <button className="chip shrink-0" data-on={tab === "fav"} onClick={() => setTab("fav")}><Heart on={tab === "fav"} className="mr-1 size-3.5" /> Favorit ({favs.size})</button>
          {g.albums.map((a) => (
            <button key={a.id} className="chip shrink-0" data-on={tab === a.id} onClick={() => setTab(a.id)}>{a.date ? fmtDay(a.date) : a.title}</button>
          ))}
          <span className="flex-1" />
          {g.links.filter((l) => /album|folder/i.test(l.title)).slice(0, 1).map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm shrink-0">Unduh semua</a>
          ))}
        </div>
      </nav>

      {/* info sesi */}
      {typeof tab === "number" && g.albums.find((a) => a.id === tab) && (
        <p className="mx-auto max-w-6xl px-4 pt-4 text-center text-sm text-muted sm:px-6">
          {[g.albums.find((a) => a.id === tab)!.pkg, g.albums.find((a) => a.id === tab)!.room, g.albums.find((a) => a.id === tab)!.people ? `${g.albums.find((a) => a.id === tab)!.people} orang` : ""].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* grid */}
      <section className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {shown.length === 0 ? (
          <div className="card mx-auto max-w-md p-8 text-center"><p className="text-4xl">{tab === "fav" ? "🤍" : "📷"}</p>
            <p className="font-serif-ui mt-2 text-2xl">{tab === "fav" ? "Belum ada favorit" : "Belum ada foto"}</p>
            <p className="mt-1 text-sm text-muted">{tab === "fav" ? "Ketuk ikon hati pada foto yang kamu suka." : "Foto akan muncul di sini begitu siap."}</p></div>
        ) : (
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {shown.map((f, i) => <Tile key={f.id} f={f} i={i} fav={favs.has(f.id)} onFav={() => toggleFav(f.id)} onOpen={() => { setImgOk(false); setOpen(i); }} />)}
          </div>
        )}
      </section>

      {/* kirim favorit */}
      {waFav && (
        <div className="sticky bottom-4 z-20 mx-auto w-fit max-w-[92vw]">
          <a href={waFav} target="_blank" rel="noopener noreferrer" className="btn btn-primary shadow-2xl" style={{ animation: "pop .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <Heart on className="size-4" /> Kirim {favFiles.length} favorit ke studio
          </a>
        </div>
      )}

      {/* ulasan */}
      <section className="relative mx-auto max-w-xl px-4 pb-20 pt-10 sm:px-6">
        <div className="card p-6 text-center">
          {fb === "done" ? (
            <div style={{ animation: "pop .5s cubic-bezier(.2,.8,.2,1) both" }}><p className="text-4xl">💙</p><p className="font-serif-ui mt-2 text-2xl">Terima kasih!</p><p className="mt-1 text-sm text-muted">Ulasanmu sangat berarti untuk kami.</p></div>
          ) : (
            <>
              <h2 className="font-serif-ui text-2xl">Bagaimana pengalamanmu?</h2>
              <div className="my-4 flex justify-center gap-1.5" role="radiogroup" aria-label="Beri bintang">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rate === n} aria-label={`${n} bintang`} onClick={() => setRate(n)}
                    className={`text-4xl transition duration-200 hover:scale-125 active:scale-90 ${n <= rate ? "text-[#ffc233]" : "text-line"}`}>★</button>
                ))}
              </div>
              <textarea className="input mb-2" rows={3} maxLength={600} placeholder="Ceritakan kesanmu (opsional)" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <input className="input mb-3" maxLength={60} placeholder="Nama (opsional)" value={nm} onChange={(e) => setNm(e.target.value)} />
              {fbErr && <p className="mb-2 text-sm font-medium text-bad" role="alert">{fbErr}</p>}
              <button className="btn btn-primary btn-block" disabled={fb === "busy"} onClick={sendFeedback}>{fb === "busy" && <span className="spinner" />} Kirim ulasan</button>
            </>
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted">© {g.studio.name} · Link ini khusus untukmu, jangan dibagikan ke sembarang orang.</p>
      </section>

      {/* lightbox */}
      {cur && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label={cur.title} style={{ animation: "fade .2s ease both" }}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touch.current === null || zoom) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
          <div className="flex items-center justify-between gap-2 px-3 py-3 text-white sm:px-5">
            <p className="tnum text-sm font-semibold text-white/80">{(open ?? 0) + 1} / {shown.length}</p>
            <div className="flex items-center gap-1.5">
              <button className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90" onClick={() => setSlide((s) => !s)} aria-label={slide ? "Hentikan slideshow" : "Putar slideshow"}><Ico d={slide ? I.pause : I.play} className="size-[18px]" /></button>
              {!cur.video && <button className={`grid size-10 place-items-center rounded-full transition active:scale-90 ${zoom ? "bg-accent" : "bg-white/10 hover:bg-white/20"}`} onClick={() => setZoom((z) => !z)} aria-label="Perbesar"><Ico d={I.zoom} className="size-[18px]" /></button>}
              <button className={`grid size-10 place-items-center rounded-full transition active:scale-75 ${favs.has(cur.id) ? "bg-[#ff3b6b]" : "bg-white/10 hover:bg-white/20"}`} onClick={() => toggleFav(cur.id)} aria-pressed={favs.has(cur.id)} aria-label="Favorit"><Heart on={favs.has(cur.id)} className="size-[18px]" /></button>
              <a className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90" href={dl(cur.driveId)} onClick={() => { setDlBusy(true); setTimeout(() => setDlBusy(false), 2500); }} aria-label="Unduh">{dlBusy ? <span className="spinner" /> : <Ico d={I.dl} className="size-[18px]" />}</a>
              <button className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90" onClick={() => share(cur)} aria-label="Bagikan"><Ico d={I.share} className="size-[18px]" /></button>
              <button className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90" onClick={close} aria-label="Tutup"><Ico d={I.x} className="size-[18px]" /></button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-2 sm:px-14" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
            {cur.video ? (
              <iframe key={cur.id} title={cur.title} src={`https://drive.google.com/file/d/${cur.driveId}/preview`} allow="autoplay; fullscreen" allowFullScreen className="aspect-video w-full max-w-5xl rounded-xl" />
            ) : (
              <>
                {!imgOk && <span className="spinner absolute size-8 text-white/70" />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={cur.id} src={full(cur.driveId)} alt={cur.title} referrerPolicy="no-referrer" onLoad={() => setImgOk(true)} onClick={() => setZoom((z) => !z)}
                  className={`select-none rounded-lg transition duration-300 ${imgOk ? "opacity-100" : "opacity-0"} ${zoom ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}`}
                  style={zoom ? { width: "min(220vw, 3200px)" } : undefined} draggable={false} />
              </>
            )}
            {shown.length > 1 && (<>
              <button className="absolute left-2 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:scale-90 sm:grid" onClick={() => go(-1)} aria-label="Sebelumnya"><Ico d={I.left} /></button>
              <button className="absolute right-2 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:scale-90 sm:grid" onClick={() => go(1)} aria-label="Berikutnya"><Ico d={I.right} /></button>
            </>)}
          </div>
          <p className="truncate px-4 py-3 text-center text-xs text-white/60">{cur.title}{slide && " · slideshow"}</p>
        </div>
      )}
    </main>
  );
}
