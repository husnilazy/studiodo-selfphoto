import { addTransaction } from "@/app/actions";
import { EXPENSE_CATEGORIES, type Company, type Partner } from "@/lib/metrics";
import { today } from "@/lib/format";
import { Field } from "./ui";

export default function TxForm({ companies, partners, company }: { companies: Company[]; partners: Partner[]; company?: number }) {
  return (
    <form action={addTransaction} className="card card-pad grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Perusahaan">
        <select name="company" className="input" defaultValue={company} required>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Jenis">
        <select name="kind" className="input" defaultValue="revenue">
          <option value="revenue">Pendapatan</option>
          <option value="expense">Biaya / pengeluaran</option>
          <option value="asset_purchase">Beli aset / alat / inventaris</option>
          <option value="capital_in">Setoran modal (uang masuk)</option>
          <option value="withdrawal">Penarikan / bagi hasil / prive</option>
        </select>
      </Field>
      <Field label="Kategori (biaya)">
        <select name="category" className="input" defaultValue="operasional">
          {EXPENSE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          <option value="bagi_hasil">Bagi hasil (penarikan)</option>
          <option value="prive">Prive (penarikan)</option>
          <option value="penjualan">Penjualan (pendapatan)</option>
          <option value="proyek">Proyek (pendapatan)</option>
          <option value="alat">Alat / inventaris (aset)</option>
        </select>
      </Field>
      <Field label="Nominal (Rp)"><input name="amount" inputMode="numeric" className="input tnum" placeholder="1500000" required /></Field>
      <Field label="Tanggal"><input name="date" type="date" className="input" defaultValue={today()} /></Field>
      <Field label="Dibayar dari">
        <select name="funding" className="input" defaultValue="company">
          <option value="company">Kas perusahaan</option>
          <option value="partner">Uang pribadi partner (dihitung modal)</option>
        </select>
      </Field>
      <Field label="Partner terkait">
        <select name="partner" className="input" defaultValue="">
          <option value="">— tidak ada —</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Catatan"><input name="memo" className="input" placeholder="mis. Beli lighting untuk proyek X" /></Field>
      <div className="sm:col-span-2 lg:col-span-4"><button className="btn btn-primary">Simpan transaksi</button>
        <span className="ml-3 text-xs text-muted">Beli alat dari uang pribadi? Pilih “Beli aset” + “Uang pribadi partner” + nama partner — otomatis tercatat sebagai modal.</span></div>
    </form>
  );
}
