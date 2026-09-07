import React, { useRef, useState, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { Camera, RefreshCw, X } from 'lucide-react';

export default function CameraScanner({ onScanComplete, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Erreur accès caméra:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  // Prétraitement d'image avancé pour plaques de moto / auto
  const applyAdvancedFilters = (ctx, width, height) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // 1. Augmentation du contraste et binarisation
    for (let i = 0; i < data.length; i += 4) {
      // Conversion échelle de gris
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
      // Ajustement de contraste agressif pour faire ressortir les chiffres noirs
      const v = gray < 120 ? 0 : 255;

      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Correction des erreurs fréquentes de confusion visuelle (OCR Offline)
  const fixCommonOcrErrors = (str) => {
    return str
      .replace(/I/g, '1')
      .replace(/O/g, '0')
      .replace(/Z/g, '7')
      .replace(/S/g, '5')
      .replace(/B/g, '8');
  };

  // Post-traitement et extraction de l'immatriculation Burkina Faso
  const processBurkinaPlateText = (rawText) => {
    const lines = rawText.toUpperCase().split('\n');
    let tokens = [];

    lines.forEach(line => {
      const cleaned = line.replace(/[^A-Z0-9]/g, ' ').trim();
      if (cleaned.length > 0) {
        tokens.push(...cleaned.split(/\s+/));
      }
    });

    const fullStr = tokens.join(' ');

    // Motif 1 : Moto récent (ex: 4131 5X 03 -> 4131 5X 03)
    const motoMatch = fullStr.match(/(\d{3,4})\s*([0-9A-Z]{2})\s*(\d{2})/);
    if (motoMatch) {
      const part2 = fixCommonOcrErrors(motoMatch[2]);
      return `${motoMatch[1]} ${part2} ${motoMatch[3]}`;
    }

    // Motif 2 : Format Standard Auto/Moto (ex: 11 RJ 8596 / 11 RJ 8596 BF)
    const standardMatch = fullStr.match(/(\d{1,2})\s*([A-Z]{1,3})\s*(\d{3,4})/);
    if (standardMatch) {
      return `${standardMatch[1]} ${standardMatch[2]} ${standardMatch[3]}`;
    }

    // Fallback : renvoie les 3 premiers blocs valides s'ils existent
    if (tokens.length >= 2) {
      return tokens.slice(0, 3).join(' ');
    }

    return null;
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setProgress('Optimisation de l\'image...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Ciblage haute résolution de la zone centrale
    const cropWidth = video.videoWidth * 0.75;
    const cropHeight = video.videoHeight * 0.4;
    const cropX = (video.videoWidth - cropWidth) / 2;
    const cropY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    applyAdvancedFilters(ctx, cropWidth, cropHeight);

    try {
      setProgress('Analyse locale (Hors ligne)...');
      
      const worker = await createWorker('eng');
      
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        tessedit_pageseg_mode: '6', // Mode 6 : bloc de texte uniforme
      });

      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const plateResult = processBurkinaPlateText(text);

      if (plateResult) {
        stopCamera();
        onScanComplete(plateResult);
      } else {
        alert("Plaque non reconnue. Rapprochez-vous du cadre central.");
      }
    } catch (err) {
      console.error("Erreur OCR Local :", err);
      alert("Erreur lors de la lecture locale.");
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4">
      <div className="w-full flex items-center justify-between text-white py-2">
        <span className="font-bold text-sm">Scanner Plaque (Mode Hors Ligne)</span>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-black flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute w-[75%] h-[40%] border-2 border-dashed border-emerald-400 rounded-lg pointer-events-none flex items-center justify-center bg-emerald-500/10">
          <span className="text-[10px] text-emerald-300 font-mono bg-black/80 px-2 py-0.5 rounded">
            Cadrez uniquement la plaque
          </span>
        </div>
      </div>

      <div className="w-full max-w-md my-4 text-center">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold py-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>{progress}</span>
          </div>
        ) : (
          <button
            onClick={captureAndRecognize}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Camera className="w-5 h-5" />
            <span>Lire la plaque (Hors ligne)</span>
          </button>
        )}
      </div>
    </div>
  );
}