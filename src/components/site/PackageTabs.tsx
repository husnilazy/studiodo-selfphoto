"use client";
import Link from "next/link";
import { useState } from "react";
import PackageCardView from "../PackageCardView";
import type { Deal, GroupDeal } from "@/lib/pricing";
import { CATEGORY_LABEL } from "@/lib/format";

type P = { id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string; image_size?: string; image_fit?: string; image_x?: number; image_y?: number; per_person: boolean; bookable_online: boolean; deal?: Deal | null; group?: GroupDeal | null };

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
          <PackageCardView key={p.id} p={p} className="step-in" style={{ animationDelay: `${i * 70}ms` }}
            footer={bookingOpen && (p.bookable_online
              ? <Link href={`/book?paket=${p.id}`} className="btn btn-primary !min-h-10 !rounded-full !px-5">Pilih</Link>
              : <span className="badge badge-amber !px-3 !py-1.5">Langsung datang</span>)} />
        ))}
      </div>
    </div>
  );
}
