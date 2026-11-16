"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { toast } from "./Toaster";
import { autoShareFolder, finishDriveUpload, startDriveUpload } from "@/app/actions/drive";
import { FILE_KIND_LABEL, waLink } from "@/lib/format";

const CHUNK = 8 * 1024 * 1024; // kelipatan 256 KB sesuai syarat Google
const PARALLEL = 2;

type State = "wait" | "up" | "saving" | "done" | "err" | "stop";
type Item = { id: number; name: string; size: number; loaded: number; state: State; error?: string };

const bytes = (n: number) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const eta = (s: number) => (s < 60 ? `${Math.max(1, Math.round(s))} dtk` : s < 3600 ? `${Math.round(s / 60)} mnt` : `${(s / 3600).toFixed(1)} jam`);

class Stopped extends Error {}

/** Satu potongan: PUT ke sesi resumable Google. `hold` dipakai untuk membatalkan di tengah jalan. */
function putChunk(url: string, blob: Blob, start: number, total: number, onLoaded: (loaded: number) => void, hold: (x: XMLHttpRequest) => void) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    hold(x);
    x.open("PUT", url);
    x.setRequestHeader("Content-Range", `bytes ${start}-${start + blob.size - 1}/${total}`);
    x.upload.onprogress = (e) => onLoaded(e.loaded);
    x.onload = () => resolve({ status: x.status, body: x.responseText });
    x.onerror = () => reject(new Error("Koneksi terputus."));
    x.onabort = () => reject(new Stopped("Dibatalkan."));
    x.send(blob);
  });
}

