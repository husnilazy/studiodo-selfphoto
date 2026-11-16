export default function Loading() {
  return (
    <main className="gal relative min-h-dvh" aria-busy="true" aria-label="Memuat galeri">
      <div className="aurora" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /></div>
      <div className="relative mx-auto max-w-6xl px-4 pt-14 text-center sm:px-6">
        <div className="skeleton mx-auto mb-5 h-4 w-28" />
        <div className="skeleton mx-auto mb-4 h-12 w-72 max-w-full" />
        <div className="mx-auto mt-8 flex max-w-md gap-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 flex-1 !rounded-2xl" />)}</div>
        <div className="mt-10 columns-2 gap-3 md:columns-3 xl:columns-4">
          {[220, 300, 260, 340, 240, 300, 280, 220].map((h, i) => <div key={i} className="skeleton mb-3 !rounded-2xl" style={{ height: h }} />)}
        </div>
      </div>
    </main>
  );
}
