"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Hitung mundur ke `endsAt` (ISO). Saat habis, halaman dimuat ulang agar harga kembali normal. */
export default function Countdown({ endsAt, className = "" }: { endsAt: string; className?: string }) {
  const router = useRouter();
  const end = new Date(endsAt).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [end]);
  useEffect(() => { if (left === 0) router.refresh(); }, [left, router]);

  if (left === null) return <span className={`tnum ${className}`}>--:--:--</span>;
  const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (
    <span className={`tnum inline-flex items-center gap-1 font-bold ${className}`} aria-label="Sisa waktu promo">
      {d > 0 && <><Box v={String(d)} u="hari" /><i className="opacity-60 not-italic">:</i></>}
      <Box v={pad(h)} u="jam" /><i className="opacity-60 not-italic">:</i><Box v={pad(m)} u="mnt" /><i className="opacity-60 not-italic">:</i><Box v={pad(sec)} u="dtk" tick />
    </span>
  );
}

function Box({ v, u, tick }: { v: string; u: string; tick?: boolean }) {
  return (
    <span className="inline-flex flex-col items-center rounded-md bg-black/25 px-1.5 py-0.5 leading-none">
      <span key={tick ? v : undefined} className={tick ? "cd-tick" : ""}>{v}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide opacity-70">{u}</span>
    </span>
  );
}
