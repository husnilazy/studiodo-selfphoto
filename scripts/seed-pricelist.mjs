// Mengisi katalog dari PRICELIST STUDIODO (ruang, paket, add-on, pengaturan, konten website).
// Aman diulang: data dicocokkan berdasarkan nama lalu diperbarui. Tidak menyentuh pengguna, booking, maupun keuangan.
//   node --env-file=.env.local scripts/seed-pricelist.mjs
import pg from "pg";
import { SCHEMA, SCHEMA_VERSION } from "../src/db/schema.ts";
import { DEFAULT_SITE, sanitizeSite } from "../src/lib/siteConfig.ts";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL belum diisi (.env.local)."); process.exit(1); }

const ROOMS = [
  { name: "Studio Backdrop", color: "#f472b6", description: "3 pilihan warna backdrop: Soft Pink, Aesthetic Beige, Warm Grey" },
  { name: "Room Concept", color: "#a16207", description: "Ruang estetik & suasana homey: sofa, lampu hias, karpet, daun palsu" },
  { name: "Photobox Retro (Brown)", color: "#92400e", description: "Photobox tema Retro dengan nuansa cokelat" },
  { name: "Photobox Film (Red)", color: "#b91c1c", description: "Photobox tema Film dengan nuansa merah" },
];

const lines = (...l) => l.join("\n");
const PACKAGES = [
  { name: "Photobooth Outdoor", category: "photobooth", price: 25000, duration: 5, max: 5, per_person: false, online: false, rooms: [],
    option_label: "Tema gorden", options: lines("Gorden Polkadot", "Gorden Gray"),
    description: "Bisa direct walk-in tanpa antre booking.",
    includes: lines("Kapasitas maks 4-5 orang per sesi", "Cetak 1 photo strip / orang", "Soft file digital via QR Code") },
  { name: "Photobox Self Photo (All Themes)", category: "photobox", price: 30000, duration: 15, max: 5, per_person: true, online: true, rooms: ["Photobox Retro (Brown)", "Photobox Film (Red)"],
    option_label: "", options: "",
    description: "Wajib booking. Tema tersedia: Retro (Brown) dan Film (Red).",
    includes: lines("Durasi 15 menit / sesi", "Kapasitas maks 4-5 orang per sesi", "Cetak 1 print photo / orang", "Termasuk soft file foto") },
  { name: "Self Photo – 3 Color Backdrop", category: "self_photo", price: 35000, duration: 20, max: 5, per_person: true, online: true, rooms: ["Studio Backdrop"],
    option_label: "Warna background", options: lines("Soft Pink", "Aesthetic Beige", "Warm Grey"),
    description: "Wajib booking.",
    includes: lines("Unlimited photos (durasi 20 menit)", "Cetak 1 foto / orang", "Free akses seluruh property (kursi lipat, box kursi & aksesoris)") },
  { name: "Special Group Package (3 Color Backdrop)", category: "self_photo", price: 150000, duration: 15, max: 5, per_person: false, online: true, rooms: ["Studio Backdrop"],
    option_label: "", options: "",
    description: "Foto group maks 5 orang. Wajib booking.",
    includes: lines("Bebas ganti 3 warna background", "Cetak 1 foto / orang", "Free akses seluruh property") },
  { name: "Self Photo – Room Concept", category: "self_photo", price: 30000, duration: 15, max: 5, per_person: true, online: true, rooms: ["Room Concept"],
    option_label: "", options: "",
    description: "Setup ruang estetik & suasana homey. Wajib booking.",
    includes: lines("Unlimited photos (durasi 15 menit)", "Cetak 1 foto / orang", "Bebas pakai semua properti ruangan (sofa estetik, lampu hias, karpet, daun palsu)") },
  { name: "Foto Wisuda (Self Foto)", category: "wisuda", price: 75000, duration: 15, max: 5, per_person: true, online: true, rooms: ["Studio Backdrop"],
    option_label: "", options: "",
    description: "Wajib booking.",
    includes: lines("Unlimited photos (15 menit)", "Retouch / edit foto profesional", "Cetak ukuran 4R / orang", "High-resolution soft file") },
  { name: "Foto Wisuda + Fotografer (Include Foto Keluarga)", category: "wisuda", price: 290000, duration: 20, max: 5, per_person: false, online: true, rooms: ["Studio Backdrop"],
    option_label: "", options: "",
    description: "Harga per sesi. Wajib booking.",
    includes: lines("Unlimited photos (20 menit)", "Sesi foto sendiri + sesi foto bersama keluarga", "Free akses seluruh property", "Retouch / edit foto profesional", "High-resolution soft file", "1 cetak ukuran A4") },
  { name: "Family Session", category: "keluarga", price: 250000, duration: 20, max: 4, per_person: false, online: true, rooms: ["Studio Backdrop"],
    option_label: "Tema", options: lines("Warm Grey", "Soft Pink", "Beige"),
    description: "Harga per sesi, maks 4 orang. Wajib booking.",
    includes: lines("Sesi foto keluarga di studio (20 menit)", "Termasuk soft file pilihan", "Cetak 1 foto keluarga ukuran A4", "Free akses seluruh property") },
  { name: "Pas Foto (Self Photo)", category: "keluarga", price: 50000, duration: 10, max: 5, per_person: true, online: true, rooms: ["Studio Backdrop"],
    option_label: "Warna background", options: lines("Putih", "Merah", "Biru"),
    description: "Wajib booking.",
    includes: lines("Bebas pilih background formal", "Basic retouch (rapi wajah & baju)", "Cetak 4 lembar (ukuran 2x3 / 3x4 / 4x6)", "File digital pas foto", "Durasi 10 menit") },
];

