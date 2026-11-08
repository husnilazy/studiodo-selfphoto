import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

/** PDF sungguhan dari server: tombol "Unduh PDF" bekerja di iPhone/Android tanpa dialog cetak. Font standar (Latin). */
const clean = (s: string) =>
  String(s).replace(/→/g, "->").replace(/−/g, "-").replace(/≈/g, "~").replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”…•]/g, "");

const A4 = { w: 595.28, h: 841.89 }, M = 48;
export const C = { ink: rgb(0.09, 0.09, 0.1), mute: rgb(0.42, 0.42, 0.45), line: rgb(0.82, 0.82, 0.85), accent: rgb(0.1, 0.1, 0.12), bad: rgb(0.75, 0.2, 0.2) };

export class Pdf {
  doc!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; y = 0; logo: PDFImage | null = null;
  /** logoFrom: URL permintaan; logo diambil dari /logo-black.png di origin yang sama (file public tidak selalu ada di filesystem fungsi). */
  static async create(opts: { logoFrom?: string } = {}) {
    const p = new Pdf();
    p.doc = await PDFDocument.create();
    p.font = await p.doc.embedFont(StandardFonts.Helvetica);
    p.bold = await p.doc.embedFont(StandardFonts.HelveticaBold);
    if (opts.logoFrom) {
      try {
        const r = await fetch(new URL("/logo-black.png", opts.logoFrom));
        if (r.ok) p.logo = await p.doc.embedPng(new Uint8Array(await r.arrayBuffer()));
      } catch { p.logo = null; }
    }
    p.addPage();
    return p;
  }
  addPage() { this.page = this.doc.addPage([A4.w, A4.h]); this.y = A4.h - M; }
  need(h: number) { if (this.y - h < M + 20) this.addPage(); }
  get width() { return A4.w - 2 * M; }
  gap(n = 8) { this.y -= n; }
  rule(color = C.line) { this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness: 0.7, color }); this.y -= 8; }
  w(s: string, size: number, b = false) { return (b ? this.bold : this.font).widthOfTextAtSize(clean(s), size); }
  /** Teks dibungkus per kata; mengembalikan jumlah baris. */
  text(s: string, o: { size?: number; b?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; align?: "left" | "right" | "center"; lead?: number } = {}) {
    const size = o.size ?? 10, f = o.b ? this.bold : this.font, x = o.x ?? M, width = o.width ?? A4.w - M - x, lead = o.lead ?? size * 1.4;
    const lines: string[] = [];
    for (const para of clean(s).split("\n")) {
      let cur = "";
      for (const word of para.split(" ")) {
        const t = cur ? cur + " " + word : word;
        if (f.widthOfTextAtSize(t, size) > width && cur) { lines.push(cur); cur = word; } else cur = t;
      }
      lines.push(cur);
    }
    for (const ln of lines) {
      this.need(lead);
      const lw = f.widthOfTextAtSize(ln, size);
      const dx = o.align === "right" ? x + width - lw : o.align === "center" ? x + (width - lw) / 2 : x;
      this.page.drawText(ln, { x: dx, y: this.y - size, size, font: f, color: o.color ?? C.ink });
      this.y -= lead;
    }
    return lines.length;
  }
  h(s: string) { this.gap(10); this.need(30); this.text(s, { size: 12, b: true }); this.gap(2); this.rule(); }
  /** Dua kolom: label kiri, nilai kanan. */
  kv(label: string, value: string, o: { b?: boolean; sub?: string } = {}) {
    this.need(16);
    const y0 = this.y;
    this.text(label, { b: o.b, width: this.width * 0.62 });
    const y1 = this.y; this.y = y0;
    this.text(value, { b: o.b, x: M + this.width * 0.62, width: this.width * 0.38, align: "right" });
    this.y = Math.min(y1, this.y);
    if (o.sub) this.text(o.sub, { size: 8, color: C.mute, width: this.width * 0.8 });
  }
  /** Tabel sederhana; kolom pertama kiri, sisanya rata kanan. */
  table(head: string[], rows: string[][], widths: number[]) {
    const tot = widths.reduce((a, b) => a + b, 0), cw = widths.map((x) => (x / tot) * this.width);
    const draw = (cells: string[], b: boolean, color = C.ink) => {
      this.need(16);
      const y0 = this.y; let low = y0;
      let x = M;
      cells.forEach((c, i) => {
        this.y = y0;
        this.text(c, { size: 8.5, b, color, x, width: cw[i] - 6, align: i === 0 ? "left" : "right" });
        low = Math.min(low, this.y); x += cw[i];
      });
      this.y = low - 2;
    };
    draw(head, true, C.mute); this.rule();
    rows.forEach((r) => draw(r, false));
    this.gap(4);
  }
  /** Persegi (yTop = tepi atas). */
  rect(x: number, yTop: number, w: number, h: number, color: ReturnType<typeof rgb>) { this.page.drawRectangle({ x, y: yTop - h, width: w, height: h, color }); }
  /** Satu baris teks di posisi mutlak; align right memakai x sebagai tepi kanan. */
  at(s: string, x: number, yTop: number, o: { size?: number; b?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) {
    const size = o.size ?? 10, f = o.b ? this.bold : this.font, t = clean(s), w = f.widthOfTextAtSize(t, size);
    this.page.drawText(t, { x: o.align === "right" ? x - w : x, y: yTop - size, size, font: f, color: o.color ?? C.ink });
  }
  footer(s: string) {
    this.doc.getPages().forEach((p, i, all) => {
      p.drawText(clean(`${s}  ·  ${i + 1}/${all.length}`), { x: M, y: 24, size: 7.5, font: this.font, color: C.mute });
    });
  }
  async bytes() { return await this.doc.save(); }
}

export const pdfResponse = (bytes: Uint8Array, filename: string, download: boolean) =>
  new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
