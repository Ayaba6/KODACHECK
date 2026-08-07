import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState(''); // Email OU Badge Number
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let emailToUse = identifier.trim();

    try {
      // Si l'identifiant ne contient pas '@', on cherche le badge_number dans profiles
      if (!emailToUse.includes('@')) {
        // 1. On récupère l'ID utilisateur lié à ce badge_number
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('badge_number', emailToUse) // Utilisation de badge_number au lieu de matricule
          .maybeSingle();

        if (profileError || !profile) {
          throw new Error("Matricule non reconnu.");
        }

        // 2. Si votre table profiles n'a pas la colonne email,
        // on tente la connexion directement ou via l'email renseigné
        // Si vous avez besoin de récupérer l'email depuis auth, assurez-vous d'utiliser un identifiant email valide.
      }

      // Connexion via Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (authError) throw authError;

    } catch (err) {
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

        {/* Alerte d'erreur */}
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
              Adresse Email / Matricule Agent
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="agent@kodacheck.com ou MAT-56B347"
                className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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