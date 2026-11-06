import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, LocateFixed, Lock, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, getErrorMessage, todayISO } from '../lib/utils';
import { BRAND_OPTIONS, COLOR_OPTIONS, VEHICLE_BRANDS } from '../lib/vehicleCatalog';
import type { Commissariat } from '../types';
import { normalizePlateInput } from '../utils/plateUtils';
import { initPayment, saveSummary } from '../lib/citizenDeclaration';
import { Alert, Button, Card, Input, Select } from '../components/ui';
import { DeclarationStepper } from '../components/DeclarationStepper';

/** Montant affiché ; le montant facturé est fixé côté serveur (secret DECLARATION_FEE). */
const FEE_LABEL = '2 000 FCFA';

type Step = 'form' | 'payment';

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

export default function PublicDeclarerPage() {
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
  const [email, setEmail] = useState('');

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

  /** Crée la déclaration (en attente) et ouvre la page de paiement sécurisée CinetPay. */
  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (paymentPhone && !PHONE_RE.test(paymentPhone.trim())) return;
    setLoading(true);
    setSubmitError(null);

    try {
      const plate = normalizePlateInput(form.plate_number);
      const result = await initPayment({
        plate_number: plate,
        vin: form.vin.trim().toUpperCase(),
        brand: form.brand,
        model: form.model.trim(),
        color: form.color,
        owner_name: form.owner_name.trim(),
        owner_phone: form.owner_phone.trim(),
        payer_phone: (paymentPhone || form.owner_phone).trim(),
        email: email.trim(),
        commissariat_id: form.commissariat_id,
        stolen_date: form.stolen_date,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });

      const comm = commissariats.find((c) => c.id === form.commissariat_id);
      saveSummary(result.ref, {
        plate: plate || form.vin.trim().toUpperCase(),
        vehicle: `${[form.brand, form.model.trim()].filter(Boolean).join(' ')} (${form.color})`,
        owner: form.owner_name.trim(),
        phone: form.owner_phone.trim(),
        commissariat: comm ? `${comm.nom} (${comm.code})` : '—',
        stolenDate: form.stolen_date,
        coords: coords ? { lat: coords.lat, lng: coords.lng } : null,
        reportNumber: result.report_number,
      });

      // Page de paiement CinetPay (Orange Money, Moov Money) ; retour automatique sur KodaCheck
      window.location.assign(result.payment_url);
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Le paiement n’a pas pu être lancé. Réessayez.'));
      setLoading(false);
    }
  };

  const models = VEHICLE_BRANDS[form.brand] ?? [];

  return (
    <Card className="p-5 sm:p-8">
      <DeclarationStepper index={step === 'form' ? 0 : 1} />

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
        <form onSubmit={handlePay} className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Frais de traitement : {FEE_LABEL}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Vous allez être redirigé vers la page de paiement sécurisée <strong>CinetPay</strong> pour payer par
              Orange Money ou Moov Money. Votre déclaration sera transmise aux forces de l'ordre dès le paiement confirmé.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/50">
            <p className="font-semibold text-slate-900 dark:text-white">{normalizePlateInput(form.plate_number) || form.vin.toUpperCase()}</p>
            <p className="text-slate-600 dark:text-slate-400">
              {[form.brand, form.model].filter(Boolean).join(' ')} · {form.color} · volé le{' '}
              {new Date(`${form.stolen_date}T00:00:00`).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {submitError && <Alert variant="error">{submitError}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Numéro Mobile Money"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={paymentPhone}
              onChange={(e) => setPaymentPhone(e.target.value)}
              placeholder="70 00 00 00"
              className="font-mono"
              hint="Pré-rempli sur la page de paiement."
              error={paymentPhone && !PHONE_RE.test(paymentPhone.trim()) ? 'Numéro invalide.' : undefined}
            />
            <Input
              label="Email (facultatif)"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Pour recevoir le reçu"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setStep('form')} disabled={loading} className="sm:w-1/3">
              Modifier
            </Button>
            <Button
              type="submit"
              variant="success"
              size="lg"
              loading={loading}
              disabled={Boolean(paymentPhone) && !PHONE_RE.test(paymentPhone.trim())}
              icon={<Lock className="h-4 w-4" />}
              className="sm:flex-1"
            >
              {loading ? 'Ouverture du paiement…' : `Payer ${FEE_LABEL}`}
            </Button>
          </div>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Paiement traité par CinetPay. KodaCheck ne voit jamais votre code secret Mobile Money.
          </p>
        </form>
      )}
    </Card>
  );
}
