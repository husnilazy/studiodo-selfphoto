"use client";
import { useEffect, useState } from "react";

export default function CopyField({ path, base }: { path: string; base: string }) {
  const [origin, setOrigin] = useState(base);
  const [ok, setOk] = useState(false);
  useEffect(() => { if (!base) setOrigin(window.location.origin); }, [base]);
  const url = `${origin}${path}`;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={url} className="input tnum text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn shrink-0" onClick={() => { navigator.clipboard?.writeText(url); setOk(true); setTimeout(() => setOk(false), 2000); }}>{ok ? "Tersalin ✓" : "Salin link"}</button>
    </div>
  );
}
