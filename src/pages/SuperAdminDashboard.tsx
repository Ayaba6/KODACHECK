import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Building2, 
  UserPlus, 
  Shield, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  MapPin, 
  LogOut, 
  Edit3, 
  Users, 
  X, 
  Save,
  UserCheck,
  Sun,
  Moon
} from 'lucide-react';

export default function SuperAdminDashboard({ user, profile, darkMode, toggleTheme }) {
  const [commissariats, setCommissariats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Formulaires
  const [commForm, setCommForm] = useState({ code: '', nom: '', ville: '', region: '' });
  const [commissaireForm, setCommissaireForm] = useState({
    email: '',
    password: '',
    full_name: '',
    commissariat_id: ''
  });

  // Modal Modification
  const [selectedComm, setSelectedComm] = useState(null);
  const [editForm, setEditForm] = useState({ id: '', code: '', nom: '', ville: '', region: '' });
  const [agentCount, setAgentCount] = useState(0);
  const [commissaireName, setCommissaireName] = useState(null);
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchCommissariats();
  }, []);

  const fetchCommissariats = async () => {
    const { data, error } = await supabase
      .from('commissariats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement commissariats:', error);
    } else if (data) {
      setCommissariats(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCreateCommissariat = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formattedCode = commForm.code.trim().toUpperCase();

    const { error } = await supabase.from('commissariats').insert([{
      ...commForm,
      code: formattedCode
    }]);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la création.' });
    } else {
      setMessage({ type: 'success', text: `Commissariat [${formattedCode}] créé avec succès !` });
      setCommForm({ code: '', nom: '', ville: '', region: '' });
      fetchCommissariats();
    }
    setLoading(false);
  };

  const handleCreateCommissaire = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const validCommissariatId = commissaireForm.commissariat_id.trim() || null;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: commissaireForm.email.trim(),
        password: commissaireForm.password,
        options: {
          data: {
            full_name: commissaireForm.full_name.trim(),
            role: 'commissaire',
            commissariat_id: validCommissariatId
          }
        }
      });

      if (authError) throw authError;

      // Secours si le trigger SQL n'est pas configuré sur Supabase
      if (authData?.user) {
        await supabase.from('profiles').upsert([{
          id: authData.user.id,
          full_name: commissaireForm.full_name.trim(),
          role: 'commissaire',
          commissariat_id: validCommissariatId
        }]);
      }

      setMessage({ type: 'success', text: `Compte Commissaire créé pour ${commissaireForm.email}` });
      setCommissaireForm({ email: '', password: '', full_name: '', commissariat_id: '' });

    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la création du commissaire.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = async (commissariat) => {
    setSelectedComm(commissariat);
    setEditForm({
      id: commissariat.id,
      code: commissariat.code || '',
      nom: commissariat.nom || '',
      ville: commissariat.ville || '',
      region: commissariat.region || ''
    });
    setLoadingModalData(true);

    try {
      // Compter les agents liés à ce commissariat
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('commissariat_id', commissariat.id);

      setAgentCount(count || 0);

      // Trouver le commissaire responsable
      const { data: commissaireData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('commissariat_id', commissariat.id)
        .eq('role', 'commissaire')
        .maybeSingle();

      setCommissaireName(commissaireData ? commissaireData.full_name : 'Non attribué');

    } catch (err) {
      console.error('Erreur chargement modal:', err);
    } finally {
      setLoadingModalData(false);
    }
  };

  const handleUpdateCommissariat = async (e) => {
    e.preventDefault();
    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from('commissariats')
        .update({
          code: editForm.code.toUpperCase(),
          nom: editForm.nom,
          ville: editForm.ville,
          region: editForm.region
        })
        .eq('id', editForm.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Commissariat mis à jour !' });
      setSelectedComm(null);
      fetchCommissariats();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erreur de mise à jour' });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-500">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Espace Super Admin
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Gestion globale ({user?.email || profile?.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:text-red-600 border border-slate-200 dark:border-slate-800 p-2.5 sm:px-4 rounded-xl text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Message d'Alerte */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="hover:opacity-75"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Formulaires d'Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Création Commissariat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building2 className="w-5 h-5" />
            <h2>Nouveau Commissariat</h2>
          </div>

          <form onSubmit={handleCreateCommissariat} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Code d'identification (ex: CMP-OUA-01)</label>
              <input
                type="text"
                placeholder="CMP-OUA-01"
                value={commForm.code}
                onChange={(e) => setCommForm({ ...commForm, code: e.target.value.toUpperCase() })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom du Commissariat</label>
              <input
                type="text"
                placeholder="Commissariat Central de Ouagadougou"
                value={commForm.nom}
                onChange={(e) => setCommForm({ ...commForm, nom: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Ville</label>
                <input
                  type="text"
                  placeholder="Ouagadougou"
                  value={commForm.ville}
                  onChange={(e) => setCommForm({ ...commForm, ville: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Région</label>
                <input
                  type="text"
                  placeholder="Centre"
                  value={commForm.region}
                  onChange={(e) => setCommForm({ ...commForm, region: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-xl flex justify-center items-center gap-2 text-white text-sm transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>Enregistrer le Commissariat</span>
            </button>
          </form>
        </div>

        {/* Création Commissaire */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
            <UserPlus className="w-5 h-5" />
            <h2>Nouveau Commissaire (Chef de poste)</h2>
          </div>

          <form onSubmit={handleCreateCommissaire} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom complet</label>
              <input
                type="text"
                placeholder="Commissaire TRAORE Youssouf"
                value={commissaireForm.full_name}
                onChange={(e) => setCommissaireForm({ ...commissaireForm, full_name: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="commissaire@police.bf"
                  value={commissaireForm.email}
                  onChange={(e) => setCommissaireForm({ ...commissaireForm, email: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={commissaireForm.password}
                  onChange={(e) => setCommissaireForm({ ...commissaireForm, password: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Commissariat à attribuer</label>
              <select
                value={commissaireForm.commissariat_id}
                onChange={(e) => setCommissaireForm({ ...commissaireForm, commissariat_id: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="">-- Sélectionner --</option>
                {commissariats.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.nom} ({c.ville})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-xl flex justify-center items-center gap-2 text-white text-sm transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Créer le compte Commissaire</span>
            </button>
          </form>
        </div>

      </div>

      {/* Liste des Commissariats */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-500" />
          <span>Commissariats Déployés</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono">
            {commissariats.length}
          </span>
        </h2>

        {commissariats.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">Aucun commissariat enregistré.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commissariats.map((c) => (
              <div 
                key={c.id} 
                onClick={() => handleOpenEditModal(c)}
                className="p-4 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start justify-between cursor-pointer transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                      {c.code}
                    </span>
                    <span className="font-bold text-sm truncate">{c.nom}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{c.ville} {c.region ? `(${c.region})` : ''}</span>
                  </div>
                </div>
                <Edit3 className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Edition */}
      {selectedComm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b pb-3 dark:border-slate-800">
              <h3 className="font-bold text-lg">Détails Commissariat</h3>
              <button onClick={() => setSelectedComm(null)} className="hover:opacity-75"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-slate-500 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-purple-500" /> Commissaire</span>
                <p className="font-bold text-sm mt-1">{loadingModalData ? '...' : commissaireName}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-blue-500" /> Total Effectif</span>
                <p className="font-bold text-sm mt-1">{loadingModalData ? '...' : `${agentCount} personne(s)`}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateCommissariat} className="space-y-3">
              <div>
                <label className="text-xs font-semibold">Code</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2.5 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Nom</label>
                <input
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Ville</label>
                  <input
                    type="text"
                    value={editForm.ville}
                    onChange={(e) => setEditForm({ ...editForm, ville: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Région</label>
                  <input
                    type="text"
                    value={editForm.region}
                    onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedComm(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}