"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, q, tx } from "@/lib/db";
import { hashPin, hasUsers, requireOwner, sha256, startSession, verifyPin } from "@/lib/auth";
import { DEFAULT_PLAN, loadFacts } from "@/lib/metrics";
import { aiNarrative, buildInsights } from "@/lib/insights";
import { bookBalance } from "@/lib/recon";
import { pullCompany } from "@/lib/pull";
import { addMonths, thisMonth, today } from "@/lib/format";

export type FormState = { error?: string; ok?: string } | null;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => {
  const v = parseInt(String(fd.get(k) ?? "").replace(/[^\d-]/g, "") || "0", 10);
  return Number.isFinite(v) ? v : 0;
};
const refresh = () => revalidatePath("/", "layout");
const KINDS = ["revenue", "expense", "asset_purchase", "capital_in", "withdrawal"];

/* ───────── Akun ───────── */
const SEED = [
  { slug: "frameless", name: "Frameless Creative", kind: "Agensi kreatif", color: "#b79cff" },
  { slug: "studiodo", name: "STUDIODO Self Photo Studio", kind: "Studio foto", color: "#5fd1c4" },
  { slug: "photobooth", name: "STUDIODO Photobooth APP", kind: "Aplikasi / SaaS", color: "#6ea8ff" },
  { slug: "snapcup", name: "SNAPCUP Coffee", kind: "F&B", color: "#e9c46a" },
];

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (await hasUsers()) return { error: "Hub sudah diatur. Silakan login." };
  const name = s(fd, "name"), pin = s(fd, "pin");
  if (!name) return { error: "Nama wajib diisi." };
  if (!/^\d{6}$/.test(pin)) return { error: "PIN harus 6 digit angka." };
  if (pin !== s(fd, "pin2")) return { error: "Konfirmasi PIN tidak sama." };
  const uid = await tx(async (t) => {
    const [u] = await t<{ id: number }>("insert into users (name, pin_hash, role) values ($1,$2,'owner') returning id", [name, hashPin(pin)]);
    const [p] = await t<{ id: number }>("insert into partners (name, role) values ($1,'Owner & operator') returning id", [name]);
    let i = 0;
    for (const c of SEED) {
      const [row] = await t<{ id: number }>("insert into companies (slug,name,kind,color,sort) values ($1,$2,$3,$4,$5) returning id", [c.slug, c.name, c.kind, c.color, i++]);
      await t("insert into company_partners (company_id, partner_id, equity_pct, work_weight) values ($1,$2,100,1)", [row.id, p.id]);
      for (const [b, v] of Object.entries(DEFAULT_PLAN)) await t("insert into alloc_plans (company_id, bucket, pct) values ($1,$2,$3)", [row.id, b, v]);
    }
    return u.id;
  });
  await startSession(uid);
  redirect("/");
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const id = Number(s(fd, "user")), pin = s(fd, "pin");
  if (!/^\d{6}$/.test(pin)) return { error: "PIN harus 6 digit." };
  const u = await one<{ id: number; pin_hash: string; failed_attempts: number; locked_until: string | null }>(
    "select id, pin_hash, failed_attempts, locked_until from users where id = $1 and active", [id]);
  if (!u) return { error: "Pengguna tidak ditemukan." };
  if (u.locked_until && new Date(u.locked_until) > new Date()) return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  if (!verifyPin(pin, u.pin_hash)) {
    const f = u.failed_attempts + 1;
    if (f >= 5) await q("update users set failed_attempts = 0, locked_until = now() + interval '5 minutes' where id = $1", [u.id]);
    else await q("update users set failed_attempts = $2 where id = $1", [u.id, f]);
    return { error: f >= 5 ? "PIN salah 5x. Akun dikunci 5 menit." : `PIN salah. Sisa percobaan ${5 - f}.` };
  }
  await q("update users set failed_attempts = 0, locked_until = null where id = $1", [u.id]);
  await startSession(u.id);
  redirect("/");
}

export async function addUserAction(fd: FormData) {
  await requireOwner();
  const name = s(fd, "name"), pin = s(fd, "pin"), role = s(fd, "role") === "owner" ? "owner" : "partner";
  if (!name || !/^\d{6}$/.test(pin)) throw new Error("Nama dan PIN 6 digit wajib diisi.");
  await q("insert into users (name, pin_hash, role) values ($1,$2,$3)", [name, hashPin(pin), role]);
  refresh();
}

