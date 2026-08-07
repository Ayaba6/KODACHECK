import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDb } from '../lib/db';
import { syncVehiclesWithLocalDB } from '../lib/syncService';
import { 
  Search, 
  Camera, 
  CheckCircle, 
  LogOut, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Bell, 
  X, 
  List, 
  ChevronRight, 
  AlertTriangle,
  Shield,
  User,
  Sun,
  Moon
} from 'lucide-react';
import CameraScanner from '../components/CameraScanner';

export default function AgentterrainDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // État du mode sombre / clair (par défaut sombre)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Liste des 20 derniers engins volés
  const [recentStolen, setRecentStolen] = useState([]);

  // Gestion réseau & synchro
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem('last_sync_time') || 'Jamais');
  const [realtimeAlert, setRealtimeAlert] = useState(null);

  useEffect(() => {
    // Demande de permission pour les notifications
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadRecentStolen('');

    // Écoute des nouveaux signalements en temps réel via Supabase
    const channel = supabase
      .channel('realtime_stolen_vehicles')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stolen_vehicles' },
        async (payload) => {
          const newVehicle = payload.new;
          
          if (newVehicle.status === 'STOLEN') {
            setRealtimeAlert(newVehicle);

            // Gestion des notifications (Service Worker PWA avec fallback natif)
            if (Notification.permission === "granted") {
              const title = "🚨 ALERTE VÉHICULE VOLÉ";
              const options = {
                body: `Plaque : ${newVehicle.plate_number} (${newVehicle.brand || ''} ${newVehicle.model || ''}) - Propr. : ${newVehicle.owner_name || 'Inconnu'}`,
                icon: '/icons/pwa-192x192.png',
                vibrate: [200, 100, 200]
              };

              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.ready;
                registration.showNotification(title, options);
              } else {
                const notif = new Notification(title, options);
                setTimeout(() => notif.close(), 8000);
              }
            }

            // Sauvegarde dans la base locale IndexedDB
            await localDb.stolen_vehicles.put(newVehicle);
            const now = new Date().toLocaleString('fr-FR');
            localStorage.setItem('last_sync_time', now);
            setLastSync(now);

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
  }, []);

  const loadRecentStolen = async (query = searchTerm) => {
    setLoading(true);
    setSelectedVehicle(null);
    const cleanQuery = query.trim().toUpperCase();

    try {
      if (navigator.onLine) {
        let req = supabase
          .from('stolen_vehicles')
          .select('*')
          .eq('status', 'STOLEN')
          .order('created_at', { ascending: false });

        if (cleanQuery) {
          req = req.or(`plate_number.ilike.%${cleanQuery}%,vin.ilike.%${cleanQuery}%,owner_name.ilike.%${cleanQuery}%`);
        }

        const { data, error } = await req.limit(20);
        if (!error && data) {
          setRecentStolen(data);
        }
      } else {
        // Mode hors-ligne
        const allLocal = await localDb.stolen_vehicles.toArray();
        const stolenOnly = allLocal.filter(v => v.status === 'STOLEN');

        if (cleanQuery) {
          const filtered = stolenOnly.filter(v => 
            (v.plate_number && v.plate_number.toUpperCase().includes(cleanQuery)) ||
            (v.vin && v.vin.toUpperCase().includes(cleanQuery)) ||
            (v.owner_name && v.owner_name.toUpperCase().includes(cleanQuery))
          );
          setRecentStolen(filtered.slice(0, 20));
        } else {
          stolenOnly.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
          setRecentStolen(stolenOnly.slice(0, 20));
        }
      }
    } catch (err) {
      console.error("Erreur de chargement des données :", err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadRecentStolen(searchTerm);
  };

  return (
    <div className={`min-h-screen flex flex-col relative transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* BANNIÈRE FLASH TEMPS RÉEL */}
      {realtimeAlert && (
        <div className="bg-red-600 text-white p-3 sm:p-4 shadow-2xl border-b border-red-500 animate-bounce flex items-center justify-between z-50">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 animate-pulse" />
            <div className="truncate">
              <p className="font-extrabold text-xs sm:text-sm uppercase tracking-wide truncate">
                NOUVEAU SIGNALEMENT DE VOL !
              </p>
              <p className="text-xs text-red-100 font-mono truncate">
                Plaque : <span className="font-bold underline">{realtimeAlert.plate_number}</span> ({realtimeAlert.brand} {realtimeAlert.model})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedVehicle(realtimeAlert);
                setRealtimeAlert(null);
              }}
              className="bg-white text-red-600 font-bold text-xs px-2.5 py-1.5 sm:px-3 rounded-lg shadow hover:bg-red-50 transition-colors"
            >
              Voir
            </button>
            <button 
              onClick={() => setRealtimeAlert(null)}
              className="text-red-200 hover:text-white p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className={`backdrop-blur-md border-b px-4 py-3 sm:px-6 sticky top-0 z-40 shadow-md transition-colors ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Titre */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-500">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight leading-tight">
                  Espace Contrôle
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-wider">
                  Agent
                </span>
              </div>
              <p className={`text-xs hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Système de vérification des véhicules signalés
              </p>
            </div>
          </div>

          {/* Statut Réseau, Switch Thème & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Bouton Switch Mode Sombre / Clair */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' 
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDarkMode ? "Passer au mode clair" : "Passer au mode sombre"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden md:inline">{isDarkMode ? 'Clair' : 'Sombre'}</span>
            </button>

            {/* Indicateur d'état réseau */}
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              isOnline 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
            </div>

            {/* Bouton Synchronisation */}
            {isOnline && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors disabled:opacity-50 ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="Synchroniser la base locale"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
                <span className="hidden md:inline">Synchroniser</span>
              </button>
            )}

            <div className={`h-6 w-[1px] hidden sm:block ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* Bouton Déconnexion */}
            <button 
              onClick={() => supabase.auth.signOut()}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-medium ${
                isDarkMode 
                  ? 'bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border-slate-700/80 hover:border-red-500/30' 
                  : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-300 hover:border-red-300'
              }`}
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>

        </div>
      </header>

      {/* BARRE DE STATUT LOGISTIQUE / SYNCHRO */}
      <div className={`border-b px-4 py-1.5 text-center text-xs transition-colors ${
        isDarkMode ? 'bg-slate-900/50 border-slate-800/60 text-slate-400' : 'bg-slate-100/70 border-slate-200 text-slate-500'
      }`}>
        Dernière mise à jour locale : <span className={`font-mono font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{lastSync}</span>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        
        {/* RECHERCHE */}
        <form onSubmit={handleSearchSubmit} className="mb-6">
          <label className={`block text-xs sm:text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Recherche par Immatriculation, VIN ou Nom du propriétaire
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  loadRecentStolen(e.target.value);
                }}
                placeholder="Ex: 11-JJ-4567 ou VIN..."
                className={`w-full border rounded-xl py-3 pl-10 pr-8 font-mono text-base uppercase focus:outline-none focus:border-blue-500 transition-colors ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm'
                }`}
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => { setSearchTerm(''); loadRecentStolen(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className={`flex-1 sm:flex-none justify-center border text-blue-500 p-3 rounded-xl transition-colors flex items-center gap-2 ${
                  isDarkMode 
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' 
                    : 'bg-white hover:bg-slate-100 border-slate-300 shadow-sm'
                }`}
                title="Scanner une plaque"
              >
                <Camera className="w-5 h-5" />
                <span className="sm:hidden text-sm font-medium">Scanner</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none justify-center bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-3 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">{loading ? '...' : 'Rechercher'}</span>
              </button>
            </div>

          </div>
        </form>

        {showCamera && (
          <CameraScanner 
            onScanComplete={(text) => {
              setShowCamera(false);
              setSearchTerm(text);
              loadRecentStolen(text);
            }}
            onClose={() => setShowCamera(false)}
          />
        )}

        {/* FICHE DÉTAIL ENGIN SÉLECTIONNÉ */}
        {selectedVehicle && (
          <div className={`mb-6 border-2 rounded-2xl p-4 sm:p-5 relative shadow-2xl transition-all ${
            isDarkMode 
              ? 'bg-red-950/40 border-red-600/80' 
              : 'bg-red-50 border-red-500'
          }`}>
            <button 
              onClick={() => setSelectedVehicle(null)}
              className={`absolute top-3 right-3 p-1 transition-colors ${
                isDarkMode ? 'text-red-400 hover:text-white' : 'text-red-600 hover:text-red-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-600 mb-4">
              <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wide">Véhicule Signalé Volé !</h2>
                <p className={`text-xs font-mono ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                  Procès-Verbal N° : {selectedVehicle.report_number || 'N/A'}
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border text-sm ${
              isDarkMode 
                ? 'bg-red-900/20 border-red-800/40' 
                : 'bg-white/80 border-red-200 shadow-sm'
            }`}>
              <div>
                <span className={`text-xs block uppercase font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Propriétaire</span>
                <span className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedVehicle.owner_name || 'Non renseigné'}</span>
              </div>
              <div>
                <span className={`text-xs block uppercase font-medium mb-1 ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Immatriculation</span>
                <span className="inline-block bg-slate-950 text-white font-mono font-black text-lg px-3 py-0.5 rounded border border-slate-900 shadow-sm tracking-wider">
                  {selectedVehicle.plate_number}
                </span>
              </div>
              {selectedVehicle.vin && (
                <div className="sm:col-span-2">
                  <span className={`text-xs block uppercase font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Châssis (VIN)</span>
                  <span className={`font-mono break-all font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedVehicle.vin}</span>
                </div>
              )}
              <div>
                <span className={`text-xs block font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Engin / Modèle</span>
                <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedVehicle.brand} {selectedVehicle.model}</span>
              </div>
              <div>
                <span className={`text-xs block font-medium ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Couleur</span>
                <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedVehicle.color || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* LISTE DES DÉCLARATIONS DE VOL */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className={`flex items-center gap-2 font-semibold text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <List className="w-4 h-4 text-blue-500" />
              <span>
                {searchTerm ? 'Résultats de recherche' : '20 Dernières Déclarations'}
              </span>
            </div>
            <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
              isDarkMode 
                ? 'bg-slate-800 text-slate-400 border-slate-700' 
                : 'bg-slate-200 text-slate-700 border-slate-300'
            }`}>
              {recentStolen.length} engins
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Chargement des données...</div>
          ) : recentStolen.length === 0 ? (
            <div className={`border rounded-xl p-8 text-center transition-colors ${
              isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>Aucun signalement trouvé</p>
              <p className="text-xs text-slate-500 mt-1">Aucune déclaration ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentStolen.map((vehicle) => {
                const isSelected = selectedVehicle?.id === vehicle.id;
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? (isDarkMode 
                            ? 'bg-red-950/40 border-red-600 shadow-md' 
                            : 'bg-red-50 border-red-400 shadow-md')
                        : (isDarkMode 
                            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-sm')
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`font-mono font-bold text-sm sm:text-base tracking-wide ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            {vehicle.plate_number}
                          </span>
                        </div>
                        <p className={`text-xs truncate font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          {vehicle.brand} {vehicle.model}
                        </p>
                        <p className="text-xs truncate flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className={`truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {vehicle.owner_name || 'Inconnu'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <ChevronRight className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}