"use client";
import { useActionState, useEffect, useState } from "react";
import { saveSharedCost, setCoverMonths } from "@/app/actions-hr";

type Co = { slug: string; name: string };
type Res = { ok?: string; error?: string } | null;

/** Form atur porsi: terkunci setelah tersimpan, bisa dibuka lagi lewat "Ubah". Ada total % langsung dan status simpan. */
export function SharedCostForm({ companies, cfg, choices, configured }: {
  companies: Co[];
  cfg: { host: string; categories: string[]; pct: Record<string, number> };
  choices: readonly (readonly [string, string])[];
  configured: boolean;
}) {
  const [res, act, pending] = useActionState<Res, FormData>(saveSharedCost, null);
  const [locked, setLocked] = useState(configured);
  const [pct, setPct] = useState<Record<string, string>>(() => Object.fromEntries(companies.map((c) => [c.slug, String(cfg.pct[c.slug] ?? 0)])));
  const total = Math.round(Object.values(pct).reduce((a, v) => a + (Number(v) || 0), 0) * 100) / 100;
  const okTotal = Math.round(total * 100) === 10000;

  useEffect(() => { if (res?.ok) setLocked(true); }, [res]);

  return (
    <form action={act} className="space-y-4">
      <fieldset disabled={locked || pending} className="space-y-4 disabled:opacity-70">
        <div className="grid gap-3 sm:grid-cols-4">
          {companies.map((c) => (
            <label key={c.slug} className="block"><span className="label">{c.name} (%)</span>
              <input name={`pct_${c.slug}`} type="number" step="0.5" min={0} max={100} value={pct[c.slug]} onChange={(e) => setPct((p) => ({ ...p, [c.slug]: e.target.value }))} className="input tnum" /></label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Unit yang membayar (host)</span>
            <select name="host" defaultValue={cfg.host} className="input">{companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <div><span className="label">Kategori biaya yang dibagi</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">{choices.map(([k, l]) => (
              <label key={k} className="inline-flex items-center gap-2"><input type="checkbox" name={`cat_${k}`} defaultChecked={cfg.categories.includes(k)} className="size-4 accent-[var(--accent)]" />{l}</label>))}</div></div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`tnum text-sm ${okTotal ? "text-ok" : "text-bad"}`}>Total {total}% {okTotal ? "✓" : "— harus 100%"}</span>
        {locked ? (
          <button type="button" className="btn" onClick={() => setLocked(false)}>Ubah porsi</button>
        ) : (
          <>
            <button className="btn btn-primary" disabled={pending || !okTotal}>{pending ? "Menyimpan…" : "Simpan porsi"}</button>
            {configured && <button type="button" className="btn" disabled={pending} onClick={() => setLocked(true)}>Batal</button>}
          </>
        )}
        {locked && res?.ok && <span className="rounded-full bg-ok/15 px-3 py-1 text-sm text-ok" role="status">✓ {res.ok} Terkunci — klik “Ubah porsi” untuk mengubah lagi.</span>}
        {locked && !res?.ok && configured && <span className="text-xs text-muted">Terkunci agar tidak berubah tidak sengaja.</span>}
        {res?.error && <span className="rounded-lg bg-bad/15 px-3 py-1.5 text-sm text-bad" role="alert">{res.error}</span>}
      </div>
    </form>
  );
}

/** Ubah "berlaku untuk berapa bulan" satu pembayaran, dengan status simpan. */
export function CoverForm({ id, cover }: { id: number; cover: number }) {
  const [res, act, pending] = useActionState<Res, FormData>(setCoverMonths, null);
  const [v, setV] = useState(String(cover));
  const dirty = Number(v) !== cover;
  return (
    <form action={act} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input name="cover" type="number" min={1} max={60} value={v} onChange={(e) => setV(e.target.value)} className="input tnum !min-h-8 w-16 !px-2 text-right" aria-label="Berlaku untuk berapa bulan" />
      <span className="text-xs text-muted">bln</span>
      <button className="btn !min-h-8 !px-3 text-xs" disabled={pending || (!dirty && !res?.error)}>{pending ? "…" : res?.ok && !dirty ? "✓ Tersimpan" : "Simpan"}</button>
      {res?.error && <span className="text-xs text-bad" role="alert">{res.error}</span>}
    </form>
  );
}
