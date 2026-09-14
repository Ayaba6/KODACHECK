import React, { useState, useEffect } from 'react';
import { PlusCircle, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Dictionnaire des marques et modèles d'engins
const MARQUES_ET_MODELES: Record<string, string[]> = {
  Yamaha: ['Crypton', 'Sirius', 'Force X', 'DT', 'FJR', 'Autre'],
  Honda: ['CG', 'CB', 'XR', 'Wave', 'Dio', 'Autre'],
  Kaizer: ['K125', 'K150', 'Super', 'Autre'],
  Rato: ['RT125', 'RT150', 'Autre'],
  Aloba: ['100', '125', 'Autre'],
  Kavaki: ['125', '150', 'Autre'],
  Sanili: ['110', '125', 'Autre'],
  Nouveau_Nom: ['Standard', 'Autre'],
  Autre: ['Générique', 'Non précisé']
};

interface DeclarerPageProps {
  isDarkMode?: boolean;
  onSuccess?: () => void;
}

export const DeclarerPage: React.FC<DeclarerPageProps> = ({ isDarkMode = true, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  
  const [agentData, setAgentData] = useState<{
    commissariat_id: string | null;
    commissariat_nom: string;
    commissariat_code: string;
  }>({
    commissariat_id: null,
    commissariat_nom: '',
    commissariat_code: '',
  });

  const [formData, setFormData] = useState({
    plate_number: '',
    brand: 'Yamaha',
    model: 'Crypton',
    color: '',
    vin: '',
    owner_name: '',
    stolen_date: new Date().toISOString().split('T')[0],
  });

  // Récupération automatique du profil, du nom et du code du commissariat
  useEffect(() => {
    async function fetchAgentCommissariat() {
      try {
        setFetchingProfile(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setAgentData({ commissariat_id: null, commissariat_nom: 'Non authentifié', commissariat_code: 'ERR' });
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            commissariat_id,
            commissariats (
              nom,
              code
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const commissariatInfo = (profile?.commissariats as any);

        setAgentData({
          commissariat_id: profile?.commissariat_id || null,
          commissariat_nom: commissariatInfo?.nom || '',
          commissariat_code: commissariatInfo?.code || 'COMM',
        });
      } catch (err) {
        console.error('Erreur lors de la récupération du profil agent :', err);
        setAgentData({ commissariat_id: null, commissariat_nom: '', commissariat_code: 'ERR' });
      } finally {
        setFetchingProfile(false);
      }
    }

    fetchAgentCommissariat();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentData.commissariat_id) {
      alert("Erreur critique : Impossible d'enregistrer. Votre compte n'est rattaché à aucun commissariat.");
      return;
    }

    if (!formData.plate_number.trim() || !formData.owner_name.trim()) {
      alert("Veuillez remplir au moins la plaque d'immatriculation et le nom du propriétaire.");
      return;
    }

    setLoading(true);

    try {
      // Appel de la procédure stockée Supabase qui génère automatiquement le PV codifié et l'incrémente
      const { error } = await supabase.rpc('create_stolen_vehicle_with_pv', {
        p_plate_number: formData.plate_number.trim().toUpperCase(),
        p_brand: formData.brand,
        p_model: formData.model,
        p_color: formData.color.trim(),
        p_vin: formData.vin.trim().toUpperCase(),
        p_owner_name: formData.owner_name.trim(),
        p_stolen_date: formData.stolen_date,
        p_commissariat_id: agentData.commissariat_id
      });
      
      if (error) throw error;

      alert(`Signalement enregistré avec succès par l'unité ${agentData.commissariat_nom} (${agentData.commissariat_code}). Le numéro de PV a été généré et incrémenté automatiquement.`);

      // Réinitialisation du formulaire
      setFormData({
        plate_number: '',
        brand: 'Yamaha',
        model: 'Crypton',
        color: '',
        vin: '',
        owner_name: '',
        stolen_date: new Date().toISOString().split('T')[0],
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Erreur d\'enregistrement :', err);
      alert(`Erreur lors de l'enregistrement du PV: ${err.message || 'Erreur réseau'}`);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProfile) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!agentData.commissariat_id) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="font-bold text-lg">Action requise : Commissariat non assigné</h3>
        <p className="text-xs leading-relaxed text-red-300">
          Votre compte agent n'est rattaché à aucune unité de police. Pour des raisons de traçabilité, chaque déclaration doit obligatoirement être liée à un commissariat. Veuillez contacter votre Super Administrateur.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className={`p-6 rounded-2xl border shadow-lg ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* En-tête */}
        <div className="flex items-center gap-2 mb-6 border-b pb-4 border-slate-800">
          <PlusCircle className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-bold text-lg">Nouveau Signalement de Vol</h2>
            <p className="text-xs text-emerald-400 font-medium">
              Unité émettrice : {agentData.commissariat_nom} <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">[{agentData.commissariat_code}]</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Plaque d'immatriculation */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Immatriculation / Plaque *</label>
            <input
              type="text"
              required
              placeholder="Ex: 11-JJ-4500 ou BF-0001"
              value={formData.plate_number}
              onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
              className={`w-full px-3 py-2 rounded-lg border font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Marque et Modèle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Marque</label>
              <select
                value={formData.brand}
                onChange={(e) => {
                  const brand = e.target.value;
                  const defaultModel = MARQUES_ET_MODELES[brand]?.[0] || 'Autre';
                  setFormData({ ...formData, brand, model: defaultModel });
                }}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {Object.keys(MARQUES_ET_MODELES).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Modèle</label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {(MARQUES_ET_MODELES[formData.brand] || ['Autre']).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Couleur et Date du Vol */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Couleur</label>
              <input
                type="text"
                placeholder="Ex: Rouge, Noir"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Date du Vol</label>
              <input
                type="date"
                value={formData.stolen_date}
                onChange={(e) => setFormData({ ...formData, stolen_date: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* N° de Châssis (VIN) */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Numéro de Châssis (VIN)</label>
            <input
              type="text"
              placeholder="N° de série du châssis"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
              className={`w-full px-3 py-2 rounded-lg border font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Nom du Propriétaire */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Nom du Propriétaire *</label>
            <input
              type="text"
              required
              placeholder="Nom & Prénom"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Service Déclarant (Fixé automatiquement) */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Codification Automatique du PV</label>
            <input
              type="text"
              disabled
              value={`Format généré : PV-${agentData.commissariat_code}-AAAAMM-XXXX`}
              className={`w-full px-3 py-2 rounded-lg border text-sm font-bold opacity-90 cursor-not-allowed ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-100 border-slate-300 text-emerald-700'
              }`}
            />
          </div>

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enregistrement en cours...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>Enregistrer le Signalement ({agentData.commissariat_code})</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};