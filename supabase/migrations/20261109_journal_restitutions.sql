-- =====================================================================
-- KodaCheck — Engins retrouvés : déclaration depuis le terrain et journal
-- =====================================================================
-- À exécuter dans l'éditeur SQL de Supabase, après 20261108_desactivation_comptes.sql.
--
--   * tout agent actif (terrain, bureau, commissaire, super admin) peut déclarer
--     un engin retrouvé, uniquement via la fonction contrôlée mark_vehicle_recovered ;
--   * chaque restitution est inscrite au journal : qui, quand, où, quelle unité, note ;
--   * le journal n'est jamais modifiable depuis l'application (trace d'audit).
-- =====================================================================

begin;

create table if not exists public.recovery_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.stolen_vehicles (id) on delete set null,
  plate_number text,                  -- copie : le journal reste lisible si la fiche est supprimée
  vehicle_label text,
  declaring_commissariat_id uuid references public.commissariats (id) on delete set null,
  recovered_by uuid references auth.users (id) on delete set null,
  recovered_by_name text,
  recovered_by_badge text,
  recovered_by_role text,
  commissariat_id uuid references public.commissariats (id) on delete set null,  -- unité de l'agent
  station text not null,
  note text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists recovery_log_created_idx on public.recovery_log (created_at desc);
create index if not exists recovery_log_commissariat_idx on public.recovery_log (commissariat_id);
create index if not exists recovery_log_declaring_idx on public.recovery_log (declaring_commissariat_id);

alter table public.recovery_log enable row level security;

-- Lecture : super admin (tout) ; commissaire et bureau (restitutions faites par leur unité
-- ou concernant un engin déclaré par leur unité) ; chaque agent voit ses propres restitutions.
drop policy if exists rl_select on public.recovery_log;
create policy rl_select on public.recovery_log
  for select to authenticated
  using (
    public.is_super_admin()
    or recovered_by = auth.uid()
    or (
      public.can_manage_registry()
      and public.get_my_commissariat_id() is not null
      and public.get_my_commissariat_id() in (commissariat_id, declaring_commissariat_id)
    )
  );
-- Aucune règle d'écriture : seules les fonctions ci-dessous écrivent dans le journal.

-- ---------------------------------------------------------------------
-- Déclarer un engin retrouvé
-- ---------------------------------------------------------------------
create or replace function public.mark_vehicle_recovered(
  p_vehicle_id uuid,
  p_station text default null,
  p_note text default null,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_vehicle public.stolen_vehicles%rowtype;
  v_me public.profiles%rowtype;
  v_station text;
  v_lat double precision := p_latitude;
  v_lng double precision := p_longitude;
begin
  if not public.is_agent() then
    raise exception 'Action réservée aux agents KodaCheck.' using errcode = '42501';
  end if;

  select * into v_vehicle from public.stolen_vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'Engin introuvable.' using errcode = 'P0002';
  end if;
  if v_vehicle.status = 'RECOVERED' then
    raise exception 'Cet engin est déjà signalé comme retrouvé.' using errcode = '22023';
  end if;
  if v_vehicle.status is distinct from 'STOLEN' then
    raise exception 'Cet engin n''est pas dans la liste des engins recherchés.' using errcode = '22023';
  end if;

  select * into v_me from public.profiles where id = auth.uid();
  -- Unité : celle saisie, sinon le commissariat de l'agent
  v_station := left(coalesce(
    nullif(trim(p_station), ''),
    (select nom from public.commissariats where id = v_me.commissariat_id),
    'Unité non précisée'
  ), 120);

  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null;
    v_lng := null;
  end if;

  update public.stolen_vehicles
     set status = 'RECOVERED',
         recovering_station = v_station,
         recovered_date = now(),
         recovered_notes = nullif(left(trim(coalesce(p_note, '')), 500), '')
   where id = p_vehicle_id;

  insert into public.recovery_log (
    vehicle_id, plate_number, vehicle_label, declaring_commissariat_id,
    recovered_by, recovered_by_name, recovered_by_badge, recovered_by_role, commissariat_id,
    station, note, latitude, longitude
  ) values (
    v_vehicle.id,
    v_vehicle.plate_number,
    trim(coalesce(v_vehicle.brand, '') || ' ' || coalesce(v_vehicle.model, '')),
    v_vehicle.commissariat_id,
    auth.uid(), v_me.full_name, v_me.badge_number, lower(v_me.role), v_me.commissariat_id,
    v_station,
    nullif(left(trim(coalesce(p_note, '')), 500), ''),
    v_lat, v_lng
  );
end;
$$;

revoke all on function public.mark_vehicle_recovered(uuid, text, text, double precision, double precision) from public, anon;
grant execute on function public.mark_vehicle_recovered(uuid, text, text, double precision, double precision) to authenticated;

commit;
