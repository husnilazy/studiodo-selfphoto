"use server";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { computeSlip, weeksIn, EMP_COLS, type Emp } from "@/lib/payroll";
import { SHARED_CATEGORY_CHOICES } from "@/lib/sharedcost";
import { thisMonth, today } from "@/lib/format";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => {
  const v = parseInt(String(fd.get(k) ?? "").replace(/[^\d-]/g, "") || "0", 10);
  return Number.isFinite(v) ? v : 0;
};
const refresh = () => revalidatePath("/", "layout");
const PERIOD = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ───────── Karyawan ───────── */
export async function saveEmployee(fd: FormData) {
  await requireOwner();
  const id = n(fd, "id"), name = s(fd, "name"), company = n(fd, "company");
  if (!name || !company) throw new Error("Nama dan unit wajib diisi.");
  const payType = ["monthly", "weekly", "freelance"].includes(s(fd, "pay_type")) ? s(fd, "pay_type") : "monthly";
  const salary = payType === "freelance" ? 0 : Math.max(0, n(fd, "salary"));
  const f = [name, company, payType, salary, s(fd, "position"), s(fd, "join_date") || null, s(fd, "phone"), s(fd, "bank_name"), s(fd, "bank_account"),
    s(fd, "id_number"), s(fd, "address"), s(fd, "emergency_contact"), s(fd, "notes")];
  if (id) await q(`update employees set name=$1, company_id=$2, pay_type=$3, salary=$4, position=$5, join_date=$6::date, phone=$7, bank_name=$8, bank_account=$9,
                   id_number=$10, address=$11, emergency_contact=$12, notes=$13, role=$5 where id=$14`, [...f, id]);
  else await q(`insert into employees (name, company_id, pay_type, salary, position, join_date, phone, bank_name, bank_account, id_number, address, emergency_contact, notes, role)
                values ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$5)`, f);
  refresh();
}
export async function toggleEmployee(fd: FormData) {
  await requireOwner();
  await q("update employees set active = not active where id = $1", [n(fd, "id")]);
  refresh();
}

/* ───────── Bonus, fee proyek, potongan ───────── */
export async function addPayItem(fd: FormData) {
  await requireOwner();
  const emp = n(fd, "employee"), kind = s(fd, "kind"), amount = n(fd, "amount"), date = s(fd, "date") || today();
  if (!emp || !["bonus", "fee_proyek", "potongan", "kasbon"].includes(kind)) throw new Error("Karyawan dan jenis wajib dipilih.");
  if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
  if (!DATE.test(date)) throw new Error("Tanggal tidak valid.");
  await q("insert into pay_items (employee_id, date, kind, amount, project, note) values ($1,$2,$3,$4,$5,$6)", [emp, date, kind, amount, s(fd, "project"), s(fd, "note")]);
  refresh();
}
export async function deletePayItem(fd: FormData) {
  await requireOwner();
  await q("delete from pay_items where id = $1 and payslip_id is null", [n(fd, "id")]);
  refresh();
}

