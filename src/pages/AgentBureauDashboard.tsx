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
      {/* Barre de Navigation Supérieure */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Identité / Logo & Commissariat */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl shrink-0">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base leading-tight">E-Police Engins</h1>
                {profile?.commissariats && (
                  <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-md border border-blue-500/20">
                    {profile.commissariats.code}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <User className="w-3 h-3 inline" /> {profile?.full_name || 'Agent de Bureau'}
                {profile?.commissariats?.nom && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <Building2 className="w-3 h-3 inline" /> {profile.commissariats.nom}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Navigation par Onglets */}
          <nav className={`flex items-center gap-1 p-1 rounded-xl border ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('registre')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'registre'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Registre National</span>
              <span className="sm:hidden">Registre</span>
            </button>

            <button
              onClick={() => setActiveTab('declarer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === 'declarer'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Déclarer un Vol</span>
              <span className="sm:hidden">Déclarer</span>
            </button>
          </nav>

          {/* Actions : Thème & Déconnexion */}
          <div className="flex items-center gap-2">
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