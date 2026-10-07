"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { bool, int, req, safe, str } from "@/lib/action";
import { catList, idList, wibInput } from "@/lib/formParse";
import type { ActionState } from "@/components/ActionForm";

const KINDS = ["percent", "amount_unit", "amount_total", "free_units"];

export async function savePromo(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const name = req(str(fd, "name"), "Nama promo wajib diisi.").slice(0, 80);
    const label = str(fd, "label").slice(0, 60);
    const kind = str(fd, "kind");
    if (!KINDS.includes(kind)) throw new Error("Jenis diskon tidak valid.");
    const value = int(fd, "value");
    if (value <= 0) throw new Error("Nilai diskon harus lebih dari 0.");
    if (kind === "percent" && value > 100) throw new Error("Persen maksimal 100.");
    const minPeople = Math.max(1, Math.min(99, int(fd, "min_people") || 1));
    const starts = wibInput(fd, "starts_at"), ends = wibInput(fd, "ends_at");
    if (starts && ends && ends <= starts) throw new Error("Waktu berakhir harus setelah waktu mulai.");
    const showCountdown = bool(fd, "show_countdown");
    if (showCountdown && !ends) throw new Error("Countdown butuh waktu berakhir. Isi “Berakhir”, atau matikan countdown.");
    const pkgIds = idList(fd, "package_ids"), cats = pkgIds.length ? [] : catList(fd, "categories");
    const v = [name, label, kind, value, minPeople, pkgIds, cats, starts?.toISOString() ?? null, ends?.toISOString() ?? null, showCountdown, bool(fd, "show_on_site"), bool(fd, "active")];
    if (id) await q("update promos set name=$1, label=$2, kind=$3, value=$4, min_people=$5, package_ids=$6, categories=$7, starts_at=$8, ends_at=$9, show_countdown=$10, show_on_site=$11, active=$12 where id=$13", [...v, id]);
    else await q("insert into promos (name, label, kind, value, min_people, package_ids, categories, starts_at, ends_at, show_countdown, show_on_site, active) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", v);
    revalidatePath("/promo");
    revalidatePath("/", "layout");
  });
}

export async function deletePromo(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("delete from promos where id = $1", [id]);
    revalidatePath("/promo");
    revalidatePath("/", "layout");
  });
}
