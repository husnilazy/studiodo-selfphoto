import Link from "next/link";
import Icon from "@/components/Icon";
import StatusForm from "./StatusForm";

export const metadata = { title: "Cek Status Booking", robots: { index: false, follow: true } };

export default function BookingStatusPage() {
  return (
    <main className="px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-md">
        <Link href="/book" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg"><Icon name="left" className="size-4" /> Booking</Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Cek status booking</h1>
        <p className="mb-7 mt-2 text-muted">Masukkan nomor WhatsApp dan kode booking untuk melihat jadwal, status, dan info DP.</p>
        <StatusForm />
      </div>
    </main>
  );
}
