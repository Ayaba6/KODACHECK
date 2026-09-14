import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import { StolenVehicle } from './VehicleDetailsModal';

interface RecoveryModalProps {
  isOpen: boolean;
  vehicle: StolenVehicle | null;
  isDarkMode?: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (recoveringStation: string) => void | Promise<void>;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  vehicle,
  isDarkMode = true,
  isSubmitting = false,
  onClose,
  onConfirm,
}) => {
  const [station, setStation] = useState('Commissariat Central');

  // Réinitialisation de l'unité par défaut lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      setStation('Commissariat Central');
    }
  }, [isOpen, vehicle]);

  // Fermeture via touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!station.trim() || isSubmitting) return;
    await onConfirm(station.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden transition-all ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* En-tête */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-base">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Confirmation d'Engin Retrouvé</span>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className={`p-1 rounded-lg transition-colors disabled:opacity-50 ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps du formulaire */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Vous allez marquer l'engin{' '}
            <strong className={isDarkMode ? 'text-slate-100' : 'text-slate-900'}>
              {vehicle.brand} {vehicle.model}
            </strong>{' '}
            (<span className="font-mono">{vehicle.plate_number || 'Sans plaque'}</span>) comme retrouvé.
          </p>

          <div>
            <label className={`text-xs font-semibold mb-1 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Commissariat / Unité de Récupération
            </label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="Ex: Commissariat Central"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                isDarkMode 
                  ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' 
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
                isDarkMode 
                  ? 'border-slate-800 hover:bg-slate-800 text-slate-300' 
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !station.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>Confirmer</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};