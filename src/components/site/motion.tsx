"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Icon from "../Icon";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* Satu loop scroll bersama untuk semua efek parallax (hemat performa). */
type Sub = (vh: number) => void;
const subs = new Set<Sub>();
let queued = false;
function tick() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; const vh = innerHeight; subs.forEach((f) => f(vh)); });
}
function subscribe(f: Sub) {
  if (subs.size === 0) { addEventListener("scroll", tick, { passive: true }); addEventListener("resize", tick); }
  subs.add(f);
  f(innerHeight);
  return () => { subs.delete(f); if (subs.size === 0) { removeEventListener("scroll", tick); removeEventListener("resize", tick); } };
}

/** Konten bergeser lebih lambat/cepat dari scroll. speed>0 = naik lebih lambat (jauh), <0 = lebih cepat (dekat). */
export function Parallax({
  speed = 0.1, rotate = 0, fade = false, className = "", innerClassName = "", style, children,
}: { speed?: number; rotate?: number; fade?: boolean; className?: string; innerClassName?: string; style?: CSSProperties; children?: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i || reduced()) return;
    return subscribe((vh) => {
      const r = o.getBoundingClientRect(); // outer tidak ikut bergeser, jadi pengukuran stabil
      if (r.bottom < -300 || r.top > vh + 300) return;
      const d = r.top + r.height / 2 - vh / 2;
      i.style.transform = `translate3d(0, ${(-d * speed).toFixed(1)}px, 0)${rotate ? ` rotate(${(d * rotate).toFixed(2)}deg)` : ""}`;
      if (fade) i.style.opacity = String(clamp(1 - Math.max(0, -r.top) / (r.height * 0.9), 0, 1));
    });
  }, [speed, rotate, fade]);
  return (
    <div ref={outer} className={className} style={style}>
      <div ref={inner} className={`will-change-transform ${innerClassName}`}>{children}</div>
    </div>
  );
}

/** Area yang bereaksi pada gerak pointer: elemen `.depth` di dalamnya bergeser berlapis (efek kedalaman). */
export function MouseStage({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref} className={className}
      onPointerMove={(e) => {
        if (reduced() || e.pointerType === "touch") return;
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", String(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1).toFixed(3)));
        el.style.setProperty("--my", String(clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1).toFixed(3)));
      }}
      onPointerLeave={() => { ref.current?.style.setProperty("--mx", "0"); ref.current?.style.setProperty("--my", "0"); }}
    >
      {children}
    </div>
  );
}
export const Depth = ({ dx = 20, dy = 14, className = "", children }: { dx?: number; dy?: number; className?: string; children: ReactNode }) => (
  <div className={`depth ${className}`} style={{ ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px` }}>{children}</div>
);

/** Kartu miring 3D mengikuti pointer. */
export function Tilt({ max = 6, className = "", children }: { max?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref} className={`tilt ${className}`}
      onPointerMove={(e) => {
        if (reduced() || e.pointerType === "touch") return;
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
      }}
      onPointerLeave={() => { if (ref.current) ref.current.style.transform = ""; }}
    >
      {children}
    </div>
  );
}

/** Judul yang muncul per kata (naik dari bawah garis). */
export function SplitTitle({ text, delay = 0, gradient = false, immediate = false, className = "" }: { text: string; delay?: number; gradient?: boolean; immediate?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || immediate) return;
    if (typeof IntersectionObserver === "undefined" || reduced()) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span ref={ref} className={`split ${immediate ? "now" : on ? "in" : ""} ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="split-word">
          <span className={gradient ? "grad-text" : ""} style={{ transitionDelay: `${delay + i * 80}ms`, animationDelay: `${delay + i * 80}ms` }}>{w}</span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/** Cahaya mengikuti kursor pada elemen `.spot` (satu listener untuk seluruh halaman). */
export function SpotlightListener() {
  useEffect(() => {
    if (reduced()) return;
    const h = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.(".spot") as HTMLElement | null;
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--sx", `${e.clientX - r.left}px`);
      t.style.setProperty("--sy", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", h, { passive: true });
    return () => document.removeEventListener("pointermove", h);
  }, []);
  return null;
}

/** Teks berjalan yang bereaksi pada kecepatan scroll (makin cepat scroll, makin cepat & miring). */
export function ScrollMarquee({ words }: { words: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el || reduced()) return;
    let raf = 0, last = performance.now(), lastY = scrollY, vel = 0, x = 0;
    const loop = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      const dy = scrollY - lastY; lastY = scrollY;
      vel += (dy - vel) * 0.12;
      const half = el.scrollWidth / 2;
      x -= 0.05 * dt + vel * 0.55;
      if (half > 0) { if (x <= -half) x += half; if (x > 0) x -= half; }
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${clamp(-vel * 0.35, -8, 8).toFixed(2)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const row = [...words, ...words, ...words, ...words];
  return (
    <div aria-hidden className="overflow-hidden border-y border-line/70 py-4">
      <div ref={track} className="flex w-max will-change-transform">
        {[...row, ...row].map((m, i) => (
          <span key={i} className="font-display flex items-center gap-8 px-4 text-xl font-semibold tracking-tight text-muted/80 sm:text-2xl">{m}<span className="size-1.5 rounded-full bg-accent" /></span>
        ))}
      </div>
    </div>
  );
}

/** Akordeon halus (tinggi beranimasi) untuk FAQ. */
export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const on = open === i;
        return (
          <div key={f.q} className={`glass spot rounded-2xl px-6 transition-shadow duration-300 ${on ? "shadow-lg shadow-accent/10" : ""}`}>
            <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-4 py-4 text-left font-semibold">
              {f.q}
              <span className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${on ? "rotate-45 bg-accent text-accentfg" : "bg-accentsoft text-accent"}`}><Icon name="plus" className="size-4" /></span>
            </button>
            <div className="acc" data-open={on}><div><p className="whitespace-pre-line pb-5 leading-relaxed text-muted">{f.a}</p></div></div>
          </div>
        );
      })}
    </div>
  );
}
