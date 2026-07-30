import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, PlusCircle, LogOut, AlertCircle, List, CheckCircle, PackageCheck, Truck, Loader2, Search, X } from 'lucide-react';

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  // Recherche dans le registre général
  const [registrySearch, setRegistrySearch] = useState('');

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
  }, []);

  const fetchStolenVehicles = async () => {
    const { data, error } = await supabase
      .from('stolen_vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVehicles(data);
    }
  };

  const handleAddStolenVehicle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from('stolen_vehicles')
      .insert([
        {
          plate_number: plateNumber.trim().toUpperCase(),
          vin: vin.trim().toUpperCase() || null,
          brand: brand.trim(),
          model: model.trim(),
          color: color.trim(),
          owner_name: ownerName.trim(),
          report_number: reportNumber.trim(),
          stolen_date: stolenDate,
          status: 'STOLEN'
        }
      ]);

    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement : ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Engin signalé volé avec succès !' });
      setPlateNumber('');
      setVin('');
      setBrand('');
      setModel('');
      setColor('');
      setOwnerName('');
      setReportNumber('');
      fetchStolenVehicles();
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

  // Filtrage dynamique des véhicules du registre
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
        
        {/* Alerts */}
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

          <form onSubmit={handleAddStolenVehicle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Marque *</label>
                <input
                  type="text" required value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Yamaha"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Modèle *</label>
                <input
                  type="text" required value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Sirius"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Couleur</label>
                <input
                  type="text" value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Noir"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                />
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

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">N° de PV / Déclaration *</label>
              <input
                type="text" required value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                placeholder="Ex: PV-2026-00891"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-1 md:flex md:items-end md:justify-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto md:px-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 lg:h-[50px] lg:mt-5"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackageCheck className="w-5 h-5" />}
                Enregistrer la déclaration
              </button>
            </div>
          </form>
        </div>

        {/* Registre Général */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex-1 flex flex-col">
          
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
            <div className="overflow-x-auto -mx-5 sm:-mx-0">
              <div className="inline-block min-w-full align-middle sm:px-0 px-5">
                <table className="w-full text-left text-sm min-w-[900px]">
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
                      <tr key={v.id} className="hover:bg-slate-800/40 transition-colors group">
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
                          {v.status === 'STOLEN' && (
                            <button
                              onClick={() => handleMarkAsRecovered(v.id, v.plate_number)}
                              disabled={actionLoading === v.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50"
                              title="Marquer comme retrouvé et clore le signalement"
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}