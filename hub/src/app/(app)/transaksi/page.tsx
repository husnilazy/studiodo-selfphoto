import Link from "next/link";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { deleteTransaction } from "@/app/actions";
import { rupiah } from "@/lib/format";
import { CompanyDot, Empty, PageHead, Pill } from "@/components/ui";
import TxForm from "@/components/TxForm";
import { ImportForm } from "@/components/clientForms";

export const metadata = { title: "Transaksi" };
const LABEL: Record<string, string> = { revenue: "Pendapatan", expense: "Biaya", asset_purchase: "Aset", capital_in: "Modal", withdrawal: "Penarikan" };

type Tx = { id: number; date: string; kind: string; category: string; amount: number; funding: string; partner: string | null; memo: string; source: string; company_id: number; project: string | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const cid = Number(sp.c) || 0;
  const rows = await q<Tx>(
    `select t.id, t.date, t.kind, t.category, t.amount, t.funding, p.name as partner, t.memo, t.source, t.company_id, t.project
     from transactions t left join partners p on p.id = t.partner_id
     where ($1 = 0 or t.company_id = $1) order by t.date desc, t.id desc limit 150`, [cid]);
  const co = new Map(f.companies.map((c) => [c.id, c]));
  const owner = user?.role === "owner";
  return (
    <>
      <PageHead title="Transaksi" sub="Satu buku besar untuk semua perusahaan. Kasir yang tersambung masuk otomatis; sisanya catat di sini." />
      {owner && <TxForm companies={f.companies} partners={f.partners} />}
      <div className="mb-3 mt-6 flex flex-wrap gap-2 text-sm">
        <a href="/transaksi" className={`btn !min-h-8 ${cid === 0 ? "btn-primary" : ""}`}>Semua</a>
        {f.companies.map((c) => <a key={c.id} href={`/transaksi?c=${c.id}`} className={`btn !min-h-8 ${cid === c.id ? "btn-primary" : ""}`}>{c.name}</a>)}
        {cid > 0 && <a href={`/api/pdf/laporan/${f.companies.find((c) => c.id === cid)?.slug ?? ""}?dl=1`} className="btn !min-h-8 ml-auto">Laporan keuangan PDF</a>}
      </div>
      {rows.length === 0 ? <Empty>Belum ada transaksi.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className="th">Tanggal</th><th className="th">Unit</th><th className="th">Jenis</th><th className="th">Proyek / catatan</th><th className="th text-right">Nominal</th>{owner && <th className="th" />}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const c = co.get(r.company_id);
                const plus = r.kind === "revenue" || r.kind === "capital_in";
                return (
                  <tr key={r.id}>
                    <td className="td tnum whitespace-nowrap"><Link href={`/transaksi/${r.id}`} className="hover:text-accent2">{r.date}</Link></td>
                    <td className="td whitespace-nowrap">{c && <span className="inline-flex items-center gap-2"><CompanyDot color={c.color} />{c.name.replace("STUDIODO ", "SD ")}</span>}</td>
                    <td className="td"><Pill tone={plus ? "ok" : r.kind === "asset_purchase" ? "info" : "warn"}>{LABEL[r.kind]}</Pill> <span className="text-xs text-muted">{r.category}</span>
                      {r.funding === "partner" && <span className="ml-1 text-xs text-accent2">· dibayar {r.partner}</span>}</td>
                    <td className="td max-w-[18rem] truncate text-muted"><Link href={`/transaksi/${r.id}`} className="hover:text-fg">{r.project && <b className="mr-1 text-fg">{r.project} ·</b>}{r.memo}{r.source !== "manual" && <span className="ml-1 text-xs">({r.source})</span>}</Link></td>
                    <td className={`td tnum text-right font-semibold ${plus ? "text-ok" : ""}`}>{plus ? "+" : "−"}{rupiah(r.amount)}</td>
                    {owner && <td className="td"><form action={deleteTransaction}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted hover:text-bad" aria-label="Hapus">✕</button></form></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {owner && (
        <details className="card card-pad mt-6">
          <summary className="cursor-pointer font-display font-semibold">Impor dari CSV</summary>
          <p className="mb-3 mt-2 text-sm text-muted">Kolom: tanggal (YYYY-MM-DD), perusahaan ({f.companies.map((c) => c.slug).join(" / ")}), jenis (revenue / expense / asset_purchase / capital_in / withdrawal), kategori, nominal, catatan.</p>
          <ImportForm />
        </details>
      )}
    </>
  );
}
