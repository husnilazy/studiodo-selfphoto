"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PinPad from "@/components/PinPad";
import { setupOwnerAction } from "@/app/actions/auth";

export default function SetupClient() {
  const [name, setName] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [step, setStep] = useState<"name" | "pin" | "confirm">("name");
  const router = useRouter();

  if (step === "name") {
    return (
      <form className="anim-rise space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setStep("pin"); }}>
        <div>
          <h1 className="font-display text-xl font-semibold">Selamat datang 👋</h1>
          <p className="mt-1 text-sm text-muted">Buat akun Owner pertama. Akun lain (Admin &amp; Kasir) bisa ditambah nanti di Pengaturan.</p>
        </div>
        <label className="block">
          <span className="label">Nama Owner</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Husni" autoFocus />
        </label>
        <button className="btn btn-primary btn-block" disabled={!name.trim()}>Lanjut</button>
      </form>
    );
  }

  return (
    <div className="anim-rise">
      <div className="mb-6 text-center">
        <h1 className="font-display text-xl font-semibold">{step === "pin" ? "Buat PIN" : "Ulangi PIN"}</h1>
        <p className="mt-1 text-sm text-muted">{step === "pin" ? "6 digit angka, mudah diingat tapi tidak mudah ditebak." : "Masukkan PIN yang sama sekali lagi."}</p>
      </div>
      <PinPad
        key={step}
        onComplete={async (pin) => {
          if (step === "pin") { setFirst(pin); setStep("confirm"); return null; }
          if (pin !== first) { setFirst(null); setStep("pin"); return "PIN tidak sama, ulangi dari awal."; }
          const r = await setupOwnerAction(name, pin);
          if (r.ok) { router.replace("/dashboard"); router.refresh(); return null; }
          return r.error;
        }}
      />
    </div>
  );
}
