"use client";
import { useState } from "react";

export default function ShareDigest({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-3">
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-panel2 p-4 text-[13px] leading-relaxed">{text}</pre>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Kirim lewat WhatsApp</a>
        <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}>{ok ? "Tersalin ✓" : "Salin teks"}</button>
      </div>
    </div>
  );
}
