"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Privasi layar: (1) sembunyikan/tampilkan saldo, (2) kunci sesi manual & otomatis.
 *
 * Sembunyikan saldo bekerja di SELURUH halaman tanpa mengubah tiap halaman: semua teks berpola nominal
 * ("Rp 1.250.000", "13,3 jt", "-641 rb") di-mask di DOM (bukan sekadar blur, jadi tidak bisa diblok/disalin),
 * grafik di-blur, dan MutationObserver menjaga halaman yang baru dimuat. Nominal asli hanya disimpan di memori.
 *
 * Kunci sesi benar-benar menghapus cookie sesi di server (/api/lock) — bukan hanya overlay.
 */

const K_HIDE = "fh_hide";            // "1" = saldo sedang disembunyikan
const K_HIDE_DEFAULT = "fh_hide_def"; // "0" = jangan otomatis sembunyikan saat dibuka (default: sembunyikan)
const K_IDLE = "fh_idle";            // menit tidak aktif sebelum terkunci; "0" = nonaktif
const K_ACTIVE = "fh_last_active";
const K_STARTED = "fh_started";
export const IDLE_OPTIONS = [1, 2, 5, 10, 15, 30, 60, 0];
const DEFAULT_IDLE = 10;
const WARN_SECONDS = 15;

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* mode privat */ } };

// Rp 1.250.000 · -Rp 3,5 jt · 13,3 jt · 641,3 rb · 2,4 M (angka ringkas tanpa "Rp" juga)
const RP = /-?\s?Rp\s?-?\d[\d.,]*(?:\s?(?:jt|rb|M|juta|miliar|ribu)\b)?/g;
const COMPACT = /-?\d[\d.,]*\s?(?:jt|rb|M)\b/g;
const HAS_MONEY = /Rp\s?-?\d|\d\s?(?:jt|rb|M)\b/;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "NOSCRIPT"]);

export function applyHidden(hidden: boolean) {
  const el = document.documentElement;
  if (hidden) el.dataset.privacy = "hidden"; else { delete el.dataset.privacy; delete el.dataset.masked; }
}

export function lockNow() {
  try { sessionStorage.setItem("fh_return", location.pathname + location.search); } catch { /* abaikan */ }
  return fetch("/api/lock", { method: "POST", credentials: "same-origin", keepalive: true })
    .catch(() => { /* tetap lanjut ke layar masuk */ })
    .finally(() => { window.location.replace("/login"); });
}

