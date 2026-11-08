import "server-only";
import { q } from "./db";
import { getShared } from "./sharedcost";
import { addMonths, compact, today } from "./format";
import { listEmployees } from "./payroll";
import type { Facts } from "./metrics";

export type Check = { ok: boolean; level: "bad" | "warn" | "info"; title: string; detail: string; href: string };

/** Daftar "apakah semuanya sudah jelas?" — tiap butir yang belum jelas langsung menunjuk halaman untuk memperbaikinya. */
export async function clarity(f: Facts) {
  const t = today(), prev = addMonths(f.now, -1);
  const [checks, lastRows, slips, obl, docs, shared, emps] = await Promise.all([
    q<{ company_id: number; last: string | null }>("select company_id, to_char(max(date),'YYYY-MM-DD') as last from balance_checks group by 1"),
    q<{ company_id: number; last: string | null }>("select company_id, to_char(max(date),'YYYY-MM-DD') as last from transactions group by 1"),
    q<{ employee_id: number }>("select employee_id from payslips where period = $1", [prev]),
    q<{ kind: string; party: string; left: number; due: string | null }>("select kind, party, (amount - paid)::bigint as left, to_char(due,'YYYY-MM-DD') as due from obligations where amount > paid"),
    q<{ company_id: number | null; kind: string }>("select company_id, kind from documents"),
    getShared(),
    listEmployees(),
  ]);
  const days = (d: string) => Math.floor((Date.parse(t) - Date.parse(d)) / 86_400_000);
  const out: Check[] = [];

  // 1. Porsi kepemilikan
  for (const c of f.companies) {
    const members = f.cps.filter((m) => m.company_id === c.id);
    if (members.length < 2) continue;
    const total = members.reduce((a, m) => a + Number(m.equity_pct), 0);
    out.push({ ok: Math.round(total) === 100, level: "bad", title: `Porsi kepemilikan ${c.name}`, detail: Math.round(total) === 100 ? "Total 100%." : `Baru ${total}% dari 100%. Sepakati dan isi porsi tiap partner.`, href: "/pengaturan" });
  }
  // 2. Rekonsiliasi saldo
  for (const c of f.companies) {
    const last = checks.find((x) => x.company_id === c.id)?.last;
    const ok = !!last && days(last) <= 35;
    out.push({ ok, level: "warn", title: `Saldo ${c.name} dicocokkan`, detail: ok ? `Terakhir ${last}.` : last ? `Terakhir ${last} (${days(last)} hari lalu). Cocokkan dengan saldo bank/laci.` : "Belum pernah dicocokkan dengan saldo bank/laci.", href: "/rekonsiliasi" });
  }
  // 3. Data masuk
  for (const c of f.companies) {
    const last = lastRows.find((x) => x.company_id === c.id)?.last;
    const ok = !!last && days(last) <= 21;
    out.push({ ok, level: "warn", title: `Data ${c.name} masih update`, detail: ok ? `Transaksi terakhir ${last}.` : last ? `Transaksi terakhir ${last} (${days(last)} hari lalu). Cek sambungan atau catat manual.` : "Belum ada transaksi.", href: `/perusahaan/${c.slug}` });
  }
  // 4. Beban bersama
  const total = Object.values(shared.pct).reduce((a, b) => a + Number(b), 0);
  out.push({ ok: shared.configured && Math.round(total) === 100, level: "info", title: "Pembagian beban bersama ruko", detail: shared.configured ? (Math.round(total) === 100 ? "Sudah diatur 100%." : `Total ${total}%, harus 100%.`) : "Belum diatur: sewa/listrik ruko masih tertanggung satu unit.", href: "/beban-bersama" });
  // 5. Slip gaji bulan lalu
  const need = emps.filter((e) => e.active && (e.pay_type !== "freelance" ? e.salary > 0 : false));
  const missing = need.filter((e) => !slips.some((s) => s.employee_id === e.id));
  if (need.length) out.push({ ok: missing.length === 0, level: "warn", title: "Slip gaji bulan lalu", detail: missing.length ? `Belum ada slip untuk ${missing.map((e) => e.name).join(", ")}.` : "Semua karyawan sudah punya slip.", href: "/gaji" });
  // 6. Hutang & piutang
  const late = obl.filter((o) => o.due && o.due < t);
  out.push({ ok: late.length === 0, level: "bad", title: "Hutang/piutang lewat jatuh tempo", detail: late.length ? late.map((o) => `${o.kind === "hutang" ? "Hutang ke" : "Piutang dari"} ${o.party} Rp ${compact(Number(o.left))}`).join("; ") : "Tidak ada yang lewat tempo.", href: "/kewajiban" });
  out.push({ ok: obl.length > 0, level: "info", title: "Hutang & piutang tercatat", detail: obl.length ? `${obl.length} item terbuka.` : "Belum ada. Catat cicilan, piutang proyek, dan hutang gaji.", href: "/kewajiban" });
  // 7. Dokumen kesepakatan
  for (const c of f.companies) {
    if (f.cps.filter((m) => m.company_id === c.id).length < 2) continue;
    const ok = docs.some((d) => d.company_id === c.id && d.kind === "perjanjian");
    out.push({ ok, level: "warn", title: `Perjanjian kemitraan ${c.name}`, detail: ok ? "Dokumen tersimpan." : "Belum ada dokumen kesepakatan modal & bagi hasil. Simpan di Dokumen.", href: "/dokumen" });
  }

  const passed = out.filter((c) => c.ok).length;
  return { checks: out, score: out.length ? Math.round((passed / out.length) * 100) : 100, passed, total: out.length };
}
