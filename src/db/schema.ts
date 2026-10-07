// Skema database STUDIODO Kasir (PostgreSQL / Supabase). Idempotent: aman dijalankan berulang.
// Semua nilai uang disimpan sebagai bigint rupiah (tanpa desimal).
// NAIKKAN versi ini setiap kali SCHEMA diubah agar database yang sudah ada ikut ter-upgrade.
export const SCHEMA_VERSION = "2026-10-07.3";

export const SCHEMA = `
create table if not exists users (
  id serial primary key,
  name text not null,
  role text not null check (role in ('owner','admin','kasir')),
  pin_hash text not null,
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists rooms (
  id serial primary key,
  name text not null,
  color text not null default '#4f4fe8',
  description text not null default '',
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists packages (
  id serial primary key,
  name text not null,
  category text not null default 'self_photo' check (category in ('self_photo','photobox','photobooth','lainnya')),
  description text not null default '',
  includes text not null default '',
  price bigint not null default 0,
  duration_min int not null default 30,
  max_people int not null default 2,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists addons (
  id serial primary key,
  name text not null,
  price bigint not null default 0,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists customers (
  id serial primary key,
  name text not null,
  phone text not null default '',
  instagram text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists customers_phone_idx on customers (phone);

create table if not exists bookings (
  id serial primary key,
  code text not null unique,
  customer_id int not null references customers(id),
  package_id int references packages(id),
  room_id int references rooms(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  people int not null default 1,
  status text not null default 'pending' check (status in ('pending','confirmed','done','cancelled','no_show')),
  source text not null default 'walkin',
  discount bigint not null default 0,
  total bigint not null default 0,
  notes text not null default '',
  created_by int references users(id),
  created_at timestamptz not null default now()
);
create index if not exists bookings_start_idx on bookings (start_at);
create index if not exists bookings_customer_idx on bookings (customer_id);

create table if not exists booking_items (
  id serial primary key,
  booking_id int not null references bookings(id) on delete cascade,
  kind text not null check (kind in ('package','addon','custom')),
  ref_id int,
  name text not null,
  qty int not null default 1,
  unit_price bigint not null default 0,
  amount bigint not null default 0,
  category text not null default 'lainnya'
);
create index if not exists booking_items_booking_idx on booking_items (booking_id);

create table if not exists accounts (
  id serial primary key,
  code text not null unique,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense')),
  subtype text not null default '',
  cf_category text check (cf_category in ('operating','investing','financing')),
  is_system boolean not null default false,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists journals (
  id serial primary key,
  date date not null,
  memo text not null default '',
  ref_type text not null default 'manual',
  ref_id int,
  voided boolean not null default false,
  created_by int references users(id),
  created_at timestamptz not null default now()
);
create index if not exists journals_date_idx on journals (date);
create index if not exists journals_ref_idx on journals (ref_type, ref_id);

create table if not exists journal_lines (
  id serial primary key,
  journal_id int not null references journals(id) on delete cascade,
  account_id int not null references accounts(id),
  debit bigint not null default 0,
  credit bigint not null default 0,
  check (debit >= 0 and credit >= 0)
);
create index if not exists journal_lines_journal_idx on journal_lines (journal_id);
create index if not exists journal_lines_account_idx on journal_lines (account_id);

create table if not exists payments (
  id serial primary key,
  booking_id int not null references bookings(id) on delete cascade,
  kind text not null default 'payment' check (kind in ('dp','payment','refund')),
  method text not null check (method in ('cash','qris','transfer')),
  amount bigint not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text not null default '',
  journal_id int references journals(id),
  voided boolean not null default false,
  created_by int references users(id)
);
create index if not exists payments_booking_idx on payments (booking_id);

create table if not exists expenses (
  id serial primary key,
  date date not null,
  account_id int not null references accounts(id),
  paid_from_account_id int not null references accounts(id),
  amount bigint not null check (amount > 0),
  vendor text not null default '',
  note text not null default '',
  receipt_url text not null default '',
  journal_id int references journals(id),
  voided boolean not null default false,
  created_by int references users(id)
);

create table if not exists fixed_assets (
  id serial primary key,
  name text not null,
  acquired_on date not null,
  cost bigint not null check (cost > 0),
  salvage bigint not null default 0,
  life_months int not null check (life_months > 0),
  asset_account_id int not null references accounts(id),
  paid_from_account_id int not null references accounts(id),
  purchase_journal_id int references journals(id),
  note text not null default '',
  disposed_on date,
  created_by int references users(id)
);

create table if not exists asset_depreciation (
  id serial primary key,
  asset_id int not null references fixed_assets(id) on delete cascade,
  period text not null,
  amount bigint not null,
  journal_id int references journals(id),
  unique (asset_id, period)
);

create table if not exists customer_files (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  booking_id int references bookings(id) on delete set null,
  title text not null,
  url text not null,
  kind text not null default 'foto_edit' check (kind in ('foto_asli','foto_edit','video','album','lainnya')),
  status text not null default 'proses' check (status in ('proses','siap','terkirim')),
  expires_on date,
  note text not null default '',
  created_by int references users(id),
  created_at timestamptz not null default now()
);
create index if not exists customer_files_customer_idx on customer_files (customer_id);

-- Keamanan: data hanya boleh diakses lewat server aplikasi (koneksi langsung).
-- RLS aktif tanpa policy => API publik Supabase (anon key) tidak bisa membaca apa pun.
alter table users enable row level security;
alter table settings enable row level security;
alter table rooms enable row level security;
alter table packages enable row level security;
alter table addons enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table accounts enable row level security;
alter table journals enable row level security;
alter table journal_lines enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table fixed_assets enable row level security;
alter table asset_depreciation enable row level security;
alter table customer_files enable row level security;

-- Google Drive: folder per customer & per sesi, id file Drive
alter table customers add column if not exists drive_folder_id text;
alter table bookings add column if not exists drive_folder_id text;
alter table customer_files add column if not exists drive_file_id text;

-- Website & booking online
alter table rooms add column if not exists image_url text not null default '';

-- Harga per orang, paket khusus walk-in, pilihan varian (warna/tema), dan pembatasan ruang per paket
alter table packages add column if not exists per_person boolean not null default false;
alter table packages add column if not exists bookable_online boolean not null default true;
alter table packages add column if not exists option_label text not null default '';
alter table packages add column if not exists options text not null default '';
alter table bookings add column if not exists option_choice text not null default '';
create table if not exists package_rooms (
  package_id int not null references packages(id) on delete cascade,
  room_id int not null references rooms(id) on delete cascade,
  primary key (package_id, room_id)
);
alter table package_rooms enable row level security;

-- Kategori tambahan (Wisuda, Keluarga & Pas Foto) + akun pendapatannya
alter table packages drop constraint if exists packages_category_check;
alter table packages add constraint packages_category_check check (category in ('self_photo','photobox','photobooth','wisuda','keluarga','lainnya'));
insert into accounts (code, name, type, subtype, cf_category, is_system, sort) values
 ('4106','Pendapatan Wisuda','revenue','sales','operating',true,45),
 ('4107','Pendapatan Foto Keluarga & Pas Foto','revenue','sales','operating',true,46)
on conflict (code) do nothing;
alter table packages add column if not exists image_url text not null default '';
alter table packages add column if not exists image_size text not null default 'md';
alter table packages add column if not exists image_fit text not null default 'cover';
alter table packages add column if not exists image_x int not null default 50;
alter table packages add column if not exists image_y int not null default 50;

-- Monitoring sesi live
alter table bookings add column if not exists started_at timestamptz;
alter table bookings add column if not exists finished_at timestamptz;

-- Bagan akun standar (bisa ditambah dari menu Keuangan > Akun)
insert into accounts (code, name, type, subtype, cf_category, is_system, sort) values
 ('1101','Kas','asset','cash',null,true,1),
 ('1102','Bank','asset','cash',null,true,2),
 ('1103','QRIS & E-Wallet','asset','cash',null,true,3),
 ('1201','Piutang Usaha','asset','receivable','operating',false,4),
 ('1501','Peralatan Kamera & Lighting','asset','fixed','investing',false,10),
 ('1502','Set, Dekorasi & Background','asset','fixed','investing',false,11),
 ('1503','Perabot & Elektronik','asset','fixed','investing',false,12),
 ('1590','Akumulasi Penyusutan','asset','accum','investing',true,19),
 ('2101','Utang Usaha','liability','payable','operating',false,20),
 ('2301','Pinjaman','liability','loan','financing',false,21),
 ('3101','Modal Pemilik','equity','capital','financing',true,30),
 ('3201','Prive (Penarikan Pemilik)','equity','drawing','financing',true,31),
 ('4101','Pendapatan Self Photo','revenue','sales','operating',true,40),
 ('4102','Pendapatan Photobox','revenue','sales','operating',true,41),
 ('4103','Pendapatan Photobooth','revenue','sales','operating',true,42),
 ('4104','Pendapatan Add-on & Cetak','revenue','sales','operating',true,43),
 ('4105','Pendapatan Lainnya','revenue','other','operating',true,44),
 ('5001','HPP: Kertas, Tinta & Bahan Cetak','expense','cogs','operating',false,50),
 ('5101','Gaji & Honor','expense','opex','operating',false,51),
 ('5102','Sewa Tempat','expense','opex','operating',false,52),
 ('5103','Listrik, Air & Internet','expense','opex','operating',false,53),
 ('5104','Pemasaran & Iklan','expense','opex','operating',false,54),
 ('5105','Perlengkapan & Kebersihan','expense','opex','operating',false,55),
 ('5106','Perawatan & Perbaikan','expense','opex','operating',false,56),
 ('5107','Biaya Admin Bank & QRIS','expense','opex','operating',false,57),
 ('5108','Transport','expense','opex','operating',false,58),
 ('5109','Beban Lain-lain','expense','opex','operating',false,59),
 ('5190','Beban Penyusutan','expense','depr','operating',true,60)
on conflict (code) do nothing;

insert into settings (key, value) values
 ('studio', '{"name":"STUDIODO","address":"","phone":"","open":"09:00","close":"21:00","slot":30,"footer":"Terima kasih sudah berfoto di STUDIODO!"}')
on conflict (key) do nothing;
`;
