import "server-only";
import { SCHEMA } from "@/db/schema";

// Satu antarmuka untuk dua mesin:
//  - DATABASE_URL terisi  -> PostgreSQL sungguhan (Supabase) lewat `pg`
//  - kosong               -> PGlite (Postgres tertanam) di folder .data, untuk development lokal
export type Q = <T = any>(sql: string, params?: any[]) => Promise<T[]>;

type Engine = {
  q: Q;
  tx: <T>(fn: (q: Q) => Promise<T>) => Promise<T>;
  exec: (sql: string) => Promise<void>;
};

const g = globalThis as unknown as { __db?: Promise<Engine> };

async function createPg(url: string): Promise<Engine> {
  const pg = (await import("pg")).default;
  pg.types.setTypeParser(20, (v: string) => Number(v)); // int8
  pg.types.setTypeParser(1700, (v: string) => Number(v)); // numeric
  pg.types.setTypeParser(1082, (v: string) => v); // date -> 'YYYY-MM-DD'
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  const q: Q = async (sql, params) => (await pool.query(sql, params)).rows;
  return {
    q,
    exec: async (sql) => {
      await pool.query(sql);
    },
    tx: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query("begin");
        const r = await fn(async (sql, params) => (await c.query(sql, params)).rows);
        await c.query("commit");
        return r;
      } catch (e) {
        await c.query("rollback").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
  };
}

async function createLite(): Promise<Engine> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  await (await import("node:fs/promises")).mkdir("./.data", { recursive: true });
  const db = new PGlite("./.data/pglite", {
    parsers: {
      [types.INT8]: (v: string) => Number(v),
      [types.NUMERIC]: (v: string) => Number(v),
      [types.DATE]: (v: string) => v,
    },
  });
  await db.waitReady;
  const q: Q = async (sql, params) => (await db.query(sql, params)).rows as any[];
  return {
    q,
    exec: async (sql) => {
      await db.exec(sql);
    },
    tx: (fn) => db.transaction((t) => fn(async (sql, params) => (await t.query(sql, params)).rows as any[])),
  };
}

async function boot(): Promise<Engine> {
  const url = process.env.DATABASE_URL?.trim();
  const e = url ? await createPg(url) : await createLite();
  // Skema idempotent: dijalankan tiap cold start agar kolom/tabel baru otomatis ikut ter-upgrade.
  await e.exec(SCHEMA);
  return e;
}

function engine(): Promise<Engine> {
  if (!g.__db) g.__db = boot().catch((err) => { g.__db = undefined; throw err; });
  return g.__db;
}

export const q: Q = async (sql, params) => (await engine()).q(sql, params);
export async function tx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  return (await engine()).tx(fn);
}
export async function one<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const r = await q<T>(sql, params);
  return r[0] ?? null;
}
