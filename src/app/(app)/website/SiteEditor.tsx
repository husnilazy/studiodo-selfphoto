"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { prepareMediaUpload, saveSite } from "@/app/actions/website";
import { FONT_FAMILY, FONT_OPTIONS, SECTION_LABEL, imageSrc, mediaKind, type Heading, type SectionKey, type SiteConfig } from "@/lib/siteConfig";

type Upd = (fn: (d: SiteConfig) => void) => void;
const TABS = [
  ["brand", "Brand & Logo"], ["hero", "Hero Banner"], ["stats", "Statistik & Teks"], ["reels", "Reels & Video"], ["gallery", "Galeri"],
  ["testi", "Testimoni"], ["sections", "Susunan Section"], ["lokasi", "Lokasi & Kontak"], ["faq", "FAQ & CTA"], ["footer", "Footer & SEO"], ["preview", "Pratinjau"],
] as const;
type Tab = (typeof TABS)[number][0];

const PRESETS: [string, string, string][] = [
  ["Indigo", "#4f4fe8", "#a78bfa"], ["Rose", "#e11d6a", "#fb923c"], ["Emerald", "#059669", "#2dd4bf"], ["Sky", "#0284c7", "#818cf8"], ["Amber", "#d97706", "#f472b6"], ["Mono", "#18181b", "#71717a"],
];

export default function SiteEditor({ initial, storage }: { initial: SiteConfig; storage: boolean }) {
  const [cfg, setCfg] = useState<SiteConfig>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>("brand");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nonce, setNonce] = useState(1);
  const dirty = useMemo(() => JSON.stringify(cfg) !== saved, [cfg, saved]);
  const upd: Upd = (fn) => setCfg((c) => { const d = structuredClone(c); fn(d); return d; });

  async function save() {
    setSaving(true); setMsg(null);
    const r = await saveSite(JSON.stringify(cfg));
    setSaving(false);
    if (r.ok) { setSaved(JSON.stringify(cfg)); setNonce((n) => n + 1); setMsg({ ok: true, text: "Tersimpan & tayang di website." }); setTimeout(() => setMsg(null), 3500); }
    else setMsg({ ok: false, text: r.error });
  }

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-5 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Website</h1>
          <p className={`text-xs font-semibold ${dirty ? "text-warn" : "text-muted"}`}>{dirty ? "Ada perubahan yang belum disimpan" : "Semua perubahan tersimpan"}</p>
        </div>
        {msg && <span role="status" className={`rounded-xl px-3 py-1.5 text-xs font-bold ${msg.ok ? "bg-oksoft text-ok" : "bg-badsoft text-bad"}`}>{msg.text}</span>}
        <Link href="/" target="_blank" className="btn btn-sm"><Icon name="external" className="size-4" /> Lihat situs</Link>
        <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save}>{saving && <span className="spinner" />} Simpan & Tayangkan</button>
      </div>

      <div className="hscroll -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${tab === k ? "bg-accent text-accentfg shadow" : "bg-panel text-muted hover:text-fg"} border border-line`}>{l}</button>
        ))}
      </div>

      <div key={tab} className="anim-rise space-y-4">
        {tab === "brand" && <Brand cfg={cfg} upd={upd} storage={storage} />}
        {tab === "hero" && <Hero cfg={cfg} upd={upd} storage={storage} />}
        {tab === "stats" && <Stats cfg={cfg} upd={upd} />}
        {tab === "reels" && <Reels cfg={cfg} upd={upd} storage={storage} />}
        {tab === "gallery" && <Gallery cfg={cfg} upd={upd} storage={storage} />}
        {tab === "testi" && <Testi cfg={cfg} upd={upd} storage={storage} />}
        {tab === "sections" && <Sections cfg={cfg} upd={upd} />}
        {tab === "lokasi" && <Lokasi cfg={cfg} upd={upd} storage={storage} />}
        {tab === "faq" && <Faq cfg={cfg} upd={upd} />}
        {tab === "footer" && <FooterSeo cfg={cfg} upd={upd} storage={storage} />}
        {tab === "preview" && <Preview nonce={nonce} dirty={dirty} />}
      </div>
    </div>
  );
}

