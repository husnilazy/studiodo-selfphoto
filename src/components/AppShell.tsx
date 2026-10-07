"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import Icon from "./Icon";
import NavProgress from "./NavProgress";
import Toaster from "./Toaster";
import BrandMark from "./site/BrandMark";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/format";
import { NAV, type Role } from "@/lib/nav";
import type { FontKey } from "@/lib/siteConfig";

export type ShellBrand = { name: string; logo: string; logoDark: string; height: number; text: string; textSize: number; textFont: FontKey };

const active = (path: string, href: string) => (path === href || path.startsWith(href + "/"));

export default function AppShell({ user, brand, children }: { user: { name: string; role: Role }; brand: ShellBrand; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  // Dua item bisa saling berawalan (/keuangan & /keuangan/pengeluaran): pilih yang paling spesifik.
  const current = items.filter((n) => active(path, n.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ y: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    setPill(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, [current, items.length]);

  const toggleTheme = () => {
    const el = document.documentElement;
    const dark = el.dataset.theme ? el.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    el.classList.add("theming");
    el.dataset.theme = next;
    setTimeout(() => el.classList.remove("theming"), 450);
    try { localStorage.setItem("sd_theme", next); } catch {}
  };
  const logout = async () => { await logoutAction(); router.replace("/login"); router.refresh(); };

  return (
    <div className="min-h-dvh lg:pl-64">
      <NavProgress />
      <Toaster />
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-panel p-4 lg:flex">
        <Link href="/dashboard" aria-label="Beranda" className="mb-6 flex min-h-10 items-center px-2 pt-1 transition-transform duration-300 hover:scale-[1.03]">
          <BrandMark name={brand.name} logo={brand.logo} logoDark={brand.logoDark} height={Math.min(brand.height, 38)} text={brand.text} textSize={Math.min(brand.textSize, 18)} textFont={brand.textFont} />
        </Link>
        <nav ref={navRef} className="relative flex flex-1 flex-col gap-1">
          {pill && (
            <span aria-hidden className="nav-pill pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-accent shadow-lg shadow-accent/30"
              style={{ height: pill.h, transform: `translateY(${pill.y}px)` }} />
          )}
          {items.map((n) => {
            const on = n.href === current;
            return (
              <Link key={n.href} href={n.href} data-active={on}
                className={`nav-link group relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${on ? `text-accentfg ${pill ? "" : "bg-accent shadow"}` : "text-muted hover:bg-panel2 hover:text-fg"}`}>
                <Icon name={n.icon} className="size-[18px] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" /> {n.label}
              </Link>
            );
          })}
          <Link href="/booking/baru" className="btn btn-primary btn-shine mt-3"><Icon name="plus" className="size-4" /> Transaksi Baru</Link>
        </nav>
        <div className="rounded-2xl bg-panel2 p-3">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={toggleTheme} className="btn btn-sm group flex-1" aria-label="Ganti tema"><Icon name="moon" className="size-4 transition-transform duration-500 group-hover:rotate-[24deg] group-active:rotate-[200deg]" /></button>
            <button onClick={logout} className="btn btn-sm flex-[2]"><Icon name="logout" className="size-4" /> Keluar</button>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>

      {/* Tab bar mobile */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          <Tab href="/dashboard" icon="home" label="Beranda" on={active(path, "/dashboard")} />
          <Tab href="/booking" icon="calendar" label="Booking" on={active(path, "/booking") && path !== "/booking/baru"} />
          <Link href="/booking/baru" aria-label="Transaksi baru" className="-mt-5 grid place-items-center justify-self-center">
            <span className="grid size-14 place-items-center rounded-full bg-accent text-accentfg shadow-lg shadow-accent/40 transition duration-200 active:scale-90 active:rotate-90">
              <Icon name="plus" className="size-7" />
            </span>
          </Link>
          <Tab href="/customer" icon="users" label="Customer" on={active(path, "/customer")} />
          <Tab href="/menu" icon="menu" label="Menu" on={active(path, "/menu")} />
        </div>
      </nav>
    </div>
  );
}

function Tab({ href, icon, label, on }: { href: string; icon: string; label: string; on: boolean }) {
  return (
    <Link href={href} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${on ? "text-accent" : "text-muted"}`}>
      <span className={`absolute top-0 h-[3px] rounded-b-full bg-accent transition-all duration-300 ${on ? "w-8 opacity-100" : "w-0 opacity-0"}`} />
      <Icon name={icon} className={`size-[22px] transition-transform duration-300 ${on ? "-translate-y-0.5 scale-110" : ""}`} /> {label}
    </Link>
  );
}
