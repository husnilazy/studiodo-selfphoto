import "server-only";

/**
 * ZIP streaming tanpa kompresi (store) — cocok untuk foto/video yang sudah terkompresi.
 * File dialirkan satu per satu dari sumbernya (tidak ditampung di memori), CRC dihitung sambil lewat,
 * dan ukuran/CRC ditulis di "data descriptor" setelah isi file. Batas: < 4 GB total (tanpa ZIP64).
 */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crcStep = (crc: number, buf: Uint8Array) => { let c = crc; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return c >>> 0; };

const u16 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255]);
const u32 = (n: number) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((a, b) => a + b.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

function dos(d: Date) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export type ZipSource = { name: string; open: () => Promise<{ stream: ReadableStream<Uint8Array> | null; ok: boolean }> };

const FLAGS = 0x0808; // bit 3 = data descriptor, bit 11 = nama UTF-8

/** Nama file unik & aman di dalam ZIP. */
export function zipNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const base = raw.replace(/[\\/:*?"<>|]/g, "-").trim() || "file";
    const n = seen.get(base.toLowerCase()) ?? 0;
    seen.set(base.toLowerCase(), n + 1);
    if (!n) return base;
    const dot = base.lastIndexOf(".");
    return dot > 0 ? `${base.slice(0, dot)} (${n + 1})${base.slice(dot)}` : `${base} (${n + 1})`;
  });
}

export function zipResponseStream(sources: ZipSource[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0, idx = 0, cur: { reader: ReadableStreamDefaultReader<Uint8Array>; crc: number; size: number; name: Uint8Array; start: number; time: number; date: number } | null = null;
  const now = dos(new Date());

  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      const push = (b: Uint8Array) => { ctrl.enqueue(b); offset += b.length; };
      try {
        for (;;) {
          if (cur) {
            const { done, value } = await cur.reader.read();
            if (!done && value) { cur.crc = crcStep(cur.crc, value); cur.size += value.length; push(value); return; }
            const crc = (cur.crc ^ 0xffffffff) >>> 0;
            push(cat(u32(0x08074b50), u32(crc), u32(cur.size), u32(cur.size)));
            central.push(cat(u32(0x02014b50), u16(20), u16(20), u16(FLAGS), u16(0), u16(cur.time), u16(cur.date), u32(crc), u32(cur.size), u32(cur.size),
              u16(cur.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(cur.start), cur.name));
            cur = null;
            continue;
          }
          if (idx >= sources.length) {
            const cdStart = offset;
            const cd = cat(...central);
            push(cd);
            push(cat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cd.length), u32(cdStart), u16(0)));
            ctrl.close();
            return;
          }
          const src = sources[idx++];
          const opened = await src.open().catch(() => ({ stream: null, ok: false }));
          if (!opened.ok || !opened.stream) continue; // lewati file yang gagal diambil
          const name = enc.encode(src.name);
          const start = offset;
          push(cat(u32(0x04034b50), u16(20), u16(FLAGS), u16(0), u16(now.time), u16(now.date), u32(0), u32(0), u32(0), u16(name.length), u16(0), name));
          cur = { reader: opened.stream.getReader(), crc: 0xffffffff, size: 0, name, start, time: now.time, date: now.date };
        }
      } catch (e) { ctrl.error(e); }
    },
    cancel() { void cur?.reader.cancel().catch(() => {}); },
  });
}