/* ───────── Slip gaji ───────── */
type DB = Parameters<Parameters<typeof tx>[0]>[0];
async function makeSlip(t: DB, emp: Emp, period: string, weeksIn_: number | null): Promise<number | null> {
  const exists = await t("select 1 from payslips where employee_id = $1 and period = $2", [emp.id, period]);
  if (exists.length) return null;
  const weeks = emp.pay_type === "weekly" ? Math.max(1, weeksIn_ ?? weeksIn(period)) : 0;
  const items = await t<{ id: number; kind: string; amount: number }>(
    "select id, kind, amount::bigint as amount from pay_items where employee_id = $1 and payslip_id is null and to_char(date,'YYYY-MM') = $2", [emp.id, period]);
  const c = computeSlip(emp, weeks, items);
  if (c.base === 0 && items.length === 0) return null;
  const [slip] = await t<{ id: number }>(
    `insert into payslips (employee_id, company_id, period, base, weeks, bonus, fee, deduction, net) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [emp.id, emp.company_id, period, c.base, weeks, c.bonus, c.fee, c.deduction, c.net]);
  if (items.length) await t("update pay_items set payslip_id = $1 where id = any($2)", [slip.id, items.map((i) => i.id)]);
  return slip.id;
}
const getEmp = async (t: DB, id: number) => (await t<Emp>(`select ${EMP_COLS} from employees where id = $1`, [id]))[0];

export async function createPayslip(fd: FormData) {
  await requireOwner();
  const id = n(fd, "employee"), period = s(fd, "period") || thisMonth();
  if (!PERIOD.test(period)) throw new Error("Periode tidak valid.");
  await tx(async (t) => {
    const emp = await getEmp(t, id);
    if (!emp) throw new Error("Karyawan tidak ditemukan.");
    emp.salary = Number(emp.salary);
    const r = await makeSlip(t, emp, period, n(fd, "weeks") || null);
    if (r === null) throw new Error("Slip periode ini sudah ada, atau belum ada gaji pokok/bonus/fee untuk periode itu.");
  });
  refresh();
}
export async function createAllPayslips(fd: FormData) {
  await requireOwner();
  const period = s(fd, "period") || thisMonth();
  if (!PERIOD.test(period)) throw new Error("Periode tidak valid.");
  await tx(async (t) => {
    const ids = await t<{ id: number }>("select id from employees where active order by id");
    for (const { id } of ids) { const e = await getEmp(t, id); e.salary = Number(e.salary); await makeSlip(t, e, period, null); }
  });
  refresh();
}
/** Menandai slip sudah dibayar → tercatat sebagai biaya gaji di unit karyawan (arus kas ikut turun). */
export async function markPayslipPaid(fd: FormData) {
  await requireOwner();
  const id = n(fd, "id"), date = s(fd, "date") || today();
  if (!DATE.test(date)) throw new Error("Tanggal tidak valid.");
  await tx(async (t) => {
    const [sl] = await t<{ id: number; company_id: number; net: number; status: string; employee_id: number; period: string }>(
      "select id, company_id, net::bigint as net, status, employee_id, period from payslips where id = $1", [id]);
    if (!sl || sl.status === "dibayar") throw new Error("Slip tidak ditemukan atau sudah dibayar.");
    const [emp] = await t<{ name: string }>("select name from employees where id = $1", [sl.employee_id]);
    let txId: number | null = null;
    if (Number(sl.net) > 0) {
      const [row] = await t<{ id: number }>(
        `insert into transactions (company_id, date, kind, category, amount, memo, source, external_id) values ($1,$2,'expense','gaji',$3,$4,'payroll',$5)
         on conflict (company_id, external_id) where external_id is not null do update set amount = excluded.amount, date = excluded.date returning id`,
        [sl.company_id, date, Number(sl.net), `Gaji ${emp.name} ${sl.period}`, `payslip:${sl.id}`]);
      txId = row.id;
    }
    await t("update payslips set status = 'dibayar', paid_on = $2, tx_id = $3 where id = $1", [id, date, txId]);
  });
  refresh();
}
export async function deletePayslip(fd: FormData) {
  await requireOwner();
  const id = n(fd, "id");
  await tx(async (t) => {
    const [sl] = await t<{ tx_id: number | null }>("select tx_id from payslips where id = $1", [id]);
    if (!sl) return;
    if (sl.tx_id) await t("delete from transactions where id = $1", [sl.tx_id]);
    await t("update pay_items set payslip_id = null where payslip_id = $1", [id]);
    await t("delete from payslips where id = $1", [id]);
  });
  refresh();
}

/* ───────── Dokumen ───────── */
const VIS = ["owner", "team", "investor", "karyawan", "all"];
export async function addDocument(fd: FormData) {
  await requireOwner();
  const title = s(fd, "title"), vis = VIS.includes(s(fd, "visibility")) ? s(fd, "visibility") : "owner", url = s(fd, "url");
  if (!title) throw new Error("Judul wajib diisi.");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("Tautan harus diawali http:// atau https://");
  await q("insert into documents (title, kind, company_id, visibility, url, body, employee_id) values ($1,$2,$3,$4,$5,$6,$7)",
    [title, s(fd, "kind") || "dokumen", n(fd, "company") || null, vis, url, s(fd, "body"), n(fd, "employee") || null]);
  refresh();
}
export async function deleteDocument(fd: FormData) { await requireOwner(); await q("delete from documents where id = $1", [n(fd, "id")]); refresh(); }
/** Memperbarui kondisi perusahaan untuk investor: tampil di area investor sebagai "Kondisi terkini". */
export async function postCondition(fd: FormData) {
  await requireOwner();
  const title = s(fd, "title"), body = s(fd, "body");
  if (!title || !body) throw new Error("Judul dan isi update wajib diisi.");
  await q("insert into documents (title, kind, visibility, body) values ($1,'update',$2,$3)", [title, s(fd, "visibility") === "all" ? "all" : "investor", body]);
  refresh();
}

/* ───────── Hutang & piutang ───────── */
export async function addObligation(fd: FormData) {
  await requireOwner();
  const kind = s(fd, "kind") === "piutang" ? "piutang" : "hutang", party = s(fd, "party"), amount = n(fd, "amount");
  if (!party || amount <= 0) throw new Error("Pihak dan nominal wajib diisi.");
  const due = s(fd, "due");
  if (due && !DATE.test(due)) throw new Error("Tanggal jatuh tempo tidak valid.");
  await q("insert into obligations (kind, party, company_id, amount, due, note) values ($1,$2,$3,$4,$5::date,$6)", [kind, party, n(fd, "company") || null, amount, due || null, s(fd, "note")]);
  refresh();
}
export async function payObligation(fd: FormData) {
  await requireOwner();
  const id = n(fd, "id"), amt = n(fd, "amount");
  if (amt <= 0) throw new Error("Nominal harus lebih dari 0.");
  await q("update obligations set paid = least(amount, paid + $2) where id = $1", [id, amt]);
  refresh();
}
export async function deleteObligation(fd: FormData) { await requireOwner(); await q("delete from obligations where id = $1", [n(fd, "id")]); refresh(); }

/* ───────── Beban bersama ───────── */
export async function saveSharedCost(fd: FormData) {
  await requireOwner();
  const cos = await q<{ slug: string }>("select slug from companies where active");
  const pct: Record<string, number> = {};
  for (const c of cos) pct[c.slug] = Math.max(0, Number(s(fd, `pct_${c.slug}`)) || 0);
  const total = Object.values(pct).reduce((a, b) => a + b, 0);
  if (Math.round(total * 100) !== 10000) throw new Error(`Total porsi harus 100% (sekarang ${total}%).`);
  const cats = SHARED_CATEGORY_CHOICES.map(([k]) => k as string).filter((k) => fd.get(`cat_${k}`) === "on");
  if (!cats.length) throw new Error("Pilih minimal satu kategori biaya yang dibagi.");
  const host = cos.some((c) => c.slug === s(fd, "host")) ? s(fd, "host") : "frameless";
  await q("insert into settings (key, value) values ('shared_cost', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify({ host, categories: cats, pct })]);
  refresh();
}
