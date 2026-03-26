-- Run this in Supabase SQL Editor before importing SEPOMEX data

create table if not exists codigos_postales (
  cp        text primary key,
  municipio text not null,
  estado    text not null,
  colonias  text[] not null default '{}'
);

-- Index for fast CP lookups (primary key already indexed, but explicit for clarity)
create index if not exists idx_codigos_postales_cp on codigos_postales (cp);

-- Public read access (no auth needed for CP lookup in wizard/QRStudio)
alter table codigos_postales enable row level security;
create policy "Public read" on codigos_postales for select using (true);
