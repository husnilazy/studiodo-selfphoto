// Isi halaman khusus member (info menarik yang diatur admin). Murni, aman untuk server & client.
export type MemberPost = { title: string; body: string; link: string; link_label: string; until: string }; // until: 'YYYY-MM-DD' atau ''
export type MemberPage = { intro: string; perks: string[]; posts: MemberPost[] };

export const DEFAULT_PAGE: MemberPage = {
  intro: "Selamat datang di area member! Kumpulkan stempel tiap sesi dan dapatkan hadiah.",
  perks: ["Diskon member otomatis di setiap sesi", "Hadiah di kunjungan tertentu", "Info promo & voucher eksklusif"],
  posts: [],
};

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const link = (v: unknown) => { const x = s(v, 300); return x === "" || /^https?:\/\//i.test(x) || /^\/(?!\/)/.test(x) ? x : ""; };

export function sanitizePage(raw: unknown): MemberPage {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MemberPage>;
  const posts = Array.isArray(r.posts)
    ? r.posts.slice(0, 10).map((p) => ({ title: s(p?.title, 80), body: s(p?.body, 500), link: link(p?.link), link_label: s(p?.link_label, 30), until: /^\d{4}-\d{2}-\d{2}$/.test(String(p?.until ?? "")) ? String(p?.until) : "" })).filter((p) => p.title)
    : [];
  return {
    intro: s(r.intro, 300) || DEFAULT_PAGE.intro,
    perks: Array.isArray(r.perks) ? r.perks.map((x) => s(x, 100)).filter(Boolean).slice(0, 8) : DEFAULT_PAGE.perks,
    posts,
  };
}
