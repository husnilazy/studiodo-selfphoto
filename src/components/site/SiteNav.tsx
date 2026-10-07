"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../Icon";
import BrandMark from "./BrandMark";
import type { FontKey } from "@/lib/siteConfig";

const ALL = [
  { href: "/#layanan", label: "Layanan", key: "layanan" },
  { href: "/#background", label: "Background", key: "background" },
  { href: "/#galeri", label: "Galeri", key: "gallery" },
  { href: "/#cara", label: "Cara Booking", key: "cara" },
  { href: "/#lokasi", label: "Lokasi", key: "lokasi" },
  { href: "/#faq", label: "FAQ", key: "faq" },
];

export default function SiteNav({
  name, bookingOpen, logo, logoDark, logoHeight, text, textSize, textFont, announce, sections,
}: {
  name: string; bookingOpen: boolean; logo: string; logoDark: string; logoHeight: number; text: string; textSize: number; textFont: FontKey;
  announce: { enabled: boolean; text: string; link: string; link_label: string }; sections: string[];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const links = ALL.filter((l) => sections.includes(l.key));

  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 12);
      const h = document.documentElement.scrollHeight - innerHeight;
      setProgress(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${scrolled || open ? "glass shadow-sm" : ""}`}>
        {announce.enabled && announce.text && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 text-center text-xs font-semibold sm:text-sm" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)" }}>
            <span>{announce.text}</span>
            {announce.link && <Link href={announce.link} className="shrink-0 rounded-full bg-white/25 px-3 py-0.5 font-bold backdrop-blur transition hover:bg-white/40">{announce.link_label || "Lihat"}</Link>}
          </div>
        )}
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" onClick={() => setOpen(false)}><BrandMark name={name} logo={logo} logoDark={logoDark} height={logoHeight} text={text} textSize={textSize} textFont={textFont} /></Link>
          <nav className="hidden items-center gap-7 md:flex">
            {links.map((l) => <a key={l.href} href={l.href} className="text-sm font-semibold text-muted transition-colors hover:text-fg">{l.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            {bookingOpen && <Link href="/book" className="btn btn-primary !min-h-10 !rounded-full !px-5">Booking</Link>}
            <button className="btn !min-h-10 !w-10 !rounded-full !px-0 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <Icon name={open ? "x" : "menu"} className="size-5" />
            </button>
          </div>
        </div>
        <div className="h-0.5 origin-left bg-accent transition-transform duration-150" style={{ transform: `scaleX(${progress})` }} />
      </header>

      <div className={`fixed inset-0 z-30 transition-all duration-500 md:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`} aria-hidden={!open}>
        <div className="absolute inset-0 bg-bg/95 backdrop-blur-xl" onClick={() => setOpen(false)} />
        <nav className="relative flex h-full flex-col justify-center gap-2 px-8">
          {links.map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="font-display text-4xl font-semibold tracking-tight transition-all duration-500"
              style={{ transform: open ? "none" : "translateY(24px)", opacity: open ? 1 : 0, transitionDelay: open ? `${120 + i * 60}ms` : "0ms" }}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}
