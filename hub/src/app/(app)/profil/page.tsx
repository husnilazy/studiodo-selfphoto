import { currentUser } from "@/lib/auth";
import { loadFacts } from "@/lib/metrics";
import { PROFILE_FIELDS, getProfiles, legalLines } from "@/lib/profile";
import { saveProfile } from "@/app/actions-hr";
import { Field, PageHead, Pill, SectionHead } from "@/components/ui";

export const metadata = { title: "Profil & legalitas" };

export default async function Page() {
  const [f, user] = await Promise.all([loadFacts(), currentUser()]);
  const owner = user?.role === "owner";
  const profiles = await getProfiles(f.companies.map((c) => c.slug));
  const keyFields = ["npwp", "bank_account", "credentials"] as const;

  return (
    <>
      <PageHead title="Profil & legalitas" sub="Data resmi tiap unit: legalitas, rekening, dan rekam jejak. Dipakai otomatis di kop slip gaji, prospektus, dan materi untuk investor atau klien supaya lebih dipercaya." />
      <div className="space-y-4">
        {f.companies.map((c) => {
          const p = profiles[c.slug];
          const missing = keyFields.filter((k) => !p[k]);
          return (
            <section key={c.id} className="card card-pad">
              <SectionHead title={c.name} right={missing.length ? <Pill tone="warn">belum: {missing.map((k) => (k === "npwp" ? "NPWP" : k === "bank_account" ? "rekening" : "rekam jejak")).join(", ")}</Pill> : <Pill tone="ok">lengkap</Pill>} />
              {legalLines(p).length > 0 && (
                <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{legalLines(p).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}</dl>
              )}
              {owner ? (
                <details><summary className="cursor-pointer text-sm text-muted">Edit data</summary>
                  <form action={saveProfile} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="slug" value={c.slug} />
                    {PROFILE_FIELDS.map((fl) => (
                      <div key={fl.key} className={fl.wide ? "sm:col-span-2" : ""}>
                        <Field label={fl.label}>{fl.area ? <textarea name={fl.key} rows={5} className="input" defaultValue={p[fl.key]} /> : <input name={fl.key} className="input" defaultValue={p[fl.key]} />}</Field>
                        {fl.hint && <p className="mt-1 text-xs text-muted">{fl.hint}</p>}
                      </div>
                    ))}
                    <div className="sm:col-span-2"><button className="btn btn-primary">Simpan profil {c.name}</button></div>
                  </form>
                </details>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
