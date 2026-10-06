import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ActionForm, { ActionButton } from "@/components/ActionForm";
import { Badge, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { trialBalance } from "@/lib/reports";
import { rupiah, todayWIB } from "@/lib/format";
import { addAccount, toggleAccount } from "@/app/actions/finance";
import { q } from "@/lib/db";

export const metadata = { title: "Bagan Akun" };

const TYPE: Record<string, string> = { asset: "Aset", liability: "Kewajiban", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban" };

export default async function AccountsPage() {
  await requireUser(["owner"]);
  const [rows, meta] = await Promise.all([
    trialBalance(todayWIB()),
    q<{ id: number; code: string; is_system: boolean; active: boolean }>("select id, code, is_system, active from accounts"),
  ]);
  const m = new Map(meta.map((x) => [x.code, x]));
  return (
    <>
      <PageHeader title="Bagan Akun" subtitle="Daftar akun yang dipakai pada jurnal & laporan. Akun sistem tidak bisa dinonaktifkan."
        actions={
          <Sheet title="Akun Baru" trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Akun</button>}>
            <ActionForm action={addAccount}>
              <div className="grid grid-cols-[6rem_1fr] gap-3">
                <Field label="Kode"><input name="code" inputMode="numeric" className="input" required placeholder="5110" /></Field>
                <Field label="Nama akun"><input name="name" className="input" required /></Field>
              </div>
              <Field label="Jenis">
                <select name="kind" className="input" defaultValue="expense">
                  <option value="expense">Beban operasional</option><option value="cogs">HPP / biaya langsung</option><option value="revenue">Pendapatan</option>
                  <option value="asset">Aset lancar lain</option><option value="fixed">Aset tetap</option><option value="liability">Kewajiban</option>
                  <option value="loan">Pinjaman</option><option value="equity">Ekuitas</option>
                </select>
              </Field>
            </ActionForm>
          </Sheet>
        } />
      {Object.entries(TYPE).map(([t, label]) => (
        <section key={t} className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{label}</h2>
          <div className="card divide-y divide-line">
            {rows.filter((r) => r.type === t).map((r) => {
              const info = m.get(r.code)!;
              const debitNormal = t === "asset" || t === "expense";
              return (
                <div key={r.code} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${info.active ? "" : "opacity-50"}`}>
                  <span className="tnum w-12 text-sm text-muted">{r.code}</span>
                  <span className="min-w-0 flex-1 basis-40 truncate font-semibold">{r.name}</span>
                  {info.is_system && <Badge>sistem</Badge>}
                  <span className="tnum w-32 text-right text-sm font-semibold">{rupiah(debitNormal ? r.debit - r.credit : r.credit - r.debit)}</span>
                  {!info.is_system && <ActionButton action={toggleAccount.bind(null, info.id)} className="btn btn-sm">{info.active ? "Nonaktifkan" : "Aktifkan"}</ActionButton>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
