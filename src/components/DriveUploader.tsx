"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { JobView, useUploads } from "./UploadDock";
import { enqueue } from "@/lib/uploadManager";
import { FILE_KIND_LABEL } from "@/lib/format";

type Props = {
  customerId: number; bookingId?: number; bookings?: { id: number; label: string }[]; connected: boolean;
  customerName?: string; customerPhone?: string;
};
type Staged = { id: number; file: File; rel: string; on: boolean };

const OK = /^(image|video)\/|\.(zip|pdf|jpe?g|png|webp|heic|heif|gif|mp4|mov|m4v|cr2|cr3|nef|arw|dng)$/i;
const okFile = (f: File) => OK.test(f.type) || OK.test(f.name);
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type FsEntry = { isFile: boolean; isDirectory: boolean; fullPath: string; file?: (cb: (f: File) => void, err?: () => void) => void; createReader?: () => { readEntries: (cb: (e: FsEntry[]) => void, err?: () => void) => void } };
async function walk(entry: FsEntry, out: { file: File; rel: string }[]) {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File | null>((res) => entry.file!(res, () => res(null)));
    if (file) out.push({ file, rel: entry.fullPath.replace(/^\//, "") });
  } else if (entry.isDirectory && entry.createReader) {
    const rd = entry.createReader();
    for (;;) {
      const batch = await new Promise<FsEntry[]>((res) => rd.readEntries(res, () => res([])));
      if (!batch.length) break;
      for (const e of batch) await walk(e, out);
    }
  }
}

/** Kotak kecil pratinjau foto terpilih; URL objek dilepas saat tak dipakai. */
function Thumb({ file }: { file: File }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/") || /heic|heif|tiff/i.test(file.type)) return;
    const u = URL.createObjectURL(file);
    setSrc(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return src
    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
    : <span className="grid size-full place-items-center text-muted"><Icon name={file.type.startsWith("video/") ? "camera" : "folder"} className="size-5" /></span>;
}

/**
 * Formulir upload ke Google Drive: pilih foto, atau seluruh folder, lalu centang foto yang mau diunggah.
 * Setelah ditekan Upload, file diserahkan ke pengelola upload (lib/uploadManager) sehingga dialog boleh ditutup.
 */
export default function DriveUploader({ customerId, bookingId, bookings, connected, customerName, customerPhone }: Props) {
  const filesIn = useRef<HTMLInputElement>(null);
  const dirIn = useRef<HTMLInputElement>(null);
  const seq = useRef(1);
  const [kind, setKind] = useState("foto_edit");
  const [bid, setBid] = useState<number | "">(bookingId ?? "");
  const [drag, setDrag] = useState(false);
  const [auto, setAuto] = useState(true);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [skipped, setSkipped] = useState(0);
  const { jobs, speed } = useUploads();
  const mine = jobs.filter((j) => j.customerId === customerId);
  const running = mine.some((j) => j.running);

  const picked = staged.filter((s) => s.on);
  const total = picked.reduce((a, s) => a + s.file.size, 0);
  const folderName = useMemo(() => {
    const nested = staged.filter((s) => s.rel.includes("/"));
    const tops = new Set(nested.map((s) => s.rel.split("/")[0]));
    return nested.length === staged.length && tops.size === 1 ? [...tops][0] : "";
  }, [staged]);

  if (!connected) {
    return (
      <div className="space-y-3 rounded-2xl border border-warn/30 bg-warnsoft p-4 text-sm font-medium text-warn">
        <p>Google Drive belum terhubung, jadi upload otomatis belum bisa dipakai.</p>
        <p className="font-normal">Owner menghubungkannya sekali saja di <a href="/pengaturan" className="font-bold underline">Pengaturan → Google Drive</a>. Sementara itu, gunakan “Tambah File” untuk memasukkan link manual.</p>
      </div>
    );
  }

  function stage(list: { file: File; rel: string }[]) {
    const good = list.filter((x) => okFile(x.file) && !x.file.name.startsWith("."));
    setSkipped((n) => n + list.length - good.length);
    setStaged((cur) => {
      const seen = new Set(cur.map((s) => `${s.rel}|${s.file.size}`));
      const add = good.filter((x) => !seen.has(`${x.rel}|${x.file.size}`)).map((x) => ({ id: seq.current++, file: x.file, rel: x.rel, on: true }));
      return [...cur, ...add];
    });
  }
  const fromInput = (fl: FileList | null) => { if (fl) stage([...fl].map((f) => ({ file: f, rel: f.webkitRelativePath || f.name }))); };

  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const entries = [...e.dataTransfer.items].map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry?.() ?? null);
    if (entries.some(Boolean)) {
      const out: { file: File; rel: string }[] = [];
      for (const en of entries) if (en) await walk(en, out);
      stage(out);
    } else stage([...e.dataTransfer.files].map((f) => ({ file: f, rel: f.name })));
  }

  function start() {
    if (!picked.length) return;
    const b = bookings?.find((x) => x.id === bid);
    enqueue({
      customerId, customerName: customerName ?? `Customer #${customerId}`, customerPhone: customerPhone ?? "",
      bookingId: bid === "" ? null : bid, bookingLabel: b ? `Sesi ${b.label}` : bid === "" ? "" : "Sesi ini", kind, auto, files: picked.map((s) => s.file),
    });
    setStaged([]); setSkipped(0);
  }

  return (
    <div className="space-y-4">
      {bookings && bookings.length > 0 && (
        <label className="block"><span className="label">Simpan ke folder</span>
          <select className="input" value={bid} onChange={(e) => setBid(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Folder customer (umum)</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>Sesi {b.label}</option>)}
          </select>
        </label>
      )}
      <label className="block"><span className="label">Jenis file</span>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(FILE_KIND_LABEL).filter(([k]) => k !== "video").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="mt-1 block text-xs text-muted">Video otomatis ditandai sebagai Video. Folder dibuat otomatis: STUDIODO Kasir / customer / sesi.</span>
      </label>

      <input ref={filesIn} type="file" multiple accept="image/*,video/*,.zip,.pdf" className="hidden" onChange={(e) => { fromInput(e.target.files); e.target.value = ""; }} />
      <input ref={dirIn} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => { fromInput(e.target.files); e.target.value = ""; }} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`grid gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition duration-300 ${drag ? "scale-[1.01] border-accent bg-accentsoft" : "border-line"}`}>
        <p className={`text-sm font-semibold ${drag ? "text-accent" : "text-muted"}`}>{drag ? "Lepas foto atau folder di sini" : "Seret foto atau seluruh folder ke sini, atau pilih:"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn" onClick={() => filesIn.current?.click()}><Icon name="camera" className="size-4" /> Pilih foto</button>
          <button type="button" className="btn" onClick={() => dirIn.current?.click()}><Icon name="folder" className="size-4" /> Pilih folder</button>
        </div>
      </div>

      {staged.length > 0 && (
        <div className="anim-rise space-y-2.5 rounded-2xl border border-line bg-panel2/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-sm font-semibold">
              {folderName && <><Icon name="folder" className="mr-1 inline size-4 text-accent" />{folderName} · </>}
              <span className="tnum">{picked.length}</span> dari {staged.length} file dipilih · {kb(total)}
            </p>
            <div className="flex gap-1.5 text-xs font-semibold">
              <button type="button" className="btn btn-sm !min-h-7 !px-2.5" onClick={() => setStaged((c) => c.map((s) => ({ ...s, on: true })))}>Pilih semua</button>
              <button type="button" className="btn btn-sm !min-h-7 !px-2.5" onClick={() => setStaged((c) => c.map((s) => ({ ...s, on: false })))}>Kosongkan</button>
              <button type="button" className="btn btn-sm !min-h-7 !px-2.5" onClick={() => { setStaged([]); setSkipped(0); }}>Hapus semua</button>
            </div>
          </div>
          <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-4">
            {staged.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setStaged((c) => c.map((x) => (x.id === s.id ? { ...x, on: !x.on } : x)))} aria-pressed={s.on}
                  className={`relative block aspect-square w-full overflow-hidden rounded-xl border-2 transition ${s.on ? "border-accent" : "border-transparent opacity-45"}`} title={s.rel}>
                  <Thumb file={s.file} />
                  <span className={`absolute right-1 top-1 grid size-5 place-items-center rounded-full text-[11px] font-bold ${s.on ? "bg-accent text-white" : "bg-black/50 text-white/70"}`}>{s.on ? "✓" : ""}</span>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">{s.file.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {skipped > 0 && <p className="text-xs text-muted">{skipped} file dilewati (bukan foto/video/ZIP/PDF).</p>}
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span><b>Otomatis buat link folder</b> setelah selesai <span className="block text-xs text-muted">Folder dibuka “siapa saja yang punya link”, lalu bisa dikirim lewat WhatsApp atau email.</span></span>
          </label>
          <button type="button" className="btn btn-primary w-full" disabled={!picked.length} onClick={start}>
            <Icon name="download" className="size-4 rotate-180" /> Upload {picked.length} file{running ? " (menyusul antrean)" : ""}
          </button>
        </div>
      )}

      {running && (
        <p className="rounded-xl bg-accentsoft px-3 py-2 text-xs font-medium text-accent">
          Upload berjalan di latar belakang. Kamu boleh menutup dialog ini dan memakai aplikasi seperti biasa — pantau di pojok kiri bawah. Jangan menutup tab.
        </p>
      )}
      {mine.length > 0 && <div className="space-y-2">{mine.slice().reverse().map((j) => <JobView key={j.id} job={j} speed={speed} />)}</div>}
    </div>
  );
}
