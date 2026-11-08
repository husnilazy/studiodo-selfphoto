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

/* ───────── Valuasi & penggalangan dana ───────── */
const pctN = (fd: FormData, k: string, d: number) => {
  const raw = String(fd.get(k) ?? "").replace(",", ".").trim();
  const v = raw === "" ? d : Number(raw);
  return Number.isFinite(v) ? v : d;
};
export async function saveValuation(fd: FormData) {
  await requireOwner();
  const cos = await q<{ slug: string }>("select slug from companies where active");
  const units: Record<string, unknown> = {};
  for (const c of cos) {
    const g = s(fd, `growth_${c.slug}`);
    units[c.slug] = {
      psr: Math.max(0, pctN(fd, `psr_${c.slug}`, 1)), per: Math.max(0, pctN(fd, `per_${c.slug}`, 4)),
      sam: Math.max(0, n(fd, `sam_${c.slug}`)), pipeline: Math.max(0, n(fd, `pipe_${c.slug}`)),
      growth: g === "" ? null : pctN(fd, `growth_${c.slug}`, 0),
    };
  }
  const val = {
    rate: Math.min(60, Math.max(5, pctN(fd, "rate", 25))), tg: Math.min(10, Math.max(0, pctN(fd, "tg", 5))),
    years: Math.min(10, Math.max(3, Math.round(pctN(fd, "years", 5)))), dlom: Math.min(60, Math.max(0, pctN(fd, "dlom", 25))),
    haircut: Math.min(90, Math.max(0, pctN(fd, "haircut", 50))), reinvest: Math.min(80, Math.max(0, pctN(fd, "reinvest", 15))),
    winrate: Math.min(100, Math.max(0, pctN(fd, "winrate", 30))),
    w: { psr: Math.max(0, pctN(fd, "w_psr", 30)), per: Math.max(0, pctN(fd, "w_per", 20)), dcf: Math.max(0, pctN(fd, "w_dcf", 30)), nav: Math.max(0, pctN(fd, "w_nav", 20)) },
    units,
  };
  if (val.rate <= val.tg) throw new Error("Tingkat diskonto harus lebih besar dari pertumbuhan terminal.");
  await q("insert into settings (key, value) values ('valuation', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(val)]);
  refresh();
}

export async function saveRaise(fd: FormData) {
  await requireOwner();
  const uses = s(fd, "uses").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.lastIndexOf(":");
    return i > 0 ? { label: l.slice(0, i).trim(), pct: Math.max(0, Number(l.slice(i + 1).replace(/[^\d.,]/g, "").replace(",", ".")) || 0) } : { label: l, pct: 0 };
  });
  const total = uses.reduce((a, u) => a + u.pct, 0);
  if (uses.length && Math.round(total) !== 100) throw new Error(`Total penggunaan dana harus 100% (sekarang ${total}%).`);
  const scope = ["group", ...(await q<{ slug: string }>("select slug from companies where active")).map((c) => c.slug)].includes(s(fd, "scope")) ? s(fd, "scope") : "group";
  await q("insert into settings (key, value) values ('raise', $1::jsonb) on conflict (key) do update set value = excluded.value",
    [JSON.stringify({ amount: Math.max(0, n(fd, "amount")), scope, uses, note: s(fd, "note") })]);
  refresh();
}

/* ───────── Aset & inventaris ───────── */
const ASSET_STATUS = ["aktif", "perbaikan", "rusak", "dijual", "hilang"];
export async function saveAsset(fd: FormData) {
  await requireOwner();
  const id = n(fd, "id"), name = s(fd, "name"), company = n(fd, "company");
  if (!name || !company) throw new Error("Nama barang dan unit wajib diisi.");
  const status = ASSET_STATUS.includes(s(fd, "status")) ? s(fd, "status") : "aktif";
  const est = s(fd, "est_value");
  const f = [company, name, s(fd, "category") || "alat", Math.max(1, n(fd, "qty") || 1), s(fd, "acquired_on") || null, Math.max(0, n(fd, "cost")),
    Math.max(1, n(fd, "life_years") || 4), status, est === "" ? null : Math.max(0, n(fd, "est_value")), s(fd, "location"), s(fd, "holder"), s(fd, "serial"), s(fd, "note")];
  if (id) await q(`update assets set company_id=$1, name=$2, category=$3, qty=$4, acquired_on=$5::date, cost=$6, life_years=$7, status=$8, est_value=$9, location=$10, holder=$11, serial=$12, note=$13 where id=$14`, [...f, id]);
  else await q(`insert into assets (company_id, name, category, qty, acquired_on, cost, life_years, status, est_value, location, holder, serial, note) values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13)`, f);
  refresh();
}
export async function setAssetStatus(fd: FormData) {
  await requireOwner();
  const status = s(fd, "status");
  if (!ASSET_STATUS.includes(status)) throw new Error("Status tidak dikenal.");
  const sale = s(fd, "sale_price");
  await q("update assets set status=$1, status_on=$2::date, sale_price = case when $1 = 'dijual' then $3::bigint else null end where id=$4",
    [status, today(), sale === "" ? null : Math.max(0, n(fd, "sale_price")), n(fd, "id")]);
  refresh();
}
export async function deleteAsset(fd: FormData) { await requireOwner(); await q("delete from assets where id = $1", [n(fd, "id")]); refresh(); }
/** Salin pembelian aset dari buku besar ke inventaris (yang belum ada), lalu owner mengubah status tiap barang. */
export async function importAssetsFromLedger() {
  await requireOwner();
  await q(`insert into assets (company_id, name, category, acquired_on, cost, tx_id)
           select t.company_id, coalesce(nullif(trim(t.memo), ''), t.category), 'alat', t.date, t.amount, t.id
           from transactions t where t.kind = 'asset_purchase' and not exists (select 1 from assets a where a.tx_id = t.id)`);
  refresh();
}

