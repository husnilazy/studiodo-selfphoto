"use client";
import { useMemo, useState, useTransition } from "react";
import { allocate, type RateCard, type RoleDef } from "@/lib/ratecard";
import { postProjectFees, saveRateCard } from "@/app/actions-hr";
import { Field, SectionHead } from "./ui";

type Member = { name: string; capShare: number; workShare: number };
type Props = {
  card: RateCard; names: string[]; owner: boolean;
  share: { reserve: number; capital: number; work: number; members: Member[] };
  toolsHint: number; companyName: string;
};
type RoleState = RoleDef & { a1: string; a2: string; split: number };

const rp = (n: number) => (n < 0 ? "-" : "") + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
const num = (s: string) => parseInt(s.replace(/[^\d]/g, "") || "0", 10) || 0;
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export default function ProjectCalc({ card, names, owner, share, toolsHint, companyName }: Props) {
  const [project, setProject] = useState("");
  const [date, setDate] = useState(today());
  const [budget, setBudget] = useState("5000000");
  const [directTxt, setDirectTxt] = useState("");
  const [c, setC] = useState({ margin: card.margin, tools: card.tools, direct: card.direct });
  const [roles, setRoles] = useState<RoleState[]>(card.roles.map((r) => ({ ...r, a1: "", a2: "", split: 50 })));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const B = num(budget);
  const direct = directTxt === "" ? null : num(directTxt);
  const cur: RateCard = { ...card, ...c, roles };
  const a = useMemo(() => allocate(B, cur, direct, Object.fromEntries(roles.map((r) => [r.key, { on: r.on, weight: r.weight }]))), [B, c, roles, direct]); // eslint-disable-line react-hooks/exhaustive-deps

  // Honor per orang: peran yang dipegang satu orang dijumlahkan (misal lapangan + edit)
  const people = new Map<string, { total: number; parts: string[] }>();
  const unassigned: string[] = [];
  for (const r of a.roles) {
    const st = roles.find((x) => x.key === r.key)!;
    const give = (name: string, amt: number) => {
      const e = people.get(name) ?? { total: 0, parts: [] };
      e.total += amt; e.parts.push(`${r.label.split(" /")[0]} ${rp(amt)}`); people.set(name, e);
    };
    if (!st.a1.trim()) { unassigned.push(r.label); continue; }
    if (st.a2.trim()) { const x = Math.round((r.amount * st.split) / 100); give(st.a1.trim(), x); give(st.a2.trim(), r.amount - x); } else give(st.a1.trim(), r.amount);
  }
  const crewTotal = a.roles.reduce((t, r) => t + r.amount, 0);
  const afterReserve = a.margin * (1 - share.reserve / 100);
  const ownerParts = share.members.map((m) => ({ name: m.name, v: afterReserve * ((share.capital / 100) * (m.capShare / 100) + (share.work / 100) * (m.workShare / 100)) }));

  const upd = (key: string, p: Partial<RoleState>) => setRoles((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const lines = [...people.entries()].map(([name, v]) => ({ name, amount: v.total }));
  const summary = () => [
    `Budget ${rp(B)} · biaya langsung ${rp(a.direct)} · alat ${rp(a.tools)} · margin ${companyName} ${rp(a.margin)} · kolam honor ${rp(a.pool)}`,
    ...a.roles.map((r) => `${r.label}: ${rp(r.amount)} (${r.share.toFixed(0)}%)`),
    ...[...people.entries()].map(([n, v]) => `→ ${n}: ${rp(v.total)} (${v.parts.join(" + ")})`),
  ].join("\n");

  const post = () => start(async () => {
    try {
      const r = await postProjectFees(JSON.stringify({ project, date, lines, summary: summary() }));
      setMsg(`Tercatat sebagai fee proyek: ${r.matched.join(", ") || "tidak ada"}.${r.unmatched.length ? ` Belum ada di Gaji & tim (tidak dicatat): ${r.unmatched.join(", ")}.` : ""}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Gagal menyimpan."); }
  });
  const saveCard = () => start(async () => {
    try { await saveRateCard(JSON.stringify({ ...c, roles: roles.map(({ key, label, weight, on }) => ({ key, label, weight, on })) })); setMsg("Disimpan sebagai tarif standar."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Gagal menyimpan."); }
  });

  const pctIn = (v: number, set: (n: number) => void) => <input className="input tnum !min-h-9 !w-20 text-right" inputMode="decimal" value={v} onChange={(e) => set(Number(e.target.value.replace(",", ".")) || 0)} />;

  return (
    <div className="space-y-4">
      <section className="card card-pad">
        <SectionHead title="1. Proyek & budget" />
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Nama proyek"><input className="input" value={project} onChange={(e) => setProject(e.target.value)} placeholder="mis. Video profil CV Maju" /></Field></div>
          <Field label="Budget dari klien (Rp)"><input className="input tnum" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label="Tanggal"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={`Margin ${companyName} %`}>{pctIn(c.margin, (n) => setC({ ...c, margin: n }))}</Field>
          <Field label="Pemakaian alat %">{pctIn(c.tools, (n) => setC({ ...c, tools: n }))}</Field>
          <Field label="Biaya langsung (Rp)"><input className="input tnum" inputMode="numeric" value={directTxt} onChange={(e) => setDirectTxt(e.target.value)} placeholder={`otomatis ${c.direct}% = ${Math.round((B * c.direct) / 100).toLocaleString("id-ID")}`} /></Field>
          <Field label="Perkiraan biaya langsung %">{pctIn(c.direct, (n) => setC({ ...c, direct: n }))}</Field>
        </div>
        <p className="mt-2 text-xs text-muted">Biaya langsung: transport, konsumsi, sewa alat luar, musik/lisensi, talent. Penyusutan alat milik Frameless saat ini kira-kira Rp {Math.round(toolsHint).toLocaleString("id-ID")}/bulan (dari inventaris).</p>
      </section>

      <section className="card card-pad">
        <SectionHead title="2. Budget dipecah" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([["Budget", B, ""], ["Biaya langsung", a.direct, ""], ["Alat", a.tools, ""], [`Margin ${companyName}`, a.margin, ""], ["Kolam honor crew", a.pool, a.pool <= 0 ? "bad" : "ok"]] as const).map(([l, v, t]) => (
            <div key={l} className="rounded-xl border border-line p-3"><div className="text-xs text-muted">{l}</div><div className={`tnum mt-1 text-lg font-semibold ${t === "bad" ? "text-bad" : ""}`}>{rp(v)}</div>{B > 0 && l !== "Budget" && <div className="text-xs text-muted">{((v / B) * 100).toFixed(0)}% dari budget</div>}</div>
          ))}
        </div>
        {a.pool <= 0 && B > 0 && <p className="mt-3 text-sm text-bad">Budget tidak cukup: potongan sudah melebihi budget. Turunkan biaya langsung/margin atau naikkan budget.</p>}
      </section>

      <section className="card card-pad">
        <SectionHead title="3. Peran & honor" note="Centang peran yang dipakai di proyek ini. Satu orang boleh pegang beberapa peran (mis. lapangan + edit), honornya dijumlahkan. Bobot dibandingkan antar peran yang aktif." />
        <div className="space-y-2">
          {roles.map((r) => {
            const al = a.roles.find((x) => x.key === r.key);
            return (
              <div key={r.key} className={`rounded-xl border p-3 ${r.on ? "border-line" : "border-line opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-48 flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={r.on} onChange={(e) => upd(r.key, { on: e.target.checked })} /><span className="font-medium">{r.label}</span></label>
                  <label className="flex items-center gap-1 text-xs text-muted">bobot <input className="input tnum !min-h-8 !w-16 text-right" inputMode="decimal" value={r.weight} onChange={(e) => upd(r.key, { weight: Number(e.target.value.replace(",", ".")) || 0 })} /></label>
                  <div className="tnum w-40 text-right text-sm">{al ? <><b>{rp(al.amount)}</b> <span className="text-xs text-muted">{al.share.toFixed(0)}%</span></> : <span className="text-muted">–</span>}</div>
                </div>
                {r.on && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input list="crew-names" className="input !min-h-8 !w-44 text-sm" placeholder="Siapa?" value={r.a1} onChange={(e) => upd(r.key, { a1: e.target.value })} />
                    <span className="text-xs text-muted">+ dibagi dengan</span>
                    <input list="crew-names" className="input !min-h-8 !w-44 text-sm" placeholder="(opsional)" value={r.a2} onChange={(e) => upd(r.key, { a2: e.target.value })} />
                    {r.a2 && <label className="flex items-center gap-1 text-xs text-muted">porsi pertama % <input className="input tnum !min-h-8 !w-16 text-right" inputMode="decimal" value={r.split} onChange={(e) => upd(r.key, { split: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></label>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" className="btn !min-h-8 mt-3 text-xs" onClick={() => setRoles((rs) => [...rs, { key: `x${Date.now()}`, label: "Peran lain", weight: 5, on: true, a1: "", a2: "", split: 50 }])}>+ Peran lain</button>
        <datalist id="crew-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      </section>

      <section className="card card-pad">
        <SectionHead title="4. Terima bersih per orang" note="Jumlah semua peran yang dipegang satu orang." />
        {people.size === 0 ? <p className="text-sm text-muted">Isi nama di peran di atas.</p> : (
          <ul className="divide-y divide-line text-sm">
            {[...people.entries()].sort((x, y) => y[1].total - x[1].total).map(([n, v]) => (
              <li key={n} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><b className="font-medium">{n}</b><span className="block text-xs text-muted">{v.parts.join(" + ")}</span></span><b className="tnum">{rp(v.total)}</b></li>
            ))}
          </ul>
        )}
        {unassigned.length > 0 && <p className="mt-2 text-xs text-warn">Belum ada orangnya: {unassigned.join(", ")}.</p>}
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm"><span className="text-muted">Total honor crew</span><b className="tnum">{rp(crewTotal)}</b></div>
      </section>

      <section className="card card-pad">
        <SectionHead title={`5. Margin ${companyName} → bagi hasil`} note={`Setelah cadangan ${share.reserve}%, sisanya dibagi lewat skema bagi hasil (kolam modal ${share.capital}% · kolam kerja ${share.work}%). Ini terpisah dari fee crew.`} />
        <ul className="divide-y divide-line text-sm">
          <li className="flex justify-between py-2"><span>Cadangan perusahaan</span><b className="tnum">{rp(a.margin * (share.reserve / 100))}</b></li>
          {ownerParts.map((o) => <li key={o.name} className="flex justify-between py-2"><span>{o.name} <span className="text-xs text-muted">(bagian pemilik)</span></span><b className="tnum">{rp(o.v)}</b></li>)}
        </ul>
        <p className="mt-2 text-xs text-muted">Perkiraan untuk proyek ini saja; bagi hasil sebenarnya dihitung dari laba bulanan seluruh unit.</p>
      </section>

      {owner && (
        <section className="card card-pad">
          <SectionHead title="Simpan" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || !project.trim() || lines.length === 0} onClick={post}>Catat honor ke Gaji & tim</button>
            <button type="button" className="btn" disabled={busy} onClick={saveCard}>Simpan persen & bobot sebagai standar</button>
          </div>
          <p className="mt-2 text-xs text-muted">“Catat honor” membuat fee proyek untuk orang yang namanya sudah ada di Gaji & tim (muncul di slip bulan itu) dan mengarsipkan rincian di Ide & rencana. Freelance baru: tambahkan dulu di Gaji & tim.</p>
          {msg && <p className="mt-2 text-sm">{msg}</p>}
        </section>
      )}
    </div>
  );
}
