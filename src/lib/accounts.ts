import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Role } from '../types';

export interface CreateAccountInput {
  full_name: string;
  password: string;
  role: Exclude<Role, 'super_admin'>;
  /** Obligatoire pour le super admin, ignoré pour un commissaire (son propre commissariat). */
  commissariat_id?: string;
  /** Email de contact facultatif (l'identifiant de connexion reste le matricule). */
  contact_email?: string;
}

export interface CreateAccountResult {
  user_id: string;
  badge_number: string;
  role: Role;
  commissariat_id: string;
}

/**
 * Crée un compte via l'Edge Function `create-agent`.
 * Les droits sont vérifiés côté serveur : aucune clé privilégiée dans le navigateur.
 */
export async function createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
  const { data, error } = await supabase.functions.invoke<CreateAccountResult>('create-agent', {
    body: input,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'La création du compte a échoué.');
    }
    throw new Error(
      "Service de création de comptes injoignable. Vérifiez votre connexion ou le déploiement de la fonction create-agent.",
    );
  }
  if (!data) throw new Error('Réponse vide du serveur.');
  return data;
}
