import { compact } from "@/lib/format";

export type Series = { name: string; color: string; values: number[] };

/** Grafik garis/area multi-seri (SVG murni): garis tipis, grid titik-titik, label sumbu redup. */
export function TrendChart({ labels, series, height = 220, area = true, fit = false }: { labels: string[]; series: Series[]; height?: number; area?: boolean; fit?: boolean }) {
  const W = 720, H = height, L = 46, R = 10, T = 12, B = 26;
  const all = series.flatMap((s) => s.values);
  const hi = Math.max(1, ...all), lo = Math.min(...all);
  // fit: sumbu Y mengikuti rentang data (untuk saldo kas) supaya selisih antar skenario terlihat.
  const pad = (hi - lo) * 0.12 || hi * 0.1;
  const max = fit ? hi + pad : hi, min = fit ? lo - pad : Math.min(0, lo);
  const x = (i: number) => L + (labels.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (labels.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
  const uid = series.map((s) => s.color.replace("#", "")).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik tren">
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`g${uid}${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity=".16" /><stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--line)" />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="1 4" strokeLinecap="round" />
          <text x={L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">{compact(t)}</text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fill="var(--muted)">{l}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
        const line = "M" + pts.join(" L");
        return (
          <g key={si}>
            {area && s.values.length > 1 && <path d={`${line} L${x(s.values.length - 1)},${y(min)} L${x(0)},${y(min)} Z`} fill={`url(#g${uid}${si})`} />}
            <path d={line} fill="none" stroke={s.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="9" fill="transparent"><title>{`${s.name} · ${labels[i]}: ${compact(v)}`}</title></circle>
            ))}
            <circle cx={x(s.values.length - 1)} cy={y(s.values.at(-1) ?? 0)} r="2.6" fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}

/** Batang bertumpuk per bulan (mis. pendapatan per perusahaan). */
export function StackedBars({ labels, series, height = 220 }: { labels: string[]; series: Series[]; height?: number }) {
  const W = 720, H = height, L = 46, R = 10, T = 12, B = 26;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const bw = (W - L - R) / labels.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pendapatan per perusahaan">
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--line)" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeDasharray="1 4" strokeLinecap="round" />
          <text x={L - 8} y={y(max * f) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">{compact(max * f)}</text>
        </g>
      ))}
      {labels.map((l, i) => {
        let acc = 0;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const v = Math.max(0, s.values[i] ?? 0);
              if (v <= 0) return null;
              const top = y(acc + v), h = y(acc) - top;
              acc += v;
              return <rect key={si} x={L + i * bw + bw * 0.24} y={top} width={bw * 0.52} height={Math.max(1, h - 1)} rx="2" fill={s.color} opacity=".92"><title>{`${s.name} · ${l}: ${compact(v)}`}</title></rect>;
            })}
            <text x={L + i * bw + bw / 2} y={H - 7} textAnchor="middle" fontSize="10" fill="var(--muted)">{l}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ parts, size = 150, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const r = 54, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="13" />
        {total > 0 && parts.map((p, i) => {
          const len = (Math.max(0, p.value) / total) * c;
          const el = <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="13" strokeDasharray={`${Math.max(0, len - 2.5)} ${c}`} strokeDashoffset={-off}><title>{`${p.label}: ${compact(p.value)}`}</title></circle>;
          off += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}

export function Progress({ value, color = "var(--accent)", over }: { value: number; color?: string; over?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(1.5, value))}%`, background: over ? "var(--bad)" : color }} />
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {items.map((i) => <span key={i.label} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px]" style={{ background: i.color }} />{i.label}</span>)}
    </div>
  );
}
