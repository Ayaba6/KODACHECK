import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, PlusCircle, LogOut, AlertCircle, List, CheckCircle, PackageCheck, Truck, Loader2, Search, X, Printer, Lock, Calendar, User, Tag } from 'lucide-react';

// Listes de données prédéfinies pour les menus déroulants
const MARQUES_ET_MODELES = {
  "Yamaha": ["Sirius", "Spark", "Crypton", "Force X", "RayZR", "125", "DT", "YZF-R", "Autre / Non spécifié"],
  "KTM": ["Duke 125", "Duke 200", "Duke 390", "RC 200", "EXC", "Autre / Non spécifié"],
  "TVS": ["HLX 125", "HLX 150", "Apache RTR", "Star HLX", "Neo NX", "Autre / Non spécifié"],
  "Honda": ["CGL 125", "CB 125", "Wave", "Ace 110", "PCX", "XR 150", "Autre / Non spécifié"],
  "Sanili": ["SL 125", "SL 150", "SL 110", "Autre / Non spécifié"],
  "Rato": ["RT 125", "RT 150", "Autre / Non spécifié"],
  "Suzuki": ["GN 125", "GSX-R", "Smash", "Burgman", "Autre / Non spécifié"],
  "Kaizer": ["KZ 125", "KZ 150", "Autre / Non spécifié"],
  "Nanfang": ["NF 125", "NF 150", "Autre / Non spécifié"],
  "Toyota": ["Hilux", "Corolla", "Land Cruiser", "Yaris", "RAV4", "Prado", "Autre / Non spécifié"],
  "Hyundai": ["Tucson", "Santa Fe", "Elantra", "Accent", "i10", "Autre / Non spécifié"],
  "Mercedes-Benz": ["Classe C", "Classe E", "GLC", "GLE", "Sprinter", "Autre / Non spécifié"],
  "Peugeot": ["206", "207", "208", "301", "308", "3008", "Autre / Non spécifié"],
  "Autre": ["Modèle standard / Inconnu"]
};

