// Frame photobooth: hilangkan latar hijau (chroma key) dan temukan area kosong sebagai slot foto.
import type { Slot } from "./types";

export type FrameScan = { w: number; h: number; slots: Slot[]; keyed: number; canvas: HTMLCanvasElement };

/** Seberapa "hijau" sebuah piksel (0 = bukan hijau). Dasarnya: hijau mengungguli merah & biru. */
const greenness = (r: number, g: number, b: number) => g - Math.max(r, b);

/**
 * Proses gambar frame:
 *  - piksel hijau → transparan (tepi dibuat lembut + pembersihan sisa hijau di pinggir)
 *  - area transparan yang berdekatan → satu slot (kotak pembatas)
 * `tolerance` 10–120: makin besar makin banyak hijau yang terhapus.
 */
export async function scanFrame(file: Blob, tolerance = 50, maxSide = 4000): Promise<FrameScan> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const lo = tolerance * 0.6, hi = tolerance * 1.5;
  let keyed = 0;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (d[i + 3] === 0) { keyed++; continue; }
    const gr = greenness(r, g, b);
    // minimal cukup terang & jenuh agar hijau gelap pada desain tidak ikut terhapus
    if (g < 70 || gr <= lo * 0.5) continue;
    if (gr >= hi) { d[i + 3] = 0; keyed++; continue; }
    if (gr > lo) {
      const a = 1 - (gr - lo) / (hi - lo); // tepi: transparan sebagian
      d[i + 3] = Math.round(d[i + 3] * Math.max(0, Math.min(1, a)));
    }
    // buang rona hijau yang tersisa di tepi
    d[i + 1] = Math.min(g, Math.max(r, b));
  }
  ctx.putImageData(img, 0, 0);

  // ── deteksi slot pada peta mini (maks 700 px) agar cepat ──
  const ds = Math.min(1, 700 / Math.max(w, h));
  const mw = Math.max(1, Math.round(w * ds)), mh = Math.max(1, Math.round(h * ds));
  const mask = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    const sy = Math.min(h - 1, Math.floor(y / ds));
    for (let x = 0; x < mw; x++) {
      const sx = Math.min(w - 1, Math.floor(x / ds));
      mask[y * mw + x] = d[(sy * w + sx) * 4 + 3] < 40 ? 1 : 0;
    }
  }
  const slots: Slot[] = [];
  const seen = new Uint8Array(mw * mh);
  const stack = new Int32Array(mw * mh);
  const minArea = mw * mh * 0.004;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0, area = 0, x0 = mw, y0 = mh, x1 = 0, y1 = 0;
    stack[sp++] = start; seen[start] = 1;
    while (sp) {
      const p = stack[--sp], x = p % mw, y = (p / mw) | 0;
      area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < mw - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - mw] && !seen[p - mw]) { seen[p - mw] = 1; stack[sp++] = p - mw; }
      if (y < mh - 1 && mask[p + mw] && !seen[p + mw]) { seen[p + mw] = 1; stack[sp++] = p + mw; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (area < minArea) continue;
    if (bw > mw * 0.97 && bh > mh * 0.97) continue; // latar luar, bukan slot
    slots.push({ x: Math.round(x0 / ds), y: Math.round(y0 / ds), w: Math.round(bw / ds), h: Math.round(bh / ds) });
  }
  // urut atas→bawah, lalu kiri→kanan (dengan toleransi baris)
  slots.sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.4 ? a.x - b.x : a.y - b.y));
  return { w, h, slots, keyed: keyed / (w * h), canvas };
}