/** Mesin mask: dipasang sekali di Shell. Tidak merender apa pun kecuali banner peringatan kunci otomatis. */
export function PrivacyEngine() {
  const [warn, setWarn] = useState<number | null>(null);
  type El = { nodes: Text[]; orig: string[]; shown: string[] };
  const store = useRef<{ els: Set<Element>; state: WeakMap<Element, El>; attrs: Map<Element, string> }>({
    els: new Set(), state: new WeakMap(), attrs: new Map(),
  });

  // Satu elemen = gabungan semua node teks langsungnya, karena JSX sering memecah "Rp " dan angkanya jadi dua node.
  const maskElement = useCallback((el: Element) => {
    if (SKIP.has(el.tagName) || el.closest("[data-nomask]")) return;
    const nodes = Array.from(el.childNodes).filter((n): n is Text => n.nodeType === Node.TEXT_NODE);
    if (!nodes.length) return;
    const st = store.current.state.get(el);
    let orig: string[];
    if (st && st.nodes.length === nodes.length && st.nodes.every((n, i) => n === nodes[i])) {
      orig = st.orig.slice();
      nodes.forEach((n, i) => { if (n.nodeValue !== st.shown[i]) orig[i] = n.nodeValue ?? ""; }); // React mengganti teks → ambil yang baru
    } else orig = nodes.map((n) => n.nodeValue ?? "");
    const joined = orig.join("");
    // Kartu statistik berisi angka polos ("0", "750") adalah nominal yang diringkas tanpa satuan → mask penuh.
    const bare = el.classList.contains("stat-value") && /^-?[\d.,\s]+$/.test(joined.trim()) && /\d/.test(joined);
    const masked = bare ? "•••••" : HAS_MONEY.test(joined) ? joined.replace(RP, "Rp •••••").replace(COMPACT, "•••••") : joined;
    if (masked === joined) {
      if (st) { nodes.forEach((n, i) => { if (n.nodeValue === st.shown[i]) n.nodeValue = orig[i]; }); store.current.state.delete(el); store.current.els.delete(el); }
      return;
    }
    const shown = nodes.map((_, i) => (i === 0 ? masked : ""));
    nodes.forEach((n, i) => { if (n.nodeValue !== shown[i]) n.nodeValue = shown[i]; });
    store.current.state.set(el, { nodes, orig, shown });
    store.current.els.add(el);
  }, []);

  const maskTree = useCallback((root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) { if (root.parentElement) maskElement(root.parentElement); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const el = root as Element;
    maskElement(el);
    el.querySelectorAll("*").forEach(maskElement);
    // tooltip berisi nominal penuh
    [el, ...Array.from(el.querySelectorAll("[title]"))].forEach((e) => {
      const t = e.getAttribute?.("title") ?? "";
      if (t && HAS_MONEY.test(t) && !store.current.attrs.has(e) && !e.closest("[data-nomask]")) { store.current.attrs.set(e, t); e.setAttribute("title", "Disembunyikan"); }
    });
  }, [maskElement]);

  const unmaskAll = useCallback(() => {
    const st = store.current;
    st.els.forEach((el) => {
      const s = st.state.get(el);
      if (!s) return;
      s.nodes.forEach((n, i) => { if (n.isConnected && n.nodeValue === s.shown[i]) n.nodeValue = s.orig[i]; });
      st.state.delete(el);
    });
    st.els.clear();
    st.attrs.forEach((v, e) => { if (e.isConnected) e.setAttribute("title", v); });
    st.attrs.clear();
  }, []);

  // ── sembunyikan saldo ──
  useEffect(() => {
    let obs: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      maskTree(document.body);
      document.documentElement.dataset.masked = "1";
      obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "characterData") maskTree(m.target);
          else m.addedNodes.forEach((n) => maskTree(n));
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    const stop = () => { obs?.disconnect(); obs = null; unmaskAll(); delete document.documentElement.dataset.masked; };

    const sync = () => {
      const hidden = document.documentElement.dataset.privacy === "hidden";
      if (hidden && !obs) {
        // Tunggu hidrasi React selesai agar tidak bentrok dengan teks server (mismatch).
        if (timer) clearTimeout(timer);
        timer = setTimeout(start, document.readyState === "complete" ? 120 : 600);
      } else if (!hidden && obs) stop();
    };

    // Pembukaan baru (tab/sesi baru) → sembunyikan otomatis bila diaktifkan (default aktif).
    try {
      if (!sessionStorage.getItem(K_STARTED)) {
        sessionStorage.setItem(K_STARTED, "1");
        if (read(K_HIDE_DEFAULT, "1") === "1") { write(K_HIDE, "1"); applyHidden(true); }
      }
    } catch { /* abaikan */ }

    sync();
    const onChange = () => sync();
    window.addEventListener("fh:privacy", onChange);
    return () => { window.removeEventListener("fh:privacy", onChange); obs?.disconnect(); if (timer) clearTimeout(timer); unmaskAll(); };
  }, [maskTree, unmaskAll]);

  // ── kunci otomatis saat tidak aktif ──
  useEffect(() => {
    let locking = false;
    const idleMs = () => Number(read(K_IDLE, String(DEFAULT_IDLE))) * 60000;
    const touch = () => { write(K_ACTIVE, String(Date.now())); setWarn((w) => (w === null ? w : null)); };
    touch();

    const check = () => {
      const ms = idleMs();
      if (!ms || locking) { setWarn(null); return; }
      const left = ms - (Date.now() - Number(read(K_ACTIVE, String(Date.now()))));
      if (left <= 0) { locking = true; lockNow(); }
      else setWarn(left <= WARN_SECONDS * 1000 ? Math.ceil(left / 1000) : null);
    };

    const ev = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    let last = 0;
    const onAct = () => { const n = Date.now(); if (n - last > 1000) { last = n; touch(); } };
    ev.forEach((e) => window.addEventListener(e, onAct, { passive: true }));
    const iv = setInterval(check, 1000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    // Kembali lewat tombol Back/bfcache: periksa ulang ke server (layout akan mengarahkan ke layar kunci bila perlu).
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onShow);

    // Pintasan: Alt+Shift+L = kunci, Alt+Shift+H = sembunyikan/tampilkan saldo
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey) return;
      if (e.code === "KeyL") { e.preventDefault(); lockNow(); }
      else if (e.code === "KeyH") { e.preventDefault(); toggleHidden(); }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      ev.forEach((e) => window.removeEventListener(e, onAct));
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (warn === null) return null;
  return (
    <div role="alert" className="no-print fixed inset-x-0 bottom-20 z-[60] mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full border border-line px-4 py-2.5 text-sm shadow-2xl backdrop-blur-xl md:bottom-6" style={{ background: "var(--nav-bg)" }} data-nomask>
      <span>Terkunci otomatis dalam <b className="tnum">{warn}</b> dtk</span>
      <button className="rounded-full bg-fg px-3 py-1 text-xs font-medium text-bg" onClick={() => { write(K_ACTIVE, String(Date.now())); setWarn(null); }}>Tetap di sini</button>
    </div>
  );
}

