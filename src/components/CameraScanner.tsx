import React, { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, RefreshCw, X } from 'lucide-react';

export default function CameraScanner({ onScanComplete, onClose }) {
  const videoRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      alert("Impossible d'accéder à la caméra : " + err.message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const captureAndRecognize = async () => {
    if (!videoRef.current) return;

    setLoading(true);
    setProgress('Capture de l image...');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');
    stopCamera();

    setProgress('Analyse de la plaque...');
    try {
      const { data: { text } } = await Tesseract.recognize(
        imageData,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(`Détection : ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      const cleanText = text.replace(/[^A-Z0-9-]/gi, '').trim();
      onScanComplete(cleanText);
    } catch (err) {
      alert("Erreur lors de la lecture de l'image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-md relative flex flex-col items-center">
        
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-3 right-3 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-500" /> Scanner la plaque
        </h3>

        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center mb-4">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          {!isCameraActive && !loading && (
            <button
              onClick={startCamera}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              Activer la caméra
            </button>
          )}
          
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white text-sm">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              <span>{progress}</span>
            </div>
          )}
        </div>

        {isCameraActive && !loading && (
          <button
            onClick={captureAndRecognize}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" /> Capturer & Analyser
          </button>
        )}
      </div>
    </div>
  );
}