import "server-only";
import { cache } from "react";
import { q } from "./db";

export type Emp = {
  id: number; company_id: number; name: string; role: string; salary: number; active: boolean; pay_type: "monthly" | "weekly" | "freelance";
  position: string; join_date: string | null; phone: string; bank_name: string; bank_account: string; id_number: string;
  address: string; emergency_contact: string; notes: string;
};
export type PayItem = { id: number; employee_id: number; date: string; kind: string; amount: number; project: string; note: string; payslip_id: number | null };
export type Slip = {
  id: number; employee_id: number; company_id: number; period: string; base: number; weeks: number; bonus: number; fee: number;
  deduction: number; net: number; status: string; paid_on: string | null; tx_id: number | null; note: string; created_at: string;
};

export const PAY_TYPE_LABEL = { monthly: "Bulanan", weekly: "Mingguan", freelance: "Freelance (fee per proyek)" } as const;
export const ITEM_KIND: Record<string, { label: string; sign: 1 | -1 }> = {
  bonus: { label: "Bonus proyek", sign: 1 },
  fee_proyek: { label: "Fee freelance proyek", sign: 1 },
  potongan: { label: "Potongan", sign: -1 },
  kasbon: { label: "Kasbon (dipotong)", sign: -1 },
};

export const EMP_COLS = `id, company_id, name, role, salary::bigint as salary, active, pay_type, position, to_char(join_date,'YYYY-MM-DD') as join_date,
  phone, bank_name, bank_account, id_number, address, emergency_contact, notes`;

export const listEmployees = cache(async (): Promise<Emp[]> => {
  const r = await q<Emp>(`select ${EMP_COLS} from employees order by active desc, company_id, name`);
  return r.map((e) => ({ ...e, salary: Number(e.salary) }));
});

/** Jumlah hari Sabtu dalam bulan = jumlah gajian mingguan (4 atau 5). */
export function weeksIn(period: string): number {
  const [y, m] = period.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6) n++;
  return n;
}

export function computeSlip(emp: Pick<Emp, "pay_type" | "salary">, weeks: number, items: Pick<PayItem, "kind" | "amount">[]) {
  const base = emp.pay_type === "monthly" ? emp.salary : emp.pay_type === "weekly" ? emp.salary * weeks : 0;
  let bonus = 0, fee = 0, deduction = 0;
  for (const it of items) {
    if (it.kind === "bonus") bonus += Number(it.amount);
    else if (it.kind === "fee_proyek") fee += Number(it.amount);
    else deduction += Number(it.amount);
  }
  return { base, bonus, fee, deduction, net: Math.max(0, base + bonus + fee - deduction) };
}
