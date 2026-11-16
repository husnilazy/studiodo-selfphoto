import type { Metadata } from "next";
import Link from "next/link";
import FindForm from "./FindForm";

export const metadata: Metadata = { title: "Cari Galeri", robots: { index: false, follow: false } };

export default function FindGalleryPage() {
  return (
    <main className="gal relative grid min-h-dvh place-items-center px-4 py-12">
      <div className="aurora" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /></div>
      <div className="relative w-full max-w-md text-center">
        <p className="mb-4 text-sm font-semibold tracking-[.2em] text-muted">STUDIODO</p>
        <h1 className="font-serif-ui text-4xl sm:text-5xl">Galeri <span className="text-accent">fotomu</span></h1>
        <p className="mb-7 mt-3 text-muted">Masukkan nomor WhatsApp dan kode booking untuk membuka foto &amp; videomu.</p>
        <FindForm />
        <p className="mt-6 text-sm text-muted">Member? <Link href="/anggota" className="font-semibold text-accent">Masuk ke Area Member</Link> — galerimu ada di sana juga.</p>
      </div>
    </main>
  );
}
