/** Warna gradien lembut dari satu warna dasar (untuk kartu background tanpa foto). */
export const roomGradient = (c: string) =>
  `linear-gradient(135deg, ${c} 0%, color-mix(in oklab, ${c} 55%, white) 100%)`;
