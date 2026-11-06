import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { localDb } from '../lib/db';
import { getLastSync, syncVehiclesWithLocalDB } from '../lib/syncService';
import { sanitizeSearch, toIlikePattern } from '../lib/utils';
import type { StolenVehicle } from '../types';
import { normalizePlateInput, platesMatch } from '../utils/plateUtils';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

const compact = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function searchLocal(term: string): Promise<StolenVehicle[]> {
  const all = await localDb.stolen_vehicles.toArray();
  const needle = compact(term);
  const nameNeedle = term.toUpperCase();
  return all
    .filter((v) => v.status !== 'RECOVERED')
    .filter(
      (v) =>
        !needle ||
        compact(v.plate_number).includes(needle) ||
        platesMatch(v.plate_number, term) ||
        compact(v.vin).includes(needle) ||
        compact(v.report_number).includes(needle) ||
        (v.owner_name ?? '').toUpperCase().includes(nameNeedle),
    )
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 50);
}

/**
 * Registre des engins volés pour le terrain : recherche en ligne (Supabase) ou hors-ligne (IndexedDB),
 * synchronisation automatique et alertes en temps réel.
 */
export function useStolenRegistry(searchTerm: string, onNewAlert?: (v: StolenVehicle) => void) {
  const online = useOnlineStatus();
  const [results, setResults] = useState<StolenVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(getLastSync);
  const [localCount, setLocalCount] = useState<number | null>(null);

  const termRef = useRef(searchTerm);
  termRef.current = searchTerm;
  const alertRef = useRef(onNewAlert);
  alertRef.current = onNewAlert;

  const search = useCallback(async (term: string) => {
    setLoading(true);
    const clean = sanitizeSearch(term);
    try {
      if (navigator.onLine) {
        let req = supabase
          .from('stolen_vehicles')
          .select('*, commissariats:commissariat_id (nom, code)')
          .eq('status', 'STOLEN')
          .order('created_at', { ascending: false })
          .limit(50);
        if (clean) {
          const p = toIlikePattern(normalizePlateInput(clean));
          req = req.or(`plate_number.ilike.${p},vin.ilike.${p},owner_name.ilike.${p},report_number.ilike.${p}`);
        }
        const { data, error } = await req;
        if (error) throw error;
        setResults((data ?? []) as StolenVehicle[]);
      } else {
        setResults(await searchLocal(clean));
      }
    } catch (err) {
      // Réseau instable : repli automatique sur la base locale
      console.warn('Recherche en ligne impossible, repli hors-ligne :', err);
      setResults(await searchLocal(clean));
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    const count = await syncVehiclesWithLocalDB();
    setSyncing(false);
    if (count !== null) {
      setLastSync(getLastSync());
      setLocalCount(count);
    }
    return count;
  }, []);

  // Recherche avec anti-rebond
  useEffect(() => {
    const t = setTimeout(() => void search(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm, online, search]);

  // Synchronisation au démarrage et au retour du réseau
  useEffect(() => {
    if (online) void sync();
    else void localDb.stolen_vehicles.count().then(setLocalCount);
  }, [online, sync]);

  // Alertes temps réel (abonnement unique, indépendant de la saisie)
  useEffect(() => {
    const channel = supabase
      .channel('stolen_vehicles_terrain')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stolen_vehicles' }, async (payload) => {
        const vehicle = payload.new as StolenVehicle;
        if (vehicle.status && vehicle.status !== 'STOLEN') return;

        if (vehicle.commissariat_id) {
          const { data } = await supabase.from('commissariats').select('nom, code').eq('id', vehicle.commissariat_id).maybeSingle();
          vehicle.commissariats = data;
        }
        await localDb.stolen_vehicles.put(vehicle).catch(() => undefined);
        alertRef.current?.(vehicle);
        void search(termRef.current);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [search]);

  return { online, results, loading, syncing, lastSync, localCount, sync };
}
