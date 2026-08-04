import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { localDb } from '../lib/db';
import { syncVehiclesWithLocalDB } from '../lib/syncService';
import { 
  Search, 
  Camera, 
  CheckCircle, 
  LogOut, 
  Car, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Bell, 
  X, 
  List, 
  ChevronRight, 
  AlertTriangle,
  UserCheck,
  Shield
} from 'lucide-react';
import CameraScanner from '../components/CameraScanner';

export default function AgentDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // Liste des 20 derniers engins volés
  const [recentStolen, setRecentStolen] = useState([]);

  // Gestion réseau & synchro
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem('last_sync_time') || 'Jamais');
  const [realtimeAlert, setRealtimeAlert] = useState(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadRecentStolen('');

    const channel = supabase
      .channel('realtime_stolen_vehicles')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stolen_vehicles' },
        async (payload) => {
          const newVehicle = payload.new;
          setRealtimeAlert(newVehicle);

          if (Notification.permission === "granted") {
            new Notification("🚨 ALERTE VÉHICULE VOLÉ", {
              body: `Plaque : ${newVehicle.plate_number} (${newVehicle.brand} ${newVehicle.model}) - ${newVehicle.owner_name}`,
            });
          }

          await localDb.stolen_vehicles.put(newVehicle);
          const now = new Date().toLocaleString();
          localStorage.setItem('last_sync_time', now);
          setLastSync(now);

          loadRecentStolen(searchTerm);
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

    if (navigator.onLine) {
      let req = supabase
        .from('stolen_vehicles')
        .select('*')
        .eq('status', 'STOLEN')
        .order('created_at', { ascending: false });

      if (cleanQuery) {
        req = req.or(`plate_number.ilike.%${cleanQuery}%,vin.ilike.%${cleanQuery}%,owner_name.ilike.%${cleanQuery}%`);
      }

      const { data } = await req.limit(20);
      setRecentStolen(data || []);
    } else {
      let collection = localDb.stolen_vehicles.reverse();

      if (cleanQuery) {
        const filtered = await collection
          .filter(v => 
            (v.plate_number && v.plate_number.toUpperCase().includes(cleanQuery)) ||
            (v.vin && v.vin.toUpperCase().includes(cleanQuery)) ||
            (v.owner_name && v.owner_name.toUpperCase().includes(cleanQuery))
          )
          .limit(20)
          .toArray();
        setRecentStolen(filtered);
      } else {
        const allLocal = await collection.limit(20).toArray();
        setRecentStolen(allLocal);
      }
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    const success = await syncVehiclesWithLocalDB();
    if (success) {
      setLastSync(localStorage.getItem('last_sync_time'));
      loadRecentStolen(searchTerm);
    }
    setIsSyncing(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadRecentStolen(searchTerm);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      
      {/* BANNIÈRE FLASH TEMPS RÉEL */}
      {realtimeAlert && (
        <div className="bg-red-600 text-white p-3 sm:p-4 shadow-2xl border-b border-red-500 animate-bounce flex items-center justify-between z-50">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 animate-spin" />
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
              className="bg-white text-red-600 font-bold text-xs px-2.5 py-1.5 sm:px-3 rounded-lg shadow hover:bg-red-50"
            >
              Voir
            </button>
            <button 
              onClick={() => setRealtimeAlert(null)}
              className="text-red-200 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* HEADER HARMONISÉ ET STYLISÉ COMME L'ADMINISTRATEUR */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Titre */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-500">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white leading-tight">
                  Espace Contrôle
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                  Agent
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Système de vérification des véhicules signalés
              </p>
            </div>
          </div>

          {/* Section d'état et actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Indicateur d'état réseau */}
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              isOnline 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
            </div>

            {/* Bouton de Synchronisation */}
            {isOnline && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
                title="Synchroniser la base locale"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                <span className="hidden md:inline">Synchroniser</span>
              </button>
            )}

            {/* Séparateur vertical */}
            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

            {/* Bouton de Déconnexion */}
            <button 
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700/80 hover:border-red-500/30 transition-all text-xs font-medium"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>

        </div>
      </header>

      {/* BARRE STATUT SYNCHRO */}
      <div className="bg-slate-900/50 border-b border-slate-800/60 px-4 py-1.5 text-center text-xs text-slate-400">
        Dernière mise à jour locale : <span className="text-slate-200 font-mono">{lastSync}</span>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        
        {/* BARRE DE RECHERCHE RESPONSIVE */}
        <form onSubmit={handleSearchSubmit} className="mb-6">
          <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
            Recherche par Immatriculation, VIN ou Nom
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            
            {/* Champ texte */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  loadRecentStolen(e.target.value);
                }}
                placeholder="Ex: 11-JJ-4567..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-8 text-white font-mono text-base uppercase focus:outline-none focus:border-blue-500"
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => { setSearchTerm(''); loadRecentStolen(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Boutons d'actions (Caméra + Rechercher) */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex-1 sm:flex-none justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 p-3 rounded-xl transition-colors flex items-center gap-2"
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
          <div className="mb-6 bg-red-950/50 border-2 border-red-600 rounded-2xl p-4 sm:p-5 relative shadow-2xl animate-fadeIn">
            <button 
              onClick={() => setSelectedVehicle(null)}
              className="absolute top-3 right-3 text-red-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500 mb-4">
              <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-extrabold uppercase">Signalé Volé !</h2>
                <p className="text-xs text-red-400">PV N° : {selectedVehicle.report_number}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-red-900/20 p-4 rounded-xl border border-red-800/40 font-mono text-sm">
              <div>
                <span className="text-red-400 text-xs block uppercase">Propriétaire</span>
                <span className="text-base font-bold text-white">{selectedVehicle.owner_name || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-red-400 text-xs block uppercase">Immatriculation</span>
                <span className="text-lg sm:text-xl font-bold text-white">{selectedVehicle.plate_number}</span>
              </div>
              {selectedVehicle.vin && (
                <div className="sm:col-span-2">
                  <span className="text-red-400 text-xs block uppercase">Châssis (VIN)</span>
                  <span className="text-white break-all">{selectedVehicle.vin}</span>
                </div>
              )}
              <div>
                <span className="text-red-400 text-xs block">Engin</span>
                <span className="text-white">{selectedVehicle.brand} {selectedVehicle.model}</span>
              </div>
              <div>
                <span className="text-red-400 text-xs block">Couleur</span>
                <span className="text-white">{selectedVehicle.color || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* LISTE DES 20 DERNIÈRES DÉCLARATIONS DE VOL */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <List className="w-4 h-4 text-blue-500" />
              <span>
                {searchTerm ? 'Résultats de recherche' : '20 Dernières Déclarations'}
              </span>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
              {recentStolen.length} engins
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Chargement des données...</div>
          ) : recentStolen.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">Aucun signalement trouvé</p>
              <p className="text-xs text-slate-500 mt-1">Aucune déclaration ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentStolen.map((vehicle) => (
                <div
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedVehicle?.id === vehicle.id 
                      ? 'bg-red-950/40 border-red-600' 
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-white text-sm sm:text-base">{vehicle.plate_number}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Prop. : <span className="text-slate-300">{vehicle.owner_name || 'Inconnu'}</span>
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}