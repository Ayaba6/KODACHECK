import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  Radio,
  RefreshCw,
  Ban,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createAccount } from '../lib/accounts';
import { formatDate, getErrorMessage, normalizeRole, ROLE_LABELS, vehicleLabel } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Profile, StolenVehicle } from '../types';
import { DashboardLayout, PageHeader } from '../components/layout/DashboardLayout';
import { AccountCreatedModal, type CreatedAccount } from '../components/AccountCreatedModal';
import { generateTempPassword } from '../lib/utils';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  PlateBadge,
  Select,
  Skeleton,
  StatCard,
  Tabs,
} from '../components/ui';
import { VehicleDetailsModal } from '../components/vehicles/VehicleModals';
import { RecoveryJournal } from '../components/RecoveryJournal';
import { printVehicleReceipt } from '../components/vehicles/printReceipt';

const AGENT_ROLES = ['agent_terrain', 'agent_bureau', 'AGENT_TERRAIN', 'AGENT_BUREAU', 'AGENT'];

function RoleBadge({ role }: { role: string | null }) {
  const r = normalizeRole(role);
  return r === 'agent_terrain' ? (
    <Badge tone="amber" icon={<Radio className="h-3 w-3" />}>
      Terrain
    </Badge>
  ) : (
    <Badge tone="brand" icon={<BadgeCheck className="h-3 w-3" />}>
      Bureau
    </Badge>
  );
}

function CreateAgentForm({ onCreated }: { onCreated: (account: CreatedAccount) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', role: 'agent_terrain' as 'agent_terrain' | 'agent_bureau', password: generateTempPassword(), contact_email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createAccount({
        full_name: form.full_name.trim(),
        role: form.role,
        password: form.password,
        contact_email: form.contact_email.trim() || undefined,
      });
      onCreated({ full_name: form.full_name.trim(), badge_number: result.badge_number, password: form.password, roleLabel: ROLE_LABELS[form.role] });
      setForm({ full_name: '', role: form.role, password: generateTempPassword(), contact_email: '' });
    } catch (err) {
      toast.error('Création impossible', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<UserPlus className="h-5 w-5" />} title="Nouvel agent" description="Un matricule unique sera généré automatiquement." />
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <Input label="Nom complet" required minLength={3} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex : OUÉDRAOGO Awa" />
        <Select label="Fonction" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
          <option value="agent_terrain">Agent de terrain (contrôle, patrouille)</option>
          <option value="agent_bureau">Agent de bureau (saisie, registre)</option>
        </Select>
        <Input
          label="Mot de passe temporaire"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="font-mono"
          hint="8 caractères minimum. À transmettre à l'agent."
          trailing={
            <IconButton label="Générer un mot de passe" className="h-8 w-8 border-0 bg-transparent dark:bg-transparent" onClick={() => setForm({ ...form, password: generateTempPassword() })}>
              <Wand2 className="h-4 w-4" />
            </IconButton>
          }
        />
        <Input label="Email de contact" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="Facultatif" />
        <Button type="submit" fullWidth loading={loading} disabled={form.full_name.trim().length < 3 || form.password.length < 8} icon={<UserPlus className="h-4 w-4" />}>
          Créer le compte
        </Button>
      </form>
    </Card>
  );
}

