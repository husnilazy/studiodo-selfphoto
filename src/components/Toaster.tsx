"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

type T = { id: number; msg: string; tone: "ok" | "bad"; out?: boolean };

/** Notifikasi kecil yang meluncur dari bawah. Panggil `toast("Tersimpan")` dari mana saja di sisi client. */
export function toast(msg: string, tone: "ok" | "bad" = "ok") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sd-toast", { detail: { msg, tone } }));
}

export default function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { msg, tone } = (e as CustomEvent<{ msg: string; tone: "ok" | "bad" }>).detail;
      const id = ++n;
      setItems((a) => [...a.slice(-2), { id, msg, tone }]);
      setTimeout(() => setItems((a) => a.map((t) => (t.id === id ? { ...t, out: true } : t))), 2600);
      setTimeout(() => setItems((a) => a.filter((t) => t.id !== id)), 2950);
    };
    window.addEventListener("sd-toast", on);
    return () => window.removeEventListener("sd-toast", on);
  }, []);
  return (
    <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.out ? "toast-out" : ""} pointer-events-auto flex items-center gap-2 rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm font-semibold shadow-xl`}>
          <span className={`grid size-5 place-items-center rounded-full ${t.tone === "ok" ? "bg-ok text-bg" : "bg-bad text-bg"}`}><Icon name={t.tone === "ok" ? "check" : "x"} className="size-3" /></span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
