"use client";
import { useActionState, useState } from "react";
import { generateApiKey, importCsv, loginAction, pullNow, runAI, setupAction, type FormState } from "@/app/actions";

const Msg = ({ s }: { s: FormState }) =>
  s?.error ? <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">{s.error}</p> : s?.ok ? <p className="rounded-lg bg-ok/15 px-3 py-2 text-sm text-ok">{s.ok}</p> : null;

export function LoginForm() {
  const [st, act, pending] = useActionState(loginAction, null);
  return (
    <form action={act} className="space-y-4">
      <label className="block"><span className="label">Nama pengguna</span>
        <input name="name" className="input" autoComplete="username" required autoFocus placeholder="Nama yang didaftarkan Owner" /></label>
      <label className="block"><span className="label">PIN 6 digit</span>
        <input name="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" className="input tnum tracking-[.5em]" required /></label>
      <Msg s={st} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Memeriksa…" : "Masuk"}</button>
    </form>
  );
}

export function SetupForm() {
  const [st, act, pending] = useActionState(setupAction, null);
  return (
    <form action={act} className="space-y-4">
      <label className="block"><span className="label">Nama Owner</span><input name="name" className="input" required placeholder="Nama kamu" /></label>
      <label className="block"><span className="label">PIN 6 digit</span><input name="pin" type="password" inputMode="numeric" maxLength={6} className="input tnum" required /></label>
      <label className="block"><span className="label">Ulangi PIN</span><input name="pin2" type="password" inputMode="numeric" maxLength={6} className="input tnum" required /></label>
      <Msg s={st} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Menyiapkan…" : "Buat Hub saya"}</button>
    </form>
  );
}

export function ImportForm() {
  const [st, act, pending] = useActionState(importCsv, null);
  return (
    <form action={act} className="space-y-3">
      <textarea name="csv" className="input font-mono text-xs" rows={6} placeholder={"tanggal,perusahaan,jenis,kategori,nominal,catatan\n2026-11-01,studiodo,revenue,penjualan,1500000,Omzet hari ini\n2026-11-02,snapcup,expense,bahan,350000,Beli susu"} required />
      <Msg s={st} />
      <button className="btn" disabled={pending}>{pending ? "Mengimpor…" : "Impor CSV"}</button>
    </form>
  );
}

export function ApiKeyButton({ id, has }: { id: number; has: boolean }) {
  const [st, act, pending] = useActionState(generateApiKey, null);
  const [copied, setCopied] = useState(false);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {st?.ok && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs">
          <div className="mb-1 font-semibold text-warn">Salin sekarang — hanya tampil sekali:</div>
          <code className="break-all">{st.ok}</code>
          <button type="button" className="btn mt-2 !min-h-8 w-full" onClick={() => { navigator.clipboard?.writeText(st.ok!); setCopied(true); }}>{copied ? "Tersalin ✓" : "Salin API key"}</button>
        </div>
      )}
      <button className="btn !min-h-9 text-xs" disabled={pending} onClick={(e) => { if (has && !confirm("Membuat key baru akan mematikan key lama. Lanjut?")) e.preventDefault(); }}>
        {has ? "Ganti API key" : "Buat API key"}
      </button>
    </form>
  );
}

export function PullButton({ slug }: { slug: string }) {
  const [st, act, pending] = useActionState(pullNow, null);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <button className="btn !min-h-9 text-xs" disabled={pending}>{pending ? "Menarik data…" : "Tarik sekarang"}</button>
      {st?.ok && <p className="text-xs text-ok">{st.ok}</p>}
      {st?.error && <p className="text-xs text-bad">{st.error}</p>}
    </form>
  );
}

export function AIPanel() {
  const [st, act, pending] = useActionState(async () => runAI(), null);
  return (
    <form action={act} className="space-y-3">
      <button className="btn btn-primary" disabled={pending}>{pending ? "AI sedang menganalisis…" : "✦ Minta analisis AI (Claude)"}</button>
      {st?.error && <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{st.error}</p>}
      {st?.ok && <div className="card card-pad whitespace-pre-wrap text-sm leading-relaxed">{st.ok}</div>}
    </form>
  );
}
