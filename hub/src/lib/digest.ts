import "server-only";
import { buildInsights } from "./insights";
import { cashBalance, summary, type Facts } from "./metrics";
import { addMonths, compact, fullMonth, pct } from "./format";

/** Teks ringkasan untuk dikirim lewat WhatsApp: posisi grup, tiap unit, dan hal yang perlu perhatian. */
export function buildDigest(f: Facts): string {
  const g = summary(f.rows, null, [f.now]), p = summary(f.rows, null, [addMonths(f.now, -1)]);
  const delta = p.revenue > 0 ? ((g.revenue - p.revenue) / p.revenue) * 100 : null;
  const L: string[] = [];
  L.push(`*Frameless Hub · ${fullMonth(f.now)}*`);
  L.push(`Kas grup: Rp ${compact(cashBalance(f.rows, null))}`);
  L.push(`Pendapatan: Rp ${compact(g.revenue)}${delta == null ? "" : ` (${delta >= 0 ? "▲" : "▼"} ${pct(Math.abs(delta))} vs bulan lalu)`}`);
  L.push(`Laba: Rp ${compact(g.profit)} · margin ${pct(g.margin)}`);
  L.push("", "*Per unit*");
  for (const c of f.companies) {
    const s = summary(f.rows, c.id, [f.now]);
    L.push(`• ${c.name}: pendapatan Rp ${compact(s.revenue)}, laba Rp ${compact(s.profit)}, kas Rp ${compact(cashBalance(f.rows, c.id))}`);
  }
  const alerts = buildInsights(f).filter((i) => i.level === "bad" || i.level === "warn").slice(0, 4);
  if (alerts.length) {
    L.push("", "*Perlu perhatian*");
    for (const a of alerts) L.push(`${a.level === "bad" ? "🔴" : "🟠"} ${a.scope}: ${a.title}. ${a.action}`);
  } else L.push("", "✅ Tidak ada peringatan.");
  return L.join("\n");
}
