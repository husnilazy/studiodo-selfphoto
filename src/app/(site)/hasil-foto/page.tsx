import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import ConceptGallery, { type ConceptGroup } from "@/components/site/ConceptGallery";
import { getSiteData } from "@/lib/siteData";
import { imageSrc } from "@/lib/siteConfig";
import { rupiah, waLink } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const { studio, site } = await getSiteData();
  const title = `Hasil Foto — ${studio.name}`;
  const description = site.gallery.subtitle || `Lihat hasil foto tiap paket di ${studio.name}. Semua foto diambil sendiri oleh pelanggan di studio kami.`;
  const first = site.gallery.items[0]?.url;
  return {
    title: { absolute: title }, description, robots: { index: true, follow: true },
    alternates: { canonical: "/hasil-foto" },
    openGraph: { title, description, type: "website", locale: "id_ID", siteName: studio.name, ...(first ? { images: [imageSrc(first)] } : {}) },
  };
}

export default async function ResultsPage() {
  const { studio, online, site, packages } = await getSiteData();
  const items = site.gallery.items;

  // Kelompokkan foto per paket (urutan paket mengikuti halaman layanan). Foto tanpa paket / paket sudah nonaktif → "Umum".
  const known = new Set(packages.map((p) => p.id));
  const groups: ConceptGroup[] = packages
    .map((p) => {
      const photos = items.filter((it) => it.package_id === p.id).map(({ url, caption }) => ({ url, caption }));
      const bookable = online.enabled && p.bookable_online && !p.is_event;
      // Sewa event tidak memakai slot studio: tombolnya mengarah ke WhatsApp.
      const eventLink = p.is_event && online.whatsapp ? waLink(online.whatsapp, `Halo ${studio.name}, saya tertarik sewa ${p.name}. Boleh tahu detail dan ketersediaannya?`) : "";
      return {
        key: String(p.id), name: p.name, description: p.description,
        priceText: p.price > 0 ? `Mulai ${rupiah(p.price)}` : "",
        meta: [p.is_event ? `Sewa ${p.base_hours} jam` : "", p.is_group ? "Paket grup" : "", p.is_event ? "" : p.max_people > 1 ? (p.min_people > 1 ? `${p.min_people}–${p.max_people} orang` : `1–${p.max_people} orang`) : "1 orang", p.is_event || !p.duration_min ? "" : `${p.duration_min} menit`].filter(Boolean).join(" · "),
        bookHref: bookable ? `/book?paket=${p.id}` : eventLink, photos,
        ...(eventLink ? { ctaLabel: "Tanya sewa", external: true } : {}),
      };
    })
    .filter((g) => g.photos.length > 0);
  const general = items.filter((it) => !known.has(it.package_id)).map(({ url, caption }) => ({ url, caption }));
  if (general.length) groups.push({ key: "umum", name: "Umum", description: "", priceText: "", meta: "", bookHref: online.enabled ? "/book" : "", photos: general });

  return (
    <main className="relative px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg"><Icon name="left" className="size-4" /> Beranda</Link>
        <header className="mx-auto mb-12 max-w-2xl text-center">
          {site.gallery.eyebrow && <p className="text-sm font-bold uppercase tracking-[.2em] text-accent">{site.gallery.eyebrow}</p>}
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Hasil foto tiap paket</h1>
          <p className="mt-4 text-muted">{site.gallery.subtitle || "Semua foto diambil sendiri oleh pelanggan di studio kami. Pilih paket yang gayanya paling kamu suka."}</p>
        </header>

        {groups.length === 0 ? (
          <div className="glass mx-auto max-w-md rounded-3xl p-10 text-center">
            <p className="font-display text-xl font-semibold">Foto sedang disiapkan</p>
            <p className="mt-2 text-muted">Hasil foto pelanggan akan segera tampil di sini.</p>
            {online.enabled && <Link href="/book" className="btn btn-primary mt-6">Booking {studio.name}</Link>}
          </div>
        ) : (
          <ConceptGallery groups={groups} />
        )}
      </div>
    </main>
  );
}
