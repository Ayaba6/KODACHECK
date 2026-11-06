-- =====================================================================
-- KodaCheck — Sécurisation des accès à la base (Row Level Security)
-- =====================================================================
-- À exécuter en une fois dans l'éditeur SQL de Supabase.
-- Le script est transactionnel : en cas d'erreur, rien n'est modifié.
--
-- Principes :
--   * un visiteur non connecté ne lit QUE la liste des commissariats et
--     déclare un vol uniquement via la fonction contrôlée declare_stolen_vehicle ;
--   * le registre n'est lisible que par les comptes ayant un rôle KodaCheck ;
--   * seuls le bureau, les commissaires et le super admin modifient le registre ;
--   * personne ne peut changer son propre rôle ; les comptes sont créés par
--     l'Edge Function create-agent (clé service_role, côté serveur).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Origine des signalements (agent / citoyen)
-- ---------------------------------------------------------------------
alter table public.stolen_vehicles add column if not exists source text not null default 'agent';

-- Rattrapage des déclarations citoyennes existantes : elles ont un téléphone
-- et pas de service déclarant (contrairement aux PV saisis par le bureau).
update public.stolen_vehicles
   set source = 'citoyen'
 where source = 'agent' and owner_phone is not null and declaring_station is null;

alter table public.stolen_vehicles drop constraint if exists stolen_vehicles_source_check;
alter table public.stolen_vehicles add constraint stolen_vehicles_source_check check (source in ('agent', 'citoyen'));

-- ---------------------------------------------------------------------
-- 1. Fonctions d'aide (rôle normalisé de l'utilisateur connecté)
-- ---------------------------------------------------------------------
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select lower(replace(trim(role), ' ', '_')) from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'super_admin', false);
$$;

-- Accepte désormais 'commissaire' quelle que soit la casse (avant : 'COMMISSAIRE' seulement)
create or replace function public.is_commissaire()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'commissaire', false);
$$;

create or replace function public.is_agent()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('super_admin', 'commissaire', 'agent_bureau', 'agent_terrain'), false);
$$;

create or replace function public.can_manage_registry()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('super_admin', 'commissaire', 'agent_bureau'), false);
$$;

create or replace function public.get_my_commissariat_id()
returns uuid language sql stable security definer set search_path = public as $$
  select commissariat_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 2. Suppression de TOUTES les règles existantes sur les 3 tables
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'public' and tablename in ('stolen_vehicles', 'profiles', 'commissariats')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.stolen_vehicles enable row level security;
alter table public.profiles enable row level security;
alter table public.commissariats enable row level security;

-- ---------------------------------------------------------------------
-- 3. Registre des engins (stolen_vehicles)
-- ---------------------------------------------------------------------
-- Lecture : tous les comptes KodaCheck (le registre est national) ; aucun accès anonyme.
create policy sv_select_agents on public.stolen_vehicles
  for select to authenticated using (public.is_agent());

-- Saisie de PV et restitution : bureau, commissaires, super admin.
create policy sv_insert_registry on public.stolen_vehicles
  for insert to authenticated with check (public.can_manage_registry());

create policy sv_update_registry on public.stolen_vehicles
  for update to authenticated
  using (public.can_manage_registry())
  with check (public.can_manage_registry());

-- Suppression : super admin, ou commissaire pour les fiches de son commissariat.
create policy sv_delete on public.stolen_vehicles
  for delete to authenticated
  using (public.is_super_admin() or (public.is_commissaire() and commissariat_id = public.get_my_commissariat_id()));

