/* eslint-disable @next/next/no-img-element */
/** Wordmark FRAMELESS™ — putih di tema gelap, hitam di tema terang (diatur lewat CSS). */
export default function Logo({ height = 16, className = "" }: { height?: number; className?: string }) {
  const w = Math.round((height * 1985) / 332);
  return (
    <span className={`inline-flex ${className}`} aria-label="Frameless">
      <img src="/logo-white.png" alt="Frameless" width={w} height={height} className="logo-on-dark block" style={{ height, width: "auto" }} />
      <img src="/logo-black.png" alt="" aria-hidden width={w} height={height} className="logo-on-light" style={{ height, width: "auto" }} />
    </span>
  );
}
