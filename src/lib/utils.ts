import type { Role } from '../types';

/** Domaine des identifiants de connexion générés à partir du matricule. */
export const AUTH_EMAIL_DOMAIN = 'kodacheck.com';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super administrateur',
  commissaire: 'Commissaire',
  agent_bureau: 'Agent de bureau',
  agent_terrain: 'Agent de terrain',
};

export function normalizeRole(raw: unknown): Role | null {
  if (raw == null) return null;
  const role = String(raw).toLowerCase().trim().replace(/\s+/g, '_');
  return role in ROLE_LABELS ? (role as Role) : null;
}

/** Concatène des classes CSS en ignorant les valeurs vides. */
export function cn(...classes: Array<string | false | null | undefined | 0 | 0n>): string {
  return classes.filter(Boolean).join(' ');
}

/** Message lisible à partir de n'importe quelle erreur. */
export function getErrorMessage(err: unknown, fallback = 'Une erreur inattendue est survenue.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}

/** Échappe le HTML (impression de documents à partir de données saisies). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Nettoie un terme de recherche avant de l'insérer dans un filtre PostgREST `.or()`
 * (les virgules, parenthèses et jokers casseraient la requête).
 */
export function sanitizeSearch(value: string): string {
  return value
    .replace(/[,()%*\\"':]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Motif ILIKE tolérant aux séparateurs : « 11 RJ 8596 » trouve aussi « 11-RJ-8596 ».
 * Ne contient ni espace ni caractère réservé, donc utilisable dans `.or()`.
 */
export function toIlikePattern(term: string): string {
  const clean = sanitizeSearch(term).replace(/[\s-]+/g, '%');
  return `%${clean}%`;
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function todayISO(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function vehicleLabel(v: { brand?: string | null; model?: string | null }): string {
  return [v.brand, v.model].filter(Boolean).join(' ') || 'Engin non décrit';
}

/** Génère un mot de passe temporaire lisible (sans caractères ambigus). */
export function generateTempPassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
