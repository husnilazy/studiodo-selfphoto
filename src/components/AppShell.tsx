"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "./Icon";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/format";
import { NAV, type Role } from "@/lib/nav";


const active = (path: string, href: string) => (path === href || path.startsWith(href + "/"));

export default function AppShell({ user, children }: { user: { name: string; role: Role }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const toggleTheme = () => {
    const el = document.documentElement;
    const dark = el.dataset.theme ? el.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    el.dataset.theme = next;
    try { localStorage.setItem("sd_theme", next); } catch {}
  };
  const logout = async () => { await logoutAction(); router.replace("/login"); router.refresh(); };

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-panel p-4 lg:flex">
        <Link href="/dashboard" className="font-display mb-6 px-2 pt-1 text-2xl font-bold tracking-tight">STUDIO<span className="text-accent">DO</span></Link>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active(path, n.href) ? "bg-accent text-accentfg shadow" : "text-muted hover:bg-panel2 hover:text-fg"}`}>
              <Icon name={n.icon} className="size-[18px]" /> {n.label}
            </Link>
          ))}
          <Link href="/booking/baru" className="btn btn-primary mt-3"><Icon name="plus" className="size-4" /> Transaksi Baru</Link>
        </nav>
        <div className="rounded-2xl bg-panel2 p-3">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={toggleTheme} className="btn btn-sm flex-1" aria-label="Ganti tema"><Icon name="moon" className="size-4" /></button>
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
            <span className="grid size-14 place-items-center rounded-full bg-accent text-accentfg shadow-lg shadow-accent/40 transition active:scale-90">
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
    <Link href={href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${on ? "text-accent" : "text-muted"}`}>
      <Icon name={icon} className="size-[22px]" /> {label}
    </Link>
  );
}
