"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { safe } from "@/lib/action";
import {
  appOrigin, bookingFolder, clearConfig, createUploadSession, customerFolder, fileInfo, folderLink, shareAnyone,
} from "@/lib/gdrive";
import type { ActionState } from "@/components/ActionForm";

const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB per file
const KINDS = ["foto_asli", "foto_edit", "video", "album", "lainnya"];

type Target = { customerId: number; bookingId: number | null };

async function resolveFolder(t: Target) {
  if (t.bookingId) {
    const b = await bookingFolder(t.bookingId);
    if (b.customerId !== t.customerId) throw new Error("Booking tidak cocok dengan customer.");
    return b.id;
  }
  return customerFolder(t.customerId);
}

/** Langkah 1: siapkan folder + sesi upload; browser lalu mengunggah langsung ke Google. */
export async function startDriveUpload(t: Target, name: string, mime: string, size: number): Promise<{ ok: true; sessionUrl: string } | { ok: false; error: string }> {
  try {
    await actionUser();
    if (!(size > 0)) throw new Error("File kosong.");
    if (size > MAX_BYTES) throw new Error("File terlalu besar (maks 5 GB).");
    const folder = await resolveFolder(t);
    return { ok: true, sessionUrl: await createUploadSession(folder, name, mime, size, await appOrigin()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyiapkan upload." };
  }
}

/** Langkah 2: verifikasi file di Drive, buka link, catat di File Customer. */
export async function finishDriveUpload(t: Target, fileId: string, kind: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await actionUser();
    if (!KINDS.includes(kind)) throw new Error("Jenis file tidak valid.");
    const folder = await resolveFolder(t);
    const info = await fileInfo(fileId);
    if (!info.parents?.includes(folder)) throw new Error("File tidak berada di folder yang benar.");
    await shareAnyone(fileId);
    const status = kind === "foto_asli" || kind === "lainnya" ? "proses" : "siap";
    await q(
      `insert into customer_files (customer_id, booking_id, title, url, kind, status, drive_file_id, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [t.customerId, t.bookingId, info.name, info.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`, kind, status, fileId, user.id]);
    revalidatePath("/file");
    revalidatePath(`/customer/${t.customerId}`);
    if (t.bookingId) revalidatePath(`/booking/${t.bookingId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan file." };
  }
}

/** Membuka folder (customer atau sesi) sebagai link & mencatatnya sebagai item "Album" agar bisa dikirim lewat WhatsApp. */
export async function shareDriveFolder(t: Target, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    const user = await actionUser();
    const folder = await resolveFolder(t);
    await shareAnyone(folder);
    const url = await folderLink(folder);
    const [c] = await q<{ name: string }>("select name from customers where id = $1", [t.customerId]);
    let title = `Folder ${c.name}`;
    if (t.bookingId) {
      const [b] = await q<{ code: string }>("select code from bookings where id = $1", [t.bookingId]);
      title = `Folder sesi ${b.code}`;
    }
    const exists = await q("select 1 from customer_files where customer_id = $1 and url = $2", [t.customerId, url]);
    if (!exists.length) {
      await q("insert into customer_files (customer_id, booking_id, title, url, kind, status, created_by) values ($1,$2,$3,$4,'album','siap',$5)",
        [t.customerId, t.bookingId, title, url, user.id]);
    }
    revalidatePath("/file");
    revalidatePath(`/customer/${t.customerId}`);
    if (t.bookingId) revalidatePath(`/booking/${t.bookingId}`);
    return { ok: true, message: "Link folder ditambahkan ke daftar file." };
  });
}

export async function disconnectDrive(_p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner"]);
    await clearConfig();
    revalidatePath("/pengaturan");
  });
}
