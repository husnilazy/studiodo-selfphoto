"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { toast } from "./Toaster";
import { emailLink, waLink } from "@/lib/format";
import { dismissFinished, dismissJob, getServerSnapshot, getSnapshot, onDone, retryItems, stopItem, stopJob, subscribe, type Job } from "@/lib/uploadManager";

const bytes = (n: number) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const eta = (s: number) => (s < 60 ? `${Math.max(1, Math.round(s))} dtk` : s < 3600 ? `${Math.round(s / 60)} mnt` : `${(s / 3600).toFixed(1)} jam`);
export const useUploads = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

const sent = (j: Job) => j.items.reduce((a, i) => a + (i.state === "done" ? i.size : i.loaded), 0);
const total = (j: Job) => j.items.reduce((a, i) => a + i.size, 0);

/** Satu pekerjaan upload: progres total, per file, dan hasil link folder. Dipakai di dock dan di dialog Upload. */
export function JobView({ job: j, speed, compact = false }: { job: Job; speed: number; compact?: boolean }) {
  const t = total(j), s = sent(j), pct = t ? Math.round((s / t) * 100) : 0;
  const doneN = j.items.filter((i) => i.state === "done").length;
  const errN = j.items.filter((i) => i.state === "err" || i.state === "stop").length;
  const remain = Math.max(0, t - s);
  const msg = j.share?.url ? `Halo ${j.customerName}, foto/video kamu dari STUDIODO sudah siap ✨\nUnduh semuanya di: ${j.share.url}\nTerima kasih sudah berfoto di STUDIODO!` : "";
  return (
    <div className="rounded-2xl border border-line bg-panel2/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{j.customerName}{j.bookingLabel && <span className="font-normal text-muted"> · {j.bookingLabel}</span>}</p>
          <p className="text-xs text-muted">{j.running ? "Mengunggah" : errN ? "Selesai sebagian" : "Selesai"} · {doneN}/{j.items.length} file</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="tnum text-sm font-bold">{pct}%</span>
          {j.running ? <button className="btn btn-sm !min-h-7 !px-2.5 text-xs" onClick={() => stopJob(j.id)}>Batalkan</button>
            : <button className="btn btn-sm !min-h-7 !px-2 text-xs" onClick={() => dismissJob(j.id)} aria-label="Tutup"><Icon name="x" className="size-3.5" /></button>}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${j.running ? "bg-gradient-to-r from-accent to-[#5aa0ff] bg-[length:200%_100%] animate-[shimmer_1.4s_linear_infinite]" : errN ? "bg-warn" : "bg-ok"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="tnum mt-1 text-xs text-muted">{bytes(s)} dari {bytes(t)}{j.running && speed > 0 && <> · {bytes(speed)}/dtk · sisa ±{eta(remain / speed)}</>}</p>

      {!compact && (
        <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
          {j.items.map((it) => {
            const p = it.state === "done" ? 100 : it.size ? Math.round((it.loaded / it.size) * 100) : 0;
            return (
              <li key={it.id} className="rounded-lg bg-panel/60 px-2.5 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{it.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`font-bold ${it.state === "done" ? "text-ok" : it.state === "err" ? "text-bad" : "text-muted"}`}>
                      {it.state === "done" ? "✓" : it.state === "err" ? "Gagal" : it.state === "stop" ? "Batal" : it.state === "saving" ? "Menyimpan…" : it.state === "up" ? `${p}%` : "Antre"}
                    </span>
                    {(it.state === "up" || it.state === "wait") && <button className="text-muted hover:text-bad" onClick={() => stopItem(j.id, it.id)} aria-label={`Batalkan ${it.name}`}>✕</button>}
                    {(it.state === "err" || it.state === "stop") && <button className="font-semibold text-accent" onClick={() => retryItems(j.id, [it.id])}>Ulang</button>}
                  </span>
                </div>
                {(it.state === "up" || it.state === "saving") && <div className="mt-1 h-1 overflow-hidden rounded-full bg-panel2"><div className={`h-full rounded-full bg-accent transition-[width] ${it.state === "saving" ? "animate-pulse" : ""}`} style={{ width: `${p}%` }} /></div>}
                {it.error && <p className="mt-0.5 text-bad">{it.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {errN > 1 && !j.running && <button className="btn btn-sm mt-2 !min-h-8" onClick={() => retryItems(j.id)}>Ulangi yang gagal</button>}

      {j.share && (
        <div className={`mt-2 rounded-xl border p-2.5 text-xs ${j.share.state === "err" ? "border-bad/30 bg-badsoft text-bad" : "border-ok/30 bg-oksoft"}`} aria-live="polite">
          {j.share.state === "wait" && <p className="flex items-center gap-2 font-semibold"><span className="spinner" /> Membuat link folder…</p>}
          {j.share.state === "err" && <p className="font-semibold">Link folder belum terbuat: {j.share.error}</p>}
          {j.share.state === "ok" && j.share.url && (
            <div className="space-y-2">
              <p className="font-semibold text-ok">Link folder siap ✓</p>
              <p className="break-all rounded-lg bg-panel px-2 py-1.5 text-fg">{j.share.url}</p>
              <div className="flex flex-wrap gap-1.5">
                <button className="btn btn-sm !min-h-8" onClick={() => { navigator.clipboard?.writeText(j.share!.url!).then(() => toast("Link disalin"), () => toast("Gagal menyalin", "bad")); }}>Salin link</button>
                {j.customerPhone && <a className="btn btn-sm btn-primary !min-h-8" target="_blank" rel="noopener noreferrer" href={waLink(j.customerPhone, msg)}>Kirim WhatsApp</a>}
                <a className="btn btn-sm !min-h-8" href={emailLink("", "Foto & video kamu dari STUDIODO", msg)}>Email</a>
                <a className="btn btn-sm !min-h-8" target="_blank" rel="noopener noreferrer" href={j.share.url}>Buka folder</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pantauan upload di pojok layar: tetap ada saat dialog ditutup atau pindah halaman.
 * Ciut = pil kecil dengan spinner & persen; ketuk untuk membuka daftar lengkap.
 */
export default function UploadDock() {
  const { jobs, speed } = useUploads();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wasRunning, setWasRunning] = useState(false);

  // Segarkan halaman (daftar file) tiap ada yang selesai
  useEffect(() => onDone(() => router.refresh()), [router]);

  const running = jobs.filter((j) => j.running);
  const t = jobs.reduce((a, j) => a + total(j), 0), s = jobs.reduce((a, j) => a + sent(j), 0);
  const pct = t ? Math.round((s / t) * 100) : 0;
  const files = jobs.reduce((a, j) => a + j.items.length, 0), done = jobs.reduce((a, j) => a + j.items.filter((i) => i.state === "done").length, 0);
  const errs = jobs.reduce((a, j) => a + j.items.filter((i) => i.state === "err" || i.state === "stop").length, 0);

  useEffect(() => {
    if (running.length) { setWasRunning(true); return; }
    if (wasRunning && jobs.length) { setWasRunning(false); toast(errs ? "Upload selesai sebagian — ada file yang gagal" : "Upload selesai ✓", errs ? "bad" : "ok"); }
  }, [running.length, wasRunning, jobs.length, errs]);
  useEffect(() => { if (!jobs.length) setOpen(false); }, [jobs.length]);

  if (!jobs.length) return null;
  const busy = running.length > 0;

  return (
    <div className="no-print fixed bottom-24 left-3 z-[65] w-[min(24rem,calc(100vw-1.5rem))] lg:bottom-4 lg:left-[17rem]" aria-live="polite">
      {open && (
        <div className="confirm-panel mb-2 max-h-[65vh] space-y-2.5 overflow-y-auto rounded-3xl border border-line p-3 shadow-2xl" role="region" aria-label="Daftar upload">
          <div className="flex items-center justify-between px-1">
            <p className="font-display text-sm font-semibold">Upload ke Google Drive</p>
            <div className="flex items-center gap-1">
              {!busy && <button className="btn btn-sm !min-h-7 !px-2.5 text-xs" onClick={() => { dismissFinished(); }}>Bersihkan</button>}
              <button className="btn btn-sm !min-h-7 !px-2" onClick={() => setOpen(false)} aria-label="Ciutkan"><Icon name="x" className="size-3.5" /></button>
            </div>
          </div>
          {jobs.slice().reverse().map((j) => <JobView key={j.id} job={j} speed={speed} />)}
          {busy && <p className="px-1 text-[11px] text-muted">Boleh pindah halaman atau menutup dialog — upload tetap jalan. Jangan menutup tab atau memuat ulang.</p>}
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="confirm-panel group flex w-full items-center gap-3 rounded-full border border-line py-2 pl-3 pr-4 text-left shadow-2xl transition hover:border-accent">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${busy ? "bg-accentsoft text-accent" : errs ? "bg-warnsoft text-warn" : "bg-oksoft text-ok"}`}>
          {busy ? <span className="spinner" /> : <Icon name={errs ? "alert" : "check"} className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{busy ? `Mengunggah ${done}/${files} file` : errs ? `Selesai, ${errs} gagal` : `Upload selesai · ${files} file`}</span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-panel2"><span className={`block h-full rounded-full transition-[width] duration-300 ${busy ? "bg-accent" : errs ? "bg-warn" : "bg-ok"}`} style={{ width: `${pct}%` }} /></span>
        </span>
        <span className="tnum shrink-0 text-sm font-bold">{pct}%</span>
      </button>
    </div>
  );
}