const COULEURS = [
  "Noir",
  "Rouge",
  "Bleu",
  "Blanc",
  "Gris / Argent",
  "Vert",
  "Jaune",
  "Marron / Bronze",
  "Orange",
  "Violet / Rose",
  "Autre / Bicolore"
];

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  // Recherche dans le registre général
  const [registrySearch, setRegistrySearch] = useState('');

  // Objet stockant les données du véhicule à imprimer
  const [printableVehicle, setPrintableVehicle] = useState(null);

  // Champs du formulaire d'ajout
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [reportNumber, setReportNumber] = useState('');
  const [stolenDate, setStolenDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchStolenVehicles();
    generateNextReportNumber();
  }, []);

  // Réinitialiser le modèle quand la marque change
  const handleBrandChange = (e) => {
    const selectedBrand = e.target.value;
    setBrand(selectedBrand);
    setModel('');
  };

  // Génération automatique du numéro de PV selon le mois (ex: PV-202608-0001)
  const generateNextReportNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PV-${year}${month}-`;

    try {
      const { data, error } = await supabase
        .from('stolen_vehicles')
        .select('report_number')
        .ilike('report_number', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error("Erreur lors de la génération du PV:", error);
        setReportNumber(`${prefix}0001`);
        return;
      }

      let maxSeq = 0;
      if (data && data.length > 0) {
        data.forEach((item) => {
          if (item.report_number) {
            const parts = item.report_number.split('-');
            const seqStr = parts[parts.length - 1];
            const seqNum = parseInt(seqStr, 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        });
      }

      const nextSeq = String(maxSeq + 1).padStart(4, '0');
      setReportNumber(`${prefix}${nextSeq}`);
    } catch (e) {
      console.error(e);
      setReportNumber(`${prefix}0001`);
    }
  };

  const fetchStolenVehicles = async () => {
    const { data, error } = await supabase
      .from('stolen_vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVehicles(data);
    }
  };

  // Fonction pour déclencher l'impression
  const triggerPrint = (vehicleData) => {
    setPrintableVehicle(vehicleData);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Enregistrement unique qui déclenche ensuite l'impression
  const handleSaveAndPrint = async (e) => {
    if (e) e.preventDefault();
    setMessage(null);

    if (
      !ownerName.trim() ||
      !plateNumber.trim() ||
      !brand ||
      !model ||
      !stolenDate ||
      !reportNumber.trim()
    ) {
      setMessage({
        type: 'error',
        text: 'Veuillez remplir tous les champs obligatoires (*) avant d\'enregistrer.'
      });
      return;
    }

    setLoading(true);

    const newVehicle = {
      plate_number: plateNumber.trim().toUpperCase(),
      vin: vin.trim().toUpperCase() || null,
      brand: brand,
      model: model,
      color: color || null,
      owner_name: ownerName.trim(),
      report_number: reportNumber.trim(),
      stolen_date: stolenDate,
      status: 'STOLEN'
    };

    const { data, error } = await supabase
      .from('stolen_vehicles')
      .insert([newVehicle])
      .select();

    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement : ' + error.message });
    } else {
      const createdVehicle = (data && data[0]) ? data[0] : newVehicle;

      setMessage({ 
        type: 'success', 
        text: 'Engin enregistré avec succès ! Lancement de l\'impression du récépissé...' 
      });

      setPlateNumber('');
      setVin('');
      setBrand('');
      setModel('');
      setColor('');
      setOwnerName('');
      fetchStolenVehicles();
      generateNextReportNumber();

      triggerPrint(createdVehicle);
    }
    setLoading(false);
  };

  const handleMarkAsRecovered = async (vehicleId, plate) => {
    const confirmRecovery = window.confirm(`Voulez-vous vraiment marquer le véhicule plaque ${plate} comme retrouvé ? Il ne sera plus signalé aux agents.`);
    
    if (!confirmRecovery) return;

    setActionLoading(vehicleId);
    setMessage(null);

    const { data, error } = await supabase
      .from('stolen_vehicles')
      .update({ status: 'RECOVERED' })
      .eq('id', vehicleId)
      .select();

    if (error) {
      setMessage({ type: 'error', text: `Erreur lors de la mise à jour : ${error.message}` });
    } else if (!data || data.length === 0) {
      setMessage({ 
        type: 'error', 
        text: "Mise à jour bloquée. Vérifiez la règle RLS UPDATE dans Supabase." 
      });
    } else {
      setMessage({ type: 'success', text: `Le véhicule plaque ${plate} a été marqué comme retrouvé.` });
      fetchStolenVehicles();
    }
    setActionLoading(null);
  };

  const filteredVehicles = useMemo(() => {
    const q = registrySearch.trim().toLowerCase();
    if (!q) return vehicles;

    return vehicles.filter((v) => 
      (v.plate_number && v.plate_number.toLowerCase().includes(q)) ||
      (v.owner_name && v.owner_name.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q)) ||
      (v.brand && v.brand.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      (v.report_number && v.report_number.toLowerCase().includes(q))
    );
  }, [vehicles, registrySearch]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* IMPRESSION */}
      {printableVehicle && (
        <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:text-black print:p-8 print:z-[9999]">
          <div className="max-w-2xl mx-auto border-4 border-slate-900 p-8 rounded-lg relative">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-extrabold tracking-wider text-slate-900">KODACHECK</h1>
                <p className="text-xs uppercase font-bold text-slate-600 tracking-widest">Plateforme Nationale de Signalement d'Engins Volés</p>
              </div>
              <div className="text-right">
                <span className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1 uppercase rounded">Récépissé Officiel</span>
                <p className="text-xs text-slate-500 mt-1">Édité le : {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="text-center my-6">
              <h2 className="text-xl font-bold uppercase underline tracking-wide">Attestation d'Enregistrement de Plainte / Vol</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6 border p-4 rounded bg-slate-50">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Numéro de PV / Déclaration</p>
                <p className="font-bold font-mono text-base">{printableVehicle.report_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Date de déclaration du vol</p>
                <p className="font-bold">{printableVehicle.stolen_date}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 uppercase font-semibold">Propriétaire / Déclarant</p>
                <p className="font-bold text-base uppercase">{printableVehicle.owner_name}</p>
              </div>
            </div>

            <h3 className="font-bold text-sm uppercase text-slate-700 mb-2 border-b pb-1">Détails de l'engin recherché</h3>
            <div className="grid grid-cols-2 gap-y-3 text-sm mb-8">
              <div>
                <span className="text-slate-500">Immatriculation :</span>
                <p className="font-mono font-extrabold text-lg">{printableVehicle.plate_number}</p>
              </div>
              <div>
                <span className="text-slate-500">N° Châssis (VIN) :</span>
                <p className="font-mono font-bold">{printableVehicle.vin || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Marque & Modèle :</span>
                <p className="font-semibold">{printableVehicle.brand} {printableVehicle.model}</p>
              </div>
              <div>
                <span className="text-slate-500">Couleur :</span>
                <p className="font-semibold">{printableVehicle.color || 'Non précisée'}</p>
              </div>
            </div>

            <div className="border border-dashed border-slate-400 p-3 rounded text-xs text-slate-600 mb-8 bg-slate-50">
              Ce document atteste que l'engin désigné ci-dessus a été inscrit dans la base de données active de <strong>KODACHECK</strong>.
              Toutes les forces de l'ordre et agents de contrôle réseau sont informés et habilités à intercepter ce véhicule.
            </div>

            <div className="flex justify-between items-end mt-12 pt-4">
              <div className="text-center w-40 border-t border-slate-300 pt-1">
                <p className="text-xs text-slate-500">Signature du Déclarant</p>
              </div>
              <div className="text-center w-48 border-2 border-slate-800 p-2 rounded relative">
                <p className="text-xs font-bold uppercase text-slate-800">Cachet du Service</p>
                <div className="h-12 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">[ KODACHECK VALIDATED ]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD PRINCIPAL */}
      <div className="print:hidden flex flex-col flex-1">
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-7 h-7 text-blue-500 shrink-0" />
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-wider text-blue-400">KODACHECK</span>
                <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest -mt-1">Espace Admin</span>
              </div>
            </div>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-8">
          
          {/* Messages de Notification */}
          {message && (
            <div className={`p-4 rounded-xl flex items-start gap-3 text-sm animate-fadeIn ${
              message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
              <div>
                <p className="font-semibold">{message.type === 'success' ? 'Succès' : 'Erreur'}</p>
                <p className="text-sm opacity-90">{message.text}</p>
              </div>
            </div>
          )}

          {/* Formulaire d'ajout */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
              <PlusCircle className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold text-lg">Déclarer un nouvel engin volé</h2>
            </div>

            <form onSubmit={handleSaveAndPrint} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nom & Prénom du Propriétaire *</label>
                <input
                  type="text" required value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ex: Sawadogo Ousmane"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Plaque d'immatriculation *</label>
                <input
                  type="text" required value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="Ex: 11-JJ-4567"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">N° Châssis (VIN)</label>
                <input
                  type="text" value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  placeholder="Ex: VF3123..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* LISTES DÉROULANTES MARQUE ET MODÈLE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Marque *</label>
                  <select
                    required
                    value={brand}
                    onChange={handleBrandChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    {Object.keys(MARQUES_ET_MODELES).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Modèle *</label>
                  <select
                    required
                    disabled={!brand}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">{brand ? "Sélectionner..." : "Choisir marque d'abord"}</option>
                    {brand && MARQUES_ET_MODELES[brand]?.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LISTE DÉROULANTE COULEUR ET DATE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Couleur</label>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sélectionner...</option>
                    {COULEURS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Date du vol *</label>
                  <input
                    type="date" required value={stolenDate}
                    onChange={(e) => setStolenDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* PV AUTO-GÉNÉRÉ */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-slate-400">N° de PV / Déclaration</label>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono">
                    Auto-incrément
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={reportNumber || 'Génération...'}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-blue-400 font-mono font-bold cursor-not-allowed pr-10 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-1 md:flex md:items-end md:justify-end lg:mt-5">
                <button
                  type="submit"
                  disabled={loading || !reportNumber}
                  className="w-full px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 h-[50px]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <PackageCheck className="w-5 h-5" />
                      Enregistrer & Imprimer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Registre Général - CARDS SUR MOBILE / TABLE SUR ECRAN LARGE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex-1 flex flex-col">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <List className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-lg">Registre Général KODACHECK</h2>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                  {filteredVehicles.length} {registrySearch ? `/ ${vehicles.length}` : ''} engins
                </span>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  placeholder="Filtrer le registre..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-8 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                {registrySearch && (
                  <button
                    onClick={() => setRegistrySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex-1 flex flex-col items-center justify-center gap-3">
                <Truck className="w-12 h-12 opacity-30" />
                {registrySearch ? 'Aucune déclaration ne correspond à votre filtre.' : 'Aucun engin déclaré pour le moment.'}
              </div>
            ) : (
              <>
                {/* 1. VUE MOBILE: LISTE SOUS FORME DE CARTE (CARDS) */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {filteredVehicles.map((v) => (
                    <div key={v.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
                      
                      {/* Entête Card: Plaque + Statut */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">Plaque d'immatriculation</p>
                          <span className="font-mono font-extrabold text-xl text-white tracking-wide">{v.plate_number}</span>
                        </div>
                        <div>
                          {v.status === 'STOLEN' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                              RECHERCHÉ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-3.5 h-3.5" />
                              RETROUVÉ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Détails du véhicule */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-1">
                        <div className="flex items-center gap-1.5 text-slate-300 col-span-2">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-medium text-white">{v.owner_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300 col-span-2">
                          <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{v.brand} {v.model} <span className="text-slate-500">({v.color || 'N/A'})</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-mono">{v.stolen_date}</span>
                        </div>
                        <div className="flex items-center justify-end">
                          <span className="font-mono text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {v.report_number}
                          </span>
                        </div>
                      </div>

                      {/* Actions Carte Mobile */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 mt-1">
                        <button
                          onClick={() => triggerPrint(v)}
                          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          Récépissé
                        </button>

                        {v.status === 'STOLEN' ? (
                          <button
                            onClick={() => handleMarkAsRecovered(v.id, v.plate_number)}
                            disabled={actionLoading === v.id}
                            className="flex-1 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            {actionLoading === v.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Marquer Retrouvé
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600 font-medium italic text-right flex-1 pr-2">Dossier clos</span>
                        )}
                      </div>

                    </div>
                  ))}
                </div>

                {/* 2. VUE BUREAU / TABLETTE: TABLEAU TRADITIONNEL */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-4 rounded-l-lg">Statut</th>
                        <th className="p-4">Immatriculation</th>
                        <th className="p-4">Propriétaire</th>
                        <th className="p-4">Marque / Modèle</th>
                        <th className="p-4">Date Vol</th>
                        <th className="p-4">N° PV</th>
                        <th className="p-4 rounded-r-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredVehicles.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            {v.status === 'STOLEN' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                RECHERCHÉ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="w-3.5 h-3.5" />
                                RETROUVÉ
                              </span>
                            )}
                          </td>
                          
                          <td className="p-4 font-mono font-bold text-slate-100 text-base">{v.plate_number}</td>
                          <td className="p-4 font-medium text-slate-200">{v.owner_name}</td>
                          <td className="p-4 text-slate-300">{v.brand} {v.model} ({v.color || 'N/A'})</td>
                          <td className="p-4 text-slate-400 font-mono text-xs">{v.stolen_date}</td>
                          <td className="p-4 font-mono text-xs text-blue-400 bg-blue-500/5 px-2 py-1 rounded-md">{v.report_number}</td>
                          
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => triggerPrint(v)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
                                title="Réimprimer le récépissé"
                              >
                                <Printer className="w-4 h-4 text-emerald-400" />
                              </button>

                              {v.status === 'STOLEN' && (
                                <button
                                  onClick={() => handleMarkAsRecovered(v.id, v.plate_number)}
                                  disabled={actionLoading === v.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
                                >
                                  {actionLoading === v.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  Retrouvé ?
                                </button>
                              )}
                              {v.status === 'RECOVERED' && (
                                <span className="text-xs text-slate-600 font-medium italic">Dossier clos</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}