"use client";

export default function PrintButton({ label = "Cetak / Simpan PDF" }: { label?: string }) {
  return <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>{label}</button>;
}
