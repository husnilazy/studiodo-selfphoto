const S = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** Angka → kata (Bahasa Indonesia), untuk slip gaji: 1250000 → "satu juta dua ratus lima puluh ribu". */
export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return S[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh${n % 10 ? " " + terbilang(n % 10) : ""}`;
  if (n < 200) return `seratus${n % 100 ? " " + terbilang(n % 100) : ""}`;
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus${n % 100 ? " " + terbilang(n % 100) : ""}`;
  if (n < 2000) return `seribu${n % 1000 ? " " + terbilang(n % 1000) : ""}`;
  if (n < 1e6) return `${terbilang(Math.floor(n / 1e3))} ribu${n % 1e3 ? " " + terbilang(n % 1e3) : ""}`;
  if (n < 1e9) return `${terbilang(Math.floor(n / 1e6))} juta${n % 1e6 ? " " + terbilang(n % 1e6) : ""}`;
  if (n < 1e12) return `${terbilang(Math.floor(n / 1e9))} miliar${n % 1e9 ? " " + terbilang(n % 1e9) : ""}`;
  return String(n);
}
