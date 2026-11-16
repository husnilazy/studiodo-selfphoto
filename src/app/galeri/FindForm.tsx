"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { findGallery } from "@/app/actions/galleryAccess";

export default function FindForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { try { const p = localStorage.getItem("sd_member_phone"); if (p) setPhone(p); } catch { /* abaikan */ } }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const r = await findGallery(phone, code);
    if (r.ok) { try { localStorage.setItem("sd_member_phone", phone); } catch { /* abaikan */ } router.push(`/galeri/${r.token}`); } else { setError(r.error); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6 text-left sm:p-7">
      <label className="block"><span className="label">Nomor WhatsApp</span>
        <input className="input" name="username" type="tel" inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required />
      </label>
      <label className="block"><span className="label">Kode booking</span>
        <input className="input font-mono uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SD-261116-001" autoComplete="off" required />
        <span className="mt-1 block text-xs text-muted">Ada di struk atau pesan konfirmasi booking.</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-badsoft px-3 py-2 text-sm font-semibold text-bad" style={{ animation: "pop .3s cubic-bezier(.2,.8,.2,1) both" }}>{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-block">{busy && <span className="spinner" />} {busy ? "Memeriksa…" : "Buka galeri"}</button>
    </form>
  );
}
