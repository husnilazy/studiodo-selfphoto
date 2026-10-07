// Template dibuat ulang tiap pindah halaman → memicu animasi masuk halus.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
