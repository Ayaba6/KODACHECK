import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { 
  UserCheck, 
  Users, 
  Shield, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  BadgeCheck, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  Car, 
  Calendar, 
  FileText,
  LogOut,
  Trash2,
  Sun,
  Moon
} from 'lucide-react';

export default function CommissaireDashboard() {
  const [currentCommissariat, setCurrentCommissariat] = useState(null);
  const [agents, setAgents] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [activeTab, setActiveTab] = useState('vols');
  const [loading, setLoading] = useState(false);
  const [loadingDeclarations, setLoadingDeclarations] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState(null);

  // État pour gérer le mode sombre/clair localement
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || 
           localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Formulaire Agent
  const [agentForm, setAgentForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'AGENT_TERRAIN'
  });

  useEffect(() => {
    loadCommissaireContext();
  }, []);

  const loadCommissaireContext = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('commissariat_id, commissariats(*)')
      .eq('id', user.id)
      .single();

    if (profile?.commissariats) {
      setCurrentCommissariat(profile.commissariats);
      fetchAgents(profile.commissariat_id);
      fetchDeclarations(profile.commissariat_id);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error("Erreur lors de la déconnexion :", err);
    }
  };

  const fetchAgents = async (commissariatId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('commissariat_id', commissariatId)
      .in('role', ['AGENT_TERRAIN', 'AGENT_BUREAU', 'AGENT', 'agent_terrain', 'agent_bureau'])
      .order('created_at', { ascending: false });
    
    if (data) setAgents(data);
  };

  // Récupération des engins depuis 'stolen_vehicles' liés à ce commissariat
  const fetchDeclarations = async (commissariatId) => {
    setLoadingDeclarations(true);
    try {
      const { data, error } = await supabase
        .from('stolen_vehicles')
        .select('*')
        .eq('commissariat_id', commissariatId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setDeclarations(data);
    } catch (err) {
      console.error("Erreur chargement déclarations :", err);
    } finally {
      setLoadingDeclarations(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!currentCommissariat?.id) {
        throw new Error("Impossible de déterminer le commissariat de rattachement.");
      }

      // 1. Création de l'utilisateur dans Supabase Auth via l'API Admin
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: agentForm.email.trim(),
        password: agentForm.password,
        email_confirm: true,
        user_metadata: {
          full_name: agentForm.full_name.trim(),
          role: agentForm.role,
          commissariat_id: currentCommissariat.id
        }
      });

      if (authError) throw authError;

      // 2. Création/Mise à jour du profil correspondant dans la table 'profiles'
      if (authData?.user) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: agentForm.email.trim(),
            full_name: agentForm.full_name.trim(),
            role: agentForm.role,
            commissariat_id: currentCommissariat.id,
            updated_at: new Date().toISOString()
          });

        if (profileError) throw profileError;
      }

      setMessage({ 
        type: 'success', 
        text: `Compte ${agentForm.role} créé avec succès pour ${agentForm.full_name} !` 
      });
      
      setAgentForm({ email: '', password: '', full_name: '', role: 'AGENT_TERRAIN' });
      fetchAgents(currentCommissariat.id);

    } catch (err) {
      console.error("Erreur création agent :", err);
      setMessage({ type: 'error', text: err.message || "Erreur lors de la création du compte." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agent) => {
    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir retirer l'agent ${agent.full_name || agent.email} de ce commissariat ?`
    );

    if (!confirmDelete) return;

    setDeletingId(agent.id);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ commissariat_id: null })
        .eq('id', agent.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `L'agent ${agent.full_name || agent.email} a été retiré de l'effectif.`
      });

      setAgents(agents.filter(a => a.id !== agent.id));
    } catch (err) {
      console.error("Erreur lors du retrait de l'agent :", err);
      setMessage({
        type: 'error',
        text: err.message || "Impossible de retirer cet agent."
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Filtrage basé sur le champ 'status' de stolen_vehicles ('STOLEN' / 'RECOVERED')
  const declarationsVols = declarations.filter(
    (d) => !d.status || d.status.toUpperCase() === 'STOLEN'
  );

  const declarationsRetrouves = declarations.filter(
    (d) => d.status && d.status.toUpperCase() === 'RECOVERED'
  );

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-6xl mx-auto transition-colors duration-200 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
      
      {/* En-tête avec détails du commissariat, Mode Sombre/Clair & Déconnexion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-purple-500/10 dark:bg-purple-600/10 border border-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Espace Commissaire</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Gestion des effectifs, affectations et suivi des déclarations</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {currentCommissariat && (
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2 rounded-xl text-left sm:text-right flex-1 sm:flex-initial">
              <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 block font-mono font-bold">{currentCommissariat.code}</span>
              <span className="text-xs sm:text-sm font-bold truncate block max-w-[200px] sm:max-w-none">{currentCommissariat.nom}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Bouton Toggle Dark/Light Mode */}
            <button
              onClick={toggleTheme}
              title="Changer de mode (Clair / Sombre)"
              className="p-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl transition-all"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Bouton Déconnexion */}
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      {/* Message d'état */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' 
            : 'bg-red-500/10 dark:bg-red-950/40 border-red-500/30 text-red-700 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* SECTION DU HAUT : FORMULAIRE ET EFFECTIFS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Formulaire de création d'Agent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-semibold text-lg">
            <UserCheck className="w-5 h-5" />
            <h2>Créer un compte Agent</h2>
          </div>

          <form onSubmit={handleCreateAgent} className="space-y-4">
            <input
              type="text"
              placeholder="Nom complet de l'agent"
              value={agentForm.full_name}
              onChange={(e) => setAgentForm({ ...agentForm, full_name: e.target.value })}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="email"
              placeholder="Adresse Email"
              value={agentForm.email}
              onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="password"
              placeholder="Mot de passe temporaire"
              value={agentForm.password}
              onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />

            <div className="space-y-1">
              <label className="text-xs text-slate-500 dark:text-slate-400">Fonction de l'agent :</label>
              <select
                value={agentForm.role}
                onChange={(e) => setAgentForm({ ...agentForm, role: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="AGENT_TERRAIN">Agent de Terrain (Contrôle / Patrouille)</option>
                <option value="AGENT_BUREAU">Agent de Bureau (Saisie / Registre)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !currentCommissariat}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Valider et enregistrer l'agent
            </button>
          </form>
        </div>

        {/* Liste des Agents du Commissariat */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-300 font-semibold text-lg">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2>Effectifs enregistrés</h2>
            </div>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-700">
              {agents.length} agent(s)
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {agents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">Aucun agent enregistré pour ce commissariat.</p>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl flex justify-between items-center gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{agent.full_name || 'Agent'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.email}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {agent.role?.toUpperCase() === 'AGENT_TERRAIN' ? (
                      <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <Radio className="w-3 h-3" /> TERRAIN
                      </span>
                    ) : (
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3" /> BUREAU
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteAgent(agent)}
                      disabled={deletingId === agent.id}
                      title="Retirer / Muter cet agent"
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === agent.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* SECTION DU BAS : DÉCLARATIONS DE VOLS & RETROUVÉS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm dark:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Registre des Déclarations du Commissariat
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Consultez et suivez l'état des véhicules enregistrés</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('vols')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'vols'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Déclarations de Vols
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                {declarationsVols.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('retrouves')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'retrouves'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Déclarés Retrouvés
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                {declarationsRetrouves.length}
              </span>
            </button>
          </div>
        </div>

        {/* ONGLET 1 : DÉCLARATIONS DE VOLS */}
        {activeTab === 'vols' && (
          <div className="space-y-3">
            {loadingDeclarations ? (
              <div className="flex justify-center py-12 text-slate-500 gap-2 items-center text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-red-500 dark:text-red-400" />
                Chargement des déclarations de vols...
              </div>
            ) : declarationsVols.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                <Car className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Aucun véhicule volé en cours pour ce commissariat.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {declarationsVols.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-red-900/30 hover:border-red-400 dark:hover:border-red-600/50 rounded-xl space-y-3 transition-colors shadow-sm dark:shadow-none"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-lg">
                          {item.plate_number || 'SANS PLAQUE'}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                          {item.brand} {item.model}
                        </h3>
                      </div>
                      <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> VOLÉ
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-900 pt-2">
                      <p><strong className="text-slate-700 dark:text-slate-300">N° de PV :</strong> <span className="font-mono text-blue-500">{item.report_number || 'N/C'}</span></p>
                      <p><strong className="text-slate-700 dark:text-slate-300">Châssis (VIN) :</strong> <span className="font-mono">{item.vin || 'N/C'}</span></p>
                      <p><strong className="text-slate-700 dark:text-slate-300">Couleur :</strong> {item.color || 'N/C'}</p>
                      <p><strong className="text-slate-700 dark:text-slate-300">Propriétaire :</strong> {item.owner_name || 'N/C'}</p>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-900">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        Volé le : {item.stolen_date || new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ONGLET 2 : DÉCLARÉS RETROUVÉS */}
        {activeTab === 'retrouves' && (
          <div className="space-y-3">
            {loadingDeclarations ? (
              <div className="flex justify-center py-12 text-slate-500 gap-2 items-center text-sm">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-500 dark:text-emerald-400" />
                Chargement des véhicules retrouvés...
              </div>
            ) : declarationsRetrouves.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                <CheckCircle2 className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Aucun véhicule marqué comme retrouvé pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {declarationsRetrouves.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-emerald-900/30 hover:border-emerald-400 dark:hover:border-emerald-600/50 rounded-xl space-y-3 transition-colors shadow-sm dark:shadow-none"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                          {item.plate_number || 'SANS PLAQUE'}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                          {item.brand} {item.model}
                        </h3>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> RETROUVÉ
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-900 pt-2">
                      <p><strong className="text-slate-700 dark:text-slate-300">N° de PV :</strong> <span className="font-mono text-blue-500">{item.report_number || 'N/C'}</span></p>
                      <p><strong className="text-slate-700 dark:text-slate-300">Châssis (VIN) :</strong> <span className="font-mono">{item.vin || 'N/C'}</span></p>
                      <p><strong className="text-slate-700 dark:text-slate-300">Propriétaire :</strong> {item.owner_name || 'N/C'}</p>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-900">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        Enregistré le : {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Dossier Clôturé</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}