import Link from "next/link";
import Icon from "@/components/Icon";
import BookingWizard from "@/components/site/BookingWizard";
import { getSiteData } from "@/lib/siteData";
import { expireStalePending } from "@/lib/online";
import { addDays, todayWIB, waLink } from "@/lib/format";

export const metadata = { title: "Booking Online", robots: { index: false, follow: true } };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ paket?: string; room?: string }> }) {
  const sp = await searchParams;
  await expireStalePending();
  const { studio, online, packages, rooms, addons } = await getSiteData();
  const today = todayWIB();

  if (!online.enabled || packages.length === 0) {
    return (
      <main className="grid min-h-dvh place-items-center px-4 pt-20">
        <div className="glass max-w-md rounded-3xl p-10 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name="clock" className="size-7" /></span>
          <h1 className="font-display text-2xl font-semibold">Booking online belum dibuka</h1>
          <p className="mt-2 text-muted">Silakan hubungi kami langsung untuk memesan jadwal.</p>
          <div className="mt-6 flex flex-col gap-2">
            {online.whatsapp && <a className="btn btn-primary" href={waLink(online.whatsapp, "Halo, saya ingin booking jadwal.")}>Chat WhatsApp</a>}
            <Link className="btn" href="/">Kembali ke beranda</Link>
          </div>
        </div>
      </main>
    );
  }

  const pre = Number(sp.paket);
  return (
    <main className="px-4 pb-32 pt-24 sm:px-6 sm:pt-28">
      <BookingWizard
        packages={packages} rooms={rooms} addons={addons}
        studioName={studio.name}
        dpPercent={online.dp_percent} today={today} maxDate={addDays(today, online.days_ahead)}
        initialPackage={packages.some((p) => p.id === pre) ? pre : null}
        initialRoom={rooms.some((r) => r.id === Number(sp.room)) ? Number(sp.room) : null}
      />
    </main>
  );
}
