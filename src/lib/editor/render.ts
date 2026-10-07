// Renderer canvas untuk halaman desain. Dipakai untuk pratinjau, ekspor, dan cetak (hasil identik).
import type { Background, Filter, Layer, Page, PhotoLayer, TextLayer } from "./types";

/* ───────── Muat gambar (dengan cache) ───────── */
const cache = new Map<string, Promise<HTMLImageElement>>();
export function loadImg(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const im = new Image();
      if (/^https?:/i.test(src) && !src.startsWith(location.origin)) im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => { cache.delete(src); reject(new Error("Gagal memuat gambar")); };
      im.decoding = "async";
      im.src = src;
    });
    cache.set(src, p);
  }
  return p;
}
export async function loadPageImages(page: Page, into: Map<string, HTMLImageElement>) {
  const srcs = page.layers.flatMap((l) => (l.type === "photo" || l.type === "frame") && l.src ? [l.src] : []);
  await Promise.all([...new Set(srcs)].map(async (s) => { try { into.set(s, await loadImg(s)); } catch { /* lewati yang gagal */ } }));
}

/* ───────── Font ───────── */
let fontMap: Record<string, string> = {};
export const setFontMap = (m: Record<string, string>) => { fontMap = m; };
const fam = (name: string) => `${fontMap[name] ? fontMap[name] + ", " : ""}"${name}", sans-serif`;

/* ───────── Skala turun halus (hasil resize tajam, bukan bergerigi) ───────── */
const scaledCache = new WeakMap<object, Map<string, HTMLCanvasElement>>();
function smoothSource(img: HTMLImageElement, tw: number, th: number): CanvasImageSource {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (tw <= 0 || th <= 0 || iw / tw < 1.8 && ih / th < 1.8) return img;
  const key = `${Math.round(tw / 8)}x${Math.round(th / 8)}`;
  let m = scaledCache.get(img);
  if (!m) { m = new Map(); scaledCache.set(img, m); }
  const hit = m.get(key);
  if (hit) return hit;
  let cur: CanvasImageSource = img, cw = iw, ch = ih;
  let c: HTMLCanvasElement | null = null;
  while (cw / 2 >= tw && ch / 2 >= th) {
    const next = document.createElement("canvas");
    next.width = Math.max(1, Math.round(cw / 2)); next.height = Math.max(1, Math.round(ch / 2));
    const x = next.getContext("2d")!;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.drawImage(cur, 0, 0, next.width, next.height);
    cur = next; c = next; cw = next.width; ch = next.height;
  }
  if (c) m.set(key, c);
  return c ?? img;
}

/* ───────── Teks ───────── */
let measureCtx: CanvasRenderingContext2D | null = null;
export const fontOf = (t: Pick<TextLayer, "italic" | "weight" | "size" | "font">) => `${t.italic ? "italic " : ""}${t.weight} ${t.size}px ${fam(t.font)}`;
export function textBox(t: TextLayer): { lines: string[]; h: number } {
  measureCtx ??= document.createElement("canvas").getContext("2d")!;
  const c = measureCtx;
  c.font = fontOf(t);
  (c as unknown as { letterSpacing: string }).letterSpacing = `${t.letter}px`;
  const lines: string[] = [];
  for (const para of t.text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && c.measureText(test).width > t.w) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return { lines, h: Math.max(1, lines.length) * t.size * t.lineHeight };
}

/* ───────── Filter ───────── */
export const hasFilter = (f: Filter) => f.brightness !== 100 || f.contrast !== 100 || f.saturate !== 100 || f.warmth !== 0 || f.grayscale !== 0 || f.blur !== 0;
export function filterCss(f: Filter, scale: number): string {
  const p: string[] = [];
  if (f.brightness !== 100) p.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) p.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) p.push(`saturate(${f.saturate}%)`);
  if (f.grayscale) p.push(`grayscale(${f.grayscale}%)`);
  if (f.warmth > 0) p.push(`sepia(${f.warmth * 0.4}%) hue-rotate(${-f.warmth * 0.12}deg) saturate(${100 + f.warmth * 0.2}%)`);
  if (f.warmth < 0) p.push(`hue-rotate(${-f.warmth * 0.45}deg) saturate(${100 + f.warmth * 0.1}%)`);
  if (f.blur) p.push(`blur(${f.blur * scale}px)`);
  return p.join(" ") || "none";
}

/* ───────── Gambar ───────── */
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  if (rr <= 0) { c.rect(x, y, w, h); return; }
  c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}

export function paintBackground(c: CanvasRenderingContext2D, bg: Background, w: number, h: number) {
  if (bg.type === "gradient") {
    const a = (bg.angle * Math.PI) / 180, cx = w / 2, cy = h / 2, r = Math.abs(Math.cos(a)) * w / 2 + Math.abs(Math.sin(a)) * h / 2;
    const g = c.createLinearGradient(cx - Math.sin(a) * r, cy + Math.cos(a) * r, cx + Math.sin(a) * r, cy - Math.cos(a) * r);
    g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2);
    c.fillStyle = g;
  } else c.fillStyle = bg.c1;
  c.fillRect(0, 0, w, h);
}

/** Posisi & ukuran foto di dalam kotaknya (cover/contain + zoom + geser). */
export function photoRect(l: PhotoLayer) {
  const s0 = l.fit === "cover" ? Math.max(l.w / l.nw, l.h / l.nh) : Math.min(l.w / l.nw, l.h / l.nh);
  const s = s0 * l.zoom, dw = l.nw * s, dh = l.nh * s;
  const fx = Math.max(0, (dw - l.w) / 2), fy = Math.max(0, (dh - l.h) / 2);
  return { dx: (l.w - dw) / 2 - l.ox * fx, dy: (l.h - dh) / 2 - l.oy * fy, dw, dh };
}