export function toggleHidden(force?: boolean) {
  const next = force ?? document.documentElement.dataset.privacy !== "hidden";
  write(K_HIDE, next ? "1" : "0");
  applyHidden(next);
  window.dispatchEvent(new Event("fh:privacy"));
}

const Eye = ({ off }: { off: boolean }) => off ? (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5.5 0 9 6 9 6a15 15 0 0 1-3.1 3.8M6.5 7.6C4 9.3 3 12 3 12s3.5 6 9 6c1.4 0 2.7-.4 3.9-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
) : (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="3" /></svg>
);
const Lock = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const Gear = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
);

const btn = "grid size-9 place-items-center rounded-full border border-line text-muted transition hover:text-fg";

/** Tombol di navbar: mata (sembunyikan saldo), gembok (kunci), perisai (pengaturan privasi). */
export function PrivacyButtons() {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [idle, setIdle] = useState(String(DEFAULT_IDLE));
  const [def, setDef] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setHidden(document.documentElement.dataset.privacy === "hidden");
    sync();
    setIdle(read(K_IDLE, String(DEFAULT_IDLE)));
    setDef(read(K_HIDE_DEFAULT, "1") === "1");
    window.addEventListener("fh:privacy", sync);
    return () => window.removeEventListener("fh:privacy", sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div className="relative flex items-center gap-2" ref={box} data-nomask>
      <button type="button" className={btn} onClick={() => toggleHidden()} aria-pressed={hidden}
        title={hidden ? "Tampilkan saldo (Alt+Shift+H)" : "Sembunyikan saldo (Alt+Shift+H)"} aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}><Eye off={hidden} /></button>
      <button type="button" className={btn} onClick={() => lockNow()} title="Kunci sesi (Alt+Shift+L)" aria-label="Kunci sesi"><Lock /></button>
      <button type="button" className={`${btn} hidden sm:grid`} onClick={() => setOpen((o) => !o)} title="Pengaturan privasi" aria-label="Pengaturan privasi" aria-expanded={open}><Gear /></button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-line p-4 text-sm shadow-2xl backdrop-blur-xl" style={{ background: "var(--panel)" }}>
          <p className="font-display text-sm">Privasi & keamanan</p>
          <label className="mt-3 block">
            <span className="label">Kunci otomatis saat tidak aktif</span>
            <select className="input" value={idle} onChange={(e) => { setIdle(e.target.value); write(K_IDLE, e.target.value); }}>
              {IDLE_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? "Nonaktif" : m === 60 ? "1 jam" : `${m} menit`}</option>)}
            </select>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px]">
            <input type="checkbox" className="mt-0.5 size-4 accent-current" checked={def} onChange={(e) => { setDef(e.target.checked); write(K_HIDE_DEFAULT, e.target.checked ? "1" : "0"); }} />
            <span>Sembunyikan saldo setiap kali Hub dibuka<span className="block text-xs text-muted">Nominal tampil setelah kamu tekan ikon mata.</span></span>
          </label>
          <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
            <li><b className="text-fg">Alt+Shift+L</b> kunci sekarang</li>
            <li><b className="text-fg">Alt+Shift+H</b> sembunyikan / tampilkan saldo</li>
            <li>Kunci menghapus sesi di server: butuh PIN untuk membuka.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
