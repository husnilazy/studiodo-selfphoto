"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { memberLogin, memberLogout } from "@/app/actions/memberArea";

export function LoginForm({ code: initialCode }: { code: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);

  // Ingat nomor di perangkat ini (kode member tetap dikelola pengelola sandi peramban)
  useEffect(() => { try { const p = localStorage.getItem("sd_member_phone"); if (p) setPhone(p); } catch { /* abaikan */ } }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const r = await memberLogin(phone, code);
    if (r.ok) {
      try { if (remember) localStorage.setItem("sd_member_phone", phone); else localStorage.removeItem("sd_member_phone"); } catch { /* abaikan */ }
      try { // tawarkan menyimpan kredensial di peramban yang mendukung (Chrome/Edge/Android)
        const PC = (window as unknown as { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential }).PasswordCredential;
        if (remember && PC && navigator.credentials) await navigator.credentials.store(new PC({ id: phone, password: code, name: "Member STUDIODO" }));
      } catch { /* abaikan */ }
      router.refresh();
    } else { setError(r.error); setBusy(false); }
  }

  return (
    <form onSubmit={submit} method="post" className="glass mx-auto w-full max-w-md space-y-4 rounded-3xl p-6 text-left sm:p-8">
      <label className="block"><span className="label">Nomor WhatsApp</span>
        <input className="input" name="username" type="tel" inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" required />
      </label>
      <label className="block"><span className="label">Kode member</span>
        <span className="relative block">
          <input className="input !pr-16 font-mono uppercase tracking-widest" name="password" type={show ? "text" : "password"} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SD-0001" autoComplete="current-password" autoCapitalize="characters" required />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-fg" aria-pressed={show}>{show ? "Sembunyi" : "Lihat"}</button>
        </span>
        <span className="mt-1 block text-xs text-muted">Kode ada di kartu member kamu (di bawah nama).</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Ingat saya di perangkat ini
      </label>
      {error && <p role="alert" className="pop-in rounded-xl bg-badsoft px-3 py-2 text-sm font-semibold text-bad">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-glow btn-block !rounded-full">{busy && <span className="spinner" />} {busy ? "Memeriksa…" : "Masuk"}</button>
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
