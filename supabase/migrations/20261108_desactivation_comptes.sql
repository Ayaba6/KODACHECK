-- =====================================================================
-- KodaCheck — Désactivation des comptes
-- =====================================================================
-- À exécuter dans l'éditeur SQL de Supabase, après 20261106_securite_rls.sql.
-- Indépendant de la migration des paiements (ordre indifférent).
--
-- Un compte désactivé n'a plus AUCUN rôle aux yeux des règles d'accès :
-- il ne lit plus le registre et ne peut plus rien modifier, avec effet immédiat
-- (même si l'agent est déjà connecté). Il peut seulement lire son propre profil,
-- ce qui permet à l'application d'afficher « Compte désactivé ».
-- =====================================================================

begin;

alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists deactivated_at timestamptz;
alter table public.profiles add column if not exists deactivated_by uuid references auth.users (id) on delete set null;

-- Rôle effectif : aucun si le compte est désactivé. Toutes les règles (is_agent,
-- is_commissaire, is_super_admin, can_manage_registry) s'appuient sur cette fonction.
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select lower(replace(trim(role), ' ', '_')) from public.profiles where id = auth.uid() and active;
$$;

-- ---------------------------------------------------------------------
-- Désactiver / réactiver un agent
--   * commissaire : agents (terrain / bureau) de son commissariat ;
--   * super admin : tout compte, sauf le sien.
-- ---------------------------------------------------------------------
create or replace function public.set_account_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_commissariat uuid;
begin
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre compte.' using errcode = '42501';
  end if;

  select lower(role), commissariat_id into v_role, v_commissariat from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;

  if not public.is_super_admin() then
    if not public.is_commissaire() then
      raise exception 'Action réservée aux commissaires.' using errcode = '42501';
    end if;
    if v_role not in ('agent_terrain', 'agent_bureau', 'agent') then
      raise exception 'Seuls les agents peuvent être désactivés par un commissaire.' using errcode = '42501';
    end if;
    if v_commissariat is distinct from public.get_my_commissariat_id() then
      raise exception 'Cet agent n''appartient pas à votre commissariat.' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set active = p_active,
         deactivated_at = case when p_active then null else now() end,
         deactivated_by = case when p_active then null else auth.uid() end,
         updated_at = now()
   where id = p_user_id;
end;
$$;

revoke all on function public.set_account_active(uuid, boolean) from public, anon;
grant execute on function public.set_account_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- « Retirer » un agent le détache ET le désactive : sans commissariat,
-- l'ancien compte ne doit plus avoir accès au registre national.
-- (Le super admin peut le réaffecter et le réactiver.)
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

  update public.profiles
     set commissariat_id = null,
         active = false,
         deactivated_at = now(),
         deactivated_by = auth.uid(),
         updated_at = now()
   where id = p_agent_id;
end;
$$;

revoke all on function public.remove_agent_from_commissariat(uuid) from public, anon;
grant execute on function public.remove_agent_from_commissariat(uuid) to authenticated;

-- Les agents déjà « retirés » auparavant (sans commissariat) sont désactivés
update public.profiles
   set active = false, deactivated_at = coalesce(deactivated_at, now())
 where commissariat_id is null
   and lower(coalesce(role, '')) in ('agent_terrain', 'agent_bureau', 'agent')
   and active;

commit;
