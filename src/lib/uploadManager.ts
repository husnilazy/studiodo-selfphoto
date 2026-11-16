"use client";
import { autoShareFolder, finishDriveUpload, startDriveUpload } from "@/app/actions/drive";

/**
 * Pengelola upload Google Drive di tingkat aplikasi (bukan di dalam dialog), jadi upload tetap berjalan
 * saat dialog ditutup atau admin pindah halaman. Dipantau lewat UploadDock di pojok layar.
 * Catatan: me-refresh/menutup tab menghentikan upload (browser tidak mengizinkan lanjut), karena itu ada peringatan.
 */
const CHUNK = 8 * 1024 * 1024; // kelipatan 256 KB sesuai syarat Google
const PARALLEL = 2;

export type ItemState = "wait" | "up" | "saving" | "done" | "err" | "stop";
export type UpItem = { id: number; name: string; size: number; loaded: number; state: ItemState; error?: string };
export type ShareInfo = { state: "wait" | "ok" | "err"; url?: string; title?: string; error?: string };
export type Job = {
  id: number; customerId: number; customerName: string; customerPhone: string; bookingId: number | null; bookingLabel: string;
  kind: string; auto: boolean; items: UpItem[]; running: boolean; share: ShareInfo | null; createdAt: number; dismissed: boolean;
};
export type EnqueueArgs = {
  customerId: number; customerName: string; customerPhone: string; bookingId: number | null; bookingLabel: string;
  kind: string; auto: boolean; files: File[];
};

class Stopped extends Error {}

type State = { jobs: Job[]; speed: number };
let state: State = { jobs: [], speed: 0 };
const listeners = new Set<() => void>();
const doneListeners = new Set<() => void>();
const files = new Map<string, File>(); // "jobId:itemId" -> File
const xhrs = new Map<string, XMLHttpRequest>();
const stops = new Set<string>();
let nextJob = 1, nextItem = 1;
const queue: { jobId: number; itemId: number }[] = [];
let active = 0;
let sample = { t: 0, b: 0 };
let speedTimer: ReturnType<typeof setInterval> | null = null;
let guardOn = false;

const emit = () => { state = { ...state }; listeners.forEach((l) => l()); };
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getSnapshot = () => state;
export const getServerSnapshot = () => state;
/** Dipanggil tiap ada file/pekerjaan selesai (untuk me-refresh halaman). */
export const onDone = (l: () => void) => { doneListeners.add(l); return () => { doneListeners.delete(l); }; };

const key = (j: number, i: number) => `${j}:${i}`;
const job = (id: number) => state.jobs.find((j) => j.id === id);
const patchJob = (id: number, p: Partial<Job>) => { state.jobs = state.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)); emit(); };
const patchItem = (jid: number, iid: number, p: Partial<UpItem>) => {
  state.jobs = state.jobs.map((j) => (j.id === jid ? { ...j, items: j.items.map((x) => (x.id === iid ? { ...x, ...p } : x)) } : j));
  emit();
};

export const totalBytesSent = () => state.jobs.reduce((a, j) => a + j.items.reduce((b, i) => b + (i.state === "done" ? i.size : i.loaded), 0), 0);
export const anyRunning = () => state.jobs.some((j) => j.running);

function guard() {
  const h = (e: BeforeUnloadEvent) => { if (anyRunning()) { e.preventDefault(); e.returnValue = ""; } };
  if (!guardOn && typeof window !== "undefined") { window.addEventListener("beforeunload", h); guardOn = true; }
  if (!speedTimer) {
    sample = { t: Date.now(), b: totalBytesSent() };
    speedTimer = setInterval(() => {
      if (!anyRunning()) { if (speedTimer) { clearInterval(speedTimer); speedTimer = null; } state = { ...state, speed: 0 }; emit(); return; }
      const now = Date.now(), b = totalBytesSent(), dt = (now - sample.t) / 1000;
      if (dt >= 1) { const inst = Math.max(0, (b - sample.b) / dt); state = { ...state, speed: state.speed ? state.speed * 0.6 + inst * 0.4 : inst }; sample = { t: now, b }; emit(); }
    }, 500);
  }
}

