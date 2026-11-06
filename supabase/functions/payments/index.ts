// Edge Function « payments » : paiement des déclarations citoyennes via CinetPay.
//
// Routes (même fonction, champ « action » ou sous-chemin) :
//   POST {action:"init", ...}        → crée la déclaration (en attente) et le paiement CinetPay,
//                                       renvoie l'URL de la page de paiement CinetPay ;
//   POST {action:"status", ref}      → statut d'un paiement (revérifie chez CinetPay si besoin) ;
//   POST /payments/webhook           → notification CinetPay (vérifiée par notify_token, puis
//                                       statut relu auprès de l'API CinetPay : on ne fait jamais
//                                       confiance au statut contenu dans la notification).
//
// Déploiement : désactiver « Verify JWT » pour cette fonction (CinetPay n'envoie pas de JWT).
//
// Secrets à définir (Edge Functions → Secrets) :
//   CINETPAY_API_KEY, CINETPAY_API_PASSWORD   identifiants du compte marchand Burkina Faso
//   CINETPAY_ENV                              « sandbox » (défaut) ou « production »
//   APP_URL                                   adresse publique de KodaCheck, ex. https://kodacheck.bf
//   DECLARATION_FEE                           montant en FCFA (défaut : 2000)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Statuts CinetPay définitifs (cf. SDK officiel : ApiStatus::isFinal). */
const FINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'EXPIRED', 'TRANSACTION_EXIST', 'INSUFFICIENT_BALANCE']);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const env = (name: string) => Deno.env.get(name)?.trim() ?? '';

function config() {
  const production = env('CINETPAY_ENV').toLowerCase() === 'production';
  const fee = Number.parseInt(env('DECLARATION_FEE') || '2000', 10);
  return {
    apiKey: env('CINETPAY_API_KEY'),
    apiPassword: env('CINETPAY_API_PASSWORD'),
    baseUrl: production ? 'https://api.cinetpay.co' : 'https://api.cinetpay.net',
    appUrl: env('APP_URL').replace(/\/+$/, ''),
    supabaseUrl: env('SUPABASE_URL'),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    fee: Number.isFinite(fee) && fee > 0 ? fee : 2000,
  };
}

