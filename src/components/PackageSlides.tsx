"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { imageSrc } from "@/lib/siteConfig";

/**
 * Foto kartu paket: satu foto tampil biasa; beberapa foto menjadi slide otomatis (crossfade + zoom halus),
 * berhenti saat disorot/disentuh atau saat kartu di luar layar, bisa digeser/diketuk titiknya.
 */
export default function PackageSlides({
  urls, name, fit = "cover", x = 50, y = 50, interval = 3800, className = "",
}: { urls: string[]; name: string; fit?: "cover" | "contain"; x?: number; y?: number; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [seen, setSeen] = useState(true);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const n = urls.length;

  useEffect(() => { setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  useEffect(() => {
    if (n < 2 || hold || !seen || reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), interval);
    return () => clearInterval(t);
  }, [n, hold, seen, reduced, interval]);

  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);

  return (
    <div ref={root} className={`relative size-full overflow-hidden ${className}`}
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onTouchStart={(e) => { setHold(true); touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const s = touchX.current; touchX.current = null;
        if (s !== null && n > 1) { const dx = e.changedTouches[0].clientX - s; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }
        setTimeout(() => setHold(false), 2500);
      }}>
      {urls.map((u, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u + k} src={imageSrc(u)} alt={k === 0 ? name : ""} loading={k === 0 ? "lazy" : "lazy"} decoding="async" draggable={false}
          style={{ objectFit: fit, objectPosition: `${x}% ${y}%`, opacity: k === i ? 1 : 0, transform: k === i && !reduced && fit === "cover" ? "scale(1.06)" : "scale(1)",
            transition: "opacity .9s ease, transform 5.5s ease-out", zIndex: k === i ? 1 : 0 }}
          className={`absolute inset-0 size-full ${fit === "contain" ? "bg-panel2 p-2" : ""}`} />
      ))}
      {n > 1 && (<>
        <div className="absolute inset-x-0 top-2.5 z-10 flex justify-center gap-1.5" role="tablist" aria-label="Foto paket">
          {urls.map((_, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Foto ${k + 1}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setI(k); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"}`} />
          ))}
        </div>
        <button type="button" aria-label="Foto sebelumnya" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(-1); }}
          className="absolute left-2 top-1/2 z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition hover:bg-black/65 group-hover:opacity-100 sm:grid">‹</button>
        <button type="button" aria-label="Foto berikutnya" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(1); }}
          className="absolute right-2 top-1/2 z-10 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition hover:bg-black/65 group-hover:opacity-100 sm:grid">›</button>
      </>)}
    </div>
  );
}
