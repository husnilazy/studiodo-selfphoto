// Tata letak otomatis: dari beberapa foto menjadi halaman feed / carousel / story yang rapi.
import { newBg, newPage, newPhoto, newText, uid, type Background, type Page, type PhotoLayer } from "./types";

export type Pic = { src: string; nw: number; nh: number; name?: string };
export type Box = { x: number; y: number; w: number; h: number; rot?: number; radius?: number; border?: number; shadow?: boolean };

export const LAYOUTS = [
  { id: "full", label: "Penuh", cap: 1 },
  { id: "split2v", label: "2 sejajar", cap: 2 },
  { id: "split2h", label: "2 bertumpuk", cap: 2 },
  { id: "trio", label: "1 besar + 2", cap: 3 },
  { id: "stack3", label: "3 bertumpuk", cap: 3 },
  { id: "grid4", label: "Grid 4", cap: 4 },
  { id: "grid6", label: "Grid 6", cap: 6 },
  { id: "polaroid", label: "Polaroid", cap: 1 },
  { id: "collage", label: "Kolase miring", cap: 3 },
] as const;
export type LayoutId = (typeof LAYOUTS)[number]["id"];
export const layoutCap = (id: LayoutId) => LAYOUTS.find((l) => l.id === id)!.cap;

/** Layout yang paling pas untuk jumlah foto tertentu. */
export const autoLayout = (n: number): LayoutId => (n <= 1 ? "full" : n === 2 ? "split2v" : n === 3 ? "trio" : n <= 4 ? "grid4" : "grid6");

export function layoutBoxes(id: LayoutId, w: number, h: number, margin = 0.05, gap = 0.02): Box[] {
  const m = Math.round(Math.min(w, h) * margin), g = Math.round(Math.min(w, h) * gap);
  const iw = w - m * 2, ih = h - m * 2;
  const r = Math.round(Math.min(w, h) * 0.02);
  const grid = (cols: number, rows: number): Box[] => {
    const cw = (iw - g * (cols - 1)) / cols, ch = (ih - g * (rows - 1)) / rows;
    return Array.from({ length: cols * rows }, (_, i) => ({ x: m + (i % cols) * (cw + g), y: m + Math.floor(i / cols) * (ch + g), w: cw, h: ch, radius: r }));
  };
  switch (id) {
    case "full": return [{ x: 0, y: 0, w, h }];
    case "split2v": return grid(2, 1);
    case "split2h": return grid(1, 2);
    case "stack3": return grid(1, 3);
    case "grid4": return grid(2, 2);
    case "grid6": return h >= w ? grid(2, 3) : grid(3, 2);
    case "trio": {
      const bigH = Math.round((ih - g) * 0.62), smallH = ih - g - bigH, cw = (iw - g) / 2;
      return [{ x: m, y: m, w: iw, h: bigH, radius: r }, { x: m, y: m + bigH + g, w: cw, h: smallH, radius: r }, { x: m + cw + g, y: m + bigH + g, w: cw, h: smallH, radius: r }];
    }
    case "polaroid": {
      const bw = Math.min(iw, ih * 0.8) * 0.92, bh = bw * 1.05;
      return [{ x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh, rot: -3, border: Math.round(bw * 0.045), shadow: true }];
    }
    case "collage": {
      const bw = iw * 0.62, bh = ih * 0.42;
      return [
        { x: m, y: m + ih * 0.04, w: bw, h: bh, rot: -5, border: 14, shadow: true },
        { x: w - m - bw, y: m + ih * 0.3, w: bw, h: bh, rot: 4, border: 14, shadow: true },
        { x: m + iw * 0.08, y: m + ih * 0.56, w: bw, h: bh, rot: -2, border: 14, shadow: true },
      ];
    }
  }
}

/** Foto → layer pada kotak layout (urut sesuai daftar foto). */
export function photosInLayout(pics: Pic[], id: LayoutId, w: number, h: number, margin?: number): PhotoLayer[] {
  const boxes = layoutBoxes(id, w, h, id === "full" ? 0 : margin);
  return boxes.slice(0, pics.length).map((b, i) => {
    const p = pics[i];
    return newPhoto(p.src, p.nw, p.nh, { x: b.x, y: b.y, w: b.w, h: b.h }, { rot: b.rot ?? 0, radius: b.radius ?? 0, border: b.border ?? 0, shadow: !!b.shadow, name: p.name });
  });
}

export const BG_PRESETS: Background[] = [
  newBg("#ffffff"), newBg("#0b1020"), newBg("#f6efe6"), newBg("#fde8ef"), newBg("#e6efff"),
  { type: "gradient", c1: "#4f4fe8", c2: "#a78bfa", angle: 135 },
  { type: "gradient", c1: "#ff9966", c2: "#ff5e62", angle: 160 },
  { type: "gradient", c1: "#0b1020", c2: "#2b2f6b", angle: 160 },
];

export type CarouselStyle = "single" | "cover" | "panorama";

/** Carousel otomatis dari kumpulan foto. */
export function buildCarousel(pics: Pic[], style: CarouselStyle, w: number, h: number, title: string, bg: Background): Page[] {
  const pages: Page[] = [];
  const total = (n: number) => String(n);
  if (style === "single") {
    pics.forEach((p, i) => {
      const pg = newPage(w, h, bg);
      pg.layers.push(...photosInLayout([p], "full", w, h));
      pg.layers.push(newText(`${i + 1}/${total(pics.length)}`, w - 220, h - 120, 180, { size: 40, align: "right", color: "#ffffff", shadow: true, weight: 600 }));
      pages.push(pg);
    });
    return pages;
  }
  if (style === "cover") {
    const first = newPage(w, h, bg);
    first.layers.push(...photosInLayout(pics.slice(0, 1), "full", w, h));
    first.layers.push(newText(title || "Momen di STUDIODO", w * 0.08, h * 0.68, w * 0.84, { size: Math.round(w * 0.085), color: "#ffffff", shadow: true, weight: 800, align: "left" }));
    first.layers.push(newText("geser →", w * 0.08, h * 0.9, w * 0.5, { size: Math.round(w * 0.035), color: "#ffffff", shadow: true, align: "left", weight: 500 }));
    pages.push(first);
    const rest = pics.slice(1);
    for (let i = 0; i < rest.length; i += 4) {
      const chunk = rest.slice(i, i + 4);
      const pg = newPage(w, h, bg);
      pg.layers.push(...photosInLayout(chunk, autoLayout(chunk.length), w, h, 0.05));
      pages.push(pg);
    }
    return pages;
  }
  // panorama: satu rangkaian foto lebar yang menyambung antar-slide
  const count = Math.max(2, Math.ceil(pics.length * 0.8));
  const step = (w * count) / pics.length, bw = step * 0.92, mh = Math.round(h * 0.12);
  const base: PhotoLayer[] = pics.map((p, i) =>
    newPhoto(p.src, p.nw, p.nh, { x: i * step + (step - bw) / 2, y: mh, w: bw, h: h - mh * 2 }, { radius: Math.round(w * 0.02), name: p.name }));
  for (let i = 0; i < count; i++) {
    const pg = newPage(w, h, bg);
    pg.layers = base.map((l) => ({ ...l, id: uid(), x: l.x - i * w }));
    if (i === 0 && title) pg.layers.push(newText(title, w * 0.08, h * 0.04, w * 0.84, { size: Math.round(w * 0.05), color: "#ffffff", shadow: true, align: "left", weight: 800 }));
    pages.push(pg);
  }
  return pages;
}
