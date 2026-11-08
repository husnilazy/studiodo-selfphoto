import { rgb } from "pdf-lib";
import { currentUser, isTeam } from "@/lib/auth";
import { q } from "@/lib/db";
import { EMP_COLS, ITEM_KIND, PAY_TYPE_LABEL, type Emp, type PayItem, type Slip } from "@/lib/payroll";
import { fullMonth, rupiah } from "@/lib/format";
import { terbilang } from "@/lib/terbilang";
import { getProfiles, idDate } from "@/lib/profile";
import { C, Pdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
const GREY = rgb(0.955, 0.955, 0.96), BLACK = rgb(0.05, 0.05, 0.06), WHITE = rgb(1, 1, 1);
const M = 48;

/** Slip gaji PDF. Owner & partner: semua; karyawan: hanya slip miliknya. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });
  const { id } = await params;
  const [sl] = await q<Slip>("select id, employee_id, company_id, period, base::bigint base, weeks, bonus::bigint bonus, fee::bigint fee, deduction::bigint deduction, net::bigint net, status, to_char(paid_on,'YYYY-MM-DD') as paid_on, tx_id, note, created_at from payslips where id = $1", [Number(id)]);
  if (!sl) return new Response("Slip tidak ditemukan.", { status: 404 });
  if (!isTeam(user) && !(user.role === "karyawan" && user.employeeId === sl.employee_id)) return new Response("Tidak berhak.", { status: 403 });
  const [[emp], [co], items] = await Promise.all([
    q<Emp>(`select ${EMP_COLS} from employees where id = $1`, [sl.employee_id]),
    q<{ name: string; slug: string; kind: string }>("select name, slug, kind from companies where id = $1", [sl.company_id]),
    q<PayItem>("select id, employee_id, to_char(date,'YYYY-MM-DD') as date, kind, amount::bigint as amount, project, note, payslip_id from pay_items where payslip_id = $1 order by date, id", [sl.id]),
  ]);
  const prof = (await getProfiles([co.slug]))[co.slug];
  const no = `SG-${sl.period.replace("-", "")}-${String(sl.id).padStart(4, "0")}`;
  const net = Number(sl.net);
  const plus = items.filter((i) => ITEM_KIND[i.kind]?.sign === 1), minus = items.filter((i) => ITEM_KIND[i.kind]?.sign === -1);
  const sub = (i: PayItem) => [i.project, i.note, idDate(i.date)].filter(Boolean).join(" · ");
  const nik = emp.id_number ? emp.id_number.replace(/\s/g, "").replace(/^(\d{4})\d+(\d{4})$/, (_m, a, b) => `${a}${"*".repeat(Math.max(0, emp.id_number.replace(/\s/g, "").length - 8))}${b}`) : "-";
  const W = 499.28;

  const p = await Pdf.create({ logoFrom: req.url });
  // ── Kop surat ──
  const top = p.y;
  if (p.logo && co.slug === "frameless") { const w = 128, h = (p.logo.height / p.logo.width) * w; p.page.drawImage(p.logo, { x: M, y: top - h, width: w, height: h }); p.y = top - h - 8; }
  else { p.at(co.name, M, top, { size: 15, b: true }); p.y = top - 24; }
  p.at(prof.legal_name || co.name, M, p.y, { size: 8.5, b: true }); p.y -= 12;
  const lines = [prof.address, [prof.nib && `NIB ${prof.nib}`, prof.npwp && `NPWP ${prof.npwp}`].filter(Boolean).join("  ·  "), [prof.phone, prof.email].filter(Boolean).join("  ·  ")].filter(Boolean);
  for (const l of lines) { p.text(l, { size: 7.5, color: C.mute, width: 330, lead: 10 }); }
  const left = p.y;
  p.at("SLIP GAJI", M + W, top, { size: 22, b: true, align: "right" });
  p.at(no, M + W, top + -28, { size: 8.5, color: C.mute, align: "right" });
  p.at(`Periode ${fullMonth(sl.period)}`, M + W, top - 40, { size: 8.5, color: C.mute, align: "right" });
  p.at(sl.status === "dibayar" ? "DIBAYAR" : "DRAFT", M + W, top - 54, { size: 8, b: true, color: sl.status === "dibayar" ? rgb(0.1, 0.5, 0.3) : rgb(0.7, 0.45, 0.05), align: "right" });
  p.y = Math.min(left, top - 66) - 6;
  p.rect(M, p.y, W, 2, BLACK); p.y -= 14;

  // ── Data karyawan ──
  const cell = (x: number, y: number, label: string, value: string) => { p.at(label.toUpperCase(), x, y, { size: 6.8, color: C.mute }); p.at(value, x, y - 10, { size: 9.5, b: true }); };
  const boxTop = p.y, rowH = 31, rows = 4;
  p.rect(M, boxTop, W, rowH * rows + 40, GREY);
  const c1 = M + 12, c2 = M + W / 2 + 6;
  const L: [string, string][] = [["Nama", emp.name], ["Jabatan", emp.position || emp.role || "-"], ["Unit usaha", co.name], ["Jenis gaji", PAY_TYPE_LABEL[emp.pay_type]]];
  const R: [string, string][] = [["NIK", nik], ["Bergabung", emp.join_date ? idDate(emp.join_date) : "-"], ["Telepon", emp.phone || "-"], ["Tanggal dibayar", sl.paid_on ? idDate(sl.paid_on) : "Belum dibayar"]];
  L.forEach(([k, v], i) => cell(c1, boxTop - 9 - i * rowH, k, v));
  R.forEach(([k, v], i) => cell(c2, boxTop - 9 - i * rowH, k, v));
  const ry = boxTop - 9 - rows * rowH + 2;
  p.rect(M + 12, ry + 4, W - 24, 0.6, C.line);
  cell(c1, ry - 3, "Rekening penerima", emp.bank_account ? `${emp.bank_name || "Bank"}  ${emp.bank_account}  a.n. ${emp.name}` : "Belum diisi di data karyawan");
  p.y = boxTop - (rowH * rows + 40) - 16;

  // ── Tabel ──
  p.rect(M, p.y, W, 20, BLACK);
  p.at("KETERANGAN", M + 10, p.y - 6, { size: 8, b: true, color: WHITE });
  p.at("JUMLAH", M + W - 10, p.y - 6, { size: 8, b: true, color: WHITE, align: "right" });
  p.y -= 20;
  let z = 0;
  const section = (title: string) => { p.need(24); p.rect(M, p.y, W, 18, rgb(0.9, 0.9, 0.92)); p.at(title, M + 10, p.y - 5, { size: 7.8, b: true, color: C.mute }); p.y -= 18; z = 0; };
  const row = (label: string, subt: string | undefined, amount: string, neg = false) => {
    const h = subt ? 28 : 20; p.need(h + 4);
    if (z++ % 2 === 1) p.rect(M, p.y, W, h, rgb(0.985, 0.985, 0.99));
    p.at(label, M + 10, p.y - 5.5, { size: 9.5 });
    if (subt) p.at(subt, M + 10, p.y - 17, { size: 7.5, color: C.mute });
    p.at(amount, M + W - 10, p.y - 5.5, { size: 9.5, align: "right", color: neg ? C.bad : C.ink });
    p.y -= h;
  };
  const subtotal = (label: string, v: string) => { p.need(24); p.rect(M, p.y, W, 0.6, C.line); p.at(label, M + 10, p.y - 6, { size: 9, b: true }); p.at(v, M + W - 10, p.y - 6, { size: 9, b: true, align: "right" }); p.y -= 22; };

  section("PENDAPATAN");
  if (Number(sl.base) > 0) row(emp.pay_type === "weekly" ? "Gaji pokok mingguan" : "Gaji pokok", emp.pay_type === "weekly" ? `${sl.weeks} minggu x ${rupiah(emp.salary)}` : undefined, rupiah(Number(sl.base)));
  plus.forEach((i) => row(ITEM_KIND[i.kind].label, sub(i), rupiah(Number(i.amount))));
  if (Number(sl.base) === 0 && plus.length === 0) row("Tidak ada pendapatan", undefined, rupiah(0));
  subtotal("Total pendapatan", rupiah(Number(sl.base) + plus.reduce((t, i) => t + Number(i.amount), 0)));
  section("POTONGAN");
  if (!minus.length) row("Tidak ada potongan", undefined, rupiah(0));
  minus.forEach((i) => row(ITEM_KIND[i.kind].label, sub(i), rupiah(-Number(i.amount)), true));
  subtotal("Total potongan", rupiah(-minus.reduce((t, i) => t + Number(i.amount), 0)));

  // ── Total ──
  p.gap(4); p.need(70);
  p.rect(M, p.y, W, 42, BLACK);
  p.at("TOTAL DITERIMA", M + 14, p.y - 9, { size: 8, b: true, color: rgb(0.75, 0.75, 0.78) });
  p.at(rupiah(net), M + 14, p.y - 21, { size: 17, b: true, color: WHITE });
  p.at(emp.bank_account ? `Transfer ke ${emp.bank_name || "rekening"} ${emp.bank_account}` : "", M + W - 14, p.y - 25, { size: 8, color: rgb(0.75, 0.75, 0.78), align: "right" });
  p.y -= 52;
  p.text(`Terbilang: ${terbilang(net)} rupiah`, { size: 9, color: C.mute });
  if (sl.note) { p.gap(2); p.text(`Catatan: ${sl.note}`, { size: 9, color: C.mute }); }

  // ── Tanda tangan ──
  p.gap(18); p.need(118);
  const y0 = p.y, half = 200;
  p.at("Penerima,", M + 10, y0, { size: 9, color: C.mute });
  p.at(`${prof.legal_name || co.name},`, M + W - half - 10, y0, { size: 9, color: C.mute });
  const sy = y0 - 70;
  p.rect(M + 10, sy, half, 0.7, C.mute); p.rect(M + W - half - 10, sy, half, 0.7, C.mute);
  p.at(emp.name, M + 10, sy - 5, { size: 9.5, b: true });
  p.at(prof.director || "Owner", M + W - half - 10, sy - 5, { size: 9.5, b: true });
  p.at(prof.director ? "Direktur / Owner" : "", M + W - half - 10, sy - 17, { size: 8, color: C.mute });
  p.y = sy - 30;

  p.footer(`${prof.legal_name || co.name}${prof.nib ? ` · NIB ${prof.nib}` : ""} · Dokumen dibuat otomatis oleh Frameless Hub · ${no} · rahasia, hanya untuk penerima`);
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  return pdfResponse(await p.bytes(), `Slip-${emp.name}-${sl.period}.pdf`, dl);
}
