import { useEffect, useState } from 'react';
import { createPlateWorker } from '../utils/plateOcr';

export type OcrReadiness = 'checking' | 'ready' | 'preparing' | 'unavailable';

const OCR_CACHE = 'kodacheck-ocr';

/** Le moteur OCR (programme + modèle) est-il dans le cache du service worker ? */
async function isOcrCached(): Promise<boolean> {
  if (!('caches' in window) || !navigator.serviceWorker?.controller) return false;
  try {
    const cache = await caches.open(OCR_CACHE);
    const keys = (await cache.keys()).map((r) => new URL(r.url).pathname);
    return keys.some((p) => p.endsWith('/worker.min.js')) && keys.some((p) => p.includes('/ocr/core/'));
  } catch {
    return false;
  }
}

/**
 * Prépare le lecteur de plaques pour le hors-ligne : quelques secondes après l'ouverture (avec réseau),
 * on démarre une fois le moteur en arrière-plan, ce qui le fait mettre en cache par le service worker.
 * Le téléchargement (~7 Mo pour cet appareil) n'a lieu qu'une fois.
 */
export function useOcrReadiness(online: boolean): OcrReadiness {
  const [state, setState] = useState<OcrReadiness>('checking');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      if (await isOcrCached()) {
        if (!cancelled) setState('ready');
        return;
      }
      if (!navigator.serviceWorker?.controller) {
        // Pas de service worker (développement, navigateur ancien) : pas de hors-ligne possible
        if (!cancelled) setState('unavailable');
        return;
      }
      if (!online) {
        if (!cancelled) setState('unavailable');
        return;
      }
      timer = setTimeout(async () => {
        if (cancelled) return;
        setState('preparing');
        try {
          const worker = await createPlateWorker();
          await worker.terminate();
        } catch (err) {
          console.warn('Préparation du lecteur de plaques impossible :', err);
        }
        if (!cancelled) setState((await isOcrCached()) ? 'ready' : 'unavailable');
      }, 4000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [online]);

  return state;
}
