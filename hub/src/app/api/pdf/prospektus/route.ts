import { currentUser, isTeam } from "@/lib/auth";
import { loadFacts, lastMonths, summary } from "@/lib/metrics";
import { loadInventory } from "@/lib/assets";
import { getRaise, getVal, loadObligations, marketUnit, risksOf, simulate, valueGroup } from "@/lib/valuation";
import { compact, fullMonth, pct } from "@/lib/format";
import { getProfiles, legalLines } from "@/lib/profile";
import { C, Pdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";

/** Prospektus investor dalam PDF (khusus tim: owner & partner). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  if (!isTeam(user)) return new Response("Tidak berhak.", { status: 403 });
  const [f, cfg, obs, inv, raise] = await Promise.all([loadFacts(), getVal(), loadObligations(), loadInventory(), getRaise()]);
  const g = valueGroup(f, cfg, obs, inv);
  const s12 = summary(f.rows, null, lastMonths(12, f.now));
  const scoped = raise.scope === "group" ? null : g.units.find((u) => u.company.slug === raise.scope) ?? null;
  const pre = scoped ? scoped.fair : g.fair, name = scoped ? scoped.company.name : "Frameless Group";
  const baseRevs = scoped ? marketUnit(scoped, cfg).rows.find((r) => r.key === "dasar")!.rev : [0, 1, 2].map((i) => g.units.reduce((t, u) => t + (marketUnit(u, cfg).rows.find((r) => r.key === "dasar")?.rev[i] ?? 0), 0));
  const amt = Math.max(0, parseInt(new URL(req.url).searchParams.get("amt")?.replace(/\D/g, "") || String(raise.amount || 0), 10) || 0);
  const sim = simulate(pre, amt, baseRevs);
  const margin = g.annualRev > 0 ? (g.annualProfit / g.annualRev) * 100 : 0;

  const p = await Pdf.create({ logoFrom: req.url });
  if (p.logo) { const w = 120, h = (p.logo.height / p.logo.width) * w; p.page.drawImage(p.logo, { x: 48, y: p.y - h, width: w, height: h }); p.y -= h + 10; }
  p.text("PROSPEKTUS INVESTOR", { size: 18, b: true });
  p.text(`${name} · disusun otomatis dari data aktual per ${fullMonth(f.now)}`, { size: 9, color: C.mute });
  p.gap(4); p.rule(C.ink);

  p.h("Ringkasan eksekutif");
  p.text(`${f.companies.length} unit usaha (${f.companies.map((c) => c.name).join(", ")}) dengan pendapatan setahun Rp ${compact(g.annualRev)} dan laba Rp ${compact(g.annualProfit)} (margin ${pct(margin)}). Nilai wajar indikatif ${scoped ? "unit ini" : "grup"} Rp ${compact(pre)}.${amt > 0 ? ` Sedang mencari pendanaan Rp ${compact(amt)}.` : ""}`, { size: 10 });
  p.gap(6);
  p.kv("Pendapatan setahun", `Rp ${compact(g.annualRev)}`, { sub: `Aktual 12 bulan terakhir: Rp ${compact(s12.revenue)}` });
  p.kv("Laba setahun", `Rp ${compact(g.annualProfit)}`, { sub: `Aktual 12 bulan terakhir: Rp ${compact(s12.profit)}` });
  p.kv("Nilai wajar (sebelum pendanaan)", `Rp ${compact(pre)}`, { b: true, sub: `Kisaran Rp ${compact(scoped ? scoped.fairLow : g.fairLow)} - ${compact(scoped ? scoped.fairHigh : g.fairHigh)} setelah diskon usaha tertutup ${pct(cfg.dlom)}` });

  const profs = Object.values(await getProfiles(f.companies.map((c) => c.slug))).filter((pr) => pr.legal_name || pr.credentials);
  if (profs.length) {
    p.h("Legalitas & kredensial");
    profs.forEach((pr) => {
      legalLines(pr).forEach(([k, v]) => p.kv(k, v));
      if (pr.tagline) { p.gap(3); p.text(pr.tagline, { size: 9, color: C.mute }); }
      pr.credentials.split(/\r?\n/).filter(Boolean).forEach((c) => p.text(`- ${c}`, { size: 9.5 }));
      p.gap(6);
    });
  }

  p.h("Unit usaha & traksi");
  p.table(["Unit", "Pendapatan/thn", "Laba/thn", "Nilai wajar"], g.units.map((u) => [`${u.company.name} (${u.company.kind})`, compact(u.annualRev), compact(u.annualProfit), compact(u.fair)]), [3, 1.4, 1.2, 1.2]);

  p.h("Skema bagi hasil");
  p.table(["Unit", "Cadangan", "Kolam modal", "Kolam kerja"], f.companies.map((c) => [c.name, pct(Number(c.reserve_pct)), pct(Number(c.share_capital_pct)), pct(Number(c.share_work_pct))]), [3, 1.2, 1.2, 1.2]);
  [
    "Dari laba bersih unit, sebagian disisihkan sebagai dana cadangan.",
    "Sisanya dibagi dua kolam: kolam modal (proporsi modal tercatat tiap pihak) dan kolam kerja (bobot kerja).",
    "Modal tercatat = setoran tunai + alat/biaya yang dibayar pribadi; semuanya dicatat, tidak ada modal abu-abu.",
    "Pemilik digaji lewat slip; penarikan kas di luar gaji diawasi.",
  ].forEach((t, i) => p.text(`${i + 1}. ${t}`, { size: 9, color: C.mute }));

  if (amt > 0) {
    p.h("Penawaran & simulasi");
    p.text(`Pendanaan Rp ${compact(amt)} untuk ${name}.`, { size: 10 });
    p.gap(4);
    p.kv("A. Ekuitas", `${pct(sim.equityPct, 2)} saham`, { sub: `Pra-dana Rp ${compact(pre)} + dana Rp ${compact(amt)} = pasca-dana Rp ${compact(sim.post)}.` });
    p.kv("B. Bagi hasil pendapatan", `${pct(sim.rsPct, 1)} dari pendapatan`, { sub: `Sampai total diterima ${sim.cap}x modal (Rp ${compact(amt * sim.cap)})${sim.rsMonths ? `, perkiraan tuntas ${sim.rsMonths} bulan` : ", belum tuntas dalam 3 tahun pada skenario dasar"}. Tanpa saham.` });
    p.kv("C. Surat konversi", `Cap Rp ${compact(pre)}`, { sub: "Dana masuk sekarang, menjadi saham pada putaran berikut dengan diskon dan batas valuasi (cap)." });
    if (raise.uses.length) { p.gap(6); p.text("Rencana penggunaan dana", { b: true, size: 10 }); raise.uses.forEach((u) => p.kv(u.label, `${pct(u.pct)} · Rp ${compact((amt * u.pct) / 100)}`)); }
    if (raise.note) { p.gap(6); p.text(raise.note, { size: 9, color: C.mute }); }
    p.gap(4); p.text("Simulasi untuk diskusi, bukan penawaran efek. Struktur final (akta, perjanjian, pajak) perlu notaris/penasihat hukum.", { size: 8, color: C.mute });
  }

  p.h("Faktor risiko");
  const risks = risksOf(f, g);
  if (!risks.length) p.text("Tidak ada risiko besar yang terdeteksi dari data saat ini.", { size: 9, color: C.mute });
  risks.forEach((r) => p.text(`- ${r}`, { size: 9.5 }));
  p.gap(10);
  p.text("Valuasi bersifat indikatif dan memakai empat metode (kelipatan pendapatan, kelipatan laba, DCF, aset bersih). Bukan penilaian resmi.", { size: 8, color: C.mute });
  p.footer("Frameless Hub · Prospektus investor · rahasia");

  const dl = new URL(req.url).searchParams.get("dl") === "1";
  return pdfResponse(await p.bytes(), `Prospektus-${fullMonth(f.now).replace(" ", "-")}.pdf`, dl);
}
