"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";
import { driveEmbed, imageSrc, mediaKind, youtubeId, youtubeThumb } from "@/lib/siteConfig";

type Item = { title: string; url: string; poster_url: string; link: string };

export default function ReelsRail({ items }: { items: Item[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const by = (d: number) => rail.current?.scrollBy({ left: d * 280, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={rail} className="hscroll -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        {items.map((it, i) => <ReelCard key={i} it={it} />)}
      </div>
      {items.length > 3 && (
        <div className="mt-2 hidden justify-center gap-2 sm:flex">
          <button className="btn !min-h-11 !w-11 !rounded-full !px-0" onClick={() => by(-1)} aria-label="Geser kiri"><Icon name="left" /></button>
          <button className="btn !min-h-11 !w-11 !rounded-full !px-0" onClick={() => by(1)} aria-label="Geser kanan"><Icon name="right" /></button>
        </div>
      )}
    </div>
  );
}

const shell = "lift group relative aspect-[9/16] w-[62vw] max-w-[17rem] shrink-0 snap-center overflow-hidden rounded-3xl bg-zinc-900 sm:w-64";

function ReelCard({ it }: { it: Item }) {
  const kind = mediaKind(it.url);
  const poster = it.poster_url ? imageSrc(it.poster_url) : kind === "youtube" ? youtubeThumb(it.url) : "";
  const [play, setPlay] = useState(false);
  const [muted, setMuted] = useState(true);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.6 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const title = it.title ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12 text-sm font-bold text-white">{it.title}</div>
  ) : null;
  const posterBg = poster ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={poster} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
  ) : (
    <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, var(--accent), var(--accent-2))" }} />
  );
  const playBtn = (
    <span className="absolute inset-0 m-auto grid size-14 place-items-center rounded-full bg-white/90 text-accent shadow-xl transition-transform group-hover:scale-110">
      <Icon name="right" className="size-7 translate-x-0.5" />
    </span>
  );

  if (kind === "video") {
    return (
      <div className={shell}>
        <video ref={vid} src={it.url} poster={poster || undefined} muted={muted} loop playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
        {title}
        <button type="button" onClick={() => { setMuted((m) => !m); if (vid.current) vid.current.muted = !muted; }} aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/50 text-xs font-bold text-white backdrop-blur">{muted ? "🔇" : "🔊"}</button>
      </div>
    );
  }
  if (kind === "youtube" || kind === "drive") {
    const src = kind === "youtube" ? `https://www.youtube.com/embed/${youtubeId(it.url)}?autoplay=1&playsinline=1&rel=0` : driveEmbed(it.url);
    return (
      <div className={shell}>
        {play ? (
          <iframe src={src} title={it.title || "Video"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 size-full border-0" />
        ) : (
          <button type="button" className="absolute inset-0" onClick={() => setPlay(true)} aria-label={`Putar ${it.title || "video"}`}>{posterBg}{playBtn}{title}</button>
        )}
      </div>
    );
  }
  const href = it.link || it.url;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={shell} aria-label={it.title || "Buka video"}>
      {posterBg}{playBtn}{title}
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">{kind === "instagram" ? "Instagram" : kind === "tiktok" ? "TikTok" : "Buka"}</span>
    </a>
  );
}
