import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import InstallPrompt from "./InstallPrompt";
import { PrivacyButtons, PrivacyEngine } from "./Privacy";
import { ROLE_LABEL, type Role } from "@/lib/auth";

/** Kerangka ringkas untuk investor & karyawan (dan pratinjau owner). */
export default function MeShell({ user, children }: { user: { name: string; role: Role }; children: ReactNode }) {
  const team = user.role === "owner" || user.role === "partner";
  return (
    <div className="min-h-dvh" id="fh-shell">
      <PrivacyEngine />
      <header className="no-print sticky top-0 z-40 border-b border-line backdrop-blur-xl" style={{ background: "var(--nav-bg)", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link href="/saya" aria-label="Beranda"><Logo height={14} /></Link>
          <nav className="flex items-center gap-3 text-sm">
            {team && <Link href="/" className="text-muted hover:text-fg">← Hub</Link>}
            <PrivacyButtons />
            <ThemeToggle />
            <form action="/api/logout" method="post">
              <button className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm" title="Keluar">
                <span className="grid size-7 place-items-center rounded-full bg-fg text-xs font-semibold text-bg">{user.name.trim().charAt(0).toUpperCase() || "?"}</span>
                <span className="max-w-24 truncate">{user.name}</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 md:px-8">{children}</main>
      <footer className="no-print mx-auto flex max-w-4xl items-center justify-between px-4 pb-10 text-xs text-muted md:px-8">
        <Logo height={10} className="opacity-60" /><span>{ROLE_LABEL[user.role]}</span>
      </footer>
      <InstallPrompt />
    </div>
  );
}
