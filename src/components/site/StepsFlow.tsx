"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";
import Reveal from "./Reveal";
import { Tilt } from "./motion";

export type FlowStep = { icon: string; title: string; desc: string };

/**
 * Alur langkah beranimasi: begitu terlihat, langkah menyala satu per satu (garis penghubung terisi, ikon "pop",
 * kamera berkedip), lalu berputar ulang selagi terlihat. Arahkan kursor/ketuk kartu untuk menahan sorotan di sana.
 */
export default function StepsFlow({ steps }: { steps: FlowStep[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useRef(false);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [focus, setFocus] = useState(-1); // -1 = belum mulai
  const [hover, setHover] = useState<number | null>(null);
  const n = steps.length;

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (!el) return;
    if (reduce.current || typeof IntersectionObserver === "undefined") { setSeen(true); setFocus(n - 1); return; }
    const io = new IntersectionObserver(([e]) => { setVisible(e.isIntersecting); if (e.isIntersecting) setSeen(true); }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [n]);

  useEffect(() => {
    if (!seen || reduce.current || !visible || hover !== null) return;
    const wait = focus < 0 ? 350 : focus >= n - 1 ? 3400 : 1600;
    const t = setTimeout(() => setFocus((f) => (f >= n - 1 ? 0 : f + 1)), wait);
    return () => clearTimeout(t);
  }, [seen, visible, hover, focus, n]);

  const cur = hover ?? focus;

  return (
    <ol ref={ref} className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => {
        const on = i <= cur, now = i === cur;
        return (
          <li key={s.title} data-on={on} data-cur={now} className="sf-item group relative" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <Reveal delay={i * 110} variant={i % 2 ? "up" : "zoom"} className="h-full">
              <Tilt max={5} className="h-full">
                <div className="sf-card glass spot h-full rounded-3xl p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="sf-ico relative grid size-12 place-items-center rounded-2xl">
                      <Icon name={s.icon} className="relative z-10 size-6" />
                      {s.icon === "camera" && <span aria-hidden className="sf-flash" />}
                    </span>
                    <span className="sf-num font-display text-5xl font-bold">{i + 1}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
                </div>
              </Tilt>
            </Reveal>
            {i < n - 1 && (
              <span aria-hidden className="sf-link pointer-events-none absolute z-0 sm:max-lg:hidden">
                <span className="sf-fill" data-on={i < cur} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
