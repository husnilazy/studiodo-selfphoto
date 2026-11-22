"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { checkConflict, genCode } from "@/lib/bookingUtils";
import { expireStalePending, getOnline, publicSlots } from "@/lib/online";
import { fromWIB } from "@/lib/format";
import { buildQuote } from "@/lib/pricingServer";
import { itemName, itemUnitPrice, parseOptions, roomAllowed, unitsFor } from "@/lib/packageUtils";

type Result = { ok: true; redirect: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** Booking dari website. Status "Menunggu" sampai admin menerima DP/konfirmasi. */
export async function createPublicBooking(fd: FormData): Promise<Result> {
  try {
    if (String(fd.get("website") ?? "")) return fail("Permintaan ditolak."); // honeypot
    const o = await getOnline();
    if (!o.enabled) return fail("Booking online sedang ditutup. Hubungi kami lewat WhatsApp.");
    await expireStalePending();

    const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    const phoneRaw = String(fd.get("phone") ?? "").trim();
    const digits = phoneRaw.replace(/\D/g, "");
    if (name.length < 2) return fail("Nama minimal 2 huruf.");
    if (digits.length < 9 || digits.length > 15) return fail("Nomor WhatsApp tidak valid.");
    const pkgId = Number(fd.get("package_id"));
    const date = String(fd.get("date") ?? ""), time = String(fd.get("time") ?? "");
    if (!pkgId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return fail("Lengkapi pilihan layanan, tanggal, dan jam.");
    const wantRoom = Number(fd.get("room_id")) || null;
    const people = Math.max(1, Math.min(99, parseInt(String(fd.get("people") ?? "1"), 10) || 1));
    const notes = String(fd.get("notes") ?? "").trim().slice(0, 500);

    // Pembatasan penyalahgunaan: per nomor & keseluruhan.
    const [lim] = await q<{ mine: number; all: number }>(
      `select count(*) filter (where regexp_replace(c.phone, '\\D', '', 'g') = $1)::int as mine, count(*)::int as "all"
         from bookings b join customers c on c.id = b.customer_id
        where b.source = 'website' and b.status = 'pending' and b.created_at > now() - interval '1 hour'`, [digits]);
    if (lim.mine >= 3) return fail("Anda sudah punya beberapa booking yang menunggu. Silakan hubungi kami lewat WhatsApp.");
    if (lim.all >= 60) return fail("Sedang banyak permintaan. Coba lagi beberapa menit lagi.");

    const slots = await publicSlots(date, pkgId, wantRoom);
    const slot = slots.find((s) => s.t === time);
    if (!slot) return fail("Maaf, jam itu baru saja terisi. Silakan pilih jam lain.");

    let option = "";
    const id = await tx(async (t) => {
      const [pkg] = await t<{ id: number; name: string; price: number; category: string; duration_min: number; max_people: number; per_person: boolean; option_label: string; options: string; min_people: number; included_people: number; extra_person_price: number }>(
        "select id, name, price, category, duration_min, max_people, per_person, option_label, options, min_people, included_people, extra_person_price from packages where id = $1 and active and bookable_online", [pkgId]);
      if (!pkg) throw new Error("Paket ini tidak bisa dipesan online. Silakan hubungi kami.");
      const guests = Math.min(people, pkg.max_people);
      if (guests < pkg.min_people) throw new Error(`Paket ${pkg.name} minimal ${pkg.min_people} orang.`);
      const opts = parseOptions(pkg.options);
      option = opts.length ? String(fd.get("option_choice") ?? "") : "";
      if (opts.length && !opts.includes(option)) throw new Error(`Pilih ${pkg.option_label || "varian"} terlebih dulu.`);
      const allowed = (await t<{ room_id: number }>("select room_id from package_rooms where package_id = $1", [pkg.id])).map((r) => r.room_id);
      const items = [{ kind: "package", ref_id: pkg.id, name: itemName(pkg.name, pkg, guests), qty: unitsFor(pkg, guests), unit_price: itemUnitPrice(pkg, guests), category: pkg.category }];
      for (const [k, v] of fd.entries()) {
        const m = /^addon_(\d+)$/.exec(k);
        const qty = Math.min(20, parseInt(String(v), 10) || 0);
        if (!m || qty <= 0) continue;
        const [a] = await t<{ id: number; name: string; price: number }>("select id, name, price from addons where id = $1 and active", [Number(m[1])]);
        if (a) items.push({ kind: "addon", ref_id: a.id, name: a.name, qty, unit_price: a.price, category: "addon" });
      }
      const extras = items.filter((i) => i.kind === "addon").reduce((s, i) => s + i.qty * i.unit_price, 0);
      const qr = await buildQuote(t, { packageId: pkg.id, people: guests, extras, phone: phoneRaw, voucherCode: String(fd.get("voucher_code") ?? "").slice(0, 40), auto: true });
      if (qr.voucherError) throw new Error(qr.voucherError);
      const total = qr.total;
      const start = fromWIB(date, time), end = new Date(start.getTime() + pkg.duration_min * 60000);

      // Pilih ruang: yang diminta, atau yang pertama kosong.
      let roomId = wantRoom;
      if (!roomId) roomId = slot.rooms[0];
      if (!roomAllowed({ room_ids: allowed }, roomId)) throw new Error("Background itu tidak tersedia untuk layanan ini.");
      await checkConflict(t, roomId, start, end, null);

      let customerId: number;
      const [dupe] = await t<{ id: number }>("select id from customers where regexp_replace(phone, '\\D', '', 'g') = $1 limit 1", [digits]);
      if (dupe) customerId = dupe.id;
      else customerId = (await t<{ id: number }>("insert into customers (name, phone) values ($1,$2) returning id", [name, phoneRaw]))[0].id;

      const code = await genCode(t);
      const [b] = await t<{ id: number }>(
        `insert into bookings (code, customer_id, package_id, room_id, start_at, end_at, people, status, source, discount, total, notes, option_choice, discount_detail)
         values ($1,$2,$3,$4,$5,$6,$7,'pending','website',$11,$8,$9,$10,$12::jsonb) returning id`,
        [code, customerId, pkg.id, roomId, start.toISOString(), end.toISOString(), guests, total,
          `[Booking online]${name ? ` a.n. ${name}` : ""}${notes ? ` — ${notes}` : ""}`, option, qr.discount, JSON.stringify(qr.lines)]);
      if (qr.voucher) await t("insert into voucher_redemptions (voucher_id, booking_id, customer_id, amount) values ($1,$2,$3,$4)", [qr.voucher.id, b.id, customerId, qr.lines.find((l) => l.type === "voucher")?.amount ?? 0]);
      for (const i of items) {
        await t("insert into booking_items (booking_id, kind, ref_id, name, qty, unit_price, amount, category) values ($1,$2,$3,$4,$5,$6,$7,$8)",
          [b.id, i.kind, i.ref_id, i.name, i.qty, i.unit_price, i.qty * i.unit_price, i.category]);
      }
      return { id: b.id, code };
    });
    revalidatePath("/booking");
    revalidatePath("/dashboard");
    return { ok: true, redirect: `/book/selesai?c=${id.code}&t=${signToken(id.code)}` };
  } catch (e) {
    console.error(e);
    return fail(e instanceof Error && !/ECONN|timeout|relation|syntax/i.test(e.message) ? e.message : "Terjadi gangguan. Coba lagi sebentar.");
  }
}

/* ───────── Cek status booking (nomor WhatsApp + kode booking) ───────── */
// Pembatas percobaan (per instance): maks 8 gagal / 15 menit per nomor atau per IP.
const lookupFails = new Map<string, number[]>();
const lookupBlocked = (k: string) => { const now = Date.now(); const a = (lookupFails.get(k) ?? []).filter((t) => now - t < 15 * 60_000); lookupFails.set(k, a); return a.length >= 8; };
const lookupBump = (k: string) => lookupFails.set(k, [...(lookupFails.get(k) ?? []), Date.now()]);

/** Pelanggan membuka halaman status bookingnya sendiri. Mengembalikan tautan halaman status bertanda tangan. */
export async function findBooking(phone: string, codeRaw: string): Promise<Result> {
  const d = String(phone ?? "").replace(/\D/g, "");
  const code = String(codeRaw ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  if (d.length < 9) return fail("Nomor WhatsApp tidak valid.");
  if (!code) return fail("Masukkan kode booking.");
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "ip";
  const kPhone = `b:${d.slice(-9)}`, kIp = `bi:${ip}`;
  if (lookupBlocked(kPhone) || lookupBlocked(kIp)) return fail("Terlalu banyak percobaan. Coba lagi 15 menit lagi.");
  const rows = await q<{ code: string }>(
    `select b.code from bookings b join customers c on c.id = b.customer_id
      where upper(b.code) = $1 and right(regexp_replace(c.phone, '\D', '', 'g'), 9) = $2 limit 1`, [code, d.slice(-9)]);
  if (!rows.length) {
    lookupBump(kPhone); lookupBump(kIp);
    return fail("Nomor WhatsApp dan kode booking tidak cocok. Periksa pesan konfirmasi atau struk kamu.");
  }
  return { ok: true, redirect: `/book/selesai?c=${rows[0].code}&t=${signToken(rows[0].code)}` };
}
