// Skema Frameless Hub. Idempotent; naikkan SCHEMA_VERSION setiap ada perubahan.
export const SCHEMA_VERSION = "3";

export const SCHEMA = `
create table if not exists users (
  id serial primary key, name text not null, pin_hash text not null,
  role text not null default 'owner', active boolean not null default true,
  failed_attempts int not null default 0, locked_until timestamptz, created_at timestamptz not null default now()
);
create table if not exists settings (key text primary key, value jsonb not null);

create table if not exists companies (
  id serial primary key, slug text unique not null, name text not null,
  kind text not null default 'usaha', color text not null default '#b8c4ff',
  started_on date, active boolean not null default true, sort int not null default 0,
  api_key_hash text, api_key_prefix text, last_sync_at timestamptz,
  share_capital_pct int not null default 50, share_work_pct int not null default 50, reserve_pct int not null default 10
);
create table if not exists partners (
  id serial primary key, name text not null, role text not null default '', active boolean not null default true
);
create table if not exists company_partners (
  company_id int not null references companies(id) on delete cascade,
  partner_id int not null references partners(id) on delete cascade,
  equity_pct numeric not null default 0, work_weight numeric not null default 1,
  primary key (company_id, partner_id)
);
-- Satu buku besar sederhana untuk semua perusahaan.
-- kind: revenue | expense | asset_purchase | capital_in | withdrawal
-- funding: 'company' (kas perusahaan) | 'partner' (dibayar pribadi oleh partner = dihitung sebagai modal)
create table if not exists transactions (
  id bigserial primary key, company_id int not null references companies(id) on delete cascade,
  date date not null, kind text not null, category text not null default 'lainnya',
  amount bigint not null check (amount >= 0), funding text not null default 'company',
  partner_id int references partners(id) on delete set null, memo text not null default '',
  source text not null default 'manual', external_id text, created_at timestamptz not null default now()
);
create unique index if not exists tx_ext on transactions (company_id, external_id) where external_id is not null;
create index if not exists tx_date on transactions (company_id, date);
create table if not exists alloc_plans (
  company_id int not null references companies(id) on delete cascade, bucket text not null, pct numeric not null,
  primary key (company_id, bucket)
);
create table if not exists targets (
  id serial primary key, company_id int references companies(id) on delete cascade,
  period text not null, metric text not null, value bigint not null
);
create unique index if not exists targets_u on targets (coalesce(company_id, 0), period, metric);
create table if not exists employees (
  id serial primary key, company_id int not null references companies(id) on delete cascade,
  name text not null, role text not null default '', salary bigint not null default 0 check (salary >= 0),
  active boolean not null default true, created_at timestamptz not null default now()
);
-- Rekonsiliasi: saldo kas+bank sebenarnya dibandingkan dengan saldo menurut catatan Hub pada tanggal itu.
create table if not exists balance_checks (
  id serial primary key, company_id int not null references companies(id) on delete cascade,
  date date not null, book bigint not null, actual bigint not null, diff bigint not null,
  adjusted boolean not null default false, note text not null default '', created_at timestamptz not null default now()
);
create table if not exists notes (
  id serial primary key, kind text not null default 'ide', title text not null, body text not null default '',
  company_id int references companies(id) on delete set null, created_at timestamptz not null default now()
);
`;
