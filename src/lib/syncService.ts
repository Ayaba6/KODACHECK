import { supabase } from './supabase';
import { localDb } from './db';
import type { StolenVehicle } from '../types';

const LAST_SYNC_KEY = 'last_sync_time';

export function getLastSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Recopie le registre des engins volés dans la base locale.
 * Retourne le nombre d'engins synchronisés, ou null en cas d'échec / hors-ligne.
 */
export async function syncVehiclesWithLocalDB(): Promise<number | null> {
  if (!navigator.onLine) return null;

  try {
    const { data, error } = await supabase
      .from('stolen_vehicles')
      .select('*, commissariats:commissariat_id (nom, code)')
      .eq('status', 'STOLEN');

    if (error) throw error;

    const vehicles = (data ?? []) as StolenVehicle[];
    await localDb.transaction('rw', localDb.stolen_vehicles, async () => {
      await localDb.stolen_vehicles.clear();
      await localDb.stolen_vehicles.bulkPut(vehicles);
    });

    try {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch {
      /* stockage indisponible : sans conséquence */
    }
    return vehicles.length;
  } catch (err) {
    console.error('Erreur lors de la synchronisation locale :', err);
    return null;
  }
}
