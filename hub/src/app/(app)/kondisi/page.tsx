import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { clarity } from "@/lib/clarity";
import { cashBalance, loadFacts, summary, sum } from "@/lib/metrics";
import { postCondition } from "@/app/actions-hr";
import { fullMonth, pct, rupiah } from "@/lib/format";
import { Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";
import { Progress } from "@/components/charts";
import LiveRefresh from "@/components/LiveRefresh";

export const metadata = { title: "Kondisi perusahaan" };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const [cl, obl, updates] = await Promise.all([
    clarity(f),
    q<{ kind: string; left: number }>("select kind, (amount - paid)::bigint as left from obligations where amount > paid"),
    q<{ id: number; title: string; body: string; visibility: string; created_at: string }>("select id, title, body, visibility, to_char(created_at,'YYYY-MM-DD') as created_at from documents where kind = 'update' order by created_at desc, id desc limit 5"),
  ]);
  const owner = user?.role === "owner";
  const cash = cashBalance(f.rows, null);
  const assets = sum(f.rows, { kind: "asset_purchase" });
  const hutang = obl.filter((o) => o.kind === "hutang").reduce((a, o) => a + Number(o.left), 0);
  const piutang = obl.filter((o) => o.kind === "piutang").reduce((a, o) => a + Number(o.left), 0);
  const g = summary(f.rows, null, [f.now]);
  const open = cl.checks.filter((c) => !c.ok);
  const tone = { bad: "bad", warn: "warn", info: "info" } as const;

  return (
    <>
      <PageHead title="Kondisi perusahaan" sub={`Posisi hari ini dan apa saja yang masih abu-abu. ${fullMonth(f.now)}.`} right={<LiveRefresh />} />

      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat big label="Kas grup" value={rupiah(cash)} tone={cash < 0 ? "bad" : undefined} />
        <Stat big label="Piutang" value={rupiah(piutang)} sub="Yang masih harus ditagih" />
        <Stat big label="Hutang" value={rupiah(hutang)} tone={hutang > 0 ? "warn" : undefined} sub="Cicilan, gaji tertunda, dll." />
        <Stat big label="Posisi bersih" value={rupiah(cash + piutang - hutang)} tone={cash + piutang - hutang < 0 ? "bad" : "ok"} sub={`Kas + piutang − hutang · aset tercatat ${rupiah(assets)}`} />
      </div>

      <section className="card card-pad mt-4">
        <SectionHead title="Seberapa jelas perusahaanmu" note={`${cl.passed} dari ${cl.total} butir sudah jelas. Laba bulan ini ${rupiah(g.profit)}.`} right={<b className="stat-value text-3xl">{pct(cl.score)}</b>} />
        <Progress value={cl.score} color={cl.score >= 80 ? "var(--ok)" : cl.score >= 50 ? "var(--warn)" : "var(--bad)"} />
        {open.length === 0 ? <p className="mt-4 text-sm text-ok">Semua butir sudah jelas. Tidak ada yang abu-abu.</p> : (
          <ul className="mt-4 divide-y divide-line">
            {open.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0"><span className="flex items-center gap-2"><Pill tone={tone[c.level]}>{c.level === "bad" ? "Penting" : c.level === "warn" ? "Cek" : "Info"}</Pill><b className="font-medium">{c.title}</b></span><span className="mt-1 block text-muted">{c.detail}</span></span>
                <Link href={c.href} className="btn !min-h-8 shrink-0 text-xs">Perbaiki →</Link>
              </li>
            ))}
          </ul>
        )}
        {cl.checks.some((c) => c.ok) && (
          <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted">Yang sudah jelas ({cl.passed})</summary>
            <ul className="mt-2 space-y-1 text-muted">{cl.checks.filter((c) => c.ok).map((c, i) => <li key={i}>✓ {c.title}: {c.detail}</li>)}</ul></details>
        )}
      </section>

      <section className="card card-pad mt-4">
        <SectionHead title="Update kondisi untuk investor" note="Tulis kondisi terbaru; tampil di area investor sebagai “Kondisi terkini”." />
        {owner && (
          <form action={postCondition} className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-3"><Field label="Judul"><input name="title" className="input" required placeholder={`mis. Kondisi ${fullMonth(f.now)}`} /></Field></div>
            <Field label="Dilihat oleh"><select name="visibility" className="input" defaultValue="investor"><option value="investor">Investor</option><option value="all">Investor & karyawan</option></select></Field>
            <div className="sm:col-span-4"><Field label="Isi"><textarea name="body" className="input" rows={4} required placeholder="Pendapatan, hal yang berjalan baik, kendala, rencana bulan depan…" /></Field></div>
            <div className="sm:col-span-4"><button className="btn btn-primary">Terbitkan update</button></div>
          </form>
        )}
        {updates.length === 0 ? <p className="text-sm text-muted">Belum ada update.</p> : (
          <ul className="divide-y divide-line text-sm">{updates.map((u) => (
            <li key={u.id} className="py-3"><div className="flex items-center justify-between gap-2"><b className="font-medium">{u.title}</b><span className="text-xs text-muted">{u.created_at}</span></div><p className="mt-1 whitespace-pre-wrap text-muted">{u.body}</p></li>))}</ul>
        )}
      </section>
    </>
  );
}