async function uploadFile(file: File, sessionUrl: string, onLoaded: (loaded: number) => void, hold: (x: XMLHttpRequest) => void, stopped: () => boolean): Promise<string> {
  let start = 0;
  while (start < file.size) {
    const end = Math.min(start + CHUNK, file.size);
    const blob = file.slice(start, end);
    let attempt = 0;
    for (;;) {
      if (stopped()) throw new Stopped("Dibatalkan.");
      try {
        const r = await putChunk(sessionUrl, blob, start, file.size, (l) => onLoaded(start + l), hold);
        if (r.status === 200 || r.status === 201) return (JSON.parse(r.body) as { id: string }).id;
        if (r.status === 308) break;
        throw new Error(`Google menjawab ${r.status}.`);
      } catch (e) {
        if (e instanceof Stopped || ++attempt >= 3) throw e;
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
    start = end;
  }
  throw new Error("Upload tidak selesai.");
}

type Props = {
  customerId: number; bookingId?: number; bookings?: { id: number; label: string }[]; connected: boolean;
  customerName?: string; customerPhone?: string;
};

export default function DriveUploader({ customerId, bookingId, bookings, connected, customerName, customerPhone }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("foto_edit");
  const [bid, setBid] = useState<number | "">(bookingId ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [auto, setAuto] = useState(true);
  const [share, setShare] = useState<{ state: "wait" | "ok" | "err"; url?: string; title?: string; error?: string } | null>(null);
  const [speed, setSpeed] = useState(0);

  const files = useRef(new Map<number, File>());
  const xhrs = useRef(new Map<number, XMLHttpRequest>());
  const stops = useRef(new Set<number>());
  const nextId = useRef(1);
  const itemsRef = useRef<Item[]>([]);
  const sample = useRef({ t: 0, b: 0 });
  itemsRef.current = items;

  const target = useMemo(() => ({ customerId, bookingId: bid === "" ? null : bid }), [customerId, bid]);
  const patch = useCallback((id: number, p: Partial<Item>) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x))), []);

  // Jangan sampai tab ditutup tanpa sengaja saat masih mengunggah
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  // Kecepatan rata-rata ~ tiap detik dari total byte terkirim
  useEffect(() => {
    if (!busy) { setSpeed(0); return; }
    sample.current = { t: Date.now(), b: itemsRef.current.reduce((a, i) => a + i.loaded, 0) };
    const iv = setInterval(() => {
      const now = Date.now(), b = itemsRef.current.reduce((a, i) => a + i.loaded, 0);
      const dt = (now - sample.current.t) / 1000;
      if (dt >= 1) { const inst = Math.max(0, (b - sample.current.b) / dt); setSpeed((s) => (s ? s * 0.6 + inst * 0.4 : inst)); sample.current = { t: now, b }; }
    }, 500);
    return () => clearInterval(iv);
  }, [busy]);

  const processOne = useCallback(async (id: number) => {
    const f = files.current.get(id)!;
    patch(id, { state: "up", loaded: 0, error: undefined });
    try {
      const s = await startDriveUpload(target, f.name, f.type, f.size);
      if (!s.ok) throw new Error(s.error);
      const fid = await uploadFile(f, s.sessionUrl, (l) => patch(id, { loaded: Math.min(l, f.size) }), (x) => xhrs.current.set(id, x), () => stops.current.has(id));
      patch(id, { state: "saving", loaded: f.size });
      const done = await finishDriveUpload(target, fid, f.type.startsWith("video/") ? "video" : kind);
      if (!done.ok) throw new Error(done.error);
      patch(id, { state: "done" });
    } catch (e) {
      if (e instanceof Stopped || stops.current.has(id)) patch(id, { state: "stop", error: "Dibatalkan." });
      else patch(id, { state: "err", error: e instanceof Error ? e.message : "Gagal." });
    } finally { xhrs.current.delete(id); }
  }, [target, kind, patch]);

  const runQueue = useCallback(async (ids: number[]) => {
    setBusy(true); setShare(null);
    const q = [...ids];
    await Promise.all(Array.from({ length: Math.min(PARALLEL, q.length) }, async () => { for (let id = q.shift(); id !== undefined; id = q.shift()) await processOne(id); }));
    setBusy(false);
    const all = itemsRef.current;
    const ok = all.some((i) => i.state === "done");
    router.refresh();
    if (ok && auto) {
      setShare({ state: "wait" });
      const r = await autoShareFolder(target);
      setShare(r.ok ? { state: "ok", url: r.url, title: r.title } : { state: "err", error: r.error });
      if (r.ok) toast("Upload selesai · link folder siap dibagikan");
    } else if (ok) toast("Upload selesai");
  }, [processOne, router, auto, target]);

  function add(list: File[]) {
    if (!list.length || busy) return;
    const fresh: Item[] = list.map((f) => { const id = nextId.current++; files.current.set(id, f); return { id, name: f.name, size: f.size, loaded: 0, state: "wait" }; });
    setItems((l) => [...l, ...fresh]);
    void runQueue(fresh.map((i) => i.id));
  }
  const stop = (id: number) => { stops.current.add(id); xhrs.current.get(id)?.abort(); if (itemsRef.current.find((i) => i.id === id)?.state === "wait") patch(id, { state: "stop", error: "Dibatalkan." }); };
  const retry = (id: number) => { if (busy) return; stops.current.delete(id); void runQueue([id]); };
  const retryAll = () => { const ids = itemsRef.current.filter((i) => i.state === "err" || i.state === "stop").map((i) => i.id); ids.forEach((i) => stops.current.delete(i)); if (ids.length) void runQueue(ids); };

  if (!connected) {
    return (
      <div className="space-y-3 rounded-2xl border border-warn/30 bg-warnsoft p-4 text-sm font-medium text-warn">
        <p>Google Drive belum terhubung, jadi upload otomatis belum bisa dipakai.</p>
        <p className="font-normal">Owner menghubungkannya sekali saja di <a href="/pengaturan" className="font-bold underline">Pengaturan → Google Drive</a>. Sementara itu, gunakan “Tambah File” untuk memasukkan link manual.</p>
      </div>
    );
  }

  const total = items.reduce((a, i) => a + i.size, 0);
  const sent = items.reduce((a, i) => a + (i.state === "done" ? i.size : i.loaded), 0);
  const pct = total ? Math.round((sent / total) * 100) : 0;
  const doneN = items.filter((i) => i.state === "done").length;
  const errN = items.filter((i) => i.state === "err" || i.state === "stop").length;
  const remain = Math.max(0, total - sent);
  const msg = share?.url ? `Halo ${customerName ?? ""}, foto/video kamu dari STUDIODO sudah siap ✨\nUnduh semuanya di: ${share.url}\nTerima kasih sudah berfoto di STUDIODO!` : "";

  return (
    <div className="space-y-4">
      {bookings && bookings.length > 0 && (
        <label className="block"><span className="label">Simpan ke folder</span>
          <select className="input" value={bid} disabled={busy} onChange={(e) => setBid(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Folder customer (umum)</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>Sesi {b.label}</option>)}
          </select>
        </label>
      )}
      <label className="block"><span className="label">Jenis file</span>
        <select className="input" value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(FILE_KIND_LABEL).filter(([k]) => k !== "video").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="mt-1 block text-xs text-muted">Video otomatis ditandai sebagai Video. Folder dibuat otomatis: STUDIODO Kasir / customer / sesi.</span>
      </label>

      <input ref={input} type="file" multiple accept="image/*,video/*,.zip,.pdf" className="hidden" disabled={busy}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; add(f); }} />
      <button type="button" disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add([...e.dataTransfer.files]); }}
        className={`grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed py-8 text-sm font-semibold transition duration-300 active:scale-[.99] disabled:cursor-wait ${drag ? "scale-[1.01] border-accent bg-accentsoft text-accent" : "border-line text-muted hover:border-accent hover:text-accent"}`}>
        <Icon name="download" className={`size-7 rotate-180 ${busy ? "animate-bounce" : ""}`} />
        {busy ? "Sedang mengunggah… jangan tutup halaman" : drag ? "Lepas file di sini" : "Ketuk atau seret foto / video ke sini"}
      </button>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" checked={auto} disabled={busy} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span><b>Otomatis buat link folder</b> setelah selesai <span className="block text-xs text-muted">Folder dibuka “siapa saja yang punya link”, lalu langsung bisa disalin atau dikirim lewat WhatsApp.</span></span>
      </label>

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-line p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{busy ? "Mengunggah" : errN ? "Selesai sebagian" : "Selesai"} · {doneN}/{items.length} file</span>
              <span className="tnum font-bold">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-[width] duration-300 ${busy ? "bg-gradient-to-r from-accent to-[#5aa0ff] bg-[length:200%_100%] animate-[shimmer_1.4s_linear_infinite]" : errN ? "bg-warn" : "bg-ok"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="tnum mt-1.5 text-xs text-muted">
              {bytes(sent)} dari {bytes(total)}{busy && speed > 0 && <> · {bytes(speed)}/dtk · sisa ±{eta(remain / speed)}</>}
            </p>
          </div>
          <ul className="space-y-2">
            {items.map((it) => {
              const p = it.state === "done" ? 100 : it.size ? Math.round((it.loaded / it.size) * 100) : 0;
              return (
                <li key={it.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{it.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-bold ${it.state === "done" ? "text-ok" : it.state === "err" ? "text-bad" : "text-muted"}`}>
                        {it.state === "done" ? "Selesai ✓" : it.state === "err" ? "Gagal" : it.state === "stop" ? "Dibatalkan" : it.state === "saving" ? "Menyimpan…" : it.state === "up" ? `${p}%` : "Antre"}
                      </span>
                      {(it.state === "up" || it.state === "wait") && <button type="button" onClick={() => stop(it.id)} className="btn btn-sm !min-h-7 !px-2.5 text-xs">Batal</button>}
                      {(it.state === "err" || it.state === "stop") && !busy && <button type="button" onClick={() => retry(it.id)} className="btn btn-sm !min-h-7 !px-2.5 text-xs">Coba lagi</button>}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
                    <div className={`h-full rounded-full transition-[width] duration-300 ${it.state === "err" || it.state === "stop" ? "bg-bad" : it.state === "done" ? "bg-ok" : "bg-accent"} ${it.state === "saving" ? "animate-pulse" : ""}`} style={{ width: `${p}%` }} />
                  </div>
                  <p className="tnum mt-1 text-xs text-muted">{bytes(it.size)}{it.error && <span className="ml-2 font-medium text-bad">{it.error}</span>}</p>
                </li>
              );
            })}
          </ul>
          {errN > 1 && !busy && <button type="button" onClick={retryAll} className="btn btn-sm">Ulangi semua yang gagal</button>}
        </div>
      )}

      {share && (
        <div className={`anim-rise rounded-2xl border p-4 text-sm ${share.state === "err" ? "border-bad/30 bg-badsoft text-bad" : "border-ok/30 bg-oksoft"}`} aria-live="polite">
          {share.state === "wait" && <p className="flex items-center gap-2 font-semibold"><span className="spinner" /> Membuat link folder…</p>}
          {share.state === "err" && <p className="font-semibold">Link folder belum terbuat: {share.error}</p>}
          {share.state === "ok" && share.url && (
            <div className="space-y-3">
              <p className="font-semibold text-ok">Link folder siap ✓ <span className="font-normal text-muted">({share.title})</span></p>
              <p className="break-all rounded-lg bg-panel px-3 py-2 text-xs text-fg">{share.url}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(share.url!).then(() => toast("Link disalin"), () => toast("Gagal menyalin")); }}>Salin link</button>
                {customerPhone && <a className="btn btn-sm btn-primary" target="_blank" rel="noopener noreferrer" href={waLink(customerPhone, msg)}>Kirim ke WhatsApp</a>}
                <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={share.url}>Buka folder</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
