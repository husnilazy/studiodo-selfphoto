export type Role = "owner" | "admin" | "kasir";
type Item = { href: string; label: string; icon: string; roles: Role[] };

export const NAV: Item[] = [
  { href: "/dashboard", label: "Beranda", icon: "home", roles: ["owner", "admin", "kasir"] },
  { href: "/live", label: "Sesi Live", icon: "clock", roles: ["owner", "admin", "kasir"] },
  { href: "/booking", label: "Booking", icon: "calendar", roles: ["owner", "admin", "kasir"] },
  { href: "/customer", label: "Customer", icon: "users", roles: ["owner", "admin", "kasir"] },
  { href: "/file", label: "File Customer", icon: "folder", roles: ["owner", "admin", "kasir"] },
  { href: "/website", label: "Website", icon: "layout", roles: ["owner", "admin"] },
  { href: "/paket", label: "Paket & Ruang", icon: "box", roles: ["owner", "admin"] },
  { href: "/promo", label: "Promo & Voucher", icon: "tag", roles: ["owner", "admin"] },
  { href: "/member", label: "Member", icon: "star", roles: ["owner", "admin"] },
  { href: "/keuangan", label: "Keuangan", icon: "wallet", roles: ["owner"] },
  { href: "/keuangan/pengeluaran", label: "Pengeluaran", icon: "wallet", roles: ["admin"] },
  { href: "/pengaturan", label: "Pengaturan", icon: "sliders", roles: ["owner"] },
];
