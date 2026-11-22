"use client";
import { useCallback, useState } from "react";
import Reveal from "./Reveal";
import Lightbox, { type LightboxItem } from "./Lightbox";
import { imageSrc } from "@/lib/siteConfig";

/*
 * Mosaik 3 kolom dengan ukuran tile beragam (foto besar 2×2 + foto kecil + foto lebar), tanpa celah kosong.
 * Satu siklus = 8 foto: [2×2][1][1] / [1][1][1] / [1][2×1]. Sisa foto di akhir memakai pola khusus yang tetap penuh.
 */
const BIG = "col-span-2 row-span-2", WIDE = "col-span-2", FULL = "col-span-3", TALL = "row-span-2";
const CYCLE = [BIG, "", "", "", "", "", "", WIDE];
const TAIL: Record<number, string[]> = {
  1: [`${FULL} row-span-2`],
  2: [BIG, TALL],
  3: [BIG, "", ""],
  4: [BIG, "", "", FULL],
  5: [BIG, "", "", "", WIDE],
  6: [BIG, "", "", "", "", ""],
  7: [BIG, "", "", "", "", "", FULL],
};
const tilesFor = (n: number): string[] => {
  const out: string[] = [];
  let left = n;
  while (left >= 8) { out.push(...CYCLE); left -= 8; }
  // 1 foto sisa: bukan spanduk raksasa, tetapi siklus terakhir diganti pola 9 foto [2×2 + 8 kecil] yang tetap penuh.
  if (left === 1 && out.length >= 8) { out.splice(out.length - 8, 8, BIG, ...Array(8).fill("")); left = 0; }
  if (left > 0) out.push(...TAIL[left]);
  return out;
};

/** Galeri mosaik dengan lightbox. Dipakai di beranda dan di halaman Hasil Foto. */
export default function GalleryGrid({ items }: { items: LightboxItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);
  const close = useCallback(() => setOpen(null), []);
  const tiles = tilesFor(items.length);

  return (
    <>
      <div className="grid grid-flow-dense grid-cols-3 gap-2.5 [grid-auto-rows:6.5rem] sm:gap-4 sm:[grid-auto-rows:9.5rem] lg:[grid-auto-rows:11.5rem]">
        {items.map((it, i) => (
          <Reveal key={`${it.url}-${i}`} variant={["zoom", "up", "blur"][i % 3] as "zoom" | "up" | "blur"} delay={(i % 3) * 80} className={`min-h-0 ${tiles[i]}`}>
            <button type="button" onClick={() => setOpen(i)} className="lift group relative block size-full overflow-hidden rounded-2xl sm:rounded-3xl" aria-label={it.caption || `Perbesar foto ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(it.url)} alt={it.caption} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
              {it.caption && <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-panel px-3 py-1 text-[11px] font-semibold text-fg shadow sm:bottom-3 sm:left-3 sm:text-xs">{it.caption}</span>}
            </button>
          </Reveal>
        ))}
      </div>
      {open !== null && <Lightbox items={items} index={open} onClose={close} onGo={go} />}
    </>
  );
}
