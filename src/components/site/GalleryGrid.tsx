"use client";
import { useCallback, useEffect, useState } from "react";
import Icon from "../Icon";
import Reveal from "./Reveal";
import { imageSrc } from "@/lib/siteConfig";

export default function GalleryGrid({ items }: { items: { url: string; caption: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, go]);

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4">
        {items.map((it, i) => (
          <Reveal key={i} variant={["zoom", "up", "blur"][i % 3] as "zoom" | "up" | "blur"} delay={(i % 3) * 90} className="mb-3 break-inside-avoid sm:mb-4">
          <button type="button" onClick={() => setOpen(i)} className="lift group relative block w-full overflow-hidden rounded-2xl" aria-label={it.caption || `Foto ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(it.url)} alt={it.caption} loading="lazy" className="w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            {it.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-left text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">{it.caption}</span>}
          </button>
          </Reveal>
        ))}
      </div>
      {open !== null && (
        <div className="anim-fade fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc(items[open].url)} alt={items[open].caption} className="pop-in max-h-[85vh] max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          {items[open].caption && <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white">{items[open].caption}</p>}
          <button className="btn absolute right-4 top-4 !min-h-11 !w-11 !rounded-full !px-0" onClick={() => setOpen(null)} aria-label="Tutup"><Icon name="x" /></button>
          {items.length > 1 && (
            <>
              <button className="btn absolute left-3 top-1/2 !min-h-11 !w-11 -translate-y-1/2 !rounded-full !px-0" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Sebelumnya"><Icon name="left" /></button>
              <button className="btn absolute right-3 top-1/2 !min-h-11 !w-11 -translate-y-1/2 !rounded-full !px-0" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Berikutnya"><Icon name="right" /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}
