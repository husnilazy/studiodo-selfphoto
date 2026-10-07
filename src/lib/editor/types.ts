// Model dokumen editor foto. Murni data (JSON), aman disimpan ke database & dipakai di client.

export type Slot = { x: number; y: number; w: number; h: number }; // piksel pada gambar frame asli

export type Filter = { brightness: number; contrast: number; saturate: number; warmth: number; grayscale: number; blur: number };
export const NO_FILTER: Filter = { brightness: 100, contrast: 100, saturate: 100, warmth: 0, grayscale: 0, blur: 0 };

type Base = { id: string; name?: string; x: number; y: number; w: number; h: number; rot: number; opacity: number; locked?: boolean; hidden?: boolean };

export type PhotoLayer = Base & {
  type: "photo"; src: string;
  nw: number; nh: number;            // ukuran asli gambar
  zoom: number; ox: number; oy: number; // isi foto di dalam kotak: zoom ≥ 1, geser −1..1
  fit: "cover" | "contain"; flipX: boolean;
  radius: number; border: number; borderColor: string; shadow: boolean;
  filter: Filter; slot?: number;      // slot frame (kotak terkunci)
};
export type TextLayer = Base & {
  type: "text"; text: string; font: string; size: number; weight: number; italic: boolean; color: string;
  align: "left" | "center" | "right"; letter: number; lineHeight: number; shadow: boolean; bg: string; // bg = warna pill, "" = tanpa
};
export type ShapeLayer = Base & { type: "shape"; shape: "rect" | "circle"; fill: string; radius: number };
export type FrameLayer = Base & { type: "frame"; src: string; slots: Slot[]; fw: number; fh: number };
export type Layer = PhotoLayer | TextLayer | ShapeLayer | FrameLayer;

export type Background = { type: "color" | "gradient"; c1: string; c2: string; angle: number };
export type Page = { id: string; w: number; h: number; bg: Background; layers: Layer[] };

export type DesignKind = "frame" | "feed" | "carousel" | "story" | "print";
export type Design = { name: string; kind: DesignKind; pages: Page[] };

export const uid = () => Math.random().toString(36).slice(2, 10);

export const newBg = (c = "#ffffff"): Background => ({ type: "color", c1: c, c2: "#e9e4ff", angle: 135 });
export const newPage = (w: number, h: number, bg = newBg()): Page => ({ id: uid(), w, h, bg, layers: [] });

export function newPhoto(src: string, nw: number, nh: number, box: { x: number; y: number; w: number; h: number }, extra: Partial<PhotoLayer> = {}): PhotoLayer {
  return {
    id: uid(), type: "photo", src, nw, nh, ...box, rot: 0, opacity: 1, zoom: 1, ox: 0, oy: 0, fit: "cover", flipX: false,
    radius: 0, border: 0, borderColor: "#ffffff", shadow: false, filter: { ...NO_FILTER }, ...extra,
  };
}
export function newText(text: string, x: number, y: number, w: number, extra: Partial<TextLayer> = {}): TextLayer {
  return {
    id: uid(), type: "text", text, x, y, w, h: 0, rot: 0, opacity: 1, font: "Sora", size: 64, weight: 700, italic: false, color: "#0b1020",
    align: "center", letter: 0, lineHeight: 1.15, shadow: false, bg: "", ...extra,
  };
}
export function newShape(shape: "rect" | "circle", box: { x: number; y: number; w: number; h: number }, extra: Partial<ShapeLayer> = {}): ShapeLayer {
  return { id: uid(), type: "shape", shape, ...box, rot: 0, opacity: 1, fill: "#4f4fe8", radius: 0, ...extra };
}

/* ───────── Ukuran halaman & ukuran cetak ───────── */
export type SizePreset = { id: string; label: string; w: number; h: number; group: "sosmed" | "cetak"; mm?: [number, number] };
const px = (mm: number, dpi = 300) => Math.round((mm / 25.4) * dpi);
const print = (id: string, label: string, wmm: number, hmm: number): SizePreset => ({ id, label, w: px(wmm), h: px(hmm), group: "cetak", mm: [wmm, hmm] });

export const SIZES: SizePreset[] = [
  { id: "feed45", label: "Feed Instagram 4:5 (1080×1350)", w: 1080, h: 1350, group: "sosmed" },
  { id: "feed11", label: "Feed Instagram 1:1 (1080×1080)", w: 1080, h: 1080, group: "sosmed" },
  { id: "feedland", label: "Feed Landscape 1.91:1 (1080×566)", w: 1080, h: 566, group: "sosmed" },
  { id: "story", label: "Story / Reels 9:16 (1080×1920)", w: 1080, h: 1920, group: "sosmed" },
  { id: "fb", label: "Facebook / X 16:9 (1600×900)", w: 1600, h: 900, group: "sosmed" },
  print("4r", "4R · 10,2×15,2 cm", 102, 152),
  print("4rl", "4R landscape · 15,2×10,2 cm", 152, 102),
  print("2r", "2R · 6,4×8,9 cm", 64, 89),
  print("3r", "3R · 8,9×12,7 cm", 89, 127),
  print("5r", "5R · 12,7×17,8 cm", 127, 178),
  print("6r", "6R · 15,2×20,3 cm", 152, 203),
  print("8r", "8R · 20,3×25,4 cm", 203, 254),
  print("a6", "A6 · 10,5×14,8 cm", 105, 148),
  print("a5", "A5 · 14,8×21 cm", 148, 210),
  print("a4", "A4 · 21×29,7 cm", 210, 297),
  print("strip", "Photostrip · 5×15 cm", 50, 150),
  print("pas34", "Pas foto 3×4 cm", 30, 40),
];
export const sizeById = (id: string) => SIZES.find((s) => s.id === id);

export const FONTS = ["Sora", "Plus Jakarta Sans", "Georgia", "Playfair Display", "Arial", "Courier New", "Impact", "Brush Script MT"];
