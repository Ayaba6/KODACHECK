import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Worker } from 'tesseract.js';
import { Camera, CameraOff, Flashlight, FlashlightOff, Keyboard, Loader2, RotateCcw, Search, X, ZoomIn } from 'lucide-react';
import { compactPlate, describePlate, type PlateReading } from '../utils/plateUtils';
import { createPlateWorker, mapOverlayToVideo, preprocessRegion, READ_VARIANTS, readPlate, scanRegion, type ReadVariant } from '../utils/plateOcr';
import { PlateVote } from '../utils/plateVote';
import { cn } from '../lib/utils';
import { Button } from './ui';

interface CameraScannerProps {
  onScanComplete: (plate: string) => void;
  onClose: () => void;
}

type Phase = 'starting' | 'scanning' | 'confirm' | 'denied' | 'unsupported' | 'engine-error';

/** Délai entre deux lectures automatiques. */
const SCAN_INTERVAL_MS = 250;
/** Après ce délai sans résultat, des conseils s'affichent. */
const HINT_AFTER_MS = 10000;

interface TorchZoomCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lecture de plaque par la caméra arrière : lecture automatique en continu, OCR exécuté sur l'appareil,
 * puis confirmation (et correction éventuelle) par l'agent avant la recherche.
 */
export default function CameraScanner({ onScanComplete, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const workCanvas = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);

  const [phase, setPhase] = useState<Phase>('starting');
  const phaseRef = useRef<Phase>('starting');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const [engineReady, setEngineReady] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [caps, setCaps] = useState<{ torch: boolean; zoom: TorchZoomCapabilities['zoom'] | null }>({ torch: false, zoom: null });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const track = () => streamRef.current?.getVideoTracks()[0];

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const t = stream.getVideoTracks()[0];
      const c = (t.getCapabilities?.() ?? {}) as TorchZoomCapabilities;
      setCaps({ torch: Boolean(c.torch), zoom: c.zoom && c.zoom.max > c.zoom.min ? c.zoom : null });
      // Mise au point continue si l'appareil la propose
      void t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
      setPhase('scanning');
    } catch {
      setPhase('denied');
    }
  }, []);

  // Démarrage : caméra + moteur OCR en parallèle
  useEffect(() => {
    let cancelled = false;
    workCanvas.current = document.createElement('canvas');

    createPlateWorker()
      .then((w) => {
        if (cancelled) void w.terminate();
        else {
          workerRef.current = w;
          setEngineReady(true);
        }
      })
      .catch((err) => {
        console.error('Moteur OCR indisponible :', err);
        if (!cancelled) setPhase('engine-error');
      });

    void startCamera();

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      stopCamera();
      void workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [startCamera, stopCamera]);

  /** Capture la zone de visée, la prépare et la lit. */
  /**
   * Lit la zone de visée. En lecture automatique, une seule passe (polarité au choix) pour rester rapide ;
   * en capture manuelle (`thorough`), deux passes avec les deux polarités.
   */
  const scanOnce = useCallback(
    async (
      opts: { flipPolarity?: boolean; thorough?: boolean; variant?: ReadVariant } = {},
    ): Promise<{ reading: PlateReading | null; confidence: number } | null> => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const canvas = workCanvas.current;
      const worker = workerRef.current;
      if (!video || !overlay || !canvas || !worker || video.readyState < 2 || !video.videoWidth) return null;

      const region = mapOverlayToVideo(video, overlay);
      if (region.w < 20 || region.h < 10) return null;
      if (opts.thorough) return scanRegion(worker, video, region, canvas);
      preprocessRegion(video, region, canvas, { flipPolarity: opts.flipPolarity });
      return readPlate(worker, canvas, opts.variant);
    },
    [],
  );

  /** Garde une image couleur de la zone lue, affichée à l'étape de confirmation. */
  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || !video.videoWidth) return null;
    const r = mapOverlayToVideo(video, overlay);
    const c = document.createElement('canvas');
    const w = Math.min(640, Math.round(r.w));
    c.width = w;
    c.height = Math.round((r.h / r.w) * w);
    c.getContext('2d')?.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }, []);

  const goToConfirm = useCallback(
    (value: string) => {
      setSnapshot(takeSnapshot());
      setPlate(value);
      setPhase('confirm');
      if ('vibrate' in navigator) navigator.vibrate?.(80);
    },
    [takeSnapshot],
  );

  // Lecture automatique en continu
  useEffect(() => {
    if (phase !== 'scanning' || !engineReady) return;
    let cancelled = false;
    const vote = new PlateVote();
    // Chaque image est lue avec une variante différente (taille, élargissement) : les erreurs varient,
    // la bonne lecture se répète et l'emporte au vote.
    let frame = 0;
    // Polarité inversée après un cycle complet de variantes sans résultat (plaques claires sur fond sombre)
    let flipPolarity = false;
    let misses = 0;
    const hintTimer = setTimeout(() => setShowHint(true), HINT_AFTER_MS);

    (async () => {
      while (!cancelled) {
        await sleep(SCAN_INTERVAL_MS);
        if (cancelled || document.hidden || busyRef.current) continue;
        busyRef.current = true;
        try {
          const variant = READ_VARIANTS[frame++ % READ_VARIANTS.length];
          const result = await scanOnce({ flipPolarity, variant });
          if (cancelled) return;
          const reading = result?.reading;
          if (!reading?.strong) {
            if (reading && !vote.leader()) setLastGuess(reading.plate);
            if (++misses >= READ_VARIANTS.length) {
              flipPolarity = !flipPolarity;
              misses = 0;
            }
            continue;
          }
          misses = 0;
          const winner = vote.add(reading.plate, result?.confidence ?? 0);
          setLastGuess(vote.leader());
          if (winner) {
            cancelled = true;
            goToConfirm(winner);
            return;
          }
        } catch (err) {
          console.warn('Lecture OCR échouée :', err);
        } finally {
          busyRef.current = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
    };
  }, [phase, engineReady, scanOnce, goToConfirm]);

  /** Capture manuelle : on passe à la confirmation même avec une lecture partielle. */
  const captureNow = async () => {
    if (busyRef.current) {
      // Une lecture automatique est en cours : on attend qu'elle se termine
      while (busyRef.current) await sleep(50);
      if (phaseRef.current !== 'scanning') return;
    }
    busyRef.current = true;
    try {
      const result = await scanOnce({ thorough: true });
      goToConfirm(result?.reading?.plate ?? lastGuess ?? '');
    } finally {
      busyRef.current = false;
    }
  };

  const rescan = () => {
    setPlate('');
    setSnapshot(null);
    setLastGuess(null);
    setShowHint(false);
    setPhase('scanning');
  };

  const toggleTorch = async () => {
    const t = track();
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      setCaps((c) => ({ ...c, torch: false }));
    }
  };

  const changeZoom = (value: number) => {
    setZoom(value);
    void track()?.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] }).catch(() => undefined);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = plate.trim().toUpperCase();
    if (compactPlate(value).length < 2) return;
    stopCamera();
    onScanComplete(value);
  };

  const cameraVisible = phase === 'starting' || phase === 'scanning' || phase === 'confirm';
  const plateInfo = phase === 'confirm' ? describePlate(plate) : null;

  return (
    <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Scanner une plaque">
      {/* En-tête */}
      <div className="relative z-10 flex items-center gap-2 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Scanner une plaque</p>
          <p className="truncate text-xs text-white/60">
            {phase === 'confirm'
              ? 'Vérifiez la lecture avant de lancer la recherche'
              : engineReady
                ? 'Lecture automatique · traitement sur l\'appareil'
                : 'Préparation du lecteur…'}
          </p>
        </div>
        {phase === 'scanning' && caps.torch && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={torchOn ? 'Éteindre la lampe' : 'Allumer la lampe'}
            className={cn('rounded-full p-2.5', torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 hover:bg-white/20')}
          >
            {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Fermer le scanner" className="rounded-full bg-white/10 p-2.5 hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Caméra */}
      <div className={cn('relative flex-1 overflow-hidden', !cameraVisible && 'hidden')}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div
            ref={overlayRef}
            className="relative aspect-[3/2] w-full max-w-md rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
          >
            {(['left-0 top-0 border-l-4 border-t-4 rounded-tl-xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'] as const).map((pos) => (
              <span key={pos} className={cn('absolute h-7 w-7 border-emerald-400', pos)} />
            ))}
            {phase === 'scanning' && engineReady && (
              <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-emerald-400/80 shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
            )}
          </div>
        </div>

        {(phase === 'starting' || (phase === 'scanning' && !engineReady)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-white/80">{phase === 'starting' ? 'Ouverture de la caméra…' : 'Chargement du lecteur de plaques…'}</p>
          </div>
        )}

        {phase === 'scanning' && engineReady && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
            <p className="rounded-full bg-black/70 px-3 py-1.5 text-center text-xs text-white/90">
              {lastGuess ? (
                <>
                  Lecture : <span className="font-mono font-bold tracking-wider">{lastGuess}</span>
                </>
              ) : (
                'Placez la plaque entière dans le cadre'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Écrans d'erreur */}
      {!cameraVisible && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm space-y-4 text-center">
            <CameraOff className="mx-auto h-12 w-12 text-white/50" />
            <p className="font-semibold">
              {phase === 'denied' ? 'Accès à la caméra refusé' : phase === 'unsupported' ? 'Caméra non disponible' : 'Lecteur de plaques indisponible'}
            </p>
            <p className="text-sm text-white/70">
              {phase === 'denied'
                ? "Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez."
                : phase === 'unsupported'
                  ? "Ce navigateur ne permet pas d'utiliser la caméra (une connexion https est nécessaire)."
                  : 'Le moteur de lecture n\'a pas pu démarrer. Rechargez la page avec une connexion internet.'}
            </p>
            <div className="flex flex-col gap-2">
              {phase === 'denied' && (
                <Button variant="secondary" onClick={() => void startCamera()}>
                  Réessayer
                </Button>
              )}
              <Button variant="outline" onClick={onClose} icon={<Keyboard className="h-4 w-4" />}>
                Saisir la plaque manuellement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Commandes */}
      {phase === 'scanning' && (
        <div className="relative z-10 space-y-3 bg-black px-4 pt-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {caps.zoom && (
            <label className="mx-auto flex max-w-md items-center gap-3 text-xs text-white/70">
              <ZoomIn className="h-4 w-4 shrink-0" />
              <input
                type="range"
                min={caps.zoom.min}
                max={Math.min(caps.zoom.max, caps.zoom.min * 8)}
                step={caps.zoom.step ?? 0.1}
                value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))}
                className="flex-1 accent-emerald-400"
                aria-label="Zoom"
              />
              <span className="w-8 text-right tabular-nums">{zoom.toFixed(1)}×</span>
            </label>
          )}
          {showHint && (
            <p className="mx-auto max-w-md text-center text-xs text-amber-300">
              Lecture difficile ? Rapprochez-vous, évitez les reflets{caps.torch ? ', allumez la lampe' : ''} ou capturez manuellement.
            </p>
          )}
          <div className="mx-auto flex max-w-md gap-2">
            <Button variant="outline" size="lg" onClick={onClose} className="border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-white/20 dark:bg-white/10" icon={<Keyboard className="h-5 w-5" />}>
              <span className="sr-only sm:not-sr-only">Saisir</span>
            </Button>
            <Button variant="success" size="lg" fullWidth onClick={captureNow} disabled={!engineReady} icon={<Camera className="h-5 w-5" />}>
              Capturer maintenant
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {phase === 'confirm' && (
        <form
          onSubmit={submit}
          className="relative z-10 animate-slide-up space-y-4 rounded-t-2xl bg-white px-4 pt-5 text-slate-900 dark:bg-slate-900 dark:text-white"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-md space-y-4">
            {snapshot && <img src={snapshot} alt="Zone de la plaque capturée" className="mx-auto max-h-28 rounded-lg border border-slate-200 object-contain dark:border-slate-700" />}
            <div>
              <label htmlFor="scanned-plate" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Plaque lue {plate ? '— corrigez si nécessaire' : ''}
              </label>
              <input
                id="scanned-plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="Saisissez la plaque"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="h-14 w-full rounded-xl border-2 border-slate-900 bg-amber-300 text-center font-mono text-2xl font-bold tracking-[0.2em] text-slate-950 placeholder:text-base placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-brand-500/40"
              />
              {!plate && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Aucune plaque reconnue : saisissez-la ou rescannez.</p>}
              {plateInfo && (
                <p className="mt-1.5 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                  {[plateInfo.category, plateInfo.region].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={rescan} icon={<RotateCcw className="h-4 w-4" />}>
                Rescanner
              </Button>
              <Button type="submit" size="lg" fullWidth disabled={compactPlate(plate).length < 2} icon={<Search className="h-4 w-4" />}>
                Vérifier
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
