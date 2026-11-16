"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Gallery, GFile } from "@/lib/gallery";
import { waLink } from "@/lib/format";
import ConfirmHost, { askConfirm } from "@/components/ConfirmHost";

const thumb = (id: string, w = 700) => `https://lh3.googleusercontent.com/d/${id}=w${w}`;
const full = (id: string) => `https://lh3.googleusercontent.com/d/${id}=w2400`;
const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const Heart = ({ on, className = "size-5" }: { on: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
);
const Ico = ({ d, className = "size-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const I = {
  left: "m15 18-6-6 6-6", right: "m9 18 6-6-6-6", x: "M18 6 6 18M6 6l12 12", dl: "M12 3v12m0 0 4-4m-4 4-4-4M4 19h16", check: "M20 6 9 17l-5-5",
  play: "M8 5v14l11-7z", pause: "M9 5v14M15 5v14", share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14", zoom: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6",
  sel: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9",
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

type TileProps = {
  f: GFile; i: number; fav: boolean; selecting: boolean; selected: boolean; dlHref: string;
  onFav: () => void; onOpen: () => void; onToggle: () => void; onLong: () => void; onDl: (name: string) => void;
};

function Tile({ f, i, fav, selecting, selected, dlHref, onFav, onOpen, onToggle, onLong, onDl }: TileProps) {
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(0);
  const [bust, setBust] = useState(0);
  const [dling, setDling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  const start = () => { long.current = false; timer.current = setTimeout(() => { long.current = true; onLong(); }, 520); };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };
  const click = () => { if (long.current) { long.current = false; return; } if (selecting) onToggle(); else onOpen(); };
  const src = thumb(f.driveId) + (bust ? `?r=${bust}` : "");
  const img = useRef<HTMLImageElement>(null);
  // Gambar yang sudah ada di cache bisa selesai dimuat SEBELUM React memasang onLoad (setelah hidrasi) → cek manual.
  useEffect(() => { const el = img.current; if (el?.complete) { if (el.naturalWidth > 0) setOk(true); else setErr((n) => n + 1); } }, []);

  return (
    <div className={`group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl border bg-panel2 transition duration-300 ${selected ? "scale-[.97] border-accent ring-2 ring-accent" : "border-line"}`}
      style={{ animation: `rise .5s ${Math.min(i, 14) * 40}ms cubic-bezier(.2,.8,.2,1) both` }}>
      {!ok && err === 0 && <div className="skeleton absolute inset-0 !rounded-none" style={{ minHeight: 160 }} />}
      <button type="button" onClick={click} onTouchStart={start} onTouchEnd={cancel} onTouchMove={cancel} onContextMenu={(e) => { if (selecting) e.preventDefault(); }}
        className={`block w-full text-left ${selecting ? "cursor-pointer" : "cursor-zoom-in"}`} aria-label={selecting ? `${selected ? "Batal pilih" : "Pilih"} ${f.title}` : `Buka ${f.title}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={img} src={src} alt={f.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false}
          onLoad={() => setOk(true)} onError={() => setErr((n) => n + 1)}
          className={`w-full select-none transition duration-700 group-hover:scale-[1.03] ${ok ? "opacity-100 blur-0" : "opacity-0 blur-md"} ${err ? "hidden" : ""}`} />
        {err > 0 && (
          <div className="grid min-h-40 place-items-center gap-2 p-4 text-center text-xs text-muted">
            <span>Foto belum bisa dimuat</span>
            <span role="button" tabIndex={0} className="btn btn-sm !min-h-8" onClick={(e) => { e.stopPropagation(); setErr(0); setOk(false); setBust(Date.now()); }}>Muat ulang</span>
          </div>
        )}
        {f.video && <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Ico d={I.play} className="size-6" /></span>}
      </button>

      {selecting && (
        <span className={`pointer-events-none absolute left-2.5 top-2.5 grid size-7 place-items-center rounded-full border-2 transition duration-200 ${selected ? "scale-110 border-accent bg-accent text-white" : "border-white/80 bg-black/30 text-transparent"}`}><Ico d={I.check} className="size-4" /></span>
      )}

      {!selecting && (<>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2.5 opacity-100 transition duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
          <button type="button" onClick={onFav} aria-pressed={fav} aria-label={fav ? "Lepas favorit" : "Tandai favorit"}
            className={`grid size-9 place-items-center rounded-full backdrop-blur transition active:scale-75 ${fav ? "bg-[#ff3b6b] text-white" : "bg-black/45 text-white hover:bg-black/65"}`}><Heart on={fav} className="size-[18px]" /></button>
          <a href={dlHref} download onClick={() => { onDl(f.title); setDling(true); setTimeout(() => setDling(false), 2500); }} aria-label={`Unduh ${f.title}`} aria-busy={dling}
            className="grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">{dling ? <span className="spinner" /> : <Ico d={I.dl} className="size-[18px]" />}</a>
        </div>
      </>)}
    </div>
  );
}

export default function GalleryClient({ token, g }: { token: string; g: Gallery }) {
  const [tab, setTab] = useState<"all" | "fav" | number>("all");
  const [favs, setFavs] = useState<Set<number>>(new Set(g.favorites));
  const [open, setOpen] = useState<number | null>(null);
  const [slide, setSlide] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [imgOk, setImgOk] = useState(false);
  const [lbDl, setLbDl] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "bad" | "busy" } | null>(null);
  const [online, setOnline] = useState(true);
  const touch = useRef<number | null>(null);
  const pushed = useRef(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((text: string, tone: "ok" | "bad" | "busy" = "ok", ms = 4200) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNotice({ text, tone });
    if (ms) noteTimer.current = setTimeout(() => setNotice(null), ms);
  }, []);

  const shown = useMemo(() => g.files.filter((f) => (tab === "all" ? true : tab === "fav" ? favs.has(f.id) : f.albumId === tab)), [g.files, tab, favs]);
  const photos = g.files.filter((f) => !f.video).length, videos = g.files.length - photos;
  const dlOne = (id: number) => `/api/galeri/${token}/file/${id}`;

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const toggleFav = useCallback(async (id: number) => {
    const on = !favs.has(id);
    setFavs((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    try {
      const r = await fetch(`/api/galeri/${token}/fav`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: id, on }) });
      if (!r.ok) throw new Error();
    } catch {
      setFavs((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
      say("Favorit belum tersimpan. Periksa koneksimu lalu coba lagi.", "bad");
    }
  }, [favs, token, say]);

  // ── pilih (centang) ──
  const toggleSel = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const startSelecting = (id?: number) => { setSelecting(true); if (id !== undefined) setSel((s) => new Set(s).add(id)); };
  const endSelecting = () => { setSelecting(false); setSel(new Set()); };
  const allShownSelected = shown.length > 0 && shown.every((f) => sel.has(f.id));
  const favSelected = async () => {
    const ids = [...sel].filter((id) => !favs.has(id));
    for (const id of ids) await toggleFav(id);
    say(`${sel.size} foto ditandai favorit`);
  };

  // ── unduh ──
  const trigger = (url: string) => { const a = document.createElement("a"); a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); };
  const dlSingle = (name: string) => say(`Mengunduh ${name}…`, "busy", 3500);
  const dlZip = async (ids: number[] | "all", label: string, count: number) => {
    if (!count) return;
    if (count > 500) { say("Maksimal 500 file per ZIP. Pilih sebagian dulu ya.", "bad"); return; }
    if (count > 80 && !(await askConfirm({ title: `Unduh ${count} file?`, message: "Semuanya dijadikan satu ZIP. Ukurannya bisa besar — pastikan koneksi stabil dan jangan tutup halaman sampai unduhan selesai.", confirmLabel: "Unduh ZIP" }))) return;
    const url = ids === "all"
      ? `/api/galeri/${token}/zip${typeof tab === "number" ? `?album=${tab}` : ""}`
      : `/api/galeri/${token}/zip?ids=${ids.join(",")}`;
    trigger(url);
    say(`Menyiapkan ZIP ${label} (${count} file)… unduhan akan mulai otomatis. Jangan tutup halaman.`, "busy", 9000);
  };
  const downloadAll = () => (tab === "fav" ? dlZip(shown.map((f) => f.id), "favorit", shown.length) : dlZip("all", typeof tab === "number" ? "album ini" : "semua foto", shown.length));

  // ── lightbox + tombol Back tidak lagi keluar dari halaman ──
  const cur = open !== null ? shown[open] : null;
  const openLightbox = (i: number) => {
    setImgOk(false); setOpen(i);
    if (!pushed.current) { try { history.pushState({ ...(history.state ?? {}), gal: 1 }, ""); pushed.current = true; } catch { /* abaikan */ } }
  };
  const close = useCallback(() => {
    setSlide(false); setZoom(false);
    if (pushed.current) { pushed.current = false; try { history.back(); } catch { /* abaikan */ } }
    setOpen(null);
  }, []);
  useEffect(() => {
    const onPop = () => { if (pushed.current) { pushed.current = false; setOpen(null); setSlide(false); setZoom(false); } };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((d: number) => { setZoom(false); setImgOk(false); setOpen((i) => (i === null || !shown.length ? i : (i + d + shown.length) % shown.length)); }, [shown.length]);
  useEffect(() => {
    if (open === null) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === " ") { e.preventDefault(); setSlide((s) => !s); } };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [open, go, close]);
  useEffect(() => { if (!slide || open === null) return; const t = setInterval(() => go(1), 4000); return () => clearInterval(t); }, [slide, open, go]);
  useEffect(() => {
    if (open === null || !shown.length) return;
    const n = shown[(open + 1) % shown.length];
    if (n && !n.video) { const im = new Image(); im.src = full(n.driveId); }
  }, [open, shown]);

  const share = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: g.studio.name, text: `Foto dari ${g.studio.name}`, url }); else { await navigator.clipboard.writeText(url); say("Link galeri disalin"); } } catch { /* dibatalkan */ }
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
    if (r?.ok) setFb("done"); else { setFb("err"); setFbErr((await r?.json().catch(() => ({})))?.error ?? "Gagal mengirim. Periksa koneksi lalu coba lagi."); }
  }

  const favFiles = g.files.filter((f) => favs.has(f.id));
  const waFav = g.studio.phone && favFiles.length
    ? waLink(g.studio.phone, `Halo ${g.studio.name}, ini foto favorit saya (${g.customer.name}):\n${favFiles.map((f) => `• ${f.title}`).join("\n")}`)
    : "";
  const album = typeof tab === "number" ? g.albums.find((a) => a.id === tab) : undefined;

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
      <ConfirmHost />

      {!online && <div role="status" className="sticky top-0 z-40 bg-warn px-4 py-2 text-center text-sm font-semibold text-black">Kamu sedang offline — favorit dan unduhan jalan lagi saat internet kembali.</div>}

      <header className="relative mx-auto max-w-6xl px-4 pb-6 pt-10 text-center sm:px-6 sm:pt-16">
        <p className="mb-5 text-sm font-semibold tracking-[.2em] text-muted">{g.studio.name.toUpperCase()}</p>
        <h1 className="font-serif-ui text-4xl sm:text-6xl" style={{ animation: "rise .7s cubic-bezier(.2,.8,.2,1) both" }}>Galeri <span className="text-accent">{g.customer.name}</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted" style={{ animation: "rise .7s .1s cubic-bezier(.2,.8,.2,1) both" }}>
          {g.note || "Terima kasih sudah berfoto bersama kami. Pilih yang kamu suka, unduh, dan bagikan ✨"}
        </p>
        <div className="mx-auto mt-7 flex max-w-md justify-center gap-3" style={{ animation: "rise .7s .2s cubic-bezier(.2,.8,.2,1) both" }}>
          {[{ n: photos, l: "Foto" }, { n: videos, l: "Video" }, { n: favs.size, l: "Favorit" }].map((s) => (
            <div key={s.l} className="card min-w-24 flex-1 px-3 py-3"><p className="font-serif-ui tnum text-3xl"><Count to={s.n} /></p><p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{s.l}</p></div>
          ))}
        </div>
        {g.expires && <p className="mt-4 text-xs text-muted">Galeri aktif sampai {fmtDay(g.expires)}</p>}
      </header>

      <nav className="sticky top-0 z-30 border-y border-line bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl" aria-label="Album">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button className="chip shrink-0" data-on={tab === "all"} onClick={() => setTab("all")}>Semua ({g.files.length})</button>
          <button className="chip shrink-0" data-on={tab === "fav"} onClick={() => setTab("fav")}><Heart on={tab === "fav"} className="mr-1 size-3.5" /> Favorit ({favs.size})</button>
          {g.albums.map((a) => <button key={a.id} className="chip shrink-0" data-on={tab === a.id} onClick={() => setTab(a.id)}>{a.date ? fmtDay(a.date) : a.title}</button>)}
          <span className="min-w-2 flex-1" />
          {shown.length > 0 && (<>
            <button className={`btn btn-sm shrink-0 ${selecting ? "!border-accent !text-accent" : ""}`} onClick={() => (selecting ? endSelecting() : startSelecting())} aria-pressed={selecting}><Ico d={I.sel} className="size-4" /> {selecting ? "Selesai" : "Pilih"}</button>
            <button className="btn btn-sm shrink-0" onClick={downloadAll}><Ico d={I.dl} className="size-4" /> Unduh semua ({shown.length})</button>
          </>)}
        </div>
      </nav>

      {album && <p className="mx-auto max-w-6xl px-4 pt-4 text-center text-sm text-muted sm:px-6">{[album.pkg, album.room, album.people ? `${album.people} orang` : ""].filter(Boolean).join(" · ")}</p>}

      <section className="relative mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6">
        {shown.length === 0 ? (
          <div className="card mx-auto max-w-md p-8 text-center"><p className="text-4xl">{tab === "fav" ? "🤍" : "📷"}</p>
            <p className="font-serif-ui mt-2 text-2xl">{tab === "fav" ? "Belum ada favorit" : "Belum ada foto"}</p>
            <p className="mt-1 text-sm text-muted">{tab === "fav" ? "Ketuk ikon hati pada foto yang kamu suka." : "Foto akan muncul di sini begitu siap."}</p></div>
        ) : (
          <>
            {selecting && <p className="mb-3 text-center text-sm text-muted">Ketuk foto untuk memilih. Tahan lama pada foto untuk mulai memilih dari mana saja.</p>}
            <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
              {shown.map((f, i) => (
                <Tile key={f.id} f={f} i={i} fav={favs.has(f.id)} selecting={selecting} selected={sel.has(f.id)} dlHref={dlOne(f.id)}
                  onFav={() => toggleFav(f.id)} onOpen={() => openLightbox(i)} onToggle={() => toggleSel(f.id)} onLong={() => startSelecting(f.id)} onDl={dlSingle} />
              ))}
            </div>
          </>
        )}
        {g.links.length > 0 && <p className="mt-6 text-center text-xs text-muted">Lebih suka folder? {g.links.slice(0, 2).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="mr-2 font-semibold text-accent">{l.title}</a>)}</p>}
      </section>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-3 py-3 backdrop-blur-xl" style={{ animation: "rise .3s cubic-bezier(.2,.8,.2,1) both", paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <p className="tnum text-sm font-semibold">{sel.size} dipilih</p>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-sm" onClick={() => setSel(allShownSelected ? new Set() : new Set(shown.map((f) => f.id)))}>{allShownSelected ? "Lepas semua" : `Pilih semua (${shown.length})`}</button>
              <button className="btn btn-sm" disabled={!sel.size} onClick={favSelected}><Heart on={false} className="size-4" /> Favorit</button>
              <button className="btn btn-sm btn-primary" disabled={!sel.size} onClick={() => dlZip([...sel], "terpilih", sel.size)}><Ico d={I.dl} className="size-4" /> Unduh {sel.size || ""} (ZIP)</button>
              <button className="btn btn-sm" onClick={endSelecting} aria-label="Selesai memilih"><Ico d={I.x} className="size-4" /></button>
            </div>
          </div>
        </div>
      )}

      {waFav && !selecting && (
        <div className="sticky bottom-4 z-20 mx-auto w-fit max-w-[92vw]">
          <a href={waFav} target="_blank" rel="noopener noreferrer" className="btn btn-primary shadow-2xl" style={{ animation: "pop .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <Heart on className="size-4" /> Kirim {favFiles.length} favorit ke studio
          </a>
        </div>
      )}

      <section className="relative mx-auto max-w-xl px-4 pb-20 pt-6 sm:px-6">
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
              <button className="btn btn-primary btn-block" disabled={fb === "busy"} onClick={sendFeedback}>{fb === "busy" && <span className="spinner" />} {fb === "busy" ? "Mengirim…" : "Kirim ulasan"}</button>
            </>
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted">© {g.studio.name} · Link ini khusus untukmu, jangan dibagikan ke sembarang orang.</p>
      </section>

      {notice && (
        <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-24 z-[60] mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-2xl border border-line bg-[color-mix(in_oklab,var(--panel)_94%,transparent)] px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl" style={{ animation: "pop .3s cubic-bezier(.2,.8,.2,1) both" }}>
          {notice.tone === "busy" ? <span className="spinner shrink-0 text-accent" /> : <span className={notice.tone === "bad" ? "text-bad" : "text-ok"}>{notice.tone === "bad" ? "⚠" : "✓"}</span>}
          <span>{notice.text}</span>
          <button className="ml-1 text-muted hover:text-fg" onClick={() => setNotice(null)} aria-label="Tutup pemberitahuan"><Ico d={I.x} className="size-4" /></button>
        </div>
      )}

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
              <a className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90" href={dlOne(cur.id)} download onClick={() => { dlSingle(cur.title); setLbDl(true); setTimeout(() => setLbDl(false), 2500); }} aria-label="Unduh" aria-busy={lbDl}>{lbDl ? <span className="spinner" /> : <Ico d={I.dl} className="size-[18px]" />}</a>
              <button className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-90" onClick={share} aria-label="Bagikan"><Ico d={I.share} className="size-[18px]" /></button>
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
