import React, { useState, useEffect } from 'react';
import { PlusCircle, FileText, Shield, LogOut, Moon, Sun, Building2, User, Globe, MapPin, Phone, CheckCircle2, Calendar, Search, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DeclarerPage } from '../components/DeclarerPage';
import { RegistrePage } from '../components/RegistrePage';

interface AgentBureauDashboardProps {
  onLogout?: () => void;
}

interface UserProfile {
  full_name: string;
  role: string;
  commissariats?: {
    nom: string;
    code: string;
  };
}

export const AgentBureauDashboard: React.FC<AgentBureauDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'registre' | 'declarer' | 'public-declarations'>('registre');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicDeclarations, setPublicDeclarations] = useState<any[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  // États pour la recherche publique intégrée
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any[] | null>(null);

  useEffect(() => {
    fetchAgentProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'public-declarations') {
      fetchPublicDeclarations();
    }
  }, [activeTab]);

  const fetchAgentProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, commissariats(nom, code)')
        .eq('id', user.id)
        .single();

      if (data) setProfile(data as unknown as UserProfile);
    } catch (err) {
      console.error('Erreur chargement profil agent :', err);
    }
  };

  const fetchPublicDeclarations = async () => {
    setLoadingPublic(true);
    try {
      const { data, error } = await supabase
        .from('stolen_vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPublicDeclarations(data || []);
    } catch (err) {
      console.error("Erreur chargement déclarations publiques :", err);
    } finally {
      setLoadingPublic(false);
    }
  };

  const handleSearchVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResult(null);

    try {
      const queryVal = searchQuery.trim().toUpperCase();
      const { data, error } = await supabase
        .from('stolen_vehicles')
        .select('*')
        .or(`plate_number.ilike.%${queryVal}%,vin.ilike.%${queryVal}%`);

      if (error) throw error;
      setSearchResult(data || []);
    } catch (err) {
      console.error("Erreur lors de la recherche :", err);
      setSearchResult([]);
    } finally {
      setSearching(false);
    }
  };

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Barre de Navigation Supérieure Ultra-Responsive Mobile */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center justify-between gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl shrink-0">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-bold text-sm md:text-base tracking-tight leading-tight">Interface Bureau</h1>
                  {profile?.commissariats && (
                    <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-md border border-blue-500/20 shrink-0">
                      {profile.commissariats.code}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 truncate w-full">
                  <User className="w-3 h-3 inline shrink-0" /> 
                  <span className="truncate">{profile?.full_name || 'Agent de Bureau'}</span>
                  {profile?.commissariats?.nom && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                      <Building2 className="w-3 h-3 inline shrink-0" /> 
                      <span className="truncate">{profile.commissariats.nom}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Boutons Actions Rapides Mobile */}
            <div className="flex items-center gap-1.5 md:hidden shrink-0">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-xl border transition-colors ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' 
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
                title="Changer le thème"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation par Onglets (Scrollable horizontalement sur mobile) */}
          <nav className={`flex items-center gap-1 p-1 rounded-xl border w-full md:w-auto overflow-x-auto scrollbar-none ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('registre')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-h-[36px] ${
                activeTab === 'registre'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Registre</span>
            </button>

            <button
              onClick={() => setActiveTab('declarer')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-h-[36px] ${
                activeTab === 'declarer'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Saisir PV</span>
            </button>

            <button
              onClick={() => setActiveTab('public-declarations')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-h-[36px] ${
                activeTab === 'public-declarations'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Recherche Publique</span>
            </button>
          </nav>

          {/* Boutons Actions Desktop */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' 
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Changer le thème"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Contenu Principal avec Padding adaptatif mobile */}
      <main className="py-4 sm:py-6 max-w-7xl mx-auto px-3 sm:px-6">
        {activeTab === 'registre' && (
          <RegistrePage isDarkMode={isDarkMode} />
        )}
        {activeTab === 'declarer' && (
          <DeclarerPage 
            isDarkMode={isDarkMode} 
            onSuccess={() => setActiveTab('registre')} 
          />
        )}
        {activeTab === 'public-declarations' && (
          <div className="space-y-6">
            
            {/* Bloc de Recherche Publique Intégré */}
            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-400 shrink-0" />
                  <span>Vérification Rapide d'un Engin</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Recherchez instantanément par plaque ou numéro de châssis (VIN).</p>
              </div>

              {/* Formulaire empilé sur mobile pour éviter la compression */}
              <form onSubmit={handleSearchVehicle} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="N° de plaque ou châssis (VIN)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono uppercase text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 text-xs shrink-0"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Rechercher</span>
                </button>
              </form>

              {searchResult !== null && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                  {searchResult.length === 0 ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <h3 className="font-bold text-emerald-400 text-xs">Aucun vol signalé</h3>
                      <p className="text-slate-300 text-[11px] break-all">
                        Aucun enregistrement trouvé pour "{searchQuery}".
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-2 text-xs">
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>Alerte : Correspondance trouvée dans le registre !</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {searchResult.map((item) => (
                          <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-start gap-2">
                              <span className="px-2 py-0.5 bg-red-600 text-white font-mono font-black rounded text-[11px] truncate max-w-[150px]">
                                {item.plate_number || 'SANS PLAQUE'}
                              </span>
                              <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                                {item.status || 'VOLÉ'}
                              </span>
                            </div>
                            <div className="text-slate-300 space-y-1 overflow-hidden">
                              <p className="truncate"><strong>Marque :</strong> {item.brand} {item.model} ({item.color || 'N/C'})</p>
                              <p className="truncate"><strong>Châssis :</strong> <span className="font-mono">{item.vin || 'N/R'}</span></p>
                              <p className="truncate"><strong>Propriétaire :</strong> {item.owner_name} ({item.owner_phone || 'Pas de tél'})</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Liste des Signalements Citoyens */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Signalements Citoyens en Ligne</span>
                  </h2>
                  <p className="text-xs text-slate-400">Déclarations d'urgence soumises par les citoyens.</p>
                </div>
                <span className="self-start sm:self-auto text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-slate-300">
                  {publicDeclarations.length} signalement(s)
                </span>
              </div>

              {loadingPublic ? (
                <p className="text-xs text-slate-500 text-center py-12">Chargement des signalements publics...</p>
              ) : publicDeclarations.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Aucune déclaration publique enregistrée pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {publicDeclarations.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2.5 py-1 bg-amber-400 text-slate-950 font-mono font-black text-xs rounded-lg truncate max-w-[160px]">
                          {item.plate_number || 'SANS PLAQUE'}
                        </span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                          Payé (2.000 F)
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5 text-slate-300 border-t border-slate-800 pt-2">
                        <p className="truncate"><strong className="text-slate-400">Modèle :</strong> {item.brand} {item.model} ({item.color || 'Couleur non précisée'})</p>
                        <p className="truncate"><strong className="text-slate-400">Châssis (VIN) :</strong> <span className="font-mono">{item.vin || 'Non renseigné'}</span></p>
                        <p className="truncate"><strong className="text-slate-400">Propriétaire :</strong> {item.owner_name}</p>
                        <p className="flex items-center gap-1.5 truncate"><Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" /> {item.owner_phone || 'Non renseigné'}</p>
                        
                        {item.latitude && item.longitude ? (
                          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                            <span className="flex items-center gap-1 text-[11px] truncate">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">GPS : {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                            </span>
                            <a 
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] bg-blue-600 text-white px-2.5 py-1.5 rounded-lg font-bold hover:bg-blue-500 transition-colors text-center shrink-0"
                            >
                              Voir sur Carte
                            </a>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">Position GPS non capturée lors de la déclaration.</p>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-800 gap-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0" /> Déclaré le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="font-mono text-blue-400">ID: {item.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};