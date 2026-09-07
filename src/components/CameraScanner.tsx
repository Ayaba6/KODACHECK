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
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erreur caméra :", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  // Traitement d'image : Contraste élevé pour isoler les caractères
  const preprocessImage = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Conversion en niveau de gris
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      // Seuil binaire : accentuer le noir/blanc
      const threshold = avg < 110 ? 0 : 255;
      data[i] = threshold;
      data[i + 1] = threshold;
      data[i + 2] = threshold;
    }
    ctx.putImageData(imageData, 0, 0);
  };

  // Extraction stricte du format plaque Burkinabè
  const cleanBurkinaPlate = (rawText) => {
    // Nettoyer les caractères parasites
    const cleaned = rawText.toUpperCase().replace(/[^A-Z0-9]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);

    // Recherche de combinaisons courantes
    const fullText = words.join(' ');
    
    // Motif 1: Ex: 11 RJ 8596 ou 11-RJ-8596
    const m1 = fullText.match(/(\d{1,2})\s*([A-Z]{1,3})\s*(\d{3,4})/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;

    // Motif 2: Ex: 4131 5X 03
    const m2 = fullText.match(/(\d{3,4})\s*(\d[A-Z]|[A-Z]\d|[A-Z]{2})\s*(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

    // Fallback : extraire les groupes alphanumériques principaux
    if (words.length >= 2) {
      return words.slice(0, 3).join('-');
    }

    return null;
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setProgress('Recadrage de la plaque...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // 1. Définir la zone de rognage (zone du viseur au centre)
    const cropWidth = video.videoWidth * 0.7;
    const cropHeight = video.videoHeight * 0.35;
    const cropX = (video.videoWidth - cropWidth) / 2;
    const cropY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // 2. Dessiner SEULEMENT la zone encadrée dans le canvas
    ctx.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    // 3. Appliquer le filtre binaire
    preprocessImage(ctx, cropWidth, cropHeight);

    try {
      setProgress('Analyse des caractères...');
      const worker = await createWorker('eng');
      
      // Restreindre Tesseract aux majuscules et chiffres uniquement
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      });

      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const result = cleanBurkinaPlate(text);

      if (result) {
        stopCamera();
        onScanComplete(result);
      } else {
        alert("Plaque illisible. Veuillez bien cadrer le numéro dans le rectangle jaune.");
      }
    } catch (err) {
      console.error("Erreur OCR :", err);
      alert("Erreur de lecture lors du scan.");
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4">
      <div className="w-full flex items-center justify-between text-white py-2">
        <span className="font-bold text-sm">Scanner de Plaque</span>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Caméra avec Viseur Ciblé */}
      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border-2 border-blue-500/50 bg-black flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Zone ciblée de capture (70% largeur x 35% hauteur) */}
        <div className="absolute w-[70%] h-[35%] border-2 border-dashed border-yellow-400 rounded-lg pointer-events-none flex items-center justify-center bg-yellow-400/5">
          <span className="text-[10px] text-yellow-300 font-mono bg-black/80 px-2 py-0.5 rounded">
            Placez la plaque ICI
          </span>
        </div>
      </div>

      <div className="w-full max-w-md my-4 text-center">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-blue-400 font-semibold py-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>{progress}</span>
          </div>
        ) : (
          <button
            onClick={captureAndRecognize}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Camera className="w-5 h-5" />
            <span>Lire la plaque</span>
          </button>
        )}
      </div>
    </div>
  );
}