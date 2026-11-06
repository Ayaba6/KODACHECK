import { escapeHtml as e, formatDate, vehicleLabel } from '../../lib/utils';
import type { StolenVehicle } from '../../types';

/**
 * Ouvre une fiche officielle imprimable pour un engin.
 * Toutes les valeurs sont échappées : les données peuvent provenir de saisies publiques.
 * Retourne false si le navigateur a bloqué la fenêtre.
 */
export function printVehicleReceipt(vehicle: StolenVehicle): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;

  const recovered = vehicle.status === 'RECOVERED';
  const declaringStation = vehicle.commissariats?.nom ?? vehicle.declaring_station ?? 'Non renseigné';
  const now = new Date();

  const field = (label: string, value: unknown, mono = false) => `
    <div>
      <div class="label">${e(label)}</div>
      <div class="value${mono ? ' mono' : ''}">${e(value || '—')}</div>
    </div>`;

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Fiche ${e(vehicle.plate_number || 'SANS PLAQUE')} — KODACHECK</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; line-height: 1.5; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0c1b33; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .brand span { color: #1d56d6; }
    .muted { color: #64748b; font-size: 12px; }
    h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .stolen { background: #fee2e2; color: #b91c1c; }
    .recovered { background: #d1fae5; color: #047857; }
    .plate { display: inline-block; margin: 18px 0 8px; padding: 6px 18px; border: 3px solid #0f172a; border-radius: 8px; font: 700 26px/1.2 'Consolas', monospace; letter-spacing: 3px; background: #fcd34d; }
    section { margin-top: 26px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
    .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .value { font-size: 14px; font-weight: 600; }
    .mono { font-family: 'Consolas', monospace; }
    .sign { margin-top: 56px; display: flex; justify-content: flex-end; }
    .sign div { width: 260px; border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; font-size: 12px; color: #475569; }
    footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">KODA<span>CHECK</span></div>
      <div class="muted">Registre national des engins</div>
    </div>
    <div style="text-align:right">
      <h1>Fiche d'enregistrement</h1>
      <span class="status ${recovered ? 'recovered' : 'stolen'}">${recovered ? 'Engin retrouvé' : 'Engin recherché (volé)'}</span>
    </div>
  </div>

  <div style="text-align:center">
    <div class="plate">${e(vehicle.plate_number || 'SANS PLAQUE')}</div>
    <div class="muted">N° PV : <strong>${e(vehicle.report_number || 'Non attribué')}</strong></div>
  </div>

  <section>
    <div class="section-title">Caractéristiques de l'engin</div>
    <div class="grid">
      ${field('Marque & modèle', vehicleLabel(vehicle))}
      ${field('Couleur', vehicle.color)}
      ${field('N° de châssis (VIN)', vehicle.vin, true)}
      ${field('Date du vol', formatDate(vehicle.stolen_date))}
    </div>
  </section>

  <section>
    <div class="section-title">Propriétaire & déclaration</div>
    <div class="grid">
      ${field('Propriétaire', vehicle.owner_name)}
      ${field('Téléphone', vehicle.owner_phone)}
      ${field('Service déclarant', declaringStation)}
      ${field('Enregistré le', formatDate(vehicle.created_at, true))}
    </div>
  </section>

  ${
    recovered
      ? `<section>
    <div class="section-title">Restitution</div>
    <div class="grid">
      ${field('Unité ayant retrouvé l\'engin', vehicle.recovering_station)}
      ${field('Date de récupération', formatDate(vehicle.recovered_date))}
    </div>
  </section>`
      : ''
  }

  <div class="sign"><div>Cachet et signature de l'autorité</div></div>

  <footer>
    <span>Édité le ${e(now.toLocaleDateString('fr-FR'))} à ${e(now.toLocaleTimeString('fr-FR'))}</span>
    <span>Réf. ${e(vehicle.id)}</span>
  </footer>
  <script>
    window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}
