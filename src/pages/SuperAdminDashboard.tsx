import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Building2, ChevronRight, MapPin, PlusCircle, RefreshCw, Search, UserCheck, UserPlus, Users, Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createAccount } from '../lib/accounts';
import { getErrorMessage, ROLE_LABELS } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import type { Commissariat } from '../types';
import { DashboardLayout, PageHeader } from '../components/layout/DashboardLayout';
import { AccountCreatedModal, type CreatedAccount } from '../components/AccountCreatedModal';
import { generateTempPassword } from '../lib/utils';
import { Alert, Button, Card, CardHeader, EmptyState, IconButton, Input, Modal, Select, Skeleton, StatCard } from '../components/ui';
import { RecoveryJournal } from '../components/RecoveryJournal';

const EMPTY_COMM = { code: '', nom: '', ville: '', region: '' };

function CommissariatForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_COMM);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const code = form.code.trim().toUpperCase();
    const { error } = await supabase.from('commissariats').insert([
      { code, nom: form.nom.trim(), ville: form.ville.trim(), region: form.region.trim() || null },
    ]);
    setLoading(false);
    if (error) {
      toast.error('Création impossible', error.code === '23505' ? `Le code ${code} existe déjà.` : getErrorMessage(error));
      return;
    }
    toast.success('Commissariat créé', `${form.nom.trim()} (${code})`);
    setForm(EMPTY_COMM);
    onCreated();
  };

  return (
    <Card>
      <CardHeader icon={<Building2 className="h-5 w-5" />} title="Nouveau commissariat" />
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <Input
          label="Code"
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="CMP-OUA-01"
          className="font-mono uppercase"
          hint="Utilisé dans la numérotation des PV."
        />
        <Input label="Nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Commissariat central de Ouagadougou" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ville" required value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Ouagadougou" />
          <Input label="Région" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Centre" />
        </div>
        <Button type="submit" fullWidth loading={loading} icon={<PlusCircle className="h-4 w-4" />}>
          Enregistrer le commissariat
        </Button>
      </form>
    </Card>
  );
}

function CommissaireForm({ commissariats, onCreated }: { commissariats: Commissariat[]; onCreated: (a: CreatedAccount) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', commissariat_id: '', password: generateTempPassword(), contact_email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createAccount({
        full_name: form.full_name.trim(),
        role: 'commissaire',
        commissariat_id: form.commissariat_id,
        password: form.password,
        contact_email: form.contact_email.trim() || undefined,
      });
      onCreated({ full_name: form.full_name.trim(), badge_number: result.badge_number, password: form.password, roleLabel: ROLE_LABELS.commissaire });
      setForm({ full_name: '', commissariat_id: '', password: generateTempPassword(), contact_email: '' });
    } catch (err) {
      toast.error('Création impossible', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<UserPlus className="h-5 w-5" />} title="Nouveau commissaire" description="Chef de poste d'un commissariat." />
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <Input label="Nom complet" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Commissaire TRAORÉ Youssouf" />
        <Select label="Commissariat" required value={form.commissariat_id} onChange={(e) => setForm({ ...form, commissariat_id: e.target.value })}>
          <option value="">Sélectionner…</option>
          {commissariats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.nom}
            </option>
          ))}
        </Select>
        <Input
          label="Mot de passe temporaire"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="font-mono"
          trailing={
            <IconButton label="Générer un mot de passe" className="h-8 w-8 border-0 bg-transparent dark:bg-transparent" onClick={() => setForm({ ...form, password: generateTempPassword() })}>
              <Wand2 className="h-4 w-4" />
            </IconButton>
          }
        />
        <Input label="Email de contact" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="Facultatif" />
        <Button
          type="submit"
          fullWidth
          loading={loading}
          disabled={!form.commissariat_id || form.full_name.trim().length < 3 || form.password.length < 8}
          icon={<UserPlus className="h-4 w-4" />}
        >
          Créer le compte commissaire
        </Button>
      </form>
    </Card>
  );
}

