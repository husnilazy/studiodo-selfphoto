// Migrasi sekali jalan: Supabase (Postgres + Storage) -> Neon (Postgres + Object Storage).
//
//   $env:SOURCE_DATABASE_URL = "postgresql://...supabase..."   # connection string Postgres Supabase (BUKAN URL https)
//   $env:MEDIA_BASE_URL      = "https://selfphoto.studiodo.id"  # asal publik baru: URL media jadi <asal>/media/<key>
//   node --env-file=.env.local scripts/migrate-from-supabase.mjs [--dry] [--force] [--skip-media]
//
// Tujuan = DATABASE_URL_UNPOOLED + AWS_* dari .env.local (hasil `neon env pull`).
// Urutan: 1) skema di Neon  2) salin file media  3) salin semua tabel  4) tulis ulang URL media di semua kolom teks/json  5) reset sequence.
// Aman diulang: bila Neon sudah berisi data, skrip berhenti kecuali dengan --force (yang menimpa semuanya). Media yang sudah ada dilewati.
import pg from "pg";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { SCHEMA } from "../src/db/schema.ts";

const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");
const SKIP_MEDIA = process.argv.includes("--skip-media");
const need = (k) => { const v = process.env[k]?.trim(); if (!v) { console.error(`Env ${k} belum diisi.`); process.exit(1); } return v; };

