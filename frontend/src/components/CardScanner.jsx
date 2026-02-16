import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Upload, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const CardScanner = ({ onAnalysisComplete, isAnalyzing, setIsAnalyzing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback((file) => {
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Por favor sube una imagen JPEG, PNG o WEBP');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es muy grande. Máximo 10MB');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const analyzeCard = async () => {
    if (!selectedImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    setScanProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      const response = await fetch(`${API}/cards/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: selectedImage,
        }),
      });

      clearInterval(progressInterval);
      setScanProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al analizar la tarjeta');
      }

      const result = await response.json();
      
      setTimeout(() => {
        onAnalysisComplete(result, selectedImage);
        setSelectedImage(null);
        setScanProgress(0);
        setIsAnalyzing(false);
      }, 500);

    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || 'Error al analizar la tarjeta');
      setScanProgress(0);
      setIsAnalyzing(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setError(null);
    setScanProgress(0);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!selectedImage ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`
              relative border-2 border-dashed rounded-lg p-12
              transition-all duration-300 cursor-pointer
              ${dragActive 
                ? 'border-[#3b82f6] bg-[#3b82f6]/10' 
                : 'border-[#27272a] hover:border-[#3b82f6]/50 bg-[#121212]'
              }
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="card-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            
            <div className="flex flex-col items-center gap-4 text-center">
              <div className={`
                p-4 rounded-full transition-colors
                ${dragActive ? 'bg-[#3b82f6]/20' : 'bg-[#1e1e1e]'}
              `}>
                <Upload className={`w-8 h-8 ${dragActive ? 'text-[#3b82f6]' : 'text-gray-400'}`} />
              </div>
              
              <div>
                <p className="font-heading text-xl font-semibold uppercase tracking-wider text-white mb-2">
                  Arrastra tu tarjeta aquí
                </p>
                <p className="text-gray-500 text-sm">
                  o haz clic para seleccionar • JPEG, PNG, WEBP (máx 10MB)
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-[#121212] rounded-lg border border-[#27272a] overflow-hidden"
          >
            {/* Image Preview */}
            <div className="relative aspect-[3/4] max-h-[500px] overflow-hidden">
              <img
                src={selectedImage}
                alt="Card preview"
                className="w-full h-full object-contain"
                data-testid="card-preview-image"
              />
              
              {/* Scanning Overlay */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/50">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent animate-scan shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Scan className="w-12 h-12 text-[#3b82f6] animate-pulse mx-auto mb-4" />
                      <p className="font-heading text-xl uppercase tracking-wider text-white">
                        Analizando...
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Close button */}
              {!isAnalyzing && (
                <button
                  onClick={clearImage}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                  data-testid="clear-image-btn"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}
            </div>

            {/* Progress & Actions */}
            <div className="p-6 border-t border-[#27272a]">
              {isAnalyzing ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Progreso del análisis</span>
                    <span className="font-mono text-[#3b82f6]">{Math.round(scanProgress)}%</span>
                  </div>
                  <Progress value={scanProgress} className="h-2" />
                </div>
              ) : (
                <Button
                  onClick={analyzeCard}
                  className="w-full h-12 bg-white text-black hover:bg-gray-200 font-semibold uppercase tracking-wider"
                  data-testid="analyze-btn"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  Analizar Tarjeta
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
            data-testid="error-message"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CardScanner;
