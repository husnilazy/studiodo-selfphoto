"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Ajakan memasang aplikasi: tombol langsung di Android/Chrome, petunjuk "Tambah ke Layar Utama" di iPhone. */
export default function InstallPrompt({ always = false }: { always?: boolean }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem("fh_install_dismissed") === "1"; } catch { /* mode privat */ }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos && (always || !dismissed)) setHidden(false);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); if (always || !dismissed) setHidden(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [always]);

  if (hidden || (!evt && !ios)) return null;
  const close = () => { setHidden(true); try { localStorage.setItem("fh_install_dismissed", "1"); } catch { /* abaikan */ } };
  return (
    <div className="no-print fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-line p-4 shadow-2xl backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:w-96" style={{ background: "var(--nav-bg)" }} role="dialog" aria-label="Pasang aplikasi">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-fg text-lg font-semibold text-bg">F</span>
        <div className="min-w-0 flex-1 text-sm">
          <b className="block font-medium">Pasang Frameless Hub di HP</b>
          {ios ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">Ketuk tombol <b className="text-fg">Bagikan</b> (kotak dengan panah ke atas) di Safari, lalu pilih <b className="text-fg">Tambah ke Layar Utama</b>.</p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">Buka lebih cepat dari layar utama, tampil penuh seperti aplikasi.</p>
          )}
          <div className="mt-3 flex gap-2">
            {evt && <button className="btn btn-primary !min-h-9 text-xs" onClick={async () => { await evt.prompt(); await evt.userChoice.catch(() => null); setHidden(true); }}>Pasang</button>}
            <button className="btn !min-h-9 text-xs" onClick={close}>{ios ? "Mengerti" : "Nanti"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
