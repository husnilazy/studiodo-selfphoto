"use server";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { parseOptions } from "@/lib/packageUtils";
import { actionUser } from "@/lib/auth";
import { bool, int, req, safe, str } from "@/lib/action";
import type { ActionState } from "@/components/ActionForm";

const img = (fd: FormData) => {
  const u = str(fd, "image_url");
  if (u && !/^https?:\/\//i.test(u)) throw new Error("Link foto harus diawali http:// atau https://");
  return u;
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
    const duration = int(fd, "duration_min");
    if (price < 0) throw new Error("Harga tidak valid.");
    if (duration < 5) throw new Error("Durasi minimal 5 menit.");
    const optionLabel = str(fd, "option_label").slice(0, 40);
    const options = parseOptions(str(fd, "options")).join("\n");
    if (options && !optionLabel) throw new Error("Isi nama pilihan (mis. Warna background) bila ada daftar pilihan.");
    const size = ["sm", "md", "lg"].includes(str(fd, "image_size")) ? str(fd, "image_size") : "md";
    const fit = str(fd, "image_fit") === "contain" ? "contain" : "cover";
    const v = [name, category, str(fd, "description"), str(fd, "includes"), price, duration, Math.max(1, int(fd, "max_people")), bool(fd, "active"), img(fd),
      fd.get("pricing") === "per_person", bool(fd, "bookable_online"), optionLabel, options, size, fit, pct(fd, "image_x"), pct(fd, "image_y")];
    const roomIds = [...new Set(fd.getAll("room_ids").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))];
    await tx(async (t) => {
      let pid = id;
      if (id) {
        await t("update packages set name=$1, category=$2, description=$3, includes=$4, price=$5, duration_min=$6, max_people=$7, active=$8, image_url=$9, per_person=$10, bookable_online=$11, option_label=$12, options=$13, image_size=$14, image_fit=$15, image_x=$16, image_y=$17 where id=$18", [...v, id]);
      } else {
        const [r] = await t<{ id: number }>("insert into packages (name, category, description, includes, price, duration_min, max_people, active, image_url, per_person, bookable_online, option_label, options, image_size, image_fit, image_x, image_y) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id", v);
        pid = r.id;
      }
      await t("delete from package_rooms where package_id = $1", [pid]);
      for (const rid of roomIds) await t("insert into package_rooms (package_id, room_id) values ($1,$2) on conflict do nothing", [pid, rid]);
    });
    revalidatePath("/paket");
    revalidatePath("/", "layout");
  });
}

export async function saveRoom(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const name = req(str(fd, "name"), "Nama ruang wajib diisi.");
    const color = /^#[0-9a-fA-F]{6}$/.test(str(fd, "color")) ? str(fd, "color") : "#4f4fe8";
    const v = [name, color, str(fd, "description"), bool(fd, "active"), img(fd)];
    if (id) await q("update rooms set name=$1, color=$2, description=$3, active=$4, image_url=$5 where id=$6", [...v, id]);
    else await q("insert into rooms (name, color, description, active, image_url) values ($1,$2,$3,$4,$5)", v);
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
