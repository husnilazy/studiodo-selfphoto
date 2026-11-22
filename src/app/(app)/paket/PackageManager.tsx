"use client";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import PackageSlides from "@/components/PackageSlides";
import { toast } from "@/components/Toaster";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";
import { packageImages, peopleRange, priceSuffix } from "@/lib/packageUtils";
import { duplicatePackage, togglePackage } from "@/app/actions/catalog";

export type PkgItem = {
  id: number; name: string; category: string; price: number; per_person: boolean; duration_min: number; max_people: number;
  active: boolean; bookable_online: boolean; image_url: string; images: string[]; image_fit: string; image_x: number; image_y: number;
  includes: string; room_count: number; option_label: string;
  min_people: number; included_people: number; extra_person_price: number; is_group: boolean; badge: string;
  is_event: boolean; base_hours: number; extra_hour_price: number; max_hours: number; outputs: string;
};

type Status = "all" | "aktif" | "nonaktif" | "walkin" | "nofoto" | "grup" | "event";

function Switch({ on, busy, label, onClick }: { on: boolean; busy: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={onClick}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-60 ${on ? "bg-accent" : "bg-line"}`}>
      <span className={`absolute left-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-4" : ""}`}>
        {busy && <span className="spinner !size-3 text-accent" />}
      </span>
    </button>
  );
}

