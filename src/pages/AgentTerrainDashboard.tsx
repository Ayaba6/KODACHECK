import { useCallback, useState } from 'react';
import { Bell, Camera, CheckCircle2, ChevronRight, CloudOff, RefreshCw, Search, ShieldAlert, Wifi, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useStolenRegistry } from '../hooks/useStolenRegistry';
import { formatDate, vehicleLabel } from '../lib/utils';
import { compactPlate } from '../utils/plateUtils';
import type { StolenVehicle } from '../types';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import CameraScanner from '../components/CameraScanner';
import { Badge, Button, Card, EmptyState, IconButton, Input, Modal, PlateBadge, Skeleton } from '../components/ui';
import { VehicleDetailsModal } from '../components/vehicles/VehicleModals';

function relativeSync(iso: string | null): string {
  if (!iso) return 'jamais';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return formatDate(iso, true);
}

/** Verdict immédiat pour une plaque saisie ou scannée. */
function Verdict({ term, results, loading, reliable, onOpen }: { term: string; results: StolenVehicle[]; loading: boolean; reliable: boolean; onOpen: (v: StolenVehicle) => void }) {
  const needle = compactPlate(term);
  if (needle.length < 4 || loading) return null;

  const exact = results.find((v) => compactPlate(v.plate_number) === needle || compactPlate(v.vin) === needle);

  if (exact) {
    return (
      <button
        type="button"
        onClick={() => onOpen(exact)}
        className="flex w-full animate-scale-in items-center gap-4 rounded-2xl bg-red-600 p-4 text-left text-white shadow-lg shadow-red-600/30"
      >
        <ShieldAlert className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold uppercase tracking-tight">Engin signalé volé</p>
          <p className="truncate text-sm text-red-100">
            {vehicleLabel(exact)} · {exact.commissariats?.nom ?? 'Registre national'}
          </p>
        </div>
        <span className="hidden shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 sm:block">Voir la fiche</span>
        <ChevronRight className="h-5 w-5 shrink-0 sm:hidden" />
      </button>
    );
  }

  if (results.length === 0 && reliable) {
    return (
      <div className="flex animate-scale-in items-center gap-4 rounded-2xl bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-600/20">
        <CheckCircle2 className="h-10 w-10 shrink-0" />
        <div>
          <p className="text-lg font-extrabold uppercase tracking-tight">Aucun signalement</p>
          <p className="text-sm text-emerald-50">Aucun avis de vol en cours pour « {term.toUpperCase()} ».</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function AgentTerrainDashboard() {
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<StolenVehicle | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [alerts, setAlerts] = useState<StolenVehicle[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  const onNewAlert = useCallback(
    (v: StolenVehicle) => {
      setAlerts((list) => [v, ...list].slice(0, 30));
      toast.warning(`Nouvelle alerte vol · ${v.plate_number ?? 'sans plaque'}`, `${vehicleLabel(v)} — ${v.commissariats?.code ?? 'NAT'}`);
      if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
    },
    [toast],
  );

  const { online, results, loading, syncing, lastSync, localCount, sync } = useStolenRegistry(term, onNewAlert);

  const handleSync = async () => {
    const count = await sync();
    if (count === null) toast.error('Synchronisation impossible', 'Vérifiez votre connexion.');
    else toast.success('Base locale à jour', `${count} engin${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''} hors-ligne.`);
  };

  const closeCamera = useCallback(() => setShowCamera(false), []);
  const handleScan = useCallback((plate: string) => {
    setShowCamera(false);
    setTerm(plate);
  }, []);

  return (
    <DashboardLayout
      title="Contrôle terrain"
      actions={
        <>
          <span
            className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex ${
              online ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
            }`}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {online ? 'En ligne' : 'Hors-ligne'}
          </span>
          <IconButton label="Alertes en direct" onClick={() => setShowAlerts(true)}>
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </IconButton>
        </>
      }
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Bandeau état réseau / base locale */}
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-xs ${
            online
              ? 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
          }`}
        >
          {online ? <Wifi className="h-4 w-4 text-emerald-500" /> : <CloudOff className="h-4 w-4" />}
          <span className="flex-1">
            {online ? 'Connecté au registre national.' : 'Mode hors-ligne : recherche dans la copie locale.'} Base locale :{' '}
            <strong>{localCount ?? '…'}</strong> engins, synchronisée {relativeSync(lastSync)}.
          </span>
          {online && (
            <Button size="sm" variant="ghost" onClick={handleSync} loading={syncing} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Synchroniser
            </Button>
          )}
        </div>

        {/* Recherche */}
        <Card className="p-3 sm:p-4">
          <div className="flex gap-2">
            <Input
              type="search"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Plaque, châssis, N° PV, nom…"
              leading={<Search className="h-5 w-5" />}
              trailing={
                term ? (
                  <button type="button" onClick={() => setTerm('')} className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Effacer">
                    <X className="h-4 w-4" />
                  </button>
                ) : null
              }
              className="h-12 font-mono text-base uppercase placeholder:font-sans placeholder:normal-case"
              containerClassName="flex-1"
              aria-label="Rechercher un engin"
            />
            <Button size="lg" onClick={() => setShowCamera(true)} icon={<Camera className="h-5 w-5" />} aria-label="Scanner une plaque">
              <span className="hidden sm:inline">Scanner</span>
            </Button>
          </div>
        </Card>

        <Verdict term={term} results={results} loading={loading} reliable={online || Boolean(localCount)} onOpen={setSelected} />

        {/* Liste */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{term ? 'Résultats' : 'Derniers engins signalés volés'}</h2>
            <Badge>{loading ? '…' : `${results.length}${results.length === 50 ? '+' : ''}`}</Badge>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title={term ? 'Aucun engin correspondant' : 'Aucun engin signalé'}
              description={!online && !localCount ? "La base locale est vide : connectez-vous une fois pour la synchroniser." : undefined}
            />
          ) : (
            <ul className="space-y-2">
              {results.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-red-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-500/40"
                  >
                    <PlateBadge plate={v.plate_number} tone="red" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{vehicleLabel(v)}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {[v.color, v.commissariats?.code, formatDate(v.stolen_date ?? v.created_at)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showCamera && <CameraScanner onScanComplete={handleScan} onClose={closeCamera} />}

      <VehicleDetailsModal vehicle={selected} onClose={() => setSelected(null)} />

      <Modal
        open={showAlerts}
        onClose={() => setShowAlerts(false)}
        sheetOnMobile
        icon={<Bell className="h-5 w-5 text-red-500" />}
        title="Alertes en direct"
        description="Engins signalés depuis l'ouverture de cette session."
        footer={
          alerts.length > 0 ? (
            <Button variant="outline" onClick={() => setAlerts([])}>
              Tout effacer
            </Button>
          ) : undefined
        }
      >
        {alerts.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="Aucune alerte" description="Les nouveaux signalements apparaîtront ici en temps réel." className="border-0 py-6" />
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={`${a.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAlerts(false);
                    setSelected(a);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-red-200 p-3 text-left hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                >
                  <PlateBadge plate={a.plate_number} tone="red" size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{vehicleLabel(a)}</span>
                  <Badge tone="brand">{a.commissariats?.code ?? 'NAT'}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </DashboardLayout>
  );
}
