-- =====================================================================
-- Analoge Welt der Fotografie: komplette Datenbank-Einrichtung
--
-- So geht's: In Supabase links "SQL Editor" öffnen, "New query" wählen,
-- diesen GANZEN Text einfügen und auf "Run" klicken.
-- Du kannst die Datei gefahrlos mehrfach ausführen.
-- In dieser Datei steht keine E-Mail-Adresse oder ein Passwort.
-- =====================================================================


-- ---------------------------------------------------------------------
-- TEIL 1: Deine private Filmsammlung (Kameras, Filme, Frames, Fotos)
-- ---------------------------------------------------------------------

create table if not exists public.cameras (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  format      text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.rolls (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  camera_id         uuid references public.cameras(id) on delete set null,
  film              text not null,
  iso               int,
  format            text,
  push_pull         text,
  shot_on           date,
  status            text not null default 'belichtet'
                    check (status in ('geladen','belichtet','entwickelt','gescannt')),
  developed_on      date,
  developer         text,
  dilution          text,
  temp_c            numeric(4,1),
  time_min          text,
  agitation         text,
  stop_bath         text,
  stop_time         text,
  fixer             text,
  fixer_dilution    text,
  fixer_time        text,
  fixer_agitation   text,
  wetting_agent     text,
  wetting_dilution  text,
  wetting_time      text,
  notes             text,
  created_at        timestamptz not null default now()
);

-- Falls "rolls" aus einer älteren Version existiert: fehlende Spalten ergänzen
alter table public.rolls
  add column if not exists stop_time         text,
  add column if not exists fixer_dilution    text,
  add column if not exists fixer_time        text,
  add column if not exists fixer_agitation   text,
  add column if not exists wetting_agent     text,
  add column if not exists wetting_dilution  text,
  add column if not exists wetting_time      text;

create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  roll_id     uuid not null references public.rolls(id) on delete cascade,
  path        text not null,
  caption     text,
  created_at  timestamptz not null default now()
);

-- Einzelbilder (Frames) eines Films: Blende, Zeit, Objektiv, Motiv ...
create table if not exists public.frames (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  roll_id     uuid not null references public.rolls(id) on delete cascade,
  frame_no    int  not null check (frame_no > 0),
  aperture    text,                       -- z. B. f/8
  shutter     text,                       -- z. B. 1/125
  lens        text,                       -- z. B. 50mm f/1.8
  subject     text,                       -- Motiv
  location    text,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (roll_id, frame_no)
);

create index if not exists rolls_user_idx  on public.rolls(user_id, created_at desc);
create index if not exists frames_roll_idx on public.frames(roll_id);
create index if not exists photos_roll_idx on public.photos(roll_id);


-- ---------------------------------------------------------------------
-- TEIL 2: Öffentliche Entwicklungsdatenbank (Filme, Entwickler, Zeiten)
-- ---------------------------------------------------------------------

