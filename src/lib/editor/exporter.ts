// Ekspor: render ke berkas, lembar cetak (beberapa salinan per kertas), ZIP, unduh, dan cetak.
import { canvasToBlob, renderToCanvas } from "./render";
import type { Page } from "./types";

export type Format = "png" | "jpeg" | "webp";
export const MIME: Record<Format, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
export const EXT: Record<Format, string> = { png: "png", jpeg: "jpg", webp: "webp" };

export type ExportOpts = { w: number; h: number; fit: "cover" | "contain"; bg: string; format: Format; quality: number };

export async function exportPage(page: Page, o: ExportOpts) {
  const canvas = await renderToCanvas(page, o.w, o.h, o.fit, o.bg);
  const blob = await canvasToBlob(canvas, MIME[o.format], o.quality);
  return { canvas, blob };
}

export const mmToPx = (mm: number, dpi = 300) => Math.round((mm / 25.4) * dpi);

/** Susun `n` salinan gambar pada satu lembar kertas (arah kertas & grid dipilih otomatis agar paling besar). */
export function composeSheet(item: HTMLCanvasElement, paperMm: [number, number], n: number, marginMm: number, cutLines: boolean, dpi = 300) {
  let best: { s: number; cols: number; rows: number; land: boolean } | null = null;
  for (const land of [false, true]) {
    const [pwmm, phmm] = land ? [paperMm[1], paperMm[0]] : paperMm;
    const pw = mmToPx(pwmm, dpi) - 2 * mmToPx(marginMm, dpi), ph = mmToPx(phmm, dpi) - 2 * mmToPx(marginMm, dpi);
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const s = Math.min(1, pw / cols / item.width, ph / rows / item.height);
      if (!best || s > best.s + 1e-6) best = { s, cols, rows, land };
    }
  }
  const b = best!;
  const [wmm, hmm] = b.land ? [paperMm[1], paperMm[0]] : paperMm;
  const W = mmToPx(wmm, dpi), H = mmToPx(hmm, dpi);
  const sheet = document.createElement("canvas");
  sheet.width = W; sheet.height = H;
  const c = sheet.getContext("2d")!;
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  c.imageSmoothingQuality = "high";
  const iw = Math.round(item.width * b.s), ih = Math.round(item.height * b.s);
  const gx = (W - iw * b.cols) / 2, gy = (H - ih * b.rows) / 2;
  for (let i = 0; i < n; i++) {
    const x = Math.round(gx + (i % b.cols) * iw), y = Math.round(gy + Math.floor(i / b.cols) * ih);
    c.drawImage(item, x, y, iw, ih);
  }
  if (cutLines) {
    c.strokeStyle = "#9aa3bd"; c.lineWidth = 2;
    const t = mmToPx(3, dpi);
    for (let i = 0; i <= b.cols; i++) for (let j = 0; j <= b.rows; j++) {
      const x = Math.round(gx + i * iw), y = Math.round(gy + j * ih);
      c.beginPath(); c.moveTo(x - t, y); c.lineTo(x + t, y); c.moveTo(x, y - t); c.lineTo(x, y + t); c.stroke();
    }
  }
  return { canvas: sheet, wmm, hmm };
}

export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const z = new JSZip();
  for (const f of files) z.file(f.name, f.blob);
  return z.generateAsync({ type: "blob" });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "desain";

/** Buka jendela cetak: tiap gambar tepat memenuhi satu halaman berukuran kertas (mm). Jendela dibuka lebih dulu agar tidak diblokir. */
export function openPrintWindow(): Window | null {
  const w = window.open("", "_blank");
  if (w) w.document.write("<p style='font-family:sans-serif;padding:24px'>Menyiapkan cetakan…</p>");
  return w;
}
export async function printBlobs(w: Window, blobs: Blob[], wmm: number, hmm: number) {
  const urls = blobs.map((b) => URL.createObjectURL(b));
  w.document.open();
  w.document.write(`<!doctype html><html><head><title>Cetak STUDIODO</title><style>
    @page{size:${wmm}mm ${hmm}mm;margin:0}html,body{margin:0;background:#fff}
    img{display:block;width:${wmm}mm;height:${hmm}mm;object-fit:contain;break-after:page;page-break-after:always}
    img:last-child{break-after:auto;page-break-after:auto}</style></head><body>${urls.map((u) => `<img src="${u}">`).join("")}</body></html>`);
  w.document.close();
  await Promise.all([...w.document.images].map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = () => r(null); }))));
  setTimeout(() => { w.focus(); w.print(); }, 250);
}
