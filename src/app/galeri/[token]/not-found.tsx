export default function NotFound() {
  return (
    <main className="gal grid min-h-dvh place-items-center px-6 text-center">
      <div className="aurora" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /></div>
      <div className="relative max-w-sm">
        <p className="mb-3 text-5xl">🔒</p>
        <h1 className="font-serif-ui text-3xl">Galeri tidak ditemukan</h1>
        <p className="mt-3 text-sm text-muted">Link ini mungkin sudah tidak berlaku atau salah ketik. Hubungi studio untuk meminta link galeri yang baru.</p>
      </div>
    </main>
  );
}
