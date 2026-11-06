import { useEffect, useState, type FormEvent } from 'react';
import { Check, CheckCircle2, CreditCard, KeyRound, LocateFixed, MapPin, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, getErrorMessage, todayISO } from '../lib/utils';
import { BRAND_OPTIONS, COLOR_OPTIONS, VEHICLE_BRANDS } from '../lib/vehicleCatalog';
import type { Commissariat } from '../types';
import { normalizePlateInput } from '../utils/plateUtils';
import { Alert, Button, Card, Input, Select } from '../components/ui';

/**
 * Le paiement Mobile Money n'est pas encore branché sur un opérateur :
 * tant que ce drapeau est actif, l'étape de paiement est simulée et signalée comme telle.
 */
const PAYMENT_DEMO_MODE = true;
const FEE_LABEL = '2 000 FCFA';

type Step = 'form' | 'payment' | 'otp' | 'success';

const EMPTY_FORM = {
  plate_number: '',
  vin: '',
  brand: '',
  model: '',
  color: '',
  owner_name: '',
  owner_phone: '',
  commissariat_id: '',
  stolen_date: todayISO(),
};

type FormState = typeof EMPTY_FORM;
type Errors = Partial<Record<keyof FormState, string>>;

const PHONE_RE = /^(\+?226)?\s*\d{2}(\s?\d{2}){3}$/;

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'form', label: 'Déclaration' },
    { key: 'payment', label: 'Paiement' },
    { key: 'success', label: 'Confirmation' },
  ];
  const index = step === 'otp' ? 1 : steps.findIndex((s) => s.key === step);
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              i < index && 'bg-emerald-600 text-white',
              i === index && 'bg-brand-600 text-white',
              i > index && 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            {i < index ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn('hidden text-sm sm:block', i === index ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
        </li>
      ))}
    </ol>
  );
}

