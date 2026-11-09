import { currentUser, isTeam } from "@/lib/auth";
import { q } from "@/lib/db";
import { cashBalance, loadFacts, profitShare, summary } from "@/lib/metrics";
import { fullMonth, monthLabel, pct, rupiah } from "@/lib/format";
import { getProfiles } from "@/lib/profile";
import { C, Pdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";

const KIND: Record<string, string> = { revenue: "Pendapatan", expense: "Biaya", asset_purchase: "Aset", capital_in: "Modal", withdrawal: "Penarikan" };

/** Laporan keuangan per unit usaha (PDF). ?y=2026 (default tahun berjalan) atau ?m=2026-10 untuk satu bulan. Khusus tim. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  if (!isTeam(user)) return new Response("Tidak berhak.", { status: 403 });
  const { slug } = await params;
  const f = await loadFacts();
  const co = f.companies.find((c) => c.slug === slug);
  if (!co) return new Response("Unit tidak ditemukan.", { status: 404 });

  const sp = new URL(req.url).searchParams;
  const m = /^\d{4}-\d{2}$/.test(sp.get("m") ?? "") ? sp.get("m")! : "";
  const y = /^\d{4}$/.test(sp.get("y") ?? "") ? sp.get("y")! : f.now.slice(0, 4);
  const months = m ? [m] : Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  const label = m ? fullMonth(m) : `Tahun ${y}`;
  const from = months[0] + "-01", to = months[months.length - 1] + "-31";

  const s = summary(f.rows, co.id, months);
  const share = profitShare(f, co, months);
  const inPeriod = f.rows.filter((r) => r.company_id === co.id && months.includes(r.m));
  const group = (kinds: string[]) => {
    const mp = new Map<string, number>();
    for (const r of inPeriod) if (kinds.includes(r.kind)) mp.set(r.category, (mp.get(r.category) ?? 0) + Number(r.amt));
    return [...mp.entries()].sort((a, b) => b[1] - a[1]);
  };
  const [byProject, txs] = await Promise.all([
    q<{ project: string; rev: number; cost: number; n: number }>(
      `select project, coalesce(sum(amount) filter (where kind='revenue'),0)::bigint as rev, coalesce(sum(amount) filter (where kind='expense'),0)::bigint as cost, count(*)::int as n
         from transactions where company_id = $1 and project is not null and date between $2 and $3 group by project order by rev desc`, [co.id, from, to]),
    q<{ date: string; kind: string; category: string; project: string | null; memo: string; amount: number }>(
      `select to_char(date,'YYYY-MM-DD') as date, kind, category, project, memo, amount::bigint as amount from transactions
        where company_id = $1 and date between $2 and $3 order by date, id limit 600`, [co.id, from, to]),
  ]);
  const prof = (await getProfiles([co.slug]))[co.slug];

  const p = await Pdf.create({ logoFrom: req.url });
  if (p.logo && co.slug === "frameless") { const w = 120, h = (p.logo.height / p.logo.width) * w; p.page.drawImage(p.logo, { x: 48, y: p.y - h, width: w, height: h }); p.y -= h + 10; }
  p.text("LAPORAN KEUANGAN", { size: 18, b: true });
  p.text(`${prof?.legal_name || co.name} · ${label}`, { size: 10, color: C.mute });
  p.text(`Dibuat ${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)} dari data Frameless Hub`, { size: 8, color: C.mute });
  p.gap(4); p.rule(C.ink);

  p.h("Laba rugi");
  p.kv("Pendapatan", rupiah(s.revenue), { b: true });
  group(["revenue"]).forEach(([k, v]) => p.kv(`   ${k}`, rupiah(v)));
  p.kv("Biaya operasional", rupiah(-s.opex), { b: true });
  group(["expense"]).forEach(([k, v]) => p.kv(`   ${k}`, rupiah(-v)));
  p.gap(2); p.rule();
  p.kv("Laba operasional", rupiah(s.profit), { b: true, sub: `Margin ${pct(s.margin, 1)}. Pembelian aset (investasi) tidak dihitung sebagai biaya.` });

  if (!m) {
    p.h("Per bulan");
    p.table(["Bulan", "Pendapatan", "Biaya", "Laba"], months.map((mm) => { const x = summary(f.rows, co.id, [mm]); return [monthLabel(mm), rupiah(x.revenue), rupiah(x.opex), rupiah(x.profit)]; }), [1.2, 1.6, 1.6, 1.6]);
  }

  p.h("Arus kas & modal");
  p.kv("Modal masuk", rupiah(group(["capital_in"]).reduce((a, [, v]) => a + v, 0)));
  p.kv("Pembelian aset / alat", rupiah(-s.assets));
  p.kv("Penarikan partner / bagi hasil", rupiah(-s.withdrawn));
  p.kv("Saldo kas perusahaan (kumulatif sampai sekarang)", rupiah(cashBalance(f.rows, co.id)), { b: true });

  if (byProject.length) {
    p.h("Per proyek");
    p.table(["Proyek", "Diterima", "Biaya langsung", "Margin"], byProject.map((r) => [r.project, rupiah(Number(r.rev)), rupiah(Number(r.cost)), rupiah(Number(r.rev) - Number(r.cost))]), [3, 1.4, 1.4, 1.4]);
    p.text("Hanya transaksi yang tertaut ke proyek. Pendapatan atau biaya tanpa proyek tidak muncul di tabel ini.", { size: 8, color: C.mute });
  }

  if (share.lines.length) {
    p.h("Pembagian laba");
    p.text(`Cadangan ${pct(co.reserve_pct)}: ${rupiah(share.reserve)} · Kolam modal ${pct(co.share_capital_pct)}: ${rupiah(share.capPool)} · Kolam kerja ${pct(100 - co.share_capital_pct)}: ${rupiah(share.workPool)}`, { size: 9, color: C.mute });
    p.gap(4);
    p.table(["Partner", "Porsi modal", "Porsi kerja", "Hak bagi hasil", "Sudah ditarik"], share.lines.map((l) => [l.partner.name, pct(l.capShare, 1), pct(l.workShare, 1), rupiah(l.total), rupiah(l.paid)]), [2, 1.2, 1.2, 1.6, 1.6]);
  }

  p.h(`Daftar transaksi (${txs.length}${txs.length >= 600 ? "+" : ""})`);
  p.table(["Tanggal", "Jenis", "Proyek / catatan", "Nominal"], txs.map((t) => [t.date, `${KIND[t.kind] ?? t.kind}`, `${t.project ? t.project + " - " : ""}${t.memo}`.slice(0, 70) || t.category, `${t.kind === "revenue" || t.kind === "capital_in" ? "+" : "-"}${rupiah(Number(t.amount)).replace("Rp ", "")}`]), [1.1, 1, 4, 1.4]);

  p.footer(`${co.name} · Laporan keuangan ${label} · Frameless Hub · rahasia`);
  const dl = sp.get("dl") === "1";
  return pdfResponse(await p.bytes(), `Laporan-${co.slug}-${m || y}.pdf`, dl);
}