/* ───────── Komponen kecil ───────── */
const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card p-4 sm:p-5"><h2 className="font-display font-semibold">{title}</h2>{hint && <p className="mb-3 mt-0.5 text-sm text-muted">{hint}</p>}<div className={`space-y-4 ${hint ? "" : "mt-3"}`}>{children}</div></section>
);
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
function Txt({ label, value, onChange, hint, area, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; area?: boolean; placeholder?: string }) {
  return (
    <label className="block"><span className="label">{label}</span>
      {area ? <textarea className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /> : <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
      {label}
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${value ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
function HeadingFields({ h, onChange }: { h: Heading; onChange: (fn: (h: Heading) => void) => void }) {
  return (
    <Grid>
      <Txt label="Label kecil" value={h.eyebrow} onChange={(v) => onChange((x) => { x.eyebrow = v; })} />
      <Txt label="Judul" value={h.title} onChange={(v) => onChange((x) => { x.title = v; })} />
      <div className="sm:col-span-2"><Txt label="Sub-judul" value={h.subtitle} onChange={(v) => onChange((x) => { x.subtitle = v; })} /></div>
    </Grid>
  );
}

/** Unggah satu file ke Supabase Storage (URL bertanda tangan) dan kembalikan URL publiknya. */
async function uploadToStorage(file: File, onPct?: (n: number) => void): Promise<{ url?: string; error?: string }> {
  const p = await prepareMediaUpload(file.name, file.type, file.size);
  if (!p.ok) return { error: p.error };
  const fd = new FormData();
  fd.append("cacheControl", "31536000");
  fd.append("", file);
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", p.uploadUrl);
    x.setRequestHeader("apikey", p.anonKey);
    x.setRequestHeader("Authorization", `Bearer ${p.anonKey}`);
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => e.lengthComputable && onPct?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => resolve(x.status >= 200 && x.status < 300 ? { url: p.publicUrl } : { error: `Upload gagal (${x.status}). ${x.responseText.slice(0, 120)}` });
    x.onerror = () => resolve({ error: "Koneksi terputus saat upload." });
    x.send(fd);
  });
}

/** Isian link media dengan tombol upload (Supabase Storage) bila diaktifkan. */
function MediaField({ label, value, onChange, accept = "image", storage, hint }: { label: string; value: string; onChange: (v: string) => void; accept?: "image" | "video" | "any"; storage: boolean; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const kind = mediaKind(value);

  async function upload(file: File) {
    setErr(""); setPct(0);
    const r = await uploadToStorage(file, setPct);
    if (r.url) onChange(r.url); else setErr(r.error ?? "Upload gagal.");
    setPct(null);
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Tempel link (https://…) atau upload" />
        {storage && (
          <>
            <input ref={input} type="file" className="hidden" accept={accept === "image" ? "image/*" : accept === "video" ? "video/*" : "image/*,video/*"} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            <button type="button" className="btn shrink-0" disabled={pct !== null} onClick={() => input.current?.click()}>{pct !== null ? `${pct}%` : "Upload"}</button>
          </>
        )}
        {value && <button type="button" className="btn shrink-0" aria-label="Hapus" onClick={() => onChange("")}><Icon name="x" className="size-4" /></button>}
      </div>
      {pct !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} /></div>}
      {err && <p className="mt-1 text-xs font-semibold text-bad">{err}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {value && (
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-panel2 p-2">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc(value)} alt="" className="h-14 w-20 rounded-lg object-cover" />
          ) : kind === "video" ? (
            <video src={value} className="h-14 w-20 rounded-lg bg-black object-cover" muted playsInline preload="metadata" />
          ) : <span className="grid h-14 w-20 place-items-center rounded-lg bg-panel text-accent"><Icon name="camera" className="size-6" /></span>}
          <span className="text-xs font-semibold text-muted">{{ image: "Gambar", video: "Video", youtube: "YouTube", drive: "Google Drive (video)", instagram: "Instagram (dibuka di tab baru)", tiktok: "TikTok (dibuka di tab baru)", empty: "" }[kind]}</span>
        </div>
      )}
      {!storage && !value && <p className="mt-1 text-xs text-muted">Upload langsung belum aktif — tempel link gambar/video (Google Drive, YouTube, dll.).</p>}
    </div>
  );
}

/** Kotak foto kecil (klik untuk upload, atau tempel link bila upload belum aktif). */
function PhotoSlot({ value, onChange, storage }: { value: string; onChange: (v: string) => void; storage: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  async function pick(file: File) {
    setErr(""); setPct(0);
    const r = await uploadToStorage(file, setPct);
    if (r.url) onChange(r.url); else setErr(r.error ?? "Gagal");
    setPct(null);
  }
  return (
    <div>
      <div className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-dashed border-line bg-panel2">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imageSrc(value)} alt="" className="size-full object-cover" />
          : <button type="button" disabled={!storage} onClick={() => input.current?.click()} className="grid size-full place-items-center text-xs font-semibold text-muted disabled:cursor-default">{storage ? "+ Foto" : "Kosong"}</button>}
        {storage && <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />}
        {value && <button type="button" aria-label="Hapus foto" onClick={() => onChange("")} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Icon name="x" className="size-3.5" /></button>}
        {value && storage && <button type="button" aria-label="Ganti foto" onClick={() => input.current?.click()} className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">Ganti</button>}
        {pct !== null && <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-bold text-white">{pct}%</div>}
      </div>
      {!storage && <input className="input mt-1.5 !min-h-9 !text-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Link foto (https://…)" />}
      {err && <p className="mt-1 text-[11px] font-semibold text-bad">{err}</p>}
    </div>
  );
}

function StripPhotos({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const bulk = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [links, setLinks] = useState("");
  const photos = cfg.hero.strip_photos;
  async function fillMany(files: File[]) {
    const empty = photos.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const targets = empty.length ? empty : photos.map((_, i) => i);
    for (let n = 0; n < Math.min(files.length, targets.length); n++) {
      setBusy(`Mengunggah ${n + 1}/${Math.min(files.length, targets.length)}…`);
      const r = await uploadToStorage(files[n]);
      if (!r.url) { setBusy(r.error ?? "Gagal"); return; }
      upd((d) => { d.hero.strip_photos[targets[n]] = r.url!; });
    }
    setBusy("");
  }
  return (
    <Card title="Foto strip" hint="Tiga strip foto di banner. Kosongkan semua untuk memakai foto dari tab Galeri secara otomatis; slot yang kosong menampilkan warna ruang.">
      {storage && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={bulk} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void fillMany(f); }} />
          <button type="button" className="btn btn-primary btn-sm" disabled={!!busy && !busy.includes("Gagal")} onClick={() => bulk.current?.click()}>Upload beberapa foto sekaligus</button>
          <span className="text-sm text-muted">{busy || "Mengisi slot kosong berurutan (maks 9)."}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-2 shadow-sm sm:p-3" style={{ transform: `rotate(${[-3, 1.5, 4][i]}deg)` }}>
            <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">Strip {i + 1}</p>
            <div className="space-y-2">
              {[0, 1, 2].map((j) => (
                <PhotoSlot key={j} storage={storage} value={photos[i * 3 + j] ?? ""} onChange={(v) => upd((d) => { d.hero.strip_photos[i * 3 + j] = v; })} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <details className="rounded-xl bg-panel2 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Atau tempel link foto (satu per baris)</summary>
        <textarea className="input mt-2" value={links} onChange={(e) => setLinks(e.target.value)} placeholder={"https://…/foto1.jpg\nhttps://…/foto2.jpg"} />
        <button type="button" className="btn btn-sm mt-2" onClick={() => {
          const list = links.split(/\r?\n/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)).slice(0, 9);
          upd((d) => { d.hero.strip_photos = Array.from({ length: 9 }, (_, i) => list[i] ?? ""); });
        }}>Terapkan ke slot (urut)</button>
        <p className="mt-1 text-xs text-muted">Link Google Drive juga didukung. Slot diisi berurutan: strip 1 (3 foto), strip 2, strip 3.</p>
      </details>
      {photos.some(Boolean) && <button type="button" className="btn btn-sm btn-danger" onClick={() => upd((d) => { d.hero.strip_photos = Array(9).fill(""); })}>Kosongkan semua foto strip</button>}
    </Card>
  );
}

function Repeater<T>({ items, onAdd, onRemove, onMove, render, addLabel, empty, max }: {
  items: T[]; onAdd: () => void; onRemove: (i: number) => void; onMove: (i: number, d: -1 | 1) => void;
  render: (item: T, i: number) => React.ReactNode; addLabel: string; empty?: string; max?: number;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && empty && <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">{empty}</p>}
      {items.map((it, i) => (
        <div key={i} className="rounded-2xl border border-line bg-panel2/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">#{i + 1}</span>
            <div className="flex gap-1">
              <button type="button" className="btn btn-sm !px-2.5" disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Naik"><Icon name="left" className="size-4 rotate-90" /></button>
              <button type="button" className="btn btn-sm !px-2.5" disabled={i === items.length - 1} onClick={() => onMove(i, 1)} aria-label="Turun"><Icon name="right" className="size-4 rotate-90" /></button>
              <button type="button" className="btn btn-sm btn-danger !px-2.5" onClick={() => onRemove(i)} aria-label="Hapus"><Icon name="trash" className="size-4" /></button>
            </div>
          </div>
          <div className="space-y-3">{render(it, i)}</div>
        </div>
      ))}
      {(!max || items.length < max) && <button type="button" className="btn btn-sm" onClick={onAdd}><Icon name="plus" className="size-4" /> {addLabel}</button>}
    </div>
  );
}
const move = <T,>(a: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; };

/* ───────── Tab ───────── */
function Brand({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const b = cfg.brand, a = cfg.announce;
  return (
    <>
      <Card title="Logo" hint="PNG/SVG transparan terbaik. Logo ini tampil di navigasi dan footer.">
        <Grid>
          <MediaField label="Logo (mode terang)" value={b.logo_url} onChange={(v) => upd((d) => { d.brand.logo_url = v; })} storage={storage} />
          <MediaField label="Logo (mode gelap) — opsional" value={b.logo_dark_url} onChange={(v) => upd((d) => { d.brand.logo_dark_url = v; })} storage={storage} hint="Kosongkan bila logo yang sama cocok di kedua mode." />
          <MediaField label="Favicon (ikon tab)" value={b.favicon_url} onChange={(v) => upd((d) => { d.brand.favicon_url = v; })} storage={storage} />
          <div>
            <span className="label">Tinggi logo: {b.logo_height}px</span>
            <input type="range" min={18} max={72} value={b.logo_height} onChange={(e) => upd((d) => { d.brand.logo_height = Number(e.target.value); })} className="w-full accent-[var(--accent)]" />
            </div>
        </Grid>
      </Card>
      <Card title="Teks brand di samping logo" hint="Teks tambahan setelah logo, mis. “Self Photo Studio”. Kosongkan jika logo sudah cukup.">
        <Txt label="Teks" value={b.text} onChange={(v) => upd((d) => { d.brand.text = v; })} placeholder="Self Photo Studio" />
        <Grid>
          <div>
            <span className="label">Ukuran teks: {b.text_size}px</span>
            <input type="range" min={10} max={40} value={b.text_size} onChange={(e) => upd((d) => { d.brand.text_size = Number(e.target.value); })} className="w-full accent-[var(--accent)]" />
          </div>
          <label className="block"><span className="label">Font</span>
            <select className="input" value={b.text_font} onChange={(e) => upd((d) => { d.brand.text_font = e.target.value as typeof b.text_font; })}>
              {FONT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </Grid>
        <div className="rounded-2xl border border-line bg-panel2/60 p-4">
          <span className="label">Pratinjau</span>
          <div className="mt-2 flex items-center gap-2.5">
            {b.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={imageSrc(b.logo_url)} alt="" style={{ height: b.logo_height }} className="w-auto object-contain" />
              : <span className="font-display text-xl font-bold">STUDIO<span className="text-accent">DO</span></span>}
            {b.text && <span className="whitespace-nowrap font-semibold leading-none tracking-tight" style={{ fontSize: b.text_size, fontFamily: FONT_FAMILY[b.text_font] }}>{b.text}</span>}
          </div>
        </div>
      </Card>
      <Card title="Warna brand" hint="Mengubah tombol, aksen, dan gradien di seluruh website.">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([n, c1, c2]) => (
            <button key={n} type="button" onClick={() => upd((d) => { d.brand.accent = c1; d.brand.accent2 = c2; })} className="chip gap-2" data-on={b.accent === c1 && b.accent2 === c2}>
              <span className="size-4 rounded-full" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} />{n}
            </button>
          ))}
        </div>
        <Grid>
          <label className="block"><span className="label">Warna utama</span><input type="color" className="input !p-1" value={b.accent} onChange={(e) => upd((d) => { d.brand.accent = e.target.value; })} /></label>
          <label className="block"><span className="label">Warna kedua (gradien)</span><input type="color" className="input !p-1" value={b.accent2} onChange={(e) => upd((d) => { d.brand.accent2 = e.target.value; })} /></label>
        </Grid>
      </Card>
      <Card title="Bar pengumuman" hint="Strip kecil di paling atas website untuk promo atau info libur.">
        <Toggle label="Tampilkan bar pengumuman" value={a.enabled} onChange={(v) => upd((d) => { d.announce.enabled = v; })} />
        <Txt label="Teks" value={a.text} onChange={(v) => upd((d) => { d.announce.text = v; })} />
        <Grid>
          <Txt label="Link tombol" value={a.link} onChange={(v) => upd((d) => { d.announce.link = v; })} placeholder="/book" />
          <Txt label="Label tombol" value={a.link_label} onChange={(v) => upd((d) => { d.announce.link_label = v; })} />
        </Grid>
      </Card>
    </>
  );
}

function Hero({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const h = cfg.hero;
  return (
    <>
      <Card title="Teks banner">
        <Txt label="Lencana kecil" value={h.badge} onChange={(v) => upd((d) => { d.hero.badge = v; })} />
        <Grid>
          <Txt label="Judul baris 1" value={h.title} onChange={(v) => upd((d) => { d.hero.title = v; })} />
          <Txt label="Judul baris 2 (berwarna gradien)" value={h.highlight} onChange={(v) => upd((d) => { d.hero.highlight = v; })} />
        </Grid>
        <Txt label="Sub-judul" area value={h.subtitle} onChange={(v) => upd((d) => { d.hero.subtitle = v; })} hint="Kosong = pakai tagline dari Pengaturan." />
        <Grid>
          <Txt label="Tombol utama" value={h.cta1} onChange={(v) => upd((d) => { d.hero.cta1 = v; })} />
          <Txt label="Tombol kedua" value={h.cta2} onChange={(v) => upd((d) => { d.hero.cta2 = v; })} />
        </Grid>
      </Card>
      <Card title="Media banner" hint="Video/reels atau foto unggulan di bagian paling atas.">
        <div className="flex flex-wrap gap-2">
          {([["strips", "Strip foto otomatis"], ["video", "Video / Reels"], ["image", "Foto"]] as const).map(([k, l]) => (
            <button key={k} type="button" className="chip" data-on={h.media_type === k} onClick={() => upd((d) => { d.hero.media_type = k; })}>{l}</button>
          ))}
        </div>
        {h.media_type === "strips" && <p className="text-sm text-muted">Strip foto muncul di sisi kanan banner. Isi foto-fotonya di kartu “Foto strip” di bawah.</p>}
        {h.media_type !== "strips" && (
          <>
            <div className="flex flex-wrap gap-2">
              {([["frame", "Bingkai di samping teks"], ["background", "Latar penuh"]] as const).map(([k, l]) => (
                <button key={k} type="button" className="chip" data-on={h.media_layout === k} onClick={() => upd((d) => { d.hero.media_layout = k; })}>{l}</button>
              ))}
            </div>
            <MediaField label={h.media_type === "video" ? "Video (MP4/WebM, YouTube, atau Google Drive)" : "Foto"} accept={h.media_type === "video" ? "video" : "image"} storage={storage}
              value={h.media_url} onChange={(v) => upd((d) => { d.hero.media_url = v; })} hint={h.media_type === "video" ? "MP4 pendek (≤ 15 detik, ≤ 10 MB) paling mulus: diputar otomatis tanpa suara & berulang." : undefined} />
            {h.media_type === "video" && <MediaField label="Gambar sampul video (poster)" storage={storage} value={h.poster_url} onChange={(v) => upd((d) => { d.hero.poster_url = v; })} />}
            {h.media_layout === "background" && (
              <div><span className="label">Gelapkan latar: {h.overlay}%</span><input type="range" min={0} max={90} value={h.overlay} onChange={(e) => upd((d) => { d.hero.overlay = Number(e.target.value); })} className="w-full accent-[var(--accent)]" /></div>
            )}
          </>
        )}
      </Card>
      {h.media_type === "strips" && <StripPhotos cfg={cfg} upd={upd} storage={storage} />}
    </>
  );
}

function Stats({ cfg, upd }: { cfg: SiteConfig; upd: Upd }) {
  return (
    <>
      <Card title="Angka statistik" hint="Ditampilkan di bawah teks banner dengan animasi hitung naik. Kosongkan semua untuk memakai angka otomatis (jumlah background, harga mulai, jam buka).">
        <Repeater items={cfg.stats.items} max={4} addLabel="Tambah angka" empty="Memakai angka otomatis."
          onAdd={() => upd((d) => { d.stats.items.push({ value: "", label: "" }); })} onRemove={(i) => upd((d) => { d.stats.items.splice(i, 1); })} onMove={(i, dir) => upd((d) => move(d.stats.items, i, dir))}
          render={(it, i) => (
            <Grid>
              <Txt label="Angka" value={it.value} placeholder="mis. 5.000+" onChange={(v) => upd((d) => { d.stats.items[i].value = v; })} />
              <Txt label="Keterangan" value={it.label} placeholder="mis. pelanggan puas" onChange={(v) => upd((d) => { d.stats.items[i].label = v; })} />
            </Grid>
          )} />
      </Card>
      <Card title="Teks berjalan" hint="Kata-kata yang berjalan horizontal di bawah banner.">
        <Toggle label="Tampilkan teks berjalan" value={cfg.marquee.enabled} onChange={(v) => upd((d) => { d.marquee.enabled = v; })} />
        <Txt label="Daftar kata (satu per baris)" area value={cfg.marquee.words.join("\n")} onChange={(v) => upd((d) => { d.marquee.words = v.split("\n"); })} />
      </Card>
    </>
  );
}

function Reels({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const r = cfg.reels;
  return (
    <Card title="Kartu video / reels" hint="Kartu vertikal 9:16. MP4 diputar otomatis saat terlihat; YouTube & Drive diputar saat diketuk; link Instagram/TikTok membuka tab baru.">
      <Repeater items={r.items} max={12} addLabel="Tambah video" empty="Belum ada video — bagian ini otomatis disembunyikan sampai ada isinya."
        onAdd={() => upd((d) => { d.reels.items.push({ title: "", url: "", poster_url: "", link: "" }); })} onRemove={(i) => upd((d) => { d.reels.items.splice(i, 1); })} onMove={(i, dir) => upd((d) => move(d.reels.items, i, dir))}
        render={(it, i) => (
          <>
            <Txt label="Judul (opsional)" value={it.title} onChange={(v) => upd((d) => { d.reels.items[i].title = v; })} />
            <MediaField label="Video" accept="video" storage={storage} value={it.url} onChange={(v) => upd((d) => { d.reels.items[i].url = v; })} hint="MP4/WebM (upload), YouTube/Shorts, Google Drive, atau link Instagram/TikTok." />
            <MediaField label="Gambar sampul (poster)" storage={storage} value={it.poster_url} onChange={(v) => upd((d) => { d.reels.items[i].poster_url = v; })} hint="Disarankan untuk Instagram/TikTok/Drive." />
            <Txt label="Link tujuan saat diketuk (opsional)" value={it.link} placeholder="mis. link Instagram Reels" onChange={(v) => upd((d) => { d.reels.items[i].link = v; })} />
          </>
        )} />
    </Card>
  );
}

function Gallery({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const bulk = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>("");
  async function addMany(files: File[]) {
    for (let n = 0; n < files.length; n++) {
      const f = files[n];
      setBusy(`Mengunggah ${n + 1}/${files.length}…`);
      const p = await prepareMediaUpload(f.name, f.type, f.size);
      if (!p.ok) { setBusy(p.error); return; }
      const fd = new FormData(); fd.append("cacheControl", "31536000"); fd.append("", f);
      const ok = await fetch(p.uploadUrl, { method: "PUT", headers: { apikey: p.anonKey, Authorization: `Bearer ${p.anonKey}`, "x-upsert": "false" }, body: fd }).then((r) => r.ok).catch(() => false);
      if (!ok) { setBusy("Upload gagal."); return; }
      upd((d) => { if (d.gallery.items.length < 24) d.gallery.items.push({ url: p.publicUrl, caption: "" }); });
    }
    setBusy("");
  }
  return (
    <Card title="Galeri foto" hint="Tampil sebagai grid masonry dengan lightbox. Maksimal 24 foto.">
      {storage && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={bulk} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void addMany(f); }} />
          <button type="button" className="btn btn-primary btn-sm" disabled={!!busy && !busy.includes("gagal")} onClick={() => bulk.current?.click()}>Upload banyak foto sekaligus</button>
          {busy && <span className="text-sm font-semibold text-muted">{busy}</span>}
        </div>
      )}
      <Repeater items={cfg.gallery.items} max={24} addLabel="Tambah foto" empty="Belum ada foto — bagian ini otomatis disembunyikan sampai ada isinya."
        onAdd={() => upd((d) => { d.gallery.items.push({ url: "", caption: "" }); })} onRemove={(i) => upd((d) => { d.gallery.items.splice(i, 1); })} onMove={(i, dir) => upd((d) => move(d.gallery.items, i, dir))}
        render={(it, i) => (
          <>
            <MediaField label="Foto" storage={storage} value={it.url} onChange={(v) => upd((d) => { d.gallery.items[i].url = v; })} />
            <Txt label="Keterangan (opsional)" value={it.caption} onChange={(v) => upd((d) => { d.gallery.items[i].caption = v; })} />
          </>
        )} />
    </Card>
  );
}

function Testi({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  return (
    <Card title="Testimoni pelanggan" hint="Pakai testimoni asli dari pelanggan Anda (izinkan dulu sebelum menampilkan nama).">
      <Repeater items={cfg.testimoni.items} max={12} addLabel="Tambah testimoni" empty="Belum ada testimoni — bagian ini otomatis disembunyikan sampai ada isinya."
        onAdd={() => upd((d) => { d.testimoni.items.push({ name: "", role: "", text: "", rating: 5, avatar_url: "" }); })} onRemove={(i) => upd((d) => { d.testimoni.items.splice(i, 1); })} onMove={(i, dir) => upd((d) => move(d.testimoni.items, i, dir))}
        render={(it, i) => (
          <>
            <Grid>
              <Txt label="Nama" value={it.name} onChange={(v) => upd((d) => { d.testimoni.items[i].name = v; })} />
              <Txt label="Keterangan (mis. Mahasiswa)" value={it.role} onChange={(v) => upd((d) => { d.testimoni.items[i].role = v; })} />
            </Grid>
            <Txt label="Isi testimoni" area value={it.text} onChange={(v) => upd((d) => { d.testimoni.items[i].text = v; })} />
            <Grid>
              <label className="block"><span className="label">Bintang</span>
                <select className="input" value={it.rating} onChange={(e) => upd((d) => { d.testimoni.items[i].rating = Number(e.target.value); })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
              </label>
              <MediaField label="Foto profil (opsional)" storage={storage} value={it.avatar_url} onChange={(v) => upd((d) => { d.testimoni.items[i].avatar_url = v; })} />
            </Grid>
          </>
        )} />
    </Card>
  );
}

function Sections({ cfg, upd }: { cfg: SiteConfig; upd: Upd }) {
  const [open, setOpen] = useState<SectionKey | null>(null);
  return (
    <Card title="Susunan & judul section" hint="Atur urutan, tampilkan/sembunyikan, dan ubah judul tiap section pada halaman utama.">
      <ul className="space-y-2">
        {cfg.order.map((k, i) => {
          const h = cfg[k] as Heading;
          return (
            <li key={k} className="rounded-2xl border border-line bg-panel2/50">
              <div className="flex items-center gap-2 p-3">
                <div className="flex flex-col">
                  <button type="button" className="rounded p-0.5 text-muted hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => upd((d) => move(d.order, i, -1))} aria-label="Naik"><Icon name="left" className="size-4 rotate-90" /></button>
                  <button type="button" className="rounded p-0.5 text-muted hover:text-fg disabled:opacity-30" disabled={i === cfg.order.length - 1} onClick={() => upd((d) => move(d.order, i, 1))} aria-label="Turun"><Icon name="right" className="size-4 rotate-90" /></button>
                </div>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === k ? null : k)}>
                  <p className="font-semibold">{SECTION_LABEL[k]}</p><p className="truncate text-xs text-muted">{h.title}</p>
                </button>
                <Toggle label="" value={h.enabled} onChange={(v) => upd((d) => { (d[k] as Heading).enabled = v; })} />
              </div>
              {open === k && <div className="border-t border-line p-3"><HeadingFields h={h} onChange={(fn) => upd((d) => fn(d[k] as Heading))} /></div>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Lokasi({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const l = cfg.lokasi;
  return (
    <>
      <Card title="Alamat & peta">
        <Txt label="Alamat lengkap" area value={l.address} onChange={(v) => upd((d) => { d.lokasi.address = v; })} hint="Dipakai juga di struk dan sebagai peta cadangan." />
        <Txt label="Catatan jam buka (opsional)" value={l.hours_note} onChange={(v) => upd((d) => { d.lokasi.hours_note = v; })} placeholder="mis. Libur hari Senin" hint="Jam buka utama diatur di Pengaturan." />
        <Txt label="Embed Google Maps" area value={l.maps_embed} onChange={(v) => upd((d) => { d.lokasi.maps_embed = v; })}
          hint="Google Maps → Bagikan → Sematkan peta → salin HTML (<iframe …>) lalu tempel di sini. Kosong = peta otomatis dari alamat." />
        <Txt label="Link Google Maps (tombol 'Buka di Maps')" value={l.maps_url} onChange={(v) => upd((d) => { d.lokasi.maps_url = v; })} placeholder="https://maps.app.goo.gl/…" />
        <MediaField label="Foto studio/tampak depan (opsional)" storage={storage} value={l.photo_url} onChange={(v) => upd((d) => { d.lokasi.photo_url = v; })} />
      </Card>
      <Card title="Kontak" hint="Terhubung ke tombol WhatsApp, konfirmasi booking, dan footer.">
        <Grid>
          <Txt label="WhatsApp" value={l.whatsapp} onChange={(v) => upd((d) => { d.lokasi.whatsapp = v; })} placeholder="6281234567890" />
          <Txt label="Instagram" value={l.instagram} onChange={(v) => upd((d) => { d.lokasi.instagram = v; })} placeholder="username" />
        </Grid>
      </Card>
    </>
  );
}

function Faq({ cfg, upd }: { cfg: SiteConfig; upd: Upd }) {
  return (
    <>
      <Card title="Pertanyaan umum (FAQ)" hint="Kosongkan semuanya untuk memakai FAQ otomatis (menyesuaikan DP, jumlah orang, dll.).">
        <Repeater items={cfg.faq.items} max={20} addLabel="Tambah pertanyaan" empty="Memakai FAQ otomatis."
          onAdd={() => upd((d) => { d.faq.items.push({ q: "", a: "" }); })} onRemove={(i) => upd((d) => { d.faq.items.splice(i, 1); })} onMove={(i, dir) => upd((d) => move(d.faq.items, i, dir))}
          render={(it, i) => (
            <>
              <Txt label="Pertanyaan" value={it.q} onChange={(v) => upd((d) => { d.faq.items[i].q = v; })} />
              <Txt label="Jawaban" area value={it.a} onChange={(v) => upd((d) => { d.faq.items[i].a = v; })} />
            </>
          )} />
      </Card>
      <Card title="Ajakan booking (CTA)" hint="Judul dan sub-judul diubah di tab Susunan Section.">
        <Txt label="Teks tombol" value={cfg.cta.button} onChange={(v) => upd((d) => { d.cta.button = v; })} />
      </Card>
    </>
  );
}

function FooterSeo({ cfg, upd, storage }: { cfg: SiteConfig; upd: Upd; storage: boolean }) {
  const f = cfg.footer, s = cfg.seo;
  return (
    <>
      <Card title="Footer">
        <Txt label="Deskripsi singkat" area value={f.about} onChange={(v) => upd((d) => { d.footer.about = v; })} />
        <Grid>
          <Txt label="TikTok (link)" value={f.tiktok} onChange={(v) => upd((d) => { d.footer.tiktok = v; })} placeholder="https://tiktok.com/@…" />
          <Txt label="YouTube (link)" value={f.youtube} onChange={(v) => upd((d) => { d.footer.youtube = v; })} />
          <Txt label="Facebook (link)" value={f.facebook} onChange={(v) => upd((d) => { d.footer.facebook = v; })} />
          <Txt label="Email" value={f.email} onChange={(v) => upd((d) => { d.footer.email = v; })} />
        </Grid>
        <Txt label="Teks hak cipta (opsional)" value={f.copyright} onChange={(v) => upd((d) => { d.footer.copyright = v; })} />
      </Card>
      <Card title="SEO & tampilan di Google / WhatsApp" hint="Judul, deskripsi, dan gambar saat link website dibagikan.">
        <Txt label="Judul halaman" value={s.title} onChange={(v) => upd((d) => { d.seo.title = v; })} hint="Kosong = otomatis dari nama studio." />
        <Txt label="Deskripsi" area value={s.description} onChange={(v) => upd((d) => { d.seo.description = v; })} />
        <MediaField label="Gambar pratinjau (1200×630)" storage={storage} value={s.og_image} onChange={(v) => upd((d) => { d.seo.og_image = v; })} />
      </Card>
    </>
  );
}

function Preview({ nonce, dirty }: { nonce: number; dirty: boolean }) {
  const [dev, setDev] = useState<"desktop" | "mobile">("mobile");
  return (
    <Card title="Pratinjau langsung" hint="Menampilkan website yang sudah tayang. Simpan dulu agar perubahan terlihat.">
      {dirty && <p className="rounded-xl bg-warnsoft px-3 py-2 text-sm font-semibold text-warn">Ada perubahan belum disimpan — tidak tampil di pratinjau.</p>}
      <div className="flex gap-2">
        {(["mobile", "desktop"] as const).map((k) => <button key={k} className="chip" data-on={dev === k} onClick={() => setDev(k)}>{k === "mobile" ? "HP" : "Desktop"}</button>)}
      </div>
      <div className="mx-auto overflow-hidden rounded-[1.75rem] border-4 border-line bg-black shadow-xl transition-all duration-500" style={{ width: dev === "mobile" ? 390 : "100%", maxWidth: "100%" }}>
        <iframe key={nonce} src={`/?preview=${nonce}`} title="Pratinjau website" className="block h-[70vh] w-full bg-white" />
      </div>
    </Card>
  );
}