/* ───────── Transaksi ───────── */
export async function addTransaction(fd: FormData) {
  await requireOwner();
  const company = n(fd, "company"), kind = s(fd, "kind"), amount = n(fd, "amount");
  if (!company || !KINDS.includes(kind)) throw new Error("Perusahaan & jenis wajib dipilih.");
  if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
  let funding = s(fd, "funding") === "partner" ? "partner" : "company";
  const partner = n(fd, "partner") || null;
  if (kind === "capital_in" || kind === "revenue" || kind === "withdrawal") funding = "company";
  if ((kind === "capital_in" || funding === "partner") && !partner) throw new Error("Pilih partner yang menyetor / membayar.");
  const category = kind === "capital_in" ? "modal" : kind === "withdrawal" ? s(fd, "category") || "prive" : s(fd, "category") || "lainnya";
  await q(
    "insert into transactions (company_id,date,kind,category,amount,funding,partner_id,memo) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [company, s(fd, "date") || today(), kind, category, amount, funding, partner, s(fd, "memo")],
  );
  refresh();
}
export async function deleteTransaction(fd: FormData) {
  await requireOwner();
  await q("delete from transactions where id = $1", [n(fd, "id")]);
  refresh();
}

/** Impor CSV: tanggal,perusahaan(slug),jenis,kategori,nominal,catatan */
export async function importCsv(_: FormState, fd: FormData): Promise<FormState> {
  await requireOwner();
  const lines = s(fd, "csv").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { error: "CSV kosong." };
  const cos = await q<{ id: number; slug: string }>("select id, slug from companies");
  const map = new Map(cos.map((c) => [c.slug, c.id]));
  let ok = 0;
  const errs: string[] = [];
  for (const [i, line] of lines.entries()) {
    const c = line.split(",").map((x) => x.trim());
    if (i === 0 && /tanggal|date/i.test(c[0])) continue;
    const [date, slug, kind, category, amt, ...memo] = c;
    const cid = map.get(slug), amount = parseInt((amt ?? "").replace(/[^\d]/g, "") || "0", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !cid || !KINDS.includes(kind) || amount <= 0) { errs.push(`Baris ${i + 1}`); continue; }
    await q("insert into transactions (company_id,date,kind,category,amount,memo,source) values ($1,$2,$3,$4,$5,$6,'csv')", [cid, date, kind, category || "lainnya", amount, memo.join(",")]);
    ok++;
  }
  refresh();
  return errs.length ? { ok: `${ok} baris masuk.`, error: `Dilewati: ${errs.slice(0, 8).join(", ")}${errs.length > 8 ? "…" : ""}` } : { ok: `${ok} baris berhasil diimpor.` };
}

/* ───────── Perusahaan, partner, API key ───────── */
export async function addCompany(fd: FormData) {
  await requireOwner();
  const name = s(fd, "name");
  if (!name) throw new Error("Nama wajib diisi.");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `usaha-${Date.now()}`;
  const [row] = await q<{ id: number }>("insert into companies (slug,name,kind,color,sort) values ($1,$2,$3,$4,(select coalesce(max(sort),0)+1 from companies)) returning id",
    [slug, name, s(fd, "kind") || "Usaha", s(fd, "color") || "#b79cff"]);
  for (const [b, v] of Object.entries(DEFAULT_PLAN)) await q("insert into alloc_plans (company_id,bucket,pct) values ($1,$2,$3)", [row.id, b, v]);
  refresh();
}
export async function saveCompanyRules(fd: FormData) {
  await requireOwner();
  const cap = Math.min(100, Math.max(0, n(fd, "cap"))), reserve = Math.min(50, Math.max(0, n(fd, "reserve")));
  await q("update companies set share_capital_pct=$2, share_work_pct=$3, reserve_pct=$4, started_on=nullif($5,'')::date where id=$1", [n(fd, "id"), cap, 100 - cap, reserve, s(fd, "started")]);
  refresh();
}
export async function addPartner(fd: FormData) {
  await requireOwner();
  const name = s(fd, "name");
  if (!name) throw new Error("Nama partner wajib diisi.");
  await q("insert into partners (name, role) values ($1,$2)", [name, s(fd, "role")]);
  refresh();
}
export async function savePartnerLink(fd: FormData) {
  await requireOwner();
  const c = n(fd, "company"), p = n(fd, "partner");
  if (fd.get("remove")) await q("delete from company_partners where company_id=$1 and partner_id=$2", [c, p]);
  else await q(
    `insert into company_partners (company_id, partner_id, equity_pct, work_weight) values ($1,$2,$3,$4)
     on conflict (company_id, partner_id) do update set equity_pct = excluded.equity_pct, work_weight = excluded.work_weight`,
    [c, p, Math.max(0, Number(s(fd, "equity")) || 0), Math.max(0, Number(s(fd, "work")) || 0)]);
  refresh();
}

/** Membuat API key baru; nilainya hanya ditampilkan sekali (disimpan sebagai hash). */
export async function generateApiKey(_: FormState, fd: FormData): Promise<FormState> {
  await requireOwner();
  const id = n(fd, "id");
  const key = `fh_${randomBytes(24).toString("base64url")}`;
  await q("update companies set api_key_hash=$2, api_key_prefix=$3 where id=$1", [id, sha256(key), key.slice(0, 9)]);
  refresh();
  return { ok: key };
}

