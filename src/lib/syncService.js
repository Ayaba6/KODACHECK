import { supabase } from './supabase';
import { localDb } from './db';

export async function syncVehiclesWithLocalDB() {
  if (!navigator.onLine) {
    console.log("Hors ligne : impossible de synchroniser pour l'instant.");
    return false;
  }

  try {
    // Récupérer tous les véhicules volés depuis Supabase
    const { data, error } = await supabase
      .from('stolen_vehicles')
      .select('*')
      .eq('status', 'STOLEN');

    if (error) throw error;

    if (data) {
      // Vider la base locale et réinsérer les données fraîches
      await localDb.stolen_vehicles.clear();
      await localDb.stolen_vehicles.bulkPut(data);
      
      // Enregistrer la date de dernière synchro
      localStorage.setItem('last_sync_time', new Date().toLocaleString());
      return true;
    }
  } catch (err) {
    console.error("Erreur lors de la synchronisation locale:", err);
    return false;
  }
}