// Menjalankan skema ke database di DATABASE_URL (Supabase). Aman diulang.
import pg from "pg";
import { SCHEMA } from "../src/db/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diisi (.env.local).");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();
await client.query(SCHEMA);
await client.end();
console.log("Skema database siap.");
