import Link from "next/link";
import { notFound } from "next/navigation";
import MemberCardView from "@/components/MemberCardView";
import { PrintBtn } from "@/components/ExportCsv";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadMemberCard } from "@/lib/memberCard";

export const metadata = { title: "Kartu Member" };

export default async function MemberCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ isi?: string }> }) {
  await requireUser(["owner", "admin"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const prefill = (await searchParams).isi === "1";
  const d = await loadMemberCard(id, { prefill });
  if (!d) notFound();
  const { customer: c } = d;

  return (
    <>
      <div className="no-print">
        <PageHeader back="/member" title={`Kartu ${c.name}`} subtitle="Ukuran 4R/2 (10,2 × 7,6 cm): depan = identitas & kode, belakang = kartu stempel."
          actions={<>
            <Link href={`/member/${id}/kartu${prefill ? "" : "?isi=1"}`} className="btn btn-sm">{prefill ? "Stempel kosong (untuk stempel manual)" : "Isi stempel sesuai kunjungan"}</Link>
            <PrintBtn />
          </>} />
        {!c.member_no && <p className="mb-4 rounded-xl bg-warnsoft px-4 py-3 text-sm font-semibold text-warn">Customer ini belum punya kode member. Daftarkan dulu di menu Member agar kode & QR muncul.</p>}
        <p className="mb-4 rounded-xl bg-panel2 px-4 py-3 text-xs text-muted">Saat mencetak: pilih ukuran kertas <b>4R / 102 × 76 mm</b> (atau cetak di A4 lalu potong), margin <b>None</b>, dan aktifkan <b>Background graphics</b>. Halaman 1 = depan, halaman 2 = belakang.</p>
      </div>

      <div className="card-sheet mx-auto flex max-w-md flex-col items-center gap-6 print:max-w-none">
        <div className="card-face w-full print:w-[102mm]">
          <MemberCardView side="front" brand={d.brand} name={c.name} code={c.member_no || "—"} tier={d.tier} since={d.since} qrSvg={d.qrSvg} host={d.host} stamps={d.stamps} />
        </div>
        <div className="card-face w-full print:w-[102mm]">
          <MemberCardView side="back" brand={d.brand} name={c.name} code={c.member_no || "—"} tier={d.tier} since={d.since} host={d.host} stamps={d.stamps} />
        </div>
      </div>
    </>
  );
}
