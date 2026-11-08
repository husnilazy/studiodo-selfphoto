import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { loadFacts, sum } from "@/lib/metrics";
import { CATEGORIES, STATUS, currentValue, loadAssets, type Asset } from "@/lib/assets";
import { deleteAsset, importAssetsFromLedger, saveAsset, setAssetStatus } from "@/app/actions-hr";
import { compact, rupiah } from "@/lib/format";
import { Empty, Field, PageHead, Pill, SectionHead, Stat } from "@/components/ui";

export const metadata = { title: "Aset & inventaris" };

export default async function Page({ searchParams }: { searchParams: Promise<{ unit?: string; status?: string }> }) {
  const sp = await searchParams;
  const [f, user, all] = await Promise.all([loadFacts(), currentUser(), loadAssets()]);
  const owner = user?.role === "owner";
  const rows = all.filter((a) => (!sp.unit || String(a.company_id) === sp.unit) && (!sp.status || a.status === sp.status));
  const live = all.filter((a) => a.status === "aktif" || a.status === "perbaikan");
  const bad = all.filter((a) => a.status === "rusak" || a.status === "hilang");
  const val = (l: Asset[]) => l.reduce((t, a) => t + currentValue(a), 0);
  const cost = (l: Asset[]) => l.reduce((t, a) => t + Number(a.cost), 0);
  const ledger = sum(f.rows, { kind: "asset_purchase" });
  const missing = ledger - cost(all.filter((a) => a.tx_id != null));
  const unlinked = ledger > 0 && missing > 0;
  const co = (id: number) => f.companies.find((c) => c.id === id);
  const q = (k: "unit" | "status", v: string | undefined) => { const p = new URLSearchParams(); const next = { unit: sp.unit, status: sp.status, [k]: v }; Object.entries(next).forEach(([a, b]) => b && p.set(a, b)); const s = p.toString(); return "/aset" + (s ? `?${s}` : ""); };

  const form = (a?: Asset) => (
    <form action={saveAsset} className="grid gap-3 sm:grid-cols-6">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="sm:col-span-3"><Field label="Nama barang"><input name="name" className="input" required defaultValue={a?.name} placeholder="mis. DJI Mavic Air 2" /></Field></div>
      <Field label="Unit"><select name="company" className="input" defaultValue={a?.company_id ?? f.companies[0]?.id}>{f.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <div className="sm:col-span-2"><Field label="Kategori"><select name="category" className="input" defaultValue={a?.category ?? "alat"}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field></div>
      <Field label="Tanggal beli"><input type="date" name="acquired_on" className="input" defaultValue={a?.acquired_on ?? ""} /></Field>
      <Field label="Harga beli (Rp)"><input name="cost" inputMode="numeric" className="input tnum" defaultValue={a?.cost ?? ""} /></Field>
      <Field label="Jumlah"><input name="qty" inputMode="numeric" className="input tnum" defaultValue={a?.qty ?? 1} /></Field>
      <Field label="Umur pakai (thn)"><input name="life_years" inputMode="numeric" className="input tnum" defaultValue={a?.life_years ?? 4} /></Field>
      <Field label="Status"><select name="status" className="input" defaultValue={a?.status ?? "aktif"}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      <Field label="Nilai taksir (Rp, opsional)"><input name="est_value" inputMode="numeric" className="input tnum" defaultValue={a?.est_value ?? ""} placeholder="kosong = hitung otomatis" /></Field>
      <Field label="Lokasi"><input name="location" className="input" defaultValue={a?.location} placeholder="mis. Studio / rumah" /></Field>
      <Field label="Dipegang oleh"><input name="holder" className="input" defaultValue={a?.holder} /></Field>
      <Field label="No. seri"><input name="serial" className="input" defaultValue={a?.serial} /></Field>
      <div className="sm:col-span-6"><Field label="Catatan"><input name="note" className="input" defaultValue={a?.note} placeholder="mis. gimbal rusak, tidak ekonomis diperbaiki" /></Field></div>
      <div className="sm:col-span-6"><button className="btn btn-primary">{a ? "Simpan perubahan" : "Tambah barang"}</button></div>
    </form>
  );

  return (
    <>
      <PageHead title="Aset & inventaris" sub="Daftar semua barang per unit beserta kondisinya. Barang rusak, hilang, atau dijual tidak dihitung sebagai aset di valuasi." />

      <div className="statgrid grid-cols-2 lg:grid-cols-4">
        <Stat label="Barang berfungsi" value={String(live.length)} sub={`dari ${all.length} tercatat`} />
        <Stat label="Harga beli (berfungsi)" value={`Rp ${compact(cost(live))}`} />
        <Stat label="Nilai sekarang (berfungsi)" value={`Rp ${compact(val(live))}`} tone="ok" sub="Setelah penyusutan & taksiran" />
        <Stat label="Rusak / hilang" value={`Rp ${compact(cost(bad))}`} tone={bad.length ? "warn" : undefined} sub={`${bad.length} barang · dikeluarkan dari nilai aset`} />
      </div>

      {owner && (all.length === 0 || unlinked) && (
        <section className="card card-pad mt-4">
          <SectionHead title={all.length === 0 ? "Mulai dari catatan pembelian" : "Ada pembelian yang belum masuk inventaris"} note={`Buku besar mencatat pembelian aset Rp ${compact(ledger)}${all.length ? `, inventaris baru Rp ${compact(cost(all))}` : ""}. Salin dulu semuanya, lalu ubah status barang yang rusak atau sudah tidak ada.`} />
          <form action={importAssetsFromLedger}><button className="btn btn-primary">Salin dari catatan pembelian</button></form>
        </section>
      )}

      <div className="no-print mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={q("unit", undefined)} className={`btn !min-h-8 text-xs ${!sp.unit ? "btn-primary" : ""}`}>Semua unit</Link>
        {f.companies.map((c) => <Link key={c.id} href={q("unit", String(c.id))} className={`btn !min-h-8 text-xs ${sp.unit === String(c.id) ? "btn-primary" : ""}`}>{c.name.replace("STUDIODO ", "SD ")}</Link>)}
        <span className="mx-1 text-line">|</span>
        <Link href={q("status", undefined)} className={`btn !min-h-8 text-xs ${!sp.status ? "btn-primary" : ""}`}>Semua status</Link>
        {Object.entries(STATUS).map(([k, v]) => <Link key={k} href={q("status", k)} className={`btn !min-h-8 text-xs ${sp.status === k ? "btn-primary" : ""}`}>{v.label.split(" /")[0]}</Link>)}
      </div>

      <div className="mt-4 space-y-4">
        {rows.length === 0 && <Empty>Belum ada barang untuk filter ini.</Empty>}
        {f.companies.map((c) => {
          const list = rows.filter((a) => a.company_id === c.id);
          if (!list.length) return null;
          return (
            <section key={c.id} className="card card-pad">
              <SectionHead title={c.name} note={`${list.length} barang · nilai sekarang Rp ${compact(val(list))}`} />
              <ul className="divide-y divide-line">
                {list.map((a) => {
                  const st = STATUS[a.status] ?? STATUS.aktif;
                  return (
                    <li key={a.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><b className="font-medium">{a.name}{a.qty > 1 ? ` ×${a.qty}` : ""}</b><Pill tone={st.tone}>{st.label}</Pill></div>
                          <div className="mt-0.5 text-xs text-muted">{CATEGORIES.find(([k]) => k === a.category)?.[1] ?? a.category}{a.acquired_on && ` · beli ${a.acquired_on}`}{a.holder && ` · ${a.holder}`}{a.location && ` · ${a.location}`}{a.status === "dijual" && a.sale_price != null && ` · terjual ${rupiah(Number(a.sale_price))}`}</div>
                          {a.note && <div className="mt-0.5 text-xs text-muted">{a.note}</div>}
                        </div>
                        <div className="tnum text-right"><div>{rupiah(currentValue(a))}</div><div className="text-xs text-muted">beli {rupiah(Number(a.cost))}</div></div>
                      </div>
                      {owner && (
                        <div className="no-print mt-2 flex flex-wrap items-center gap-2">
                          <form action={setAssetStatus} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={a.id} />
                            <select name="status" defaultValue={a.status} className="input !min-h-8 !w-auto text-xs">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                            <input name="sale_price" inputMode="numeric" placeholder="harga jual" className="input !min-h-8 !w-24 tnum text-xs" />
                            <button className="btn !min-h-8 text-xs">Ubah status</button>
                          </form>
                          <details className="w-full"><summary className="cursor-pointer text-xs text-muted">Edit lengkap / hapus</summary>
                            <div className="mt-3">{form(a)}</div>
                            <form action={deleteAsset} className="mt-2"><input type="hidden" name="id" value={a.id} /><button className="btn btn-danger !min-h-8 text-xs">Hapus dari inventaris</button></form>
                          </details>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {owner && (
        <section className="card card-pad mt-4">
          <SectionHead title="Tambah barang" note="Untuk barang yang belum ada di catatan pembelian, atau titipan yang ingin tetap dipantau." />
          {form()}
        </section>
      )}
      <p className="mt-4 text-xs text-muted">Nilai sekarang = harga beli disusutkan garis lurus sesuai umur pakai (minimal sisa 10%), atau nilai taksir bila diisi. Mengubah status tidak mengubah catatan keuangan; catat hasil penjualan di Transaksi bila perlu.</p>
    </>
  );
}
