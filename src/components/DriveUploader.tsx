"use client";
import { useRef, useState } from "react";
import Icon from "./Icon";
import { JobView, useUploads } from "./UploadDock";
import { enqueue } from "@/lib/uploadManager";
import { FILE_KIND_LABEL } from "@/lib/format";

type Props = {
  customerId: number; bookingId?: number; bookings?: { id: number; label: string }[]; connected: boolean;
  customerName?: string; customerPhone?: string;
};

/**
 * Formulir upload ke Google Drive. File langsung diserahkan ke pengelola upload (lihat lib/uploadManager),
 * jadi dialog ini boleh ditutup: upload terus berjalan dan dipantau lewat dock di pojok layar.
 */
export default function DriveUploader({ customerId, bookingId, bookings, connected, customerName, customerPhone }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("foto_edit");
  const [bid, setBid] = useState<number | "">(bookingId ?? "");
  const [drag, setDrag] = useState(false);
  const [auto, setAuto] = useState(true);
  const { jobs, speed } = useUploads();
  const mine = jobs.filter((j) => j.customerId === customerId);
  const running = mine.some((j) => j.running);

  if (!connected) {
    return (
      <div className="space-y-3 rounded-2xl border border-warn/30 bg-warnsoft p-4 text-sm font-medium text-warn">
        <p>Google Drive belum terhubung, jadi upload otomatis belum bisa dipakai.</p>
        <p className="font-normal">Owner menghubungkannya sekali saja di <a href="/pengaturan" className="font-bold underline">Pengaturan → Google Drive</a>. Sementara itu, gunakan “Tambah File” untuk memasukkan link manual.</p>
      </div>
    );
  }

  function add(list: File[]) {
    if (!list.length) return;
    const b = bookings?.find((x) => x.id === bid);
    enqueue({
      customerId, customerName: customerName ?? `Customer #${customerId}`, customerPhone: customerPhone ?? "",
      bookingId: bid === "" ? null : bid, bookingLabel: b ? `Sesi ${b.label}` : bid === "" ? "" : "Sesi ini", kind, auto, files: list,
    });
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

      <input ref={input} type="file" multiple accept="image/*,video/*,.zip,.pdf" className="hidden"
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; add(f); }} />
      <button type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add([...e.dataTransfer.files]); }}
        className={`grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed py-8 text-sm font-semibold transition duration-300 active:scale-[.99] ${drag ? "scale-[1.01] border-accent bg-accentsoft text-accent" : "border-line text-muted hover:border-accent hover:text-accent"}`}>
        <Icon name="download" className={`size-7 rotate-180 ${running ? "animate-bounce" : ""}`} />
        {drag ? "Lepas file di sini" : running ? "Tambah file lagi (upload sebelumnya tetap jalan)" : "Ketuk atau seret foto / video ke sini"}
      </button>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span><b>Otomatis buat link folder</b> setelah selesai <span className="block text-xs text-muted">Folder dibuka “siapa saja yang punya link”, lalu langsung bisa disalin atau dikirim lewat WhatsApp.</span></span>
      </label>

      {running && (
        <p className="rounded-xl bg-accentsoft px-3 py-2 text-xs font-medium text-accent">
          Upload berjalan di latar belakang. Kamu boleh menutup dialog ini dan memakai aplikasi seperti biasa — pantau di pojok kiri bawah. Jangan menutup tab.
        </p>
      )}
      {mine.length > 0 && <div className="space-y-2">{mine.slice().reverse().map((j) => <JobView key={j.id} job={j} speed={speed} />)}</div>}
    </div>
  );
}
