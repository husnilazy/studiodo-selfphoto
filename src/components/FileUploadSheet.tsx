"use client";
import { useEffect, useState } from "react";
import CustomerPicker from "./CustomerPicker";
import DriveUploader from "./DriveUploader";

type C = { id: number; name: string; phone: string };
type B = { id: number; label: string };

/** Upload dari halaman File: pilih customer → (opsional) sesi → seret file. Folder & link dibuat otomatis. */
export default function FileUploadSheet({ connected }: { connected: boolean }) {
  const [c, setC] = useState<C | null>(null);
  const [bookings, setBookings] = useState<B[] | null>(null);

  useEffect(() => {
    if (!c) { setBookings(null); return; }
    let live = true;
    setBookings(null);
    fetch(`/api/customers/${c.id}/bookings`).then((r) => (r.ok ? r.json() : [])).then((j: B[]) => live && setBookings(j)).catch(() => live && setBookings([]));
    return () => { live = false; };
  }, [c]);

  return (
    <div className="space-y-4">
      <div className={c ? "" : "min-h-72"}>
        <label className="block"><span className="label">1 · Pilih customer</span><CustomerPicker allowNew={false} onSelect={setC} /></label>
        {!c && <p className="mt-3 text-sm text-muted">Pilih customer dulu. Folder “STUDIODO Kasir / nama customer / sesi” akan dibuat otomatis di Google Drive.</p>}
      </div>
      {c && bookings === null && <p className="flex items-center gap-2 text-sm text-muted"><span className="spinner" /> Memuat sesi {c.name}…</p>}
      {c && bookings !== null && (
        <div className="anim-rise">
          <span className="label">2 · Unggah file</span>
          <DriveUploader key={c.id} customerId={c.id} customerName={c.name} customerPhone={c.phone} connected={connected} bookings={bookings} />
        </div>
      )}
    </div>
  );
}
