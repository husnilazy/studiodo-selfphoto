// Template desain siap pakai (koordinat relatif terhadap ukuran halaman → cocok untuk feed, story, maupun cetak).
import { assetById, assetUrl } from "./assets";
import { layoutBoxes } from "./layouts";
import { newBg, newPage, newPhoto, newShape, newText, type Layer, type Page, type PhotoLayer } from "./types";

export type Brand = {
  name: string; logo: string; logoDark: string; accent: string; accent2: string;
  instagram: string; whatsapp: string; address: string;
  logoW?: number; logoH?: number; logoDarkW?: number; logoDarkH?: number;
};

/** Kotak foto kosong (diisi dari kumpulan foto). */
export const placeholder = (x: number, y: number, w: number, h: number, extra: Partial<PhotoLayer> = {}) => newPhoto("", 4, 3, { x, y, w, h }, { name: "Foto", ...extra });

/** Elemen vektor sebagai layer gambar. */
export function assetLayer(id: string, color: string, box: { x: number; y: number; w: number; h: number }, extra: Partial<PhotoLayer> = {}): PhotoLayer {
  const a = assetById(id)!;
  return newPhoto(assetUrl(id, color), box.w, box.h, box, { fit: "contain", assetId: id, color, name: a.label, ...extra });
}

