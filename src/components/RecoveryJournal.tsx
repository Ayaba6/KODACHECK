import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, RefreshCw, Search, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, getErrorMessage, ROLE_LABELS, normalizeRole } from '../lib/utils';
import { Alert, Button, Card, CardHeader, EmptyState, Input, PlateBadge, Skeleton } from './ui';

interface RecoveryEntry {
  id: string;
  vehicle_id: string | null;
  plate_number: string | null;
  vehicle_label: string | null;
  recovered_by_name: string | null;
  recovered_by_badge: string | null;
  recovered_by_role: string | null;
  station: string;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

/**
 * Journal des restitutions : qui a retrouvé quel engin, quand, où.
 * Le contenu visible dépend des règles d'accès (commissariat de l'utilisateur, ou tout pour le super admin).
 */
export function RecoveryJournal({ description }: { description?: string }) {
  const [entries, setEntries] = useState<RecoveryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('recovery_log')
      .select('id, vehicle_id, plate_number, vehicle_label, recovered_by_name, recovered_by_badge, recovered_by_role, station, note, latitude, longitude, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) {
      setError(
        err.code === '42P01' || err.code === 'PGRST205'
          ? "Le journal n'est pas encore activé : la migration 20261109_journal_restitutions.sql doit être appliquée."
          : getErrorMessage(err),
      );
    } else {
      setEntries((data ?? []) as RecoveryEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.toUpperCase().replace(/[\s-]+/g, '');
    if (!term) return entries;
    return entries.filter((e) =>
      [e.plate_number, e.recovered_by_name, e.recovered_by_badge, e.station].some((f) => (f ?? '').toUpperCase().replace(/[\s-]+/g, '').includes(term)),
    );
  }, [entries, search]);

  return (
    <Card>
      <CardHeader
        icon={<ClipboardList className="h-5 w-5" />}
        title="Journal des restitutions"
        description={description ?? 'Engins retrouvés : par qui, quand et où.'}
        actions={
          <>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Plaque, agent, unité…"
              leading={<Search className="h-4 w-4" />}
              containerClassName="w-full sm:w-56"
              aria-label="Rechercher dans le journal"
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}>
              Actualiser
            </Button>
          </>
        }
      />
      <div className="p-5">
        {error ? (
          <Alert variant="error" title="Journal indisponible">
            {error}
          </Alert>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={search ? 'Aucun résultat' : 'Aucune restitution enregistrée'}
            description={search ? undefined : 'Les engins déclarés retrouvés (par le terrain ou le bureau) apparaîtront ici.'}
          />
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
            {filtered.map((e) => {
              const role = normalizeRole(e.recovered_by_role);
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <PlateBadge plate={e.plate_number} tone="emerald" size="sm" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{e.vehicle_label || 'Engin'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(e.created_at, true)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    Retrouvé par <strong>{e.station}</strong>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5" />
                      {e.recovered_by_name ?? 'Agent'}
                      {e.recovered_by_badge && <span className="font-mono">· {e.recovered_by_badge}</span>}
                      {role && <span>· {ROLE_LABELS[role]}</span>}
                    </span>
                    {e.latitude != null && e.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Lieu
                      </a>
                    )}
                  </p>
                  {e.note && <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950/50 dark:text-slate-300">{e.note}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
