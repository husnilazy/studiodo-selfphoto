import type { ReactNode } from "react";
import { compact, rupiah } from "@/lib/format";

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-xl md:text-2xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Satu sel statistik. Taruh di dalam <div className="statgrid …"> agar tampil sebagai satu panel bergaris. */
export function Stat({ label, value, sub, tone, big }: { label: string; value: string; sub?: ReactNode; tone?: "ok" | "bad" | "warn"; big?: boolean }) {
  const c = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "";
  // Nominal ≥ Rp 100 jt ditampilkan ringkas ("Rp 349,3 jt") seperti Ethena; angka penuh ada di tooltip.
  const m = /^(-?)Rp ([\d.]+)$/.exec(value);
  const n = m ? Number(m[2].replace(/\./g, "")) : 0;
  const shown = m && n >= 1e8 ? `${m[1]}Rp ${compact(n)}` : value;
  const small = m && n >= 1e6 ? `${m[1]}Rp ${compact(n)}` : value; // layar sempit: selalu ringkas dari 1 jt
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5" title={shown !== value ? value : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className={`stat-value tnum mt-2 whitespace-nowrap leading-tight ${big ? "text-xl sm:text-[1.75rem]" : "text-lg sm:text-2xl"} ${c}`}>
        <span className="sm:hidden">{small}</span><span className="hidden sm:inline">{shown}</span>
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Money({ n, signed }: { n: number; signed?: boolean }) {
  return <span className={`tnum ${signed ? (n < 0 ? "text-bad" : n > 0 ? "text-ok" : "") : ""}`}>{rupiah(n)}</span>;
}

export function Pill({ children, tone = "info" }: { children: ReactNode; tone?: "ok" | "bad" | "warn" | "info" }) {
  const m = { ok: "bg-ok/12 text-ok", bad: "bg-bad/12 text-bad", warn: "bg-warn/12 text-warn", info: "bg-info/12 text-info" } as const;
  return <span className={`pill ${m[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card card-pad text-center text-sm text-muted">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

export function CompanyDot({ color }: { color: string }) {
  return <i className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

/** Judul bagian dengan keterangan kecil di kanan, seperti "Last Updated" di Ethena. */
export function SectionHead({ title, note, right }: { title: string; note?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div><h2 className="font-display text-base">{title}</h2>{note && <p className="mt-0.5 text-xs text-muted">{note}</p>}</div>
      {right}
    </div>
  );
}
