// Skema Frameless Hub. Idempotent; naikkan SCHEMA_VERSION setiap ada perubahan.
export const SCHEMA_VERSION = "9";

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

-- v4: akses per peran, profil karyawan, gaji & slip, dokumen, hutang/piutang
create unique index if not exists users_name_u on users (lower(name));
alter table transactions add column if not exists project text;
alter table transactions add column if not exists ref text;
alter table users add column if not exists employee_id int references employees(id) on delete set null;
alter table users add column if not exists partner_id int references partners(id) on delete set null;
-- pay_type: monthly (gaji pokok bulanan) | weekly (mingguan) | freelance (fee per proyek, tanpa gaji pokok)
alter table employees add column if not exists pay_type text not null default 'monthly';
alter table employees add column if not exists position text not null default '';
alter table employees add column if not exists join_date date;
alter table employees add column if not exists phone text not null default '';
alter table employees add column if not exists bank_name text not null default '';
alter table employees add column if not exists bank_account text not null default '';
alter table employees add column if not exists id_number text not null default '';
alter table employees add column if not exists address text not null default '';
alter table employees add column if not exists emergency_contact text not null default '';
alter table employees add column if not exists notes text not null default '';
-- kind: bonus | fee_proyek (menambah) · potongan | kasbon (mengurangi)
create table if not exists pay_items (
  id serial primary key, employee_id int not null references employees(id) on delete cascade,
  date date not null, kind text not null, amount bigint not null check (amount >= 0),
  project text not null default '', note text not null default '', payslip_id int,
  created_at timestamptz not null default now()
);
create index if not exists pay_items_emp on pay_items (employee_id, date);
create table if not exists payslips (
  id serial primary key, employee_id int not null references employees(id) on delete cascade,
  company_id int not null references companies(id) on delete cascade, period text not null,
  base bigint not null default 0, weeks int not null default 0, bonus bigint not null default 0,
  fee bigint not null default 0, deduction bigint not null default 0, net bigint not null default 0,
  status text not null default 'draft', paid_on date, tx_id bigint, note text not null default '',
  created_at timestamptz not null default now(), unique (employee_id, period)
);
-- visibility: owner | team | investor | karyawan | all
create table if not exists documents (
  id serial primary key, title text not null, kind text not null default 'dokumen',
  company_id int references companies(id) on delete set null, visibility text not null default 'owner',
  url text not null default '', body text not null default '', employee_id int references employees(id) on delete set null,
  created_at timestamptz not null default now()
);
-- kind: hutang (kita berutang) | piutang (orang berutang ke kita)
create table if not exists obligations (
  id serial primary key, kind text not null, party text not null, company_id int references companies(id) on delete set null,
  amount bigint not null check (amount >= 0), paid bigint not null default 0, due date,
  note text not null default '', created_at timestamptz not null default now()
);
-- v7: hutang gaji per karyawan & periode. Dibayar (dicicil) → otomatis tercatat sebagai biaya gaji di unitnya.
alter table obligations add column if not exists employee_id int references employees(id) on delete set null;
alter table obligations add column if not exists period text;

-- v8: aset perusahaan (dibeli dari kas) dihitung sebagai modal bersama, dibagi rata antar partner di kolam modal.
alter table companies add column if not exists share_company_assets boolean not null default false;

-- v5: inventaris aset. status: aktif | perbaikan | rusak | dijual | hilang. tx_id = pembelian di buku besar (bila ada).
create table if not exists assets (
  id serial primary key, company_id int not null references companies(id) on delete cascade,
  name text not null, category text not null default 'alat', qty int not null default 1 check (qty >= 1),
  acquired_on date, cost bigint not null default 0 check (cost >= 0), life_years int not null default 4 check (life_years >= 1),
  status text not null default 'aktif', est_value bigint, location text not null default '', holder text not null default '',
  serial text not null default '', note text not null default '', tx_id bigint, status_on date, sale_price bigint,
  created_at timestamptz not null default now()
);
create unique index if not exists assets_tx_u on assets (tx_id) where tx_id is not null;
create index if not exists assets_co on assets (company_id, status);

-- v9: satu pembayaran bisa berlaku untuk beberapa bulan (mis. sewa ruko setahun = 12). Dipakai alokasi beban bersama.
alter table transactions add column if not exists cover_months int not null default 1 check (cover_months between 1 and 60);
`;
