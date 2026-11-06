-- =====================================================================
-- KodaCheck — Paiement des déclarations citoyennes (CinetPay)
-- =====================================================================
-- À exécuter en une fois dans l'éditeur SQL de Supabase, APRÈS
-- 20261106_securite_rls.sql. Transactionnel : en cas d'erreur, rien ne change.
--
-- Fonctionnement :
--   * une déclaration citoyenne est créée au statut PENDING_PAYMENT,
--     invisible des agents ;
--   * l'Edge Function « payments » (clé service_role) initialise le paiement
--     chez CinetPay, puis l'active (statut STOLEN) une fois le paiement
--     confirmé par l'API CinetPay ;
--   * une déclaration non payée sous 24 h est supprimée.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Registre : date d'activation (sert aux alertes temps réel du terrain)
-- ---------------------------------------------------------------------
alter table public.stolen_vehicles add column if not exists activated_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Table des paiements (accessible uniquement côté serveur et super admin)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.stolen_vehicles (id) on delete set null,
  provider text not null default 'cinetpay',
  merchant_transaction_id text not null unique,   -- notre référence, envoyée à CinetPay
  provider_transaction_id text,                   -- référence CinetPay
  notify_token text,                              -- secret de vérification des notifications
  amount integer not null check (amount > 0),
  currency text not null default 'XOF',
  payer_phone text,
  status text not null default 'INITIATED',       -- INITIATED, PENDING, SUCCESS, FAILED, EXPIRED…
  payment_method text,
  last_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_vehicle_idx on public.payments (vehicle_id);

alter table public.payments enable row level security;

-- Lecture réservée au super admin (rapprochement comptable) ; aucune écriture client.
drop policy if exists pay_select_admin on public.payments;
create policy pay_select_admin on public.payments
  for select to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 3. Les agents ne voient pas les déclarations en attente de paiement
-- ---------------------------------------------------------------------
drop policy if exists sv_select_agents on public.stolen_vehicles;
create policy sv_select_agents on public.stolen_vehicles
  for select to authenticated
  using (public.is_agent() and (status is distinct from 'PENDING_PAYMENT' or public.is_super_admin()));

-- ---------------------------------------------------------------------
-- 4. Déclaration citoyenne : créée « en attente de paiement »,
--    appelable uniquement par l'Edge Function (service_role)
-- ---------------------------------------------------------------------
drop function if exists public.declare_stolen_vehicle(text, text, text, text, text, text, text, uuid, date, double precision, double precision);

create function public.declare_stolen_vehicle(
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
returns table (vehicle_id uuid, report_number text)
language plpgsql security definer set search_path = public as $$
declare
  v_plate text := upper(left(trim(coalesce(p_plate_number, '')), 20));
  v_vin text := nullif(upper(left(trim(coalesce(p_vin, '')), 40)), '');
  v_phone text := left(trim(coalesce(p_owner_phone, '')), 20);
  v_lat double precision := p_latitude;
  v_lng double precision := p_longitude;
  v_id uuid;
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

  -- Nettoyage : déclarations jamais payées depuis plus de 24 h
  delete from public.stolen_vehicles sv
   where sv.status = 'PENDING_PAYMENT' and sv.created_at < now() - interval '24 hours';

  insert into public.stolen_vehicles as sv (
    plate_number, vin, brand, model, color, owner_name, owner_phone,
    commissariat_id, stolen_date, latitude, longitude, status, source
  ) values (
    v_plate, v_vin,
    left(coalesce(nullif(trim(p_brand), ''), 'Non précisée'), 50),
    left(coalesce(trim(p_model), ''), 50),
    left(nullif(trim(p_color), ''), 30),
    left(trim(p_owner_name), 100),
    v_phone, p_commissariat_id, p_stolen_date, v_lat, v_lng,
    'PENDING_PAYMENT', 'citoyen'
  )
  returning sv.id, sv.report_number into v_id, v_report;

  vehicle_id := v_id;
  report_number := v_report;
  return next;
end;
$$;

-- Plus d'appel anonyme direct : la déclaration passe par l'Edge Function de paiement.
revoke all on function public.declare_stolen_vehicle(text, text, text, text, text, text, text, uuid, date, double precision, double precision) from public, anon, authenticated;
grant execute on function public.declare_stolen_vehicle(text, text, text, text, text, text, text, uuid, date, double precision, double precision) to service_role;

-- ---------------------------------------------------------------------
-- 5. Activation après paiement confirmé (idempotente, service_role uniquement)
-- ---------------------------------------------------------------------
create or replace function public.activate_paid_declaration(p_merchant_transaction_id text, p_response jsonb, p_payment_method text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_vehicle uuid;
begin
  update public.payments
     set status = 'SUCCESS',
         paid_at = coalesce(paid_at, now()),
         updated_at = now(),
         last_response = p_response,
         payment_method = coalesce(p_payment_method, payment_method)
   where merchant_transaction_id = p_merchant_transaction_id
  returning vehicle_id into v_vehicle;

  if v_vehicle is null then
    return false;
  end if;

  update public.stolen_vehicles
     set status = 'STOLEN', activated_at = now()
   where id = v_vehicle and status = 'PENDING_PAYMENT';

  return true;
end;
$$;

revoke all on function public.activate_paid_declaration(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.activate_paid_declaration(text, jsonb, text) to service_role;

commit;
