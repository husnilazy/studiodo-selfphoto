"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import { addonsTotal, eventHours, eventTotal, freeNow, parseEventAddons, parseOutputs, type EventRule } from "@/lib/packageUtils";
import { rupiah, waLink } from "@/lib/format";

/**
 * Tombol "Hitung & tanya" untuk paket sewa event: pilih durasi, output, dan tambahan, lihat estimasi, lanjut bertanya lewat WhatsApp.
 * Bonus FREE yang sudah berlaku otomatis ikut; bonus bersyarat (mis. "FREE bila sewa 6 jam") jadi pancingan menambah durasi.
 */
export default function EventInquiry({ name, rule, addons: addonsRaw = "", whatsapp, studioName }: { name: string; rule: EventRule; addons?: string; whatsapp: string; studioName: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const range = eventHours(rule);
  const outputs = useMemo(() => parseOutputs(rule.outputs), [rule.outputs]);
  const all = useMemo(() => parseEventAddons(addonsRaw), [addonsRaw]);
  const [hours, setHours] = useState(range.min);
  const [out, setOut] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const delta = outputs[out]?.delta ?? 0;
  const total = eventTotal(rule, hours, delta) + addonsTotal(all, picked, hours);

  const idx = all.map((a, i) => ({ a, i }));
  const bonus = idx.filter(({ a }) => freeNow(a, hours));
  const options = idx.filter(({ a }) => !freeNow(a, hours)); // berbayar, atau bonus yang belum terbuka (dikenai harga normal)
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const chosen = picked.filter((i) => all[i] && !freeNow(all[i], hours)).map((i) => `${all[i].label} (+${rupiah(all[i].price)})`);
  const msg = [
    `Halo ${studioName}, saya tertarik sewa ${name}.`,
    `Durasi: ${hours} jam`,
    outputs[out] ? `Output: ${outputs[out].label}` : "",
    chosen.length ? `Tambahan: ${chosen.join(", ")}` : "",
    bonus.length ? `Bonus FREE: ${bonus.map(({ a }) => a.label).join(", ")}` : "",
    `Estimasi: ${rupiah(total)}`,
  ].filter(Boolean).join("\n") + "\n\nTanggal & lokasi acara: ";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary !min-h-10 !rounded-full !px-5">Hitung & tanya</button>
      {open && mounted && createPortal(
        // Dirender di akar .site (bukan di dalam kartu): kartu punya transformasi, yang membuat posisi `fixed` relatif ke kartu. Akar .site tetap mewariskan warna & font tema.
        <div className="anim-fade fixed inset-0 z-[60] grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={`Sewa ${name}`}>
          <div className="pop-in glass max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Sewa event</p>
                <h3 className="font-display mt-1 text-xl font-semibold leading-tight">{name}</h3>
              </div>
              <button type="button" className="btn !min-h-10 !w-10 !rounded-full !px-0" onClick={() => setOpen(false)} aria-label="Tutup"><Icon name="x" /></button>
            </div>

            <p className="mb-2 text-sm font-bold">Durasi sewa</p>
            <div className="flex items-center gap-3">
              <button type="button" className="btn !min-h-10 !w-10 !rounded-full !px-0 text-lg" onClick={() => setHours((h) => Math.max(range.min, h - 1))} disabled={hours <= range.min} aria-label="Kurangi jam">−</button>
              <span className="font-display w-20 text-center text-2xl font-semibold">{hours} jam</span>
              <button type="button" className="btn !min-h-10 !w-10 !rounded-full !px-0 text-lg" onClick={() => setHours((h) => Math.min(range.max, h + 1))} disabled={hours >= range.max} aria-label="Tambah jam">+</button>
            </div>
            <p className="mt-2 text-xs text-muted">{rupiah(rule.price)} untuk {range.min} jam{rule.extra_hour_price > 0 ? `, lalu +${rupiah(rule.extra_hour_price)} tiap jam tambahan` : ""} (maks {range.max} jam).</p>

            {outputs.length > 0 && (
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-bold">Output</legend>
                <div className="space-y-2">
                  {outputs.map((o, i) => (
                    <label key={o.label} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3 transition has-[:checked]:border-accent has-[:checked]:bg-accentsoft">
                      <span className="flex items-center gap-2.5">
                        <input type="radio" name="event-output" checked={out === i} onChange={() => setOut(i)} className="size-4 accent-[var(--accent)]" />
                        <span className="text-sm font-semibold">{o.label}</span>
                      </span>
                      <span className="tnum text-xs font-semibold text-muted">{o.delta === 0 ? "termasuk" : `${o.delta > 0 ? "+" : "−"}${rupiah(Math.abs(o.delta))}`}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {bonus.length > 0 && (
              <div className="mt-5 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 p-3 ring-1 ring-amber-400/40">
                <p className="mb-2 text-sm font-extrabold">🎁 Bonus FREE untukmu</p>
                <ul className="space-y-1.5">
                  {bonus.map(({ a, i }) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span className="flex items-center gap-2"><Icon name="check" className="size-4 text-ok" />{a.label}</span>
                      <span className="flex items-center gap-2 text-xs">{a.price > 0 && <s className="text-muted">{rupiah(a.price)}</s>}<span className="rounded-full bg-amber-400 px-2 py-0.5 font-extrabold text-black">FREE</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {options.length > 0 && (
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-bold">Tambahan (opsional)</legend>
                <div className="space-y-2">
                  {options.map(({ a, i }) => (
                    <div key={i}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3 transition has-[:checked]:border-accent has-[:checked]:bg-accentsoft">
                        <span className="flex items-center gap-2.5">
                          <input type="checkbox" checked={picked.includes(i)} onChange={() => toggle(i)} className="size-4 accent-[var(--accent)]" />
                          <span className="text-sm font-semibold">{a.label}</span>
                        </span>
                        <span className="tnum text-xs font-semibold text-muted">+{rupiah(a.price)}</span>
                      </label>
                      {a.free && a.min_hours > hours && a.min_hours <= range.max && (
                        <button type="button" onClick={() => setHours(a.min_hours)} className="mt-1 w-full rounded-lg bg-amber-400/15 px-3 py-1.5 text-left text-xs font-bold text-amber-500 transition hover:bg-amber-400/25">
                          🎁 Sewa {a.min_hours} jam → {a.label} jadi FREE. <span className="underline">Jadikan {a.min_hours} jam</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="mt-6 flex items-end justify-between border-t border-line pt-5">
              <span className="font-semibold text-muted">Estimasi total</span>
              <span className="font-display tnum text-3xl font-bold text-accent">{rupiah(total)}</span>
            </div>
            <p className="mt-2 text-xs text-muted">Estimasi awal. Biaya transport atau kebutuhan khusus dikonfirmasi saat kita ngobrol.</p>

            {whatsapp
              ? <a href={waLink(whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-hero btn-glow mt-5 w-full"><Icon name="chat" className="size-5" /> Tanya lewat WhatsApp</a>
              : <p className="mt-5 rounded-xl bg-accentsoft p-3 text-center text-sm font-semibold text-accent">Hubungi kami langsung untuk memesan.</p>}
          </div>
        </div>,
        document.querySelector<HTMLElement>(".site") ?? document.body,
      )}
    </>
  );
}
