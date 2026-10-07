import Icon from "./Icon";
import { imageSrc } from "@/lib/siteConfig";
import { CATEGORY_LABEL, rupiah } from "@/lib/format";
import { IMAGE_SIZES, imageSizeKey, imageStyle, priceSuffix, type PackageImage } from "@/lib/packageUtils";

export type CardPkg = PackageImage & {
  name: string; category: string; description: string; includes: string; price: number;
  duration_min: number; max_people: number; per_person: boolean;
};

export const cardBullets = (p: Pick<CardPkg, "description" | "includes">) =>
  [p.description, ...p.includes.split(/\n|,/)].map((t) => t.trim()).filter(Boolean).slice(0, 5);

/** Kartu paket untuk website publik. Juga dipakai sebagai pratinjau langsung di form admin. */
export default function PackageCardView({ p, footer, className = "", style }: { p: CardPkg; footer?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const h = IMAGE_SIZES[imageSizeKey(p.image_size)].h;
  const bullets = cardBullets(p);
  return (
    <article className={`pkg-card glass lift spot group flex flex-col overflow-hidden rounded-3xl ${className}`} style={style}>
      <div className="relative overflow-hidden" style={{ height: h, transition: "height .35s cubic-bezier(.2,.8,.2,1)" }}>
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc(p.image_url)} alt={p.name} loading="lazy" style={imageStyle(p)}
            className={`pkg-img size-full ${p.image_fit === "contain" ? "bg-panel2 p-2" : "transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"}`} />
        ) : (
          <div className="relative size-full" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 34%, transparent), color-mix(in oklab, var(--accent-2) 26%, transparent))" }}>
            <Icon name="camera" className="absolute -bottom-5 -right-3 size-28 -rotate-12 text-accent/25 transition-transform duration-700 group-hover:rotate-0" />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur-md">{CATEGORY_LABEL[p.category] ?? p.category}</span>
        <div className="absolute bottom-3 left-3 flex gap-1.5 text-[11px] font-semibold text-white">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md"><Icon name="clock" className="size-3" />{p.duration_min} mnt</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md"><Icon name="users" className="size-3" />maks {p.max_people}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-display text-xl font-semibold leading-tight">{p.name}</h3>
        {bullets.length > 0 && (
          <ul className="mt-3.5 space-y-1.5 text-sm">
            {bullets.map((t, i) => (
              <li key={i} className="flex gap-2"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accentsoft text-accent"><Icon name="check" className="size-2.5" /></span><span className="text-fg/90">{t}</span></li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line/70 pt-5" style={{ marginTop: "auto" }}>
          <p className="font-display text-2xl font-bold tracking-tight text-accent">{rupiah(p.price)}<span className="ml-1 text-sm font-semibold text-muted">{priceSuffix(p)}</span></p>
          {footer}
        </div>
      </div>
    </article>
  );
}