export default function CommissaireDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const commissariatId = profile?.commissariat_id ?? null;

  const [agents, setAgents] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<StolenVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'STOLEN' | 'RECOVERED'>('STOLEN');
  const [selected, setSelected] = useState<StolenVehicle | null>(null);
  const [toRemove, setToRemove] = useState<Profile | null>(null);
  const [toToggle, setToToggle] = useState<Profile | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  const load = useCallback(async () => {
    if (!commissariatId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [agentsRes, vehiclesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('commissariat_id', commissariatId).in('role', AGENT_ROLES).order('created_at', { ascending: false }),
      supabase
        .from('stolen_vehicles')
        .select('*, commissariats:commissariat_id (nom, code)')
        .eq('commissariat_id', commissariatId)
        .order('created_at', { ascending: false }),
    ]);
    if (agentsRes.error || vehiclesRes.error) {
      setError(getErrorMessage(agentsRes.error ?? vehiclesRes.error));
    }
    setAgents((agentsRes.data ?? []) as Profile[]);
    setVehicles((vehiclesRes.data ?? []) as StolenVehicle[]);
    setLoading(false);
  }, [commissariatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = async () => {
    if (!toRemove) return;
    const { error: err } = await supabase.rpc('remove_agent_from_commissariat', { p_agent_id: toRemove.id });
    if (err) {
      toast.error("Impossible de retirer l'agent", getErrorMessage(err));
      return;
    }
    setAgents((list) => list.filter((a) => a.id !== toRemove.id));
    toast.success('Agent retiré', `${toRemove.full_name ?? 'L\'agent'} n'est plus rattaché à votre commissariat et son compte est désactivé.`);
    setToRemove(null);
  };

  /** Désactive (accès coupé immédiatement) ou réactive un agent. */
  const handleToggleActive = async () => {
    if (!toToggle) return;
    const nextActive = toToggle.active === false;
    const { error: err } = await supabase.rpc('set_account_active', { p_user_id: toToggle.id, p_active: nextActive });
    if (err) {
      toast.error(nextActive ? 'Réactivation impossible' : 'Désactivation impossible', getErrorMessage(err));
      return;
    }
    setAgents((list) => list.map((a) => (a.id === toToggle.id ? { ...a, active: nextActive } : a)));
    toast.success(
      nextActive ? 'Compte réactivé' : 'Compte désactivé',
      nextActive
        ? `${toToggle.full_name ?? "L'agent"} peut de nouveau utiliser KodaCheck.`
        : `${toToggle.full_name ?? "L'agent"} n'a plus accès à KodaCheck, avec effet immédiat.`,
    );
    setToToggle(null);
  };

  const activeAgents = agents.filter((a) => a.active !== false).length;

  const stolen = useMemo(() => vehicles.filter((v) => v.status !== 'RECOVERED'), [vehicles]);
  const recovered = useMemo(() => vehicles.filter((v) => v.status === 'RECOVERED'), [vehicles]);
  const list = tab === 'STOLEN' ? stolen : recovered;

  if (!commissariatId) {
    return (
      <DashboardLayout title="Espace commissaire">
        <Alert variant="error" title="Aucun commissariat attribué">
          Votre compte commissaire n'est rattaché à aucun commissariat. Contactez l'administrateur.
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Espace commissaire">
      <PageHeader
        title={profile?.commissariats?.nom ?? 'Mon commissariat'}
        description="Gestion des effectifs et suivi des signalements de votre unité."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}>
            Actualiser
          </Button>
        }
      />

      {error && (
        <Alert variant="error" title="Certaines données n'ont pas pu être chargées" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Agents actifs" value={loading ? "…" : activeAgents} hint={!loading && agents.length > activeAgents ? `${agents.length - activeAgents} désactivé(s)` : undefined} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label="Engins recherchés" value={loading ? '…' : stolen.length} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        <StatCard label="Engins retrouvés" value={loading ? '…' : recovered.length} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CreateAgentForm
            onCreated={(account) => {
              setCreated(account);
              void load();
            }}
          />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader icon={<Users className="h-5 w-5" />} title="Effectifs" description={`${agents.length} agent${agents.length > 1 ? 's' : ''} rattaché${agents.length > 1 ? 's' : ''}`} />
          <div className="p-5">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="Aucun agent" description="Créez le premier compte agent avec le formulaire." />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {agents.map((agent) => {
                  const inactive = agent.active === false;
                  return (
                    <li key={agent.id} className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${inactive ? 'opacity-60' : ''}`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {(agent.full_name ?? '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{agent.full_name ?? 'Agent'}</p>
                        <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{agent.badge_number ?? agent.email}</p>
                      </div>
                      {inactive ? (
                        <Badge tone="neutral" icon={<Ban className="h-3 w-3" />}>
                          Désactivé
                        </Badge>
                      ) : (
                        <RoleBadge role={agent.role} />
                      )}
                      <IconButton
                        label={inactive ? `Réactiver ${agent.full_name ?? 'cet agent'}` : `Désactiver ${agent.full_name ?? 'cet agent'}`}
                        onClick={() => setToToggle(agent)}
                      >
                        {inactive ? <UserCheck className="h-4 w-4 text-emerald-600" /> : <Ban className="h-4 w-4" />}
                      </IconButton>
                      <IconButton label={`Retirer ${agent.full_name ?? 'cet agent'}`} tone="danger" onClick={() => setToRemove(agent)}>
                        <UserMinus className="h-4 w-4" />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={<FileText className="h-5 w-5" />}
          title="Signalements du commissariat"
          actions={
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'STOLEN', label: 'Recherchés', count: stolen.length },
                { value: 'RECOVERED', label: 'Retrouvés', count: recovered.length },
              ]}
            />
          }
        />
        <div className="p-5">
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={tab === 'STOLEN' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              title={tab === 'STOLEN' ? 'Aucun engin recherché' : 'Aucun engin retrouvé'}
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-brand-500/40 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <PlateBadge plate={v.plate_number} size="sm" tone={v.status === 'RECOVERED' ? 'emerald' : 'red'} />
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{vehicleLabel(v)}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {v.report_number ?? 'Signalement citoyen'} · {formatDate(v.status === 'RECOVERED' ? v.recovered_date : v.stolen_date ?? v.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="mt-6">
        <RecoveryJournal description="Engins retrouvés par vos agents, ou déclarés par votre commissariat et retrouvés ailleurs." />
      </div>

      <VehicleDetailsModal
        vehicle={selected}
        onClose={() => setSelected(null)}
        onPrint={(v) => {
          if (!printVehicleReceipt(v)) toast.warning('Impression bloquée', 'Autorisez les fenêtres surgissantes.');
        }}
      />
      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Retirer cet agent ?"
        description={
          <>
            Le compte de <strong>{toRemove?.full_name}</strong> sera détaché de votre commissariat et désactivé.
            Il disparaîtra de votre liste ; seul l'administrateur pourra le réaffecter.
          </>
        }
        confirmLabel="Retirer"
        tone="danger"
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
      />
      <ConfirmDialog
        open={Boolean(toToggle)}
        title={toToggle?.active === false ? 'Réactiver ce compte ?' : 'Désactiver ce compte ?'}
        description={
          toToggle?.active === false ? (
            <>
              <strong>{toToggle?.full_name}</strong> pourra de nouveau se connecter et consulter le registre.
            </>
          ) : (
            <>
              Accès de <strong>{toToggle?.full_name}</strong> coupé immédiatement, y compris en cours de session.
              Vous pourrez le réactiver à tout moment.
            </>
          )
        }
        confirmLabel={toToggle?.active === false ? 'Réactiver' : 'Désactiver'}
        tone={toToggle?.active === false ? 'primary' : 'danger'}
        onConfirm={handleToggleActive}
        onClose={() => setToToggle(null)}
      />
      <AccountCreatedModal account={created} onClose={() => setCreated(null)} />
    </DashboardLayout>
  );
}
