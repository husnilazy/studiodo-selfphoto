import Link from "next/link";
import Icon from "@/components/Icon";
import CountUp from "@/components/site/CountUp";
import GalleryGrid from "@/components/site/GalleryGrid";
import PackageTabs from "@/components/site/PackageTabs";
import ReelsRail from "@/components/site/ReelsRail";
import Reveal from "@/components/site/Reveal";
import { Accordion, Depth, MouseStage, Parallax, ScrollMarquee, SpotlightListener, SplitTitle, Tilt } from "@/components/site/motion";
import { getSiteData, roomGradient } from "@/lib/siteData";
import { driveEmbed, imageSrc, mapsEmbedSrc, mediaKind, visibleSections, youtubeId, type Heading, type SectionKey, type SiteConfig } from "@/lib/siteConfig";
import { rupiah, waLink } from "@/lib/format";

type Data = Awaited<ReturnType<typeof getSiteData>>;

export default async function Landing() {
  const d = await getSiteData();
  const { online, site, packages, rooms } = d;
  const show = visibleSections(site, { rooms: rooms.length, packages: packages.length });
  const bgHero = site.hero.media_type !== "strips" && site.hero.media_layout === "background" && !!site.hero.media_url;

  const SECTIONS: Record<SectionKey, () => React.ReactNode> = {
    reels: () => <Reels site={site} />,
    layanan: () => <Services d={d} />,
    background: () => <Backgrounds d={d} />,
    gallery: () => <GallerySec site={site} />,
    cara: () => <Steps d={d} />,
    testimoni: () => <Testimonials site={site} />,
    lokasi: () => <Location d={d} />,
    faq: () => <Faq d={d} />,
    cta: () => <Cta d={d} />,
  };

  return (
    <main>
      <SpotlightListener />
      <Hero d={d} bgHero={bgHero} />
      {site.marquee.enabled && site.marquee.words.length > 0 && <ScrollMarquee words={site.marquee.words} />}
      {show.map((k) => <div key={k}>{SECTIONS[k]()}</div>)}
      {online.whatsapp && (
        <a href={waLink(online.whatsapp, "Halo, saya ingin bertanya.")} target="_blank" rel="noopener noreferrer" aria-label="Chat WhatsApp"
          className="btn btn-primary btn-glow fixed bottom-5 right-5 z-30 !min-h-14 !w-14 !rounded-full !px-0"><Icon name="chat" className="size-6" /></a>
      )}
    </main>
  );
}

function SectionHead({ h, className = "mb-12" }: { h: Heading; className?: string }) {
  return (
    <Reveal variant="blur" className={`mx-auto max-w-2xl text-center ${className}`}>
      {h.eyebrow && (
        <p className="text-sm font-bold uppercase tracking-[.2em] text-accent">
          <span className="eyebrow-line" />{h.eyebrow}<span className="eyebrow-line" />
        </p>
      )}
      <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl"><SplitTitle text={h.title} /></h2>
      {h.subtitle && <p className="mt-4 text-muted">{h.subtitle}</p>}
    </Reveal>
  );
}

/** Gumpalan warna lembut di latar section yang bergerak dengan kecepatan berbeda saat scroll. */
function Blobs({ a = "left", b = "right" }: { a?: "left" | "right"; b?: "left" | "right" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Parallax speed={0.18} className={`absolute top-10 ${a === "left" ? "-left-24" : "-right-24"}`}>
        <div className="orb size-72 rounded-full bg-accent/10 blur-3xl" />
      </Parallax>
      <Parallax speed={-0.12} className={`absolute bottom-10 ${b === "left" ? "-left-20" : "-right-20"}`}>
        <div className="orb size-80 rounded-full blur-3xl" style={{ background: "color-mix(in oklab, var(--accent-2) 14%, transparent)", animationDelay: "-6s" }} />
      </Parallax>
    </div>
  );
}

