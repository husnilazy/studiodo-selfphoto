"use client";
import { useState } from "react";

export type ScenarioMember = { name: string; capShare: number; workShare: number; capital: number };
type Props = {
  companyName: string; card: { margin: number; tools: number; direct: number };
  reservePct: number; capitalPct: number; members: ScenarioMember[];
};

const rp = (n: number) => (n < 0 ? "-" : "") + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
const num = (s: string) => parseInt(s.replace(/[^\d]/g, "") || "0", 10) || 0;

/** Contoh bagi hasil satu proyek, memakai angka asli unit (bobot kerja, modal, cadangan, tarif standar). Murni hitungan, tidak menyimpan apa pun. */
export default function ShareScenario({ companyName, card, reservePct, capitalPct, members }: Props) {
  const [budget, setBudget] = useState("10000000");
  // Siapa yang mengerjakan proyek (porsi honor, %). Sisanya crew luar / freelance.
  const [doing, setDoing] = useState<string[]>(members.map((_, i) => (i === 0 ? "50" : i === 1 ? "25" : "0")));
  const B = num(budget);
  const direct = Math.round((B * card.direct) / 100), tools = Math.round((B * card.tools) / 100), margin = Math.round((B * card.margin) / 100);
  const honorPool = B - direct - tools - margin;
  const pcts = doing.map((d) => Math.max(0, Number(d.replace(",", ".")) || 0));
  const sumDoing = pcts.reduce((a, b) => a + b, 0);
  const outside = Math.max(0, 100 - sumDoing);
  const over = sumDoing > 100;
  const norm = over ? sumDoing : 100;
  const honor = pcts.map((p) => Math.round((honorPool * p) / norm));
  const honorOutside = honorPool - honor.reduce((a, b) => a + b, 0);

  const reserve = Math.round((margin * reservePct) / 100), pool = margin - reserve;
  const capPool = Math.round((pool * capitalPct) / 100), workPool = pool - capPool;
  const profit = members.map((m) => Math.round((capPool * m.capShare) / 100) + Math.round((workPool * m.workShare) / 100));
  const take = members.map((_, i) => honor[i] + profit[i]);

  return (
    <section className="card card-pad mt-4">
      <h2 className="font-display text-lg">Contoh bagi hasil satu proyek</h2>
      <p className="mt-1 text-sm text-muted">Simulasi memakai angka asli {companyName} sekarang. Ubah nilai proyek dan siapa yang mengerjakan untuk melihat hasilnya. Ini hanya hitungan, tidak mengubah data.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Nilai proyek (Rp)</span><input className="input tnum" inputMode="numeric" value={budget === "" ? "" : num(budget).toLocaleString("id-ID")} onChange={(e) => setBudget(String(num(e.target.value)))} /></label>
        <div>
          <span className="label">Siapa mengerjakan? (% dari honor crew)</span>
          <div className="grid grid-cols-2 gap-2">
            {members.map((m, i) => (
              <label key={m.name} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate text-muted">{m.name}</span>
                <input className="input tnum !min-h-9 !w-16 text-right" inputMode="decimal" value={doing[i]} onChange={(e) => setDoing((d) => d.map((x, k) => (k === i ? e.target.value : x)))} />
              </label>
            ))}
            <div className="flex items-center gap-2 text-sm"><span className="flex-1 text-muted">Crew luar</span><span className="tnum w-16 text-right">{over ? 0 : outside}</span></div>
          </div>
          {over && <p className="mt-1 text-xs text-warn">Total lebih dari 100%, dihitung proporsional.</p>}
        </div>
      </div>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">1. Dari uang klien ke kantong-kantong</h3>
      <ul className="mt-2 divide-y divide-line text-sm">
        <li className="flex justify-between py-2"><span>Uang masuk dari klien</span><b className="tnum">{rp(B)}</b></li>
        <li className="flex justify-between py-2"><span className="text-muted">Biaya langsung proyek ({card.direct}%): transport, konsumsi, sewa, musik</span><span className="tnum">−{rp(direct)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Pemakaian & penyusutan alat ({card.tools}%): ditabung di kas {companyName}</span><span className="tnum">−{rp(tools)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Honor crew ({100 - card.direct - card.tools - card.margin}%): dibayar ke yang mengerjakan</span><span className="tnum">−{rp(honorPool)}</span></li>
        <li className="flex justify-between py-2"><span>Laba {companyName} ({card.margin}%)</span><b className="tnum">{rp(margin)}</b></li>
      </ul>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">2. Laba dibagi</h3>
      <ul className="mt-2 divide-y divide-line text-sm">
        <li className="flex justify-between py-2"><span className="text-muted">Dana cadangan ({reservePct}%): tetap di perusahaan</span><span className="tnum">{rp(reserve)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Kolam modal ({capitalPct}%): sesuai modal pribadi yang tercatat</span><span className="tnum">{rp(capPool)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Kolam kerja ({100 - capitalPct}%): sesuai bobot kerja</span><span className="tnum">{rp(workPool)}</span></li>
      </ul>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">3. Yang diterima tiap orang</h3>
      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[460px] text-sm">
        <thead><tr><th className="th">Nama</th><th className="th text-right">Honor kerja</th><th className="th text-right">Bagi laba</th><th className="th text-right">Total</th></tr></thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.name}>
              <td className="td"><b className="font-medium">{m.name}</b><span className="block text-xs text-muted">modal {m.capShare.toFixed(0)}% · kerja {m.workShare.toFixed(0)}%</span></td>
              <td className="td tnum text-right">{rp(honor[i])}</td><td className="td tnum text-right">{rp(profit[i])}</td><td className="td tnum text-right font-medium">{rp(take[i])}</td>
            </tr>
          ))}
          <tr><td className="td text-muted">Crew luar / freelance</td><td className="td tnum text-right">{rp(honorOutside)}</td><td className="td tnum text-right">—</td><td className="td tnum text-right">{rp(honorOutside)}</td></tr>
          <tr><td className="td text-muted">Kas {companyName} (cadangan + alat)</td><td className="td text-right">—</td><td className="td tnum text-right">{rp(reserve)}</td><td className="td tnum text-right">{rp(reserve + tools)}</td></tr>
        </tbody>
      </table></div>
      <p className="mt-3 text-xs text-muted">Honor kerja adalah bayaran atas pekerjaan di proyek itu. Bagi laba adalah hak sebagai pemilik perusahaan. Keduanya terpisah, jadi yang mengerjakan lebih banyak mendapat honor lebih besar, sedangkan bagi laba ditentukan bobot kerja dan modal. Bobot kerja bisa diubah Owner kapan saja.</p>
    </section>
  );
}
