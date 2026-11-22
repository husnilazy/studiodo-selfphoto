"use client";
import Link from "next/link";
import { useState } from "react";
import GalleryGrid from "./GalleryGrid";
import Reveal from "./Reveal";
import Icon from "../Icon";

export type ConceptGroup = {
  key: string; name: string; description: string; priceText: string; meta: string;
  bookHref: string; // "" = tidak ada tombol aksi untuk grup ini
  ctaLabel?: string; external?: boolean; // paket sewa event: tombol "Tanya sewa" ke WhatsApp (tautan luar)
  photos: { url: string; caption: string }[];
};

/** Galeri dikelompokkan per paket/konsep, dengan chip filter dan tombol "Booking konsep ini" di tiap grup. */
export default function ConceptGallery({ groups }: { groups: ConceptGroup[] }) {
  const [active, setActive] = useState("all");
  const shown = active === "all" ? groups : groups.filter((g) => g.key === active);

  return (
    <div>
      {groups.length > 1 && (
        <div className="hscroll -mx-4 mb-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" role="tablist" aria-label="Filter konsep">
          {[{ key: "all", name: "Semua" }, ...groups].map((g) => (
            <button key={g.key} role="tab" aria-selected={active === g.key} onClick={() => setActive(g.key)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors ${active === g.key ? "border-transparent bg-accent text-accentfg shadow" : "border-line bg-panel text-muted hover:text-fg"}`}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-8 sm:space-y-10">
        {shown.map((g) => (
          <section key={g.key} id={`konsep-${g.key}`} className="scroll-mt-28 rounded-[1.75rem] border border-line bg-panel p-4 sm:rounded-[2rem] sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-9">
              <Reveal variant="up" className="lg:sticky lg:top-28 lg:self-start">
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{g.name}</h2>
                {g.description && <p className="mt-3 text-muted">{g.description}</p>}
                {(g.priceText || g.meta) && <p className="mt-3 text-sm font-semibold text-muted">{[g.priceText, g.meta].filter(Boolean).join(" · ")}</p>}
                {g.bookHref && (g.external
                  ? <a href={g.bookHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5 !rounded-full !px-6">{g.ctaLabel ?? "Booking konsep ini"} <Icon name="right" className="size-4" /></a>
                  : <Link href={g.bookHref} className="btn btn-primary mt-5 !rounded-full !px-6">{g.ctaLabel ?? "Booking konsep ini"} <Icon name="right" className="size-4" /></Link>)}
              </Reveal>
              <GalleryGrid items={g.photos.map((p) => ({ ...p, ...(g.bookHref ? { cta: { href: g.bookHref, label: g.ctaLabel ? `${g.ctaLabel}: ${g.name}` : `Booking ${g.name}`, external: g.external } } : {}) }))} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
