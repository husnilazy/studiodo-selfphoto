import "server-only";
import { one } from "./db";
import { profitShare, type Company, type Facts } from "./metrics";
import { DEFAULT_RATE_CARD, type RateCard } from "./ratecard";
import type { ScenarioMember } from "@/components/ShareScenario";

/** Bahan contoh bagi hasil proyek: tarif standar + bobot kerja & modal terkini tiap partner. Null bila unit tidak punya ≥2 partner. */
export async function scenarioFor(f: Facts, c: Company) {
  const [saved] = await Promise.all([one<{ value: Partial<RateCard> }>("select value from settings where key = 'rate_card'")]);
  const card = { ...DEFAULT_RATE_CARD, ...(saved?.value ?? {}) };
  const lines = profitShare(f, c, [f.now]).lines;
  if (lines.length < 2) return null;
  const roles = (saved?.value?.roles?.length ? saved.value.roles : DEFAULT_RATE_CARD.roles).filter((r) => r.on).map((r) => ({ key: r.key, label: r.label, weight: Number(r.weight) }));
  const members: ScenarioMember[] = lines.map((l) => ({ name: l.partner.name, capShare: l.capShare, workShare: l.workShare, capital: l.capital }));
  return { companyName: c.name, card: { margin: card.margin, tools: card.tools, direct: card.direct }, reservePct: Number(c.reserve_pct), capitalPct: Number(c.share_capital_pct), members, roles };
}
