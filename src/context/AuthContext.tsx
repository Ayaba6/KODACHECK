import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeRole } from '../lib/utils';
import type { Profile, Role } from '../types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  /** Erreur de chargement du profil (réseau, profil absent...). */
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, commissariats:commissariat_id (id, nom, code)')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const syncProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      setProfileError(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await loadProfile(nextSession.user.id));
      setProfileError(null);
    } catch (err) {
      console.error('Erreur lors du chargement du profil :', err);
      setProfile(null);
      setProfileError("Impossible de charger votre profil. Vérifiez votre connexion puis réessayez.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let currentUserId: string | null = null;

    supabase.auth.getSession().then(({ data }) => {
      currentUserId = data.session?.user.id ?? null;
      setSession(data.session);
      void syncProfile(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const nextUserId = nextSession?.user.id ?? null;
      // Le rafraîchissement du jeton ne doit pas recharger le profil ni afficher l'écran de chargement.
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        setLoading(Boolean(nextUserId));
        // Différé : on évite d'appeler Supabase à l'intérieur du callback d'authentification.
        setTimeout(() => void syncProfile(nextSession), 0);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [syncProfile]);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    await syncProfile(session);
  }, [session, syncProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role: normalizeRole(profile?.role),
        loading,
        profileError,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
