import Link from "next/link";
import Icon from "@/components/Icon";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { REPORTS } from "@/lib/reportsMeta";

export const metadata = { title: "Laporan Keuangan" };


export default async function ReportsIndex() {
  await requireUser(["owner"]);
  return (
    <>
      <PageHeader title="Laporan Keuangan" subtitle="Dihitung langsung dari jurnal, selalu mutakhir." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.k} href={`/keuangan/laporan/${r.k}`} className="card anim-rise flex gap-4 p-4 transition active:scale-[.98] hover:border-accent">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accentsoft text-accent"><Icon name={r.icon} /></span>
            <span><span className="font-display block font-semibold">{r.t}</span><span className="mt-0.5 block text-sm text-muted">{r.d}</span></span>
          </Link>
        ))}
      </div>
    </>
  );
}