/** Alamat gambar yang aman dipakai di canvas (lintas-origin diteruskan lewat proxy server). */
export const safeSrc = (u: string) => (/^https?:\/\//i.test(u) ? `/api/editor/proxy?u=${encodeURIComponent(u)}` : u);

export function logoLayer(b: Brand, onDark: boolean, cx: number, y: number, maxW: number, maxH: number): Layer {
  const src = onDark ? b.logoDark || b.logo : b.logo || b.logoDark;
  const nw = (onDark ? b.logoDarkW ?? b.logoW : b.logoW ?? b.logoDarkW) ?? 3, nh = (onDark ? b.logoDarkH ?? b.logoH : b.logoH ?? b.logoDarkH) ?? 1;
  if (!src) return newText(b.name, cx - maxW / 2, y, maxW, { size: Math.round(maxH * 0.7), weight: 800, color: onDark ? "#ffffff" : "#0b1020" });
  const k = Math.min(maxW / nw, maxH / nh);
  return newPhoto(safeSrc(src), nw, nh, { x: cx - (nw * k) / 2, y, w: nw * k, h: nh * k }, { fit: "contain", name: "Logo" });
}

const DARK = "#0b1020";
type Make = (w: number, h: number, b: Brand) => Page;
export type Template = { id: string; label: string; make: Make };

const gradBg = (b: Brand) => ({ type: "gradient" as const, c1: b.accent, c2: b.accent2, angle: 150 });

export const TEMPLATES: Template[] = [
  {
    id: "promo", label: "Promo Diskon",
    make: (w, h, b) => {
      const pg = newPage(w, h, gradBg(b));
      const m = w * 0.07;
      pg.layers.push(placeholder(m, h * 0.06, w - m * 2, h * 0.5, { radius: w * 0.04 }));
      pg.layers.push(assetLayer("burst", "#ef4444", { x: w * 0.66, y: h * 0.4, w: w * 0.26, h: w * 0.26 }, { rot: 12 }));
      pg.layers.push(newText("20%", w * 0.66, h * 0.4 + w * 0.085, w * 0.26, { size: Math.round(w * 0.085), weight: 800, color: "#ffffff", font: "Poppins", rot: 12 }));
      pg.layers.push(newText("DISKON AKHIR PEKAN", m, h * 0.6, w - m * 2, { size: Math.round(w * 0.064), weight: 800, color: "#ffffff", font: "Poppins", align: "left" }));
      pg.layers.push(newText("Self photo, photobox & photobooth", m, h * 0.73, w - m * 2, { size: Math.round(w * 0.04), weight: 500, color: "#ffffff", align: "left", font: "Plus Jakarta Sans" }));
      pg.layers.push(newText("Booking sekarang", m, h * 0.8, w * 0.46, { size: Math.round(w * 0.04), weight: 700, color: DARK, bg: "#ffffff", font: "Plus Jakarta Sans" }));
      pg.layers.push(logoLayer(b, true, w / 2, h * 0.9, w * 0.3, h * 0.06));
      return pg;
    },
  },
  {
    id: "quote", label: "Quote di Foto",
    make: (w, h, b) => {
      const pg = newPage(w, h, newBg(DARK));
      pg.layers.push(placeholder(0, 0, w, h));
      pg.layers.push(newShape("rect", { x: 0, y: 0, w, h }, { fill: "#000000", opacity: 0.38 }));
      pg.layers.push(newText("Momen kecil,\nkenangan besar.", w * 0.1, h * 0.38, w * 0.8, { size: Math.round(w * 0.1), weight: 500, italic: true, color: "#ffffff", font: "Playfair Display", shadow: true }));
      pg.layers.push(logoLayer(b, true, w / 2, h * 0.88, w * 0.28, h * 0.06));
      return pg;
    },
  },
  {
    id: "duo", label: "Duo Foto",
    make: (w, h, b) => {
      const pg = newPage(w, h, newBg("#f6efe6"));
      const m = w * 0.06, g = w * 0.03, cw = (w - m * 2 - g) / 2;
      pg.layers.push(placeholder(m, h * 0.07, cw, h * 0.56, { radius: w * 0.03 }), placeholder(m + cw + g, h * 0.07, cw, h * 0.56, { radius: w * 0.03 }));
      pg.layers.push(newText("Our Moments", m, h * 0.69, w - m * 2, { size: Math.round(w * 0.11), color: b.accent, font: "Pacifico" }));
      pg.layers.push(newText("bersama orang tersayang di studio", m, h * 0.8, w - m * 2, { size: Math.round(w * 0.035), color: DARK, font: "Plus Jakarta Sans", weight: 500 }));
      pg.layers.push(logoLayer(b, false, w / 2, h * 0.9, w * 0.28, h * 0.055));
      return pg;
    },
  },
  {
    id: "polaroid", label: "Polaroid",
    make: (w, h, b) => {
      const pg = newPage(w, h, newBg("#f3ece1"));
      const pw = w * 0.7;
      pg.layers.push(placeholder((w - pw) / 2, h * 0.14, pw, pw * 1.05, { rot: -4, border: Math.round(w * 0.03), borderColor: "#ffffff", shadow: true }));
      pg.layers.push(assetLayer("tape", "#fcd34d", { x: w * 0.4, y: h * 0.1, w: w * 0.22, h: w * 0.07 }, { rot: 6 }));
      pg.layers.push(newText("bestie goals ♡", w * 0.1, h * 0.14 + pw * 1.05 + h * 0.07, w * 0.8, { size: Math.round(w * 0.085), color: DARK, font: "Caveat", weight: 700, rot: -2 }));
      pg.layers.push(logoLayer(b, false, w / 2, h * 0.92, w * 0.26, h * 0.05));
      return pg;
    },
  },
  {
    id: "harga", label: "Daftar Harga",
    make: (w, h, b) => {
      const pg = newPage(w, h, newBg("#ffffff"));
      const m = w * 0.07;
      pg.layers.push(newShape("rect", { x: m, y: h * 0.06, w: w - m * 2, h: h * 0.15 }, { fill: b.accent, radius: w * 0.04 }));
      pg.layers.push(newText("PAKET & HARGA", m, h * 0.06 + h * 0.15 / 2 - w * 0.045, w - m * 2, { size: Math.round(w * 0.075), weight: 800, color: "#ffffff", font: "Poppins" }));
      const rows: [string, string][] = [["Self Photo", "Rp 35.000 / orang"], ["Photobox", "Rp 30.000 / sesi"], ["Photobooth Event", "Rp 25.000 / sesi"]];
      rows.forEach(([n, p], i) => {
        const y = h * 0.26 + i * h * 0.13;
        pg.layers.push(newShape("rect", { x: m, y, w: w - m * 2, h: h * 0.1 }, { fill: "#f1f2fa", radius: w * 0.03 }));
        pg.layers.push(newText(n, m + w * 0.04, y + h * 0.1 / 2 - w * 0.03, w * 0.4, { size: Math.round(w * 0.045), weight: 700, color: DARK, align: "left", font: "Plus Jakarta Sans" }));
        pg.layers.push(newText(p, w * 0.45, y + h * 0.1 / 2 - w * 0.03, w * 0.48 - m * 0.4, { size: Math.round(w * 0.042), weight: 800, color: b.accent, align: "right", font: "Plus Jakarta Sans" }));
      });
      pg.layers.push(placeholder(m, h * 0.67, w - m * 2, h * 0.17, { radius: w * 0.03 }));
      pg.layers.push(logoLayer(b, false, w / 2, h * 0.89, w * 0.28, h * 0.06));
      return pg;
    },
  },
  {
    id: "testimoni", label: "Testimoni",
    make: (w, h, b) => {
      const pg = newPage(w, h, newBg(DARK));
      const d = w * 0.34;
      pg.layers.push(placeholder((w - d) / 2, h * 0.1, d, d, { radius: d / 2, border: Math.round(w * 0.012), borderColor: b.accent }));
      pg.layers.push(newText("★★★★★", w * 0.1, h * 0.1 + d + h * 0.04, w * 0.8, { size: Math.round(w * 0.08), color: "#fbbf24" }));
      pg.layers.push(newText("“Hasil fotonya bagus banget, suasananya nyaman dan stafnya ramah!”", w * 0.1, h * 0.1 + d + h * 0.14, w * 0.8, { size: Math.round(w * 0.055), weight: 600, color: "#ffffff", font: "Playfair Display", italic: true }));
      pg.layers.push(newText("— Nama Customer", w * 0.1, h * 0.8, w * 0.8, { size: Math.round(w * 0.04), weight: 700, color: b.accent2, font: "Plus Jakarta Sans" }));
      pg.layers.push(logoLayer(b, true, w / 2, h * 0.89, w * 0.26, h * 0.055));
      return pg;
    },
  },
  {
    id: "grid3", label: "Judul + 3 Foto",
    make: (w, h, b) => {
      const pg = newPage(w, h, newBg("#ffffff"));
      pg.layers.push(newText("PHOTO DAY", w * 0.06, h * 0.04, w * 0.88, { size: Math.round(w * 0.16), weight: 400, color: DARK, font: "Bebas Neue", align: "left" }));
      const boxes = layoutBoxes("trio", w, h * 0.7, 0.045, 0.02);
      boxes.forEach((bx) => pg.layers.push(placeholder(bx.x, bx.y + h * 0.19, bx.w, bx.h, { radius: bx.radius ?? 0 })));
      pg.layers.push(newText(b.instagram ? `@${b.instagram.replace(/^@/, "")}` : b.name, w * 0.06, h * 0.93, w * 0.88, { size: Math.round(w * 0.04), weight: 700, color: b.accent, align: "left", font: "Plus Jakarta Sans" }));
      return pg;
    },
  },
  {
    id: "info", label: "Info / Open Booking",
    make: (w, h, b) => {
      const pg = newPage(w, h, gradBg(b));
      pg.layers.push(assetLayer("sparkles", "#fbbf24", { x: w * 0.7, y: h * 0.05, w: w * 0.24, h: w * 0.22 }));
      pg.layers.push(newText("OPEN\nBOOKING", w * 0.08, h * 0.12, w * 0.84, { size: Math.round(w * 0.2), weight: 400, color: "#ffffff", font: "Bebas Neue", align: "left", lineHeight: 0.95 }));
      const lines = ["📅  Setiap hari · 09.00–21.00", `📍  ${b.address || "Alamat studio kamu"}`, `💬  ${b.whatsapp || "08xx-xxxx-xxxx"}`];
      lines.forEach((t, i) => pg.layers.push(newText(t, w * 0.08, h * 0.5 + i * h * 0.09, w * 0.84, { size: Math.round(w * 0.04), weight: 600, color: DARK, bg: "#ffffff", align: "left", font: "Plus Jakarta Sans" })));
      pg.layers.push(logoLayer(b, true, w / 2, h * 0.88, w * 0.3, h * 0.065));
      return pg;
    },
  },
];
