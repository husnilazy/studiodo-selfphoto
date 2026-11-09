"use client";
import { useState } from "react";

export type ScenarioMember = { name: string; capShare: number; workShare: number; capital: number };
export type ScenarioRole = { key: string; label: string; weight: number };
type Props = {
  companyName: string; card: { margin: number; tools: number; direct: number };
  reservePct: number; capitalPct: number; members: ScenarioMember[]; roles: ScenarioRole[];
};

const rp = (n: number) => (n < 0 ? "-" : "") + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
const num = (s: string) => parseInt(s.replace(/[^\d]/g, "") || "0", 10) || 0;
const OUT = -1; // crew luar / freelance

/** Contoh bagi hasil satu proyek, memakai angka asli unit (bobot kerja, modal, cadangan, tarif & peran standar). Murni hitungan, tidak menyimpan apa pun. */
export default function ShareScenario({ companyName, card, reservePct, capitalPct, members, roles }: Props) {
  const [budget, setBudget] = useState("10000000");
  // Contoh awal: video klip. Director = Wildan (bila ada), peran lain dipegang pemilik/operator (anggota pertama).
  const wIdx = members.findIndex((m) => /wildan/i.test(m.name));
  const [who, setWho] = useState<number[]>(roles.map((r) => (/director/i.test(r.key + r.label) && wIdx >= 0 ? wIdx : 0)));
  const B = num(budget);
  const direct = Math.round((B * card.direct) / 100), tools = Math.round((B * card.tools) / 100), margin = Math.round((B * card.margin) / 100);
  const honorPool = B - direct - tools - margin;
  const wSum = roles.reduce((a, r) => a + r.weight, 0);
  const roleAmt = roles.map((r) => (wSum > 0 ? Math.round((honorPool * r.weight) / wSum) : 0));
  const honor = members.map((_, i) => roleAmt.reduce((a, v, k) => a + (who[k] === i ? v : 0), 0));
  const honorOutside = roleAmt.reduce((a, v, k) => a + (who[k] === OUT ? v : 0), 0);

  const reserve = Math.round((margin * reservePct) / 100), pool = margin - reserve;
  const capPool = Math.round((pool * capitalPct) / 100), workPool = pool - capPool;
  const profit = members.map((m) => Math.round((capPool * m.capShare) / 100) + Math.round((workPool * m.workShare) / 100));
  const take = members.map((_, i) => honor[i] + profit[i]);

  return (
    <section className="card card-pad mt-4">
      <h2 className="font-display text-lg">Contoh bagi hasil satu proyek</h2>
      <p className="mt-1 text-sm text-muted">Simulasi memakai angka asli {companyName} sekarang. Isi nilai proyek dan pilih siapa memegang tiap peran (contoh awal: video klip, Wildan sebagai director). Ini hanya hitungan, tidak mengubah data.</p>

      <label className="mt-4 block sm:max-w-xs"><span className="label">Nilai proyek (Rp)</span><input className="input tnum" inputMode="numeric" value={budget === "" ? "" : num(budget).toLocaleString("id-ID")} onChange={(e) => setBudget(String(num(e.target.value)))} /></label>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">1. Uang klien dibagi dulu ke pos-pos</h3>
      <ul className="mt-2 divide-y divide-line text-sm">
        <li className="flex justify-between py-2"><span>Uang masuk dari klien</span><b className="tnum">{rp(B)}</b></li>
        <li className="flex justify-between py-2"><span className="text-muted">Biaya langsung proyek ({card.direct}%): transport, konsumsi, sewa, musik</span><span className="tnum">−{rp(direct)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Pemakaian & penyusutan alat ({card.tools}%): ditabung di kas {companyName}</span><span className="tnum">−{rp(tools)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Kolam honor ({100 - card.direct - card.tools - card.margin}%): dibagi per peran di bawah</span><span className="tnum">−{rp(honorPool)}</span></li>
        <li className="flex justify-between py-2"><span>Laba {companyName} ({card.margin}%)</span><b className="tnum">{rp(margin)}</b></li>
      </ul>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">2. Kolam honor: honor per peran (bayaran kerja)</h3>
      <ul className="mt-2 divide-y divide-line text-sm">
        {roles.map((r, k) => (
          <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{r.label} <span className="text-xs text-muted">{wSum > 0 ? ((r.weight / wSum) * 100).toFixed(0) : 0}% dari kolam honor</span></span>
            <span className="flex items-center gap-2">
              <select className="input !min-h-9 !w-40 text-sm" value={who[k]} onChange={(e) => setWho((w) => w.map((x, i) => (i === k ? Number(e.target.value) : x)))} aria-label={`Pemegang peran ${r.label}`}>
                {members.map((m, i) => <option key={m.name} value={i}>{m.name}</option>)}
                <option value={OUT}>Crew luar</option>
              </select>
              <span className="tnum w-28 text-right">{rp(roleAmt[k])}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Satu orang boleh memegang beberapa peran, honornya dijumlahkan. Peran yang tidak dipakai di proyek tertentu bisa dikosongkan lewat tarif standar (Owner).</p>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">3. Kolam kerja: laba perusahaan dibagi</h3>
      <ul className="mt-2 divide-y divide-line text-sm">
        <li className="flex justify-between py-2"><span className="text-muted">Dana cadangan ({reservePct}%): tetap di perusahaan</span><span className="tnum">{rp(reserve)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Kolam modal ({capitalPct}%): sesuai modal pribadi yang tercatat</span><span className="tnum">{rp(capPool)}</span></li>
        <li className="flex justify-between py-2"><span className="text-muted">Kolam kerja ({100 - capitalPct}%): sesuai bobot kerja, bukan peran di proyek ini</span><span className="tnum">{rp(workPool)}</span></li>
      </ul>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">4. Yang diterima tiap orang</h3>
      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[460px] text-sm">
        <thead><tr><th className="th">Nama</th><th className="th text-right">Honor peran</th><th className="th text-right">Bagi laba</th><th className="th text-right">Total</th></tr></thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.name}>
              <td className="td"><b className="font-medium">{m.name}</b><span className="block text-xs text-muted">modal {m.capShare.toFixed(0)}% · bobot kerja {m.workShare.toFixed(0)}%</span></td>
              <td className="td tnum text-right">{rp(honor[i])}</td><td className="td tnum text-right">{rp(profit[i])}</td><td className="td tnum text-right font-medium">{rp(take[i])}</td>
            </tr>
          ))}
          <tr><td className="td text-muted">Crew luar / freelance</td><td className="td tnum text-right">{rp(honorOutside)}</td><td className="td tnum text-right">—</td><td className="td tnum text-right">{rp(honorOutside)}</td></tr>
          <tr><td className="td text-muted">Kas {companyName} (cadangan + alat)</td><td className="td text-right">—</td><td className="td tnum text-right">{rp(reserve)}</td><td className="td tnum text-right">{rp(reserve + tools)}</td></tr>
        </tbody>
      </table></div>
      <p className="mt-3 text-xs text-muted">Honor peran dibayar atas pekerjaan di proyek itu, jadi mengikuti siapa mengerjakan apa. Bagi laba adalah hak sebagai pemilik perusahaan dan ditentukan bobot kerja serta modal, sama untuk semua proyek. Bobot kerja bisa diubah Owner kapan saja.</p>
    </section>
  );
}
