import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, PlusCircle, LogOut, Check, AlertCircle, List } from 'lucide-react';

export default function AdminDashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Champs du formulaire
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [ownerName, setOwnerName] = useState(''); // Nouveau champ
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
          owner_name: ownerName.trim(), // Enregistrement du nom du propriétaire
          report_number: reportNumber.trim(),
          stolen_date: stolenDate,
          status: 'STOLEN'
        }
      ]);

    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement : ' + error.message });
    } else {
      setMessage({ type: 'success', text: 'Engin signalé volé avec succès !' });
      // Réinitialisation
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

  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <span className="font-bold text-lg">Portail d'Administration - Sécurité Routière</span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulaire */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <PlusCircle className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-lg">Déclarer un engin volé</h2>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
              message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleAddStolenVehicle} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nom & Prénom du Propriétaire *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex: Sawadogo Ousmane"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Plaque d'immatriculation *</label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="Ex: 11-JJ-4567"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">N° Châssis (VIN)</label>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                placeholder="Ex: VF31234567890ABCD"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Marque *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Yamaha"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Modèle *</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Sirius"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Couleur</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Noir"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Date du vol *</label>
                <input
                  type="date"
                  required
                  value={stolenDate}
                  onChange={(e) => setStolenDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">N° de PV / Déclaration *</label>
              <input
                type="text"
                required
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                placeholder="Ex: PV-2026-00891"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer le vol'}
            </button>
          </form>
        </div>

        {/* Tableau d'affichage */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <List className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-lg">Registre des Engins Signalés Volés ({vehicles.length})</h2>
          </div>

          {vehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Aucun engin signalé pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-3">Immatriculation</th>
                    <th className="p-3">Propriétaire</th>
                    <th className="p-3">Marque / Modèle</th>
                    <th className="p-3">Date Vol</th>
                    <th className="p-3">N° PV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-red-400">{v.plate_number}</td>
                      <td className="p-3 font-semibold text-white">{v.owner_name || 'Non renseigné'}</td>
                      <td className="p-3">{v.brand} {v.model} ({v.color || 'N/A'})</td>
                      <td className="p-3 text-slate-400">{v.stolen_date}</td>
                      <td className="p-3 font-mono text-xs text-blue-400">{v.report_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}