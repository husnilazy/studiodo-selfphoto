"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { actionUser } from "@/lib/auth";
import { bool, int, req, safe, str } from "@/lib/action";
import { createSignedMediaUpload, storageReady } from "@/lib/siteServer";
import type { ActionState } from "@/components/ActionForm";

const MAX_UPLOAD = 60 * 1024 * 1024;
const KINDS = ["frame", "feed", "carousel", "story", "print"];
const STATUSES = ["draf", "siap", "posted"];
const CATS = ["strip", "4r", "square", "story", "lainnya"];

/** Siapkan upload gambar (semua staf boleh memakai editor). */
export async function prepareStudioUpload(name: string, mime: string, size: number):
  Promise<{ ok: true; uploadUrl: string; publicUrl: string; anonKey: string } | { ok: false; error: string }> {
  try {
    await actionUser();
    if (!storageReady()) throw new Error("Upload belum aktif di server (Supabase Storage belum diisi).");
    if (!/^image\//.test(mime)) throw new Error("Hanya file gambar yang bisa diunggah.");
    if (size > MAX_UPLOAD) throw new Error("File terlalu besar (maks 60 MB).");
    return { ok: true, ...(await createSignedMediaUpload(name)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyiapkan upload." };
  }
}

/* ───────── Frame ───────── */
export async function saveFrame(f: { name: string; category: string; url: string; w: number; h: number; slots: { x: number; y: number; w: number; h: number }[] }) {
  try {
    const u = await actionUser(["owner", "admin"]);
    const name = f.name.trim().slice(0, 80);
    if (!name) throw new Error("Nama frame wajib diisi.");
    if (!/^https?:\/\//i.test(f.url)) throw new Error("URL frame tidak valid.");
    if (!f.slots.length) throw new Error("Frame belum punya slot foto. Pastikan area foto berwarna hijau polos.");
    const slots = f.slots.slice(0, 24).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.w), h: Math.round(s.h) }));
    const [r] = await q<{ id: number }>("insert into frames (name, category, url, w, h, slots, created_by) values ($1,$2,$3,$4,$5,$6::jsonb,$7) returning id",
      [name, CATS.includes(f.category) ? f.category : "lainnya", f.url, Math.round(f.w), Math.round(f.h), JSON.stringify(slots), u.id]);
    revalidatePath("/studio");
    return { ok: true as const, id: r.id };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Gagal menyimpan frame." };
  }
}

export async function renameFrame(id: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    const name = req(str(fd, "name"), "Nama wajib diisi.").slice(0, 80);
    const cat = str(fd, "category");
    await q("update frames set name = $1, category = $2, active = $3 where id = $4", [name, CATS.includes(cat) ? cat : "lainnya", bool(fd, "active"), id]);
    revalidatePath("/studio");
  });
}
export async function deleteFrame(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("delete from frames where id = $1", [id]);
    revalidatePath("/studio");
  });
}

/* ───────── Desain ───────── */
export async function saveDesign(id: number | null, d: { name: string; kind: string; data: string; thumb_url: string; customer_id?: number | null }) {
  try {
    const u = await actionUser();
    if (d.data.length > 1_500_000) throw new Error("Desain terlalu besar.");
    const parsed = JSON.parse(d.data) as { pages?: unknown[] };
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0 || parsed.pages.length > 30) throw new Error("Desain tidak valid.");
    const name = d.name.trim().slice(0, 100) || "Desain tanpa judul";
    const kind = KINDS.includes(d.kind) ? d.kind : "feed";
    const thumb = /^https?:\/\//i.test(d.thumb_url) ? d.thumb_url : "";
    if (id) {
      await q("update designs set name=$1, kind=$2, data=$3::jsonb, thumb_url = case when $4 = '' then thumb_url else $4 end, customer_id=$5, updated_at=now() where id=$6",
        [name, kind, d.data, thumb, d.customer_id ?? null, id]);
      revalidatePath("/studio");
      return { ok: true as const, id };
    }
    const [r] = await q<{ id: number }>("insert into designs (name, kind, data, thumb_url, customer_id, created_by) values ($1,$2,$3::jsonb,$4,$5,$6) returning id",
      [name, kind, d.data, thumb, d.customer_id ?? null, u.id]);
    revalidatePath("/studio");
    return { ok: true as const, id: r.id };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Gagal menyimpan desain." };
  }
}

export async function setDesignMeta(id: number, _p: ActionState, fd: FormData) {
  return safe(async () => {
    await actionUser();
    const status = str(fd, "status");
    await q("update designs set name=$1, status=$2, caption=$3, tags=$4, updated_at=now() where id=$5",
      [str(fd, "name").slice(0, 100) || "Desain tanpa judul", STATUSES.includes(status) ? status : "draf", str(fd, "caption").slice(0, 2200), str(fd, "tags").slice(0, 300), id]);
    revalidatePath("/studio");
  });
}

export async function duplicateDesign(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    const u = await actionUser();
    await q(`insert into designs (name, kind, data, thumb_url, caption, tags, customer_id, created_by)
             select name || ' (salinan)', kind, data, thumb_url, caption, tags, customer_id, $2 from designs where id = $1`, [id, u.id]);
    revalidatePath("/studio");
  });
}
export async function deleteDesign(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("delete from designs where id = $1", [id]);
    revalidatePath("/studio");
  });
}

/* ───────── File hasil ekspor ───────── */
export async function registerExports(designId: number | null, items: { name: string; url: string; w: number; h: number; format: string; size: number }[]) {
  try {
    const u = await actionUser();
    for (const it of items.slice(0, 40)) {
      if (!/^https?:\/\//i.test(it.url)) continue;
      await q("insert into design_exports (design_id, name, url, w, h, format, size_bytes, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [designId, it.name.slice(0, 120), it.url, int2(it.w), int2(it.h), it.format.slice(0, 8), int2(it.size), u.id]);
    }
    revalidatePath("/studio");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Gagal mencatat file." };
  }
}
const int2 = (n: number) => Math.max(0, Math.round(Number(n) || 0));

export async function deleteExport(id: number, _p: ActionState, _fd: FormData) {
  return safe(async () => {
    await actionUser(["owner", "admin"]);
    await q("delete from design_exports where id = $1", [id]);
    revalidatePath("/studio");
  });
}
