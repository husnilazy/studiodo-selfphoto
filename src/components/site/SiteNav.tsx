"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../Icon";
import BrandMark from "./BrandMark";
import type { FontKey } from "@/lib/siteConfig";

const ALL = [
  { href: "/#layanan", label: "Layanan", key: "layanan" },
  { href: "/#background", label: "Background", key: "background" },
  { href: "/hasil-foto", label: "Hasil Foto", key: "gallery" },
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
  // "Hasil Foto" selalu ada: halamannya punya tampilan sendiri meski galeri belum berisi foto.
  const links = [...ALL.filter((l) => l.key === "gallery" || sections.includes(l.key)), { href: "/anggota", label: "Member", key: "member" }];

  // Menu aktif: halaman sendiri (Hasil Foto, Member) atau bagian beranda yang sedang berada di tengah layar.
  const path = usePathname();
  const [spy, setSpy] = useState("");
  const active = path.startsWith("/hasil-foto") ? "gallery" : path.startsWith("/anggota") ? "member" : path === "/" ? spy : "";
  useEffect(() => {
    if (path !== "/" || typeof IntersectionObserver === "undefined") return;
    const ids = links.filter((l) => l.href.startsWith("/#")).map((l) => l.href.slice(2));
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) setSpy(links.find((l) => l.href === `/#${e.target.id}`)?.key ?? ""); },
      { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((e) => io.observe(e));
    const top = () => { if (window.scrollY < 200) setSpy(""); };
    window.addEventListener("scroll", top, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", top); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, sections.join()]);

  // Penanda (pill) yang bergeser mengikuti menu aktif.
  const rail = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = rail.current?.querySelector<HTMLElement>(`[data-key="${active}"]`);
      setPill(a ? { x: a.offsetLeft, w: a.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, sections.join()]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
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
      <header className={`nav-base fixed inset-x-0 top-0 z-40 ${scrolled || open ? "nav-glass" : ""}`}>
        {announce.enabled && announce.text && (
          <div className="site-announce flex items-center justify-center gap-3 px-4 py-2 text-center text-xs font-semibold sm:text-sm" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))", color: "var(--accent-fg)" }}>
            <span>{announce.text}</span>
            {announce.link && <Link href={announce.link} className="shrink-0 rounded-full bg-white/25 px-3 py-0.5 font-bold backdrop-blur transition hover:bg-white/40">{announce.link_label || "Lihat"}</Link>}
          </div>
        )}
        <div className={`site-navbar mx-auto flex max-w-6xl transition-[height] duration-500 ${scrolled ? "h-14" : "h-16"} items-center justify-between px-4 sm:px-6`}>
          <Link href="/" onClick={() => setOpen(false)}><BrandMark name={name} logo={logo} logoDark={logoDark} height={logoHeight} text={text} textSize={textSize} textFont={textFont} /></Link>
          <nav ref={rail} className="relative hidden items-center gap-1 md:flex">
            <span aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-accentsoft ring-1 ring-accent/25 transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(.3,1.25,.4,1)]"
              style={{ width: pill?.w ?? 0, transform: `translateX(${pill?.x ?? 0}px)`, opacity: pill ? 1 : 0 }} />
            {links.map((l) => (
              <a key={l.href} href={l.href} data-key={l.key} aria-current={active === l.key ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors hover:text-fg ${active === l.key ? "text-accent" : "text-muted"}`}>{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {bookingOpen && <Link href="/book" className="btn btn-primary !min-h-10 !rounded-full !px-5">Booking</Link>}
            <button className="btn !min-h-10 !w-10 !rounded-full !px-0 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <Icon name={open ? "x" : "menu"} className="size-5" />
            </button>
          </div>
        </div>
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
