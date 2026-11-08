"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Menyegarkan data halaman secara berkala (realtime ringan) dan saat tab kembali aktif. */
export default function LiveRefresh({ every = 45 }: { every?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return; // jangan mengganggu saat mengisi form
      router.refresh();
      setAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    const id = setInterval(tick, every * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [router, every]);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted" title="Data diperbarui otomatis">
      <i className="live-dot size-2 rounded-full bg-ok" /> Live{at && ` · ${at}`}
    </span>
  );
}
