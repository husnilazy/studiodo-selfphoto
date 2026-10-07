// Konfigurasi konten website (CMS). Aman dipakai di server & client.

export const FONT_OPTIONS = [
  ["sora", "Sora (bawaan)"], ["jakarta", "Plus Jakarta Sans"], ["playfair", "Playfair Display (elegan)"],
  ["space", "Space Grotesk (modern)"], ["bebas", "Bebas Neue (kapital tebal)"], ["caveat", "Caveat (tulisan tangan)"],
] as const;
export type FontKey = (typeof FONT_OPTIONS)[number][0];
export const FONT_FAMILY: Record<FontKey, string> = {
  sora: "var(--font-sora), system-ui, sans-serif", jakarta: "var(--font-jakarta), system-ui, sans-serif",
  playfair: "var(--font-playfair), Georgia, serif", space: "var(--font-space), system-ui, sans-serif",
  bebas: "var(--font-bebas), Impact, sans-serif", caveat: "var(--font-caveat), cursive",
};

export type SectionKey = "reels" | "layanan" | "background" | "gallery" | "cara" | "testimoni" | "lokasi" | "faq" | "cta";
export const SECTION_LABEL: Record<SectionKey, string> = {
  reels: "Reels & Video", layanan: "Layanan & Harga", background: "Background & Tema", gallery: "Galeri Foto",
  cara: "Cara Booking", testimoni: "Testimoni", lokasi: "Lokasi & Kontak", faq: "FAQ", cta: "Ajakan Booking (CTA)",
};
export const SECTION_KEYS = Object.keys(SECTION_LABEL) as SectionKey[];

export type Heading = { enabled: boolean; eyebrow: string; title: string; subtitle: string };
export type SiteConfig = {
  brand: { logo_url: string; logo_dark_url: string; favicon_url: string; logo_height: number; show_name: boolean; text: string; text_size: number; text_font: FontKey; accent: string; accent2: string };
  announce: { enabled: boolean; text: string; link: string; link_label: string };
  hero: {
    badge: string; title: string; highlight: string; subtitle: string; cta1: string; cta2: string;
    media_type: "strips" | "video" | "image"; media_layout: "frame" | "background"; media_url: string; poster_url: string; overlay: number;
  };
  stats: { items: { value: string; label: string }[] };
  marquee: { enabled: boolean; words: string[] };
  reels: Heading & { items: { title: string; url: string; poster_url: string; link: string }[] };
  layanan: Heading;
  background: Heading;
  gallery: Heading & { items: { url: string; caption: string }[] };
  cara: Heading;
  testimoni: Heading & { items: { name: string; role: string; text: string; rating: number; avatar_url: string }[] };
  lokasi: Heading & { address: string; hours_note: string; maps_embed: string; photo_url: string; whatsapp: string; instagram: string; maps_url: string };
  faq: Heading & { items: { q: string; a: string }[] };
  cta: Heading & { button: string };
  footer: { about: string; instagram: string; tiktok: string; youtube: string; facebook: string; email: string; copyright: string };
  seo: { title: string; description: string; og_image: string };
  order: SectionKey[];
};

const H = (eyebrow: string, title: string, subtitle = ""): Heading => ({ enabled: true, eyebrow, title, subtitle });

export const DEFAULT_SITE: SiteConfig = {
  brand: { logo_url: "", logo_dark_url: "", favicon_url: "", logo_height: 32, show_name: true, text: "", text_size: 16, text_font: "sora", accent: "#4f4fe8", accent2: "#a78bfa" },
  announce: { enabled: false, text: "Promo spesial minggu ini — booking online sekarang!", link: "/book", link_label: "Booking" },
  hero: {
    badge: "Slot hari ini masih tersedia", title: "Abadikan momen,", highlight: "tanpa ribet.", subtitle: "",
    cta1: "Booking Sekarang", cta2: "Lihat Layanan",
    media_type: "strips", media_layout: "frame", media_url: "", poster_url: "", overlay: 55,
  },
  stats: { items: [] },
  marquee: { enabled: true, words: ["Self Photo", "Photobox", "Photobooth Event", "Wisuda", "Couple", "Keluarga", "Ulang Tahun", "Profile Pic", "Sahabat", "Maternity", "Prewedding", "Content Creator"] },
  reels: { ...H("Sedang Ramai", "Intip suasananya", "Video singkat dari sesi foto di studio kami."), items: [] },
  layanan: H("Layanan", "Pilih gaya fotomu"),
  background: H("Background & Tema", "Satu studio, banyak suasana", "Pilih set yang paling cocok dengan momenmu. Setiap set bisa dipesan terpisah, jadi jadwalmu tidak akan bentrok."),
  gallery: { ...H("Galeri", "Hasil foto pelanggan"), items: [] },
  cara: H("Cara Booking", "Empat langkah, selesai"),
  testimoni: { ...H("Testimoni", "Kata mereka"), items: [] },
  lokasi: { ...H("Kunjungi Kami", "Datang & berfoto"), address: "", hours_note: "", maps_embed: "", photo_url: "", whatsapp: "", instagram: "", maps_url: "" },
  faq: { ...H("FAQ", "Pertanyaan umum"), items: [] },
  cta: { ...H("", "Siap berfoto?", "Kunci jadwalmu sekarang sebelum slot favorit habis."), button: "Booking Sekarang" },
  footer: { about: "", instagram: "", tiktok: "", youtube: "", facebook: "", email: "", copyright: "" },
  seo: { title: "", description: "", og_image: "" },
  order: ["reels", "layanan", "background", "gallery", "cara", "testimoni", "lokasi", "faq", "cta"],
};

