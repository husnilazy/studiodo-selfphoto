"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { layerHeight, renderPage } from "@/lib/editor/render";
import { emptySlots, frameOf, isSlotPhoto } from "@/lib/editor/ops";
import type { Layer, Page, PhotoLayer } from "@/lib/editor/types";

type Gesture =
  | { t: "move"; sx: number; sy: number; l: Layer }
  | { t: "pan"; sx: number; sy: number; l: PhotoLayer }
  | { t: "resize"; l: Layer }
  | { t: "rotate"; l: Layer };

const rad = (d: number) => (d * Math.PI) / 180;

/** Kanvas pratinjau + interaksi: geser, ubah ukuran, putar, geser isi foto, zoom isi dengan roda mouse, snap ke tengah. */
export default function Stage({
  page, imgs, version, selId, cropMode, zoom, onSelect, onChange, onEmptySlot,
}: {
  page: Page; imgs: Map<string, HTMLImageElement>; version: number; selId: string | null; cropMode: boolean; zoom: number;
  onSelect: (id: string | null) => void;
  onChange: (fn: (p: Page) => Page, key: string) => void;
  onEmptySlot: (idx: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.4);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const gesture = useRef<Gesture | null>(null);
  const scale = fit * zoom;
  const sel = page.layers.find((l) => l.id === selId) ?? null;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const calc = () => setFit(Math.floor(Math.max(0.05, Math.min((el.clientWidth - 48) / page.w, (el.clientHeight - 48) / page.h)) * 1000) / 1000);
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [page.w, page.h]);

  // gambar ulang saat halaman / gambar / skala berubah
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(page.w * scale * dpr), h = Math.round(page.h * scale * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const id = requestAnimationFrame(() => renderPage(c.getContext("2d")!, page, scale * dpr, imgs, true));
    return () => cancelAnimationFrame(id);
  }, [page, scale, version, imgs]);

  const toPage = useCallback((e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }, [scale]);

  const hit = (px: number, py: number): Layer | null => {
    for (let i = page.layers.length - 1; i >= 0; i--) {
      const l = page.layers[i];
      if (l.hidden || l.type === "frame") continue;
      const h = layerHeight(l), cx = l.x + l.w / 2, cy = l.y + h / 2;
      const a = rad(-l.rot), dx = px - cx, dy = py - cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= l.w / 2 && Math.abs(ly) <= h / 2) return l;
    }
    return null;
  };

  const update = (id: string, patch: Partial<Layer>, key: string) =>
    onChange((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }), key);

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = toPage(e);
    const l = hit(p.x, p.y);
    onSelect(l?.id ?? null);
    if (!l || l.locked) return;
    stage.current!.setPointerCapture(e.pointerId);
    gesture.current = l.type === "photo" && (l.slot !== undefined || cropMode)
      ? { t: "pan", sx: p.x, sy: p.y, l } : { t: "move", sx: p.x, sy: p.y, l };
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const p = toPage(e);
    if (g.t === "move") {
      let x = g.l.x + (p.x - g.sx), y = g.l.y + (p.y - g.sy);
      const h = layerHeight(g.l), thr = 7 / scale;
      // garis bantu pintar: tepi/tengah halaman dan elemen lain
      const others = page.layers.filter((o) => o.id !== g.l.id && !o.hidden && o.type !== "frame" && !(o.w >= page.w && layerHeight(o) >= page.h));
      const vl = [0, page.w / 2, page.w, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
      const hl = [0, page.h / 2, page.h, ...others.flatMap((o) => { const oh = layerHeight(o); return [o.y, o.y + oh / 2, o.y + oh]; })];
      const snap = (edges: number[], lines: number[]) => {
        let best: { d: number; line: number } | null = null;
        for (const e of edges) for (const ln of lines) { const d = ln - e; if (Math.abs(d) < thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: ln }; }
        return best;
      };
      const sx = snap([x, x + g.l.w / 2, x + g.l.w], vl), sy = snap([y, y + h / 2, y + h], hl);
      if (sx) x += sx.d;
      if (sy) y += sy.d;
      setGuides({ v: sx ? [sx.line] : [], h: sy ? [sy.line] : [] });
      update(g.l.id, { x, y }, `move-${g.l.id}`);
    } else if (g.t === "pan") {
      const l = g.l, dx = p.x - g.sx, dy = p.y - g.sy;
      const s0 = l.fit === "cover" ? Math.max(l.w / l.nw, l.h / l.nh) : Math.min(l.w / l.nw, l.h / l.nh);
      const dw = l.nw * s0 * l.zoom, dh = l.nh * s0 * l.zoom;
      const fx = Math.max(1, (dw - l.w) / 2), fy = Math.max(1, (dh - l.h) / 2);
      // gerakan pointer dalam sumbu lokal layer (memperhitungkan rotasi)
      const a = rad(-l.rot), lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const k = l.flipX ? -1 : 1;
      update(l.id, { ox: Math.max(-1, Math.min(1, l.ox - (k * lx) / fx)), oy: Math.max(-1, Math.min(1, l.oy - ly / fy)) } as Partial<Layer>, `pan-${l.id}`);
    } else if (g.t === "resize") {
      const l = g.l, h = layerHeight(l), cx = l.x + l.w / 2, cy = l.y + h / 2;
      const a = rad(-l.rot), dx = p.x - cx, dy = p.y - cy;
      const lx = Math.abs(dx * Math.cos(a) - dy * Math.sin(a)), ly = Math.abs(dx * Math.sin(a) + dy * Math.cos(a));
      const k = Math.max(0.05, Math.max(lx / (l.w / 2), ly / (h / 2)));
      const nw = l.w * k, nh = h * k;
      if (l.type === "text") update(l.id, { w: nw, x: cx - nw / 2, y: cy - (h * k) / 2, size: l.size * k } as Partial<Layer>, `rs-${l.id}`);
      else update(l.id, { w: nw, h: nh, x: cx - nw / 2, y: cy - nh / 2 }, `rs-${l.id}`);
    } else if (g.t === "rotate") {
      const l = g.l, h = layerHeight(l), cx = l.x + l.w / 2, cy = l.y + h / 2;
      let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (e.shiftKey || Math.abs(deg - Math.round(deg / 15) * 15) < 3) deg = Math.round(deg / 15) * 15;
      update(l.id, { rot: Math.round(deg * 10) / 10 }, `rot-${l.id}`);
    }
  };
  const up = () => { gesture.current = null; setGuides({ v: [], h: [] }); };

  const startHandle = (t: "resize" | "rotate") => (e: React.PointerEvent) => {
    if (!sel) return;
    e.stopPropagation();
    stage.current!.setPointerCapture(e.pointerId);
    gesture.current = { t, l: sel };
  };

  // roda mouse: zoom isi foto yang dipilih (slot / mode atur isi)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || !sel || sel.type !== "photo") return;
      if (!(isSlotPhoto(sel) || cropMode)) return;
      const r = stage.current!.getBoundingClientRect();
      const px = (e.clientX - r.left) / scale, py = (e.clientY - r.top) / scale;
      if (hit(px, py)?.id !== sel.id) return;
      e.preventDefault();
      update(sel.id, { zoom: Math.max(1, Math.min(6, +(sel.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)).toFixed(3))) } as Partial<Layer>, `zoom-${sel.id}`);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, cropMode, scale, page]);

  const empties = emptySlots(page);
  const fr = frameOf(page);
  const selH = sel ? layerHeight(sel) : 0;

  return (
    <div ref={wrap} className="editor-checker relative grid min-h-0 flex-1 place-items-center overflow-auto p-4">
      <div ref={stage} className="relative shrink-0 shadow-2xl ring-1 ring-black/20" style={{ width: page.w * scale, height: page.h * scale, touchAction: "none", cursor: gesture.current ? "grabbing" : "default" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <canvas ref={canvas} className="absolute inset-0 size-full" />

        {/* slot kosong */}
        {fr && empties.map((i) => {
          const s = fr.slots[i], sx = page.w / fr.fw, sy = page.h / fr.fh;
          return (
            <button key={i} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => onEmptySlot(i)}
              className="absolute grid place-items-center border-2 border-dashed border-accent/80 bg-accent/10 text-xs font-bold text-accent transition hover:bg-accent/25"
              style={{ left: s.x * sx * scale, top: s.y * sy * scale, width: s.w * sx * scale, height: s.h * sy * scale }}>
              <span className="rounded-full bg-black/55 px-2 py-0.5 text-white">+ Foto {i + 1}</span>
            </button>
          );
        })}

        {guides.v.map((x) => <i key={`v${x}`} className="pointer-events-none absolute inset-y-0 w-px bg-fuchsia-500" style={{ left: x * scale }} />)}
        {guides.h.map((y) => <i key={`h${y}`} className="pointer-events-none absolute inset-x-0 h-px bg-fuchsia-500" style={{ top: y * scale }} />)}

        {/* kotak seleksi */}
        {sel && !sel.locked && (
          <div className="pointer-events-none absolute" style={{ left: sel.x * scale, top: sel.y * scale, width: sel.w * scale, height: selH * scale, transform: `rotate(${sel.rot}deg)`, transformOrigin: "center" }}>
            <div className="absolute inset-0 border-2 border-accent" />
            {(["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"]).map((pos) => (
              <i key={pos} onPointerDown={startHandle("resize")} className={`pointer-events-auto absolute size-3.5 cursor-nwse-resize rounded-full border-2 border-accent bg-white ${pos}`} />
            ))}
            <i onPointerDown={startHandle("rotate")} title="Putar" className="pointer-events-auto absolute -top-8 left-1/2 size-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-accent bg-white" />
            <i className="pointer-events-none absolute -top-4 left-1/2 h-4 w-px -translate-x-1/2 bg-accent" />
          </div>
        )}
      </div>
    </div>
  );
}
