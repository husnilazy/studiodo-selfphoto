"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "../Icon";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";

type P = { id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string; per_person: boolean; bookable_online: boolean };

const BLURB: Record<string, string> = {
  self_photo: "Foto sendiri di studio, atur pose dan ekspresimu sepuasnya.",
  photobox: "Photobox bertema, cepat, seru, dan hasilnya langsung jadi.",
  photobooth: "Photobooth untuk acara: pernikahan, ulang tahun, hingga gathering.",
  wisuda: "Abadikan hari kelulusanmu dengan retouch profesional.",
  keluarga: "Foto keluarga dan pas foto resmi dengan hasil rapi.",
  lainnya: "Layanan lainnya.",
};

export default function PackageTabs({ packages, bookingOpen }: { packages: P[]; bookingOpen: boolean }) {
  const cats = [...new Set(packages.map((p) => p.category))];
  const [cat, setCat] = useState(cats[0] ?? "self_photo");
  const list = packages.filter((p) => p.category === cat);
  if (!packages.length) return <p className="text-center text-muted">Paket segera hadir.</p>;

  return (
    <div>
      <div className="hscroll -mx-4 mb-8 flex justify-start gap-2 overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:px-0">
        <div className="glass inline-flex gap-1 rounded-full p-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${cat === c ? "bg-accent text-accentfg shadow-lg shadow-accent/30" : "text-muted hover:text-fg"}`}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <p key={`blurb-${cat}`} className="step-in mb-6 text-center text-muted">{BLURB[cat]}</p>

      <div key={cat} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, i) => (
          <article key={p.id} className="step-in glass lift group flex flex-col overflow-hidden rounded-3xl" style={{ animationDelay: `${i * 70}ms` }}>
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} loading="lazy" className="h-44 w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="relative h-24 overflow-hidden" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 28%, transparent), color-mix(in oklab, var(--accent-2) 22%, transparent))" }}>
                <Icon name="camera" className="absolute -bottom-4 -right-2 size-24 -rotate-12 text-accent/20 transition-transform duration-700 group-hover:rotate-0" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-6">
              <h3 className="font-display text-xl font-semibold leading-tight">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.duration_min} menit · hingga {p.max_people} orang</p>
              {(p.description || p.includes) && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {[p.description, ...p.includes.split(/\n|,/)].map((t) => t.trim()).filter(Boolean).slice(0, 5).map((t) => (
                    <li key={t} className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent" /><span>{t}</span></li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                <p className="font-display text-2xl font-bold tracking-tight text-accent">{rupiah(p.price)}<span className="ml-1 text-sm font-semibold text-muted">{p.per_person ? "/ orang" : "/ sesi"}</span></p>
                {bookingOpen && (p.bookable_online
                  ? <Link href={`/book?paket=${p.id}`} className="btn btn-primary !min-h-10 !rounded-full !px-5">Pilih</Link>
                  : <span className="badge badge-amber !px-3 !py-1.5">Langsung datang</span>)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