/* ───────── Alokasi, target, catatan ───────── */
export async function savePlan(fd: FormData) {
  await requireOwner();
  const c = n(fd, "company");
  const vals = Object.keys(DEFAULT_PLAN).map((b) => [b, Math.max(0, Number(s(fd, b)) || 0)] as const);
  const total = vals.reduce((a, [, v]) => a + v, 0);
  if (Math.round(total) !== 100) throw new Error(`Total alokasi harus 100% (sekarang ${total}%).`);
  for (const [b, v] of vals) await q("insert into alloc_plans (company_id,bucket,pct) values ($1,$2,$3) on conflict (company_id,bucket) do update set pct=excluded.pct", [c, b, v]);
  refresh();
}
export async function saveTarget(fd: FormData) {
  await requireOwner();
  const c = n(fd, "company") || null, period = s(fd, "period"), metric = s(fd, "metric") === "profit" ? "profit" : "revenue", value = n(fd, "value");
  if (!/^\d{4}-\d{2}$/.test(period) || value <= 0) throw new Error("Periode (YYYY-MM) dan nilai target wajib diisi.");
  await q(`insert into targets (company_id, period, metric, value) values ($1,$2,$3,$4)
           on conflict (coalesce(company_id,0), period, metric) do update set value = excluded.value`, [c, period, metric, value]);
  refresh();
}
export async function deleteTarget(fd: FormData) { await requireOwner(); await q("delete from targets where id=$1", [n(fd, "id")]); refresh(); }
export async function saveNote(fd: FormData) {
  await requireOwner();
  const title = s(fd, "title");
  if (!title) throw new Error("Judul wajib diisi.");
  await q("insert into notes (kind,title,body,company_id) values ($1,$2,$3,$4)", [s(fd, "kind") || "ide", title, s(fd, "body"), n(fd, "company") || null]);
  refresh();
}
export async function deleteNote(fd: FormData) { await requireOwner(); await q("delete from notes where id=$1", [n(fd, "id")]); refresh(); }

