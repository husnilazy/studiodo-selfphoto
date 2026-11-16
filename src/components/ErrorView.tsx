"use client";
import { useEffect } from "react";

/** Tampilan ramah saat ada kesalahan di halaman, menggantikan layar putih "Application error". */
export default function ErrorView({ error, retry, home = "/", compact = false }: { error: Error & { digest?: string }; retry: () => void; home?: string; compact?: boolean }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className={`grid place-items-center px-6 text-center ${compact ? "py-16" : "min-h-dvh"}`} role="alert">
      <div className="max-w-sm">
        <p className="mb-3 text-5xl">😵‍💫</p>
        <h1 className="font-serif-ui text-3xl">Ada yang tidak beres</h1>
        <p className="mt-3 text-sm text-muted">Halaman ini gagal dimuat. Data kamu aman. Coba muat ulang; kalau masih terjadi, kembali ke beranda.</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-muted">Kode: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={() => retry()}>Coba lagi</button>
          <a className="btn" href={home}>Ke beranda</a>
        </div>
      </div>
    </div>
  );
}
