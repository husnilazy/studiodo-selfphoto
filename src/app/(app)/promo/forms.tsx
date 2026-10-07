"use client";
import { useState } from "react";
import ActionForm, { ActionButton } from "@/components/ActionForm";
import CustomerPicker from "@/components/CustomerPicker";
import Icon from "@/components/Icon";
import MoneyInput from "@/components/MoneyInput";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/format";
import { PROMO_KIND_LABEL, type PromoKind } from "@/lib/pricing";
import { deletePromo, savePromo } from "@/app/actions/promo";
import { deleteVoucher, generateVouchers, setVoucherActive, updateVoucher } from "@/app/actions/voucher";

export type PkgOpt = { id: number; name: string; category: string };
export type PromoInit = {
  id: number; name: string; label: string; kind: PromoKind; value: number; min_people: number; package_ids: number[]; categories: string[];
  starts_at: string; ends_at: string; show_countdown: boolean; show_on_site: boolean; active: boolean; // starts/ends: "YYYY-MM-DDTHH:mm" (WIB)
};

const chipCls = "chip cursor-pointer gap-2 has-[:checked]:!border-transparent has-[:checked]:!bg-accent has-[:checked]:!text-accentfg";

function Scope({ packages, pkgIds, cats }: { packages: PkgOpt[]; pkgIds: number[]; cats: string[] }) {
  const [mode, setMode] = useState<"all" | "cat" | "pkg">(pkgIds.length ? "pkg" : cats.length ? "cat" : "all");
  return (
    <fieldset className="space-y-2">
      <legend className="label">Berlaku untuk</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1">
        {([["all", "Semua paket"], ["cat", "Kategori"], ["pkg", "Paket tertentu"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-lg py-1.5 text-xs font-bold transition ${mode === k ? "bg-accent text-accentfg shadow" : "text-muted hover:text-fg"}`}>{l}</button>
        ))}
      </div>
      {mode === "cat" && (
        <div className="anim-fade flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
            <label key={k} className={chipCls}><input type="checkbox" name="categories" value={k} defaultChecked={cats.includes(k)} className="sr-only" />{l}</label>
          ))}
        </div>
      )}
      {mode === "pkg" && (
        <div className="anim-fade flex flex-wrap gap-2">
          {packages.map((p) => (
            <label key={p.id} className={chipCls}><input type="checkbox" name="package_ids" value={p.id} defaultChecked={pkgIds.includes(p.id)} className="sr-only" />{p.name}</label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function PromoForm({ promo, packages }: { promo?: PromoInit; packages: PkgOpt[] }) {
  const [kind, setKind] = useState<PromoKind>(promo?.kind ?? "percent");
  const [cd, setCd] = useState(promo?.show_countdown ?? false);
  const money = kind === "amount_unit" || kind === "amount_total";
  return (
    <>
      <ActionForm action={savePromo.bind(null, promo?.id ?? null)}>
        <Field label="Nama promo (internal)"><input name="name" className="input" required defaultValue={promo?.name} placeholder="mis. Promo Gajian Oktober" /></Field>
        <Field label="Label di website" hint="Tampil di strip kartu paket. Kosong = pakai nama promo."><input name="label" className="input" defaultValue={promo?.label} placeholder="mis. Flash Sale Weekend" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis diskon">
            <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as PromoKind)}>
              {Object.entries(PROMO_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={kind === "percent" ? "Persen" : kind === "free_units" ? "Jumlah gratis" : "Nominal"}>
            {money ? <MoneyInput key={kind} name="value" defaultValue={promo?.value} required /> : <input key={kind} name="value" inputMode="numeric" className="input" required defaultValue={promo?.value ?? (kind === "percent" ? 10 : 1)} />}
          </Field>
        </div>
        <Field label="Minimal jumlah orang" hint="1 = berlaku untuk semua. Isi 5 untuk diskon rombongan (mis. “5 orang atau lebih”).">
          <input name="min_people" inputMode="numeric" className="input" defaultValue={promo?.min_people ?? 1} />
        </Field>
        <Scope packages={packages} pkgIds={promo?.package_ids ?? []} cats={promo?.categories ?? []} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mulai (WIB, opsional)"><input type="datetime-local" name="starts_at" className="input" defaultValue={promo?.starts_at} /></Field>
          <Field label="Berakhir (WIB, opsional)"><input type="datetime-local" name="ends_at" className="input" defaultValue={promo?.ends_at} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="show_countdown" checked={cd} onChange={(e) => setCd(e.target.checked)} className="size-5 accent-[var(--accent)]" /> Tampilkan countdown di website (butuh waktu berakhir)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="show_on_site" defaultChecked={promo?.show_on_site ?? true} className="size-5 accent-[var(--accent)]" /> Tampilkan di kartu paket website
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="active" defaultChecked={promo?.active ?? true} className="size-5 accent-[var(--accent)]" /> Aktif
        </label>
        <p className="rounded-xl bg-panel2 px-3 py-2 text-xs text-muted">Promo berlaku otomatis saat booking (kasir &amp; online). Bila beberapa promo/member cocok, yang potongannya paling besar dipakai.</p>
      </ActionForm>
      {promo && <ActionForm action={deletePromo.bind(null, promo.id)} submit="Hapus promo" danger confirm="Hapus promo ini?" className="mt-2" />}
    </>
  );
}

export function VoucherForm({ packages }: { packages: PkgOpt[] }) {
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [custom, setCustom] = useState("");
  return (
    <ActionForm action={generateVouchers} submit="Buat Voucher">
      <Field label="Nama / keperluan" hint="Dipakai juga sebagai nama batch untuk mengelompokkan kode.">
        <input name="name" className="input" required placeholder="mis. Giveaway Instagram Oktober" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jenis potongan">
          <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")}>
            <option value="percent">Persen (%)</option><option value="amount">Nominal (Rp)</option>
          </select>
        </Field>
        <Field label={kind === "percent" ? "Persen" : "Nominal"}>
          {kind === "amount" ? <MoneyInput key="a" name="value" required /> : <input key="p" name="value" inputMode="numeric" className="input" required defaultValue={10} />}
        </Field>
        {kind === "percent" && <Field label="Maks. potongan (Rp)" hint="0 = tanpa batas"><MoneyInput name="max_discount" /></Field>}
        <Field label="Minimal belanja (Rp)"><MoneyInput name="min_spend" /></Field>
        <Field label="Minimal orang"><input name="min_people" inputMode="numeric" className="input" defaultValue={1} /></Field>
      </div>
      <div className="rounded-2xl border border-line bg-panel2/50 p-3.5">
        <p className="label">Kode</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Jumlah"><input name="count" inputMode="numeric" className="input" defaultValue={10} disabled={!!custom} /></Field>
          <Field label="Awalan"><input name="prefix" className="input uppercase" placeholder="SD" maxLength={8} /></Field>
          <Field label="Panjang acak"><input name="length" inputMode="numeric" className="input" defaultValue={6} /></Field>
        </div>
        <Field label="…atau kode buatan sendiri (1 voucher)" className="mt-3">
          <input name="custom_code" className="input uppercase" value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} placeholder="mis. HEMAT20" maxLength={32} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kuota total pemakaian" hint="Per kode. 0 = tanpa batas."><input name="usage_limit" inputMode="numeric" className="input" defaultValue={1} /></Field>
        <Field label="Maks. per customer" hint="0 = tanpa batas."><input name="per_customer" inputMode="numeric" className="input" defaultValue={1} /></Field>
        <Field label="Berlaku mulai (WIB)"><input type="datetime-local" name="starts_at" className="input" /></Field>
        <Field label="Kedaluwarsa (WIB)"><input type="datetime-local" name="expires_at" className="input" /></Field>
      </div>
      <Scope packages={packages} pkgIds={[]} cats={[]} />
      <div>
        <span className="label">Khusus satu customer (opsional)</span>
        <CustomerPicker allowNew={false} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="member_only" className="size-5 accent-[var(--accent)]" /> Khusus member</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="stackable" className="size-5 accent-[var(--accent)]" /> Boleh digabung dengan promo/member (jika tidak, dipakai yang lebih besar)</label>
    </ActionForm>
  );
}

export type VoucherInit = { id: number; code: string; name: string; usage_limit: number; per_customer: number; expires_at: string; active: boolean };

export function VoucherEdit({ v }: { v: VoucherInit }) {
  return (
    <>
      <p className="mb-3 rounded-xl bg-panel2 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest">{v.code}</p>
      <ActionForm action={updateVoucher.bind(null, v.id)}>
        <Field label="Nama"><input name="name" className="input" defaultValue={v.name} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kuota total" hint="0 = tanpa batas"><input name="usage_limit" inputMode="numeric" className="input" defaultValue={v.usage_limit} /></Field>
          <Field label="Maks. per customer"><input name="per_customer" inputMode="numeric" className="input" defaultValue={v.per_customer} /></Field>
        </div>
        <Field label="Kedaluwarsa (WIB)"><input type="datetime-local" name="expires_at" className="input" defaultValue={v.expires_at} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={v.active} className="size-5 accent-[var(--accent)]" /> Aktif</label>
      </ActionForm>
      <ActionForm action={deleteVoucher.bind(null, v.id)} submit="Hapus voucher" danger confirm={`Hapus voucher ${v.code}?`} className="mt-2" />
    </>
  );
}

export function ToggleVoucher({ id, active }: { id: number; active: boolean }) {
  return <ActionButton action={setVoucherActive.bind(null, id, !active)} className="btn btn-sm">{active ? "Nonaktifkan" : "Aktifkan"}</ActionButton>;
}

export function CopyBtn({ text, label, className = "btn btn-sm" }: { text: string; label?: string; className?: string }) {
  return (
    <button type="button" className={className} aria-label="Salin" onClick={async (e) => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(text); toast(label ? "Disalin" : `${text} disalin`); } catch { toast("Gagal menyalin", "bad"); }
    }}>
      <Icon name="copy" className="size-4" />{label}
    </button>
  );
}