/* ───────── Gaji & tim ───────── */
export async function saveEmployee(fd: FormData) {
  await requireOwner();
  const name = s(fd, "name"), company = n(fd, "company");
  if (!name || !company) throw new Error("Nama dan unit wajib diisi.");
  const id = n(fd, "id");
  if (id) await q("update employees set name=$2, role=$3, salary=$4, company_id=$5 where id=$1", [id, name, s(fd, "role"), Math.max(0, n(fd, "salary")), company]);
  else await q("insert into employees (company_id,name,role,salary) values ($1,$2,$3,$4)", [company, name, s(fd, "role"), Math.max(0, n(fd, "salary"))]);
  refresh();
}
export async function toggleEmployee(fd: FormData) {
  await requireOwner();
  await q("update employees set active = not active where id=$1", [n(fd, "id")]);
  refresh();
}
/** Mencatat gaji sebulan sebagai biaya (idempoten: menjalankan ulang bulan yang sama hanya memperbarui). */
export async function runPayroll(fd: FormData) {
  await requireOwner();
  const company = n(fd, "company"), month = s(fd, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Bulan tidak valid.");
  const emps = await q<{ id: number; name: string; salary: number }>("select id, name, salary from employees where company_id=$1 and active and salary > 0", [company]);
  const date = month === thisMonth() ? today() : `${month}-28`;
  await tx(async (t) => {
    for (const e of emps)
      await t(
        `insert into transactions (company_id,date,kind,category,amount,memo,source,external_id)
         values ($1,$2,'expense','gaji',$3,$4,'payroll',$5)
         on conflict (company_id, external_id) where external_id is not null do update set amount=excluded.amount, memo=excluded.memo`,
        [company, date, e.salary, `Gaji ${e.name} ${month}`, `payroll:${month}:${e.id}`]);
  });
  refresh();
}

/* ───────── Tarik langsung dari database unit ───────── */
export async function pullNow(_: FormState, fd: FormData): Promise<FormState> {
  await requireOwner();
  try {
    const r = await pullCompany(s(fd, "slug"));
    refresh();
    return { ok: `${r.upserted} baris diperbarui, ${r.removed} dihapus${r.errors.length ? `, ${r.errors.length} ditolak` : ""}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menarik data." };
  }
}

/* ───────── Rekonsiliasi saldo ───────── */
export async function reconcile(fd: FormData) {
  await requireOwner();
  const company = n(fd, "company"), date = s(fd, "date") || today();
  if (!company || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Unit dan tanggal wajib diisi.");
  if (s(fd, "actual") === "") throw new Error("Isi saldo aktual (kas + bank).");
  const actual = n(fd, "actual"), book = await bookBalance(company, date), diff = actual - book;
  const adjust = fd.get("adjust") === "on" && diff !== 0;
  await tx(async (t) => {
    await t("insert into balance_checks (company_id,date,book,actual,diff,adjusted,note) values ($1,$2,$3,$4,$5,$6,$7)", [company, date, book, actual, diff, adjust, s(fd, "note")]);
    if (adjust)
      await t("insert into transactions (company_id,date,kind,category,amount,memo,source) values ($1,$2,$3,'penyesuaian',$4,$5,'manual')",
        [company, date, diff > 0 ? "revenue" : "expense", Math.abs(diff), `Penyesuaian rekonsiliasi ${date}${s(fd, "note") ? ` · ${s(fd, "note")}` : ""}`]);
  });
  refresh();
}
export async function deleteCheck(fd: FormData) { await requireOwner(); await q("delete from balance_checks where id=$1", [n(fd, "id")]); refresh(); }

/* ───────── Link investor (baca-saja) ───────── */
export async function makeInvestorLink() {
  await requireOwner();
  await q("insert into settings (key, value) values ('investor_token', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(randomBytes(18).toString("base64url"))]);
  refresh();
}
export async function revokeInvestorLink() {
  await requireOwner();
  await q("delete from settings where key = 'investor_token'");
  refresh();
}

/* ───────── AI ───────── */
export async function runAI(): Promise<FormState> {
  await requireOwner();
  try {
    const f = await loadFacts();
    return { ok: await aiNarrative(f, buildInsights(f)) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memanggil AI." };
  }
}

/* ───────── Data contoh (untuk mencoba tampilan; bisa dihapus) ───────── */
export async function loadDemo() {
  await requireOwner();
  const cos = await q<{ id: number; slug: string }>("select id, slug from companies");
  const partners = await q<{ id: number }>("select id from partners order by id limit 1");
  const pid = partners[0]?.id ?? null;
  const now = thisMonth();
  const prof: Record<string, { rev: number; cost: number; sal: number }> = {
    frameless: { rev: 28_000_000, cost: 9_000_000, sal: 8_000_000 },
    studiodo: { rev: 22_000_000, cost: 7_500_000, sal: 6_000_000 },
    photobooth: { rev: 9_000_000, cost: 3_000_000, sal: 2_000_000 },
    snapcup: { rev: 15_000_000, cost: 8_500_000, sal: 3_500_000 },
  };
  await tx(async (t) => {
    await t("delete from transactions where source='demo'");
    for (const c of cos) {
      const p = prof[c.slug]; if (!p) continue;
      await t("insert into transactions (company_id,date,kind,category,amount,funding,partner_id,memo,source) values ($1,$2,'capital_in','modal',$3,'company',$4,'Modal awal (contoh)','demo')", [c.id, `${addMonths(now, -5)}-02`, p.rev * 3, pid]);
      for (let i = 5; i >= 0; i--) {
        // Bulan berjalan: hanya sebesar porsi hari yang sudah lewat, agar proyeksi realistis.
        const dayNow = Number(today().slice(8, 10)), dim = new Date(Number(now.slice(0, 4)), Number(now.slice(5, 7)), 0).getDate();
        const m = addMonths(now, -i), grow = 0.82 + (5 - i) * 0.04 + (c.id % 3) * 0.02, f = i === 0 ? dayNow / dim : 1;
        const rows: [string, string, number, number, string][] = [
          ["revenue", "penjualan", Math.round(p.rev * grow * f), 12, "Pendapatan (contoh)"],
          ["expense", "gaji", Math.round(p.sal * f), 25, "Gaji tim (contoh)"],
          ["expense", "bahan", Math.round(p.cost * 0.5 * grow * f), 10, "Bahan & HPP (contoh)"],
          ["expense", "sewa", Math.round(p.cost * 0.3 * f), 5, "Sewa (contoh)"],
          ["expense", "marketing", Math.round(p.cost * 0.2 * grow * f), 15, "Iklan (contoh)"],
        ];
        for (const [kind, cat, amt, d, memo] of rows)
          await t("insert into transactions (company_id,date,kind,category,amount,memo,source) values ($1,$2,$3,$4,$5,$6,'demo')", [c.id, `${m}-${String(i === 0 ? Math.min(d, dayNow) : d).padStart(2, "0")}`, kind, cat, amt, memo]);
        if (i === 2) await t("insert into transactions (company_id,date,kind,category,amount,funding,partner_id,memo,source) values ($1,$2,'asset_purchase','alat',$3,'partner',$4,'Beli alat dari kantong pribadi (contoh)','demo')", [c.id, `${m}-18`, Math.round(p.rev * 0.5), pid]);
      }
    }
  });
  refresh();
}
export async function clearDemo() { await requireOwner(); await q("delete from transactions where source='demo'"); refresh(); }
