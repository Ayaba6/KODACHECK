import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, AlertTriangle, MapPin, CreditCard, CheckCircle, Loader2, Navigation } from 'lucide-react';

interface PublicDeclarerPageProps {
  isDarkMode?: boolean;
  onSuccess?: () => void;
}

export const PublicDeclarerPage: React.FC<PublicDeclarerPageProps> = ({ isDarkMode = true, onSuccess }) => {
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    plate_number: '',
    brand: '',
    model: '',
    color: '',
    vin: '',
    owner_name: '',
    owner_phone: '',
    stolen_date: new Date().toISOString().split('T')[0],
    latitude: null as number | null,
    longitude: null as number | null,
    location_accuracy: null as number | null,
  });

  const [gettingLocation, setGettingLocation] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);

  // Récupération automatique de la position GPS au chargement de la page
  useEffect(() => {
    fetchGPSLocation();
  }, []);

  const fetchGPSLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          location_accuracy: position.coords.accuracy,
        }));
        setGettingLocation(false);
      },
      (error) => {
        console.warn("Erreur géolocalisation :", error.message);
        setGettingLocation(false);
        // On ne bloque pas le formulaire si le GPS est refusé, l'utilisateur pourra continuer
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.plate_number.trim() && !formData.vin.trim()) {
      setErrorMsg("Veuillez renseigner au moins le numéro de plaque ou le numéro de châssis (VIN).");
      return;
    }

    if (!formData.owner_phone.trim()) {
      setErrorMsg("Le numéro de téléphone du propriétaire est obligatoire pour le suivi.");
      return;
    }

    // Passer à l'étape du paiement de 2000f
    setStep('payment');
  };

  const processPaymentAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPhone.trim()) {
      setErrorMsg("Veuillez entrer le numéro de téléphone pour le paiement des 2000 FCFA.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Simulation de l'appel de paiement mobile (2000 FCFA)
      // Ici vous intégrerez votre passerelle de paiement (CinetPay, FedaPay, Orange Money API, etc.)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2. Insertion de la déclaration dans Supabase (status: 'STOLEN')
      // Note: Pas de commissariat_id requis pour une déclaration publique d'urgence, ou assigné à un commissariat central par défaut
      const { data, error } = await supabase
        .from('stolen_vehicles')
        .insert([
          {
            plate_number: formData.plate_number.trim().toUpperCase(),
            brand: formData.brand.trim(),
            model: formData.model.trim(),
            color: formData.color.trim(),
            vin: formData.vin.trim().toUpperCase(),
            owner_name: formData.owner_name.trim(),
            owner_phone: formData.owner_phone.trim(),
            stolen_date: formData.stolen_date,
            latitude: formData.latitude,
            longitude: formData.longitude,
            status: 'STOLEN',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCreatedVehicleId(data.id);
        setStep('success');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error("Erreur lors de la déclaration :", err);
      setErrorMsg(err.message || "Une erreur est survenue lors de l'enregistrement de la déclaration.");
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-2xl mx-auto p-4 sm:p-6 rounded-3xl border transition-all ${
      isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
    }`}>
      
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b pb-4 mb-6 border-slate-700/50">
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
          <Shield className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight">Déclaration de Vol d'Engin en Urgence</h1>
          <p className="text-xs text-slate-400">Diffusion instantanée sur le réseau national des forces de l'ordre</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ÉTAPE 1 : FORMULAIRE DE SIGNALEMENT & GPS */}
      {step === 'form' && (
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          
          {/* Bloc Géolocalisation */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between ${
            formData.latitude ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            <div className="flex items-center gap-2">
              <Navigation className={`w-4 h-4 ${gettingLocation ? 'animate-spin' : ''}`} />
              <span>
                {gettingLocation 
                  ? "Recherche de votre position GPS..." 
                  : formData.latitude 
                    ? `Position GPS capturée avec succès (${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)})` 
                    : "Position GPS non disponible (Optionnel)"}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchGPSLocation}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold transition-colors"
            >
              Actualiser GPS
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Numéro de Plaque</label>
              <input
                type="text"
                placeholder="ex: 11-JJ-1234"
                value={formData.plate_number}
                onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono uppercase focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">N° de Châssis (VIN)</label>
              <input
                type="text"
                placeholder="Numéro de série / Châssis"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono uppercase focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Marque</label>
              <input
                type="text"
                required
                placeholder="ex: Yamaha, Haojue..."
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Modèle</label>
              <input
                type="text"
                required
                placeholder="ex: 100-M, Custa..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Couleur</label>
              <input
                type="text"
                placeholder="ex: Noir, Rouge..."
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Nom du Propriétaire</label>
              <input
                type="text"
                required
                placeholder="Nom et Prénom"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Téléphone de contact</label>
              <input
                type="tel"
                required
                placeholder="ex: +226 XX XX XX XX"
                value={formData.owner_phone}
                onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase text-[10px]">Date du Vol</label>
            <input
              type="date"
              required
              value={formData.stolen_date}
              onChange={(e) => setFormData({ ...formData, stolen_date: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-4"
          >
            <CreditCard className="w-4 h-4" />
            Continuer vers le Paiement des Frais (2.000 FCFA)
          </button>
        </form>
      )}

      {/* ÉTAPE 2 : PAIEMENT DES 2000 FCFA */}
      {step === 'payment' && (
        <form onSubmit={processPaymentAndSubmit} className="space-y-5 text-xs">
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-2">
            <h2 className="font-bold text-amber-400 text-sm">Frais de traitement de la déclaration</h2>
            <p className="text-slate-300">
              Conformément à la procédure de mise en ligne des avis de recherche d'engins, des frais administratifs de <strong className="text-white">2 000 FCFA</strong> sont requis pour valider l'enregistrement immédiat.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase text-[10px]">Numéro Mobile Money pour le prélèvement</label>
            <input
              type="tel"
              required
              placeholder="ex: 70 00 00 00"
              value={paymentPhone}
              onChange={(e) => setPaymentPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition-colors"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {loading ? "Traitement en cours..." : "Payer 2 000 FCFA & Valider"}
            </button>
          </div>
        </form>
      )}

      {/* ÉTAPE 3 : SUCCÈS */}
      {step === 'success' && (
        <div className="text-center py-8 space-y-4">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-black text-white">Déclaration Enregistrée avec Succès !</h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Votre engin a été signalé volé sur l'ensemble du réseau national. Les agents de terrain et les commissariats ont reçu l'alerte en temps réel.
          </p>
          <div className="pt-4">
            <button
              onClick={() => {
                setStep('form');
                setFormData({
                  plate_number: '',
                  brand: '',
                  model: '',
                  color: '',
                  vin: '',
                  owner_name: '',
                  owner_phone: '',
                  stolen_date: new Date().toISOString().split('T')[0],
                  latitude: null,
                  longitude: null,
                  location_accuracy: null,
                });
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Effectuer une autre déclaration
            </button>
          </div>
        </div>
      )}

    </div>
  );
};