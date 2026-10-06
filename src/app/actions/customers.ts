"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { int, req, safe, str } from "@/lib/action";
import type { ActionState } from "@/components/ActionForm";

export async function saveCustomer(id: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser();
    const name = req(str(fd, "name"), "Nama wajib diisi.");
    const v = [name, str(fd, "phone"), str(fd, "instagram").replace(/^@/, ""), str(fd, "email"), str(fd, "notes")];
    if (id) {
      await q("update customers set name=$1, phone=$2, instagram=$3, email=$4, notes=$5 where id=$6", [...v, id]);
      revalidatePath(`/customer/${id}`);
    } else {
      const [c] = await q<{ id: number }>("insert into customers (name, phone, instagram, email, notes) values ($1,$2,$3,$4,$5) returning id", v);
      revalidatePath("/customer");
      return { ok: true, redirect: `/customer/${c.id}` };
    }
    revalidatePath("/customer");
  });
}

export async function deleteCustomer(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const [b] = await q<{ n: number }>("select count(*)::int as n from bookings where customer_id = $1", [id]);
    if (b.n > 0) throw new Error("Customer ini punya riwayat booking, tidak bisa dihapus.");
    await q("delete from customers where id = $1", [id]);
    revalidatePath("/customer");
    return { ok: true, redirect: "/customer" };
  });
}

const KINDS = ["foto_asli", "foto_edit", "video", "album", "lainnya"];
const STATUSES = ["proses", "siap", "terkirim"];

export async function saveFile(id: number | null, fixedCustomer: number | null, _p: ActionState, fd: FormData) {
  return safe(async () => {
    const u = await actionUser();
    const customerId = fixedCustomer ?? int(fd, "customer_id");
    if (!customerId) throw new Error("Pilih customer terlebih dulu.");
    const title = req(str(fd, "title"), "Judul file wajib diisi.");
    const url = req(str(fd, "url"), "Link file wajib diisi.");
    if (!/^https?:\/\//i.test(url)) throw new Error("Link harus diawali http:// atau https://");
    const kind = str(fd, "kind"), status = str(fd, "status");
    if (!KINDS.includes(kind) || !STATUSES.includes(status)) throw new Error("Data tidak valid.");
    const bookingId = int(fd, "booking_id") || null;
    const expires = str(fd, "expires_on") || null;
    const v = [customerId, bookingId, title, url, kind, status, expires, str(fd, "note")];
    if (id) await q("update customer_files set customer_id=$1, booking_id=$2, title=$3, url=$4, kind=$5, status=$6, expires_on=$7, note=$8 where id=$9", [...v, id]);
    else await q("insert into customer_files (customer_id, booking_id, title, url, kind, status, expires_on, note, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [...v, u.id]);
    revalidatePath("/file");
    revalidatePath(`/customer/${customerId}`);
  });
}

export async function setFileStatus(id: number, status: string, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser();
    if (!STATUSES.includes(status)) throw new Error("Status tidak valid.");
    await q("update customer_files set status = $1 where id = $2", [status, id]);
    revalidatePath("/file");
    revalidatePath("/customer/[id]", "page");
  });
}

export async function deleteFile(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("delete from customer_files where id = $1", [id]);
    revalidatePath("/file");
    revalidatePath("/customer/[id]", "page");
  });
}
