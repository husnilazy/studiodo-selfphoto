import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import BrandMark from "@/components/site/BrandMark";
import Icon from "@/components/Icon";
import { getSiteData } from "@/lib/siteData";
import { FONT_FAMILY, imageSrc, onColor, visibleSections } from "@/lib/siteConfig";
import { packageImages } from "@/lib/packageUtils";
import { waLink } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { studio, online, site } = await getSiteData();
  const title = site.seo.title || `${studio.name} — Self Photo Studio, Photobox & Photobooth`;
  const description = site.seo.description || online.tagline || `Booking self photo studio, photobox, dan photobooth di ${studio.name}. Pilih paket, background, dan jadwal langsung dari HP.`;
  const icon = site.brand.favicon_url || site.brand.logo_url;
  return {
    title: { absolute: title }, description,
    robots: { index: true, follow: true },
    ...(icon ? { icons: { icon: imageSrc(icon) } } : {}),
    openGraph: { title, description, type: "website", locale: "id_ID", siteName: studio.name, ...(site.seo.og_image ? { images: [imageSrc(site.seo.og_image)] } : {}) },
  };
}

const mix = (hex: string, withHex: string, k: number) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(withHex.slice(1), 16);
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, "0")).join("")}`;
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { studio, online, site, rooms, packages } = await getSiteData();
  const b = site.brand;
  const darkA = mix(b.accent, "#ffffff", 0.28), darkB = mix(b.accent2, "#ffffff", 0.2);
  const vars = (a: string, a2: string) => `--accent:${a};--accent-2:${a2};--accent-fg:${onColor(a)};--accent-soft:color-mix(in oklab, ${a} 16%, var(--panel));--glow:color-mix(in oklab, ${a} 30%, transparent)`;
  const solid = site.style.mode === "solid";
  const st = site.style;
  // Gaya Solid: satu palet tetap (tidak mengikuti mode gelap/terang perangkat), tanpa gradien. Selektor dibuat lebih spesifik dari varian mode gelap di atas.
  const solidCss = solid
    ? `
html body .site[data-style="solid"]{--bg:${st.bg};--panel:${st.panel};--panel-2:color-mix(in oklab, ${st.fg} 6%, ${st.bg});--fg:${st.fg};--muted:color-mix(in oklab, ${st.fg} 64%, ${st.bg});--line:color-mix(in oklab, ${st.fg} 14%, ${st.bg});--accent:${b.accent};--accent-fg:${onColor(b.accent)};--accent-soft:color-mix(in oklab, ${b.accent} 12%, ${st.bg});--glow:transparent;background:${st.bg};color:${st.fg};color-scheme:${onColor(st.bg) === "#ffffff" ? "dark" : "light"}}
html body .site[data-style="solid"] .font-display{font-family:${FONT_FAMILY[st.display_font]}}`
    : "";
  const css = `.site{${vars(b.accent, b.accent2)}}
html[data-theme="dark"] .site{${vars(darkA, darkB)}}
@media (prefers-color-scheme: dark){html:not([data-theme="light"]) .site{${vars(darkA, darkB)}}}${solidCss}`;

  const navSections = visibleSections(site, { rooms: rooms.filter((r) => packageImages(r).length > 0).length, packages: packages.length });
  const f = site.footer;
  const social: [string, string][] = ([
    ["Instagram", online.instagram ? `https://instagram.com/${online.instagram}` : ""], ["TikTok", f.tiktok], ["YouTube", f.youtube], ["Facebook", f.facebook],
  ] as [string, string][]).filter(([, u]) => u);

  return (
    <div className="site min-h-dvh" data-style={solid ? "solid" : "gradient"}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <SiteNav name={studio.name} bookingOpen={online.enabled} logo={b.logo_url} logoDark={b.logo_dark_url} logoHeight={b.logo_height} text={b.text} textSize={b.text_size} textFont={b.text_font}
        announce={site.announce} sections={navSections} />
      {children}
      <footer className="border-t border-line/70 px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandMark name={studio.name} logo={b.logo_url} logoDark={b.logo_dark_url} height={b.logo_height} text={b.text} textSize={b.text_size} textFont={b.text_font} />
            {f.about && <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{f.about}</p>}
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-muted">Hubungi</p>
            <ul className="space-y-2 text-sm font-semibold">
              {online.whatsapp && <li><a href={waLink(online.whatsapp, "Halo, saya ingin bertanya.")} target="_blank" rel="noopener noreferrer" className="hover:text-accent">WhatsApp</a></li>}
              {f.email && <li><a href={`mailto:${f.email}`} className="hover:text-accent">{f.email}</a></li>}
              {social.map(([n, u]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{n}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-muted">Jelajahi</p>
            <ul className="space-y-2 text-sm font-semibold">
              {online.enabled && <li><Link href="/book" className="hover:text-accent">Booking online</Link></li>}
              <li><Link href="/anggota" className="hover:text-accent">Area Member</Link></li>
              <li><a href="/#layanan" className="hover:text-accent">Layanan</a></li>
              <li><Link href="/hasil-foto" className="hover:text-accent">Hasil Foto</Link></li>
              <li><a href="/#lokasi" className="hover:text-accent">Lokasi</a></li>
              <li><Link href="/privasi" className="hover:text-accent">Kebijakan Privasi</Link></li>
              <li><Link href="/syarat" className="hover:text-accent">Syarat Layanan</Link></li>
              <li><Link href="/login" className="inline-flex items-center gap-1 text-muted hover:text-fg"><Icon name="lock" className="size-3.5" /> Masuk staf</Link></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-center text-xs text-muted">{f.copyright || `© ${new Date().getFullYear()} ${studio.name}. Semua hak dilindungi.`}</p>
      </footer>
    </div>
  );
}
