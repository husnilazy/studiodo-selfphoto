import "server-only";
import { allocation, capitalByPartner, cashBalance, lastMonths, summary, sum, targetFor, type Facts } from "./metrics";
import { addMonths, compact, pct, rupiah } from "./format";

export type Insight = { level: "bad" | "warn" | "ok" | "info"; scope: string; title: string; detail: string; action: string };

/** Mesin rekomendasi berbasis aturan. Deterministik, transparan, dan jalan tanpa API apa pun. */
export function buildInsights(f: Facts): Insight[] {
  const out: Insight[] = [];
  const now = f.now, prev = addMonths(now, -1);
  const day = Number(new Date(Date.now() + 7 * 3600e3).toISOString().slice(8, 10));
  const dim = new Date(Number(now.slice(0, 4)), Number(now.slice(5, 7)), 0).getDate();
  const last3 = lastMonths(3, prev);
  const gNow = summary(f.rows, null, [now]);
  const gTotalRev = summary(f.rows, null).revenue;

  if (f.rows.length === 0) {
    return [{ level: "info", scope: "Grup", title: "Belum ada data keuangan", detail: "Hub belum menerima transaksi apa pun.", action: "Catat transaksi pertama, impor CSV, atau sambungkan kasir lewat API Core di Pengaturan." }];
  }

  for (const c of f.companies) {
    const cur = summary(f.rows, c.id, [now]), pv = summary(f.rows, c.id, [prev]);
    const cash = cashBalance(f.rows, c.id);
    const burn = sum(f.rows, { company: c.id, kind: ["expense"], months: last3, funding: "company" }) / 3;
    const hasData = sum(f.rows, { company: c.id }) > 0;
    if (!hasData) {
      out.push({ level: "info", scope: c.name, title: "Belum ada data", detail: `${c.name} belum punya transaksi.`, action: "Sambungkan API Core atau catat saldo awal & modal." });
      continue;
    }
    // Runway kas
    if (burn > 0) {
      const runway = cash / burn;
      if (cash < 0) out.push({ level: "bad", scope: c.name, title: "Kas negatif", detail: `Saldo kas tercatat ${rupiah(cash)}. Kemungkinan modal/biaya pribadi belum dicatat, atau kas benar-benar kurang.`, action: "Cek pencatatan setoran modal & biaya yang dibayar pribadi. Tunda pembelian aset sampai kas positif." });
      else if (runway < 2) out.push({ level: "bad", scope: c.name, title: `Kas hanya cukup ${runway.toFixed(1)} bulan`, detail: `Rata-rata biaya ${compact(burn)}/bulan vs kas ${compact(cash)}.`, action: "Tahan pengeluaran non-esensial, percepat penagihan proyek, hindari bagi hasil bulan ini." });
      else if (runway < 4) out.push({ level: "warn", scope: c.name, title: `Runway kas ${runway.toFixed(1)} bulan`, detail: `Target sehat minimal 4 bulan biaya operasional (${compact(burn * 4)}).`, action: "Naikkan porsi Dana Cadangan di Alokasi sampai runway ≥ 4 bulan." });
    }
    // Margin
    if (cur.revenue > 0 && day >= 10) {
      if (cur.margin < 0) out.push({ level: "bad", scope: c.name, title: "Bulan ini rugi", detail: `Biaya ${compact(cur.opex)} melebihi pendapatan ${compact(cur.revenue)} (margin ${pct(cur.margin)}).`, action: "Tinjau biaya terbesar di halaman perusahaan; naikkan harga atau kurangi biaya tetap." });
      else if (cur.margin < 15) out.push({ level: "warn", scope: c.name, title: `Margin tipis ${pct(cur.margin)}`, detail: "Di bawah 15% sulit untuk menggaji tim, berkembang, dan membagi hasil sekaligus.", action: "Cari satu produk/paket berpendapatan tinggi untuk didorong, atau cek HPP." });
    }
    // Tren pendapatan (bandingkan proyeksi bulan ini dengan bulan lalu)
    if (pv.revenue > 0) {
      const proj = day >= 7 ? (cur.revenue / day) * dim : null;
      if (proj != null) {
        const g = ((proj - pv.revenue) / pv.revenue) * 100;
        if (g <= -20) out.push({ level: "warn", scope: c.name, title: `Proyeksi pendapatan turun ${pct(Math.abs(g))}`, detail: `Laju saat ini memproyeksikan ${compact(proj)} vs ${compact(pv.revenue)} bulan lalu.`, action: "Cek penyebab: kapasitas, promo, atau musim sepi. Pertimbangkan promo paket/voucher." });
        else if (g >= 20) out.push({ level: "ok", scope: c.name, title: `Proyeksi pendapatan naik ${pct(g)}`, detail: `Laju saat ini memproyeksikan ${compact(proj)} bulan ini.`, action: "Pertahankan momentum; sisihkan sebagian ke Pengembangan untuk menjaga kapasitas." });
      }
    }
    // Lonjakan biaya
    if (pv.opex > 0 && cur.opex > pv.opex * 1.3 && cur.opex > 500_000)
      out.push({ level: "warn", scope: c.name, title: "Biaya melonjak", detail: `Biaya bulan ini ${compact(cur.opex)} sudah ${pct(((cur.opex - pv.opex) / pv.opex) * 100)} di atas bulan lalu.`, action: "Telusuri kategori biaya yang naik di halaman perusahaan." });
    // Alokasi melebihi rencana
    if (cur.revenue > 0) {
      for (const a of allocation(f, c.id, [now])) {
        if (a.key !== "cadangan" && a.budget > 0 && a.actual > a.budget * 1.15 && a.actual - a.budget > 300_000)
          out.push({ level: "warn", scope: c.name, title: `Pos ${a.label} melebihi rencana`, detail: `Terpakai ${compact(a.actual)} dari anggaran ${compact(a.budget)} (${pct(a.pct)} pendapatan).`, action: "Kurangi pos ini atau ubah persentase di halaman Alokasi bila memang kebutuhan baru." });
      }
    }
    // Modal tak seimbang vs kesepakatan
    const members = f.cps.filter((m) => m.company_id === c.id);
    if (members.length > 1) {
      const cap = capitalByPartner(f.rows, c.id);
      const tot = members.reduce((a, m) => { const x = cap.get(m.partner_id); return a + (x ? x.cash + x.inKind + x.expenses : 0); }, 0);
      if (tot > 0) for (const m of members) {
        const x = cap.get(m.partner_id), mine = x ? x.cash + x.inKind + x.expenses : 0;
        const share = (mine / tot) * 100;
        if (Math.abs(share - Number(m.equity_pct)) > 15 && Number(m.equity_pct) > 0) {
          const p = f.partners.find((pp) => pp.id === m.partner_id);
          out.push({ level: "warn", scope: c.name, title: `Modal ${p?.name} ${pct(share)} vs kesepakatan ${pct(Number(m.equity_pct))}`, detail: "Selisih besar antara modal yang tercatat dan porsi kepemilikan yang disepakati.", action: "Rapikan pencatatan modal (alat/inventaris yang dibeli pribadi) atau sepakati ulang porsi di halaman Bagi Hasil." });
        }
      }
    }
    // Target
    const t = targetFor(f, c.id, now, "revenue");
    if (t && day >= 5) {
      const pace = (cur.revenue / t) * 100, expected = (day / dim) * 100;
      if (pace < expected - 20) out.push({ level: "warn", scope: c.name, title: `Target pendapatan tertinggal`, detail: `Tercapai ${pct(pace)} dari target, padahal bulan sudah berjalan ${pct(expected)}.`, action: `Butuh ${compact(Math.max(0, t - cur.revenue))} lagi dalam ${dim - day} hari.` });
    }
  }

  // Konsentrasi pendapatan
  if (gTotalRev > 0) for (const c of f.companies) {
    const share = (summary(f.rows, c.id).revenue / gTotalRev) * 100;
    if (share > 65 && f.companies.length > 1) out.push({ level: "info", scope: "Grup", title: `${c.name} menyumbang ${pct(share)} pendapatan`, detail: "Ketergantungan pada satu unit membuat grup rentan jika unit itu melambat.", action: "Dorong unit lain atau bangun sumber pendapatan baru (lihat Ide & Rencana)." });
  }
  // Aset yang dibeli dari kas tanpa jejak modal
  const assetCash = sum(f.rows, { kind: "asset_purchase", funding: "company" });
  const capCash = sum(f.rows, { kind: "capital_in" });
  if (assetCash > 0 && capCash === 0) out.push({ level: "warn", scope: "Grup", title: "Aset dibeli tapi belum ada catatan modal", detail: `Ada ${compact(assetCash)} pembelian aset dari kas, namun belum ada setoran modal tercatat. Ini sumber ambiguitas porsi bagi hasil.`, action: "Catat setoran modal tiap partner & tandai pembelian aset yang dibayar pribadi sebagai 'dibayar partner'." });
  if (gNow.revenue > 0 && gNow.profit > 0 && gNow.margin >= 25) out.push({ level: "ok", scope: "Grup", title: `Margin grup sehat ${pct(gNow.margin)}`, detail: `Laba bulan ini ${compact(gNow.profit)}.`, action: "Waktu yang baik menambah dana cadangan dan membagi hasil sesuai aturan." });

  const rank = { bad: 0, warn: 1, info: 2, ok: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Opsional: ringkasan naratif dari Claude bila ANTHROPIC_API_KEY terisi. */
export async function aiNarrative(f: Facts, insights: Insight[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY belum diisi di server. Rekomendasi aturan di atas tetap berjalan.");
  const months = lastMonths(6, f.now);
  const data = {
    bulan_ini: f.now,
    perusahaan: f.companies.map((c) => ({
      nama: c.name, kas: cashBalance(f.rows, c.id),
      per_bulan: months.map((m) => { const s = summary(f.rows, c.id, [m]); return { bulan: m, pendapatan: s.revenue, biaya: s.opex, aset: s.assets, laba: s.profit }; }),
    })),
    temuan_mesin_aturan: insights.slice(0, 12).map((i) => `${i.scope}: ${i.title}. ${i.detail}`),
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-5-5", max_tokens: 1200,
      system: "Kamu penasihat keuangan untuk pemilik grup usaha kecil Indonesia (Frameless Creative, STUDIODO, Photobooth APP, SNAPCUP Coffee). Jawab dalam Bahasa Indonesia, ringkas, konkret, berbasis angka yang diberikan. Jangan mengarang data. Format: 1) Kondisi saat ini (3 kalimat), 2) 3 keputusan prioritas bulan ini dengan alasan angka, 3) 1 risiko terbesar, 4) 1 peluang. Ini bukan nasihat investasi berlisensi.",
      messages: [{ role: "user", content: JSON.stringify(data) }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}`);
  const j = await res.json();
  return (j.content ?? []).map((b: { text?: string }) => b.text ?? "").join("\n").trim();
}
