import "server-only";
import QRCode from "qrcode";
import { q } from "./db";
import { getStudio } from "./data";
import { getSiteConfig } from "./siteServer";
import { getMemberCfg } from "./pricingServer";
import { siteOrigin } from "./memberServer";
import { isMemberNow, tierFor } from "./pricing";
import { monthName } from "./format";
import type { CardBrand } from "@/components/MemberCardView";

/** Semua data yang dibutuhkan kartu member (tampilan cetak admin & kartu digital member). */
export async function loadMemberCard(customerId: number, opts: { prefill?: boolean } = {}) {
  const [c] = await q<{ id: number; name: string; phone: string; is_member: boolean; member_no: string; member_since: string | null; visits: number }>(
    `select c.id, c.name, c.phone, c.is_member, c.member_no, c.member_since::text as member_since,
            (select count(*)::int from bookings b where b.customer_id = c.id and b.status = 'done') as visits
       from customers c where c.id = $1`, [customerId]);
  if (!c) return null;
  const [cfg, studio, site, where] = await Promise.all([getMemberCfg(), getStudio(), getSiteConfig(), siteOrigin()]);
  const b = site.brand;
  const brand: CardBrand = { name: studio.name, logo: b.logo_url, logoDark: b.logo_dark_url, height: b.logo_height, text: b.text, textSize: b.text_size, textFont: b.text_font, accent: b.accent, accent2: b.accent2 };
  const total = cfg.reward_every > 0 ? Math.min(20, cfg.reward_every) : 8;
  const filled = cfg.reward_every > 0 ? c.visits % cfg.reward_every : 0;
  const stamps = {
    total, filled: opts.prefill === false ? 0 : filled,
    rewardLabel: cfg.reward_every > 0 ? `kunjungan ke-${cfg.reward_every} ${cfg.reward_percent >= 100 ? "GRATIS" : `diskon ${cfg.reward_percent}%`}` : "kumpulkan stempel",
  };
  const qrSvg = c.member_no ? await QRCode.toString(`${where.origin}/anggota?kode=${encodeURIComponent(c.member_no)}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : "";
  const [y, m] = (c.member_since ?? new Date().toISOString().slice(0, 10)).split("-").map(Number);
  return {
    customer: c, cfg, brand, stamps, qrSvg, host: where.host,
    isMember: isMemberNow(cfg, c), tier: tierFor(cfg, c.visits)?.name ?? "",
    since: `${monthName(m).slice(0, 3)} ${y}`,
  };
}
