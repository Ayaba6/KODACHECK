import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, AlertTriangle, CheckCircle, LogOut, Car, ShieldAlert } from 'lucide-react';

export default function AgentDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setSearched(true);
    setResult(null);

    const cleanTerm = searchTerm.trim().toUpperCase();

    // Recherche par plaque OU par VIN
    const { data, error } = await supabase
      .from('stolen_vehicles')
      .select('*')
      .or(`plate_number.ilike.${cleanTerm},vin.ilike.${cleanTerm}`)
      .eq('status', 'STOLEN')
      .maybeSingle();

    if (!error && data) {
      setResult(data);
    }

    setLoading(false);
  };

  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Barre supérieure */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Car className="w-6 h-6 text-blue-500" />
          <span className="font-bold text-lg">Contrôle Agent</span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col justify-center">
        
        {/* Formulaire de recherche */}
        <form onSubmit={handleSearch} className="mb-6">
          <label className="block text-sm font-medium mb-2 text-slate-300">
            Plaque d'immatriculation ou N° Châssis (VIN)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: 11-JJ-4567 ou VF3..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-white font-mono text-lg placeholder-slate-600 focus:outline-none focus:border-blue-500 uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Vérifier'}
            </button>
          </div>
        </form>

        {/* Résultat de la recherche */}
        {searched && !loading && (
          <div>
            {result ? (
              /* ALERTE ROUGE : ENGattributes / VEHICULE VOLÉ */
              <div className="bg-red-950/40 border-2 border-red-600 rounded-2xl p-6 shadow-red-950/50 shadow-2xl animate-pulse">
                <div className="flex items-center gap-3 text-red-500 mb-4">
                  <ShieldAlert className="w-10 h-10 shrink-0" />
                  <div>
                    <h2 className="text-xl font-extrabold uppercase tracking-wide">Signalé Volé !</h2>
                    <p className="text-xs text-red-400">Interception recommandée</p>
                  </div>
                </div>

                <div className="space-y-3 bg-red-900/20 p-4 rounded-xl border border-red-800/40 font-mono text-sm">
                  <div>
                    <span className="text-red-400 text-xs uppercase block">Immatriculation</span>
                    <span className="text-lg font-bold text-white">{result.plate_number}</span>
                  </div>
                  {result.vin && (
                    <div>
                      <span className="text-red-400 text-xs uppercase block">Numéro Châssis (VIN)</span>
                      <span className="text-white">{result.vin}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-red-800/40">
                    <div>
                      <span className="text-red-400 text-xs block">Marque / Modèle</span>
                      <span className="text-white">{result.brand} {result.model}</span>
                    </div>
                    <div>
                      <span className="text-red-400 text-xs block">Couleur</span>
                      <span className="text-white">{result.color || 'Non spécifiée'}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-red-800/40">
                    <span className="text-red-400 text-xs block">N° de Déclaration / PV</span>
                    <span className="text-white font-bold">{result.report_number}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* VERT : ENGattributes EN RÈGLE */
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-emerald-400">Aucun signalement de vol</h2>
                <p className="text-slate-400 text-sm mt-1">L'immatriculation ou le châssis recherché ne figure pas au fichier des véhicules volés.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}