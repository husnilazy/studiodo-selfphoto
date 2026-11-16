import "server-only";
import { randomBytes } from "node:crypto";
import { one, q } from "./db";
import { todayWIB } from "./format";

export type GFile = { id: number; driveId: string; title: string; video: boolean; kind: string; albumId: number };
export type GAlbum = { id: number; title: string; date: string | null; pkg: string | null; room: string | null; people: number | null };
export type GLink = { title: string; url: string };
export type Gallery = {
  customer: { id: number; name: string };
  studio: { name: string; phone: string };
  note: string;
  albums: GAlbum[];
  files: GFile[];
  links: GLink[];
  favorites: number[];
  expires: string | null;
  expired: boolean;
  reviewed: boolean;
};

export const newToken = () => randomBytes(24).toString("base64url");
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Customer pemilik token (atau null). Dipakai juga oleh API favorit/ulasan. */
export async function customerByToken(token: string) {
  if (!TOKEN.test(token)) return null;
  return one<{ id: number; name: string; gallery_note: string }>("select id, name, gallery_note from customers where gallery_token = $1", [token]);
}

/** Hanya file yang sudah "siap/terkirim" yang tampil di galeri (foto asli yang masih diproses disembunyikan). */
export async function loadGallery(token: string): Promise<Gallery | null> {
  const c = await customerByToken(token);
  if (!c) return null;
  const [rows, favs, studioRow, fb] = await Promise.all([
    q<{ id: number; title: string; url: string; kind: string; mime: string; drive_file_id: string | null; booking_id: number | null; expires_on: string | null }>(
      `select id, title, url, kind, mime, drive_file_id, booking_id, expires_on from customer_files
        where customer_id = $1 and status in ('siap','terkirim') order by created_at, id`, [c.id]),
    q<{ file_id: number }>("select file_id from gallery_favorites where customer_id = $1", [c.id]),
    one<{ value: { name?: string; phone?: string } }>("select value from settings where key = 'studio'"),
    one<{ n: number }>("select count(*)::int as n from gallery_feedback where customer_id = $1", [c.id]),
  ]);
  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter((x): x is number => !!x))];
  const books = bookingIds.length
    ? await q<{ id: number; day: string; pkg: string | null; room: string | null; people: number }>(
        `select b.id, (b.start_at at time zone 'Asia/Jakarta')::date::text as day, p.name as pkg, r.name as room, b.people
           from bookings b left join packages p on p.id = b.package_id left join rooms r on r.id = b.room_id where b.id = any($1)`, [bookingIds])
    : [];
  const albums: GAlbum[] = [...books].sort((a, b) => b.day.localeCompare(a.day)).map((b) => ({ id: b.id, title: `Sesi ${b.day}`, date: b.day, pkg: b.pkg, room: b.room, people: b.people }));
  if (rows.some((r) => r.drive_file_id && !r.booking_id)) albums.push({ id: 0, title: "Lainnya", date: null, pkg: null, room: null, people: null });

  const files: GFile[] = rows.filter((r) => r.drive_file_id && r.kind !== "album" && r.kind !== "lainnya").map((r) => ({
    id: r.id, driveId: r.drive_file_id!, title: r.title, kind: r.kind, video: r.kind === "video" || r.mime.startsWith("video/"), albumId: r.booking_id ?? 0,
  }));
  const links: GLink[] = rows.filter((r) => !r.drive_file_id || r.kind === "album").map((r) => ({ title: r.title, url: r.url }));
  const exp = rows.map((r) => r.expires_on).filter((x): x is string => !!x).sort()[0] ?? null;
  const s = studioRow?.value ?? {};
  return {
    customer: { id: c.id, name: c.name }, studio: { name: s.name || "STUDIODO", phone: s.phone || "" }, note: c.gallery_note,
    albums: albums.filter((a) => files.some((f) => f.albumId === a.id)), files, links,
    favorites: favs.map((f) => f.file_id), expires: exp, expired: !!exp && exp < todayWIB(), reviewed: (fb?.n ?? 0) > 0,
  };
}
