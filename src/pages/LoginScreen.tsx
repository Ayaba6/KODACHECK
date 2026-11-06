import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Globe, Lock, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AUTH_EMAIL_DOMAIN } from '../lib/utils';
import { Logo } from '../components/layout/Logo';
import { Alert, Button, Card, Input } from '../components/ui';

/**
 * Accepte un matricule (MAT-56B347) ou, pour les comptes plus anciens, une adresse email complète.
 */
function toLoginEmail(identifier: string): string | null {
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    return domain?.toLowerCase() === AUTH_EMAIL_DOMAIN ? `${local}@${AUTH_EMAIL_DOMAIN}`.toLowerCase() : value.toLowerCase();
  }
  return `${value.toUpperCase()}@${AUTH_EMAIL_DOMAIN}`.toLowerCase();
}

export default function LoginScreen({ onOpenCitizen }: { onOpenCitizen: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const email = toLoginEmail(identifier);
    if (!email) {
      setError('Veuillez saisir votre matricule.');
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(
        authError.message.toLowerCase().includes('fetch')
          ? 'Connexion au serveur impossible. Vérifiez votre accès internet.'
          : 'Matricule ou mot de passe incorrect.',
      );
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Logo size="lg" className="justify-center" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Plateforme nationale de vérification des engins</p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Espace agents</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Connectez-vous avec le matricule fourni par votre hiérarchie.
            </p>
          </div>

          {error && (
            <Alert variant="error" className="mb-5">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <Input
              label="Matricule"
              required
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="MAT-56B347"
              leading={<UserCheck className="h-4 w-4" />}
              className="font-mono uppercase placeholder:normal-case"
            />

            <Input
              label="Mot de passe"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leading={<Lock className="h-4 w-4" />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
              {loading ? 'Connexion…' : 'Se connecter'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Mot de passe oublié ? Contactez votre commissaire ou l'administrateur.
          </p>
        </Card>

        <button
          type="button"
          onClick={onOpenCitizen}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition-colors hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/5 dark:hover:bg-amber-500/10"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Globe className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">Vous êtes un particulier ?</span>
            <span className="block text-xs text-slate-600 dark:text-slate-400">Déclarez le vol de votre engin en ligne.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        </button>
      </div>
    </div>
  );
}
