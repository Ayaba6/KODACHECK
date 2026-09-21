import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Sun, Moon, Globe, ArrowLeft, Shield } from 'lucide-react';

// Pages & Écrans
import LoginScreen from './pages/LoginScreen';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import CommissaireDashboard from './pages/CommissaireDashboard';
import { AgentBureauDashboard } from './pages/AgentBureauDashboard';
import AgentTerrainDashboard from './pages/AgentTerrainDashboard';
import { PublicLandingPage } from './pages/PublicLandingPage'; // Import de la Landing Page

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [currentView, setCurrentView] = useState('login');

  // 1. Initialisation du thème depuis le localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  // 2. Application dynamique de la classe 'dark' sur l'élément root <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Erreur lors de la récupération du profil utilisateur :", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Vérification des accès en cours...</p>
      </div>
    );
  }

  // Si l'utilisateur n'est PAS connecté
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
        
        {/* Boutons flottants supérieurs */}
        <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
          {currentView === 'login' ? (
            <button
              type="button"
              onClick={() => setCurrentView('public-landing')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all text-xs font-bold shadow-md"
            >
              <Globe className="w-4 h-4" />
              <span>Espace Citoyen (Déclaration & GPS)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentView('login')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all text-xs font-bold shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l'Espace Agent / Connexion</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-md"
            title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>
        </div>

        {/* Contenu principal déconnecté */}
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          {currentView === 'login' ? (
            <LoginScreen />
          ) : (
            <PublicLandingPage isDarkMode={darkMode} />
          )}
        </main>

        <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950/80 backdrop-blur">
          <p>
            Propulsé par <span className="font-semibold text-blue-500 dark:text-blue-400 tracking-wide">KODALINK</span>
          </p>
        </footer>
      </div>
    );
  }

  // Si l'utilisateur est connecté, affichage du Dashboard selon son rôle
  const renderDashboard = () => {
    const rawRole = profile?.role;
    const role = rawRole ? String(rawRole).toLowerCase().trim().replace(/\s+/g, '_') : null;

    const commonProps = {
      user: session.user,
      profile,
      isDarkMode: darkMode,
      darkMode,
      toggleTheme
    };

    switch (role) {
      case 'super_admin':
        return <SuperAdminDashboard {...commonProps} />;
      case 'commissaire':
        return <CommissaireDashboard {...commonProps} />;
      case 'agent_bureau':
        return <AgentBureauDashboard {...commonProps} />;
      case 'agent_terrain':
        return <AgentTerrainDashboard {...commonProps} />;
      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <h2 className="text-xl font-bold text-red-500">Rôle non attribué ou non reconnu</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Votre compte ({session?.user?.email}) ne possède pas un rôle valide configuré.
            </p>
            <div className="text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl font-mono text-slate-600 dark:text-slate-400">
              Rôle lu dans la base de données : <span className="font-bold text-blue-500">{JSON.stringify(rawRole)}</span>
            </div>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <main className="flex-1 flex flex-col">
        {renderDashboard()}
      </main>

      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950/80 backdrop-blur">
        <p>
          Propulsé par <span className="font-semibold text-blue-500 dark:text-blue-400 tracking-wide">KODALINK</span>
        </p>
      </footer>
    </div>
  );
}