const srcUrl = need("SOURCE_DATABASE_URL");
const dstUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || need("DATABASE_URL");
const mediaBase = need("MEDIA_BASE_URL").replace(/\/$/, "");
if (!/^postgres(ql)?:\/\//i.test(srcUrl)) { console.error("SOURCE_DATABASE_URL harus berupa postgresql://… (Supabase → Project Settings → Database)."); process.exit(1); }

const ssl = (u) => (/localhost|127\.0\.0\.1/.test(u) ? undefined : { rejectUnauthorized: false });
const src = new pg.Client({ connectionString: srcUrl, ssl: ssl(srcUrl) });
const dst = new pg.Client({ connectionString: dstUrl, ssl: ssl(dstUrl) });
await src.connect();
await dst.connect();

const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
const log = (...a) => console.log(...a);

/* 1) Skema */
log("1/5 Skema di Neon…");
// Sebelum skema dipasang: apakah Neon sudah berisi data nyata? (skema sendiri menanam beberapa baris awal)
let existing = 0;
for (const r of (await dst.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows)
  existing += Number((await dst.query(`select count(*)::int as n from ${qi(r.table_name)}`)).rows[0].n);
if (existing > 0 && !FORCE) { console.error(`Neon sudah berisi ${existing} baris. Pakai --force bila memang ingin menimpa semuanya.`); process.exit(3); }
await dst.query(SCHEMA); // tujuan = database Neon baru; aman dijalankan juga saat --dry

const tables = (await dst.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")).rows.map((r) => r.table_name);

/* Urutan tabel menurut foreign key (induk dulu) */
const deps = (await dst.query(
  `select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
     from pg_constraint c join pg_namespace n on n.oid = c.connamespace where c.contype = 'f' and n.nspname = 'public'`)).rows;
const clean = (x) => x.replace(/^public\./, "").replace(/"/g, "");
const order = []; const seen = new Set();
const visit = (t) => {
  if (seen.has(t)) return; seen.add(t);
  for (const d of deps) if (clean(d.child) === t && clean(d.parent) !== t) visit(clean(d.parent));
  order.push(t);
};
tables.forEach(visit);

/* Kumpulkan semua teks dari sumber untuk mencari URL media */
const SB = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/website\/([^"'\s)\\<>]+)/gi;

/* 2) Media */
if (!SKIP_MEDIA) {
  log("2/5 Menyalin file media…");
  const keys = new Map(); // key -> url sumber
  for (const t of order) {
    const rows = (await src.query(`select row_to_json(x)::text as j from ${qi(t)} x`).catch(() => ({ rows: [] }))).rows;
    for (const r of rows) for (const m of r.j.matchAll(SB)) keys.set(decodeURIComponent(m[1]), m[0].replace(/\\/g, ""));
  }
  log(`   ${keys.size} file media terdeteksi.`);
  const s3 = new S3Client({ forcePathStyle: true });
  let done = 0, skipped = 0, failed = 0;
  for (const [key, url] of keys) {
    try {
      const exists = await s3.send(new HeadObjectCommand({ Bucket: "website", Key: key })).then(() => true).catch(() => false);
      if (exists) { skipped++; continue; }
      if (DRY) { done++; continue; }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      await s3.send(new PutObjectCommand({
        Bucket: "website", Key: key, Body: body,
        ContentType: res.headers.get("content-type") ?? "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable",
      }));
      done++;
    } catch (e) {
      failed++; console.error(`   GAGAL ${key}: ${e.message}`);
    }
  }
  log(`   disalin ${done}, dilewati ${skipped}, gagal ${failed}.`);
  if (failed) { console.error("Ada file yang gagal. Periksa Supabase (HTTP 402 = kuota/spend cap), lalu jalankan ulang; file yang sudah ada dilewati."); if (!DRY) process.exit(2); }
}

/* 3) Tabel */
log("3/5 Menyalin tabel…");
if (!DRY) await dst.query(`truncate ${order.map(qi).join(", ")} restart identity cascade`);
for (const t of order) {
  const exists = (await src.query("select to_regclass($1) as r", [`public.${t}`])).rows[0].r;
  if (!exists) { log(`   ${t}: tidak ada di sumber, dilewati`); continue; }
  const cols = (await dst.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [t])).rows.map((r) => r.column_name);
  const srcCols = new Set((await src.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [t])).rows.map((r) => r.column_name));
  const use = cols.filter((c) => srcCols.has(c));
  const list = use.map(qi).join(", ");
  const rows = (await src.query(`select row_to_json(x)::text as j from (select ${list} from ${qi(t)}) x`)).rows;
  if (!DRY) {
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = "[" + rows.slice(i, i + 200).map((r) => r.j).join(",") + "]";
      await dst.query(`insert into ${qi(t)} (${list}) overriding system value select ${list} from json_populate_recordset(null::${qi(t)}, $1::json)`, [chunk]);
    }
  }
  log(`   ${t}: ${rows.length} baris`);
}

/* 4) Tulis ulang URL media */
log("4/5 Menulis ulang URL media…");
const prefixRe = "https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/website/";
const textCols = (await dst.query(
  `select table_name, column_name, data_type from information_schema.columns
    where table_schema='public' and data_type in ('text','character varying','json','jsonb')`)).rows;
for (const c of textCols) {
  const col = qi(c.column_name), t = qi(c.table_name);
  const isJson = c.data_type === "json" || c.data_type === "jsonb";
  const expr = `regexp_replace(${col}${isJson ? "::text" : ""}, '${prefixRe}', '${mediaBase}/media/', 'g')${isJson ? `::${c.data_type}` : ""}`;
  const where = `${col}${isJson ? "::text" : ""} ~ 'supabase\\.co/storage/v1/object/public/website/'`;
  if (DRY) continue;
  const r = await dst.query(`update ${t} set ${col} = ${expr} where ${where}`);
  if (r.rowCount) log(`   ${c.table_name}.${c.column_name}: ${r.rowCount} baris`);
}

/* 5) Sequence */
log("5/5 Reset sequence…");
if (!DRY) {
  const seqs = (await dst.query(
    `select c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) as seq
       from information_schema.columns c where c.table_schema='public'`)).rows.filter((r) => r.seq);
  for (const s of seqs) await dst.query(`select setval($1, coalesce((select max(${qi(s.column_name)}) from ${qi(s.table_name)}), 0) + 1, false)`, [s.seq]);
}

await src.end(); await dst.end();
log(DRY ? "Selesai (dry-run, tidak ada yang ditulis ke tabel)." : "Selesai. Verifikasi di aplikasi, lalu ganti env di Vercel.");
