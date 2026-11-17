-- N-Rechner: eigene Zeitfaktoren je Film und Entwickler
-- Im Supabase-Projekt „Apps“ im SQL-Editor einmal ausführen.
-- Jede Person sieht und ändert nur ihre eigenen Faktoren (wie bei rolls, cameras, frames, inventory).
-- Leere Faktoren bedeuten: Standardwert aus nrechner.js verwenden.

create table if not exists public.nrechner_faktoren (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  film       text not null check (length(trim(film)) > 0),
  entwickler text not null check (length(trim(entwickler)) > 0),
  n_plus2    numeric check (n_plus2  > 0 and n_plus2  < 4),
  n_plus1    numeric check (n_plus1  > 0 and n_plus1  < 4),
  n_minus1   numeric check (n_minus1 > 0 and n_minus1 < 4),
  n_minus2   numeric check (n_minus2 > 0 and n_minus2 < 4),
  updated_at timestamptz not null default now(),
  unique (user_id, film, entwickler)
);

create index if not exists nrechner_faktoren_user_id_idx on public.nrechner_faktoren (user_id);

alter table public.nrechner_faktoren enable row level security;

create policy "nrechner_faktoren: eigene" on public.nrechner_faktoren
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
