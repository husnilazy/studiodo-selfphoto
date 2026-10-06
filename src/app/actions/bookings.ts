"use server";
import { revalidatePath } from "next/cache";
import { q as rootQ, tx, type Q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { bool, int, req, safe, str } from "@/lib/action";
import { allocateRevenue, METHOD_ACCOUNT, postJournal, voidJournal } from "@/lib/ledger";
import { dateWIB, fromWIB, rupiah } from "@/lib/format";
import { checkConflict, genCode } from "@/lib/bookingUtils";
import type { ActionState } from "@/components/ActionForm";

const STATUSES = ["pending", "confirmed", "done", "cancelled", "no_show"];
const METHODS = ["cash", "qris", "transfer"];

async function resolveCustomer(q: Q, fd: FormData): Promise<number> {
  const existing = int(fd, "customer_id");
  if (existing) {
    const [c] = await q<{ id: number }>("select id from customers where id = $1", [existing]);
    if (!c) throw new Error("Customer tidak ditemukan.");
    return c.id;
  }
  const name = str(fd, "new_name");
  if (!name) throw new Error("Pilih customer lama atau isi nama customer baru.");
  const phone = str(fd, "new_phone");
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8) {
    const [dupe] = await q<{ id: number }>(
      "select id from customers where regexp_replace(phone, '\\D', '', 'g') = $1 limit 1", [digits]);
    if (dupe) return dupe.id;
  }
  const [c] = await q<{ id: number }>("insert into customers (name, phone) values ($1,$2) returning id", [name, phone]);
  return c.id;
}

type ItemInput = { kind: "package" | "addon" | "custom"; ref_id: number | null; name: string; qty: number; unit_price: number; category: string };

async function buildItems(q: Q, fd: FormData) {
  const items: ItemInput[] = [];
  const pkgId = int(fd, "package_id");
  let duration = 30;
  let pkgName = "";
  if (pkgId) {
    const [p] = await q<{ id: number; name: string; price: number; category: string; duration_min: number }>(
      "select id, name, price, category, duration_min from packages where id = $1", [pkgId]);
    if (!p) throw new Error("Paket tidak ditemukan.");
    duration = p.duration_min;
    pkgName = p.name;
    items.push({ kind: "package", ref_id: p.id, name: p.name, qty: 1, unit_price: p.price, category: p.category });
  }
  for (const [k, v] of fd.entries()) {
    const m = /^addon_(\d+)$/.exec(k);
    if (!m) continue;
    const qty = parseInt(String(v), 10) || 0;
    if (qty <= 0) continue;
    const [a] = await q<{ id: number; name: string; price: number }>("select id, name, price from addons where id = $1", [Number(m[1])]);
    if (a) items.push({ kind: "addon", ref_id: a.id, name: a.name, qty, unit_price: a.price, category: "addon" });
  }
  const cName = str(fd, "custom_name"), cPrice = int(fd, "custom_price");
  if (cName && cPrice > 0) items.push({ kind: "custom", ref_id: null, name: cName, qty: 1, unit_price: cPrice, category: "lainnya" });
  if (items.length === 0) throw new Error("Pilih paket atau tambahkan minimal satu item.");
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const discount = Math.min(Math.max(0, int(fd, "discount")), subtotal);
  return { items, subtotal, discount, total: subtotal - discount, duration, pkgId: pkgId || null, pkgName };
}

/** Mencatat pembayaran + jurnalnya (kas bertambah, pendapatan diakui — metode kas). */
async function recordPayment(q: Q, bookingId: number, p: { kind: "dp" | "payment" | "refund"; method: string; amount: number; note?: string; paidAt?: Date; userId: number }) {
  const items = await q<{ category: string; amount: number }>("select category, amount from booking_items where booking_id = $1", [bookingId]);
  const [b] = await q<{ code: string }>("select code from bookings where id = $1", [bookingId]);
  const alloc = allocateRevenue(items, p.amount);
  const cash = METHOD_ACCOUNT[p.method];
  const paidAt = p.paidAt ?? new Date();
  const refund = p.kind === "refund";
  const [pay] = await q<{ id: number }>(
    "insert into payments (booking_id, kind, method, amount, paid_at, note, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id",
    [bookingId, p.kind, p.method, p.amount, paidAt.toISOString(), p.note ?? "", p.userId]);
  const jid = await postJournal(q, {
    date: dateWIB(paidAt),
    memo: `${refund ? "Refund" : p.kind === "dp" ? "DP" : "Pembayaran"} booking ${b.code}`,
    refType: "payment", refId: pay.id, userId: p.userId,
    lines: refund
      ? [...alloc.map((a) => ({ account: a.account, debit: a.amount })), { account: cash, credit: p.amount }]
      : [{ account: cash, debit: p.amount }, ...alloc.map((a) => ({ account: a.account, credit: a.amount }))],
  });
  await q("update payments set journal_id = $1 where id = $2", [jid, pay.id]);
}

