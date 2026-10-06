"use server";
import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { safe } from "@/lib/action";
import { checkConflict } from "@/lib/bookingUtils";
import type { ActionState } from "@/components/ActionForm";

const touch = (id: number) => { revalidatePath("/live"); revalidatePath("/dashboard"); revalidatePath(`/booking/${id}`); revalidatePath("/booking"); };

/** Tamu tiba: timer sesi dihitung dari sekarang. Booking "Menunggu" otomatis jadi "Terkonfirmasi". */
export async function startSession(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    const r = await q(
      `update bookings set started_at = now(), finished_at = null,
              status = case when status = 'pending' then 'confirmed' else status end
        where id = $1 and status in ('pending','confirmed','done') returning id`, [id]);
    if (!r.length) throw new Error("Booking tidak bisa dimulai (sudah dibatalkan atau tidak ditemukan).");
    touch(id);
  });
}

/** Tambah waktu sesi; ditolak bila bentrok dengan booking berikutnya di ruang yang sama. */
export async function extendSession(id: number, minutes: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw new Error("Durasi tambahan tidak valid.");
    await tx(async (t) => {
      const [b] = await t<{ room_id: number | null; start_at: string; end_at: string }>("select room_id, start_at, end_at from bookings where id = $1 for update", [id]);
      if (!b) throw new Error("Booking tidak ditemukan.");
      const end = new Date(new Date(b.end_at).getTime() + minutes * 60000);
      await checkConflict(t, b.room_id, new Date(b.start_at), end, id);
      await t("update bookings set end_at = $1 where id = $2", [end.toISOString(), id]);
    });
    touch(id);
  });
}

export async function finishSession(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    const r = await q(
      `update bookings set finished_at = now(), status = 'done'
        where id = $1 and status in ('pending','confirmed','done') returning id`, [id]);
    if (!r.length) throw new Error("Booking tidak ditemukan atau sudah dibatalkan.");
    touch(id);
  });
}

export async function markNoShow(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    await q("update bookings set status = 'no_show', started_at = null where id = $1 and finished_at is null", [id]);
    touch(id);
  });
}
