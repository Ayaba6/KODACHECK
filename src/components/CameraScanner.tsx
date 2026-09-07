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
      console.error("Erreur d'accès à la caméra:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  // Nettoyage et formatage du texte extrait (Format Burkina Faso)
  const parseBurkinaPlate = (rawText) => {
    // Transformer en majuscules et supprimer les caractères spéciaux inutiles
    const clean = rawText.toUpperCase().replace(/[^A-Z0-9]/g, ' ');
    
    // Motif 1 : Format standard (ex: 11 RJ 8596 BF)
    const match1 = clean.match(/(\d{1,2})\s*([A-Z]{1,3})\s*(\d{3,4})\s*(BF)?/);
    if (match1) {
      const region = match1[1];
      const series = match1[2];
      const num = match1[3];
      return `${region}-${series}-${num}`;
    }

    // Motif 2 : Format récent/moto (ex: 4131 5X 03 BF)
    const match2 = clean.match(/(\d{4})\s*([0-9][A-Z])\s*(\d{2})/);
    if (match2) {
      return `${match2[1]}-${match2[2]}-${match2[3]}`;
    }

    return null;
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setProgress('Capture de l\'image...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      setProgress('Analyse de la plaque...');
      const worker = await createWorker('eng');
      
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const plateNumber = parseBurkinaPlate(text);

      if (plateNumber) {
        stopCamera();
        onScanComplete(plateNumber);
      } else {
        // Si la Regex échoue, renvoyer la ligne la plus pertinente nettoyée
        const fallbackText = text.replace(/[^A-Z0-9\s]/gi, '').trim().split('\n').join(' ');
        if (fallbackText.length > 3) {
          stopCamera();
          onScanComplete(fallbackText);
        } else {
          alert("Plaque non reconnue. Essayez de vous rapprocher et de bien éclairer la plaque.");
        }
      }
    } catch (err) {
      console.error("Erreur OCR:", err);
      alert("Erreur lors de la lecture de la plaque.");
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4">
      {/* Header */}
      <div className="w-full flex items-center justify-between text-white py-2">
        <span className="font-bold text-sm">Scanner de Plaque</span>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Caméra & Viseur */}
      <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border-2 border-blue-500/50 bg-black flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Cadre de guidage */}
        <div className="absolute inset-x-8 inset-y-12 border-2 border-dashed border-yellow-400 rounded-lg pointer-events-none flex items-center justify-center">
          <span className="text-[10px] text-yellow-300 font-mono bg-black/60 px-2 py-0.5 rounded">
            Cadrez la plaque ici
          </span>
        </div>
      </div>

      {/* Actions */}
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