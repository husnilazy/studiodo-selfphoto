"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { bool, int, safe, str } from "@/lib/action";
import { sanitizeMember } from "@/lib/pricing";
import type { ActionState } from "@/components/ActionForm";

export async function saveMemberCfg(_p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const tiers = [];
    for (let i = 0; i < 6; i++) {
      const name = str(fd, `tier_name_${i}`);
      if (name) tiers.push({ name, min_visits: int(fd, `tier_min_${i}`), percent: int(fd, `tier_pct_${i}`) });
    }
    if (tiers.length === 0) throw new Error("Isi minimal satu tingkat member.");
    const cfg = sanitizeMember({
      enabled: bool(fd, "enabled"), tiers, reward_every: int(fd, "reward_every"), reward_percent: int(fd, "reward_percent") || 100, auto_join_visits: int(fd, "auto_join_visits"),
    });
    await q("insert into settings (key, value) values ('member', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(cfg)]);
    revalidatePath("/member");
    revalidatePath("/", "layout");
  });
}

async function enroll(customerId: number) {
  await q(
    `update customers set is_member = true, member_since = coalesce(member_since, (now() at time zone 'Asia/Jakarta')::date),
            member_no = case when member_no = '' then 'SD-' || lpad(id::text, 4, '0') else member_no end where id = $1`, [customerId]);
}

/** Daftarkan customer lama (customer_id) atau baru (new_name + new_phone) sebagai member. */
export async function joinMember(_p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    let id = int(fd, "customer_id");
    if (!id) {
      const name = str(fd, "new_name");
      if (!name) throw new Error("Pilih customer lama atau isi nama customer baru.");
      const phone = str(fd, "new_phone"), digits = phone.replace(/\D/g, "");
      const dupe = digits.length >= 8 ? (await q<{ id: number }>("select id from customers where regexp_replace(phone, '\\D', '', 'g') = $1 limit 1", [digits]))[0] : null;
      id = dupe?.id ?? (await q<{ id: number }>("insert into customers (name, phone) values ($1,$2) returning id", [name, phone]))[0].id;
    }
    await enroll(id);
    revalidatePath("/member");
    revalidatePath("/customer");
    return { ok: true, message: "Member terdaftar" };
  });
}

export async function setMember(customerId: number, on: boolean, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    if (on) await enroll(customerId);
    else await q("update customers set is_member = false where id = $1", [customerId]);
    revalidatePath("/member");
    revalidatePath(`/customer/${customerId}`);
    revalidatePath("/customer");
  });
}
