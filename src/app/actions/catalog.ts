"use server";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { parseEventAddons, parseOptions, parseOutputs, serializeEventAddons } from "@/lib/packageUtils";
import { actionUser } from "@/lib/auth";
import { bool, int, req, safe, str } from "@/lib/action";
import type { ActionState } from "@/components/ActionForm";

const img = (fd: FormData) => {
  const u = str(fd, "image_url");
  if (u && !/^https?:\/\//i.test(u)) throw new Error("Link foto harus diawali http:// atau https://");
  return u;
};
/** Foto tambahan kartu paket: JSON array URL (maks 8), hanya http(s). */
const extraImages = (fd: FormData): string[] => {
  let arr: unknown = [];
  try { arr = JSON.parse(str(fd, "images") || "[]"); } catch { throw new Error("Daftar foto tidak valid."); }
  if (!Array.isArray(arr)) return [];
  return arr.map((u) => String(u).trim()).filter((u) => u.length > 0 && u.length <= 600).map((u) => {
    if (!/^https?:\/\//i.test(u)) throw new Error("Link foto harus diawali http:// atau https://");
    return u;
  }).slice(0, 8);
};
const pct = (fd: FormData, k: string) => Math.min(100, Math.max(0, int(fd, k)));
const CATS = ["self_photo", "photobox", "photobooth", "wisuda", "keluarga", "lainnya"];
const TABLES = { packages: "packages", rooms: "rooms", addons: "addons" } as const;

export async function savePackage(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const name = req(str(fd, "name"), "Nama paket wajib diisi.");
    const category = str(fd, "category");
    if (!CATS.includes(category)) throw new Error("Kategori tidak valid.");
    const price = int(fd, "price");
    // Sewa event (per jam): durasi dasar menggantikan durasi sesi; tidak dipesan lewat slot studio dan tidak dihitung per orang.
    const isEvent = bool(fd, "is_event");
    const baseHours = isEvent ? Math.max(0, int(fd, "base_hours")) : 0;
    if (isEvent && baseHours < 1) throw new Error("Isi durasi dasar sewa event (jam), mis. 4.");
    if (isEvent && baseHours > 24) throw new Error("Durasi dasar sewa event maksimal 24 jam.");
    const maxHours = isEvent ? Math.max(0, int(fd, "max_hours")) : 0;
    if (isEvent && maxHours > 0 && maxHours < baseHours) throw new Error("Batas maksimal jam tidak boleh lebih kecil dari durasi dasar.");
    const extraHourPrice = isEvent ? Math.max(0, int(fd, "extra_hour_price")) : 0;
    const outputs = isEvent ? parseOutputs(str(fd, "outputs")).map((o) => o.label + "|" + o.delta).join("\n") : "";
    const eventAddons = isEvent ? serializeEventAddons(parseEventAddons(str(fd, "event_addons"))) : "";
    const duration = isEvent ? baseHours * 60 : int(fd, "duration_min");
    if (price < 0) throw new Error("Harga tidak valid.");
    if (duration < 5) throw new Error("Durasi minimal 5 menit.");
    const optionLabel = str(fd, "option_label").slice(0, 40);
    const options = parseOptions(str(fd, "options")).join("\n");
    if (options && !optionLabel) throw new Error("Isi nama pilihan (mis. Warna background) bila ada daftar pilihan.");
    const size = ["sm", "md", "lg"].includes(str(fd, "image_size")) ? str(fd, "image_size") : "md";
    const fit = str(fd, "image_fit") === "contain" ? "contain" : "cover";
    // Aturan jumlah orang: minimal, maksimal, orang yang sudah termasuk di harga sesi + tarif tiap orang tambahan.
    const perPerson = !isEvent && fd.get("pricing") === "per_person";
    const maxPeople = Math.max(1, int(fd, "max_people"));
    const minPeople = Math.max(1, int(fd, "min_people") || 1);
    if (minPeople > maxPeople) throw new Error("Minimal orang tidak boleh lebih besar dari maksimal orang.");
    const included = perPerson ? 0 : Math.max(0, int(fd, "included_people"));
    const extraPrice = perPerson ? 0 : Math.max(0, int(fd, "extra_person_price"));
    if (included > maxPeople) throw new Error("Orang yang sudah termasuk tidak boleh lebih besar dari maksimal orang.");
    if (extraPrice > 0 && included < 1) throw new Error("Isi jumlah orang yang sudah termasuk di harga, agar tarif orang tambahan bisa dihitung.");
    const v = [name, category, str(fd, "description"), str(fd, "includes"), price, duration, maxPeople, bool(fd, "active"), img(fd),
      perPerson, !isEvent && bool(fd, "bookable_online"), optionLabel, options, size, fit, pct(fd, "image_x"), pct(fd, "image_y"), JSON.stringify(extraImages(fd)),
      minPeople, included, extraPrice, bool(fd, "is_group"), str(fd, "badge").slice(0, 24), Math.min(9999, Math.max(0, int(fd, "position"))),
      isEvent, baseHours, extraHourPrice, maxHours, outputs, eventAddons];
    const roomIds = [...new Set(fd.getAll("room_ids").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
    await tx(async (t) => {
      let pid = id;
      if (id) {
        await t("update packages set name=$1, category=$2, description=$3, includes=$4, price=$5, duration_min=$6, max_people=$7, active=$8, image_url=$9, per_person=$10, bookable_online=$11, option_label=$12, options=$13, image_size=$14, image_fit=$15, image_x=$16, image_y=$17, images=$18::jsonb, min_people=$19, included_people=$20, extra_person_price=$21, is_group=$22, badge=$23, position=$24, is_event=$25, base_hours=$26, extra_hour_price=$27, max_hours=$28, outputs=$29, event_addons=$30 where id=$31", [...v, id]);
      } else {
        const [r] = await t<{ id: number }>("insert into packages (name, category, description, includes, price, duration_min, max_people, active, image_url, per_person, bookable_online, option_label, options, image_size, image_fit, image_x, image_y, images, min_people, included_people, extra_person_price, is_group, badge, position, is_event, base_hours, extra_hour_price, max_hours, outputs, event_addons) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) returning id", v);
        pid = r.id;
      }
      await t("delete from package_rooms where package_id = $1", [pid]);
      for (const rid of roomIds) await t("insert into package_rooms (package_id, room_id) values ($1,$2) on conflict do nothing", [pid, rid]);
    });
    revalidatePath("/paket");
    revalidatePath("/", "layout");
  });
}

/** Saklar cepat dari kartu paket: tampil di booking (active) atau bisa dipesan online. */
export async function togglePackage(id: number, field: "active" | "bookable_online", on: boolean): Promise<ActionState> {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    if (field !== "active" && field !== "bookable_online") throw new Error("Kolom tidak valid.");
    await q(`update packages set ${field} = $1 where id = $2`, [on, id]);
    revalidatePath("/paket");
    revalidatePath("/", "layout");
    return { ok: true, message: field === "active" ? (on ? "Paket diaktifkan." : "Paket dinonaktifkan.") : (on ? "Paket bisa dipesan online." : "Paket jadi walk-in saja.") };
  });
}

