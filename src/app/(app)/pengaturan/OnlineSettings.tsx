import ActionForm from "@/components/ActionForm";
import { Field } from "@/components/ui";
import { getOnline } from "@/lib/online";
import { saveOnline } from "@/app/actions/settings";

export default async function OnlineSettings() {
  const o = await getOnline();
  return (
    <section className="card anim-rise p-4 sm:p-5 lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold">Website & Booking Online</h2>
          <p className="text-sm text-muted">Halaman publik: <a className="font-semibold text-accent" href="/" target="_blank">/</a> · Booking: <a className="font-semibold text-accent" href="/book" target="_blank">/book</a></p>
        </div>
      </div>
      <ActionForm action={saveOnline} submit="Simpan Pengaturan Online">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="enabled" defaultChecked={o.enabled} className="size-5 accent-[var(--accent)]" /> Terima booking online
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tagline website"><input name="tagline" className="input" defaultValue={o.tagline} placeholder="mis. Self photo studio untuk semua momen" /></Field>
          <Field label="WhatsApp studio" hint="Format 628xxxxxxxxxx"><input name="whatsapp" inputMode="tel" className="input" defaultValue={o.whatsapp} placeholder="6281234567890" /></Field>
          <Field label="Instagram"><input name="instagram" className="input" defaultValue={o.instagram} placeholder="studiodo" /></Field>
          <Field label="Link Google Maps"><input name="maps_url" type="url" className="input" defaultValue={o.maps_url} placeholder="https://maps.app.goo.gl/…" /></Field>
          <Field label="DP (% dari total)" hint="0 = tanpa DP"><input name="dp_percent" inputMode="numeric" className="input" defaultValue={o.dp_percent} /></Field>
          <Field label="Batas tahan tanpa DP (menit)" hint="Booking menunggu otomatis batal & slot terbuka lagi. 0 = tidak pernah."><input name="hold_min" inputMode="numeric" className="input" defaultValue={o.hold_min} /></Field>
          <Field label="Booking minimal sebelum (menit)"><input name="lead_min" inputMode="numeric" className="input" defaultValue={o.lead_min} /></Field>
          <Field label="Booking maksimal ke depan (hari)"><input name="days_ahead" inputMode="numeric" className="input" defaultValue={o.days_ahead} /></Field>
        </div>
        <Field label="Info pembayaran DP (tampil setelah booking)" hint="mis. rekening bank, QRIS, atas nama.">
          <textarea name="pay_info" className="input" defaultValue={o.pay_info} placeholder={"BCA 1234567890 a.n. STUDIODO\nKirim bukti transfer lewat WhatsApp."} />
        </Field>
      </ActionForm>
    </section>
  );
}
