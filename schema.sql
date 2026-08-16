-- Jalankan ini di Supabase: Dashboard > SQL Editor > New query > Run

create table tims (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  skema text not null default 'PKM-RE',
  status text not null default 'Draft',
  access_code text not null unique,      -- kode akses untuk ketua tim login
  milestones jsonb not null default '{}',
  skor jsonb not null default '{}',
  catatan text not null default '',
  jadwal jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Row Level Security: aktifkan, lalu buka akses baca/tulis via anon key
-- (kontrol akses sebenarnya dilakukan di level aplikasi lewat access_code / password manajemen)
alter table tims enable row level security;

create policy "allow all select" on tims for select using (true);
create policy "allow all insert" on tims for insert with check (true);
create policy "allow all update" on tims for update using (true);
create policy "allow all delete" on tims for delete using (true);

-- Contoh data awal (opsional, boleh dihapus)
insert into tims (nama, skema, access_code) values
  ('Tim Contoh', 'PKM-RE', 'CONTOH123');
