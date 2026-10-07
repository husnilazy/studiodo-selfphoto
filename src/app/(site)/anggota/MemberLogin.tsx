"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { memberLogin, memberLogout } from "@/app/actions/memberArea";

export function LoginForm({ code: initialCode }: { code: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const r = await memberLogin(phone, code);
    if (r.ok) router.refresh(); else { setError(r.error); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="glass mx-auto w-full max-w-md space-y-4 rounded-3xl p-6 text-left sm:p-8">
      <label className="block"><span className="label">Nomor WhatsApp</span>
        <input className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required />
      </label>
      <label className="block"><span className="label">Kode member</span>
        <input className="input font-mono uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SD-0001" autoComplete="off" required />
        <span className="mt-1 block text-xs text-muted">Kode ada di kartu member kamu (di bawah nama).</span>
      </label>
      {error && <p role="alert" className="pop-in rounded-xl bg-badsoft px-3 py-2 text-sm font-semibold text-bad">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-glow btn-block !rounded-full">{busy && <span className="spinner" />} Masuk</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button className="btn btn-sm !rounded-full" onClick={async () => { await memberLogout(); router.refresh(); }}>
      <Icon name="logout" className="size-4" /> Keluar
    </button>
  );
}
