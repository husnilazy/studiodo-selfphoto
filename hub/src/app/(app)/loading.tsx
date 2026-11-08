/** Kerangka instan saat berpindah halaman: tidak ada layar kosong selama data dimuat. */
export default function Loading() {
  const bar = "animate-pulse rounded-xl bg-[var(--line)]";
  return (
    <div aria-busy="true" aria-label="Memuat">
      <div className={`${bar} mb-3 h-7 w-56`} />
      <div className={`${bar} mb-6 h-4 w-80 max-w-full`} />
      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="px-5 py-4"><div className={`${bar} h-3 w-24`} /><div className={`${bar} mt-3 h-7 w-32`} /></div>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="card card-pad"><div className={`${bar} h-4 w-40`} /><div className={`${bar} mt-4 h-48 w-full`} /></div>)}
      </div>
    </div>
  );
}
