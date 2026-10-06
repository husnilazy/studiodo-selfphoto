import Link from "next/link";
import Icon from "./Icon";

export function PageHeader({
  title, subtitle, actions, back,
}: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: string }) {
  return (
    <div className="anim-rise mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg">
            <Icon name="left" className="size-3.5" /> Kembali
          </Link>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = "slate", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Stat({
  label, value, hint, tone, icon,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ok" | "bad" | "accent"; icon?: string }) {
  const color = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : tone === "accent" ? "text-accent" : "";
  return (
    <div className="card anim-rise p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {icon && <span className="grid size-8 place-items-center rounded-xl bg-accentsoft text-accent"><Icon name={icon} className="size-4" /></span>}
      </div>
      <p className={`font-display tnum mt-1 text-xl font-semibold sm:text-2xl ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name="camera" className="size-6" /></span>
      <p className="font-display font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Field({
  label, children, hint, className = "",
}: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-2xl border border-line bg-panel p-1">
        {items.map((t) => (
          <Link key={t.key} href={t.href} scroll={false}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${active === t.key ? "bg-accent text-accentfg shadow" : "text-muted hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Money({ v, className = "" }: { v: number; className?: string }) {
  const s = Math.round(v).toLocaleString("id-ID");
  return <span className={`tnum ${className}`}>{v < 0 ? `(${s.replace("-", "")})` : s}</span>;
}