/* ───────── Kalkulator proyek & kartu tarif crew ───────── */
export async function saveRateCard(json: string) {
  await requireOwner();
  const c = JSON.parse(json) as { margin: number; tools: number; direct: number; roles: { key: string; label: string; weight: number; on: boolean }[] };
  const num = (v: unknown, max = 100) => Math.min(max, Math.max(0, Number(v) || 0));
  const card = {
    margin: num(c.margin), tools: num(c.tools), direct: num(c.direct), reserve: 0,
    roles: (c.roles ?? []).slice(0, 20).map((r) => ({ key: String(r.key).slice(0, 40), label: String(r.label).slice(0, 80), weight: num(r.weight, 1000), on: !!r.on })),
  };
  if (card.margin + card.tools + card.direct >= 100) throw new Error("Margin + alat + biaya langsung tidak boleh mencapai 100%.");
  await q("insert into settings (key, value) values ('rate_card', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(card)]);
  refresh();
}

/** Catat honor proyek sebagai fee_proyek karyawan (masuk slip bulan itu) + arsipkan ringkasannya di Ide & rencana. */
export async function postProjectFees(json: string): Promise<{ matched: string[]; unmatched: string[] }> {
  await requireOwner();
  const p = JSON.parse(json) as { project: string; date: string; lines: { name: string; amount: number }[]; summary: string };
  const project = String(p.project ?? "").trim().slice(0, 120);
  if (!project) throw new Error("Nama proyek wajib diisi.");
  const date = DATE.test(String(p.date)) ? p.date : today();
  const emps = await q<{ id: number; name: string }>("select id, name from employees where active");
  const matched: string[] = [], unmatched: string[] = [];
  for (const l of p.lines ?? []) {
    const amount = Math.max(0, Math.round(Number(l.amount) || 0));
    if (!l.name || amount <= 0) continue;
    const e = emps.find((x) => x.name.trim().toLowerCase() === String(l.name).trim().toLowerCase());
    if (!e) { unmatched.push(l.name); continue; }
    await q("insert into pay_items (employee_id, date, kind, amount, project, note) values ($1, $2::date, 'fee_proyek', $3, $4, 'Dari kalkulator proyek')", [e.id, date, amount, project]);
    matched.push(l.name);
  }
  const fc = (await q<{ id: number }>("select id from companies where slug = 'frameless' limit 1"))[0]?.id ?? null;
  await q("insert into notes (kind, title, body, company_id) values ('keputusan', $1, $2, $3)", [`Alokasi proyek: ${project}`, String(p.summary ?? "").slice(0, 4000), fc]);
  refresh();
  return { matched, unmatched };
}

/* ───────── Profil & legalitas ───────── */
const PROFILE_KEYS = ["legal_name", "entity", "address", "phone", "email", "website", "nib", "nib_date", "kbli", "scale", "ahu", "ahu_date", "npwp", "bank_name", "bank_account", "bank_holder", "director", "since", "tagline", "credentials"];
export async function saveProfile(fd: FormData) {
  await requireOwner();
  const slug = s(fd, "slug");
  const ok = await q<{ slug: string }>("select slug from companies where slug = $1", [slug]);
  if (!ok.length) throw new Error("Unit tidak dikenal.");
  const p: Record<string, string> = {};
  for (const k of PROFILE_KEYS) p[k] = String(fd.get(k) ?? "").trim().slice(0, k === "credentials" ? 4000 : 400);
  await q(`insert into settings (key, value) values ('profiles', jsonb_build_object($1::text, $2::jsonb))
           on conflict (key) do update set value = settings.value || jsonb_build_object($1::text, $2::jsonb)`, [slug, JSON.stringify(p)]);
  refresh();
}