/* ───────── Sanitasi (dipakai server sebelum menyimpan & saat membaca) ───────── */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.trim().slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const url = (v: unknown, d = "") => {
  const s = str(v, 600, d);
  return s === "" || /^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s) ? s : d;
};
const color = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : d);
const list = <T,>(v: unknown, max: number, f: (x: Obj) => T | null): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max).filter(isObj).map(f).filter((x): x is T => x !== null);
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

const heading = (v: unknown, d: Heading): Heading => {
  const o = isObj(v) ? v : {};
  return { enabled: bool(o.enabled, d.enabled), eyebrow: str(o.eyebrow, 60, d.eyebrow), title: str(o.title, 120, d.title), subtitle: str(o.subtitle, 300, d.subtitle) };
};

export function sanitizeSite(input: unknown): SiteConfig {
  const D = DEFAULT_SITE;
  const r: Obj = isObj(input) ? input : {};
  const o = (k: string): Obj => (isObj(r[k]) ? (r[k] as Obj) : {});
  const b = o("brand"), a = o("announce"), h = o("hero"), mq = o("marquee"), ft = o("footer"), se = o("seo"), lk = o("lokasi");

  const order = list<SectionKey>(Array.isArray(r.order) ? (r.order as unknown[]).map((k) => ({ k })) : [], 20, (x) => (SECTION_KEYS.includes(x.k as SectionKey) ? (x.k as SectionKey) : null));
  const seen = new Set<SectionKey>();
  const finalOrder = [...order, ...D.order].filter((k) => (seen.has(k) ? false : (seen.add(k), true)));

  return {
    brand: {
      logo_url: url(b.logo_url), logo_dark_url: url(b.logo_dark_url), favicon_url: url(b.favicon_url),
      logo_height: num(b.logo_height, 18, 72, D.brand.logo_height), show_name: bool(b.show_name, D.brand.show_name),
      text: str(b.text, 40), text_size: num(b.text_size, 10, 40, D.brand.text_size), text_font: pick(b.text_font, FONT_OPTIONS.map((f) => f[0]), D.brand.text_font),
      accent: color(b.accent, D.brand.accent), accent2: color(b.accent2, D.brand.accent2),
    },
    announce: { enabled: bool(a.enabled, false), text: str(a.text, 200, D.announce.text), link: url(a.link, D.announce.link), link_label: str(a.link_label, 30, D.announce.link_label) },
    hero: {
      badge: str(h.badge, 80, D.hero.badge), title: str(h.title, 80, D.hero.title), highlight: str(h.highlight, 60, D.hero.highlight), subtitle: str(h.subtitle, 400),
      cta1: str(h.cta1, 40, D.hero.cta1), cta2: str(h.cta2, 40, D.hero.cta2),
      media_type: pick(h.media_type, ["strips", "video", "image"] as const, "strips"), media_layout: pick(h.media_layout, ["frame", "background"] as const, "frame"),
      media_url: url(h.media_url), poster_url: url(h.poster_url), overlay: num(h.overlay, 0, 90, D.hero.overlay),
    },
    stats: { items: list(o("stats").items, 4, (x) => (str(x.value, 20) ? { value: str(x.value, 20), label: str(x.label, 40) } : null)) },
    marquee: { enabled: bool(mq.enabled, true), words: (Array.isArray(mq.words) ? mq.words : D.marquee.words).map((w) => str(w, 40)).filter(Boolean).slice(0, 30) },
    reels: { ...heading(r.reels, D.reels), items: list(o("reels").items, 12, (x) => (url(x.url) ? { title: str(x.title, 80), url: url(x.url), poster_url: url(x.poster_url), link: url(x.link) } : null)) },
    layanan: heading(r.layanan, D.layanan),
    background: heading(r.background, D.background),
    gallery: { ...heading(r.gallery, D.gallery), items: list(o("gallery").items, 24, (x) => (url(x.url) ? { url: url(x.url), caption: str(x.caption, 100) } : null)) },
    cara: heading(r.cara, D.cara),
    testimoni: {
      ...heading(r.testimoni, D.testimoni),
      items: list(o("testimoni").items, 12, (x) => (str(x.text, 400) ? { name: str(x.name, 60, "Pelanggan"), role: str(x.role, 60), text: str(x.text, 400), rating: Math.round(num(x.rating, 1, 5, 5)), avatar_url: url(x.avatar_url) } : null)),
    },
    lokasi: {
      ...heading(r.lokasi, D.lokasi), address: str(lk.address, 300), hours_note: str(lk.hours_note, 200), maps_embed: str(lk.maps_embed, 1200), photo_url: url(lk.photo_url),
      whatsapp: str(lk.whatsapp, 20).replace(/[^\d+]/g, ""), instagram: str(lk.instagram, 40).replace(/^@/, "").replace(/[^\w.]/g, ""), maps_url: url(lk.maps_url),
    },
    faq: { ...heading(r.faq, D.faq), items: list(o("faq").items, 20, (x) => (str(x.q, 160) && str(x.a, 800) ? { q: str(x.q, 160), a: str(x.a, 800) } : null)) },
    cta: { ...heading(r.cta, D.cta), button: str(o("cta").button, 40, D.cta.button) },
    footer: {
      about: str(ft.about, 300), instagram: url(ft.instagram), tiktok: url(ft.tiktok), youtube: url(ft.youtube), facebook: url(ft.facebook),
      email: str(ft.email, 80), copyright: str(ft.copyright, 120),
    },
    seo: { title: str(se.title, 90), description: str(se.description, 200), og_image: url(se.og_image) },
    order: finalOrder,
  };
}

