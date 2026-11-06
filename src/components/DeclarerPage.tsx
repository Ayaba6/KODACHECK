import { useState, type FormEvent } from 'react';
import { FilePlus2, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getErrorMessage, todayISO } from '../lib/utils';
import { BRAND_OPTIONS, COLOR_OPTIONS, VEHICLE_BRANDS } from '../lib/vehicleCatalog';
import { normalizePlateInput } from '../utils/plateUtils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Alert, Button, Card, CardHeader, Input, Select } from './ui';

const EMPTY_FORM = {
  plate_number: '',
  brand: '',
  model: '',
  color: '',
  vin: '',
  owner_name: '',
  stolen_date: todayISO(),
};

/** Saisie d'un procès-verbal de vol par un agent de bureau (numéro de PV généré côté serveur). */
export function DeclarerPage({ onSuccess }: { onSuccess?: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({});

  const commissariat = profile?.commissariats;
  const update = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  if (!profile?.commissariat_id || !commissariat) {
    return (
      <Alert variant="error" title="Aucun commissariat de rattachement">
        Chaque procès-verbal doit être lié à un commissariat. Votre compte n'en a pas : contactez votre commissaire ou
        l'administrateur.
      </Alert>
    );
  }

  const validate = () => {
    const next: typeof errors = {};
    if (!form.plate_number.trim() && !form.vin.trim()) next.plate_number = 'Indiquez la plaque ou le numéro de châssis.';
    if (!form.brand) next.brand = 'Choisissez une marque.';
    if (!form.owner_name.trim()) next.owner_name = 'Le nom du propriétaire est obligatoire.';
    if (form.stolen_date > todayISO()) next.stolen_date = 'La date du vol ne peut pas être dans le futur.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const { error } = await supabase.rpc('create_stolen_vehicle_with_pv', {
      p_plate_number: normalizePlateInput(form.plate_number),
      p_brand: form.brand,
      p_model: form.model.trim(),
      p_color: form.color,
      p_vin: form.vin.trim().toUpperCase(),
      p_owner_name: form.owner_name.trim(),
      p_stolen_date: form.stolen_date,
      p_commissariat_id: profile.commissariat_id,
    });
    setLoading(false);

    if (error) {
      toast.error("Le PV n'a pas pu être enregistré", getErrorMessage(error));
      return;
    }

    toast.success('Procès-verbal enregistré', `Le signalement est diffusé sur tous les terminaux de terrain.`);
    setForm({ ...EMPTY_FORM, stolen_date: todayISO() });
    onSuccess?.();
  };

  const modelSuggestions = VEHICLE_BRANDS[form.brand] ?? [];

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader
        icon={<FilePlus2 className="h-5 w-5" />}
        title="Nouveau procès-verbal de vol"
        description={
          <>
            Unité émettrice : <strong className="text-slate-700 dark:text-slate-200">{commissariat.nom}</strong>{' '}
            <span className="font-mono text-brand-600 dark:text-brand-400">({commissariat.code})</span>
          </>
        }
      />
      <form onSubmit={handleSubmit} className="space-y-6 p-5" noValidate>
        <fieldset className="space-y-4">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Engin</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Plaque d'immatriculation"
              value={form.plate_number}
              onChange={(e) => update('plate_number', e.target.value.toUpperCase())}
              placeholder="0029 D1 08"
              hint="Format : n° d'ordre, catégorie, région (ex : 0029 D1 08)."
              className="font-mono uppercase"
              error={errors.plate_number}
              autoFocus
            />
            <Input
              label="N° de châssis (VIN)"
              value={form.vin}
              onChange={(e) => update('vin', e.target.value.toUpperCase())}
              placeholder="Numéro de série"
              className="font-mono uppercase"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Marque" required value={form.brand} onChange={(e) => update('brand', e.target.value)} error={errors.brand}>
              <option value="">Choisir…</option>
              {BRAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <Input
              label="Modèle"
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              list="bureau-model-suggestions"
              placeholder={modelSuggestions[0] ?? 'Modèle'}
            />
            <datalist id="bureau-model-suggestions">
              {modelSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <Select label="Couleur" value={form.color} onChange={(e) => update('color', e.target.value)}>
              <option value="">Non précisée</option>
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Déclaration</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nom du propriétaire"
              required
              value={form.owner_name}
              onChange={(e) => update('owner_name', e.target.value)}
              placeholder="Nom et prénom"
              error={errors.owner_name}
            />
            <Input
              label="Date du vol"
              type="date"
              required
              max={todayISO()}
              value={form.stolen_date}
              onChange={(e) => update('stolen_date', e.target.value)}
              error={errors.stolen_date}
            />
          </div>
        </fieldset>

        <Alert variant="info">
          Le numéro de PV est attribué automatiquement au format{' '}
          <span className="font-mono font-semibold">PV-{commissariat.code}-AAAAMM-XXXX</span>.
        </Alert>

        <div className="flex justify-end">
          <Button type="submit" variant="danger" size="lg" loading={loading} icon={<ShieldAlert className="h-4 w-4" />} className="w-full sm:w-auto">
            Enregistrer le signalement
          </Button>
        </div>
      </form>
    </Card>
  );
}
