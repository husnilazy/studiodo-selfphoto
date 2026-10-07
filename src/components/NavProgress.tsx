"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** Garis kemajuan tipis di atas layar: mulai saat link internal diklik, selesai saat halaman baru tampil. */
function Bar() {
  const path = usePathname();
  const sp = useSearchParams();
  const [w, setW] = useState(0);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      stop(); setOn(true); setW(12);
      timer.current = setInterval(() => setW((v) => v + (90 - v) * 0.08), 140);
    };
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); stop(); };
  }, []);

  useEffect(() => {
    if (!timer.current) return;
    stop(); setW(100);
    const t = setTimeout(() => { setOn(false); setW(0); }, 320);
    return () => clearTimeout(t);
  }, [path, sp]);

  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ opacity: on ? 1 : 0, transition: "opacity .3s ease" }}>
      <div className="h-full rounded-r-full bg-accent shadow-[0_0_12px_var(--accent)]" style={{ width: `${w}%`, transition: w === 0 ? "none" : "width .25s ease-out" }} />
    </div>
  );
}

export default function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
