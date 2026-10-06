import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ActionForm from "@/components/ActionForm";
import MoneyInput from "@/components/MoneyInput";
import { cashAccounts } from "@/components/FinanceForms";
import { Empty, Field, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate, fmtMonth, rupiah, todayWIB } from "@/lib/format";
import { addAsset, runDepreciation } from "@/app/actions/finance";

export const metadata = { title: "Aset Tetap" };

export default async function AssetsPage() {
  await requireUser(["owner"]);
  const today = todayWIB();
  const [assets, assetAccs, cash] = await Promise.all([
    q<{ id: number; name: string; acquired_on: string; cost: number; salvage: number; life_months: number; account: string; accum: number; months: number }>(
      `select f.id, f.name, f.acquired_on, f.cost, f.salvage, f.life_months, a.name as account,
              coalesce(sum(d.amount),0) as accum, count(d.id)::int as months
         from fixed_assets f join accounts a on a.id = f.asset_account_id
         left join asset_depreciation d on d.asset_id = f.id
        group by f.id, a.name order by f.acquired_on desc, f.id desc`),
    q<{ id: number; name: string }>("select id, name from accounts where type = 'asset' and subtype = 'fixed' and active order by code"),
    cashAccounts(),
  ]);
  const cost = assets.reduce((s, a) => s + a.cost, 0);
  const accum = assets.reduce((s, a) => s + a.accum, 0);

  return (
    <>
      <PageHeader title="Aset Tetap" subtitle="Kamera, lighting, set, dan peralatan lain yang disusutkan tiap bulan."
        actions={<>
          <Sheet title="Catat Penyusutan" trigger={<button className="btn"><Icon name="clock" className="size-4" /> Susutkan Bulan</button>}>
            <ActionForm action={runDepreciation} submit="Catat Penyusutan">
              <Field label="Periode (bulan)" hint="Semua aset yang belum disusutkan di bulan itu akan dicatat sekaligus."><input type="month" name="period" className="input" defaultValue={today.slice(0, 7)} required /></Field>
            </ActionForm>
          </Sheet>
          <Sheet title="Tambah Aset" wide trigger={<button className="btn btn-primary"><Icon name="plus" className="size-4" /> Tambah Aset</button>}>
            <ActionForm action={addAsset}>
              <Field label="Nama aset"><input name="name" className="input" required placeholder="mis. Kamera Sony A7 III" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kelompok">
                  <select name="asset_account_id" className="input" required>{assetAccs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </Field>
                <Field label="Tanggal perolehan"><input type="date" name="acquired_on" className="input" defaultValue={today} required /></Field>
                <Field label="Harga perolehan"><MoneyInput name="cost" required /></Field>
                <Field label="Nilai sisa"><MoneyInput name="salvage" /></Field>
                <Field label="Umur manfaat (bulan)"><input name="life_months" inputMode="numeric" className="input" defaultValue={48} required /></Field>
                <Field label="Sumber dana">
                  <select name="paid_from" className="input" defaultValue="equity">
                    <option value="equity">Aset awal (Modal pemilik)</option>
                    {cash.map((c) => <option key={c.id} value={c.id}>Beli dari {c.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Catatan"><input name="note" className="input" /></Field>
            </ActionForm>
          </Sheet>
        </>} />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Harga perolehan" value={rupiah(cost)} />
        <Stat label="Akumulasi penyusutan" value={rupiah(accum)} />
        <Stat label="Nilai buku" value={rupiah(cost - accum)} tone="accent" />
      </div>

      {assets.length === 0 ? <Empty title="Belum ada aset" hint="Tambahkan peralatan studio agar neraca & laba rugi (beban penyusutan) akurat." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Aset</th><th>Perolehan</th><th className="num">Harga</th><th className="num">Penyusutan/bln</th><th className="num">Akumulasi</th><th className="num">Nilai Buku</th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td><p className="font-semibold">{a.name}</p><p className="text-xs text-muted">{a.account} · {a.months}/{a.life_months} bln</p></td>
                  <td className="whitespace-nowrap">{fmtDate(a.acquired_on, { short: true })}</td>
                  <td className="num">{rupiah(a.cost)}</td>
                  <td className="num">{rupiah(Math.floor((a.cost - a.salvage) / a.life_months))}</td>
                  <td className="num">{rupiah(a.accum)}</td>
                  <td className="num font-semibold">{rupiah(a.cost - a.accum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Metode garis lurus. Penyusutan bulan {fmtMonth(today)} dicatat dengan tombol “Susutkan Bulan” (jalankan tiap akhir bulan).</p>
    </>
  );
}
