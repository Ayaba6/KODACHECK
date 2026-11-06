import { useCallback, useEffect, useState } from 'react';
import { Calendar, ChevronRight, FilePlus2, FileText, Globe, MapPin, Phone, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, getErrorMessage, vehicleLabel } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { StolenVehicle } from '../types';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { DeclarerPage } from '../components/DeclarerPage';
import { RegistrePage } from '../components/RegistrePage';
import { VehicleSearch } from '../components/VehicleSearch';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PlateBadge, Skeleton, Tabs } from '../components/ui';
import { VehicleDetailsModal } from '../components/vehicles/VehicleModals';
import { printVehicleReceipt } from '../components/vehicles/printReceipt';

type Tab = 'registre' | 'declarer' | 'citoyens';

/** Signalements soumis en ligne par les citoyens (sans numéro de PV attribué). */
function CitizenReports() {
  const toast = useToast();
  const [reports, setReports] = useState<StolenVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StolenVehicle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('stolen_vehicles')
      .select('*, commissariats:commissariat_id (nom, code)')
      .eq('source', 'citoyen')
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError(getErrorMessage(err));
    else setReports((data ?? []) as StolenVehicle[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <VehicleSearch onSelect={setSelected} />
      </div>

      <Card className="lg:col-span-3">
        <CardHeader
          icon={<Globe className="h-5 w-5" />}
          title="Signalements citoyens"
          description="Déclarations en ligne en attente de traitement par un commissariat."
          actions={
            <Button variant="outline" size="sm" onClick={load} disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}>
              Actualiser
            </Button>
          }
        />
        <div className="p-5">
          {error ? (
            <Alert variant="error" title="Chargement impossible">
              {error}
            </Alert>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState icon={<Globe className="h-5 w-5" />} title="Aucun signalement citoyen" description="Les déclarations faites depuis l'espace citoyen apparaîtront ici." />
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-brand-500/40 dark:hover:bg-slate-800/40"
                  >
                    <PlateBadge plate={r.plate_number} size="sm" tone="amber" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{vehicleLabel(r)}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate">{r.owner_name}</span>
                        {r.owner_phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {r.owner_phone}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(r.created_at)}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {r.commissariats?.code && <Badge tone="brand">{r.commissariats.code}</Badge>}
                        {r.latitude != null && (
                          <Badge tone="emerald" icon={<MapPin className="h-3 w-3" />}>
                            GPS
                          </Badge>
                        )}
                        {r.status === 'RECOVERED' && <Badge tone="emerald">Retrouvé</Badge>}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <VehicleDetailsModal
        vehicle={selected}
        onClose={() => setSelected(null)}
        onPrint={(v) => {
          if (!printVehicleReceipt(v)) toast.warning('Impression bloquée', 'Autorisez les fenêtres surgissantes.');
        }}
      />
    </div>
  );
}

export default function AgentBureauDashboard() {
  const [tab, setTab] = useState<Tab>('registre');

  return (
    <DashboardLayout
      title="Espace agent de bureau"
      nav={
        <Tabs
          ariaLabel="Navigation"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'registre', label: 'Registre', icon: <FileText className="h-4 w-4" /> },
            { value: 'declarer', label: 'Saisir un PV', icon: <FilePlus2 className="h-4 w-4" /> },
            { value: 'citoyens', label: 'Vérification & citoyens', icon: <Search className="h-4 w-4" /> },
          ]}
        />
      }
    >
      {tab === 'registre' && <RegistrePage />}
      {tab === 'declarer' && <DeclarerPage onSuccess={() => setTab('registre')} />}
      {tab === 'citoyens' && <CitizenReports />}
    </DashboardLayout>
  );
}
