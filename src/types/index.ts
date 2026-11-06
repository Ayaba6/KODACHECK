export type Role = 'super_admin' | 'commissaire' | 'agent_bureau' | 'agent_terrain';

export type VehicleStatus = 'STOLEN' | 'RECOVERED';

export interface Commissariat {
  id: string;
  code: string;
  nom: string;
  ville: string | null;
  region: string | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  commissariat_id: string | null;
  badge_number: string | null;
  created_at?: string;
  commissariats?: Pick<Commissariat, 'id' | 'nom' | 'code'> | null;
}

export interface StolenVehicle {
  id: string;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  vin: string | null;
  owner_name: string | null;
  owner_phone?: string | null;
  report_number: string | null;
  stolen_date: string | null;
  declaring_station?: string | null;
  recovering_station?: string | null;
  recovered_date?: string | null;
  status: VehicleStatus | null;
  /** Date d'activation d'une déclaration citoyenne (après paiement confirmé). */
  activated_at?: string | null;
  /** Origine : PV saisi par un agent ou déclaration en ligne d'un citoyen. */
  source?: 'agent' | 'citoyen' | null;
  commissariat_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
  commissariats?: Pick<Commissariat, 'nom' | 'code'> | null;
}
