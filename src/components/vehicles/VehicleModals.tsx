import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Building2, CheckCircle2, MapPin, Phone, Printer, Tag, User } from 'lucide-react';
import { formatDate, vehicleLabel } from '../../lib/utils';
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
              {vehicle.report_number ?? <span className="font-sans text-slate-500">Signalement citoyen</span>}
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

interface RecoveryModalProps {
  vehicle: StolenVehicle | null;
  defaultStation?: string;
  onClose: () => void;
  onConfirm: (station: string) => Promise<void>;
}

/** Confirmation de restitution d'un engin. */
export function RecoveryModal({ vehicle, defaultStation = '', onClose, onConfirm }: RecoveryModalProps) {
  const [station, setStation] = useState(defaultStation);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (vehicle) setStation(defaultStation);
  }, [vehicle, defaultStation]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!station.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(station.trim());
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
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      title="Confirmer la restitution"
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
          autoFocus
          value={station}
          onChange={(e) => setStation(e.target.value)}
          placeholder="Ex : Commissariat central de Ouagadougou"
          disabled={submitting}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          L'engin sera retiré de la liste des engins recherchés sur tous les terminaux.
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
