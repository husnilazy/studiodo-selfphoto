// Ditampilkan seketika saat pindah halaman, selagi data halaman berikutnya dimuat di server.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat">
      <div className="skeleton mb-2 h-4 w-28" />
      <div className="skeleton mb-6 h-9 w-64 max-w-full" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 !rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="skeleton h-72 !rounded-2xl" />
        <div className="space-y-3">
          <div className="skeleton h-24 !rounded-2xl" />
          <div className="skeleton h-24 !rounded-2xl" />
          <div className="skeleton h-24 !rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
