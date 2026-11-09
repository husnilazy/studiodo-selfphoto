import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { loadFacts } from "@/lib/metrics";
import { rupiah } from "@/lib/format";
import { CompanyDot, PageHead, Pill } from "@/components/ui";

export const metadata = { title: "Detail transaksi" };
const LABEL: Record<string, string> = { revenue: "Pendapatan", expense: "Biaya", asset_purchase: "Pembelian aset", capital_in: "Modal masuk", withdrawal: "Penarikan" };
const SRC = (s: string) => (s === "manual" ? "Dicatat manual" : s === "excel" ? "Impor Excel" : s === "api" ? "Kasir / API Core" : s.startsWith("pull:") ? "Ditarik otomatis dari aplikasi unit" : s);

type Tx = { id: number; company_id: number; date: string; kind: string; category: string; amount: number; funding: string; partner: string | null; memo: string; source: string; external_id: string | null; project: string | null; ref: string | null; created_at: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [f, [t]] = await Promise.all([
    loadFacts(),
    q<Tx>(`select t.id, t.company_id, to_char(t.date,'YYYY-MM-DD') as date, t.kind, t.category, t.amount::bigint as amount, t.funding, p.name as partner, t.memo, t.source, t.external_id, t.project, t.ref, t.created_at::text
           from transactions t left join partners p on p.id = t.partner_id where t.id = $1`, [Number(id) || 0]),
  ]);
  if (!t) notFound();
  const co = f.companies.find((c) => c.id === t.company_id);
  const plus = t.kind === "revenue" || t.kind === "capital_in";
  // Semua transaksi pada proyek yang sama → ringkasan proyek (pendapatan, biaya, margin).
  const siblings = t.project
    ? await q<{ id: number; date: string; kind: string; memo: string; amount: number }>(
        "select id, to_char(date,'YYYY-MM-DD') as date, kind, memo, amount::bigint as amount from transactions where company_id = $1 and project = $2 order by date desc, id desc", [t.company_id, t.project])
    : [];
  const rev = siblings.filter((s) => s.kind === "revenue").reduce((a, s) => a + Number(s.amount), 0);
  const cost = siblings.filter((s) => s.kind === "expense").reduce((a, s) => a + Number(s.amount), 0);
  const rows: [string, React.ReactNode][] = [
    ["Tanggal", t.date],
    ["Unit usaha", co ? <span className="inline-flex items-center gap-2"><CompanyDot color={co.color} />{co.name}</span> : "-"],
    ["Jenis", <span key="j"><Pill tone={plus ? "ok" : t.kind === "asset_purchase" ? "info" : "warn"}>{LABEL[t.kind] ?? t.kind}</Pill> <span className="text-muted">{t.category}</span></span>],
    ["Proyek", t.project ?? "Tidak terkait proyek"],
    ["No. invoice / referensi", t.ref ?? "-"],
    ["Catatan", t.memo || "-"],
    ["Sumber dana", t.funding === "partner" ? `Dibayar pribadi oleh ${t.partner}` : t.partner ? `Partner: ${t.partner}` : "Kas perusahaan"],
    ["Sumber data", SRC(t.source)],
    ["Dicatat", t.created_at.slice(0, 16).replace("T", " ")],
  ];
  return (
    <>
      <PageHead title="Detail transaksi" sub={`#${t.id}`} />
      <p className="mb-3 text-sm"><Link href={`/transaksi?c=${t.company_id}`} className="text-accent2 hover:underline">← Kembali ke daftar {co?.name ?? "transaksi"}</Link></p>
      <div className="card card-pad">
        <div className={`font-display tnum text-3xl font-semibold ${plus ? "text-ok" : ""}`}>{plus ? "+" : "−"}{rupiah(Number(t.amount))}</div>
        <dl className="mt-4 divide-y divide-line text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex flex-wrap justify-between gap-2 py-2.5"><dt className="text-muted">{k}</dt><dd className="max-w-[28rem] text-right font-medium">{v}</dd></div>)}
        </dl>
      </div>
      {t.project && (
        <div className="card card-pad mt-4">
          <h2 className="font-display mb-1 font-semibold">Proyek: {t.project}</h2>
          <p className="mb-3 text-sm text-muted">Semua uang masuk dan biaya yang tercatat pada proyek ini.</p>
          <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-muted">Diterima</div><div className="tnum font-semibold text-ok">{rupiah(rev)}</div></div>
            <div><div className="text-xs text-muted">Biaya langsung</div><div className="tnum font-semibold">{rupiah(cost)}</div></div>
            <div><div className="text-xs text-muted">Margin</div><div className="tnum font-semibold">{rupiah(rev - cost)}{rev > 0 ? ` (${Math.round(((rev - cost) / rev) * 100)}%)` : ""}</div></div>
          </div>
          <ul className="divide-y divide-line text-sm">
            {siblings.map((s) => (
              <li key={s.id}><Link href={`/transaksi/${s.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent2">
                <span className="min-w-0 truncate"><span className="tnum text-muted">{s.date}</span> · {s.memo || LABEL[s.kind]}</span>
                <span className={`tnum font-semibold ${s.kind === "revenue" ? "text-ok" : ""}`}>{s.kind === "revenue" ? "+" : "−"}{rupiah(Number(s.amount))}</span>
              </Link></li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
