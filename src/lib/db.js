import Dexie from 'dexie';

// Création de la base de données locale sur l'appareil
export const localDb = new Dexie('SecuriteRoutiereDB');

// Définition du schéma et des index de recherche
localDb.version(1).stores({
  stolen_vehicles: 'id, plate_number, vin, brand, model, owner_name, report_number'
});