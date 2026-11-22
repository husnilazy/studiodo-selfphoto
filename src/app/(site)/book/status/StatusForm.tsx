"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { findBooking } from "@/app/actions/public";

export default function StatusForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const r = await findBooking(phone, code);
    if (r.ok) router.push(r.redirect); else { setError(r.error); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-6 text-left sm:p-8">
      <label className="block"><span className="label">Nomor WhatsApp</span>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required />
      </label>
      <label className="block"><span className="label">Kode booking</span>
        <input className="input font-mono uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SD-261116-001" autoComplete="off" required />
        <span className="mt-1 block text-xs text-muted">Ada di halaman konfirmasi atau pesan WhatsApp dari kami.</span>
      </label>
      {error && <p role="alert" className="pop-in rounded-xl bg-badsoft px-3 py-2 text-sm font-semibold text-bad">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-hero btn-glow w-full">{busy && <span className="spinner" />} {busy ? "Memeriksa…" : "Lihat status booking"}</button>
    </form>
  );
}