function putChunk(url: string, blob: Blob, start: number, total: number, onLoaded: (n: number) => void, hold: (x: XMLHttpRequest) => void) {
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

async function uploadFile(file: File, sessionUrl: string, onLoaded: (n: number) => void, hold: (x: XMLHttpRequest) => void, stopped: () => boolean): Promise<string> {
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

async function processItem(jid: number, iid: number) {
  const k = key(jid, iid), j = job(jid), f = files.get(k);
  if (!j || !f) return;
  const target = { customerId: j.customerId, bookingId: j.bookingId };
  patchItem(jid, iid, { state: "up", loaded: 0, error: undefined });
  try {
    const s = await startDriveUpload(target, f.name, f.type, f.size);
    if (!s.ok) throw new Error(s.error);
    const fid = await uploadFile(f, s.sessionUrl, (l) => patchItem(jid, iid, { loaded: Math.min(l, f.size) }), (x) => xhrs.set(k, x), () => stops.has(k));
    patchItem(jid, iid, { state: "saving", loaded: f.size });
    const done = await finishDriveUpload(target, fid, f.type.startsWith("video/") ? "video" : j.kind);
    if (!done.ok) throw new Error(done.error);
    patchItem(jid, iid, { state: "done" });
    files.delete(k);
  } catch (e) {
    if (e instanceof Stopped || stops.has(k)) patchItem(jid, iid, { state: "stop", error: "Dibatalkan." });
    else patchItem(jid, iid, { state: "err", error: e instanceof Error ? e.message : "Gagal." });
  } finally { xhrs.delete(k); }
}

async function finishJob(jid: number) {
  const j = job(jid);
  if (!j) return;
  const ok = j.items.some((i) => i.state === "done");
  patchJob(jid, { running: false });
  doneListeners.forEach((l) => l());
  if (ok && j.auto && !j.share) {
    patchJob(jid, { share: { state: "wait" } });
    const r = await autoShareFolder({ customerId: j.customerId, bookingId: j.bookingId });
    patchJob(jid, { share: r.ok ? { state: "ok", url: r.url, title: r.title } : { state: "err", error: r.error } });
    doneListeners.forEach((l) => l());
  }
}

function pump() {
  while (active < PARALLEL && queue.length) {
    const next = queue.shift()!;
    const j = job(next.jobId);
    const it = j?.items.find((x) => x.id === next.itemId);
    if (!j || !it || it.state === "stop") { maybeFinish(next.jobId); continue; }
    active++;
    void processItem(next.jobId, next.itemId).finally(() => { active--; maybeFinish(next.jobId); pump(); });
  }
}
function maybeFinish(jid: number) {
  const j = job(jid);
  if (!j || !j.running) return;
  const pending = j.items.some((i) => i.state === "wait" || i.state === "up" || i.state === "saving") || queue.some((q) => q.jobId === jid);
  if (!pending) void finishJob(jid);
}

/** Tambah file ke antrean (membuat pekerjaan baru). Mengembalikan id pekerjaan. */
export function enqueue(a: EnqueueArgs): number {
  const jid = nextJob++;
  const items: UpItem[] = a.files.map((f) => { const id = nextItem++; files.set(key(jid, id), f); return { id, name: f.name, size: f.size, loaded: 0, state: "wait" as ItemState }; });
  state = { ...state, jobs: [...state.jobs, { id: jid, customerId: a.customerId, customerName: a.customerName, customerPhone: a.customerPhone, bookingId: a.bookingId, bookingLabel: a.bookingLabel, kind: a.kind, auto: a.auto, items, running: true, share: null, createdAt: Date.now(), dismissed: false }] };
  emit();
  guard();
  items.forEach((i) => queue.push({ jobId: jid, itemId: i.id }));
  pump();
  return jid;
}

export function stopItem(jid: number, iid: number) {
  const k = key(jid, iid);
  stops.add(k);
  xhrs.get(k)?.abort();
  const it = job(jid)?.items.find((x) => x.id === iid);
  if (it?.state === "wait") { patchItem(jid, iid, { state: "stop", error: "Dibatalkan." }); maybeFinish(jid); }
}
export function stopJob(jid: number) { job(jid)?.items.filter((i) => i.state === "wait" || i.state === "up").forEach((i) => stopItem(jid, i.id)); }

export function retryItems(jid: number, ids?: number[]) {
  const j = job(jid);
  if (!j) return;
  const list = j.items.filter((i) => (i.state === "err" || i.state === "stop") && (!ids || ids.includes(i.id)) && files.has(key(jid, i.id)));
  if (!list.length) return;
  list.forEach((i) => { stops.delete(key(jid, i.id)); patchItem(jid, i.id, { state: "wait", loaded: 0, error: undefined }); queue.push({ jobId: jid, itemId: i.id }); });
  patchJob(jid, { running: true, share: j.share?.state === "ok" ? j.share : null });
  guard();
  pump();
}

export function dismissJob(jid: number) {
  const j = job(jid);
  if (!j || j.running) return;
  j.items.forEach((i) => files.delete(key(jid, i.id)));
  state = { ...state, jobs: state.jobs.filter((x) => x.id !== jid) };
  emit();
}
export const dismissFinished = () => state.jobs.filter((j) => !j.running).forEach((j) => dismissJob(j.id));
