"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import InstallPrompt from "./InstallPrompt";

type Co = { slug: string; name: string };
type Tab = { href: string; label: string };
type Group = { key: string; label: string; href: string; ic: string; tabs: Tab[]; match: (p: string) => boolean };

const fmt = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  const f = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return a >= 1e9 ? `${s}${f(a / 1e9)} M` : a >= 1e6 ? `${s}${f(a / 1e6)} jt` : a >= 1e3 ? `${s}${f(a / 1e3)} rb` : `${s}${Math.round(a)}`;
};

function groups(companies: Co[]): Group[] {
  return [
    { key: "home", label: "Ringkasan", href: "/", ic: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
      match: (p) => p === "/" || p.startsWith("/perusahaan") || p.startsWith("/kondisi"),
      tabs: [{ href: "/", label: "Seluruh grup" }, { href: "/kondisi", label: "Kondisi" }, ...companies.map((c) => ({ href: `/perusahaan/${c.slug}`, label: c.name.replace("STUDIODO ", "SD ") }))] },
    { key: "keu", label: "Keuangan", href: "/transaksi", ic: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
      match: (p) => ["/transaksi", "/modal", "/bagi-hasil", "/gaji", "/rekonsiliasi", "/kewajiban", "/beban-bersama", "/aset", "/kalkulator"].some((x) => p.startsWith(x)),
      tabs: [{ href: "/transaksi", label: "Transaksi" }, { href: "/modal", label: "Modal" }, { href: "/bagi-hasil", label: "Bagi hasil" }, { href: "/gaji", label: "Gaji & tim" }, { href: "/kalkulator", label: "Kalkulator proyek" }, { href: "/rekonsiliasi", label: "Rekonsiliasi" }, { href: "/aset", label: "Aset & inventaris" }, { href: "/kewajiban", label: "Hutang & piutang" }, { href: "/beban-bersama", label: "Beban bersama" }] },
    { key: "plan", label: "Perencanaan", href: "/alokasi", ic: "M3 3v18h18M7 14l4-4 4 3 5-7",
      match: (p) => ["/alokasi", "/target", "/proyeksi", "/rekomendasi"].some((x) => p.startsWith(x)),
      tabs: [{ href: "/alokasi", label: "Alokasi" }, { href: "/target", label: "Target" }, { href: "/proyeksi", label: "Proyeksi" }, { href: "/rekomendasi", label: "Rekomendasi" }] },
    { key: "inv", label: "Investor", href: "/valuasi", ic: "M4 4h16v12H4zM8 20h8M12 16v4",
      match: (p) => ["/pitching", "/ide", "/dokumen", "/valuasi", "/pasar", "/prospektus", "/profil"].some((x) => p.startsWith(x)),
      tabs: [{ href: "/valuasi", label: "Valuasi" }, { href: "/pasar", label: "Proyeksi pasar" }, { href: "/prospektus", label: "Prospektus" }, { href: "/profil", label: "Profil & legalitas" }, { href: "/pitching", label: "Materi pitching" }, { href: "/dokumen", label: "Dokumen" }, { href: "/ide", label: "Ide & rencana" }] },
    { key: "set", label: "Pengaturan", href: "/pengaturan", ic: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0", match: (p) => p.startsWith("/pengaturan"), tabs: [] },
  ];
}

function Ic({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function Shell({ user, companies, cash, children }: { user: { name: string; role: string }; companies: Co[]; cash: number; children: ReactNode }) {
  const path = usePathname();
  const gs = groups(companies);
  const current = gs.find((g) => g.match(path)) ?? gs[0];
  const tabActive = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-dvh">
      {/* Navbar pill (desktop) */}
      <div className="no-print sticky top-0 z-40 hidden px-8 pt-5 md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-2 rounded-full border border-line py-2 pl-5 pr-2 backdrop-blur-xl" style={{ background: "var(--nav-bg)" }}>
          <Link href="/" className="mr-5 flex items-center" aria-label="Frameless Hub"><Logo height={15} /></Link>
          <nav className="flex items-center gap-1">
            {gs.map((g) => (
              <Link key={g.key} href={g.href} className={`rounded-full px-3.5 py-2 text-sm transition ${g === current ? "font-medium text-fg" : "text-muted hover:text-fg"}`}>{g.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-muted lg:inline-flex" title="Total kas seluruh grup">
              <i className="live-dot size-1.5 rounded-full bg-ok" />Kas <b className="tnum font-medium text-fg">Rp {fmt(cash)}</b>
            </span>
            <ThemeToggle />
            <form action="/api/logout" method="post">
              <button className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3.5 text-sm text-fg transition hover:border-[color-mix(in_srgb,var(--fg)_28%,transparent)]" title="Keluar">
                <span className="grid size-7 place-items-center rounded-full bg-fg text-xs font-semibold text-bg">{initial}</span>
                <span className="max-w-24 truncate">{user.name}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Header ringkas (mobile) */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-line px-4 py-3 backdrop-blur-xl md:hidden" style={{ background: "var(--nav-bg)", paddingTop: "max(.75rem, env(safe-area-inset-top))" }}>
        <Link href="/" aria-label="Frameless Hub"><Logo height={13} /></Link>
        <div className="flex items-center gap-2">
          <span className="tnum rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">Rp {fmt(cash)}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-8 md:pb-14 md:pt-6">
        {/* Sub-tab seperti Ethena */}
        {current.tabs.length > 1 && (
          <nav className="no-print -mx-4 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Sub menu">
            {current.tabs.map((t) => (
              <Link key={t.href} href={t.href} className={`relative shrink-0 px-3 py-3 text-sm transition first:pl-0 md:first:pl-1 ${tabActive(t.href) ? "font-medium text-fg" : "text-muted hover:text-fg"}`}>
                {t.label}
                {tabActive(t.href) && <span className="absolute inset-x-3 bottom-0 h-px bg-fg shadow-[0_-2px_10px_1px_color-mix(in_srgb,var(--fg)_45%,transparent)]" />}
              </Link>
            ))}
          </nav>
        )}
        {children}
        <footer className="no-print mt-12 flex items-center justify-between border-t border-line pt-5 text-xs text-muted">
          <Logo height={11} className="opacity-60" /><span>{user.role === "owner" ? "Owner" : "Partner · baca-saja"}</span>
        </footer>
      </main>

      {/* Navigasi bawah (mobile) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line backdrop-blur-xl md:hidden" style={{ background: "var(--nav-bg)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {gs.map((g) => (
          <Link key={g.key} href={g.href} className={`flex flex-col items-center gap-1 py-2.5 text-[10.5px] ${g === current ? "font-medium text-fg" : "text-muted"}`}>
            <Ic d={g.ic} />{g.label}
          </Link>
        ))}
      </nav>
      <InstallPrompt />
    </div>
  );
}