export default function PublicDeclarerPage({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [commissariats, setCommissariats] = useState<Pick<Commissariat, 'id' | 'nom' | 'code'>[]>([]);
  const [loadingCommissariats, setLoadingCommissariats] = useState(true);
  const [commissariatsError, setCommissariatsError] = useState(false);

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'denied' | 'unsupported'>('idle');

  const [paymentPhone, setPaymentPhone] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    loadCommissariats();
    locate();
  }, []);

  function loadCommissariats() {
    setLoadingCommissariats(true);
    setCommissariatsError(false);
    supabase
      .from('commissariats')
      .select('id, nom, code')
      .order('nom')
      .then(({ data, error }) => {
        setCommissariats(data ?? []);
        setCommissariatsError(Boolean(error));
        setLoadingCommissariats(false);
      });
  }

  function locate() {
    if (!navigator.geolocation) {
      setGpsState('unsupported');
      return;
    }
    setGpsState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsState('idle');
      },
      () => setGpsState('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  const update = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.plate_number.trim() && !form.vin.trim()) next.plate_number = 'Indiquez la plaque ou le numéro de châssis.';
    if (!form.brand) next.brand = 'Choisissez une marque.';
    if (!form.color) next.color = 'Choisissez une couleur.';
    if (form.owner_name.trim().length < 3) next.owner_name = 'Indiquez le nom et le prénom.';
    if (!PHONE_RE.test(form.owner_phone.trim())) next.owner_phone = 'Numéro invalide (ex : 70 00 00 00).';
    if (!form.commissariat_id) next.commissariat_id = 'Choisissez le commissariat le plus proche du lieu du vol.';
    if (!form.stolen_date || form.stolen_date > todayISO()) next.stolen_date = 'Date invalide.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleForm = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setPaymentPhone((p) => p || form.owner_phone);
      setStep('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Amène l'utilisateur sur le premier champ en erreur
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    }
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!PHONE_RE.test(paymentPhone.trim())) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000)); // Simulation de l'appel opérateur
    setLoading(false);
    setStep('otp');
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(otp)) return;
    setLoading(true);
    setSubmitError(null);

    const { error } = await supabase.from('stolen_vehicles').insert([
      {
        plate_number: normalizePlateInput(form.plate_number) || null,
        vin: form.vin.trim().toUpperCase() || null,
        brand: form.brand,
        model: form.model.trim() || null,
        color: form.color,
        owner_name: form.owner_name.trim(),
        owner_phone: form.owner_phone.trim(),
        commissariat_id: form.commissariat_id,
        stolen_date: form.stolen_date,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        status: 'STOLEN',
      },
    ]);
    setLoading(false);

    if (error) {
      setSubmitError(getErrorMessage(error, "L'enregistrement a échoué. Réessayez dans quelques instants."));
      return;
    }
    setStep('success');
  };

  const shareOnWhatsApp = () => {
    const comm = commissariats.find((c) => c.id === form.commissariat_id);
    const lines = [
      '🚨 *AVIS DE VOL — KODACHECK*',
      '',
      `• *Plaque / châssis :* ${form.plate_number || form.vin}`,
      `• *Engin :* ${[form.brand, form.model].filter(Boolean).join(' ')} (${form.color})`,
      `• *Contact :* ${form.owner_name} — ${form.owner_phone}`,
      `• *Commissariat :* ${comm ? `${comm.nom} (${comm.code})` : '—'}`,
      `• *Date du vol :* ${new Date(`${form.stolen_date}T00:00:00`).toLocaleDateString('fr-FR')}`,
      coords ? `• *Position :* https://www.google.com/maps?q=${coords.lat},${coords.lng}` : '',
      '',
      'Si vous voyez cet engin, contactez le commissariat le plus proche.',
    ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  };

  const models = VEHICLE_BRANDS[form.brand] ?? [];

  return (
    <Card className="p-5 sm:p-8">
      <Stepper step={step} />

      {step === 'form' && (
        <form onSubmit={handleForm} className="space-y-6" noValidate>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Déclarer un engin volé</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Les champs marqués d'un * sont obligatoires.</p>
          </div>

          {commissariatsError && (
            <Alert
              variant="error"
              title="Service momentanément injoignable"
              action={
                <Button size="sm" variant="outline" onClick={loadCommissariats}>
                  Réessayer
                </Button>
              }
            >
              Impossible de charger la liste des commissariats. Vérifiez votre connexion internet.
            </Alert>
          )}

          <div
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm',
              coords
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400',
            )}
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              {coords
                ? `Position enregistrée (précision ± ${Math.round(coords.accuracy)} m)`
                : gpsState === 'locating'
                  ? 'Recherche de votre position…'
                  : gpsState === 'denied'
                    ? 'Position non autorisée — facultatif, mais utile aux recherches.'
                    : 'Position indisponible sur cet appareil.'}
            </span>
            {gpsState !== 'unsupported' && (
              <Button size="sm" variant="ghost" onClick={locate} loading={gpsState === 'locating'} icon={<LocateFixed className="h-4 w-4" />}>
                {coords ? 'Actualiser' : 'Localiser'}
              </Button>
            )}
          </div>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">L'engin</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Plaque d'immatriculation" value={form.plate_number} onChange={(e) => update('plate_number', e.target.value.toUpperCase())} placeholder="0029 D1 08" className="font-mono uppercase" error={errors.plate_number} />
              <Input label="N° de châssis (VIN)" value={form.vin} onChange={(e) => update('vin', e.target.value.toUpperCase())} placeholder="Facultatif si plaque connue" className="font-mono uppercase" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Marque" required value={form.brand} onChange={(e) => update('brand', e.target.value)} error={errors.brand}>
                <option value="">Choisir…</option>
                {BRAND_OPTIONS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
              <Input label="Modèle" value={form.model} onChange={(e) => update('model', e.target.value)} list="public-models" placeholder={models[0] ?? 'Facultatif'} />
              <datalist id="public-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Select label="Couleur" required value={form.color} onChange={(e) => update('color', e.target.value)} error={errors.color}>
                <option value="">Choisir…</option>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Le vol</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Commissariat compétent" required value={form.commissariat_id} onChange={(e) => update('commissariat_id', e.target.value)} error={errors.commissariat_id} disabled={loadingCommissariats}>
                <option value="">{loadingCommissariats ? 'Chargement…' : 'Choisir…'}</option>
                {commissariats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </Select>
              <Input label="Date du vol" type="date" required max={todayISO()} value={form.stolen_date} onChange={(e) => update('stolen_date', e.target.value)} error={errors.stolen_date} />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Le propriétaire</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nom et prénom" required autoComplete="name" value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} error={errors.owner_name} />
              <Input label="Téléphone" required type="tel" autoComplete="tel" inputMode="tel" value={form.owner_phone} onChange={(e) => update('owner_phone', e.target.value)} placeholder="70 00 00 00" error={errors.owner_phone} />
            </div>
          </fieldset>

          <Button type="submit" size="lg" fullWidth icon={<CreditCard className="h-4 w-4" />}>
            Continuer vers le paiement ({FEE_LABEL})
          </Button>
        </form>
      )}

      {step === 'payment' && (
        <form onSubmit={handleRequestOtp} className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Frais de traitement</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {FEE_LABEL} par Mobile Money. Un code de confirmation vous sera envoyé par SMS.
            </p>
          </div>
          {PAYMENT_DEMO_MODE && (
            <Alert variant="warning" title="Mode démonstration">
              Le paiement n'est pas encore relié à un opérateur : aucun montant ne sera prélevé.
            </Alert>
          )}
          <Input
            label="Numéro Mobile Money"
            required
            type="tel"
            inputMode="tel"
            value={paymentPhone}
            onChange={(e) => setPaymentPhone(e.target.value)}
            placeholder="70 00 00 00"
            className="font-mono"
            error={paymentPhone && !PHONE_RE.test(paymentPhone.trim()) ? 'Numéro invalide.' : undefined}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setStep('form')} className="sm:w-1/3">
              Retour
            </Button>
            <Button type="submit" variant="success" loading={loading} disabled={!PHONE_RE.test(paymentPhone.trim())} className="sm:flex-1">
              Recevoir le code
            </Button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleConfirm} className="space-y-5">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <KeyRound className="h-6 w-6" />
            </span>
            <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Code de confirmation</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Saisissez le code reçu au <span className="font-mono font-semibold">{paymentPhone}</span>.
              {PAYMENT_DEMO_MODE && ' (Démonstration : n\'importe quel code de 4 chiffres.)'}
            </p>
          </div>
          {submitError && <Alert variant="error">{submitError}</Alert>}
          <Input
            aria-label="Code de confirmation"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            autoFocus
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setStep('payment')} disabled={loading} className="sm:w-1/3">
              Modifier le numéro
            </Button>
            <Button type="submit" variant="success" loading={loading} disabled={!/^\d{4,6}$/.test(otp)} className="sm:flex-1">
              Confirmer et payer {FEE_LABEL}
            </Button>
          </div>
        </form>
      )}

      {step === 'success' && (
        <div className="space-y-5 py-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Déclaration enregistrée</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Votre signalement est désormais visible par les patrouilles et le commissariat choisi. Présentez-vous au
              commissariat pour finaliser votre plainte.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="success" onClick={shareOnWhatsApp} icon={<Share2 className="h-4 w-4" />}>
              Partager l'avis sur WhatsApp
            </Button>
            <Button variant="outline" onClick={onDone}>
              Terminer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
