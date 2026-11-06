import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Building2, CheckCircle2, MapPin, Phone, Printer, Tag, User } from 'lucide-react';
import { formatDate, vehicleLabel } from '../../lib/utils';
import { describePlate } from '../../utils/plateUtils';
import type { StolenVehicle } from '../../types';
import { Badge, Button, Input, Modal, PlateBadge } from '../ui';

export function VehicleStatusBadge({ status }: { status: StolenVehicle['status'] }) {
  return status === 'RECOVERED' ? (
    <Badge tone="emerald" icon={<CheckCircle2 className="h-3 w-3" />}>
      Retrouvé
    </Badge>
  ) : (
    <Badge tone="red" icon={<AlertTriangle className="h-3 w-3" />}>
      Volé
    </Badge>
  );
}

function InfoRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-medium text-slate-900 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>
        {children || '—'}
      </dd>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
        {children}
      </dl>
    </section>
  );
}

interface VehicleDetailsModalProps {
  vehicle: StolenVehicle | null;
  onClose: () => void;
  onPrint?: (vehicle: StolenVehicle) => void;
  onMarkRecovered?: (vehicle: StolenVehicle) => void;
}

/** Fiche complète d'un engin (registre, résultats de recherche, alertes). */
export function VehicleDetailsModal({ vehicle, onClose, onPrint, onMarkRecovered }: VehicleDetailsModalProps) {
  const recovered = vehicle?.status === 'RECOVERED';
  const plateInfo = describePlate(vehicle?.plate_number);

  return (
    <Modal
      open={Boolean(vehicle)}
      onClose={onClose}
      size="lg"
      sheetOnMobile
      title={vehicle ? <PlateBadge plate={vehicle.plate_number} tone={recovered ? 'emerald' : 'red'} size="md" /> : ''}
      description={
        vehicle && (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <VehicleStatusBadge status={vehicle.status} />
            <span>{vehicleLabel(vehicle)}</span>
          </span>
        )
      }
      footer={
        vehicle && (
          <>
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {onPrint && (
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => onPrint(vehicle)}>
                Imprimer la fiche
              </Button>
            )}
            {onMarkRecovered && !recovered && (
              <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => onMarkRecovered(vehicle)}>
                Marquer retrouvé
              </Button>
            )}
          </>
        )
      }
    >
      {vehicle && (
        <div className="space-y-5">
          <Section icon={<Tag className="h-4 w-4 text-brand-500" />} title="Engin">
            <InfoRow label="Marque & modèle">{vehicleLabel(vehicle)}</InfoRow>
            <InfoRow label="Couleur">{vehicle.color}</InfoRow>
            {plateInfo && (
              <>
                <InfoRow label="Catégorie de plaque">{plateInfo.category}</InfoRow>
                <InfoRow label="Région d'immatriculation">{plateInfo.region}</InfoRow>
              </>
            )}
            <div className="col-span-2">
              <InfoRow label="N° de châssis (VIN)" mono>
                {vehicle.vin}
              </InfoRow>
            </div>
          </Section>

          <Section icon={<User className="h-4 w-4 text-brand-500" />} title="Propriétaire & signalement">
            <InfoRow label="Propriétaire">{vehicle.owner_name}</InfoRow>
            <InfoRow label="Téléphone">
              {vehicle.owner_phone ? (
                <a href={`tel:${vehicle.owner_phone}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
                  <Phone className="h-3.5 w-3.5" />
                  {vehicle.owner_phone}
                </a>
              ) : null}
            </InfoRow>
            <InfoRow label="N° de PV" mono>
              {vehicle.report_number ?? '—'}
              {vehicle.source === 'citoyen' && <span className="ml-2 font-sans text-xs font-normal text-amber-600 dark:text-amber-400">déclaration citoyenne</span>}
            </InfoRow>
            <InfoRow label="Date du vol">{formatDate(vehicle.stolen_date)}</InfoRow>
            {vehicle.latitude != null && vehicle.longitude != null && (
              <div className="col-span-2">
                <InfoRow label="Lieu signalé">
                  <a
                    href={`https://www.google.com/maps?q=${vehicle.latitude},${vehicle.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Voir sur la carte ({vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)})
                  </a>
                </InfoRow>
              </div>
            )}
          </Section>

          <Section icon={<Building2 className="h-4 w-4 text-brand-500" />} title="Suivi">
            <InfoRow label="Service déclarant">
              {vehicle.commissariats?.nom ?? vehicle.declaring_station}
            </InfoRow>
            <InfoRow label="Enregistré le">{formatDate(vehicle.created_at, true)}</InfoRow>
            {recovered && (
              <>
                <InfoRow label="Retrouvé par">{vehicle.recovering_station}</InfoRow>
                <InfoRow label="Retrouvé le">{formatDate(vehicle.recovered_date)}</InfoRow>
              </>
            )}
          </Section>
        </div>
      )}
    </Modal>
  );
}

export interface RecoveryDetails {
  station: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
}

interface RecoveryModalProps {
  vehicle: StolenVehicle | null;
  defaultStation?: string;
  onClose: () => void;
  onConfirm: (details: RecoveryDetails) => Promise<void>;
}

/** Déclaration d'un engin retrouvé : unité, note et position (inscrites au journal des restitutions). */
export function RecoveryModal({ vehicle, defaultStation = '', onClose, onConfirm }: RecoveryModalProps) {
  const [station, setStation] = useState(defaultStation);
  const [note, setNote] = useState('');
  const [shareLocation, setShareLocation] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    setStation(defaultStation);
    setNote('');
    setCoords(null);
    // Position du lieu où l'engin est retrouvé (facultative, utile pour les enquêteurs)
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [vehicle, defaultStation]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!station.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm({
        station: station.trim(),
        note: note.trim(),
        latitude: shareLocation ? coords?.lat ?? null : null,
        longitude: shareLocation ? coords?.lng ?? null : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(vehicle)}
      onClose={onClose}
      locked={submitting}
      size="sm"
      sheetOnMobile
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      title="Déclarer l'engin retrouvé"
      description={
        vehicle && (
          <>
            {vehicleLabel(vehicle)} · <span className="font-mono">{vehicle.plate_number || 'Sans plaque'}</span>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Unité ayant retrouvé l'engin"
          required
          value={station}
          onChange={(e) => setStation(e.target.value)}
          placeholder="Ex : Commissariat central de Ouagadougou"
          disabled={submitting}
        />
        <div className="space-y-1.5">
          <label htmlFor="recovery-note" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Circonstances <span className="font-normal text-slate-400">(facultatif)</span>
          </label>
          <textarea
            id="recovery-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            placeholder="Ex : intercepté au contrôle de Tampouy, conducteur retenu"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => setShareLocation(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              <MapPin className="h-4 w-4 text-brand-500" /> Joindre ma position
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {locating ? 'Localisation en cours…' : coords ? `Position relevée (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : 'Position indisponible sur cet appareil.'}
            </span>
          </span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          L'engin sera retiré des engins recherchés sur tous les terminaux. La restitution est inscrite au journal à votre nom.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" variant="success" loading={submitting} disabled={!station.trim()}>
            Confirmer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
