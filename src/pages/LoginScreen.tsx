import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Identifiants incorrects ou accès non autorisé.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl">
        
        {/* En-tête / Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-blue-600/20 p-4 rounded-full mb-3 border border-blue-500/30">
            <ShieldCheck className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Contrôle Sécurité Routière</h1>
          <p className="text-slate-400 text-sm mt-1">Plateforme de vérification d'engins</p>
        </div>

        {/* Alerte d'erreur */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
              Adresse Email / Identifiant Agent
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@securite.gouv"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
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

        <div className="mt-6 text-center text-xs text-slate-500">
          Système officiel de contrôle routier
        </div>
      </div>
    </div>
  );
}