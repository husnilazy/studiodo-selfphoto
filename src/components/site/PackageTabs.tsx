"use client";
import Link from "next/link";
import { useState } from "react";
import PackageCardView from "../PackageCardView";
import EventInquiry from "./EventInquiry";
import type { Deal, GroupDeal } from "@/lib/pricing";
import { CATEGORY_LABEL } from "@/lib/format";

type P = { id: number; name: string; category: string; description: string; includes: string; price: number; duration_min: number; max_people: number; image_url: string; image_size?: string; image_fit?: string; image_x?: number; image_y?: number; per_person: boolean; bookable_online: boolean; min_people?: number; included_people?: number; extra_person_price?: number; is_group?: boolean; badge?: string; is_event?: boolean; base_hours?: number; extra_hour_price?: number; max_hours?: number; outputs?: string; event_addons?: string; deal?: Deal | null; group?: GroupDeal | null };

const BLURB: Record<string, string> = {
  self_photo: "Foto sendiri di studio, atur pose dan ekspresimu sepuasnya.",
  photobox: "Photobox bertema, cepat, seru, dan hasilnya langsung jadi.",
  photobooth: "Photobooth untuk acara: pernikahan, ulang tahun, hingga gathering.",
  wisuda: "Abadikan hari kelulusanmu dengan retouch profesional.",
  keluarga: "Foto keluarga dan pas foto resmi dengan hasil rapi.",
  lainnya: "Layanan lainnya.",
  grup: "Datang beramai-ramai? Paket khusus rombongan dengan jumlah orang yang pas untuk kalian.",
  event: "Sewa photobooth untuk acaramu: pilih durasi dan output, hitung estimasinya, lalu tanya langsung.",
};
const GROUP = "grup", EVENT = "event";

export default function PackageTabs({ packages, bookingOpen, whatsapp = "", studioName = "" }: { packages: P[]; bookingOpen: boolean; whatsapp?: string; studioName?: string }) {
  // Tab "Paket Grup" muncul otomatis begitu ada paket yang ditandai grup di admin.
  const cats = [...new Set(packages.map((p) => p.category)), ...(packages.some((p) => p.is_group) ? [GROUP] : []), ...(packages.some((p) => p.is_event) ? [EVENT] : [])];
  const [cat, setCat] = useState(cats[0] ?? "self_photo");
  const list = cat === GROUP ? packages.filter((p) => p.is_group) : cat === EVENT ? packages.filter((p) => p.is_event) : packages.filter((p) => p.category === cat);
  if (!packages.length) return <p className="text-center text-muted">Paket segera hadir.</p>;

  // Tata letak bento (layar lebar, 3 kolom): kartu unggulan melebar 2 kolom. Jumlahnya dihitung agar baris selalu terisi penuh tanpa celah:
  // total sel = jumlah kartu + kartu lebar harus kelipatan 3. Yang diunggulkan: berlabel/promo dulu, lalu yang paling awal.
  const need = list.length === 1 ? 1 : (3 - (list.length % 3)) % 3;
  const wide = new Set(
    list.map((p, i) => ({ i, score: (p.badge ? 2 : 0) + (p.deal ? 2 : 0) + (p.is_group || p.is_event ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || a.i - b.i).slice(0, need).map((x) => x.i),
  );

  return (
    <div>
      <div className="hscroll -mx-4 mb-8 flex justify-start gap-2 overflow-x-auto px-4 sm:mx-0 sm:justify-center sm:px-0">
        <div className="glass inline-flex gap-1 rounded-full p-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${cat === c ? "bg-accent text-accentfg shadow-lg shadow-accent/30" : "text-muted hover:text-fg"}`}>
              {c === GROUP ? "Paket Grup" : c === EVENT ? "Sewa Event" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <p key={`blurb-${cat}`} className="step-in mb-6 text-center text-muted">{BLURB[cat]}</p>

      <div key={cat} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-flow-dense lg:grid-cols-3">
        {list.map((p, i) => (
          <PackageCardView key={p.id} p={p} wide={wide.has(i)} className={`step-in ${wide.has(i) ? (list.length === 1 ? "lg:col-span-3" : "lg:col-span-2") : ""}`} style={{ animationDelay: `${i * 70}ms` }}
            footer={p.is_event
              ? <EventInquiry name={p.name} whatsapp={whatsapp} studioName={studioName} rule={{ price: p.price, base_hours: p.base_hours ?? 0, extra_hour_price: p.extra_hour_price ?? 0, max_hours: p.max_hours ?? 0, outputs: p.outputs ?? "" }} addons={p.event_addons ?? ""} />
              : bookingOpen && (p.bookable_online
              ? <Link href={`/book?paket=${p.id}`} className="btn btn-primary !min-h-10 !rounded-full !px-5">Pilih</Link>
              : <span className="badge badge-amber !px-3 !py-1.5">Langsung datang</span>)} />
        ))}
      </div>
    </div>
  );
}
