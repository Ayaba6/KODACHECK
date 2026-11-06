import { useState, type FormEvent } from 'react';
import { AlertOctagon, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getErrorMessage, sanitizeSearch, toIlikePattern, vehicleLabel } from '../lib/utils';
import type { StolenVehicle } from '../types';
import { normalizePlateInput } from '../utils/plateUtils';
import { Alert, Button, Card, Input, PlateBadge } from './ui';
import { VehicleStatusBadge } from './vehicles/VehicleModals';

/** Vérification rapide d'un engin par plaque ou numéro de châssis. */
export function VehicleSearch({ onSelect }: { onSelect: (v: StolenVehicle) => void }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StolenVehicle[] | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const term = sanitizeSearch(query);
    if (term.length < 2) return;

    setLoading(true);
    setError(null);
    const pattern = toIlikePattern(normalizePlateInput(term));
    const { data, error: err } = await supabase
      .from('stolen_vehicles')
      .select('*, commissariats:commissariat_id (nom, code)')
      .or(`plate_number.ilike.${pattern},vin.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(20);
    setLoading(false);
    setSearched(term);

    if (err) {
      setError(getErrorMessage(err));
      setResults(null);
    } else {
      setResults((data ?? []) as StolenVehicle[]);
    }
  };

  const stolen = results?.filter((v) => v.status !== 'RECOVERED') ?? [];

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <Search className="h-5 w-5 text-brand-500" />
        Vérifier un engin
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Recherche par plaque ou numéro de châssis, dans tout le registre.</p>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex : 0029 D1 08"
          className="font-mono uppercase"
          containerClassName="flex-1"
          aria-label="Plaque ou numéro de châssis"
        />
        <Button type="submit" loading={loading} disabled={sanitizeSearch(query).length < 2} icon={<Search className="h-4 w-4" />}>
          Rechercher
        </Button>
      </form>

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {results && !error && (
        <div className="mt-4 space-y-3">
          {stolen.length > 0 ? (
            <Alert variant="error" title="Engin signalé volé">
              {stolen.length} signalement{stolen.length > 1 ? 's' : ''} actif{stolen.length > 1 ? 's' : ''} pour « {searched} ».
            </Alert>
          ) : (
            <Alert variant="success" title="Aucun avis de vol en cours">
              {results.length > 0
                ? `« ${searched} » figure au registre, mais l'engin a été retrouvé.`
                : `Aucun enregistrement pour « ${searched} ».`}
            </Alert>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(v)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    {v.status !== 'RECOVERED' && <AlertOctagon className="h-4 w-4 shrink-0 text-red-500" />}
                    {v.status === 'RECOVERED' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                    <PlateBadge plate={v.plate_number} size="sm" tone={v.status === 'RECOVERED' ? 'emerald' : 'red'} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{vehicleLabel(v)}</span>
                    <VehicleStatusBadge status={v.status} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
