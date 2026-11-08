import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { fullMonth } from "@/lib/format";
import PitchBody from "@/components/PitchBody";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ringkasan Investor", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stored = (await q<{ value: string }>("select value from settings where key='investor_token'"))[0]?.value;
  const a = Buffer.from(token), b = Buffer.from(stored ?? "");
  if (!stored || a.length !== b.length || !timingSafeEqual(a, b)) notFound();
  const f = await loadFacts();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-full border border-line px-5 py-3" style={{ background: "var(--nav-bg)" }}>
        <Logo height={15} />
        <span className="text-xs text-muted">Ringkasan traksi · {fullMonth(f.now)} · baca-saja</span>
        <ThemeToggle />
      </header>
      <PitchBody f={f} publicView />
      <p className="mt-6 text-xs text-muted">Angka bersumber dari pencatatan internal Frameless dan bersifat informatif, bukan penawaran efek atau nasihat investasi.</p>
    </main>
  );
}
