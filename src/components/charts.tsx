import { rupiah } from "@/lib/format";

/** Diagram batang sederhana (SVG, tanpa library). */
export function BarChart({ data, height = 180 }: { data: { label: string; value: number }[]; height?: number }) {
  const W = 640, H = height, padB = 26, padT = 10;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grafik pemasukan harian">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={padT + (H - padB - padT) * (1 - f)} y2={padT + (H - padB - padT) * (1 - f)} stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * (H - padB - padT));
        const x = i * bw + bw * 0.18, w = bw * 0.64;
        return (
          <g key={i}>
            <title>{`${d.label}: ${rupiah(d.value)}`}</title>
            <rect x={x} y={H - padB - h} width={w} height={h} rx={Math.min(6, w / 2)} fill="var(--accent)" opacity={d.value > 0 ? 1 : 0.2} />
            {(data.length <= 10 || i % 2 === 0) && (
              <text x={i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Daftar batang horizontal dengan nilai. */
export function HBars({ rows, format = rupiah }: { rows: { label: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{r.label}{r.sub && <span className="font-normal text-muted"> · {r.sub}</span>}</span>
            <span className="tnum shrink-0 font-semibold">{format(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