/* ───────── Media ───────── */
export type MediaKind = "video" | "youtube" | "drive" | "instagram" | "tiktok" | "image" | "empty";

const driveId = (u: string) => /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/.exec(u)?.[1] ?? null;
export const youtubeId = (u: string) => /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/.exec(u)?.[1] ?? null;

export function mediaKind(u: string): MediaKind {
  if (!u) return "empty";
  if (youtubeId(u)) return "youtube";
  if (/instagram\.com/i.test(u)) return "instagram";
  if (/tiktok\.com/i.test(u)) return "tiktok";
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return "video";
  if (driveId(u)) return /\.(png|jpe?g|gif|webp|avif)/i.test(u) ? "image" : "drive";
  return "image";
}
/** Link Google Drive → URL gambar yang bisa ditampilkan langsung. */
export function imageSrc(u: string): string {
  const id = driveId(u);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w1600` : u;
}
export const driveEmbed = (u: string) => { const id = driveId(u); return id ? `https://drive.google.com/file/d/${id}/preview` : u; };
export const youtubeThumb = (u: string) => { const id = youtubeId(u); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ""; };

/** Ambil src dari `<iframe>` Google Maps, atau link embed; kembalikan "" jika tidak valid. */
export function mapsEmbedSrc(input: string, address: string): string {
  const m = /src=["']([^"']+)["']/.exec(input);
  const u = (m ? m[1] : input).trim();
  if (/^https:\/\/www\.google\.com\/maps\/embed/i.test(u)) return u;
  if (address) return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return "";
}

/** Warna teks (putih/hitam) yang kontras di atas warna latar. */
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0b1020" : "#ffffff";
}

/** Section yang benar-benar tampil: aktif dan punya isi. */
export function visibleSections(site: SiteConfig, d: { rooms: number; packages: number }): SectionKey[] {
  const has: Record<SectionKey, boolean> = {
    reels: site.reels.items.length > 0, layanan: d.packages > 0, background: d.rooms > 0, gallery: site.gallery.items.length > 0,
    cara: true, testimoni: site.testimoni.items.length > 0, lokasi: true, faq: true, cta: true,
  };
  return site.order.filter((k) => (site[k] as Heading).enabled && has[k]);
}