function drawPhoto(c: CanvasRenderingContext2D, l: PhotoLayer, img: HTMLImageElement | undefined, scale: number) {
  const bleed = l.slot !== undefined ? 1.5 : 0;
  if (l.shadow) {
    c.save();
    c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 28 * scale; c.shadowOffsetY = 10 * scale;
    c.fillStyle = "#fff"; roundRect(c, 0, 0, l.w, l.h, l.radius); c.fill();
    c.restore();
  }
  c.save();
  roundRect(c, -bleed, -bleed, l.w + bleed * 2, l.h + bleed * 2, l.radius);
  c.clip();
  if (img) {
    const r = photoRect(l);
    const grow = bleed ? 1 + (bleed * 2) / Math.max(1, l.w) : 1; // sedikit melebar agar tidak ada celah di tepi frame
    if (hasFilter(l.filter)) c.filter = filterCss(l.filter, scale);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    if (l.flipX) { c.translate(l.w, 0); c.scale(-1, 1); }
    c.translate(l.w / 2, l.h / 2); c.scale(grow, grow); c.translate(-l.w / 2, -l.h / 2);
    c.drawImage(smoothSource(img, r.dw * scale, r.dh * scale), r.dx, r.dy, r.dw, r.dh);
  } else {
    c.fillStyle = "#d8dbe8"; c.fillRect(0, 0, l.w, l.h);
  }
  c.restore();
  if (l.border > 0) {
    c.save(); c.lineWidth = l.border; c.strokeStyle = l.borderColor;
    roundRect(c, l.border / 2, l.border / 2, l.w - l.border, l.h - l.border, Math.max(0, l.radius - l.border / 2)); c.stroke(); c.restore();
  }
}

function drawText(c: CanvasRenderingContext2D, t: TextLayer) {
  const { lines, h } = textBox(t);
  c.font = fontOf(t); c.textBaseline = "top";
  (c as unknown as { letterSpacing: string }).letterSpacing = `${t.letter}px`;
  if (t.bg) {
    const pad = t.size * 0.3, widest = Math.max(...lines.map((s) => c.measureText(s).width));
    const bx = t.align === "center" ? (t.w - widest) / 2 : t.align === "right" ? t.w - widest : 0;
    c.fillStyle = t.bg; roundRect(c, bx - pad, -pad * 0.5, widest + pad * 2, h + pad, t.size * 0.35); c.fill();
  }
  if (t.shadow) { c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = t.size * 0.18; c.shadowOffsetY = t.size * 0.05; }
  c.fillStyle = t.color; c.textAlign = t.align;
  const ax = t.align === "center" ? t.w / 2 : t.align === "right" ? t.w : 0;
  lines.forEach((s, i) => c.fillText(s, ax, i * t.size * t.lineHeight + (t.size * t.lineHeight - t.size) / 2));
}

export function layerHeight(l: Layer): number { return l.type === "text" ? textBox(l).h : l.h; }

/** Menggambar seluruh halaman pada `scale` (1 = ukuran piksel halaman). */
export function renderPage(c: CanvasRenderingContext2D, page: Page, scale: number, imgs: Map<string, HTMLImageElement>) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.scale(scale, scale);
  paintBackground(c, page.bg, page.w, page.h);
  for (const l of page.layers) {
    if (l.hidden) continue;
    c.save();
    const h = layerHeight(l);
    if (l.type === "frame") {
      const im = imgs.get(l.src);
      if (im) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; c.drawImage(smoothSource(im, page.w * scale, page.h * scale), 0, 0, page.w, page.h); }
      c.restore(); continue;
    }
    c.globalAlpha = l.opacity;
    c.translate(l.x + l.w / 2, l.y + h / 2);
    c.rotate((l.rot * Math.PI) / 180);
    c.translate(-l.w / 2, -h / 2);
    if (l.type === "photo") drawPhoto(c, l, imgs.get(l.src), scale);
    else if (l.type === "text") drawText(c, l);
    else {
      c.fillStyle = l.fill;
      if (l.shape === "circle") { c.beginPath(); c.ellipse(l.w / 2, l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); c.fill(); }
      else { roundRect(c, 0, 0, l.w, l.h, l.radius); c.fill(); }
    }
    c.restore();
  }
  c.restore();
}

/** Render ke canvas baru `w × h`: halaman diskalakan agar pas (contain) atau memenuhi (cover), selalu dirender langsung pada skala akhir. */
export async function renderToCanvas(page: Page, w: number, h: number, fit: "cover" | "contain", bg = "#ffffff"): Promise<HTMLCanvasElement> {
  const imgs = new Map<string, HTMLImageElement>();
  await loadPageImages(page, imgs);
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const c = out.getContext("2d")!;
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const k = fit === "cover" ? Math.max(w / page.w, h / page.h) : Math.min(w / page.w, h / page.h);
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(page.w * k)); tmp.height = Math.max(1, Math.round(page.h * k));
  renderPage(tmp.getContext("2d")!, page, k, imgs);
  c.imageSmoothingQuality = "high";
  c.drawImage(tmp, Math.round((w - tmp.width) / 2), Math.round((h - tmp.height) / 2));
  return out;
}

export const canvasToBlob = (c: HTMLCanvasElement, type: string, q = 0.92) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat file"))), type, q));
