"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useSheet } from "@/components/Sheet";
import { toast } from "@/components/Toaster";
import { saveFrame } from "@/app/actions/studio";
import { scanFrame, type FrameScan } from "@/lib/editor/chroma";
import { canvasToBlob } from "@/lib/editor/render";
import { uploadToStorage } from "@/lib/uploadClient";

export const FRAME_CATS: Record<string, string> = { strip: "Photostrip", "4r": "4R / Postcard", square: "Persegi", story: "Story / Vertikal", lainnya: "Lainnya" };
const guess = (w: number, h: number) => { const r = h / w; return r > 2.3 ? "strip" : r > 1.8 ? "story" : r > 1.2 ? "4r" : r > 0.85 ? "square" : "lainnya"; };

/** Upload frame photobooth: hijau otomatis dihapus, area hijau menjadi slot foto. */
export default function FrameUploader({ storage }: { storage: boolean }) {
  const router = useRouter();
  const sheet = useSheet();
  const input = useRef<HTMLInputElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scan, setScan] = useState<FrameScan | null>(null);
  const [tol, setTol] = useState(50);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("4r");
  const [off, setOff] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const run = async (f: File, t: number) => {
    setBusy("Mendeteksi area hijau…"); setErr("");
    try {
      const s = await scanFrame(f, t);
      setScan(s); setOff(new Set());
    } catch { setErr("Gambar tidak bisa dibaca. Pakai PNG atau JPG."); setScan(null); }
    setBusy("");
  };
  const pick = (f?: File) => {
    if (!f) return;
    setFile(f); setName((n) => n || f.name.replace(/\.\w+$/, ""));
    void createImageBitmap(f).then((b) => setCat(guess(b.width, b.height))).catch(() => null);
    void run(f, tol);
  };
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => void run(file, tol), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tol]);

  useEffect(() => {
    const c = view.current;
    if (!c || !scan) return;
    const k = Math.min(1, 520 / scan.w);
    c.width = Math.round(scan.w * k); c.height = Math.round(scan.h * k);
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(scan.canvas, 0, 0, c.width, c.height);
  }, [scan]);

  const slots = scan ? scan.slots.filter((_, i) => !off.has(i)) : [];

  const save = async () => {
    if (!scan || !file) return;
    setErr("");
    if (!storage) { setErr("Upload belum aktif di server (Supabase Storage). Aktifkan dulu agar frame bisa disimpan."); return; }
    if (!name.trim()) { setErr("Beri nama frame."); return; }
    if (!slots.length) { setErr("Tidak ada slot foto. Pastikan area foto berwarna hijau polos (mis. #00FF00), atau naikkan toleransi."); return; }
    setBusy("Mengunggah frame…"); setPct(0);
    const blob = await canvasToBlob(scan.canvas, "image/png");
    const up = await uploadToStorage(new File([blob], `${name.trim()}.png`, { type: "image/png" }), setPct, true);
    if (!up.url) { setErr(up.error ?? "Upload gagal."); setBusy(""); setPct(null); return; }
    const r = await saveFrame({ name, category: cat, url: up.url, w: scan.w, h: scan.h, slots });
    setBusy(""); setPct(null);
    if (!r.ok) { setErr(r.error); return; }
    toast("Frame tersimpan");
    sheet?.close(); router.refresh();
  };

  return (
    <div className="space-y-4">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {!scan && (
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
          className="grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed border-line bg-panel2/50 px-4 py-10 text-center transition hover:border-accent">
          {busy ? <span className="spinner" /> : <Icon name="layout" className="size-8 text-accent" />}
          <span className="font-semibold">{busy || "Pilih gambar frame (PNG/JPG)"}</span>
          <span className="max-w-xs text-xs text-muted">Buat area foto berwarna <b>hijau polos</b> (chroma key). Hijau akan otomatis dihapus dan menjadi slot foto.</span>
        </button>
      )}
      {err && <p role="alert" className="rounded-xl bg-badsoft px-3 py-2 text-sm font-medium text-bad">{err}</p>}

      {scan && (
        <>
          <div className="editor-checker relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl p-3">
            <div className="relative">
              <canvas ref={view} className="block max-h-[52dvh] w-auto max-w-full rounded shadow-lg" />
              {scan.slots.map((s, i) => (
                <button type="button" key={i} onClick={() => setOff((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  title={off.has(i) ? "Slot dimatikan — klik untuk aktifkan" : "Klik untuk matikan slot ini"}
                  className={`absolute grid place-items-center border-2 text-xs font-bold transition ${off.has(i) ? "border-dashed border-bad bg-bad/15 text-bad" : "border-accent bg-accent/20 text-white"}`}
                  style={{ left: `${(s.x / scan.w) * 100}%`, top: `${(s.y / scan.h) * 100}%`, width: `${(s.w / scan.w) * 100}%`, height: `${(s.h / scan.h) * 100}%` }}>
                  <span className="rounded-full bg-black/60 px-2 py-0.5">{off.has(i) ? "✕" : i + 1}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-center text-xs text-muted">{scan.w}×{scan.h}px · {slots.length} slot terdeteksi · {Math.round(scan.keyed * 100)}% area transparan. Klik slot untuk mematikannya.</p>

          <label className="block">
            <span className="label">Toleransi hijau: {tol}</span>
            <input type="range" min={10} max={120} value={tol} onChange={(e) => setTol(+e.target.value)} className="w-full accent-[var(--accent)]" />
            <span className="mt-1 block text-xs text-muted">Naikkan bila masih ada sisa hijau di tepi; turunkan bila bagian hijau pada desain ikut terhapus.</span>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Nama frame</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Photostrip Retro" /></label>
            <label className="block"><span className="label">Jenis</span>
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{Object.entries(FRAME_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          {pct !== null && <div className="h-1.5 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} /></div>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" disabled={!!busy} onClick={() => input.current?.click()}>Ganti gambar</button>
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={save}>{busy && <span className="spinner" />} {busy || "Simpan frame"}</button>
          </div>
        </>
      )}
    </div>
  );
}
