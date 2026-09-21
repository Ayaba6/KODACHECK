import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, AlertTriangle, CreditCard, CheckCircle, Loader2, Navigation, KeyRound, Building2 } from 'lucide-react';

interface PublicDeclarerPageProps {
  isDarkMode?: boolean;
  onSuccess?: () => void;
}

export const PublicDeclarerPage: React.FC<PublicDeclarerPageProps> = ({ isDarkMode = true, onSuccess }) => {
  const [step, setStep] = useState<'form' | 'payment' | 'otp' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Liste des commissariats chargés depuis Supabase
  const [commissariats, setCommissariats] = useState<any[]>([]);
  const [loadingCommissariats, setLoadingCommissariats] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    plate_number: '',
    brand: '',
    model: '',
    color: '',
    vin: '',
    owner_name: '',
    owner_phone: '',
    commissariat_id: '', 
    stolen_date: new Date().toISOString().split('T')[0],
    latitude: null as number | null,
    longitude: null as number | null,
    location_accuracy: null as number | null,
  });

  const [gettingLocation, setGettingLocation] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);

  // Listes déroulantes prédéfinies pour les marques de motos et les couleurs
  const motorcycleBrands = [
    'Haojue',
    'Yamaha',
    'Honda',
    'Suzuki',
    'Bajaj / Boxer',
    'TVS',
    'Sanili',
    'Kymco',
    'Sym',
    'Dayang',
    'Pegasus',
    'Loncin',
    'Autre'
  ];

  const motorcycleColors = [
    'Noir',
    'Rouge',
    'Bleu',
    'Blanc',
    'Gris',
    'Vert',
    'Marron',
    'Jaune',
    'Orange',
    'Autre'
  ];

  useEffect(() => {
    fetchGPSLocation();
    fetchCommissariats();
  }, []);

  const fetchCommissariats = async () => {
    try {
      setLoadingCommissariats(true);
      const { data, error } = await supabase
        .from('commissariats')
        .select('id, nom, code')
        .order('nom', { ascending: true });

      if (error) throw error;
      setCommissariats(data || []);
    } catch (err) {
      console.error("Erreur chargement commissariats :", err);
    } finally {
      setLoadingCommissariats(false);
    }
  };

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

    if (!formData.commissariat_id) {
      setErrorMsg("Veuillez sélectionner le commissariat territorialement compétent.");
      return;
    }

    if (!formData.owner_phone.trim()) {
      setErrorMsg("Le numéro de téléphone du propriétaire est obligatoire.");
      return;
    }

    setStep('payment');
  };

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPhone.trim()) {
      setErrorMsg("Veuillez entrer le numéro de téléphone pour le paiement.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 1500);
  };

  const handleVerifyOtpAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 4) {
      setErrorMsg("Veuillez entrer un code OTP valide (ex: 1234).");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
            commissariat_id: formData.commissariat_id || null,
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
      setErrorMsg(err.message || "Une erreur est survenue lors de l'enregistrement.");
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const selectedCommissariat = commissariats.find(c => c.id === formData.commissariat_id);
    const commissariatName = selectedCommissariat ? `${selectedCommissariat.nom} (${selectedCommissariat.code})` : 'Non spécifié';

    const message = `🚨 *AVIS DE VOL D'ENGIN - KODACHECK* 🚨\n\n` +
      `• *Plaque / VIN :* ${formData.plate_number || formData.vin}\n` +
      `• *Marque / Modèle :* ${formData.brand} ${formData.model} (${formData.color || 'N/C'})\n` +
      `• *Propriétaire :* ${formData.owner_name} (${formData.owner_phone})\n` +
      `• *Commissariat de rattachement :* ${commissariatName}\n` +
      `• *Date du vol :* ${formData.stolen_date}\n` +
      (formData.latitude && formData.longitude 
        ? `• *Position GPS :* https://www.google.com/maps?q=${formData.latitude},${formData.longitude}\n\n` 
        : `\n`) +
      `_Déclaration certifiée sur le registre national de sécurité._`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className={`max-w-2xl mx-auto p-3 sm:p-6 rounded-3xl border transition-all ${
      isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
    }`}>
      
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b pb-4 mb-5 border-slate-700/50">
        <div className="p-2.5 sm:p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 shrink-0">
          <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <div>
          <h1 className="text-sm sm:text-lg font-black uppercase tracking-tight">Déclaration de Vol d'Engin en Urgence</h1>
          <p className="text-[11px] sm:text-xs text-slate-400">Diffusion instantanée sur le réseau national des forces de l'ordre</p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ÉTAPE 1 : FORMULAIRE */}
      {step === 'form' && (
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            formData.latitude ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            <div className="flex items-center gap-2">
              <Navigation className={`w-4 h-4 shrink-0 ${gettingLocation ? 'animate-spin' : ''}`} />
              <span className="truncate">
                {gettingLocation 
                  ? "Recherche de votre position GPS..." 
                  : formData.latitude 
                    ? `Position GPS capturée (${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)})` 
                    : "Position GPS non disponible"}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchGPSLocation}
              className="self-start sm:self-auto px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold transition-colors shrink-0"
            >
              Actualiser GPS
            </button>
          </div>

          {/* SÉLECTION DU COMMISSARIAT DE RATTACHEMENT */}
          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase text-[10px] flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Commissariat de rattachement (Territoire du vol) *</span>
            </label>
            <select
              required
              value={formData.commissariat_id}
              onChange={(e) => setFormData({ ...formData, commissariat_id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-slate-100 text-xs"
            >
              <option value="">-- Sélectionnez un commissariat --</option>
              {loadingCommissariats ? (
                <option disabled>Chargement des commissariats...</option>
              ) : (
                commissariats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} {c.code ? `(${c.code})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Numéro de Plaque</label>
              <input
                type="text"
                placeholder="ex: 11-JJ-1234"
                value={formData.plate_number}
                onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono uppercase focus:border-blue-500 focus:outline-none text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">N° de Châssis (VIN)</label>
              <input
                type="text"
                placeholder="Numéro de série / Châssis"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono uppercase focus:border-blue-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* MARQUE EN LISTE DÉROULANTE */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Marque *</label>
              <select
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-slate-100 text-xs"
              >
                <option value="">-- Choisir marque --</option>
                {motorcycleBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Modèle *</label>
              <input
                type="text"
                required
                placeholder="ex: 100-M, Custa..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-xs"
              />
            </div>

            {/* COULEUR EN LISTE DÉROULANTE */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Couleur *</label>
              <select
                required
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-slate-100 text-xs"
              >
                <option value="">-- Choisir couleur --</option>
                {motorcycleColors.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Nom du Propriétaire *</label>
              <input
                type="text"
                required
                placeholder="Nom et Prénom"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-400 uppercase text-[10px]">Téléphone de contact *</label>
              <input
                type="tel"
                required
                placeholder="ex: +226 70 00 00 00"
                value={formData.owner_phone}
                onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase text-[10px]">Date du Vol *</label>
            <input
              type="date"
              required
              value={formData.stolen_date}
              onChange={(e) => setFormData({ ...formData, stolen_date: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider mt-4"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Continuer vers le Paiement (2.000 FCFA)</span>
          </button>
        </form>
      )}

      {/* ÉTAPE 2 : PAIEMENT MOBILE MONEY */}
      {step === 'payment' && (
        <form onSubmit={handleRequestOtp} className="space-y-5 text-xs">
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-2">
            <h2 className="font-bold text-amber-400 text-sm">Frais administratifs (2 000 FCFA)</h2>
            <p className="text-slate-300">
              Entrez votre numéro Mobile Money. Un code OTP de confirmation vous sera envoyé pour valider le prélèvement.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase text-[10px]">Numéro Mobile Money *</label>
            <input
              type="tel"
              required
              placeholder="ex: 70 00 00 00"
              value={paymentPhone}
              onChange={(e) => setPaymentPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full sm:w-1/3 py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition-colors"
            >
              Retour
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-2/3 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {loading ? "Envoi de l'OTP..." : "Recevoir le Code OTP"}
            </button>
          </div>
        </form>
      )}

      {/* ÉTAPE 3 : SAISIE DE L'OTP */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtpAndSubmit} className="space-y-5 text-xs">
          <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl space-y-2 text-center">
            <KeyRound className="w-8 h-8 text-blue-400 mx-auto" />
            <h2 className="font-bold text-blue-400 text-sm">Validation par Code OTP</h2>
            <p className="text-slate-300 text-[11px]">
              Un code de confirmation a été envoyé par SMS au <strong className="text-white font-mono">{paymentPhone}</strong>. <br/>
              <span className="text-slate-400 italic">(Pour ce test, entrez n'importe quel code à 4 chiffres, ex: 1234)</span>
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-400 uppercase text-[10px] text-center block">Code de Validation (OTP)</label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="ex: 1234"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-center text-lg tracking-widest focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep('payment')}
              className="w-full sm:w-1/3 py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition-colors"
            >
              Modifier le numéro
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-2/3 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {loading ? "Vérification..." : "Confirmer & Payer 2 000 FCFA"}
            </button>
          </div>
        </form>
      )}

      {/* ÉTAPE 4 : SUCCÈS & PARTAGE WHATSAPP */}
      {step === 'success' && (
        <div className="text-center py-8 space-y-5">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-black text-white">Déclaration Validée & Enregistrée !</h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Le paiement de 2 000 FCFA a été validé. L'engin est désormais rattaché au commissariat choisi et diffusé sur le réseau national.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 uppercase tracking-wider"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.124-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <span>Partager le PV sur WhatsApp</span>
            </button>

            <button
              onClick={() => {
                setStep('form');
                setOtpCode('');
                setPaymentPhone('');
                setFormData({
                  plate_number: '',
                  brand: '',
                  model: '',
                  color: '',
                  vin: '',
                  owner_name: '',
                  owner_phone: '',
                  commissariat_id: '',
                  stolen_date: new Date().toISOString().split('T')[0],
                  latitude: null,
                  longitude: null,
                  location_accuracy: null,
                });
              }}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Nouvelle Déclaration
            </button>
          </div>
        </div>
      )}

    </div>
  );
};