"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

/** Keypad PIN 6 digit. `onComplete` dipanggil saat digit ke-6 dimasukkan; kembalikan pesan error untuk mengguncang & mengosongkan. */
export default function PinPad({
  onComplete, disabled,
}: { onComplete: (pin: string) => Promise<string | null>; disabled?: boolean }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const pinRef = useRef("");

  const push = (d: string) => {
    if (busy || disabled || pinRef.current.length >= 6) return;
    setErr(null);
    pinRef.current += d;
    setPin(pinRef.current);
    if (pinRef.current.length === 6) void submit(pinRef.current);
  };
  const del = () => { if (busy) return; pinRef.current = pinRef.current.slice(0, -1); setPin(pinRef.current); };

  async function submit(p: string) {
    setBusy(true);
    let e: string | null;
    try { e = await onComplete(p); } catch { e = "Terjadi gangguan pada server. Coba lagi sebentar."; }
    setBusy(false);
    if (e) {
      setErr(e); setShake(true);
      setTimeout(() => setShake(false), 450);
      pinRef.current = ""; setPin("");
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) push(e.key);
      else if (e.key === "Backspace") del();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto w-full max-w-xs select-none">
      <div className={`mb-2 flex justify-center gap-3 ${shake ? "animate-[wiggle_.4s]" : ""}`} style={shake ? { animation: "wiggle .4s" } : undefined}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`size-3.5 rounded-full border-2 transition-all duration-150 ${i < pin.length ? "scale-110 border-accent bg-accent" : "border-line"}`} />
        ))}
      </div>
      <p className="mb-4 h-5 text-center text-sm font-medium text-bad" role="alert">{err}</p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => push(d)}>{d}</Key>
        ))}
        <span />
        <Key onClick={() => push("0")}>0</Key>
        <Key onClick={del} label="Hapus"><Icon name="back" className="mx-auto size-6" /></Key>
      </div>
      {busy && <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted"><span className="spinner" /> Memeriksa…</p>}
      <style>{`@keyframes wiggle{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

function Key({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="font-display grid h-16 place-items-center rounded-2xl border border-line bg-panel text-2xl font-semibold shadow-sm transition active:scale-90 active:bg-accentsoft">
      {children}
    </button>
  );
}
