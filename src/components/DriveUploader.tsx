"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import ActionForm from "./ActionForm";
import { finishDriveUpload, shareDriveFolder, startDriveUpload } from "@/app/actions/drive";
import { FILE_KIND_LABEL } from "@/lib/format";

const CHUNK = 8 * 1024 * 1024; // kelipatan 256 KB sesuai syarat Google

type Item = { name: string; size: number; pct: number; state: "wait" | "up" | "done" | "err"; error?: string };

function putChunk(url: string, blob: Blob, start: number, total: number, onProgress: (loaded: number) => void) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Range", `bytes ${start}-${start + blob.size - 1}/${total}`);
    x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () => resolve({ status: x.status, body: x.responseText });
    x.onerror = () => reject(new Error("Koneksi terputus."));
    x.send(blob);
  });
}

async function uploadFile(file: File, sessionUrl: string, onPct: (p: number) => void): Promise<string> {
  let start = 0;
  while (start < file.size) {
    const end = Math.min(start + CHUNK, file.size);
    const blob = file.slice(start, end);
    let attempt = 0;
    for (;;) {
      try {
        const r = await putChunk(sessionUrl, blob, start, file.size, (l) => onPct(Math.round(((start + l) / file.size) * 100)));
        if (r.status === 200 || r.status === 201) return (JSON.parse(r.body) as { id: string }).id;
        if (r.status === 308) break;
        throw new Error(`Google menjawab ${r.status}.`);
      } catch (e) {
        if (++attempt >= 3) throw e;
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
    start = end;
  }
  throw new Error("Upload tidak selesai.");
}

export default function DriveUploader({
  customerId, bookingId, bookings, connected,
}: { customerId: number; bookingId?: number; bookings?: { id: number; label: string }[]; connected: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("foto_edit");
  const [bid, setBid] = useState<number | "">(bookingId ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  if (!connected) {
    return (
      <p className="rounded-xl bg-warnsoft p-4 text-sm font-medium text-warn">
        Google Drive belum terhubung. Owner dapat menghubungkannya di <b>Pengaturan → Google Drive</b>. Sementara itu, gunakan “Tambah” untuk memasukkan link manual.
      </p>
    );
  }
  const target = { customerId, bookingId: bid === "" ? null : bid };
  const patch = (i: number, p: Partial<Item>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function run(files: File[]) {
    setBusy(true);
    const base = items.length;
    setItems((l) => [...l, ...files.map((f) => ({ name: f.name, size: f.size, pct: 0, state: "wait" as const }))]);
    for (let n = 0; n < files.length; n++) {
      const f = files[n], i = base + n;
      patch(i, { state: "up" });
      try {
        const s = await startDriveUpload(target, f.name, f.type, f.size);
        if (!s.ok) throw new Error(s.error);
        const id = await uploadFile(f, s.sessionUrl, (pct) => patch(i, { pct }));
        const done = await finishDriveUpload(target, id, f.type.startsWith("video/") ? "video" : kind);
        if (!done.ok) throw new Error(done.error);
        patch(i, { state: "done", pct: 100 });
      } catch (e) {
        patch(i, { state: "err", error: e instanceof Error ? e.message : "Gagal." });
      }
    }
    setBusy(false);
    router.refresh();
  }

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
        <span className="mt-1 block text-xs text-muted">Video otomatis ditandai sebagai Video.</span>
      </label>

      <input ref={input} type="file" multiple accept="image/*,video/*,.zip,.pdf" className="hidden" disabled={busy}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void run(f); }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        className="grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed border-line py-8 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent active:scale-[.99]">
        <Icon name="download" className="size-7 rotate-180" />
        {busy ? "Mengunggah… jangan tutup halaman" : "Ketuk untuk pilih foto / video"}
      </button>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{it.name}</span>
                <span className={`shrink-0 text-xs font-bold ${it.state === "done" ? "text-ok" : it.state === "err" ? "text-bad" : "text-muted"}`}>
                  {it.state === "done" ? "Selesai ✓" : it.state === "err" ? "Gagal" : it.state === "up" ? `${it.pct}%` : "Antre"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
                <div className={`h-full rounded-full transition-[width] ${it.state === "err" ? "bg-bad" : "bg-accent"}`} style={{ width: `${it.pct}%` }} />
              </div>
              {it.error && <p className="mt-1.5 text-xs font-medium text-bad">{it.error}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line pt-4">
        <p className="mb-2 text-xs text-muted">Sudah selesai mengunggah? Bagikan seluruh folder sebagai satu link ke customer.</p>
        <ActionForm action={shareDriveFolder.bind(null, target)} submit="Bagikan link folder" className="space-y-2" />
      </div>
    </div>
  );
}
