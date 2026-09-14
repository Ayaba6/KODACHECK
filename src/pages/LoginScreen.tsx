import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Lock, UserCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginScreen() {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Extraction propre du matricule (au cas où l'agent tape l'email entier par habitude)
    let rawBadge = badgeNumber.trim().toUpperCase();
    if (rawBadge.includes('@')) {
      rawBadge = rawBadge.split('@')[0];
    }

    if (!rawBadge) {
      setError('Veuillez saisir votre matricule.');
      setLoading(false);
      return;
    }

    // Reconstruction standardisée de l'identifiant Supabase
    const formattedEmail = `${rawBadge}@kodacheck.com`;

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password,
      });

      if (authError) {
        throw new Error('Matricule ou mot de passe incorrect.');
      }
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects ou accès non autorisé.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl">
        
        {/* En-tête / Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-blue-500/10 dark:bg-blue-600/20 p-4 rounded-full mb-3 border border-blue-500/30">
            <ShieldCheck className="w-12 h-12 text-blue-600 dark:text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold">Contrôle Sécurité Routière</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Plateforme de vérification d'engins
          </p>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase mb-2 text-slate-700 dark:text-slate-300">
              Matricule Agent
            </label>
            <div className="relative">
              <UserCheck className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoCapitalize="characters"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                placeholder="Ex: MAT-56B347"
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-900 dark:text-white uppercase placeholder:normal-case placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase mb-2 text-slate-700 dark:text-slate-300">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-3 pl-10 pr-12 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Système officiel de contrôle routier
        </div>
      </div>
    </div>
  );
}