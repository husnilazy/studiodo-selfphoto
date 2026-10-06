import { imageSrc } from "@/lib/siteConfig";

/** Logo studio (gambar jika ada, selain itu nama bergaya). Mendukung logo terpisah untuk mode gelap. */
export default function BrandMark({
  name, logo, logoDark, height = 32, showName = true, className = "",
}: { name: string; logo: string; logoDark: string; height?: number; showName?: boolean; className?: string }) {
  if (!logo && !logoDark) {
    return <span className={`font-display text-xl font-bold tracking-tight ${className}`}>{name.length <= 10 ? <>{name.slice(0, -2)}<span className="text-accent">{name.slice(-2)}</span></> : name}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${logoDark ? "has-dark-logo" : ""} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc(logo || logoDark)} alt={name} style={{ height }} className="logo-l w-auto object-contain" />
      {logoDark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc(logoDark)} alt={name} style={{ height }} className="logo-d w-auto object-contain" />
      )}
      {showName && <span className="font-display text-lg font-bold tracking-tight">{name}</span>}
    </span>
  );
}
