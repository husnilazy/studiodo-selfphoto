"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/keuangan", label: "Ringkasan", match: (p: string) => p === "/keuangan", roles: ["owner"] },
  { href: "/keuangan/pengeluaran", label: "Pengeluaran", match: (p: string) => p.startsWith("/keuangan/pengeluaran"), roles: ["owner", "admin"] },
  { href: "/keuangan/laporan", label: "Laporan", match: (p: string) => p.startsWith("/keuangan/laporan"), roles: ["owner"] },
  { href: "/keuangan/jurnal", label: "Jurnal", match: (p: string) => p.startsWith("/keuangan/jurnal"), roles: ["owner"] },
  { href: "/keuangan/aset", label: "Aset Tetap", match: (p: string) => p.startsWith("/keuangan/aset"), roles: ["owner"] },
  { href: "/keuangan/akun", label: "Bagan Akun", match: (p: string) => p.startsWith("/keuangan/akun"), roles: ["owner"] },
];

export default function FinanceTabs({ role }: { role: string }) {
  const path = usePathname();
  return (
    <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-2xl border border-line bg-panel p-1">
        {TABS.filter((t) => t.roles.includes(role)).map((t) => (
          <Link key={t.href} href={t.href}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${t.match(path) ? "bg-accent text-accentfg shadow" : "text-muted hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
