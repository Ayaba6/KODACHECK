import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import LoginScreen from './pages/LoginScreen';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setRole(data.role);
    } else {
      setRole('agent'); // Rôle par défaut
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Chargement de l'application...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  // Redirection selon le rôle
  return role === 'admin' ? <AdminDashboard /> : <AgentDashboard />;
}