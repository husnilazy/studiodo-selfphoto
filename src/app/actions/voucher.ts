"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { bool, int, safe, str } from "@/lib/action";
import { CODE_ALPHABET } from "@/lib/pricing";
import { normCode } from "@/lib/pricingServer";
import { catList, idList, wibInput } from "@/lib/formParse";
import type { ActionState } from "@/components/ActionForm";

const rand = (n: number) => Array.from({ length: n }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** Buat satu atau banyak voucher sekaligus (acak, atau satu kode buatan sendiri). */
export async function generateVouchers(_p: ActionState, fd: FormData) {
  return safe(async () => {
    const user = await actionUser(["owner", "admin"]);
    const kind = str(fd, "kind") === "amount" ? "amount" : "percent";
    const value = int(fd, "value");
    if (value <= 0) throw new Error("Nilai voucher harus lebih dari 0.");
    if (kind === "percent" && value > 100) throw new Error("Persen maksimal 100.");
    const starts = wibInput(fd, "starts_at"), expires = wibInput(fd, "expires_at");
    if (starts && expires && expires <= starts) throw new Error("Tanggal kedaluwarsa harus setelah tanggal mulai.");
    const pkgIds = idList(fd, "package_ids"), cats = pkgIds.length ? [] : catList(fd, "categories");
    const customerId = int(fd, "customer_id") || null;
    const custom = normCode(str(fd, "custom_code"));
    const count = custom ? 1 : Math.max(1, Math.min(500, int(fd, "count") || 1));
    const prefix = normCode(str(fd, "prefix")).replace(/-/g, "").slice(0, 8);
    const len = Math.max(4, Math.min(12, int(fd, "length") || 6));
    const name = str(fd, "name").slice(0, 80);
    const batch = str(fd, "batch").slice(0, 60) || (name || prefix || "Voucher");
    const common = [name, batch, kind, value, int(fd, "max_discount"), int(fd, "min_spend"), Math.max(1, int(fd, "min_people") || 1), pkgIds, cats,
      Math.max(0, int(fd, "usage_limit")), Math.max(0, int(fd, "per_customer")), starts?.toISOString() ?? null, expires?.toISOString() ?? null,
      bool(fd, "member_only"), customerId, bool(fd, "stackable"), user.id];
    const made: string[] = [];
    await tx(async (t) => {
      for (let tries = 0; made.length < count && tries < count * 8 + 20; tries++) {
        const code = custom || `${prefix ? prefix + "-" : ""}${rand(len)}`;
        const r = await t<{ id: number }>(
          `insert into vouchers (code, name, batch, kind, value, max_discount, min_spend, min_people, package_ids, categories, usage_limit, per_customer, starts_at, expires_at, member_only, customer_id, stackable, created_by)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) on conflict (code) do nothing returning id`, [code, ...common]);
        if (r.length) made.push(code);
        else if (custom) throw new Error(`Kode ${custom} sudah dipakai. Pilih kode lain.`);
      }
    });
    if (made.length < count) throw new Error("Gagal membuat semua kode unik. Coba tambah panjang kode.");
    revalidatePath("/promo");
    return { ok: true, message: `${made.length} voucher dibuat` };
  });
}

export async function updateVoucher(id: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("update vouchers set name=$1, usage_limit=$2, per_customer=$3, expires_at=$4, active=$5 where id=$6",
      [str(fd, "name").slice(0, 80), Math.max(0, int(fd, "usage_limit")), Math.max(0, int(fd, "per_customer")), wibInput(fd, "expires_at")?.toISOString() ?? null, bool(fd, "active"), id]);
    revalidatePath("/promo");
  });
}

export async function setVoucherActive(id: number, active: boolean, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("update vouchers set active = $1 where id = $2", [active, id]);
    revalidatePath("/promo");
  });
}

export async function deleteVoucher(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const [u] = await q<{ n: number }>("select count(*)::int as n from voucher_redemptions where voucher_id = $1", [id]);
    if (u.n > 0) throw new Error("Voucher ini sudah pernah dipakai. Nonaktifkan saja agar riwayatnya tetap ada.");
    await q("delete from vouchers where id = $1", [id]);
    revalidatePath("/promo");
  });
}

/** Hapus massal voucher satu batch yang belum pernah dipakai. */
export async function deleteBatch(batch: string, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const r = await q<{ id: number }>("delete from vouchers v where v.batch = $1 and not exists (select 1 from voucher_redemptions r where r.voucher_id = v.id) returning id", [batch]);
    revalidatePath("/promo");
    return { ok: true, message: `${r.length} voucher dihapus` };
  });
}
