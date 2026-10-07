// Katalog elemen vektor (SVG) yang bisa diwarnai ulang. Dibuat lewat kode → tajam di ukuran berapa pun.
export type AssetCat = "bentuk" | "dekorasi" | "bingkai";
export type Asset = { id: string; label: string; cat: AssetCat; w: number; h: number; svg: (c: string) => string; color: string };

const wrap = (w: number, h: number, body: string, par = "xMidYMid meet") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 5}" height="${h * 5}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${par}">${body}</svg>`;
const pts = (n: number, outer: number, inner: number, cx = 100, cy = 100) =>
  Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? inner : outer, a = (Math.PI * i) / n - Math.PI / 2; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(" ");

const SPARK = "M100 0C108 70 130 92 200 100C130 108 108 130 100 200C92 130 70 108 0 100C70 92 92 70 100 0Z";

export const ASSETS: Asset[] = [
  { id: "circle", label: "Lingkaran", cat: "bentuk", w: 200, h: 200, color: "#4f4fe8", svg: (c) => wrap(200, 200, `<circle cx="100" cy="100" r="100" fill="${c}"/>`) },
  { id: "rounded", label: "Kotak bulat", cat: "bentuk", w: 200, h: 200, color: "#4f4fe8", svg: (c) => wrap(200, 200, `<rect width="200" height="200" rx="36" fill="${c}"/>`) },
  { id: "triangle", label: "Segitiga", cat: "bentuk", w: 200, h: 200, color: "#f59e0b", svg: (c) => wrap(200, 200, `<polygon points="100,14 188,176 12,176" fill="${c}" stroke="${c}" stroke-width="14" stroke-linejoin="round"/>`) },
  { id: "star", label: "Bintang", cat: "bentuk", w: 200, h: 200, color: "#fbbf24", svg: (c) => wrap(200, 200, `<polygon points="${pts(5, 98, 42)}" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`) },
  { id: "heart", label: "Hati", cat: "bentuk", w: 200, h: 200, color: "#ec4899", svg: (c) => wrap(200, 200, `<path d="M100 178C20 118 6 84 6 58 6 32 26 14 52 14c20 0 38 12 48 30 10-18 28-30 48-30 26 0 46 18 46 44 0 26-14 60-94 120z" fill="${c}"/>`) },
  { id: "diamond", label: "Berlian", cat: "bentuk", w: 200, h: 200, color: "#06b6d4", svg: (c) => wrap(200, 200, `<polygon points="100,6 194,100 100,194 6,100" fill="${c}" stroke="${c}" stroke-width="10" stroke-linejoin="round"/>`) },
  { id: "hexagon", label: "Segi enam", cat: "bentuk", w: 200, h: 200, color: "#10b981", svg: (c) => wrap(200, 200, `<polygon points="100,6 182,53 182,147 100,194 18,147 18,53" fill="${c}" stroke="${c}" stroke-width="10" stroke-linejoin="round"/>`) },
  { id: "arrow", label: "Panah", cat: "bentuk", w: 240, h: 120, color: "#0b1020", svg: (c) => wrap(240, 120, `<path d="M10 44h140V12l80 48-80 48V76H10z" fill="${c}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`) },
  { id: "line", label: "Garis", cat: "bentuk", w: 400, h: 16, color: "#0b1020", svg: (c) => wrap(400, 16, `<rect y="2" width="400" height="12" rx="6" fill="${c}"/>`) },
  { id: "bubble", label: "Balon ucapan", cat: "bentuk", w: 240, h: 200, color: "#ffffff", svg: (c) => wrap(240, 200, `<path d="M40 10h160a30 30 0 0 1 30 30v90a30 30 0 0 1-30 30h-96l-44 36v-36H40a30 30 0 0 1-30-30V40a30 30 0 0 1 30-30z" fill="${c}"/>`) },
  { id: "burst", label: "Badge bergerigi", cat: "bentuk", w: 200, h: 200, color: "#ef4444", svg: (c) => wrap(200, 200, `<polygon points="${pts(14, 98, 80)}" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`) },
  { id: "blob", label: "Blob", cat: "bentuk", w: 200, h: 200, color: "#a78bfa", svg: (c) => wrap(200, 200, `<path d="M158 36c26 24 40 66 22 98-18 32-62 56-100 44S14 120 22 80C30 40 66 10 104 10c20 0 40 8 54 26z" fill="${c}"/>`) },

  { id: "sparkle", label: "Kilau", cat: "dekorasi", w: 200, h: 200, color: "#fbbf24", svg: (c) => wrap(200, 200, `<path d="${SPARK}" fill="${c}"/>`) },
  { id: "sparkles", label: "Kilau trio", cat: "dekorasi", w: 240, h: 220, color: "#fbbf24", svg: (c) => wrap(240, 220, `<g fill="${c}"><path transform="translate(70 10) scale(.85)" d="${SPARK}"/><path transform="translate(8 128) scale(.4)" d="${SPARK}"/><path transform="translate(150 120) scale(.5)" d="${SPARK}"/></g>`) },
  { id: "confetti", label: "Confetti", cat: "dekorasi", w: 300, h: 200, color: "#ec4899", svg: (c) => wrap(300, 200, `<g fill="${c}"><circle cx="30" cy="40" r="9"/><circle cx="120" cy="22" r="6"/><circle cx="240" cy="50" r="10"/><circle cx="270" cy="150" r="7"/><circle cx="60" cy="160" r="8"/><rect x="170" y="90" width="22" height="9" rx="3" transform="rotate(30 181 94)"/><rect x="90" y="100" width="20" height="8" rx="3" transform="rotate(-40 100 104)"/><rect x="210" y="170" width="18" height="8" rx="3" transform="rotate(60 219 174)"/><rect x="15" y="100" width="18" height="8" rx="3" transform="rotate(20 24 104)"/></g>`) },
  { id: "wave", label: "Gelombang", cat: "dekorasi", w: 400, h: 60, color: "#4f4fe8", svg: (c) => wrap(400, 60, `<path d="M0 30Q25 4 50 30T100 30T150 30T200 30T250 30T300 30T350 30T400 30" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`) },
  { id: "tape", label: "Lakban washi", cat: "dekorasi", w: 220, h: 70, color: "#fcd34d", svg: (c) => wrap(220, 70, `<path d="M6 6l10 8-10 8 10 8-10 8 10 8-10 8h208l-10-8 10-8-10-8 10-8-10-8 10-8z" fill="${c}" fill-opacity=".8"/><path d="M40 6l-20 58M80 6l-20 58M120 6l-20 58M160 6l-20 58M200 6l-20 58" stroke="#fff" stroke-opacity=".35" stroke-width="8"/>`) },
  { id: "brackets", label: "Sudut siku", cat: "dekorasi", w: 300, h: 300, color: "#0b1020", svg: (c) => wrap(300, 300, `<g fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M6 80V6h74M220 6h74v74M294 220v74h-74M80 294H6v-74"/></g>`) },
  { id: "ribbon", label: "Pita judul", cat: "dekorasi", w: 360, h: 100, color: "#ef4444", svg: (c) => wrap(360, 100, `<path d="M0 20h60l20 20v40l-20 20H0l24-30z" fill="${c}" fill-opacity=".7"/><path d="M360 20h-60l-20 20v40l20 20h60l-24-30z" fill="${c}" fill-opacity=".7"/><rect x="50" y="6" width="260" height="76" rx="6" fill="${c}"/>`) },
  { id: "ring", label: "Cincin", cat: "dekorasi", w: 200, h: 200, color: "#ffffff", svg: (c) => wrap(200, 200, `<circle cx="100" cy="100" r="92" fill="none" stroke="${c}" stroke-width="12"/>`) },
  { id: "dashring", label: "Cincin putus", cat: "dekorasi", w: 200, h: 200, color: "#ffffff", svg: (c) => wrap(200, 200, `<circle cx="100" cy="100" r="92" fill="none" stroke="${c}" stroke-width="8" stroke-dasharray="14 12" stroke-linecap="round"/>`) },
  { id: "underline", label: "Garis coretan", cat: "dekorasi", w: 300, h: 40, color: "#fbbf24", svg: (c) => wrap(300, 40, `<path d="M6 28C60 8 110 36 160 18S250 10 294 22" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`) },
  { id: "camera", label: "Ikon kamera", cat: "dekorasi", w: 24, h: 24, color: "#0b1020", svg: (c) => wrap(24, 24, `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "check", label: "Centang", cat: "dekorasi", w: 200, h: 200, color: "#10b981", svg: (c) => wrap(200, 200, `<circle cx="100" cy="100" r="100" fill="${c}"/><path d="M56 104l32 32 58-70" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`) },

  // Bingkai: menutup seluruh halaman, bagian tengah transparan
  { id: "fr-thin", label: "Garis tipis", cat: "bingkai", w: 1000, h: 1000, color: "#ffffff", svg: (c) => wrap(1000, 1000, `<path fill="${c}" fill-rule="evenodd" d="M0 0h1000v1000H0zM40 40v920h920V40z"/>`, "none") },
  { id: "fr-thick", label: "Tebal", cat: "bingkai", w: 1000, h: 1000, color: "#ffffff", svg: (c) => wrap(1000, 1000, `<path fill="${c}" fill-rule="evenodd" d="M0 0h1000v1000H0zM90 90v820h820V90z"/>`, "none") },
  { id: "fr-polaroid", label: "Polaroid", cat: "bingkai", w: 1000, h: 1000, color: "#ffffff", svg: (c) => wrap(1000, 1000, `<path fill="${c}" fill-rule="evenodd" d="M0 0h1000v1000H0zM60 60v720h880V60z"/>`, "none") },
  { id: "fr-round", label: "Sudut bulat", cat: "bingkai", w: 1000, h: 1000, color: "#ffffff", svg: (c) => wrap(1000, 1000, `<path fill="${c}" fill-rule="evenodd" d="M0 0h1000v1000H0zM110 50h780a60 60 0 0 1 60 60v780a60 60 0 0 1-60 60H110a60 60 0 0 1-60-60V110a60 60 0 0 1 60-60z"/>`, "none") },
  { id: "fr-film", label: "Film", cat: "bingkai", w: 1000, h: 1000, color: "#111111", svg: (c) => wrap(1000, 1000, `<rect width="1000" height="90" fill="${c}"/><rect y="910" width="1000" height="90" fill="${c}"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${24 + i * 71}" y="28" width="34" height="34" rx="6" fill="#fff"/><rect x="${24 + i * 71}" y="938" width="34" height="34" rx="6" fill="#fff"/>`).join("")}`, "none") },
];

export const assetById = (id: string) => ASSETS.find((a) => a.id === id);
export const assetUrl = (id: string, color: string) => {
  const a = assetById(id)!;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg(color))}`;
};

export const EMOJIS = ["✨", "💖", "📸", "🎉", "🔥", "⭐", "🌸", "😍", "🥳", "💫", "🎀", "🌈", "🎞️", "🤍", "💜", "🍓", "🌟", "💌", "🎈", "🪩"];
