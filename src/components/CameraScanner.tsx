import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { Camera, CameraOff, Loader2, ScanLine, X } from 'lucide-react';
import { extractPlateFromOcr } from '../utils/plateUtils';
import { Alert, Button } from './ui';

interface CameraScannerProps {
  onScanComplete: (plate: string) => void;
  onClose: () => void;
}

type Status = 'starting' | 'ready' | 'reading' | 'denied' | 'unsupported';

/** Lecture de plaque par la caméra arrière + OCR exécuté localement dans le navigateur. */
export default function CameraScanner({ onScanComplete, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Promise<Worker> | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [hint, setHint] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Pré-chargement du moteur OCR pendant que la caméra démarre
    workerRef.current = createWorker('eng').then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      });
      return worker;
    });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('denied');
      }
    }
    void start();

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      stopCamera();
      void workerRef.current?.then((w) => w.terminate()).catch(() => undefined);
    };
  }, [stopCamera]);

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!video || !canvas || !ctx || !workerRef.current) return;

    setStatus('reading');
    setHint(null);

    // Recadrage sur la zone de visée (75 % × 40 % au centre)
    const cropW = video.videoWidth * 0.75;
    const cropH = video.videoHeight * 0.4;
    canvas.width = cropW;
    canvas.height = cropH;
    ctx.drawImage(video, (video.videoWidth - cropW) / 2, (video.videoHeight - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);

    // Niveaux de gris + binarisation pour faire ressortir les caractères
    const img = ctx.getImageData(0, 0, cropW, cropH);
    for (let i = 0; i < img.data.length; i += 4) {
      const gray = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      const v = gray < 120 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);

    try {
      const worker = await workerRef.current;
      const { data } = await worker.recognize(canvas);
      const plate = extractPlateFromOcr(data.text);
      if (plate) {
        stopCamera();
        onScanComplete(plate);
        return;
      }
      setHint('Plaque non reconnue. Rapprochez-vous et cadrez uniquement la plaque, bien éclairée.');
    } catch (err) {
      console.error('Erreur OCR :', err);
      setHint("La lecture a échoué. Si c'est la première utilisation, une connexion internet est nécessaire pour charger le moteur de lecture.");
    }
    setStatus('ready');
  };

  return (
    <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black" role="dialog" aria-modal="true" aria-label="Scanner une plaque">
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div>
          <p className="text-sm font-semibold">Scanner une plaque</p>
          <p className="text-xs text-white/60">Lecture effectuée sur l'appareil</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer le scanner" className="rounded-full bg-white/10 p-2 hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {status === 'denied' || status === 'unsupported' ? (
          <div className="max-w-sm space-y-4 p-6 text-center text-white">
            <CameraOff className="mx-auto h-12 w-12 text-white/50" />
            <p className="font-semibold">{status === 'denied' ? 'Accès à la caméra refusé' : 'Caméra non disponible'}</p>
            <p className="text-sm text-white/70">
              {status === 'denied'
                ? "Autorisez l'accès à la caméra dans les réglages du navigateur, puis réessayez. Vous pouvez aussi saisir la plaque manuellement."
                : "Ce navigateur ne permet pas d'utiliser la caméra. Saisissez la plaque manuellement."}
            </p>
            <Button variant="secondary" onClick={onClose}>
              Saisie manuelle
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[40%] w-[75%] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-emerald-400" />
                <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-emerald-400" />
                <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />
                {status === 'reading' && <ScanLine className="absolute inset-0 m-auto h-10 w-10 animate-pulse text-emerald-300" />}
              </div>
            </div>
            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {(status === 'ready' || status === 'reading') && (
        <div className="space-y-3 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {hint && (
            <Alert variant="warning" className="mx-auto max-w-md">
              {hint}
            </Alert>
          )}
          <p className="text-center text-xs text-white/60">Cadrez uniquement la plaque dans le rectangle.</p>
          <Button variant="success" size="lg" fullWidth className="mx-auto max-w-md" onClick={capture} loading={status === 'reading'} icon={<Camera className="h-5 w-5" />}>
            {status === 'reading' ? 'Lecture en cours…' : 'Lire la plaque'}
          </Button>
        </div>
      )}
    </div>
  );
}
