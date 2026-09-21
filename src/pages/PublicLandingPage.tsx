import React, { useState } from 'react';
import { Shield, Navigation, CreditCard, CheckCircle2, Search, ArrowRight, Lock, BellRing } from 'lucide-react';
import { PublicDeclarerPage } from './PublicDeclarerPage'; // Assurez-vous que le chemin d'importation est correct

interface PublicLandingPageProps {
  isDarkMode?: boolean;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ isDarkMode = true }) => {
  const [showForm, setShowForm] = useState(false);

  // Si l'utilisateur a cliqué pour déclarer, on affiche le formulaire
  if (showForm) {
    return (
      <div className="py-6 px-4 animate-fade-in">
        <div className="max-w-2xl mx-auto mb-4">
          <button
            onClick={() => setShowForm(false)}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors mb-2"
          >
            ← Retour à l'accueil du portail
          </button>
        </div>
        <PublicDeclarerPage isDarkMode={isDarkMode} onSuccess={() => setShowForm(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-12">
      
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-blue-600/10 border border-blue-500/20 rounded-3xl text-blue-500 shadow-xl shadow-blue-600/10">
          <Shield className="w-12 h-12" />
        </div>
        <div className="space-y-2 max-w-2xl mx-auto">
          <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
            Plateforme Officielle d'Urgence
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
            E-Déclaration & Suivi des Engins Volés
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Signalez le vol de votre moto ou véhicule en temps réel. Votre déclaration est instantanément transmise aux patrouilles et commissariats du réseau national.
          </p>
        </div>

        {/* Bouton d'Appel à l'Action Principal */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 text-sm uppercase tracking-wider transition-all transform hover:-translate-y-0.5"
          >
            <BellRing className="w-5 h-5 animate-bounce" />
            <span>Déclarer un engin volé maintenant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grille des Fonctionnalités / Avantages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
        
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Navigation className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white">Géolocalisation GPS</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Capture automatique de votre position au moment du vol pour guider les forces de l'ordre sur la zone exacte.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white">Paiement Sécurisé (2.000 F)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Frais administratifs de traitement et de mise en ligne immédiate réglés par Mobile Money en toute sécurité.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-white">Alerte Nationale Directe</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Diffusion instantanée sur les terminaux des agents de terrain et consultation sur le registre officiel.
          </p>
        </div>

      </div>

      {/* Note d'information institutionnelle en bas */}
      <div className="p-4 bg-slate-900/30 border border-slate-800/80 rounded-2xl flex items-center gap-3 text-xs text-slate-400">
        <Lock className="w-4 h-4 text-slate-500 shrink-0" />
        <span>Les informations fournies sont certifiées et enregistrées conformément aux procédures en vigueur des services de sécurité.</span>
      </div>

    </div>
  );
};