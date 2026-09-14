import React, { useState, useEffect, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Exports depuis leurs fichiers respectifs
import { VehicleDetailsModal, StolenVehicle } from '../components/modals/VehicleDetailsModal';
import { RecoveryModal } from '../components/modals/RecoveryModal';

interface RegistrePageProps {
  isDarkMode?: boolean;
}

export const RegistrePage: React.FC<RegistrePageProps> = ({ isDarkMode = true }) => {
  const [activeTab, setActiveTab] = useState<'STOLEN' | 'RECOVERED'>('STOLEN');
  const [registrySearch, setRegistrySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<StolenVehicle[]>([]);

  // Gestion des modales
  const [selectedVehicleModal, setSelectedVehicleModal] = useState<StolenVehicle | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [vehicleToRecover, setVehicleToRecover] = useState<StolenVehicle | null>(null);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stolen_vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setVehicles(data as StolenVehicle[]);
    } catch (err) {
      console.error('Erreur lors du chargement du registre :', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleOpenRecoveryModal = (vehicle: StolenVehicle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVehicleToRecover(vehicle);
    setIsRecoveryModalOpen(true);
  };

  const handleConfirmRecovery = async (station: string) => {
    if (!vehicleToRecover) return;
    const recoveredDate = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('stolen_vehicles')
        .update({
          status: 'RECOVERED',
          recovering_station: station,
          recovered_date: recoveredDate,
        })
        .eq('id', vehicleToRecover.id);

      if (error) throw error;

      // Mise à jour de l'état local
      setVehicles((prev) =>
        prev.map((item) =>
          item.id === vehicleToRecover.id
            ? { ...item, status: 'RECOVERED', recovering_station: station, recovered_date: recoveredDate }
            : item
        )
      );

      if (selectedVehicleModal?.id === vehicleToRecover.id) {
        setSelectedVehicleModal((prev) =>
          prev ? { ...prev, status: 'RECOVERED', recovering_station: station, recovered_date: recoveredDate } : null
        );
      }

      setIsRecoveryModalOpen(false);
      setVehicleToRecover(null);
    } catch (err) {
      console.error('Erreur lors du changement de statut :', err);
      alert('Impossible de marquer l\'engin comme retrouvé.');
    }
  };

  // Impression structurée d'un récépissé officiel
  const handlePrintReceipt = (vehicle: StolenVehicle) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer le récépissé.");
      return;
    }

    const isRecovered = vehicle.status === 'RECOVERED';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Récépissé - ${vehicle.plate_number || 'SANS PLAQUE'}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; }
          .badge { display: inline-block; padding: 6px 16px; font-weight: bold; font-size: 14px; border-radius: 6px; margin-top: 15px; text-transform: uppercase; }
          .badge-stolen { background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
          .badge-recovered { background-color: #d1fae5; color: #059669; border: 1px solid #6ee7b7; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .field-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
          .field-value { font-size: 14px; font-weight: 600; color: #0f172a; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
          .signature-box { margin-top: 40px; text-align: right; padding-right: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Registre National des Engins</div>
          <div class="subtitle">Fiche Officielle d'Enregistrement et de Suivi</div>
          <div class="badge ${isRecovered ? 'badge-recovered' : 'badge-stolen'}">
            ${isRecovered ? 'Engin Retrouvé' : 'Engin Recherché (Volé)'}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Caractéristiques de l'Engin</div>
          <div class="grid">
            <div>
              <div class="field-label">Immatriculation / Plaque</div>
              <div class="field-value" style="font-family: monospace; font-size: 16px;">${vehicle.plate_number || 'SANS PLAQUE'}</div>
            </div>
            <div>
              <div class="field-label">Marque & Modèle</div>
              <div class="field-value">${vehicle.brand} ${vehicle.model}</div>
            </div>
            <div>
              <div class="field-label">Couleur</div>
              <div class="field-value">${vehicle.color || 'Non spécifiée'}</div>
            </div>
            <div>
              <div class="field-label">N° de Châssis (VIN)</div>
              <div class="field-value" style="font-family: monospace;">${vehicle.vin || 'Non renseigné'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Propriétaire & Déclaration</div>
          <div class="grid">
            <div>
              <div class="field-label">Nom & Prénom du Propriétaire</div>
              <div class="field-value">${vehicle.owner_name}</div>
            </div>
            <div>
              <div class="field-label">N° Procès-Verbal / Dossier</div>
              <div class="field-value" style="color: #2563eb;">${vehicle.report_number || 'Non renseigné'}</div>
            </div>
            <div>
              <div class="field-label">Date du Vol</div>
              <div class="field-value">${vehicle.stolen_date}</div>
            </div>
            <div>
              <div class="field-label">Commissariat Déclarant</div>
              <div class="field-value">${vehicle.declaring_station || 'Non renseigné'}</div>
            </div>
          </div>
        </div>

        ${isRecovered ? `
        <div class="section">
          <div class="section-title">Informations de Restitution / Restauration</div>
          <div class="grid">
            <div>
              <div class="field-label">Commissariat Retrouvé</div>
              <div class="field-value" style="color: #059669;">${vehicle.recovering_station || 'Non spécifié'}</div>
            </div>
            <div>
              <div class="field-label">Date de Récupération</div>
              <div class="field-value">${vehicle.recovered_date || 'Non renseignée'}</div>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="signature-box">
          <p>Cachet et Signature de l'Autorité</p>
          <br/><br/><br/>
        </div>

        <div class="footer">
          <span>Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</span>
          <span>ID Fiche : ${vehicle.id}</span>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesTab = v.status === activeTab;
      const search = registrySearch.toLowerCase().trim();
      
      if (!search) return matchesTab;

      const matchesSearch =
        v.plate_number?.toLowerCase().includes(search) ||
        v.owner_name?.toLowerCase().includes(search) ||
        v.report_number?.toLowerCase().includes(search) ||
        v.vin?.toLowerCase().includes(search) ||
        v.brand?.toLowerCase().includes(search) ||
        v.model?.toLowerCase().includes(search);

      return matchesTab && matchesSearch;
    });
  }, [vehicles, activeTab, registrySearch]);

  const countStolen = useMemo(() => vehicles.filter((v) => v.status === 'STOLEN').length, [vehicles]);
  const countRecovered = useMemo(() => vehicles.filter((v) => v.status === 'RECOVERED').length, [vehicles]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className={`p-6 rounded-2xl border shadow-lg ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* En-tête + Recherche */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-lg">Registre National des Engins</h2>
            <button
              onClick={fetchVehicles}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher (plaque, nom, PV...)"
              value={registrySearch}
              onChange={(e) => setRegistrySearch(e.target.value)}
              className={`pl-9 pr-4 py-2 rounded-xl border text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Filtrage par statut */}
        <div className={`flex gap-2 mb-6 p-1 rounded-xl border ${
          isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('STOLEN')}
            className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'STOLEN'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Recherchés ({countStolen})
          </button>

          <button
            onClick={() => setActiveTab('RECOVERED')}
            className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'RECOVERED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Retrouvés ({countRecovered})
          </button>
        </div>

        {/* Liste des résultats */}
        <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {loading ? 'Chargement des enregistrements...' : 'Aucun engin trouvé.'}
            </div>
          ) : (
            filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => {
                  setSelectedVehicleModal(vehicle);
                  setIsDetailModalOpen(true);
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDarkMode
                    ? 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs shrink-0 ${
                    vehicle.status === 'RECOVERED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {vehicle.plate_number || 'SANS PLAQUE'}
                  </div>

                  <div>
                    <h3 className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {vehicle.owner_name} • N° PV: {vehicle.report_number || 'N/C'}
                    </p>
                  </div>
                </div>

                {vehicle.status === 'STOLEN' && (
                  <button
                    onClick={(e) => handleOpenRecoveryModal(vehicle, e)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-semibold text-xs transition-colors shrink-0 self-start sm:self-auto"
                  >
                    Marquer Retrouvé
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Popups / Modales associées */}
      <RecoveryModal
        isOpen={isRecoveryModalOpen}
        vehicle={vehicleToRecover}
        isDarkMode={isDarkMode}
        onClose={() => setIsRecoveryModalOpen(false)}
        onConfirm={handleConfirmRecovery}
      />

      <VehicleDetailsModal
        vehicle={selectedVehicleModal}
        isOpen={isDetailModalOpen}
        isDarkMode={isDarkMode}
        onClose={() => setIsDetailModalOpen(false)}
        onPrint={handlePrintReceipt}
        onMarkAsRecovered={(v) => handleOpenRecoveryModal(v)}
      />
    </div>
  );
};