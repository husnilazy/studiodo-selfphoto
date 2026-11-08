import "server-only";
import { one } from "./db";

/** Profil & kredensial per unit usaha: kop surat slip/proposal, legalitas, rekening, rekam jejak. Disimpan di settings.profiles. */
export type Profile = {
  legal_name: string; entity: string; address: string; phone: string; email: string; website: string;
  nib: string; nib_date: string; kbli: string; scale: string; ahu: string; ahu_date: string; npwp: string;
  bank_name: string; bank_account: string; bank_holder: string; director: string; since: string; tagline: string; credentials: string;
};
export const PROFILE_FIELDS: { key: keyof Profile; label: string; wide?: boolean; area?: boolean; hint?: string }[] = [
  { key: "legal_name", label: "Nama badan usaha" }, { key: "entity", label: "Bentuk badan hukum" },
  { key: "address", label: "Alamat", wide: true }, { key: "phone", label: "Telepon" }, { key: "email", label: "Email" }, { key: "website", label: "Website / Instagram" },
  { key: "nib", label: "NIB" }, { key: "nib_date", label: "Tanggal terbit NIB" }, { key: "kbli", label: "KBLI / bidang usaha", wide: true }, { key: "scale", label: "Status & skala" },
  { key: "ahu", label: "No. pengesahan Kemenkumham (AHU)" }, { key: "ahu_date", label: "Tanggal AHU" }, { key: "npwp", label: "NPWP" },
  { key: "bank_name", label: "Bank perusahaan" }, { key: "bank_account", label: "No. rekening perusahaan" }, { key: "bank_holder", label: "Atas nama rekening" },
  { key: "director", label: "Direktur / pemilik" }, { key: "since", label: "Berdiri / mulai beroperasi" },
  { key: "tagline", label: "Deskripsi singkat usaha", wide: true, hint: "1–2 kalimat yang muncul di proposal." },
  { key: "credentials", label: "Rekam jejak & kredensial", wide: true, area: true, hint: "Satu butir per baris: klien besar, jumlah proyek, penghargaan, sertifikasi, liputan media, mitra." },
];
const blank = (): Profile => ({ legal_name: "", entity: "", address: "", phone: "", email: "", website: "", nib: "", nib_date: "", kbli: "", scale: "", ahu: "", ahu_date: "", npwp: "", bank_name: "", bank_account: "", bank_holder: "", director: "", since: "", tagline: "", credentials: "" });

/** Diisi dari dokumen resmi (NIB OSS & sertifikat Kemenkumham). Bisa diubah di Profil & legalitas. */
const SEED: Record<string, Partial<Profile>> = {
  frameless: {
    legal_name: "PT Frameless Creative Project", entity: "Perseroan Perorangan",
    address: "Jl. Lurah Sudarto Perum Griya Nirwana Blok L-9, Jlamprang, Kec. Wonosobo, Kab. Wonosobo, Jawa Tengah 56319",
    phone: "0859106723181", email: "frameless.creativeproject@gmail.com",
    nib: "0203230092457", nib_date: "2023-03-02", kbli: "74141 · Aktivitas Desain Khusus Film, Video, Program TV, Animasi dan Komik",
    scale: "PMDN · Usaha Mikro · tingkat risiko rendah", ahu: "AHU-017575.AH.01.30.Tahun 2023", ahu_date: "2023-03-02",
  },
};

export async function getProfiles(slugs: string[]): Promise<Record<string, Profile>> {
  const r = await one<{ value: Record<string, Partial<Profile>> }>("select value from settings where key = 'profiles'");
  const saved = r?.value ?? {};
  return Object.fromEntries(slugs.map((s) => [s, { ...blank(), ...(SEED[s] ?? {}), ...(saved[s] ?? {}) }]));
}
export const idDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const M = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${Number(d.slice(8))} ${M[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
};
/** Butir legalitas yang sudah terisi, siap ditampilkan. */
export function legalLines(p: Profile): [string, string][] {
  const L: [string, string][] = [];
  if (p.legal_name) L.push(["Badan usaha", `${p.legal_name}${p.entity ? ` (${p.entity})` : ""}`]);
  if (p.ahu) L.push(["Pengesahan Kemenkumham", `${p.ahu}${p.ahu_date ? `, ${idDate(p.ahu_date)}` : ""}`]);
  if (p.nib) L.push(["NIB (OSS)", `${p.nib}${p.nib_date ? `, terbit ${idDate(p.nib_date)}` : ""}`]);
  if (p.kbli) L.push(["Bidang usaha (KBLI)", p.kbli]);
  if (p.scale) L.push(["Status & skala", p.scale]);
  if (p.npwp) L.push(["NPWP", p.npwp]);
  if (p.address) L.push(["Alamat", p.address]);
  return L;
}