-- ---------------------------------------------------------------------
-- 4. Commissariats
-- ---------------------------------------------------------------------
-- Lecture publique (liste déroulante de l'espace citoyen) ; écriture : super admin.
create policy comm_select_all on public.commissariats
  for select to anon, authenticated using (true);

create policy comm_insert_admin on public.commissariats
  for insert to authenticated with check (public.is_super_admin());

create policy comm_update_admin on public.commissariats
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy comm_delete_admin on public.commissariats
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 5. Profils
-- ---------------------------------------------------------------------
-- Chacun lit son profil ; le commissaire lit les profils de son commissariat ;
-- le super admin lit et gère tout. Aucune modification de son propre profil
-- (donc impossible de s'attribuer un rôle).
create policy prof_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy prof_select_commissaire on public.profiles
  for select to authenticated
  using (public.is_commissaire() and commissariat_id is not null and commissariat_id = public.get_my_commissariat_id());

create policy prof_select_admin on public.profiles
  for select to authenticated using (public.is_super_admin());

create policy prof_insert_admin on public.profiles
  for insert to authenticated with check (public.is_super_admin());

create policy prof_update_admin on public.profiles
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy prof_delete_admin on public.profiles
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 6. Création de compte : le rôle ne vient plus des données saisies
-- ---------------------------------------------------------------------
-- Avant : le rôle était lu dans raw_user_meta_data, que la personne qui s'inscrit
-- choisit librement. Désormais le profil est créé sans rôle ; c'est l'Edge Function
-- create-agent (service_role) qui attribue rôle, commissariat et matricule.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role, commissariat_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_app_meta_data ->> 'role', -- app_metadata : modifiable uniquement côté serveur
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Déclaration citoyenne contrôlée (seul point d'écriture anonyme)
-- ---------------------------------------------------------------------
create or replace function public.declare_stolen_vehicle(
  p_plate_number text,
  p_vin text,
  p_brand text,
  p_model text,
  p_color text,
  p_owner_name text,
  p_owner_phone text,
  p_commissariat_id uuid,
  p_stolen_date date,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_plate text := upper(left(trim(coalesce(p_plate_number, '')), 20));
  v_vin text := nullif(upper(left(trim(coalesce(p_vin, '')), 40)), '');
  v_phone text := left(trim(coalesce(p_owner_phone, '')), 20);
  v_lat double precision := p_latitude;
  v_lng double precision := p_longitude;
  v_report text;
begin
  if v_plate = '' and v_vin is null then
    raise exception 'Indiquez la plaque ou le numéro de châssis.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_owner_name, ''))) < 3 then
    raise exception 'Le nom du propriétaire est obligatoire.' using errcode = '22023';
  end if;
  if v_phone !~ '^\+?[0-9 ]{8,19}$' then
    raise exception 'Numéro de téléphone invalide.' using errcode = '22023';
  end if;
  if p_stolen_date is null or p_stolen_date > current_date or p_stolen_date < current_date - 365 then
    raise exception 'Date du vol invalide.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.commissariats where id = p_commissariat_id) then
    raise exception 'Commissariat inconnu.' using errcode = '22023';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null;
    v_lng := null;
  end if;

  insert into public.stolen_vehicles (
    plate_number, vin, brand, model, color, owner_name, owner_phone,
    commissariat_id, stolen_date, latitude, longitude, status, source
  ) values (
    v_plate,
    v_vin,
    left(coalesce(nullif(trim(p_brand), ''), 'Non précisée'), 50),
    left(coalesce(trim(p_model), ''), 50),
    left(nullif(trim(p_color), ''), 30),
    left(trim(p_owner_name), 100),
    v_phone,
    p_commissariat_id,
    p_stolen_date,
    v_lat,
    v_lng,
    'STOLEN',
    'citoyen'
  )
  returning report_number into v_report; -- n° généré par le trigger trigger_generate_pv

  return v_report;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Retrait d'un agent par son commissaire (vérifications côté serveur)
-- ---------------------------------------------------------------------
create or replace function public.remove_agent_from_commissariat(p_agent_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_commissariat uuid;
begin
  if not (public.is_commissaire() or public.is_super_admin()) then
    raise exception 'Action réservée aux commissaires.' using errcode = '42501';
  end if;

  select lower(role), commissariat_id into v_role, v_commissariat from public.profiles where id = p_agent_id;
  if not found then
    raise exception 'Agent introuvable.' using errcode = 'P0002';
  end if;
  if v_role not in ('agent_terrain', 'agent_bureau', 'agent') then
    raise exception 'Seuls les agents peuvent être retirés.' using errcode = '42501';
  end if;
  if not public.is_super_admin() and v_commissariat is distinct from public.get_my_commissariat_id() then
    raise exception 'Cet agent n''appartient pas à votre commissariat.' using errcode = '42501';
  end if;

  update public.profiles set commissariat_id = null, updated_at = now() where id = p_agent_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Droits d'exécution des fonctions
-- ---------------------------------------------------------------------
revoke all on function public.declare_stolen_vehicle(text, text, text, text, text, text, text, uuid, date, double precision, double precision) from public;
grant execute on function public.declare_stolen_vehicle(text, text, text, text, text, text, text, uuid, date, double precision, double precision) to anon, authenticated;

revoke all on function public.remove_agent_from_commissariat(uuid) from public, anon;
grant execute on function public.remove_agent_from_commissariat(uuid) to authenticated;

-- La saisie de PV par le bureau reste soumise aux règles ci-dessus (fonction « invoker »)
revoke all on function public.create_stolen_vehicle_with_pv(text, text, text, text, text, text, date, uuid) from public, anon;
grant execute on function public.create_stolen_vehicle_with_pv(text, text, text, text, text, text, date, uuid) to authenticated;

commit;
