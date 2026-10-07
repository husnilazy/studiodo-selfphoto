import BrandMark from "@/components/site/BrandMark";
import { getStudio } from "@/lib/data";
import { getSiteConfig } from "@/lib/siteServer";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [studio, site] = await Promise.all([getStudio(), getSiteConfig()]).catch(() => [null, null] as const);
  const b = site?.brand;
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="orb pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="anim-rise mb-8 flex flex-col items-center text-center">
          {b && studio ? (
            <BrandMark name={studio.name} logo={b.logo_url} logoDark={b.logo_dark_url} height={Math.max(b.logo_height, 40)} text={b.text} textSize={b.text_size} textFont={b.text_font} className="text-3xl" />
          ) : (
            <p className="font-display text-3xl font-bold tracking-tight">STUDIO<span className="text-accent">DO</span></p>
          )}
          <p className="mt-2 text-sm text-muted">Kasir &amp; Manajemen Studio</p>
        </div>
        <div className="card anim-rise p-6" style={{ ["--i" as string]: 2 }}>{children}</div>
      </div>
    </main>
  );
}
