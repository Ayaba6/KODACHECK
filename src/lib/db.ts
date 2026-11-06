import Dexie, { type Table } from 'dexie';
import type { StolenVehicle } from '../types';

/** Base locale (IndexedDB) pour la consultation hors-ligne sur le terrain. */
class KodacheckLocalDB extends Dexie {
  stolen_vehicles!: Table<StolenVehicle, string>;

  constructor() {
    super('SecuriteRoutiereDB');
    this.version(1).stores({
      stolen_vehicles: 'id, plate_number, vin, brand, model, owner_name, report_number',
    });
  }
}

export const localDb = new KodacheckLocalDB();
