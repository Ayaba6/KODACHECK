import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { localDb } from '../lib/db';
import { syncVehiclesWithLocalDB } from '../lib/syncService';
import { 
  Search, Camera, CheckCircle, LogOut, ShieldAlert, Wifi, WifiOff, 
  RefreshCw, Bell, X, List, ChevronRight, AlertTriangle, Shield, User, Sun, Moon,
  Car, Hash, Building2
} from 'lucide-react';
import CameraScanner from '../components/CameraScanner';

// ==========================================
// 1. CUSTOM HOOK AMÉLIORÉ (Recherche & Temps Réel)
// ==========================================
function useAgentDashboard(searchTerm: string) {
  const [loading, setLoading] = useState(false);
  const [recentStolen, setRecentStolen] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem('last_sync_time') || 'Jamais');
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  const loadRecentStolen = useCallback(async (query = searchTerm) => {
    setLoading(true);
    const cleanQuery = query.trim().toUpperCase();

    try {
      if (navigator.onLine) {
        let req = supabase
          .from('stolen_vehicles')
          .select(`
            *,
            commissariats:commissariat_id (
              nom,
              code
            )
          `)
          .eq('status', 'STOLEN')
          .order('created_at', { ascending: false });

        if (cleanQuery) {
          req = req.or(`plate_number.ilike.%${cleanQuery}%,vin.ilike.%${cleanQuery}%,owner_name.ilike.%${cleanQuery}%,report_number.ilike.%${cleanQuery}%`);
        }

        const { data, error } = await req.limit(50);
        if (!error && data) setRecentStolen(data);
      } else {
        // Mode Hors-ligne via Dexie (localDb)
        const allLocal = await localDb.stolen_vehicles.toArray();
        let stolenOnly = allLocal.filter((v: any) => v.status === 'STOLEN');

        if (cleanQuery) {
          stolenOnly = stolenOnly.filter(
            (v: any) =>
              (v.plate_number && v.plate_number.toUpperCase().includes(cleanQuery)) ||
              (v.vin && v.vin.toUpperCase().includes(cleanQuery)) ||
              (v.owner_name && v.owner_name.toUpperCase().includes(cleanQuery)) ||
              (v.report_number && v.report_number.toUpperCase().includes(cleanQuery))
          );
        }
        stolenOnly.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setRecentStolen(stolenOnly.slice(0, 50));
      }
    } catch (err) {
      console.error('Erreur chargement données :', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => loadRecentStolen(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm, loadRecentStolen]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Écoute Supabase Realtime robuste sur la table stolen_vehicles
    const channel = supabase
      .channel('public:stolen_vehicles_agent')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stolen_vehicles' },
        async (payload) => {
          const newVehicle = payload.new;
          if (newVehicle && (!newVehicle.status || newVehicle.status === 'STOLEN')) {
            // Récupérer le nom de l'unité émettrice pour enrichir l'alerte
            const { data: commData } = await supabase
              .from('commissariats')
              .select('nom, code')
              .eq('id', newVehicle.commissariat_id)
              .single();

            const enrichedVehicle = {
              ...newVehicle,
              commissariats: commData || { nom: 'Unité Nationale', code: 'NAT' }
            };

            setRealtimeAlerts((prev) => [enrichedVehicle, ...prev]);
            
            // Sauvegarde en base locale si Dexie est disponible
            try {
              await localDb.stolen_vehicles.put(newVehicle);
            } catch (e) {
              console.error("Erreur sauvegarde locale:", e);
            }

            loadRecentStolen(searchTerm);
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, [searchTerm, loadRecentStolen]);

  const handleSync = async () => {
    setIsSyncing(true);
    const success = await syncVehiclesWithLocalDB();
    if (success) {
      const updatedTime = localStorage.getItem('last_sync_time');
      setLastSync(updatedTime || new Date().toLocaleString('fr-FR'));
      loadRecentStolen(searchTerm);
    }
    setIsSyncing(false);
  };

  return { loading, recentStolen, isOnline, isSyncing, lastSync, realtimeAlerts, setRealtimeAlerts, handleSync };
}

// ==========================================
// 2. COMPOSANT FICHE VÉHICULE DÉTAILLÉE
// ==========================================
function VehicleCardDetail({ vehicle, isDarkMode, onClose }: { vehicle: any; isDarkMode: boolean; onClose?: () => void }) {
  if (!vehicle) {
    return (
      <div className={`h-full min-h-[220px] flex flex-col items-center justify-center border rounded-2xl p-6 text-center border-dashed ${
        isDarkMode ? 'bg-slate-900/30 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-400'
      }`}>
        <Car className="w-10 h-10 mb-2 opacity-40" />
        <p className="font-semibold text-xs">Sélectionnez un engin pour voir les détails complets</p>
      </div>
    );
  }

  return (
    <div className={`border rounded-2xl p-4 shadow-xl relative transition-all ${
      isDarkMode ? 'bg-slate-900 border-red-500/40 text-white' : 'bg-white border-red-300 text-slate-900'
    }`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-500/10 hover:bg-slate-500/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 text-red-500">
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">ENGIN SIGNALÉ VOLÉ</h3>
            <p className="text-[11px] font-mono text-red-400">PV N° : {vehicle.report_number || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="my-3 text-center">
        <div className="inline-block bg-amber-400 border-2 border-slate-950 text-slate-950 font-mono font-black text-xl tracking-widest px-4 py-1 rounded-xl shadow">
          {vehicle.plate_number}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
          <User className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Propriétaire</span>
            <span className="font-semibold truncate block">{vehicle.owner_name || 'Non renseigné'}</span>
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
          <Car className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Marque & Modèle</span>
            <span className="font-semibold truncate block">{vehicle.brand} {vehicle.model}</span>
          </div>
        </div>

        {vehicle.vin && (
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
            <Hash className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">VIN / N° Châssis</span>
              <span className="font-mono font-bold text-[11px] truncate block">{vehicle.vin}</span>
            </div>
          </div>
        )}

        {vehicle.commissariats?.nom && (
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
            <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Service Déclarant</span>
              <span className="font-semibold text-xs truncate block">{vehicle.commissariats.nom}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. COMPOSANT PRINCIPAL
// ==========================================
export default function AgentterrainDashboard({ onLogout }: { onLogout?: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [agentProfile, setAgentProfile] = useState<any | null>(null);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);

  const {
    loading,
    recentStolen,
    isOnline,
    isSyncing,
    realtimeAlerts,
    setRealtimeAlerts,
    handleSync
  } = useAgentDashboard(searchTerm);

  useEffect(() => {
    fetchAgentProfile();
  }, []);

  const fetchAgentProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name, badge_number, commissariats(nom, code)')
        .eq('id', user.id)
        .single();

      if (data) setAgentProfile(data);
    } catch (err) {
      console.error('Erreur chargement profil :', err);
    }
  };

  const handleSignOut = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* Notifications Flottantes (Toasts en temps réel) */}
      {realtimeAlerts.length > 0 && (
        <div className="fixed top-20 right-3 left-3 sm:left-auto sm:right-4 sm:w-80 z-50 space-y-2">
          {realtimeAlerts.slice(0, 3).map((alert, idx) => (
            <div key={alert.id || idx} className="bg-red-600 text-white p-3 rounded-2xl shadow-2xl border border-red-400 flex items-center justify-between gap-2 animate-bounce">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-5 h-5 shrink-0 animate-pulse text-amber-300" />
                <div className="text-xs min-w-0">
                  <p className="font-black uppercase tracking-tight">ALERTE VOL ({alert.commissariats?.code || 'NAT'})</p>
                  <p className="font-mono font-bold text-amber-200 truncate">Plaque: {alert.plate_number}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={() => {
                    setSelectedVehicle(alert);
                    setRealtimeAlerts(prev => prev.filter(a => a.id !== alert.id));
                  }} 
                  className="px-2 py-1 bg-white text-red-600 rounded-lg text-[10px] font-black shadow hover:bg-slate-100 transition-colors"
                >
                  VOIR
                </button>
                <button 
                  onClick={() => setRealtimeAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  className="p-1 text-white/80 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header Mobile & Desktop Ultra Responsive */}
      <header className={`border-b px-3 sm:px-6 py-3 sticky top-0 z-40 backdrop-blur-md ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Ligne 1 / Gauche : Logo, Badge & Infos Agent */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-blue-500 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-sm sm:text-base tracking-tight leading-none">KODACHECK</h1>
                  {agentProfile?.badge_number && (
                    <span className="text-[9px] font-mono font-bold bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/25 shrink-0">
                      {agentProfile.badge_number}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate max-w-[220px] sm:max-w-none">
                  <User className="w-3 h-3 inline shrink-0" /> <span className="truncate">{agentProfile?.full_name || 'Agent Terrain'}</span>
                  {agentProfile?.commissariats?.nom && (
                    <>
                      <span className="shrink-0">•</span>
                      <Building2 className="w-3 h-3 inline shrink-0" /> <span className="truncate">{agentProfile.commissariats.nom}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Boutons d'actions directs sur mobile pour éviter le débordement */}
            <div className="flex items-center gap-1 sm:hidden shrink-0">
              <button
                onClick={() => setShowAlertsDrawer(!showAlertsDrawer)}
                className={`relative p-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300'}`}
              >
                <Bell className="w-4 h-4" />
                {realtimeAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {realtimeAlerts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-100 border-slate-300'}`}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ligne 2 / Droite : Actions Desktop & Indicateurs d'état */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAlertsDrawer(!showAlertsDrawer)}
              className={`relative p-2 rounded-xl border transition-colors ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Historique des alertes en direct"
            >
              <Bell className="w-4 h-4" />
              {realtimeAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {realtimeAlerts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Changer le thème"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-2 rounded-xl border ${
              isOnline ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </div>

            {isOnline && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`p-2 rounded-xl border transition-colors ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'
                }`}
                title="Synchroniser la base locale"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
              </button>
            )}

            <button
              onClick={handleSignOut}
              className={`p-2 rounded-xl border text-red-500 hover:bg-red-500/10 transition-colors ${
                isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Drawer des alertes si clochée */}
      {showAlertsDrawer && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 text-xs space-y-2 max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center font-bold">
            <span className="text-slate-300 uppercase tracking-wide">File d'attente des alertes en direct ({realtimeAlerts.length})</span>
            <button onClick={() => setShowAlertsDrawer(false)} className="text-slate-400 hover:text-white">Fermer</button>
          </div>
          {realtimeAlerts.length === 0 ? (
            <p className="text-slate-500 py-2">Aucune alerte en attente.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {realtimeAlerts.map((alert, i) => (
                <div key={i} onClick={() => { setSelectedVehicle(alert); setShowAlertsDrawer(false); }} className="bg-slate-950 p-2.5 rounded-xl border border-red-500/30 cursor-pointer hover:border-red-500">
                  <p className="font-mono font-black text-red-400">{alert.plate_number}</p>
                  <p className="text-slate-300">{alert.brand} {alert.model}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ================= COLONNE GAUCHE (Recherche + Fiche Fixe PC) ================= */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
            
            {/* Barre de Recherche Compacte */}
            <div className={`p-3 rounded-2xl border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Plaque, VIN, N° PV, Nom..."
                    className={`w-full border rounded-xl py-2 pl-9 pr-7 font-mono text-xs uppercase focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      isDarkMode 
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowCamera(true)}
                  className={`p-2 rounded-xl border text-blue-500 hover:bg-blue-500/10 transition-colors ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                  }`}
                  title="Scanner la plaque"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fiche Détail sur PC */}
            <div className="hidden lg:block">
              <VehicleCardDetail vehicle={selectedVehicle} isDarkMode={isDarkMode} />
            </div>

          </div>

          {/* ================= COLONNE DROITE (Cartes Condensées) ================= */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <List className="w-3.5 h-3.5 text-blue-500" />
                <span>Registre National (Signalements Volés)</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-bold ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-700'
              }`}>
                {recentStolen.length} engins
              </span>
            </div>

            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className={`h-11 rounded-xl animate-pulse ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200'}`} />
                ))}
              </div>
            ) : recentStolen.length === 0 ? (
              <div className={`border rounded-2xl p-6 text-center ${
                isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-bold text-xs">Aucun engin trouvé</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-170px)] overflow-y-auto pr-1">
                {recentStolen.map((vehicle) => {
                  const isSelected = selectedVehicle?.id === vehicle.id;
                  return (
                    <div
                      key={vehicle.id}
                      onClick={() => setSelectedVehicle(vehicle)}
                      className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500' 
                          : isDarkMode 
                            ? 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/60' 
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        
                        <span className="font-mono font-black text-sm tracking-wide text-red-500 shrink-0">
                          {vehicle.plate_number}
                        </span>

                        <div className="hidden sm:flex items-center gap-2 text-xs truncate border-l border-slate-700/40 pl-2.5">
                          <span className={`font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {vehicle.brand} {vehicle.model}
                          </span>
                          {vehicle.owner_name && (
                            <span className="text-[11px] text-slate-400 truncate">
                              • {vehicle.owner_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sm:hidden min-w-0 text-right pr-1">
                        <p className={`text-[11px] font-semibold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {vehicle.brand} {vehicle.model}
                        </p>
                      </div>

                      <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${
                        isSelected ? 'text-blue-500 translate-x-0.5' : 'text-slate-500 group-hover:translate-x-0.5'
                      }`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Modal Scanner Caméra */}
      {showCamera && (
        <CameraScanner
          onScanComplete={(text) => {
            setShowCamera(false);
            setSearchTerm(text);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Modal Mobile / Bottom Sheet au clic sur une carte */}
      <div className="lg:hidden">
        {selectedVehicle && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm p-2 animate-fade-in">
            <div className="w-full max-h-[85vh] overflow-y-auto">
              <VehicleCardDetail
                vehicle={selectedVehicle}
                isDarkMode={isDarkMode}
                onClose={() => setSelectedVehicle(null)}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}