// ---------------------------------------------------------------------------
// Client CinetPay (API REST v1 : jeton Bearer obtenu avec api_key / api_password)
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function cinetpayRequest(method: 'GET' | 'POST', path: string, body?: unknown, retry = true): Promise<Record<string, unknown>> {
  const cfg = config();
  const token = await accessToken();
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(data.status ?? '');
  if ((res.status === 401 || status === 'EXPIRED_TOKEN' || status === 'INVALID_TOKEN') && retry) {
    cachedToken = null;
    return cinetpayRequest(method, path, body, false);
  }
  if (res.status === 422 || res.status >= 400) {
    throw new Error(`CinetPay ${res.status} : ${String(data.description ?? data.message ?? status ?? 'erreur')}`);
  }
  return data;
}

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const cfg = config();
  const res = await fetch(`${cfg.baseUrl}/v1/oauth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: cfg.apiKey, api_password: cfg.apiPassword }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const nested = (data.data ?? {}) as Record<string, unknown>;
  const token = String(data.access_token ?? nested.token ?? '');
  if (!res.ok || !token) throw new Error('Authentification CinetPay refusée : vérifiez CINETPAY_API_KEY / CINETPAY_API_PASSWORD.');
  const expiresIn = Number(data.expires_in ?? nested.expires_in ?? 300);
  cachedToken = { token, expiresAt: Date.now() + Math.max(0, expiresIn - 30) * 1000 };
  return token;
}

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/** Référence marchande unique (≤ 30 caractères, exigence CinetPay). */
function newMerchantRef(): string {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `KC${Date.now().toString(36).toUpperCase()}${hex}`.slice(0, 30);
}

/** Numéro burkinabè au format E.164 (+226XXXXXXXX), ou null. */
function toE164(phone: unknown): string | null {
  const digits = String(phone ?? '').replace(/[^\d]/g, '');
  const local = digits.startsWith('226') && digits.length === 11 ? digits.slice(3) : digits;
  return /^\d{8}$/.test(local) ? `+226${local}` : null;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? 'Client';
  const last = parts[0] ?? 'KodaCheck';
  const pad = (s: string) => (s.length >= 2 ? s : `${s}.`).slice(0, 100);
  return { first: pad(first), last: pad(last) };
}

function supabaseAdmin(): SupabaseClient {
  const cfg = config();
  return createClient(cfg.supabaseUrl, cfg.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ---------------------------------------------------------------------------
// Confirmation : statut canonique relu auprès de CinetPay
// ---------------------------------------------------------------------------
async function confirmPayment(db: SupabaseClient, merchantRef: string): Promise<string> {
  const canonical = await cinetpayRequest('GET', `/v1/payment/${encodeURIComponent(merchantRef)}`);
  const status = String(canonical.status ?? 'UNKNOWN');
  if (String(canonical.merchant_transaction_id ?? merchantRef) !== merchantRef) {
    throw new Error('Réponse CinetPay incohérente (référence différente).');
  }
  const method = typeof canonical.payment_method === 'string' ? canonical.payment_method : null;

  if (status === 'SUCCESS') {
    const { error } = await db.rpc('activate_paid_declaration', {
      p_merchant_transaction_id: merchantRef,
      p_response: canonical,
      p_payment_method: method,
    });
    if (error) throw error;
  } else {
    await db
      .from('payments')
      .update({ status, last_response: canonical, updated_at: new Date().toISOString() })
      .eq('merchant_transaction_id', merchantRef)
      .neq('status', 'SUCCESS');
  }
  return status;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
async function handleInit(db: SupabaseClient, body: Record<string, unknown>) {
  const cfg = config();
  if (!cfg.apiKey || !cfg.apiPassword || !cfg.appUrl) {
    return json({ error: 'Le paiement en ligne n’est pas encore configuré. Réessayez plus tard.' }, 503);
  }

  const payerPhone = toE164(body.payer_phone ?? body.owner_phone);

  // 1. Déclaration en attente de paiement (validations dans la fonction SQL)
  const { data: declared, error: declareError } = await db.rpc('declare_stolen_vehicle', {
    p_plate_number: body.plate_number ?? '',
    p_vin: body.vin ?? '',
    p_brand: body.brand ?? '',
    p_model: body.model ?? '',
    p_color: body.color ?? '',
    p_owner_name: body.owner_name ?? '',
    p_owner_phone: body.owner_phone ?? '',
    p_commissariat_id: body.commissariat_id ?? null,
    p_stolen_date: body.stolen_date ?? null,
    p_latitude: typeof body.latitude === 'number' ? body.latitude : null,
    p_longitude: typeof body.longitude === 'number' ? body.longitude : null,
  });
  if (declareError) return json({ error: declareError.message }, 400);
  const row = Array.isArray(declared) ? declared[0] : declared;
  const vehicleId = row?.vehicle_id as string | undefined;
  if (!vehicleId) return json({ error: 'Déclaration non enregistrée.' }, 500);

  // 2. Paiement CinetPay
  const merchantRef = newMerchantRef();
  const { first, last } = splitName(String(body.owner_name ?? ''));
  const email = String(body.email ?? '').trim();
  const returnUrl = `${cfg.appUrl}/?paiement=${merchantRef}#citoyen`;

  const { error: insertError } = await db.from('payments').insert({
    vehicle_id: vehicleId,
    merchant_transaction_id: merchantRef,
    amount: cfg.fee,
    currency: 'XOF',
    payer_phone: payerPhone,
    status: 'INITIATED',
  });
  if (insertError) return json({ error: 'Paiement non enregistré.' }, 500);

  try {
    const init = await cinetpayRequest('POST', '/v1/payment', {
      currency: 'XOF',
      merchant_transaction_id: merchantRef,
      amount: cfg.fee,
      success_url: returnUrl,
      failed_url: returnUrl,
      notify_url: `${cfg.supabaseUrl}/functions/v1/payments/webhook`,
      lang: 'fr',
      designation: 'Frais de declaration KodaCheck',
      client_first_name: first,
      client_last_name: last,
      client_email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : 'declaration@kodacheck.app',
      ...(payerPhone ? { client_phone_number: payerPhone } : {}),
    });

    const paymentUrl = typeof init.payment_url === 'string' ? init.payment_url : null;
    await db
      .from('payments')
      .update({
        provider_transaction_id: init.transaction_id ?? null,
        notify_token: init.notify_token ?? null,
        status: paymentUrl ? 'PENDING' : String(init.status ?? 'FAILED'),
        last_response: { ...init, notify_token: undefined },
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_transaction_id', merchantRef);

    if (!paymentUrl) return json({ error: 'CinetPay n’a pas fourni de page de paiement. Réessayez.' }, 502);

    return json({
      ref: merchantRef,
      payment_url: paymentUrl,
      report_number: row?.report_number ?? null,
      amount: cfg.fee,
    });
  } catch (err) {
    await db.from('payments').update({ status: 'FAILED', updated_at: new Date().toISOString() }).eq('merchant_transaction_id', merchantRef);
    console.error('Initialisation CinetPay échouée :', err);
    return json({ error: 'Le service de paiement est momentanément indisponible. Réessayez dans quelques instants.' }, 502);
  }
}

async function handleStatus(db: SupabaseClient, body: Record<string, unknown>) {
  const ref = String(body.ref ?? '').trim();
  if (!/^KC[A-Z0-9]{6,28}$/.test(ref)) return json({ error: 'Référence invalide.' }, 400);

  const { data: payment } = await db
    .from('payments')
    .select('status, amount, vehicle_id, stolen_vehicles:vehicle_id (report_number, plate_number, vin, status)')
    .eq('merchant_transaction_id', ref)
    .maybeSingle();
  if (!payment) return json({ error: 'Paiement introuvable.' }, 404);

  let status = payment.status as string;
  if (!FINAL_STATUSES.has(status)) {
    try {
      status = await confirmPayment(db, ref); // filet de sécurité si la notification n'est pas arrivée
    } catch (err) {
      console.warn('Vérification CinetPay impossible :', err);
    }
  }
  const vehicle = (payment.stolen_vehicles ?? null) as { report_number?: string; plate_number?: string; vin?: string } | null;
  return json({
    status,
    amount: payment.amount,
    report_number: vehicle?.report_number ?? null,
    plate_number: vehicle?.plate_number ?? null,
  });
}

async function handleWebhook(db: SupabaseClient, req: Request) {
  // CinetPay peut tester la disponibilité de l'URL par un simple GET
  if (req.method === 'GET') return new Response('ok', { status: 200 });

  const raw = await req.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = Object.fromEntries(new URLSearchParams(raw));
  }

  const ref = String(payload.merchant_transaction_id ?? '').trim();
  const notifyToken = String(payload.notify_token ?? '');
  const providerId = String(payload.transaction_id ?? '');
  if (!ref || !notifyToken) return new Response('ignored', { status: 200 });

  const { data: payment } = await db
    .from('payments')
    .select('notify_token, provider_transaction_id')
    .eq('merchant_transaction_id', ref)
    .maybeSingle();

  // Notification inconnue ou falsifiée : on répond 200 (pas de nouvelle tentative) sans rien faire
  if (!payment?.notify_token || !timingSafeEqual(notifyToken, payment.notify_token)) {
    console.warn('Notification CinetPay rejetée pour', ref);
    return new Response('ignored', { status: 200 });
  }
  if (payment.provider_transaction_id && providerId && payment.provider_transaction_id !== providerId) {
    console.warn('Identifiant CinetPay incohérent pour', ref);
    return new Response('ignored', { status: 200 });
  }

  try {
    await confirmPayment(db, ref);
  } catch (err) {
    console.error('Confirmation CinetPay échouée :', err);
    return new Response('retry', { status: 500 }); // CinetPay renverra la notification
  }
  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const db = supabaseAdmin();
  const path = new URL(req.url).pathname;
  if (path.endsWith('/webhook')) return handleWebhook(db, req);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  if (body.action === 'init') return handleInit(db, body);
  if (body.action === 'status') return handleStatus(db, body);
  return json({ error: 'Action inconnue.' }, 400);
});
