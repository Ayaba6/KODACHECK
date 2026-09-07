import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
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

  // Formulaire Création Commissariat
  const [commForm, setCommForm] = useState({ code: '', nom: '', ville: '', region: '' });
  
  // Formulaire Création Commissaire
  const [commissaireForm, setCommissaireForm] = useState({
    email: '',
    password: '',
    full_name: '',
    commissariat_id: ''
  });

  // États pour la modification & Modal
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
      console.error('Erreur lors de la récupération des commissariats:', error);
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

    const { error } = await supabase.from('commissariats').insert([commForm]).select();

    if (error) {
      const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      setMessage({ type: 'error', text: errorMsg });
    } else {
      setMessage({ type: 'success', text: 'Commissariat créé avec succès !' });
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const validCommissariatId = commissaireForm.commissariat_id.trim() !== '' 
        ? commissaireForm.commissariat_id 
        : null;

      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
      });

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
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

      if (authData?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert([
          {
            id: authData.user.id,
            full_name: commissaireForm.full_name.trim(),
            role: 'commissaire',
            commissariat_id: validCommissariatId
          }
        ]);

        if (profileError) {
          console.warn('Note sur la mise à jour du profil :', profileError);
        }
      }

      setMessage({ type: 'success', text: `Compte Commissaire créé pour ${commissaireForm.email}` });
      setCommissaireForm({ email: '', password: '', full_name: '', commissariat_id: '' });

    } catch (err) {
      let errorMessage = "Une erreur est survenue lors de la création.";
      if (err?.message) errorMessage = err.message;
      else if (typeof err === 'string') errorMessage = err;
      setMessage({ type: 'error', text: errorMessage });
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
    setCommissaireName(null);

    try {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('commissariat_id', commissariat.id);

      if (!countError) {
        setAgentCount(count || 0);
      } else {
        setAgentCount(0);
      }

      const { data: commissaireData, error: commError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('commissariat_id', commissariat.id)
        .eq('role', 'commissaire')
        .maybeSingle();

      if (!commError && commissaireData) {
        setCommissaireName(commissaireData.full_name);
      } else {
        setCommissaireName('Non attribué');
      }

    } catch (err) {
      console.error("Erreur lors du chargement des informations :", err);
      setAgentCount(0);
      setCommissaireName('Non attribué');
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

      setMessage({ type: 'success', text: 'Commissariat mis à jour avec succès !' });
      setSelectedComm(null);
      fetchCommissariats();
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la mise à jour' });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto transition-colors duration-200">
      
      {/* En-tête de la page */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2.5 sm:p-3 bg-red-500/10 dark:bg-red-600/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-500 shrink-0">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              Espace Super Admin
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
              Gestion globale ({user?.email || profile?.email})
            </p>
          </div>
        </div>

        {/* Action Controls : Dark/Light Switch + Bouton Déconnexion */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Bouton Dark/Light fonctionnel via props */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
            title={darkMode ? "Passer au mode clair" : "Passer au mode sombre"}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>

          {/* Bouton Déconnexion */}
          <button
            type="button"
            onClick={handleLogout}
            title="Déconnexion"
            className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-800/50 p-2.5 sm:px-4 sm:py-2.5 rounded-xl transition-all text-sm font-semibold shadow-sm"
          >
            <LogOut className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-400 group-hover:text-red-600" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>

        </div>
      </div>

      {/* Messages d'alerte */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
            : 'bg-red-500/10 dark:bg-red-950/40 border-red-500/30 text-red-700 dark:text-red-400'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formulaires d'actions principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        
        {/* Formulaire 1 : Créer un Commissariat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl space-y-5 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-bold text-base sm:text-lg border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <Building2 className="w-5 h-5" />
            <h2>Nouveau Commissariat</h2>
          </div>

          <form onSubmit={handleCreateCommissariat} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Code d'identification</label>
              <input
                type="text"
                placeholder="Ex: CMP-OUA-01"
                value={commForm.code}
                onChange={(e) => setCommForm({ ...commForm, code: e.target.value.toUpperCase() })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom du Commissariat</label>
              <input
                type="text"
                placeholder="Ex: Commissariat Central de Ouagadougou"
                value={commForm.nom}
                onChange={(e) => setCommForm({ ...commForm, nom: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Ville</label>
                <input
                  type="text"
                  placeholder="Ex: Ouagadougou"
                  value={commForm.ville}
                  onChange={(e) => setCommForm({ ...commForm, ville: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Région</label>
                <input
                  type="text"
                  placeholder="Ex: Centre"
                  value={commForm.region}
                  onChange={(e) => setCommForm({ ...commForm, region: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2 text-white shadow-sm text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>Enregistrer le Commissariat</span>
            </button>
          </form>
        </div>

        {/* Formulaire 2 : Créer un Commissaire */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl space-y-5 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400 font-bold text-base sm:text-lg border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <UserPlus className="w-5 h-5" />
            <h2>Nouveau Commissaire</h2>
          </div>

          <form onSubmit={handleCreateCommissaire} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom complet</label>
              <input
                type="text"
                placeholder="Ex: Commissaire Traoré Youssouf"
                value={commissaireForm.full_name}
                onChange={(e) => setCommissaireForm({ ...commissaireForm, full_name: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Adresse Email</label>
                <input
                  type="email"
                  placeholder="commissaire@police.bf"
                  value={commissaireForm.email}
                  onChange={(e) => setCommissaireForm({ ...commissaireForm, email: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
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
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Affectation Commissariat</label>
              <select
                value={commissaireForm.commissariat_id}
                onChange={(e) => setCommissaireForm({ ...commissaireForm, commissariat_id: e.target.value })}
                required
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="">-- Sélectionner un commissariat --</option>
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
              className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2 text-white shadow-sm text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Créer le compte Commissaire</span>
            </button>
          </form>
        </div>

      </div>

      {/* Liste des Commissariats Déployés */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 rounded-2xl space-y-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-500" />
            <span>Commissariats Déployés</span>
            <span className="ml-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
              {commissariats.length}
            </span>
          </h2>
        </div>

        {commissariats.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <Building2 className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aucun commissariat configuré pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commissariats.map((c) => (
              <div 
                key={c.id} 
                onClick={() => handleOpenEditModal(c)}
                className="p-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-500/50 rounded-xl flex items-start justify-between gap-3 cursor-pointer transition-all group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold border border-blue-200 dark:border-blue-700/50 shrink-0">
                        {c.code}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate">{c.nom}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{c.ville} {c.region ? `(${c.region})` : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="p-1.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL MODIFICATION ET INFORMATIONS */}
      {selectedComm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Fiche du Commissariat</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {selectedComm.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedComm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                  <span>Commissaire</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                  {loadingModalData ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 my-1" />
                  ) : (
                    commissaireName || 'Non attribué'
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>Effectif (Agents)</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {loadingModalData ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 my-1" />
                  ) : (
                    `${agentCount} agent(s)`
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateCommissariat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Code</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom du Commissariat</label>
                <input
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Ville</label>
                  <input
                    type="text"
                    value={editForm.ville}
                    onChange={(e) => setEditForm({ ...editForm, ville: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Région</label>
                  <input
                    type="text"
                    value={editForm.region}
                    onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedComm(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
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