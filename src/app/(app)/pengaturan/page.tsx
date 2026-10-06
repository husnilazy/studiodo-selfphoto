import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import ActionForm from "@/components/ActionForm";
import { Badge, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { getStudio } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/format";
import { saveStudio, saveUser } from "@/app/actions/settings";
import DriveSettings from "./DriveSettings";
import OnlineSettings from "./OnlineSettings";

export const metadata = { title: "Pengaturan" };

type U = { id: number; name: string; role: string; active: boolean };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ drive?: string; msg?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser(["owner"]);
  const [studio, users] = await Promise.all([getStudio(), q<U>("select id, name, role, active from users order by active desc, case role when 'owner' then 0 when 'admin' then 1 else 2 end, name")]);

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Profil studio, jam operasional, dan akun pengguna." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card anim-rise p-4 sm:p-5">
          <h2 className="font-display mb-3 font-semibold">Profil & Operasional</h2>
          <ActionForm action={saveStudio}>
            <Field label="Nama studio"><input name="name" className="input" defaultValue={studio.name} required /></Field>
            <Field label="Alamat (tampil di struk)"><input name="address" className="input" defaultValue={studio.address} /></Field>
            <Field label="No. telepon / WhatsApp studio"><input name="phone" className="input" inputMode="tel" defaultValue={studio.phone} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Jam buka"><input type="time" name="open" className="input" defaultValue={studio.open} required /></Field>
              <Field label="Jam tutup"><input type="time" name="close" className="input" defaultValue={studio.close} required /></Field>
              <Field label="Slot (menit)">
                <select name="slot" className="input" defaultValue={studio.slot}>{[15, 20, 30, 60].map((v) => <option key={v} value={v}>{v}</option>)}</select>
              </Field>
            </div>
            <Field label="Catatan kaki struk"><input name="footer" className="input" defaultValue={studio.footer} /></Field>
          </ActionForm>
        </section>

        <section className="card anim-rise p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-semibold">Pengguna & PIN</h2>
            <Sheet title="Pengguna Baru" trigger={<button className="btn btn-sm btn-primary"><Icon name="plus" className="size-4" /> Tambah</button>}><UserForm /></Sheet>
          </div>
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id}>
                <Sheet title="Edit Pengguna" className="block" trigger={
                  <button className={`flex w-full items-center gap-3 py-3 text-left ${u.active ? "" : "opacity-50"}`}>
                    <span className="font-display grid size-10 shrink-0 place-items-center rounded-full bg-accentsoft font-semibold text-accent">{u.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{u.name}{u.id === me.id && " (Anda)"}</span><span className="text-xs text-muted">{u.active ? "Aktif" : "Nonaktif"}</span></span>
                    <Badge tone={u.role === "owner" ? "indigo" : "slate"}>{ROLE_LABEL[u.role]}</Badge>
                  </button>}>
                  <UserForm user={u} />
                </Sheet>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-panel2 p-3 text-xs text-muted">
            <p><b>Owner</b>: semua fitur termasuk laporan keuangan & pengaturan.</p>
            <p><b>Admin</b>: paket & ruang, booking, customer, file, pengeluaran.</p>
            <p><b>Kasir</b>: booking, pembayaran, customer, file.</p>
          </div>
        </section>
        <OnlineSettings />
        <DriveSettings status={sp.drive} msg={sp.msg} />
      </div>
    </>
  );
}

function UserForm({ user }: { user?: U }) {
  return (
    <ActionForm action={saveUser.bind(null, user?.id ?? null)}>
      <Field label="Nama"><input name="name" className="input" required defaultValue={user?.name} /></Field>
      <Field label="Peran">
        <select name="role" className="input" defaultValue={user?.role ?? "kasir"}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </Field>
      <Field label={user ? "PIN baru (kosongkan jika tidak diganti)" : "PIN (6 digit)"}>
        <input name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} className="input tnum tracking-[.4em]" autoComplete="off" required={!user} placeholder="••••••" />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={user?.active ?? true} className="size-5 accent-[var(--accent)]" /> Akun aktif</label>
    </ActionForm>
  );
}
