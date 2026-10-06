"use client";
import { useEffect, useRef, useState } from "react";

function parse(v: string) {
  const m = /^(\D*?)(\d[\d.,]*)(.*)$/.exec(v.trim());
  if (!m) return null;
  let raw = m[2];
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return { pre: m[1], n, post: m[3], dec: raw.includes(".") ? raw.split(".")[1].length : 0 };
}

/** Angka yang menghitung naik saat terlihat. Nilai non-angka ditampilkan apa adanya. */
export default function CountUp({ value }: { value: string }) {
  const p = parse(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [cur, setCur] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !p) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setCur(p.n); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        setCur(p.n * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  if (!p) return <span>{value}</span>;
  return <span ref={ref} className="tnum">{p.pre}{cur.toLocaleString("id-ID", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec })}{p.post}</span>;
}
