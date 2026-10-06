import Link from "next/link";
import Icon from "../Icon";

export type LegalSection = { title: string; body: React.ReactNode };

/** Tata letak halaman hukum (Kebijakan Privasi / Syarat Layanan). */
export default function Legal({ title, intro, updated, sections, other }: {
  title: string; intro: string; updated: string; sections: LegalSection[]; other: { href: string; label: string };
}) {
  return (
    <main className="px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg"><Icon name="left" className="size-4" /> Beranda</Link>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm font-semibold text-muted">Terakhir diperbarui: {updated}</p>
        <p className="mt-6 text-lg leading-relaxed text-muted">{intro}</p>

        <nav aria-label="Daftar isi" className="glass mt-8 rounded-3xl p-5 sm:p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-muted">Isi</p>
          <ol className="grid gap-1.5 text-sm font-semibold sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.title}><a href={`#b${i + 1}`} className="text-muted transition-colors hover:text-accent">{i + 1}. {s.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.title} id={`b${i + 1}`} className="scroll-mt-28">
              <h2 className="font-display text-2xl font-semibold tracking-tight"><span className="mr-2 text-accent">{i + 1}.</span>{s.title}</h2>
              <div className="mt-3 space-y-3 leading-relaxed [&_a]:font-semibold [&_a]:text-accent [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
          <Link href={other.href} className="font-semibold text-accent hover:underline">{other.label} →</Link>
          <Link href="/" className="font-semibold text-muted hover:text-fg">Kembali ke beranda</Link>
        </div>
      </div>
    </main>
  );
}

export const LEGAL_UPDATED = "7 Oktober 2026";
