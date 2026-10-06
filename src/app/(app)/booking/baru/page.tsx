import { PageHeader } from "@/components/ui";
import BookingForm from "@/components/BookingForm";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { activeAddons, activePackages, activeRooms, getStudio } from "@/lib/data";
import { addMin, timeWIB, todayWIB } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Transaksi Baru" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ mode?: string; customer?: string; date?: string; room?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const walkin = sp.mode !== "booking";
  const [packages, rooms, addons, studio] = await Promise.all([activePackages(), activeRooms(), activeAddons(), getStudio()]);
  const cid = Number(sp.customer) || 0;
  const customer = cid ? (await q<{ id: number; name: string; phone: string }>("select id, name, phone from customers where id = $1", [cid]))[0] ?? null : null;

  // Jam sekarang dibulatkan ke slot terdekat sebelumnya, di dalam jam buka.
  const now = timeWIB(new Date());
  const [h, m] = now.split(":").map(Number);
  const floored = h * 60 + m - ((h * 60 + m) % studio.slot);
  const nowSlot = addMin("00:00", floored);

  return (
    <>
      <PageHeader back="/booking" title={walkin ? "Transaksi Walk-in" : "Booking Baru"}
        subtitle={walkin ? "Customer datang langsung — catat & bayar sekarang." : "Jadwalkan sesi untuk customer, boleh dengan DP."}
        actions={
          <Link href={walkin ? "/booking/baru?mode=booking" : "/booking/baru"} className="btn btn-sm">
            {walkin ? "Ganti ke Booking" : "Ganti ke Walk-in"}
          </Link>
        } />
      <BookingForm key={walkin ? "w" : "b"} mode={walkin ? "walkin" : "new"} packages={packages} rooms={rooms} addons={addons}
        studio={{ open: studio.open, close: studio.close, slot: studio.slot }} today={sp.date ?? todayWIB()} nowTime={nowSlot} initialCustomer={customer} />
    </>
  );
}