async function paidNet(q: Q, bookingId: number) {
  const [r] = await q<{ paid: number }>(
    "select coalesce(sum(case when kind='refund' then -amount else amount end),0) as paid from payments where booking_id=$1 and not voided", [bookingId]);
  return r.paid;
}

function parseWhen(fd: FormData) {
  const date = req(str(fd, "date"), "Tanggal wajib diisi.");
  const time = req(str(fd, "time"), "Jam wajib diisi.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Format tanggal/jam tidak valid.");
  return fromWIB(date, time);
}

export async function createBooking(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser();
    const start = parseWhen(fd);
    const roomId = int(fd, "room_id") || null;
    const status = str(fd, "status") || "confirmed";
    if (!STATUSES.includes(status)) throw new Error("Status tidak valid.");
    const method = str(fd, "pay_method") || "cash";
    if (!METHODS.includes(method)) throw new Error("Metode bayar tidak valid.");

    const id = await tx(async (q) => {
      const customerId = await resolveCustomer(q, fd);
      const b = await buildItems(q, fd);
      const end = new Date(start.getTime() + b.duration * 60000);
      await checkConflict(q, roomId, start, end, null);
      const code = await genCode(q);
      const [row] = await q<{ id: number }>(
        `insert into bookings (code, customer_id, package_id, room_id, start_at, end_at, people, status, source, discount, total, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [code, customerId, b.pkgId, roomId, start.toISOString(), end.toISOString(), Math.max(1, int(fd, "people")), status,
          str(fd, "source") || "walkin", b.discount, b.total, str(fd, "notes"), user.id]);
      for (const i of b.items) {
        await q("insert into booking_items (booking_id, kind, ref_id, name, qty, unit_price, amount, category) values ($1,$2,$3,$4,$5,$6,$7,$8)",
          [row.id, i.kind, i.ref_id, i.name, i.qty, i.unit_price, i.qty * i.unit_price, i.category]);
      }
      const payFull = bool(fd, "pay_full");
      const dp = payFull ? b.total : Math.min(int(fd, "dp_amount"), b.total);
      if (dp > 0) await recordPayment(q, row.id, { kind: payFull ? "payment" : "dp", method, amount: dp, userId: user.id });
      return row.id;
    });
    revalidatePath("/booking");
    revalidatePath("/dashboard");
    return { ok: true, redirect: `/booking/${id}` };
  });
}

export async function updateBooking(id: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser();
    const start = parseWhen(fd);
    const roomId = int(fd, "room_id") || null;
    await tx(async (q) => {
      const [cur] = await q<{ id: number }>("select id from bookings where id = $1 for update", [id]);
      if (!cur) throw new Error("Booking tidak ditemukan.");
      const b = await buildItems(q, fd);
      const end = new Date(start.getTime() + b.duration * 60000);
      await checkConflict(q, roomId, start, end, id);
      await q(
        `update bookings set package_id=$1, room_id=$2, start_at=$3, end_at=$4, people=$5, source=$6,
                discount=$7, total=$8, notes=$9 where id=$10`,
        [b.pkgId, roomId, start.toISOString(), end.toISOString(), Math.max(1, int(fd, "people")),
          str(fd, "source") || "walkin", b.discount, b.total, str(fd, "notes"), id]);
      await q("delete from booking_items where booking_id = $1", [id]);
      for (const i of b.items) {
        await q("insert into booking_items (booking_id, kind, ref_id, name, qty, unit_price, amount, category) values ($1,$2,$3,$4,$5,$6,$7,$8)",
          [id, i.kind, i.ref_id, i.name, i.qty, i.unit_price, i.qty * i.unit_price, i.category]);
      }
    });
    revalidatePath("/booking");
    revalidatePath(`/booking/${id}`);
    revalidatePath("/dashboard");
    return { ok: true, redirect: `/booking/${id}` };
  });
}

export async function setBookingStatus(id: number, status: string, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    if (!STATUSES.includes(status)) throw new Error("Status tidak valid.");
    if (status === "confirmed" || status === "pending" || status === "done") {
      // Menghidupkan kembali booking: pastikan ruang masih kosong.
      await tx(async (q) => {
        const [b] = await q<{ room_id: number | null; start_at: string; end_at: string }>("select room_id, start_at, end_at from bookings where id=$1", [id]);
        if (!b) throw new Error("Booking tidak ditemukan.");
        await checkConflict(q, b.room_id, new Date(b.start_at), new Date(b.end_at), id);
        await q("update bookings set status = $1 where id = $2", [status, id]);
      });
    } else {
      await rootQ("update bookings set status = $1 where id = $2", [status, id]);
    }
    revalidatePath("/booking");
    revalidatePath(`/booking/${id}`);
    revalidatePath("/dashboard");
  });
}

export async function deleteBooking(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const [n] = await rootQ<{ n: number }>("select count(*)::int as n from payments where booking_id = $1", [id]);
    if (n.n > 0) throw new Error("Booking ini punya catatan pembayaran. Batalkan saja (status Dibatalkan) agar laporan keuangan tetap utuh.");
    await rootQ("delete from bookings where id = $1", [id]);
    revalidatePath("/booking");
    revalidatePath("/dashboard");
    return { ok: true, redirect: "/booking" };
  });
}

export async function addPayment(bookingId: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser();
    const method = str(fd, "method");
    if (!METHODS.includes(method)) throw new Error("Pilih metode pembayaran.");
    const amount = int(fd, "amount");
    if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
    await tx(async (q) => {
      const [b] = await q<{ total: number; status: string }>("select total, status from bookings where id = $1 for update", [bookingId]);
      if (!b) throw new Error("Booking tidak ditemukan.");
      const remaining = b.total - (await paidNet(q, bookingId));
      if (amount > remaining) throw new Error(`Melebihi sisa tagihan (${rupiah(remaining)}).`);
      const kindRaw = str(fd, "kind");
      const kind = kindRaw === "dp" ? "dp" : "payment";
      await recordPayment(q, bookingId, { kind, method, amount, note: str(fd, "note"), userId: user.id });
      if (b.status === "pending") await q("update bookings set status = 'confirmed' where id = $1", [bookingId]);
    });
    revalidatePath(`/booking/${bookingId}`);
    revalidatePath("/booking");
    revalidatePath("/dashboard");
    revalidatePath("/keuangan");
  });
}

export async function refundPayment(bookingId: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner", "admin"]);
    const method = str(fd, "method");
    if (!METHODS.includes(method)) throw new Error("Pilih metode pengembalian.");
    const amount = int(fd, "amount");
    if (amount <= 0) throw new Error("Nominal harus lebih dari 0.");
    await tx(async (q) => {
      const paid = await paidNet(q, bookingId);
      if (amount > paid) throw new Error(`Refund melebihi total yang sudah dibayar (${rupiah(paid)}).`);
      await recordPayment(q, bookingId, { kind: "refund", method, amount, note: str(fd, "note"), userId: user.id });
    });
    revalidatePath(`/booking/${bookingId}`);
    revalidatePath("/keuangan");
    revalidatePath("/dashboard");
  });
}

export async function voidPayment(paymentId: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const bookingId = await tx(async (q) => {
      const [p] = await q<{ booking_id: number; journal_id: number | null; voided: boolean }>(
        "select booking_id, journal_id, voided from payments where id = $1 for update", [paymentId]);
      if (!p) throw new Error("Pembayaran tidak ditemukan.");
      if (p.voided) throw new Error("Pembayaran sudah dibatalkan.");
      await q("update payments set voided = true where id = $1", [paymentId]);
      if (p.journal_id) await voidJournal(q, p.journal_id);
      return p.booking_id;
    });
    revalidatePath(`/booking/${bookingId}`);
    revalidatePath("/keuangan");
    revalidatePath("/dashboard");
  });
}