create table if not exists public.ref_films (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,
  name        text not null,
  iso         int,
  formats     text,
  process     text not null default 'sw'
              check (process in ('sw','sw_c41','c41','e6','sonstige')),
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.ref_developers (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,
  name        text not null,
  process     text not null default 'sw'
              check (process in ('sw','c41','e6','sonstige')),
  kind        text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.ref_times (
  id            uuid primary key default gen_random_uuid(),
  film_id       uuid not null references public.ref_films(id) on delete cascade,
  developer_id  uuid not null references public.ref_developers(id) on delete cascade,
  dilution      text,
  ei            int,
  temp_c        numeric(4,1),
  time_min      text not null,
  agitation     text,
  source        text,
  notes         text,
  created_at    timestamptz not null default now()
);

create unique index if not exists ref_films_uq      on public.ref_films (lower(brand), lower(name));
create unique index if not exists ref_developers_uq on public.ref_developers (lower(brand), lower(name));
create index if not exists ref_times_film_idx on public.ref_times(film_id);
create index if not exists ref_times_dev_idx  on public.ref_times(developer_id);


-- ---------------------------------------------------------------------
-- TEIL 3: Wer darf die öffentliche Datenbank ändern? (Admin-Liste)
-- Die Liste ist von außen nicht lesbar. Du trägst dich später selbst ein.
-- ---------------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------
-- TEIL 4: Sicherheitsregeln (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.cameras         enable row level security;
alter table public.rolls           enable row level security;
alter table public.photos          enable row level security;
alter table public.frames          enable row level security;
alter table public.ref_films       enable row level security;
alter table public.ref_developers  enable row level security;
alter table public.ref_times       enable row level security;

-- Alte Regeln dieser Tabellen entfernen, damit nichts doppelt oder veraltet ist
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('cameras','rolls','photos','frames','ref_films','ref_developers','ref_times')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Private Daten: jeder sieht und ändert nur seine eigenen Zeilen
create policy "cameras: eigene" on public.cameras
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "rolls: eigene" on public.rolls
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "frames: eigene" on public.frames
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "photos: eigene" on public.photos
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Öffentliche Datenbank: alle dürfen lesen, nur Admins dürfen ändern
create policy "ref_films: lesen" on public.ref_films
  for select to anon, authenticated using (true);
create policy "ref_films: admin anlegen" on public.ref_films
  for insert to authenticated with check (public.is_admin());
create policy "ref_films: admin ändern" on public.ref_films
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ref_films: admin löschen" on public.ref_films
  for delete to authenticated using (public.is_admin());

create policy "ref_developers: lesen" on public.ref_developers
  for select to anon, authenticated using (true);
create policy "ref_developers: admin anlegen" on public.ref_developers
  for insert to authenticated with check (public.is_admin());
create policy "ref_developers: admin ändern" on public.ref_developers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ref_developers: admin löschen" on public.ref_developers
  for delete to authenticated using (public.is_admin());

create policy "ref_times: lesen" on public.ref_times
  for select to anon, authenticated using (true);
create policy "ref_times: admin anlegen" on public.ref_times
  for insert to authenticated with check (public.is_admin());
create policy "ref_times: admin ändern" on public.ref_times
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ref_times: admin löschen" on public.ref_times
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- TEIL 5: Speicher für deine Fotos (privat, jeder nur im eigenen Ordner)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos storage: eigener Ordner" on storage.objects;
create policy "photos storage: eigener Ordner" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ---------------------------------------------------------------------
-- TEIL 6: Startdaten (nur Namen von Filmen und Entwicklern, keine Zeiten)
-- ---------------------------------------------------------------------

-- 4) Startdaten: Filme (nur Namen, keine Zeiten) --------
insert into public.ref_films (brand, name, iso, formats, process) values
  ('Ilford','HP5 Plus',400,'35mm, 120, Planfilm','sw'),
  ('Ilford','FP4 Plus',125,'35mm, 120, Planfilm','sw'),
  ('Ilford','Delta 100 Professional',100,'35mm, 120, Planfilm','sw'),
  ('Ilford','Delta 400 Professional',400,'35mm, 120, Planfilm','sw'),
  ('Ilford','Delta 3200 Professional',3200,'35mm, 120','sw'),
  ('Ilford','Pan F Plus',50,'35mm, 120','sw'),
  ('Ilford','SFX 200',200,'35mm, 120','sw'),
  ('Ilford','Ortho Plus',80,'120, Planfilm','sw'),
  ('Ilford','XP2 Super',400,'35mm, 120','sw_c41'),
  ('Kentmere','Pan 100',100,'35mm, 120','sw'),
  ('Kentmere','Pan 400',400,'35mm, 120','sw'),
  ('Harman','Phoenix 200',200,'35mm','c41'),
  ('Kodak','Tri-X 400',400,'35mm, 120, Planfilm','sw'),
  ('Kodak','T-Max 100',100,'35mm, 120, Planfilm','sw'),
  ('Kodak','T-Max 400',400,'35mm, 120, Planfilm','sw'),
  ('Kodak','T-Max P3200',3200,'35mm','sw'),
  ('Kodak','Double-X 5222',250,'35mm','sw'),
  ('Kodak','Portra 160',160,'35mm, 120','c41'),
  ('Kodak','Portra 400',400,'35mm, 120','c41'),
  ('Kodak','Portra 800',800,'35mm, 120','c41'),
  ('Kodak','Ektar 100',100,'35mm, 120','c41'),
  ('Kodak','Gold 200',200,'35mm','c41'),
  ('Kodak','UltraMax 400',400,'35mm','c41'),
  ('Kodak','ColorPlus 200',200,'35mm','c41'),
  ('Kodak','Ektachrome E100',100,'35mm, 120','e6'),
  ('Fujifilm','Neopan Acros 100 II',100,'35mm, 120','sw'),
  ('Fujifilm','Fujicolor C200',200,'35mm','c41'),
  ('Fujifilm','Superia X-Tra 400',400,'35mm','c41'),
  ('Fujifilm','Velvia 50',50,'35mm, 120','e6'),
  ('Fujifilm','Velvia 100',100,'35mm, 120','e6'),
  ('Fujifilm','Provia 100F',100,'35mm, 120','e6'),
  ('Foma','Fomapan 100 Classic',100,'35mm, 120, Planfilm','sw'),
  ('Foma','Fomapan 200 Creative',200,'35mm, 120, Planfilm','sw'),
  ('Foma','Fomapan 400 Action',400,'35mm, 120, Planfilm','sw'),
  ('Rollei','RPX 25',25,'35mm, 120','sw'),
  ('Rollei','RPX 100',100,'35mm, 120','sw'),
  ('Rollei','RPX 400',400,'35mm, 120','sw'),
  ('Rollei','Retro 80S',80,'35mm, 120','sw'),
  ('Rollei','Retro 400S',400,'35mm, 120','sw'),
  ('Rollei','Superpan 200',200,'35mm, 120','sw'),
  ('Adox','CHS 100 II',100,'35mm, 120, Planfilm','sw'),
  ('Adox','Silvermax',100,'35mm','sw'),
  ('Agfa','APX 100',100,'35mm, 120','sw'),
  ('Agfa','APX 400',400,'35mm, 120','sw'),
  ('AgfaPhoto','Vista Plus 200',200,'35mm','c41'),
  ('CineStill','800T',800,'35mm, 120','c41'),
  ('CineStill','50D',50,'35mm, 120','c41'),
  ('CineStill','400D',400,'35mm, 120','c41'),
  ('Lomography','Lady Grey 400',400,'35mm, 120','sw'),
  ('Lomography','Earl Grey 100',100,'35mm, 120','sw'),
  ('Lomography','Color Negative 100',100,'35mm, 120','c41'),
  ('Lomography','Color Negative 400',400,'35mm, 120','c41'),
  ('Lomography','Color Negative 800',800,'35mm, 120','c41'),
  ('JCH','StreetPan 400',400,'35mm, 120','sw')
on conflict do nothing;

-- 5) Startdaten: Entwickler und Kits --------------------
insert into public.ref_developers (brand, name, process, kind) values
  ('Ilford','ID-11','sw','Pulver'),
  ('Ilford','Ilfotec DD-X','sw','Flüssig'),
  ('Ilford','Ilfotec HC','sw','Flüssig'),
  ('Ilford','Ilfotec LC29','sw','Flüssig'),
  ('Ilford','Ilfosol 3','sw','Flüssig'),
  ('Ilford','Perceptol','sw','Pulver'),
  ('Ilford','Microphen','sw','Pulver'),
  ('Kodak','D-76','sw','Pulver'),
  ('Kodak','HC-110','sw','Flüssig'),
  ('Kodak','XTOL','sw','Pulver'),
  ('Kodak','T-Max Developer','sw','Flüssig'),
  ('Kodak','Microdol-X','sw','Pulver'),
  ('Agfa','Rodinal','sw','Flüssig'),
  ('Adox','Adonal','sw','Flüssig'),
  ('Adox','FX-39 II','sw','Flüssig'),
  ('Tetenal','Ultrafin Liquid','sw','Flüssig'),
  ('Foma','Fomadon P','sw','Pulver'),
  ('Foma','Fomadon R09','sw','Flüssig'),
  ('Foma','Fomadon Excel','sw','Flüssig'),
  ('Compard','R09 One Shot','sw','Flüssig'),
  ('Spur','Acurol-N','sw','Flüssig'),
  ('Spur','HRX-3','sw','Flüssig'),
  ('Bellini','Eco Pro BW','sw','Flüssig'),
  ('CineStill','DF96','sw','Monobad'),
  ('Kodak','Flexicolor C-41','c41','Kit'),
  ('Tetenal','Colortec C-41','c41','Kit'),
  ('Bellini','C-41 Kit','c41','Kit'),
  ('CineStill','CS41','c41','Kit'),
  ('Rollei','Digibase C41','c41','Kit'),
  ('Kodak','E-6 Kit','e6','Kit'),
  ('Tetenal','E-6 3-Bad-Kit','e6','Kit'),
  ('Bellini','E-6 Kit','e6','Kit')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- Optional, nur falls du früher "schema_katalog.sql" ausgeführt hattest:
-- Zum Aufräumen die zwei Zeilen unten einkommentieren (-- entfernen).
-- ---------------------------------------------------------------------
-- alter table public.rolls drop column if exists film_id, drop column if exists developer_id;
-- drop table if exists public.dev_times, public.developer_catalog, public.film_catalog;
