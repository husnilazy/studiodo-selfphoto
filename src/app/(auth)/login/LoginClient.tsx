"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PinPad from "@/components/PinPad";
import { loginAction } from "@/app/actions/auth";
import { ROLE_LABEL } from "@/lib/format";

type U = { id: number; name: string; role: string };

export default function LoginClient({ users }: { users: U[] }) {
  const [sel, setSel] = useState<U | null>(users.length === 1 ? users[0] : null);
  const [kb, setKb] = useState(false); // isian keyboard (pengelola sandi bisa mengisi & menyimpan)
  const [kbPin, setKbPin] = useState("");
  const [kbErr, setKbErr] = useState("");
  const [kbBusy, setKbBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const router = useRouter();

  // Ingat akun terakhir di perangkat ini: langsung ke layar PIN
  useEffect(() => {
    try { const id = Number(localStorage.getItem("sd_last_user")); const u = users.find((x) => x.id === id); if (u) setSel(u); } catch { /* abaikan */ }
  }, [users]);

  async function done(u: U, pin: string) {
    try { if (remember) localStorage.setItem("sd_last_user", String(u.id)); else localStorage.removeItem("sd_last_user"); } catch { /* abaikan */ }
    try {
      const PC = (window as unknown as { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential }).PasswordCredential;
      if (remember && PC && navigator.credentials) await navigator.credentials.store(new PC({ id: u.name, password: pin, name: "STUDIODO Kasir" }));
    } catch { /* abaikan */ }
    router.replace("/dashboard"); router.refresh();
  }

  if (!sel) {
    return (
      <div className="anim-rise">
        <p className="mb-4 text-center text-sm text-muted">Pilih akun Anda</p>
        <div className="grid grid-cols-2 gap-3">
          {users.map((u) => (
            <button key={u.id} onClick={() => setSel(u)}
              className="card flex flex-col items-center gap-2 p-4 transition active:scale-95 hover:border-accent">
              <span className="font-display grid size-14 place-items-center rounded-full bg-accent text-xl font-semibold text-accentfg">
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-full truncate font-semibold">{u.name}</span>
              <span className="badge badge-indigo">{ROLE_LABEL[u.role]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-rise">
      <div className="mb-6 flex flex-col items-center gap-1">
        <span className="font-display grid size-14 place-items-center rounded-full bg-accent text-xl font-semibold text-accentfg">
          {sel.name.slice(0, 1).toUpperCase()}
        </span>
        <p className="font-semibold">{sel.name}</p>
        <p className="text-sm text-muted">Masukkan PIN 6 digit</p>
      </div>
      {kb ? (
        <form className="mx-auto w-full max-w-xs space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (kbBusy) return;
          setKbBusy(true); setKbErr("");
          const r = await loginAction(sel.id, kbPin);
          if (r.ok) { await done(sel, kbPin); } else { setKbErr(r.error); setKbBusy(false); }
        }}>
          <label className="block"><span className="label">Nama pengguna</span>
            <input className="input" name="username" autoComplete="username" value={sel.name} readOnly /></label>
          <label className="block"><span className="label">PIN</span>
            <input className="input tnum tracking-[.4em]" name="password" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" autoFocus value={kbPin} onChange={(e) => setKbPin(e.target.value.replace(/\D/g, ""))} required /></label>
          <p className="min-h-5 text-center text-sm font-medium text-bad" role="alert">{kbErr}</p>
          <button className="btn btn-primary btn-block" disabled={kbBusy || kbPin.length !== 6}>{kbBusy && <span className="spinner" />} {kbBusy ? "Memeriksa…" : "Masuk"}</button>
        </form>
      ) : (
        <PinPad
          onComplete={async (pin) => {
            const r = await loginAction(sel.id, pin);
            if (r.ok) { await done(sel, pin); return null; }
            return r.error;
          }}
        />
      )}
      <label className="mx-auto mt-5 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--accent)]" /> Ingat akun di perangkat ini
      </label>
      <button onClick={() => { setKb((v) => !v); setKbErr(""); setKbPin(""); }} className="mx-auto mt-3 block text-sm font-semibold text-accent">
        {kb ? "Pakai keypad PIN" : "Isi dengan keyboard / sandi tersimpan"}
      </button>
      {users.length > 1 && (
        <button onClick={() => { setSel(null); setKb(false); try { localStorage.removeItem("sd_last_user"); } catch { /* abaikan */ } }} className="mx-auto mt-4 block text-sm font-semibold text-muted hover:text-fg">
          Ganti akun
        </button>
      )}
    </div>
  );
}