function EditCommissariatModal({ commissariat, onClose, onSaved }: { commissariat: Commissariat | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_COMM);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<{ staff: number; commissaire: string | null } | null>(null);

  useEffect(() => {
    if (!commissariat) return;
    setForm({ code: commissariat.code, nom: commissariat.nom, ville: commissariat.ville ?? '', region: commissariat.region ?? '' });
    setDetails(null);
    let cancelled = false;
    void Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('commissariat_id', commissariat.id),
      supabase.from('profiles').select('full_name').eq('commissariat_id', commissariat.id).in('role', ['commissaire', 'COMMISSAIRE']).limit(1).maybeSingle(),
    ]).then(([staff, chief]) => {
      if (!cancelled) setDetails({ staff: staff.count ?? 0, commissaire: chief.data?.full_name ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [commissariat]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!commissariat) return;
    setSaving(true);
    const { error } = await supabase
      .from('commissariats')
      .update({ code: form.code.trim().toUpperCase(), nom: form.nom.trim(), ville: form.ville.trim(), region: form.region.trim() || null })
      .eq('id', commissariat.id);
    setSaving(false);
    if (error) {
      toast.error('Mise à jour impossible', getErrorMessage(error));
      return;
    }
    toast.success('Commissariat mis à jour');
    onSaved();
  };

  return (
    <Modal open={Boolean(commissariat)} onClose={onClose} locked={saving} title="Modifier le commissariat" description={commissariat?.nom}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <UserCheck className="h-3.5 w-3.5" /> Commissaire
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{details ? details.commissaire ?? 'Non attribué' : '…'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Users className="h-3.5 w-3.5" /> Effectif total
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{details ? `${details.staff} personne(s)` : '…'}</p>
          </div>
        </div>
        <Input label="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="font-mono uppercase" />
        <Input label="Nom" required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ville" required value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
          <Input label="Région" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
        {form.code.trim().toUpperCase() !== commissariat?.code && (
          <Alert variant="warning">Changer le code n'affecte pas les numéros de PV déjà attribués.</Alert>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SuperAdminDashboard() {
  const [commissariats, setCommissariats] = useState<Commissariat[]>([]);
  const [stats, setStats] = useState({ users: 0, stolen: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Commissariat | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [comms, users, stolen] = await Promise.all([
      supabase.from('commissariats').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('stolen_vehicles').select('id', { count: 'exact', head: true }).eq('status', 'STOLEN'),
    ]);
    if (comms.error) setError(getErrorMessage(comms.error));
    setCommissariats((comms.data ?? []) as Commissariat[]);
    setStats({ users: users.count ?? 0, stolen: stolen.count ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return commissariats;
    return commissariats.filter((c) => [c.code, c.nom, c.ville, c.region].some((f) => f?.toLowerCase().includes(term)));
  }, [commissariats, search]);

  return (
    <DashboardLayout title="Administration">
      <PageHeader
        title="Administration nationale"
        description="Commissariats, comptes commissaires et vue d'ensemble du réseau."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}>
            Actualiser
          </Button>
        }
      />

      {error && (
        <Alert variant="error" title="Chargement impossible" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Commissariats" value={loading ? '…' : commissariats.length} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Comptes utilisateurs" value={loading ? '…' : stats.users} icon={<Users className="h-5 w-5" />} tone="slate" />
        <StatCard label="Engins recherchés" value={loading ? '…' : stats.stolen} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CommissariatForm onCreated={load} />
        <CommissaireForm commissariats={commissariats} onCreated={setCreated} />
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={<Building2 className="h-5 w-5" />}
          title="Commissariats déployés"
          description={`${commissariats.length} unité${commissariats.length > 1 ? 's' : ''}`}
          actions={
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              leading={<Search className="h-4 w-4" />}
              containerClassName="w-full sm:w-64"
              aria-label="Rechercher un commissariat"
            />
          }
        />
        <div className="p-5">
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Building2 className="h-5 w-5" />} title={search ? 'Aucun résultat' : 'Aucun commissariat'} description={search ? undefined : 'Créez la première unité avec le formulaire ci-dessus.'} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-brand-500/40 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{c.code}</p>
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.nom}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {[c.ville, c.region].filter(Boolean).join(', ') || '—'}
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
        <RecoveryJournal description="Toutes les restitutions du réseau national." />
      </div>

      <EditCommissariatModal
        commissariat={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />
      <AccountCreatedModal account={created} onClose={() => setCreated(null)} />
    </DashboardLayout>
  );
}
