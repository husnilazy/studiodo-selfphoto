import Icon from "./Icon";
import Countdown from "./site/Countdown";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";
import type { Deal, GroupDeal } from "@/lib/pricing";
import PackageSlides from "./PackageSlides";
import { IMAGE_SIZES, imageSizeKey, packageImages, parseEventAddons, parseOutputs, peopleRange, priceSuffix, type PackageImage } from "@/lib/packageUtils";

export type CardPkg = PackageImage & {
  name: string; category: string; description: string; includes: string; price: number;
  duration_min: number; max_people: number; per_person: boolean;
  min_people?: number; included_people?: number; extra_person_price?: number; is_group?: boolean; badge?: string;
  is_event?: boolean; base_hours?: number; extra_hour_price?: number; max_hours?: number; outputs?: string; event_addons?: string;
  deal?: Deal | null; group?: GroupDeal | null;
};

export const cardBullets = (p: Pick<CardPkg, "description" | "includes">) =>
  [p.description, ...p.includes.split(/\n|,/)].map((t) => t.trim()).filter(Boolean).slice(0, 5);

/** Kartu paket untuk website publik. Juga dipakai sebagai pratinjau langsung di form admin. */
export default function PackageCardView({ p, footer, className = "", style, wide = false }: { p: CardPkg; footer?: React.ReactNode; className?: string; style?: React.CSSProperties; wide?: boolean }) {
  const h = IMAGE_SIZES[imageSizeKey(p.image_size)].h;
  const bullets = cardBullets(p);
  const urls = packageImages(p);
  return (
    <article className={`pkg-card glass lift spot group flex flex-col overflow-hidden rounded-3xl ${wide ? "lg:flex-row" : ""} ${className}`} style={style}>
      <div className={`relative overflow-hidden ${wide ? "lg:!h-auto lg:min-h-[19rem] lg:w-[44%] lg:shrink-0" : ""}`} style={{ height: h, transition: "height .35s cubic-bezier(.2,.8,.2,1)" }}>
        {urls.length > 0 ? (
          <PackageSlides urls={urls} name={p.name} fit={p.image_fit === "contain" ? "contain" : "cover"} x={p.image_x ?? 50} y={p.image_y ?? 50} />
        ) : (
          <div className="site-fallback relative size-full" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 34%, transparent), color-mix(in oklab, var(--accent-2) 26%, transparent))" }}>
            <Icon name="camera" className="absolute -bottom-5 -right-3 size-28 -rotate-12 text-accent/25 transition-transform duration-700 group-hover:rotate-0" />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-2/5 bg-gradient-to-t from-black/55 to-transparent" />
        {p.deal && (
          <span className="ribbon absolute right-3 top-3 z-[3] rounded-full bg-gradient-to-br from-rose-500 to-orange-500 px-3 py-1 text-xs font-extrabold text-white shadow-lg shadow-rose-500/40">
            {p.deal.percent > 0 ? `-${p.deal.percent}%` : "PROMO"}
          </span>
        )}
        <div className="absolute left-3 top-3 z-[3] flex flex-wrap gap-1.5">
          <span className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur-md">{CATEGORY_LABEL[p.category] ?? p.category}</span>
          {p.is_group && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accentfg"><Icon name="users" className="size-3" />Grup</span>}
          {p.badge && p.deal && <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-black">{p.badge}</span>}
        </div>
        {p.badge && !p.deal && (
          <span className="ribbon absolute right-3 top-3 z-[3] rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-black shadow-lg shadow-amber-500/30">{p.badge}</span>
        )}
        <div className="absolute bottom-3 left-3 z-[3] flex gap-1.5 text-[11px] font-semibold text-white">
          {p.is_event ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md"><Icon name="clock" className="size-3" />Sewa {p.base_hours} jam</span>
          ) : (<>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md"><Icon name="clock" className="size-3" />{p.duration_min} mnt</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md"><Icon name="users" className="size-3" />{peopleRange({ max_people: p.max_people, min_people: p.min_people })}</span>
          </>)}
        </div>
      </div>
      {/* Strip promo + isi kartu dalam satu kolom, supaya pada varian lebar (foto di kiri) strip tidak berada di tengah. */}
      <div className="flex min-w-0 flex-1 flex-col">
      {p.deal && (
        <div className="deal-strip flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-xs font-bold text-white">
          <span className="min-w-0 truncate">🔥 {p.deal.label}</span>
          {p.deal.countdown && p.deal.endsAt ? <span className="flex items-center gap-1.5"><span className="font-semibold opacity-90">berakhir</span><Countdown endsAt={p.deal.endsAt} /></span> : <span className="opacity-90">{p.deal.text}</span>}
        </div>
      )}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-display text-xl font-semibold leading-tight">{p.name}</h3>
        {bullets.length > 0 && (
          <ul className="mt-3.5 space-y-1.5 text-sm">
            {bullets.map((t, i) => (
              <li key={i} className="flex gap-2"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accentsoft text-accent"><Icon name="check" className="size-2.5" /></span><span className="text-fg/90">{t}</span></li>
            ))}
          </ul>
        )}
        {p.is_event && (
          <div className="mt-4 space-y-2 rounded-xl border border-line px-3 py-2.5 text-xs font-semibold text-muted">
            {(p.extra_hour_price ?? 0) > 0 && <p className="flex items-center gap-2"><Icon name="clock" className="size-4 shrink-0" /><span>Tambah jam <b className="text-fg">+{rupiah(p.extra_hour_price ?? 0)}</b> / jam</span></p>}
            {parseOutputs(p.outputs ?? "").length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span>Output:</span>
                {parseOutputs(p.outputs ?? "").map((o) => <span key={o.label} className="rounded-full bg-accentsoft px-2.5 py-0.5 text-accent">{o.label}{o.delta !== 0 ? ` (${o.delta > 0 ? "+" : "−"}${rupiah(Math.abs(o.delta))})` : ""}</span>)}
              </div>
            )}
            {(() => {
              const all = parseEventAddons(p.event_addons ?? "");
              const free = all.filter((a) => a.free), paid = all.filter((a) => !a.free);
              return (<>
                {free.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {free.map((a) => (
                      <span key={a.label} className="inline-flex max-w-full items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-2.5 py-1 text-[11px] font-extrabold leading-tight text-black shadow-sm shadow-amber-500/30">
                        <span className="min-w-0">🎁 FREE {a.label}{a.min_hours > 0 ? ` (sewa ${a.min_hours}+ jam)` : ""}</span>{a.price > 0 && <s className="shrink-0 whitespace-nowrap font-semibold opacity-70">{rupiah(a.price)}</s>}
                      </span>
                    ))}
                  </div>
                )}
                {paid.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Tambahan:</span>
                    {paid.map((a) => <span key={a.label} className="rounded-full border border-line px-2.5 py-0.5 text-fg">{a.label} <b className="text-accent">+{rupiah(a.price)}</b></span>)}
                  </div>
                )}
              </>);
            })()}
          </div>
        )}
        {!p.per_person && !p.is_event && (p.included_people ?? 0) > 0 && (p.extra_person_price ?? 0) > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted">
            <Icon name="users" className="size-4 shrink-0" />
            <span>Termasuk {p.included_people} orang · orang tambahan <b className="text-fg">+{rupiah(p.extra_person_price ?? 0)}</b> / orang</span>
          </p>
        )}
        {p.group && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-accentsoft px-3 py-2 text-xs font-semibold text-accent">
            <Icon name="users" className="size-4 shrink-0" />
            <span>{p.group.text}: <b>{rupiah(p.group.unitPrice)}</b>{p.per_person ? " / orang" : ""}</span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-3 border-t border-line/70 pt-5" style={{ marginTop: "auto" }}>
          <div>
            {p.deal && <p className="tnum text-sm font-semibold text-muted line-through decoration-rose-500/70">{rupiah(p.price)}</p>}
            <p className="font-display whitespace-nowrap text-2xl font-bold tracking-tight text-accent">{rupiah(p.deal ? p.deal.salePrice : p.price)}<span className="ml-1 text-sm font-semibold text-muted">{p.is_event ? `/ ${p.base_hours} jam` : priceSuffix(p)}</span></p>
          </div>
          {footer}
        </div>
      </div>
      </div>
    </article>
  );
}