/* ───────── HERO ───────── */
function MediaBox({ url, poster, className = "" }: { url: string; poster: string; className?: string }) {
  const kind = mediaKind(url);
  if (kind === "video") return <video src={url} poster={poster ? imageSrc(poster) : undefined} autoPlay muted loop playsInline preload="auto" className={className} />;
  if (kind === "youtube") {
    const id = youtubeId(url);
    return <iframe title="Video" src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0`} allow="autoplay; encrypted-media" className={`${className} pointer-events-none border-0`} />;
  }
  if (kind === "drive") return <iframe title="Video" src={driveEmbed(url)} allow="autoplay" className={`${className} border-0`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc(url)} alt="" className={className} />;
}

function Hero({ d, bgHero }: { d: Data; bgHero: boolean }) {
  const { studio, online, site, packages, rooms } = d;
  const h = site.hero, open = online.enabled;
  const minPrice = packages.length ? Math.min(...packages.map((p) => p.price)) : 0;
  const strip = rooms.slice(0, 3);
  const fallbackColors = ["#4f4fe8", "#a78bfa", "#f472b6"];
  const hasMedia = h.media_type !== "strips" && !!h.media_url;
  const muted = bgHero ? "text-white/80" : "text-muted";
  const stats = site.stats.items.length ? site.stats.items : [
    { value: rooms.length ? `${rooms.length}` : "", label: "pilihan background" },
    { value: minPrice ? `${Math.round(minPrice / 1000)}rb` : "", label: "mulai dari" },
    { value: `${studio.open.replace(":00", "")}–${studio.close.replace(":00", "")}`, label: "jam buka" },
  ].filter((s) => s.value);

  return (
    <section className={`relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pt-40 ${bgHero ? "text-white" : ""}`}>
      {bgHero ? (
        <>
          <Parallax speed={0.12} className="absolute -inset-y-16 inset-x-0"><MediaBox url={h.media_url} poster={h.poster_url} className="h-[calc(100%+8rem)] w-full object-cover" /></Parallax>
          <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(5,6,15,${h.overlay / 100 + 0.15}), rgba(5,6,15,${h.overlay / 100}) 60%, var(--bg))` }} />
        </>
      ) : (
        <>
          <Parallax speed={0.22} className="absolute -left-24 top-24"><div className="orb pointer-events-none size-72 rounded-full bg-accent/15 blur-3xl" /></Parallax>
          <Parallax speed={-0.1} className="absolute -right-20 bottom-0"><div className="orb pointer-events-none size-80 rounded-full blur-3xl" style={{ background: "color-mix(in oklab, var(--accent-2) 22%, transparent)", animationDelay: "-5s" }} /></Parallax>
        </>
      )}
      <div className={`relative mx-auto grid max-w-6xl items-center gap-14 ${bgHero ? "" : "lg:grid-cols-[1.1fr_1fr]"}`}>
        <Parallax speed={0.1} fade>
          {h.badge && <Reveal immediate><span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide"><span className="size-2 animate-pulse rounded-full bg-ok" /> {h.badge}</span></Reveal>}
          <h1 className="font-display mt-6 text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            <SplitTitle text={h.title} delay={120} immediate />
            {h.highlight && <><br /><SplitTitle text={h.highlight} gradient delay={380} immediate /></>}
          </h1>
          <Reveal delay={500} immediate>
            <p className={`mt-6 max-w-xl text-lg leading-relaxed ${muted}`}>
              {h.subtitle || online.tagline || `${studio.name} — self photo studio dengan berbagai pilihan background, photobox bertema, dan photobooth untuk acara. Pilih jadwal, datang, dan berfoto sepuasnya.`}
            </p>
          </Reveal>
          <Reveal delay={620} immediate>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {open && h.cta1 && <Link href="/book" className="btn btn-primary btn-hero btn-glow">{h.cta1} <Icon name="right" className="size-5" /></Link>}
              {h.cta2 && <a href="#layanan" className="btn btn-hero glass">{h.cta2}</a>}
            </div>
          </Reveal>
          {stats.length > 0 && (
            <Reveal delay={760} immediate>
              <dl className={`mt-12 grid max-w-xl gap-6 ${stats.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                {stats.map((s) => (
                  <div key={s.label + s.value}><dt className="font-display text-3xl font-semibold tracking-tight"><CountUp value={s.value} /></dt><dd className={`mt-0.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>{s.label}</dd></div>
                ))}
              </dl>
            </Reveal>
          )}
        </Parallax>

        {!bgHero && hasMedia && (
          <Parallax speed={-0.06}>
            <Reveal delay={300} immediate className="relative mx-auto w-full max-w-[19rem] sm:max-w-sm">
              <MouseStage className="relative">
                <div aria-hidden className="orb absolute -inset-6 rounded-[3rem] opacity-70 blur-2xl" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }} />
                <Depth dx={-14} dy={-10}>
                  <div className="floaty relative aspect-[9/16] overflow-hidden rounded-[2.2rem] border-[6px] border-white/80 bg-zinc-900 shadow-2xl" style={{ ["--r" as string]: "2deg" }}>
                    <MediaBox url={h.media_url} poster={h.poster_url} className="absolute inset-0 size-full object-cover" />
                  </div>
                </Depth>
                <Depth dx={26} dy={18} className="absolute -bottom-3 -left-3">
                  <span className="glass floaty block rounded-2xl px-4 py-3 text-sm font-bold" style={{ animationDelay: "-3s" }}>✨ Hasil langsung dikirim</span>
                </Depth>
              </MouseStage>
            </Reveal>
          </Parallax>
        )}

        {!bgHero && !hasMedia && (
          <div aria-hidden>
            <Parallax speed={-0.06}>
              <MouseStage className="relative mx-auto h-[26rem] w-full max-w-md sm:h-[32rem]">
                {[0, 1, 2].map((i) => {
                  const r = strip[i];
                  const color = r?.color ?? fallbackColors[i];
                  const pos = ["left-0 top-8", "left-1/3 top-0", "right-0 top-16"][i];
                  const rot = ["-8deg", "3deg", "10deg"][i];
                  return (
                    <Depth key={i} dx={[-22, 8, 28][i]} dy={[-12, -20, 14][i]} className="absolute inset-0">
                      <Reveal immediate delay={250 + i * 150} className={`absolute ${pos}`}>
                        <div className="floaty w-[9.5rem] rounded-2xl bg-white p-2.5 shadow-2xl shadow-black/20 sm:w-44" style={{ ["--r" as string]: rot, transform: `rotate(${rot})`, animationDelay: `${-i * 2.2}s` }}>
                          <div className="space-y-2">
                            {[0, 1, 2].map((j) => (
                              <div key={j} className="relative aspect-[4/3] overflow-hidden rounded-lg" style={{ background: r?.image_url && j === 0 ? undefined : roomGradient(color), opacity: 1 - j * 0.08 }}>
                                {r?.image_url && j === 0 ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={imageSrc(r.image_url)} alt="" className="size-full object-cover" />
                                ) : <Icon name="camera" className="absolute inset-0 m-auto size-6 text-white/55" />}
                              </div>
                            ))}
                          </div>
                          <p className="font-display mt-2 text-center text-[10px] font-bold tracking-[.25em] text-zinc-400">{studio.name.toUpperCase()}</p>
                        </div>
                      </Reveal>
                    </Depth>
                  );
                })}
                <Depth dx={30} dy={20} className="absolute -bottom-2 left-4">
                  <span className="glass floaty block rounded-2xl px-4 py-3 text-sm font-bold" style={{ animationDelay: "-3s" }}>✨ Hasil langsung dikirim</span>
                </Depth>
              </MouseStage>
            </Parallax>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────── Section ───────── */
function Reels({ site }: { site: SiteConfig }) {
  return (
    <section id="reels" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs a="right" b="left" />
      <div className="mx-auto max-w-6xl">
        <SectionHead h={site.reels} className="mb-10" />
        <Reveal variant="zoom"><ReelsRail items={site.reels.items} /></Reveal>
      </div>
    </section>
  );
}

function Services({ d }: { d: Data }) {
  const { site, packages, addons, online } = d;
  return (
    <section id="layanan" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs />
      <div className="mx-auto max-w-6xl">
        <SectionHead h={site.layanan} />
        <Reveal variant="up"><PackageTabs packages={packages} bookingOpen={online.enabled} /></Reveal>
        {addons.length > 0 && (
          <Reveal className="mt-10" variant="zoom">
            <div className="glass spot mx-auto max-w-3xl rounded-3xl p-6 text-center">
              <p className="font-display font-semibold">Tambahan opsional</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {addons.map((a) => <span key={a.id} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold">{a.name} <span className="text-accent">{rupiah(a.price)}</span></span>)}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

function Backgrounds({ d }: { d: Data }) {
  const { site, rooms, online } = d;
  const open = online.enabled;
  return (
    <section id="background" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs a="right" b="left" />
      <div className="mx-auto max-w-6xl">
        <SectionHead h={site.background} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 120} variant="zoom">
              <Tilt max={5}>
                <Link href={open ? `/book?room=${r.id}` : "#lokasi"} className="lift group relative block aspect-[5/4] overflow-hidden rounded-3xl sm:aspect-[4/5]">
                  <Parallax speed={-0.07} className="absolute inset-0" innerClassName="absolute -inset-[14%]">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageSrc(r.image_url)} alt={r.name} loading="lazy" className="size-full object-cover transition-transform duration-[900ms] group-hover:scale-110" />
                    ) : (
                      <div className="size-full transition-transform duration-[900ms] group-hover:scale-110" style={{ background: roomGradient(r.color) }} />
                    )}
                  </Parallax>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <h3 className="font-display text-2xl font-semibold leading-tight">{r.name}</h3>
                    {r.description && <p className="mt-1 text-sm text-white/80">{r.description}</p>}
                    {open && <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold opacity-0 transition-all duration-500 group-hover:translate-x-1 group-hover:opacity-100">Booking set ini <Icon name="right" className="size-4" /></span>}
                  </div>
                </Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function GallerySec({ site }: { site: SiteConfig }) {
  return (
    <section id="galeri" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs />
      <div className="mx-auto max-w-6xl">
        <SectionHead h={site.gallery} />
        <GalleryGrid items={site.gallery.items} />
      </div>
    </section>
  );
}

function Steps({ d }: { d: Data }) {
  const { site, online } = d;
  const steps = [
    { icon: "box", t: "Pilih layanan", d: "Self photo, photobox, atau photobooth — lengkap dengan harga dan durasi." },
    { icon: "layout", t: "Pilih background & jadwal", d: "Lihat jam yang masih kosong secara langsung, tanpa tanya-tanya dulu." },
    { icon: "dollar", t: online.dp_percent > 0 ? `DP ${online.dp_percent}% untuk mengunci` : "Konfirmasi booking", d: online.dp_percent > 0 ? "Transfer DP sesuai petunjuk, lalu konfirmasi lewat WhatsApp." : "Kirim booking, tim kami akan mengonfirmasi lewat WhatsApp." },
    { icon: "camera", t: "Datang & berfoto", d: "Hasil foto dikirim lewat link, tinggal unduh dan bagikan." },
  ];
  return (
    <section id="cara" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs a="right" b="left" />
      <div className="mx-auto max-w-6xl">
        <SectionHead h={site.cara} className="mb-14" />
        <ol className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="pointer-events-none absolute left-[12%] right-[12%] top-[2.25rem] z-0 hidden lg:block" variant="blur">
            <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }} />
          </Reveal>
          {steps.map((s, i) => (
            <Reveal as="li" key={s.t} delay={i * 130} variant={i % 2 ? "up" : "zoom"} className="relative z-10">
              <Tilt max={7} className="h-full">
                <div className="glass lift spot h-full rounded-3xl p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accentfg shadow-lg shadow-accent/30"><Icon name={s.icon} className="size-6" /></span>
                    <span className="font-display text-5xl font-bold text-line">{i + 1}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
                </div>
              </Tilt>
            </Reveal>
          ))}
        </ol>
        {online.enabled && <Reveal className="mt-12 text-center" variant="zoom" delay={200}><Link href="/book" className="btn btn-primary btn-hero btn-glow">Mulai Booking <Icon name="right" className="size-5" /></Link></Reveal>}
      </div>
    </section>
  );
}

function Testimonials({ site }: { site: SiteConfig }) {
  return (
    <section id="testimoni" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs />
      <div className="mx-auto max-w-6xl">
        <SectionHead h={site.testimoni} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {site.testimoni.items.map((t, i) => (
            <Reveal key={i} delay={(i % 3) * 110} variant={["left", "up", "right"][i % 3] as "left" | "up" | "right"}>
              <figure className="glass lift spot h-full rounded-3xl p-6">
                <p className="text-lg tracking-widest text-amber-400" aria-label={`${t.rating} dari 5 bintang`}>{"★".repeat(t.rating)}<span className="text-line">{"★".repeat(5 - t.rating)}</span></p>
                <blockquote className="mt-3 leading-relaxed">“{t.text}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  {t.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageSrc(t.avatar_url)} alt="" className="size-11 rounded-full object-cover" />
                  ) : <span className="font-display grid size-11 place-items-center rounded-full bg-accent text-lg font-semibold text-accentfg">{t.name.slice(0, 1).toUpperCase()}</span>}
                  <span><span className="block font-semibold">{t.name}</span>{t.role && <span className="text-sm text-muted">{t.role}</span>}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Location({ d }: { d: Data }) {
  const { studio, online, site } = d;
  const l = site.lokasi;
  const address = l.address || studio.address;
  const map = mapsEmbedSrc(l.maps_embed, address);
  const mapsUrl = online.maps_url || l.maps_url;
  return (
    <section id="lokasi" className="relative scroll-mt-16 px-4 py-24 sm:px-6">
      <Blobs a="right" b="left" />
      <div className="glass mx-auto max-w-6xl overflow-hidden rounded-[2rem]">
        <div className="grid lg:grid-cols-2">
          <Reveal variant="left" className="p-8 sm:p-12">
            {l.eyebrow && <p className="text-sm font-bold uppercase tracking-[.2em] text-accent"><span className="eyebrow-line" />{l.eyebrow}</p>}
            <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight"><SplitTitle text={l.title} /></h2>
            {l.subtitle && <p className="mt-3 text-muted">{l.subtitle}</p>}
            <dl className="mt-8 space-y-5">
              <Info icon="clock" k="Jam buka" v={`${studio.open} – ${studio.close} WIB${l.hours_note ? ` · ${l.hours_note}` : ""}`} />
              {address && <Info icon="home" k="Alamat" v={address} />}
              {(online.whatsapp || studio.phone) && <Info icon="chat" k="WhatsApp" v={online.whatsapp || studio.phone} />}
              {online.instagram && <Info icon="camera" k="Instagram" v={`@${online.instagram}`} />}
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-hero">Buka di Maps <Icon name="external" className="size-4" /></a>}
              {online.whatsapp && <a href={waLink(online.whatsapp, "Halo, saya ingin bertanya tentang layanan studio.")} target="_blank" rel="noopener noreferrer" className="btn btn-hero">Chat WhatsApp</a>}
            </div>
          </Reveal>
          <Reveal variant="right" delay={150} className="relative min-h-72 lg:min-h-full">
            {map ? (
              <iframe src={map} title="Lokasi studio" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen className="absolute inset-0 size-full border-0" />
            ) : l.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageSrc(l.photo_url)} alt="Studio" loading="lazy" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div aria-hidden className="absolute inset-0 grid place-items-center" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 35%, transparent), color-mix(in oklab, var(--accent-2) 30%, transparent))" }}>
                <Icon name="camera" className="size-32 text-white/40" />
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Faq({ d }: { d: Data }) {
  const { site, online, packages } = d;
  const maxPeople = packages.length ? Math.max(...packages.map((p) => p.max_people)) : 0;
  const hasEvent = packages.some((p) => p.category === "photobooth");
  const auto = [
    { q: "Bagaimana cara booking?", a: "Klik tombol Booking, pilih layanan, background, dan jam yang tersedia, lalu isi nama dan nomor WhatsApp. Prosesnya kurang dari dua menit." },
    { q: "Apakah perlu DP?", a: online.dp_percent > 0 ? `Ya, DP sebesar ${online.dp_percent}% dari total untuk mengunci jadwal.${online.hold_min > 0 ? ` Booking tanpa DP otomatis dilepas setelah ${Math.round(online.hold_min / 60 * 10) / 10} jam.` : ""}` : "Booking online tidak memerlukan DP. Tim kami akan mengonfirmasi lewat WhatsApp." },
    { q: "Bagaimana saya menerima hasil foto?", a: "Hasil foto dan video dikirim sebagai link lewat WhatsApp, jadi bisa diunduh kapan saja dari HP." },
    ...(maxPeople ? [{ q: "Berapa orang dalam satu sesi?", a: `Tergantung paket, hingga ${maxPeople} orang. Jumlah maksimal tertera di setiap paket.` }] : []),
    ...(hasEvent ? [{ q: "Bisa untuk acara atau event?", a: "Bisa. Kami punya paket photobooth untuk acara — lihat di bagian Layanan atau hubungi kami untuk kebutuhan khusus." }] : []),
    { q: "Bagaimana kalau ingin mengubah jadwal?", a: "Hubungi kami lewat WhatsApp dengan menyebut kode booking Anda, dan tim kami akan membantu mengaturnya." },
  ];
  const faqs = site.faq.items.length ? site.faq.items : auto;
  return (
    <section id="faq" className="relative scroll-mt-16 px-4 pb-24 pt-12 sm:px-6">
      <Blobs />
      <div className="mx-auto max-w-3xl">
        <SectionHead h={site.faq} className="mb-10" />
        <Reveal variant="up"><Accordion items={faqs} /></Reveal>
      </div>
    </section>
  );
}

function Cta({ d }: { d: Data }) {
  const { site, online } = d;
  if (!online.enabled) return null;
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal className="mx-auto max-w-5xl" variant="zoom">
        <div className="cta-bg relative overflow-hidden rounded-[2rem] px-8 py-16 text-center sm:px-16" style={{ background: "linear-gradient(120deg, var(--accent), var(--accent-2), var(--accent))", color: "var(--accent-fg)" }}>
          <Parallax speed={0.2} className="absolute -left-10 -top-10"><div className="orb size-56 rounded-full bg-white/20 blur-2xl" /></Parallax>
          <Parallax speed={-0.15} className="absolute -bottom-12 -right-8"><div className="orb size-64 rounded-full bg-white/15 blur-2xl" style={{ animationDelay: "-4s" }} /></Parallax>
          <h2 className="font-display relative text-4xl font-semibold tracking-tight sm:text-5xl"><SplitTitle text={site.cta.title} /></h2>
          {site.cta.subtitle && <p className="relative mx-auto mt-4 max-w-md opacity-85">{site.cta.subtitle}</p>}
          <Link href="/book" className="btn btn-hero relative mt-8 !border-0 !bg-white !text-zinc-900 transition-transform hover:!bg-white/90 hover:scale-105">{site.cta.button}</Link>
        </div>
      </Reveal>
    </section>
  );
}

function Info({ icon, k, v }: { icon: string; k: string; v: string }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name={icon} className="size-5" /></span>
      <div><dt className="text-xs font-bold uppercase tracking-wide text-muted">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>
    </div>
  );
}
