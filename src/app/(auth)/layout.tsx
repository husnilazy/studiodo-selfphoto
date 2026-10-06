export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-bold tracking-tight">STUDIO<span className="text-accent">DO</span></p>
          <p className="mt-1 text-sm text-muted">Kasir &amp; Manajemen Studio</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
