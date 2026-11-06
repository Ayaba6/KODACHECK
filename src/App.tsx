import { lazy, Suspense, useEffect, useState } from 'react';
import { Globe, LogOut, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { AppFooter, ThemeToggle } from './components/layout/DashboardLayout';
import { Logo, LogoMark } from './components/layout/Logo';
import { Alert, Button } from './components/ui';
import { InstallButton } from './components/pwa/Pwa';
import LoginScreen from './pages/LoginScreen';
import PublicLandingPage from './pages/PublicLandingPage';

// Chargés à la demande : les visiteurs de l'espace citoyen ne téléchargent pas les tableaux de bord.
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const CommissaireDashboard = lazy(() => import('./pages/CommissaireDashboard'));
const AgentBureauDashboard = lazy(() => import('./pages/AgentBureauDashboard'));
const AgentTerrainDashboard = lazy(() => import('./pages/AgentTerrainDashboard'));

type PublicView = 'login' | 'citoyen';

/** L'espace citoyen est accessible directement via l'URL …/#citoyen (lien partageable). */
function usePublicView(): [PublicView, (v: PublicView) => void] {
  const read = (): PublicView => (window.location.hash.startsWith('#citoyen') ? 'citoyen' : 'login');
  const [view, setView] = useState<PublicView>(read);

  useEffect(() => {
    const onHash = () => setView(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (v: PublicView) => {
    window.location.hash = v === 'citoyen' ? 'citoyen' : '';
    setView(v);
    window.scrollTo({ top: 0 });
  };
  return [view, navigate];
}

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <LogoMark className="h-14 w-14 animate-pulse" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Vérification des accès…</p>
    </div>
  );
}

function PublicShell() {
  const [view, setView] = usePublicView();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => setView('login')} className="rounded-lg" aria-label="Accueil KODACHECK">
            <Logo size="sm" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <InstallButton />
            {view === 'login' ? (
              <Button variant="outline" size="sm" icon={<Globe className="h-4 w-4 text-amber-500" />} onClick={() => setView('citoyen')}>
                <span className="hidden sm:inline">Espace citoyen</span>
                <span className="sm:hidden">Citoyen</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" icon={<ShieldCheck className="h-4 w-4 text-brand-500" />} onClick={() => setView('login')}>
                <span className="hidden sm:inline">Espace agents</span>
                <span className="sm:hidden">Agents</span>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {view === 'login' ? <LoginScreen onOpenCitizen={() => setView('citoyen')} /> : <PublicLandingPage />}
      </main>

      <AppFooter />
    </div>
  );
}

function AccountProblem({ title, children }: { title: string; children: React.ReactNode }) {
  const { refreshProfile, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="error" title={title}>
          {children}
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" fullWidth icon={<RefreshCw className="h-4 w-4" />} onClick={refreshProfile}>
            Réessayer
          </Button>
          <Button variant="danger" fullWidth icon={<LogOut className="h-4 w-4" />} onClick={signOut}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { session, profile, role, loading, profileError } = useAuth();

  if (loading) return <SplashScreen />;
  if (!session) return <PublicShell />;

  if (profileError) {
    return <AccountProblem title="Profil indisponible">{profileError}</AccountProblem>;
  }

  if (profile?.active === false) {
    return (
      <AccountProblem title="Compte désactivé">
        Votre compte KodaCheck a été désactivé par votre hiérarchie : vous n'avez plus accès au registre. Si vous pensez
        qu'il s'agit d'une erreur, contactez votre commissaire.
      </AccountProblem>
    );
  }

  return <Suspense fallback={<SplashScreen />}>{renderDashboard()}</Suspense>;

  function renderDashboard() {
  switch (role) {
    case 'super_admin':
      return <SuperAdminDashboard />;
    case 'commissaire':
      return <CommissaireDashboard />;
    case 'agent_bureau':
      return <AgentBureauDashboard />;
    case 'agent_terrain':
      return <AgentTerrainDashboard />;
    default:
      return (
        <AccountProblem title="Rôle non attribué">
          <p>
            Le compte <strong>{profile?.badge_number ?? session?.user.email}</strong> n'a pas de rôle valide. Contactez votre
            administrateur pour qu'il vous attribue un rôle.
          </p>
          <p className="mt-2 inline-flex items-center gap-1 font-mono text-xs">
            <ShieldAlert className="h-3.5 w-3.5" /> Rôle enregistré : {JSON.stringify(profile?.role ?? null)}
          </p>
        </AccountProblem>
      );
  }
}
}
