import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Résumé d'une déclaration, conservé pendant le passage sur la page de paiement CinetPay. */
export interface DeclarationSummary {
  plate: string;
  vehicle: string;
  owner: string;
  phone: string;
  commissariat: string;
  stolenDate: string;
  coords: { lat: number; lng: number } | null;
  reportNumber: string | null;
}

const key = (ref: string) => `kodacheck:declaration:${ref}`;

export function saveSummary(ref: string, summary: DeclarationSummary) {
  try {
    sessionStorage.setItem(key(ref), JSON.stringify(summary));
  } catch {
    /* stockage indisponible : le partage WhatsApp sera simplement moins détaillé */
  }
}

export function readSummary(ref: string): DeclarationSummary | null {
  try {
    const raw = sessionStorage.getItem(key(ref));
    return raw ? (JSON.parse(raw) as DeclarationSummary) : null;
  } catch {
    return null;
  }
}

export function whatsappShareUrl(s: DeclarationSummary): string {
  const lines = [
    '🚨 *AVIS DE VOL — KODACHECK*',
    '',
    `• *Plaque / châssis :* ${s.plate}`,
    `• *Engin :* ${s.vehicle}`,
    `• *Contact :* ${s.owner} — ${s.phone}`,
    `• *Commissariat :* ${s.commissariat}`,
    ...(s.reportNumber ? [`• *N° de dossier :* ${s.reportNumber}`] : []),
    `• *Date du vol :* ${new Date(`${s.stolenDate}T00:00:00`).toLocaleDateString('fr-FR')}`,
    ...(s.coords ? [`• *Position :* https://www.google.com/maps?q=${s.coords.lat},${s.coords.lng}`] : []),
    '',
    'Si vous voyez cet engin, contactez le commissariat le plus proche.',
  ];
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`;
}

async function callPayments<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('payments', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Le service de paiement a renvoyé une erreur.');
    }
    throw new Error('Service de paiement injoignable. Vérifiez votre connexion internet.');
  }
  if (!data) throw new Error('Réponse vide du service de paiement.');
  return data;
}

export interface PaymentInit {
  ref: string;
  payment_url: string;
  report_number: string | null;
  amount: number;
}

export function initPayment(declaration: Record<string, unknown>): Promise<PaymentInit> {
  return callPayments<PaymentInit>({ action: 'init', ...declaration });
}

export interface PaymentStatusResult {
  status: string;
  amount: number;
  report_number: string | null;
  plate_number: string | null;
}

export function getPaymentStatus(ref: string): Promise<PaymentStatusResult> {
  return callPayments<PaymentStatusResult>({ action: 'status', ref });
}
