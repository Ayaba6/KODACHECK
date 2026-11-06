import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudOff, Download, RefreshCw, Share, SquarePlus, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Button, Modal } from '../ui';

/** Vérification des mises à jour toutes les heures (les agents gardent l'application ouverte longtemps). */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Enregistre le service worker et propose les mises à jour. La nouvelle version n'est appliquée
 * qu'à la demande de l'agent, pour ne jamais recharger l'écran en plein contrôle.
 */
export function PwaUpdater() {
  const toast = useToast();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update().catch(() => undefined), UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('Application disponible hors-ligne', "KodaCheck s'ouvrira même sans connexion.");
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, toast]);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[90] mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-xl border border-brand-200 bg-white p-3 shadow-xl dark:border-brand-500/30 dark:bg-slate-900">
      <RefreshCw className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
      <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">Une nouvelle version de KodaCheck est disponible.</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Mettre à jour
      </Button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Plus tard"
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/** Bouton « Installer » : invite native sur Android/Chrome, mode d'emploi sur iPhone. */
export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!deferred && !isIos())) return null;

  const install = async () => {
    if (!deferred) {
      setShowIosHelp(true);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferred(null);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={install} icon={<Download className="h-4 w-4" />} aria-label="Installer l'application">
        {!compact && <span className="hidden sm:inline">Installer</span>}
      </Button>
      <Modal open={showIosHelp} onClose={() => setShowIosHelp(false)} size="sm" title="Installer KodaCheck sur iPhone">
        <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <li className="flex items-center gap-3">
            <Share className="h-5 w-5 shrink-0 text-brand-600" />
            Touchez le bouton <strong>Partager</strong> de Safari.
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus className="h-5 w-5 shrink-0 text-brand-600" />
            Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.
          </li>
        </ol>
      </Modal>
    </>
  );
}

/** Bandeau affiché quand l'appareil n'a plus de réseau. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-slate-950">
      <CloudOff className="h-3.5 w-3.5 shrink-0" />
      Hors-ligne · les données affichées peuvent ne pas être à jour
    </div>
  );
}