export default function PackageManager({ items, editors, createEditor }: { items: PkgItem[]; editors: Record<number, ReactNode>; createEditor: ReactNode }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [view, setView] = useState<"kartu" | "daftar">("kartu");
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, boolean>>({});

  useEffect(() => { try { const v = localStorage.getItem("sd_paket_view"); if (v === "daftar" || v === "kartu") setView(v); } catch { /* abaikan */ } }, []);
  const pickView = (v: "kartu" | "daftar") => { setView(v); try { localStorage.setItem("sd_paket_view", v); } catch { /* abaikan */ } };

  const val = (p: PkgItem, f: "active" | "bookable_online") => local[`${p.id}:${f}`] ?? p[f];
  const stats = useMemo(() => ({
    total: items.length,
    aktif: items.filter((p) => val(p, "active")).length,
    nonaktif: items.filter((p) => !val(p, "active")).length,
    walkin: items.filter((p) => !val(p, "bookable_online")).length,
    nofoto: items.filter((p) => packageImages(p).length === 0).length,
    grup: items.filter((p) => p.is_group).length,
    event: items.filter((p) => p.is_event).length,
  }), [items, local]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = useMemo(() => [...new Set(items.map((p) => p.category))], [items]);
  const list = items.filter((p) => {
    if (cat !== "all" && p.category !== cat) return false;
    if (status === "aktif" && !val(p, "active")) return false;
    if (status === "nonaktif" && val(p, "active")) return false;
    if (status === "walkin" && val(p, "bookable_online")) return false;
    if (status === "nofoto" && packageImages(p).length > 0) return false;
    if (status === "grup" && !p.is_group) return false;
    if (status === "event" && !p.is_event) return false;
    const t = q.trim().toLowerCase();
    return !t || p.name.toLowerCase().includes(t) || p.includes.toLowerCase().includes(t);
  });

  const toggle = (p: PkgItem, f: "active" | "bookable_online") => {
    const key = `${p.id}:${f}`, next = !val(p, f);
    setBusyKey(key); setLocal((l) => ({ ...l, [key]: next }));
    start(async () => {
      const r = await togglePackage(p.id, f, next);
      if (r?.error) { setLocal((l) => ({ ...l, [key]: !next })); toast(r.error, "bad"); } else { toast(r?.message ?? "Tersimpan"); router.refresh(); }
      setBusyKey(null);
    });
  };
  const dup = (p: PkgItem) => {
    setBusyKey(`${p.id}:dup`);
    start(async () => {
      const r = await duplicatePackage(p.id);
      if (r?.error) toast(r.error, "bad"); else { toast(r?.message ?? "Paket disalin"); router.refresh(); }
      setBusyKey(null);
    });
  };

  const chips: { k: Status; l: string; n: number }[] = [
    { k: "all", l: "Semua", n: stats.total }, { k: "aktif", l: "Aktif", n: stats.aktif }, { k: "nonaktif", l: "Nonaktif", n: stats.nonaktif },
    { k: "walkin", l: "Walk-in saja", n: stats.walkin }, { k: "nofoto", l: "Tanpa foto", n: stats.nofoto },
    { k: "grup", l: "Paket grup", n: stats.grup }, { k: "event", l: "Sewa event", n: stats.event },
  ];

  return (
    <div>
      {/* ringkasan */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ l: "Total paket", v: stats.total }, { l: "Aktif (tampil)", v: stats.aktif, tone: "text-ok" }, { l: "Nonaktif", v: stats.nonaktif }, { l: "Walk-in saja", v: stats.walkin, tone: stats.walkin ? "text-warn" : "" }].map((s) => (
          <div key={s.l} className="card px-4 py-3"><p className="text-xs font-semibold text-muted">{s.l}</p><p className={`font-display tnum text-2xl font-semibold ${s.tone ?? ""}`}>{s.v}</p></div>
        ))}
      </div>

      {/* alat */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama paket…" className="input !pl-10" aria-label="Cari paket" />
        </div>
        <div className="flex gap-1 rounded-full border border-line p-1" role="group" aria-label="Tampilan">
          {(["kartu", "daftar"] as const).map((v) => (
            <button key={v} onClick={() => pickView(v)} aria-pressed={view === v} className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${view === v ? "bg-accent text-accentfg" : "text-muted hover:text-fg"}`}>{v}</button>
          ))}
        </div>
        <Sheet title="Paket Baru" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Paket</button>}>{createEditor}</Sheet>
      </div>
      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button className="chip shrink-0" data-on={cat === "all"} onClick={() => setCat("all")}>Semua kategori</button>
        {cats.map((c) => <button key={c} className="chip shrink-0" data-on={cat === c} onClick={() => setCat(c)}>{CATEGORY_LABEL[c] ?? c} ({items.filter((p) => p.category === c).length})</button>)}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => <button key={c.k} className="chip shrink-0 !min-h-8 !text-xs" data-on={status === c.k} onClick={() => setStatus(c.k)}>{c.l} ({c.n})</button>)}
      </div>

      {list.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-display font-semibold">Tidak ada paket yang cocok</p>
          <p className="mt-1 text-sm text-muted">Ubah kata kunci atau filter di atas.</p>
          <button className="btn btn-sm mt-3" onClick={() => { setQ(""); setCat("all"); setStatus("all"); }}>Reset filter</button>
        </div>
      ) : view === "kartu" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => {
            const urls = packageImages(p), on = val(p, "active"), online = val(p, "bookable_online");
            return (
              <article key={p.id} className={`card hover-lift anim-rise group flex flex-col overflow-hidden transition ${on ? "" : "opacity-60"}`} style={{ ["--i" as string]: Math.min(i, 8) }}>
                <div className="relative h-40">
                  {urls.length ? <PackageSlides urls={urls} name={p.name} fit={p.image_fit === "contain" ? "contain" : "cover"} x={p.image_x} y={p.image_y} /> : (
                    <div className="grid size-full place-items-center bg-panel2 text-muted"><span className="flex flex-col items-center gap-1 text-xs font-semibold"><Icon name="camera" className="size-7" />Belum ada foto</span></div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute left-3 top-3 z-[3] rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{CATEGORY_LABEL[p.category] ?? p.category}</span>
                  {urls.length > 1 && <span className="absolute bottom-3 right-3 z-[3] rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">{urls.length} foto</span>}
                </div>
                <Sheet title="Edit Paket" wide className="block flex-1" trigger={
                  <button className="block w-full p-4 text-left">
                    <p className="font-display text-lg font-semibold leading-tight">{p.name}</p>
                    <p className="font-display tnum mt-1 text-xl font-bold text-accent">{rupiah(p.price)} <span className="text-sm font-semibold text-muted">{priceSuffix(p)}</span></p>
                    <p className="mt-1 text-xs text-muted">{p.is_event ? `Sewa ${p.base_hours} jam` : `${p.duration_min} menit · ${peopleRange(p)}`}{p.room_count ? ` · ${p.room_count} ruang` : " · semua ruang"}{p.option_label ? ` · pilihan: ${p.option_label}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`badge ${on ? "badge-green" : "badge-slate"}`}>{on ? "Aktif" : "Nonaktif"}</span>
                      <span className={`badge ${online ? "badge-indigo" : "badge-amber"}`}>{online ? "Bisa dipesan online" : "Walk-in saja"}</span>
                      {p.is_event && <span className="badge badge-indigo">Sewa event{p.extra_hour_price > 0 ? ` · +${rupiah(p.extra_hour_price)}/jam` : ""}</span>}
                      {p.is_group && <span className="badge badge-indigo">Paket grup</span>}
                      {p.badge && <span className="badge badge-amber">{p.badge}</span>}
                      {!p.per_person && p.included_people > 0 && p.extra_person_price > 0 && <span className="badge badge-slate">+{rupiah(p.extra_person_price)}/orang &gt;{p.included_people}</span>}
                    </div>
                  </button>}>
                  {editors[p.id]}
                </Sheet>
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs font-semibold">
                  <label className="flex items-center gap-2"><Switch on={on} busy={busyKey === `${p.id}:active`} label={`Aktif: ${p.name}`} onClick={() => toggle(p, "active")} /> Aktif</label>
                  <label className="flex items-center gap-2"><Switch on={online} busy={busyKey === `${p.id}:bookable_online`} label={`Online: ${p.name}`} onClick={() => toggle(p, "bookable_online")} /> Online</label>
                  <button type="button" disabled={pending} onClick={() => dup(p)} className="btn btn-sm !min-h-8" title="Salin paket">{busyKey === `${p.id}:dup` ? <span className="spinner" /> : <Icon name="copy" className="size-3.5" />} Salin</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((p) => {
            const urls = packageImages(p), on = val(p, "active"), online = val(p, "bookable_online");
            return (
              <div key={p.id} className={`flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap ${on ? "" : "opacity-60"}`}>
                <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-panel2">
                  {urls.length ? <PackageSlides urls={urls} name={p.name} fit="cover" x={p.image_x} y={p.image_y} /> : <span className="grid size-full place-items-center text-muted"><Icon name="camera" className="size-5" /></span>}
                </div>
                <Sheet title="Edit Paket" wide className="block min-w-0 flex-1 basis-48" trigger={
                  <button className="block w-full min-w-0 text-left">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted">{CATEGORY_LABEL[p.category] ?? p.category} · {p.is_event ? `Sewa ${p.base_hours} jam` : `${p.duration_min} mnt · ${peopleRange(p)}`}{p.is_group ? " · grup" : ""} · {urls.length} foto</p>
                  </button>}>
                  {editors[p.id]}
                </Sheet>
                <span className="font-display tnum shrink-0 font-bold text-accent">{rupiah(p.price)}<span className="text-xs font-semibold text-muted"> {priceSuffix(p)}</span></span>
                <span className="flex shrink-0 items-center gap-3 text-xs font-semibold">
                  <label className="flex items-center gap-1.5"><Switch on={on} busy={busyKey === `${p.id}:active`} label={`Aktif: ${p.name}`} onClick={() => toggle(p, "active")} /><span className="hidden md:inline">Aktif</span></label>
                  <label className="flex items-center gap-1.5"><Switch on={online} busy={busyKey === `${p.id}:bookable_online`} label={`Online: ${p.name}`} onClick={() => toggle(p, "bookable_online")} /><span className="hidden md:inline">Online</span></label>
                  <button type="button" disabled={pending} onClick={() => dup(p)} className="btn btn-sm !min-h-8 !px-2.5" aria-label={`Salin ${p.name}`}>{busyKey === `${p.id}:dup` ? <span className="spinner" /> : <Icon name="copy" className="size-3.5" />}</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
