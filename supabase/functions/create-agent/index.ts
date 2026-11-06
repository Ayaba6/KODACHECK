// Edge Function : création sécurisée des comptes (commissaires et agents).
//
// La clé service_role ne quitte jamais le serveur. La fonction vérifie l'identité
// de l'appelant et applique les règles suivantes :
//   - super_admin : peut créer un commissaire ou un agent, dans n'importe quel commissariat ;
//   - commissaire : peut créer uniquement des agents (terrain / bureau) de SON commissariat.
//
// Chaque compte reçoit un matricule unique (MAT-XXXXXX). L'identifiant de connexion
// Supabase est <matricule>@kodacheck.com, ce qui correspond à l'écran de connexion.
//
// Déploiement : supabase functions deploy create-agent

import { createClient } from 'npm:@supabase/supabase-js@2';

const AUTH_EMAIL_DOMAIN = 'kodacheck.com';
const MIN_PASSWORD_LENGTH = 8;

type Role = 'super_admin' | 'commissaire' | 'agent_bureau' | 'agent_terrain';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeRole(raw: unknown): Role | null {
  const role = String(raw ?? '').toLowerCase().trim().replace(/\s+/g, '_');
  return ['super_admin', 'commissaire', 'agent_bureau', 'agent_terrain'].includes(role)
    ? (role as Role)
    : null;
}

function generateBadge(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `MAT-${hex.toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Configuration serveur incomplète.' }, 500);
  }

  // 1. Identification de l'appelant
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authentification requise.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Session invalide ou expirée.' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: caller, error: callerError } = await admin
    .from('profiles')
    .select('role, commissariat_id, active')
    .eq('id', userData.user.id)
    .single();
  if (callerError || !caller) return json({ error: 'Profil appelant introuvable.' }, 403);
  // Compte désactivé : plus aucun droit (la colonne n'existe qu'après la migration de désactivation)
  if (caller.active === false) return json({ error: 'Votre compte est désactivé.' }, 403);

  const callerRole = normalizeRole(caller.role);

  // 2. Validation des données
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const fullName = String(body.full_name ?? '').trim();
  const password = String(body.password ?? '');
  const role = normalizeRole(body.role);
  const contactEmail = String(body.contact_email ?? '').trim() || null;

  if (fullName.length < 3) return json({ error: 'Le nom complet est obligatoire.' }, 400);
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json({ error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` }, 400);
  }
  if (!role || role === 'super_admin') return json({ error: 'Rôle non autorisé.' }, 400);

  // 3. Contrôle des droits
  let commissariatId: string | null = null;

  if (callerRole === 'super_admin') {
    commissariatId = String(body.commissariat_id ?? '').trim() || null;
    if (!commissariatId) return json({ error: 'Le commissariat de rattachement est obligatoire.' }, 400);
  } else if (callerRole === 'commissaire') {
    if (role === 'commissaire') {
      return json({ error: 'Seul un super administrateur peut créer un commissaire.' }, 403);
    }
    commissariatId = caller.commissariat_id;
    if (!commissariatId) return json({ error: 'Votre compte n\'est rattaché à aucun commissariat.' }, 403);
  } else {
    return json({ error: 'Vous n\'avez pas les droits pour créer des comptes.' }, 403);
  }

  const { data: commissariat } = await admin
    .from('commissariats')
    .select('id')
    .eq('id', commissariatId)
    .maybeSingle();
  if (!commissariat) return json({ error: 'Commissariat introuvable.' }, 400);

  // 4. Génération d'un matricule unique
  let badge = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateBadge();
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('badge_number', candidate);
    if (!count) {
      badge = candidate;
      break;
    }
  }
  if (!badge) return json({ error: 'Impossible de générer un matricule unique, réessayez.' }, 500);

  const loginEmail = `${badge.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

  // 5. Création du compte + profil (avec annulation en cas d'échec)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, commissariat_id: commissariatId, badge_number: badge },
  });
  if (createError || !created?.user) {
    return json({ error: createError?.message ?? 'Création du compte impossible.' }, 400);
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    email: contactEmail ?? loginEmail,
    full_name: fullName,
    role,
    commissariat_id: commissariatId,
    badge_number: badge,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: `Profil non enregistré : ${profileError.message}` }, 500);
  }

  return json({ user_id: created.user.id, badge_number: badge, role, commissariat_id: commissariatId });
});
