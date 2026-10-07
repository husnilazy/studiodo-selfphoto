import Icon from "./Icon";
import { imageSrc } from "@/lib/siteConfig";
import type { FontKey } from "@/lib/siteConfig";

export type CardBrand = { name: string; logo: string; logoDark: string; height: number; text: string; textSize: number; textFont: FontKey; accent: string; accent2: string };

/** Logo studio untuk latar gelap (depan) atau terang (belakang): pakai versi yang cocok, jika tidak ada dibungkus pill kontras. */
function CardLogo({ brand, on }: { brand: CardBrand; on: "dark" | "light" }) {
  const own = on === "dark" ? brand.logoDark : brand.logo;
  const other = on === "dark" ? brand.logo : brand.logoDark;
  const src = own || other;
  const extra = brand.text ? <span className="whitespace-nowrap text-[3.6cqw] font-semibold leading-none">{brand.text}</span> : null;
  if (!src) {
    return <span className="inline-flex items-center gap-[2cqw] text-[5.2cqw] font-extrabold leading-none tracking-tight" style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}>{brand.name}{extra}</span>;
  }
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageSrc(src)} alt={brand.name} className="h-[10.5cqw] max-w-[38cqw] w-auto object-contain" />
  );
  // Logo versi sendiri tampil polos; logo versi sebaliknya diberi pill agar tetap terbaca.
  if (own) return <span className="inline-flex items-center gap-[2cqw]">{img}{extra}</span>;
  return <span className={`inline-flex items-center gap-[2cqw] rounded-[1.6cqw] px-[2.2cqw] py-[1.1cqw] ${on === "dark" ? "bg-white/95 text-[#0b1020]" : "bg-[#0b1020] text-white"}`}>{img}{extra}</span>;
}

/**
 * Kartu member ukuran 4R/2 (102 Ã— 76 mm). Semua ukuran memakai satuan cqw sehingga proporsinya sama
 * di layar, di HP, maupun saat dicetak.
 */
export default function MemberCardView({ side, brand, name, code, tier, since, qrSvg, host, stamps }: {
  side: "front" | "back"; brand: CardBrand; name: string; code: string; tier: string; since: string; qrSvg?: string; host: string;
  stamps: { total: number; filled: number; rewardLabel: string };
}) {
  const base = "mcard relative aspect-[102/76] w-full overflow-hidden rounded-[4cqw] [container-type:inline-size] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
  if (side === "front") {
    return (
      <div className={`${base} text-white shadow-xl`} style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${brand.accent} 78%, #05060f), color-mix(in oklab, ${brand.accent2} 62%, #05060f))` }}>
        <div aria-hidden className="absolute -right-[12cqw] -top-[18cqw] size-[60cqw] rounded-full bg-white/10 blur-[2px]" />
        <div aria-hidden className="absolute -bottom-[26cqw] -left-[10cqw] size-[56cqw] rounded-full bg-black/15" />
        <div className="relative flex h-full flex-col justify-between p-[5.5cqw]">
          <div className="flex items-start justify-between gap-[3cqw]">
            <CardLogo brand={brand} on="dark" />
            <span className="rounded-full bg-white/20 px-[3cqw] py-[1cqw] text-[3.2cqw] font-bold uppercase tracking-[.18em] backdrop-blur">{tier || "Member"}</span>
          </div>
          <div className="flex items-end justify-between gap-[3cqw]">
            <div className="min-w-0">
              <p className="text-[2.8cqw] font-semibold uppercase tracking-[.22em] text-white/70">Kartu Member</p>
              <p className="mt-[1cqw] truncate text-[6.6cqw] font-bold leading-tight" style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}>{name}</p>
              <p className="mt-[1.6cqw] font-mono text-[6.2cqw] font-bold tracking-[.14em]">{code}</p>
              <p className="mt-[1.2cqw] text-[2.9cqw] text-white/70">Member sejak {since}</p>
            </div>
            {qrSvg && (
              <div className="shrink-0 rounded-[2cqw] bg-white p-[1.6cqw]">
                <div className="size-[19cqw] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cols = stamps.total <= 5 ? stamps.total : stamps.total <= 6 ? 3 : stamps.total <= 8 ? 4 : stamps.total <= 15 ? 5 : 7;
  const rows = Math.ceil(stamps.total / cols), rowH = Math.min(24, 43 / rows - 2);
  return (
    <div className={`${base} border border-[#d7dbea] bg-white text-[#0b1020] shadow-xl`}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[2cqw]" style={{ background: `linear-gradient(90deg, ${brand.accent}, ${brand.accent2})` }} />
      <div className="relative flex h-full flex-col p-[5cqw] pt-[5.5cqw]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[4.4cqw] font-extrabold leading-none tracking-tight">KARTU STEMPEL</p>
            <p className="mt-[1cqw] text-[2.7cqw] text-[#667089]">Stempel tiap sesi Â· {stamps.rewardLabel}</p>
            <p className="mt-[0.8cqw] font-mono text-[2.8cqw] font-bold tracking-widest text-[#667089]">{code}</p>
          </div>
          <CardLogo brand={brand} on="light" />
        </div>
        <div className="mt-[3cqw] grid flex-1 gap-[2cqw]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: `${rowH}cqw`, alignContent: "center" }}>
          {Array.from({ length: stamps.total }).map((_, i) => {
            const last = i === stamps.total - 1, done = i < stamps.filled;
            return (
              <div key={i} className="relative grid min-h-0 place-items-center rounded-[1.8cqw] border-[0.35cqw] border-dashed" style={{ borderColor: last ? brand.accent : "#b8bfd6", background: last ? `color-mix(in oklab, ${brand.accent} 9%, white)` : undefined }}>
                <span className="absolute left-[1.2cqw] top-[0.6cqw] text-[2.3cqw] font-bold text-[#9aa3bd]">{i + 1}</span>
                {done && <span className="grid size-[7cqw] place-items-center rounded-full text-white" style={{ background: brand.accent }}><Icon name="check" className="size-[4.4cqw]" /></span>}
                {last && !done && <span className="flex flex-col items-center leading-none" style={{ color: brand.accent }}><Icon name="gift" className="size-[5.6cqw]" /><b className="mt-[0.8cqw] text-[2.4cqw]">GRATIS</b></span>}
              </div>
            );
          })}
        </div>
        <p className="mt-[2.6cqw] flex items-center justify-between text-[2.5cqw] text-[#667089]">
          <span>Tunjukkan kartu ini saat transaksi</span>
          <span className="font-semibold">{host}/anggota</span>
        </p>
      </div>
    </div>
  );
}
