import { FONT_FAMILY, imageSrc, type FontKey } from "@/lib/siteConfig";

/**
 * Logo studio. Logo gambar (jika ada) + teks brand tambahan yang bisa diatur dari CMS
 * (isi, ukuran, dan font). Tanpa logo gambar, nama studio tampil sebagai wordmark.
 */
export default function BrandMark({
  name, logo, logoDark, height = 32, text = "", textSize = 16, textFont = "sora", className = "",
}: {
  name: string; logo: string; logoDark: string; height?: number;
  text?: string; textSize?: number; textFont?: FontKey; className?: string;
}) {
  const extra = text ? (
    <span className="whitespace-nowrap font-semibold leading-none tracking-tight" style={{ fontSize: textSize, fontFamily: FONT_FAMILY[textFont] }}>{text}</span>
  ) : null;

  if (!logo && !logoDark) {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <span className="font-display text-xl font-bold tracking-tight">{name.length <= 10 ? <>{name.slice(0, -2)}<span className="text-accent">{name.slice(-2)}</span></> : name}</span>
        {extra}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${logoDark ? "has-dark-logo" : ""} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc(logo || logoDark)} alt={name} style={{ height }} className="logo-l w-auto object-contain" />
      {logoDark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc(logoDark)} alt={name} style={{ height }} className="logo-d w-auto object-contain" />
      )}
      {extra}
    </span>
  );
}
