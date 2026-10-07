"use server";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { checkConflict, genCode } from "@/lib/bookingUtils";
import { expireStalePending, getOnline, publicSlots } from "@/lib/online";
import { fromWIB } from "@/lib/format";
import { parseOptions, roomAllowed, unitsFor } from "@/lib/packageUtils";

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
      const [pkg] = await t<{ id: number; name: string; price: number; category: string; duration_min: number; max_people: number; per_person: boolean; option_label: string; options: string }>(
        "select id, name, price, category, duration_min, max_people, per_person, option_label, options from packages where id = $1 and active and bookable_online", [pkgId]);
      if (!pkg) throw new Error("Paket ini tidak bisa dipesan online. Silakan hubungi kami.");
      const guests = Math.min(people, pkg.max_people);
      const opts = parseOptions(pkg.options);
      option = opts.length ? String(fd.get("option_choice") ?? "") : "";
      if (opts.length && !opts.includes(option)) throw new Error(`Pilih ${pkg.option_label || "varian"} terlebih dulu.`);
      const allowed = (await t<{ room_id: number }>("select room_id from package_rooms where package_id = $1", [pkg.id])).map((r) => r.room_id);
      const items = [{ kind: "package", ref_id: pkg.id, name: pkg.name, qty: unitsFor(pkg, guests), unit_price: pkg.price, category: pkg.category }];
      for (const [k, v] of fd.entries()) {
        const m = /^addon_(\d+)$/.exec(k);
        const qty = Math.min(20, parseInt(String(v), 10) || 0);
        if (!m || qty <= 0) continue;
        const [a] = await t<{ id: number; name: string; price: number }>("select id, name, price from addons where id = $1 and active", [Number(m[1])]);
        if (a) items.push({ kind: "addon", ref_id: a.id, name: a.name, qty, unit_price: a.price, category: "addon" });
      }
      const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
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
        `insert into bookings (code, customer_id, package_id, room_id, start_at, end_at, people, status, source, discount, total, notes, option_choice)
         values ($1,$2,$3,$4,$5,$6,$7,'pending','website',0,$8,$9,$10) returning id`,
        [code, customerId, pkg.id, roomId, start.toISOString(), end.toISOString(), guests, total,
          `[Booking online]${name ? ` a.n. ${name}` : ""}${notes ? ` — ${notes}` : ""}`, option]);
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
