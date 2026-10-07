// Operasi murni pada halaman desain (dipakai UI editor). Semua fungsi mengembalikan halaman baru.
import { photosInLayout, type LayoutId, type Pic } from "./layouts";
import { newPhoto, uid, type FrameLayer, type Layer, type Page, type PhotoLayer, type Slot } from "./types";

export type FrameInfo = { id?: number; url: string; w: number; h: number; slots: Slot[] };

export const frameOf = (p: Page) => p.layers.find((l): l is FrameLayer => l.type === "frame");
export const isSlotPhoto = (l: Layer): l is PhotoLayer => l.type === "photo" && l.slot !== undefined;
export const picOf = (l: PhotoLayer): Pic => ({ src: l.src, nw: l.nw, nh: l.nh, name: l.name });

/** Daftar nomor slot yang belum berisi foto. */
export function emptySlots(p: Page): number[] {
  const f = frameOf(p);
  if (!f) return [];
  const used = new Set(p.layers.filter(isSlotPhoto).map((l) => l.slot));
  return f.slots.map((_, i) => i).filter((i) => !used.has(i));
}

function slotLayer(pic: Pic, slot: Slot, idx: number, fw: number, fh: number, p: Page): PhotoLayer {
  const sx = p.w / fw, sy = p.h / fh;
  return newPhoto(pic.src, pic.nw, pic.nh, { x: slot.x * sx, y: slot.y * sy, w: slot.w * sx, h: slot.h * sy }, { slot: idx, name: pic.name });
}

/** Sisipkan layer: foto slot selalu di bawah frame, sisanya di paling atas. */
function insert(p: Page, l: Layer): Page {
  const fi = p.layers.findIndex((x) => x.type === "frame");
  const layers = [...p.layers];
  if (isSlotPhoto(l) && fi >= 0) layers.splice(fi, 0, l); else layers.push(l);
  return { ...p, layers };
}

/** Pasang frame: ukuran halaman mengikuti frame, foto yang sudah ada (di slot maupun bebas) dipindah ke slot berurutan. */
export function applyFrame(p: Page, fr: FrameInfo, extra: Pic[] = []): Page {
  const photos = p.layers.filter((l): l is PhotoLayer => l.type === "photo");
  const others = p.layers.filter((l) => l.type !== "photo" && l.type !== "frame");
  const queue: Pic[] = [...photos.sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99)).map(picOf), ...extra];
  let page: Page = { ...p, w: fr.w, h: fr.h, layers: [] };
  const frame: FrameLayer = { id: uid(), type: "frame", src: fr.url, slots: fr.slots, fw: fr.w, fh: fr.h, x: 0, y: 0, w: fr.w, h: fr.h, rot: 0, opacity: 1, locked: true, name: "Frame" };
  fr.slots.forEach((s, i) => { if (queue[i]) page.layers.push(slotLayer(queue[i], s, i, fr.w, fr.h, page)); });
  page.layers.push(frame, ...others);
  return page;
}
export const removeFrame = (p: Page): Page => ({ ...p, layers: p.layers.filter((l) => l.type !== "frame").map((l) => (isSlotPhoto(l) ? { ...l, slot: undefined } : l)) });

export function assignToSlot(p: Page, idx: number, pic: Pic): Page {
  const f = frameOf(p);
  if (!f || !f.slots[idx]) return p;
  const without = { ...p, layers: p.layers.filter((l) => !(isSlotPhoto(l) && l.slot === idx)) };
  return insert(without, slotLayer(pic, f.slots[idx], idx, f.fw, f.fh, p));
}

export function fillEmptySlots(p: Page, pics: Pic[], repeatOne = false): Page {
  let page = p;
  const empties = emptySlots(p);
  empties.forEach((s, i) => { const pic = repeatOne ? pics[0] : pics[i]; if (pic) page = assignToSlot(page, s, pic); });
  return page;
}

/** Tambah foto bebas di tengah halaman (atau isi slot kosong pertama bila ada frame). */
export function addPhoto(p: Page, pic: Pic): { page: Page; id: string } {
  const empty = emptySlots(p)[0];
  if (empty !== undefined) {
    const page = assignToSlot(p, empty, pic);
    return { page, id: page.layers.find((l) => isSlotPhoto(l) && l.slot === empty)!.id };
  }
  const w = p.w * 0.62, h = Math.min(p.h * 0.62, w * (pic.nh / pic.nw));
  const l = newPhoto(pic.src, pic.nw, pic.nh, { x: (p.w - w) / 2, y: (p.h - h) / 2, w, h }, { name: pic.name });
  return { page: insert(p, l), id: l.id };
}

/** Susun ulang semua foto bebas dengan layout tertentu (foto tambahan dari `extra` ikut dipakai). */
export function reflow(p: Page, layout: LayoutId, extra: Pic[] = [], margin = 0.05): Page {
  const free = p.layers.filter((l): l is PhotoLayer => l.type === "photo" && l.slot === undefined);
  const pics = extra.length ? extra : free.map(picOf);
  const keep = p.layers.filter((l) => !(l.type === "photo" && l.slot === undefined));
  const fresh = photosInLayout(pics, layout, p.w, p.h, margin);
  const fi = keep.findIndex((l) => l.type === "frame");
  const layers = fi >= 0 ? [...keep.slice(0, fi), ...keep.slice(fi), ...fresh] : [...fresh, ...keep];
  return { ...p, layers };
}

/** Ubah ukuran halaman; isi diskalakan proporsional (teks mengikuti skala terkecil). */
export function resizePage(p: Page, w: number, h: number): Page {
  const sx = w / p.w, sy = h / p.h, sm = Math.min(sx, sy);
  const layers = p.layers.map((l): Layer => {
    if (l.type === "frame") return { ...l, w, h };
    const base = { ...l, x: l.x * sx, y: l.y * sy, w: l.w * sx, h: l.h * sy };
    return (l.type === "text" ? { ...base, size: l.size * sm } : base) as Layer;
  });
  return { ...p, w, h, layers };
}

export function moveLayer(p: Page, id: string, dir: 1 | -1 | "top" | "bottom"): Page {
  const i = p.layers.findIndex((l) => l.id === id);
  if (i < 0) return p;
  const layers = [...p.layers];
  const [l] = layers.splice(i, 1);
  const f = layers.findIndex((x) => x.type === "frame");
  let to = dir === "top" ? layers.length : dir === "bottom" ? 0 : Math.max(0, Math.min(layers.length, i + dir));
  if (isSlotPhoto(l) && f >= 0) to = Math.min(to, f); // foto slot tidak boleh melewati frame
  layers.splice(to, 0, l);
  return { ...p, layers };
}

export const clonePage = (p: Page): Page => ({ ...JSON.parse(JSON.stringify(p)), id: uid(), layers: p.layers.map((l) => ({ ...JSON.parse(JSON.stringify(l)), id: uid() })) });
