import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Sun, Moon } from 'lucide-react';

// Pages & Écrans
import LoginScreen from './pages/LoginScreen';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import CommissaireDashboard from './pages/CommissaireDashboard';
import AgentBureauDashboard from './pages/AgentBureauDashboard';
import AgentTerrainDashboard from './pages/AgentTerrainDashboard'; // ✅ 'T' majuscule corrigé

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // État du mode sombre / clair (par défaut sombre si non spécifié)
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  // Appliquer le thème au changement d'état
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  useEffect(() => {
    // 1. Récupération de la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Écoute des changements d'état d'authentification
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

  // Charger le profil utilisateur
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

  // 1. Écran de chargement
  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-3 ${
        darkMode ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-600'
      }`}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Vérification des accès en cours...</p>
      </div>
    );
  }

  // 2. Page de connexion si pas de session
  if (!session) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        {/* Bouton flottant pour basculer le thème sur l'écran de login */}
        <button
          onClick={toggleTheme}
          className="fixed top-4 right-4 p-2.5 rounded-xl border border-slate-700/50 bg-slate-900/80 text-amber-400 hover:bg-slate-800 transition-all z-50 dark:bg-slate-800 dark:text-amber-400 dark:border-slate-700"
          title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-slate-700" />}
        </button>
        <LoginScreen />
      </div>
    );
  }

  // 3. Routage selon le rôle
  const renderDashboard = () => {
    const role = profile?.role?.toLowerCase();

    switch (role) {
      case 'super_admin':
        return <SuperAdminDashboard user={session.user} profile={profile} />;
      case 'commissaire':
        return <CommissaireDashboard user={session.user} profile={profile} />;
      case 'agent_bureau':
        return <AgentBureauDashboard user={session.user} profile={profile} />;
      case 'agent_terrain':
        return <AgentTerrainDashboard user={session.user} profile={profile} />;
      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <h2 className="text-xl font-bold text-red-500">Rôle non attribué</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Votre compte ({session.user.email}) ne possède pas encore de rôle configuré. Veuillez contacter l'administrateur.
            </p>
            <button
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
    <div className={`app-container min-h-screen flex flex-col justify-between transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Bouton de bascule du thème (fixe en haut à droite) */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur text-slate-700 dark:text-amber-400 hover:scale-105 transition-all z-50 shadow-lg"
        title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
      >
        {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
      </button>

      {/* Contenu principal */}
      <main className="flex-1">
        {renderDashboard()}
      </main>

      {/* Footer global */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950/80 backdrop-blur">
        <p>
          Propulsé par <span className="font-semibold text-blue-500 dark:text-blue-400 tracking-wide">KODALINK</span>
        </p>
      </footer>
    </div>
  );
}