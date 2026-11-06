import { useState, type ReactNode } from 'react';
import { Building2, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLE_LABELS } from '../../lib/utils';
import { ConfirmDialog, IconButton } from '../ui';
import { Logo } from './Logo';
import { InstallButton, OfflineBanner } from '../pwa/Pwa';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <IconButton label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'} onClick={toggleTheme}>
      {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
    </IconButton>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

interface DashboardLayoutProps {
  /** Titre de l'espace (ex : « Espace commissaire »). */
  title: string;
  /** Onglets de navigation affichés sous l'en-tête. */
  nav?: ReactNode;
  /** Actions supplémentaires dans l'en-tête (alertes, synchronisation...). */
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ title, nav, actions, children }: DashboardLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const commissariat = profile?.commissariats;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <OfflineBanner />
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo size="sm" className="shrink-0" />
          <span className="hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-800" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
            {commissariat && (
              <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{commissariat.nom}</span>
                <span className="font-mono text-brand-600 dark:text-brand-400">· {commissariat.code}</span>
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <InstallButton compact />
            <ThemeToggle />
            <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 md:flex dark:border-slate-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {initials(profile?.full_name)}
              </span>
              <div className="max-w-[180px] leading-tight">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{profile?.full_name ?? 'Utilisateur'}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {role ? ROLE_LABELS[role] : '—'}
                  {profile?.badge_number && <span className="font-mono"> · {profile.badge_number}</span>}
                </p>
              </div>
            </div>
            <IconButton label="Se déconnecter" tone="danger" onClick={() => setConfirmLogout(true)}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {/* Bandeau mobile : espace + commissariat */}
        <div className="border-t border-slate-100 px-4 py-2 sm:hidden dark:border-slate-900">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
            {title}
            {commissariat && <span className="font-normal text-slate-500 dark:text-slate-400"> · {commissariat.nom}</span>}
          </p>
        </div>

        {nav && (
          <div className="border-t border-slate-100 dark:border-slate-900">
            <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">{nav}</div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <AppFooter />

      <ConfirmDialog
        open={confirmLogout}
        title="Se déconnecter ?"
        description="Vous devrez saisir à nouveau votre matricule et votre mot de passe."
        confirmLabel="Se déconnecter"
        tone="danger"
        onConfirm={signOut}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500 dark:border-slate-900 dark:text-slate-500">
      © {new Date().getFullYear()} KODACHECK · Propulsé par{' '}
      <span className="font-semibold tracking-wide text-brand-600 dark:text-brand-400">KODALINK</span>
    </footer>
  );
}

/** En-tête de page (titre + description + actions). */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