const ADDONS = [
  { name: "Cetak Foto 4R (per lembar)", price: 10000 },
  { name: "Cetak Foto A4 (per lembar)", price: 30000 },
];

const MAPS_EMBED = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3957.1117311256257!2d109.9147435!3d-7.341348199999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xcfceb45b974374f%3A0xdca036b64eb9f09d!2sFrameless%20Creative%20Agency!5e0!3m2!1sid!2sid!4v1791340459768!5m2!1sid!2sid" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=-7.3413482%2C109.9147435";

const FAQ = [
  { q: "Apakah semua sesi wajib booking?", a: "Ya, semua sesi foto wajib reservasi slot terlebih dahulu. Pengecualian hanya Photobooth Outdoor yang bisa langsung datang (walk-in) tanpa antre booking." },
  { q: "Harganya dihitung per orang atau per sesi?", a: "Harga berlaku per orang, kecuali paket yang tertulis per sesi atau per paket (mis. Special Group Package, Family Session, dan Foto Wisuda + Fotografer)." },
  { q: "Sebaiknya datang jam berapa?", a: "Mohon hadir 10 menit sebelum sesi foto dimulai agar sesi Anda berjalan tepat waktu." },
  { q: "Metode pembayaran apa saja yang diterima?", a: "Kami menerima transfer bank, QRIS, dan tunai (cash)." },
  { q: "Bagaimana saya menerima hasil foto?", a: "Hasil foto dikirim sebagai link soft file lewat WhatsApp. Beberapa paket juga sudah termasuk cetak foto langsung di studio." },
  { q: "Bisa cetak foto tambahan?", a: "Bisa, kapan saja. Cetak tambahan: 4R Rp10.000 per lembar dan A4 Rp30.000 per lembar." },
  { q: "Fasilitas apa saja yang tersedia?", a: "Ruang ganti dan toilet, cermin, kipas, serta ruang tunggu." },
];

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(SCHEMA);
  await client.query("insert into settings (key, value) values ('schema_v', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(SCHEMA_VERSION)]);
  await client.query("begin");

  const roomId = {};
  for (const [i, r] of ROOMS.entries()) {
    const f = await client.query("select id from rooms where name = $1", [r.name]);
    if (f.rows[0]) {
      await client.query("update rooms set color=$1, description=$2, active=true, sort=$3 where id=$4", [r.color, r.description, i, f.rows[0].id]);
      roomId[r.name] = f.rows[0].id;
    } else {
      roomId[r.name] = (await client.query("insert into rooms (name, color, description, sort) values ($1,$2,$3,$4) returning id", [r.name, r.color, r.description, i])).rows[0].id;
    }
  }

  for (const [i, p] of PACKAGES.entries()) {
    const v = [p.category, p.description, p.includes, p.price, p.duration, p.max, p.per_person, p.online, p.option_label, p.options, i];
    const f = await client.query("select id from packages where name = $1", [p.name]);
    let id;
    if (f.rows[0]) {
      id = f.rows[0].id;
      await client.query("update packages set category=$1, description=$2, includes=$3, price=$4, duration_min=$5, max_people=$6, per_person=$7, bookable_online=$8, option_label=$9, options=$10, sort=$11, active=true where id=$12", [...v, id]);
    } else {
      id = (await client.query("insert into packages (category, description, includes, price, duration_min, max_people, per_person, bookable_online, option_label, options, sort, name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id", [...v, p.name])).rows[0].id;
    }
    await client.query("delete from package_rooms where package_id = $1", [id]);
    for (const rn of p.rooms) await client.query("insert into package_rooms (package_id, room_id) values ($1,$2)", [id, roomId[rn]]);
  }

  for (const [i, a] of ADDONS.entries()) {
    const f = await client.query("select id from addons where name = $1", [a.name]);
    if (f.rows[0]) await client.query("update addons set price=$1, active=true, sort=$2 where id=$3", [a.price, i, f.rows[0].id]);
    else await client.query("insert into addons (name, price, sort) values ($1,$2,$3)", [a.name, a.price, i]);
  }

  const merge = async (key, patch) => {
    const cur = (await client.query("select value from settings where key = $1", [key])).rows[0]?.value ?? {};
    await client.query("insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value", [key, JSON.stringify({ ...cur, ...patch })]);
  };
  await merge("studio", { name: "STUDIODO", phone: "0859-1067-23181", open: "09:00", close: "21:00", slot: 10 });
  await merge("online", {
    enabled: true, dp_percent: 0, hold_min: 180, lead_min: 60, days_ahead: 30,
    pay_info: "Kami menerima transfer bank, QRIS, dan tunai (cash).",
    whatsapp: "62859106723181", instagram: "studiodo.id", maps_url: MAPS_URL,
    tagline: "Abadikan momen seru dengan gaya kamu sendiri.",
  });
  const curSite = (await client.query("select value from settings where key = 'site'")).rows[0]?.value ?? DEFAULT_SITE;
  const site = sanitizeSite({
    ...curSite,
    lokasi: { ...(curSite.lokasi ?? {}), maps_embed: MAPS_EMBED, maps_url: MAPS_URL, whatsapp: "62859106723181", instagram: "studiodo.id" },
    footer: { ...(curSite.footer ?? {}), tiktok: "https://www.tiktok.com/@studiodo.id" },
    faq: { ...(curSite.faq ?? DEFAULT_SITE.faq), items: FAQ },
    seo: { ...(curSite.seo ?? {}), description: "STUDIODO — self photo studio, photobox, dan photobooth dengan berbagai pilihan background. Booking jadwal online sekarang." },
  });
  await client.query("insert into settings (key, value) values ('site', $1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(site)]);

  await client.query("commit");
  const c = await client.query("select (select count(*) from rooms)::int r, (select count(*) from packages)::int p, (select count(*) from addons)::int a, (select count(*) from package_rooms)::int pr");
  console.log("Selesai →", c.rows[0]);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("GAGAL, dibatalkan:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
