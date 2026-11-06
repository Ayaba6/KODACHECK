import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizeRole } from '../lib/utils';
import { clearLocalRegistry } from '../lib/syncService';
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

const PROFILE_CACHE_KEY = 'kodacheck:profile';

/** Dernier profil connu, pour ouvrir l'application sans réseau (agents de terrain). */
function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as Profile) : null;
    return cached?.id === userId ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* stockage indisponible */
  }
}

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
      const fresh = await loadProfile(nextSession.user.id);
      writeCachedProfile(fresh);
      setProfile(fresh);
      setProfileError(null);
    } catch (err) {
      // Sans réseau, on reprend le dernier profil connu de cet utilisateur
      const cached = readCachedProfile(nextSession.user.id);
      if (cached) {
        setProfile(cached);
        setProfileError(null);
      } else {
        console.error('Erreur lors du chargement du profil :', err);
        setProfile(null);
        setProfileError(
          navigator.onLine
            ? 'Impossible de charger votre profil. Vérifiez votre connexion puis réessayez.'
            : 'Vous êtes hors-ligne. Connectez-vous une première fois avec du réseau pour utiliser KodaCheck hors-ligne.',
        );
      }
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
    writeCachedProfile(null);
    // Le registre local contient des données personnelles (propriétaires) : on l'efface à la
    // déconnexion, l'appareil pouvant être partagé entre agents.
    await clearLocalRegistry();
    // Hors-ligne, la déconnexion serveur échoue : on efface au moins la session locale
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' });
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
