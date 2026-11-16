"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { safe, str } from "@/lib/action";
import { newToken } from "@/lib/gallery";
import type { ActionState } from "@/components/ActionForm";

const done = (customerId: number) => revalidatePath(`/customer/${customerId}`);

/** Buat link galeri untuk customer (sekali; link yang sama dipakai seterusnya). */
export async function enableGallery(customerId: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    await q("update customers set gallery_token = coalesce(gallery_token, $2) where id = $1", [customerId, newToken()]);
    done(customerId);
    return { ok: true, message: "Galeri dibuat." };
  });
}

/** Ganti link galeri (link lama langsung tidak berlaku). */
export async function regenerateGallery(customerId: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    await q("update customers set gallery_token = $2 where id = $1", [customerId, newToken()]);
    done(customerId);
    return { ok: true, message: "Link galeri baru dibuat. Link lama tidak berlaku lagi." };
  });
}

/** Matikan galeri (link berhenti bisa dibuka). Favorit & ulasan tetap tersimpan. */
export async function disableGallery(customerId: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    await q("update customers set gallery_token = null where id = $1", [customerId]);
    done(customerId);
    return { ok: true, message: "Galeri dimatikan." };
  });
}

/** Pesan pribadi dari studio yang tampil di bagian atas galeri. */
export async function saveGalleryNote(customerId: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser();
    await q("update customers set gallery_note = $2 where id = $1", [customerId, str(fd, "note").slice(0, 400)]);
    done(customerId);
    return { ok: true, message: "Pesan galeri disimpan." };
  });
}
