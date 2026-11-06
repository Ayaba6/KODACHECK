import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, getErrorMessage, vehicleLabel } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { StolenVehicle, VehicleStatus } from '../types';
import { Alert, Button, Card, CardHeader, EmptyState, Input, PlateBadge, Skeleton, Tabs } from './ui';
import { RecoveryModal, VehicleDetailsModal, type RecoveryDetails } from './vehicles/VehicleModals';
import { markVehicleRecovered } from '../lib/recovery';
import { printVehicleReceipt } from './vehicles/printReceipt';

/** Registre national : consultation, recherche, restitution et impression des fiches. */
export function RegistrePage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<VehicleStatus>('STOLEN');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<StolenVehicle[]>([]);
  const [selected, setSelected] = useState<StolenVehicle | null>(null);
  const [toRecover, setToRecover] = useState<StolenVehicle | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('stolen_vehicles')
      .select('*, commissariats:commissariat_id (nom, code)')
      .order('created_at', { ascending: false });
    if (err) setError(getErrorMessage(err));
    else setVehicles((data ?? []) as StolenVehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  const handleConfirmRecovery = async (details: RecoveryDetails) => {
    if (!toRecover) return;
    try {
      await markVehicleRecovered(toRecover.id, details);
    } catch (err) {
      toast.error("Impossible de déclarer l'engin retrouvé", getErrorMessage(err));
      return;
    }

    const patch = {
      status: 'RECOVERED' as const,
      recovering_station: details.station,
      recovered_date: new Date().toISOString(),
    };
    setVehicles((list) => list.map((v) => (v.id === toRecover.id ? { ...v, ...patch } : v)));
    setSelected((v) => (v?.id === toRecover.id ? { ...v, ...patch } : v));
    toast.success('Engin déclaré retrouvé', `${toRecover.plate_number ?? vehicleLabel(toRecover)} a été retiré des avis de recherche et inscrit au journal.`);
    setToRecover(null);
  };

  const handlePrint = (vehicle: StolenVehicle) => {
    if (!printVehicleReceipt(vehicle)) {
      toast.warning('Impression bloquée', 'Autorisez les fenêtres surgissantes pour imprimer la fiche.');
    }
  };

  const counts = useMemo(
    () => ({
      STOLEN: vehicles.filter((v) => v.status !== 'RECOVERED').length,
      RECOVERED: vehicles.filter((v) => v.status === 'RECOVERED').length,
    }),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().replace(/[\s-]+/g, '');
    return vehicles.filter((v) => {
      const inTab = tab === 'RECOVERED' ? v.status === 'RECOVERED' : v.status !== 'RECOVERED';
      if (!inTab) return false;
      if (!term) return true;
      return [v.plate_number, v.owner_name, v.report_number, v.vin, v.brand, v.model]
        .some((field) => field?.toLowerCase().replace(/[\s-]+/g, '').includes(term));
    });
  }, [vehicles, tab, search]);

  return (
    <Card>
      <CardHeader
        icon={<FileText className="h-5 w-5" />}
        title="Registre national des engins"
        description="Tous les signalements enregistrés, tous commissariats confondus."
        actions={
          <Button variant="outline" size="sm" icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} onClick={fetchVehicles} disabled={loading}>
            Actualiser
          </Button>
        }
      />

      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            ariaLabel="Statut des engins"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'STOLEN', label: 'Recherchés', icon: <AlertTriangle className="h-4 w-4 text-red-500" />, count: counts.STOLEN },
              { value: 'RECOVERED', label: 'Retrouvés', icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, count: counts.RECOVERED },
            ]}
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Plaque, propriétaire, N° PV, VIN…"
            leading={<Search className="h-4 w-4" />}
            containerClassName="w-full lg:w-80"
            aria-label="Rechercher dans le registre"
          />
        </div>

        {error && (
          <Alert variant="error" title="Chargement impossible" action={<Button size="sm" variant="outline" onClick={fetchVehicles}>Réessayer</Button>}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={search ? 'Aucun résultat' : tab === 'STOLEN' ? 'Aucun engin recherché' : 'Aucun engin retrouvé'}
            description={search ? `Aucun engin ne correspond à « ${search} ».` : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {filtered.map((vehicle) => (
              <li key={vehicle.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(vehicle)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(vehicle)}
                  className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800/50 dark:focus-visible:bg-slate-800/50"
                >
                  <div className="w-32 shrink-0 sm:w-36">
                    <PlateBadge plate={vehicle.plate_number} tone={vehicle.status === 'RECOVERED' ? 'emerald' : 'red'} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{vehicleLabel(vehicle)}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {vehicle.owner_name ?? 'Propriétaire inconnu'}
                      <span className="hidden sm:inline"> · {vehicle.report_number ?? 'Signalement citoyen'}</span>
                    </p>
                  </div>
                  <p className="hidden shrink-0 text-xs text-slate-500 md:block dark:text-slate-400">
                    {formatDate(vehicle.status === 'RECOVERED' ? vehicle.recovered_date : vehicle.stolen_date ?? vehicle.created_at)}
                  </p>
                  {vehicle.status !== 'RECOVERED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="hidden shrink-0 sm:inline-flex"
                      onClick={(e) => {
                        e.stopPropagation();
                        setToRecover(vehicle);
                      }}
                    >
                      Retrouvé
                    </Button>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <VehicleDetailsModal
        vehicle={selected}
        onClose={() => setSelected(null)}
        onPrint={handlePrint}
        onMarkRecovered={(v) => setToRecover(v)}
      />
      <RecoveryModal
        vehicle={toRecover}
        defaultStation={profile?.commissariats?.nom ?? ''}
        onClose={() => setToRecover(null)}
        onConfirm={handleConfirmRecovery}
      />
    </Card>
  );
}
