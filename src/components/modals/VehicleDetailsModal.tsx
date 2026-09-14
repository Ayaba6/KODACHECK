import React, { useEffect } from 'react';
import { 
  X, Tag, User, Building2, Shield, CheckCircle, 
  AlertCircle, Printer 
} from 'lucide-react';

export interface StolenVehicle {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  color?: string;
  vin?: string;
  owner_name: string;
  report_number: string;
  stolen_date: string;
  declaring_station?: string;
  recovering_station?: string;
  recovered_date?: string;
  status: 'STOLEN' | 'RECOVERED';
  created_at?: string;
}

interface VehicleDetailsModalProps {
  vehicle: StolenVehicle | null;
  isOpen: boolean;
  isDarkMode?: boolean;
  onClose: () => void;
  onPrint: (vehicle: StolenVehicle) => void;
  onMarkAsRecovered: (vehicle: StolenVehicle, e?: React.MouseEvent) => void;
}

export const VehicleDetailsModal: React.FC<VehicleDetailsModalProps> = ({
  vehicle,
  isOpen,
  isDarkMode = true,
  onClose,
  onPrint,
  onMarkAsRecovered,
}) => {
  // Gestion de la fermeture via la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !vehicle) return null;

  const isRecovered = vehicle.status === 'RECOVERED';

  // Fonction de secours : si declaring_station est vide, on l'extrait du numéro de PV
  const getDeclaringStation = () => {
    if (vehicle.declaring_station && vehicle.declaring_station.trim() !== '') {
      return vehicle.declaring_station;
    }
    
    if (vehicle.report_number) {
      // Exemple de format de PV : PV-CMP-OUA-02-... -> Extrait la portion d'unité
      const parts = vehicle.report_number.split('-');
      if (parts.length >= 3) {
        return `Unité (${parts.slice(1, -2).join('-')})`;
      }
    }
    
    return 'Non renseigné';
  };

  const stationName = getDeclaringStation();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-vehicle-title"
    >
      <div className={`w-full max-w-xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* En-tête de la Modal */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isRecovered 
            ? isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200' 
            : isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white ${
              isRecovered ? 'bg-emerald-500' : 'bg-red-500'
            }`}>
              {isRecovered ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <h3 id="modal-vehicle-title" className="font-mono font-extrabold text-xl sm:text-2xl tracking-wide">
                {vehicle.plate_number || 'SANS PLAQUE'}
              </h3>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isRecovered 
                  ? isDarkMode ? 'text-emerald-400' : 'text-emerald-700' 
                  : isDarkMode ? 'text-red-400' : 'text-red-700'
              }`}>
                {isRecovered ? 'Engin Retrouvé' : 'Engin Recherché (Volé)'}
              </span>
            </div>
          </div>

          <button 
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu principal */}
        <div className="p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          
          {/* Caractéristiques véhicule */}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Tag className="w-4 h-4 text-blue-500" /> Caractéristiques de l'engin
            </h4>
            <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Marque & Modèle</span>
                <span className="font-semibold text-sm">{vehicle.brand} {vehicle.model}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Couleur</span>
                <span className="font-semibold text-sm">{vehicle.color || 'Non spécifiée'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-slate-400 block mb-0.5">Numéro de Châssis (VIN)</span>
                <span className="font-mono font-bold text-sm tracking-wide">{vehicle.vin || 'Non renseigné'}</span>
              </div>
            </div>
          </div>

          {/* Propriétaire & Déclaration */}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <User className="w-4 h-4 text-blue-500" /> Propriétaire & Signalement
            </h4>
            <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="col-span-2">
                <span className="text-xs text-slate-400 block mb-0.5">Nom & Prénom du Propriétaire</span>
                <span className="font-bold text-base">{vehicle.owner_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">N° de PV / Dossier</span>
                <span className="font-mono font-bold text-sm text-blue-500">{vehicle.report_number}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Date du Vol</span>
                <span className="font-mono text-sm">{vehicle.stolen_date}</span>
              </div>
            </div>
          </div>

          {/* Suivi Administratif */}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Building2 className="w-4 h-4 text-blue-500" /> Suivi Administratif et Services
            </h4>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`pb-3 sm:pb-0 sm:pr-3 border-b sm:border-b-0 sm:border-r ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <span className="text-xs text-slate-400 block mb-1">Commissariat Déclarant</span>
                <p className={`font-semibold text-sm flex items-center gap-1.5 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  <Shield className="w-4 h-4 shrink-0" />
                  {stationName}
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-1">Commissariat Retrouvé</span>
                {isRecovered ? (
                  <div>
                    <p className={`font-semibold text-sm flex items-center gap-1.5 ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      {vehicle.recovering_station || 'Service non spécifié'}
                    </p>
                    {vehicle.recovered_date && (
                      <span className="text-[11px] text-slate-400 block font-mono mt-1">
                        Retrouvé le : {vehicle.recovered_date}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs italic text-slate-500">En cours de recherche...</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            onClick={() => onPrint(vehicle)}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimer Récépissé
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {!isRecovered && (
              <button
                onClick={(e) => onMarkAsRecovered(vehicle, e)}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Marquer Retrouvé
              </button>
            )}

            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors ${
                isDarkMode 
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
             }`}
            >
              Fermer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};