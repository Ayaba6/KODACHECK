import React, { useState, useEffect } from 'react';
import { PlusCircle, FileText, Shield, LogOut, Moon, Sun, Building2, User } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'declarer' | 'registre'>('registre');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchAgentProfile();
  }, []);

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
      {/* Barre de Navigation Supérieure Responsive */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:h-16">
          
          {/* Ligne 1 sur mobile / Bloc Gauche sur PC : Logo & Infos Agent */}
          <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl shrink-0">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-sm md:text-base tracking-tight leading-tight">E-Police Engins</h1>
                  {profile?.commissariats && (
                    <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-md border border-blue-500/20 shrink-0">
                      {profile.commissariats.code}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 truncate max-w-[220px] sm:max-w-none">
                  <User className="w-3 h-3 inline shrink-0" /> <span className="truncate">{profile?.full_name || 'Agent de Bureau'}</span>
                  {profile?.commissariats?.nom && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                      <Building2 className="w-3 h-3 inline shrink-0" /> <span className="truncate">{profile.commissariats.nom}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Actions mobiles (Thème + Déconnexion) intégrées en haut à droite sur petits écrans pour un accès immédiat */}
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

          {/* Ligne 2 sur mobile / Bloc Centre sur PC : Navigation par Onglets */}
          <nav className={`flex items-center justify-center gap-1 p-1 rounded-xl border w-full md:w-auto ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('registre')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'registre'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Registre National</span>
            </button>

            <button
              onClick={() => setActiveTab('declarer')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'declarer'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Déclarer un Vol</span>
            </button>
          </nav>

          {/* Bloc Droite sur PC uniquement (masqué sur mobile car déjà géré en haut) */}
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

      {/* Contenu Principal */}
      <main className="py-6 max-w-7xl mx-auto px-4 sm:px-6">
        {activeTab === 'registre' && (
          <RegistrePage isDarkMode={isDarkMode} />
        )}
        {activeTab === 'declarer' && (
          <DeclarerPage 
            isDarkMode={isDarkMode} 
            onSuccess={() => setActiveTab('registre')} 
          />
        )}
      </main>
    </div>
  );
};