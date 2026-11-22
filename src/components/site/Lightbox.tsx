"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import Icon from "../Icon";
import { imageSrc } from "@/lib/siteConfig";

export type LightboxItem = { url: string; caption: string; cta?: { href: string; label: string; external?: boolean } };

/** Pratinjau foto layar penuh: panah/Esc di keyboard, geser di layar sentuh, penghitung, dan tombol aksi opsional. */
export default function Lightbox({ items, index, onClose, onGo }: { items: LightboxItem[]; index: number; onClose: () => void; onGo: (d: number) => void }) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const it = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onGo(1); if (e.key === "ArrowLeft") onGo(-1); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [onClose, onGo]);

  // Muat foto sebelah lebih awal agar pindah foto terasa instan.
  useEffect(() => {
    for (const d of [1, -1]) {
      const n = items[(index + d + items.length) % items.length];
      if (n) { const im = new Image(); im.src = imageSrc(n.url); }
    }
  }, [index, items]);

  if (!it) return null;
  return (
    <div className="anim-fade fixed inset-0 z-[60] flex flex-col bg-black/90" onClick={onClose} role="dialog" aria-modal="true" aria-label="Pratinjau foto"
      onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={(e) => {
        const s = touch.current; touch.current = null;
        if (!s) return;
        const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onGo(dx < 0 ? 1 : -1);
      }}>
      <div className="flex items-center justify-between px-4 pt-4 text-white">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-bold tabular-nums">{index + 1} / {items.length}</span>
        <button className="btn !min-h-11 !w-11 !rounded-full !px-0" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Tutup"><Icon name="x" /></button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex items-center justify-center px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={it.url} src={imageSrc(it.url)} alt={it.caption} className="pop-in max-h-full max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
        {items.length > 1 && (
          <>
            <button className="btn absolute left-3 top-1/2 !hidden !min-h-11 !w-11 -translate-y-1/2 !rounded-full !px-0 sm:!inline-flex" onClick={(e) => { e.stopPropagation(); onGo(-1); }} aria-label="Sebelumnya"><Icon name="left" /></button>
            <button className="btn absolute right-3 top-1/2 !hidden !min-h-11 !w-11 -translate-y-1/2 !rounded-full !px-0 sm:!inline-flex" onClick={(e) => { e.stopPropagation(); onGo(1); }} aria-label="Berikutnya"><Icon name="right" /></button>
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 px-4 pb-5 pt-3" onClick={(e) => e.stopPropagation()}>
        {it.caption && <p className="rounded-full bg-black/60 px-4 py-2 text-center text-sm font-semibold text-white">{it.caption}</p>}
        {it.cta && (it.cta.external
          ? <a href={it.cta.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary !rounded-full !px-6">{it.cta.label}</a>
          : <Link href={it.cta.href} className="btn btn-primary !rounded-full !px-6">{it.cta.label}</Link>)}
      </div>
    </div>
  );
}
