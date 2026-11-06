import { supabase } from './supabase';
import type { RecoveryDetails } from '../components/vehicles/VehicleModals';

/**
 * Déclare un engin retrouvé (fonction contrôlée côté serveur) : met à jour la fiche
 * et inscrit la restitution au journal, au nom de l'agent connecté.
 */
export async function markVehicleRecovered(vehicleId: string, details: RecoveryDetails): Promise<void> {
  const { error } = await supabase.rpc('mark_vehicle_recovered', {
    p_vehicle_id: vehicleId,
    p_station: details.station,
    p_note: details.note,
    p_latitude: details.latitude,
    p_longitude: details.longitude,
  });
  if (error) throw error;
}