/** Salin paket (nonaktif) beserta fotonya dan pembatasan ruangnya. */
export async function duplicatePackage(id: number): Promise<ActionState> {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await tx(async (t) => {
      const [r] = await t<{ id: number }>(
        `insert into packages (name, category, description, includes, price, duration_min, max_people, active, image_url, per_person, bookable_online, option_label, options, image_size, image_fit, image_x, image_y, images, min_people, included_people, extra_person_price, is_group, badge, position, is_event, base_hours, extra_hour_price, max_hours, outputs, event_addons)
         select left(name, 70) || ' (salinan)', category, description, includes, price, duration_min, max_people, false, image_url, per_person, bookable_online, option_label, options, image_size, image_fit, image_x, image_y, images, min_people, included_people, extra_person_price, is_group, badge, position, is_event, base_hours, extra_hour_price, max_hours, outputs, event_addons
           from packages where id = $1 returning id`, [id]);
      if (!r) throw new Error("Paket tidak ditemukan.");
      await t("insert into package_rooms (package_id, room_id) select $1, room_id from package_rooms where package_id = $2", [r.id, id]);
    });
    revalidatePath("/paket");
    return { ok: true, message: "Paket disalin dalam keadaan nonaktif. Buka lalu sesuaikan." };
  });
}

export async function saveRoom(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const name = req(str(fd, "name"), "Nama ruang wajib diisi.");
    const color = /^#[0-9a-fA-F]{6}$/.test(str(fd, "color")) ? str(fd, "color") : "#4f4fe8";
    const v = [name, color, str(fd, "description"), bool(fd, "active"), img(fd), JSON.stringify(extraImages(fd))];
    if (id) await q("update rooms set name=$1, color=$2, description=$3, active=$4, image_url=$5, images=$6::jsonb where id=$7", [...v, id]);
    else await q("insert into rooms (name, color, description, active, image_url, images) values ($1,$2,$3,$4,$5,$6::jsonb)", v);
    revalidatePath("/paket");
  });
}

export async function saveAddon(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const name = req(str(fd, "name"), "Nama add-on wajib diisi.");
    const price = int(fd, "price");
    if (price < 0) throw new Error("Harga tidak valid.");
    if (id) await q("update addons set name=$1, price=$2, active=$3 where id=$4", [name, price, bool(fd, "active"), id]);
    else await q("insert into addons (name, price, active) values ($1,$2,$3)", [name, price, bool(fd, "active")]);
    revalidatePath("/paket");
  });
}

/** Hapus item katalog; jika sudah dipakai transaksi, sarankan menonaktifkan. */
export async function deleteCatalog(table: keyof typeof TABLES, id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    if (!(table in TABLES)) throw new Error("Tabel tidak valid.");
    try {
      await q(`delete from ${TABLES[table]} where id = $1`, [id]);
    } catch {
      throw new Error("Item ini sudah dipakai di transaksi. Nonaktifkan saja agar tidak muncul lagi.");
    }
    revalidatePath("/paket");
  });
}
