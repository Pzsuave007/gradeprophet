import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Upload, X, RotateCcw, FlipHorizontal, Award, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const ImageUploadZone = ({ label, sublabel, image, onImageSelect, onClear, disabled, testId, accent }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, [disabled]);

  const processFile = useCallback((file) => {
    if (!file || disabled) return null;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return 'Por favor sube una imagen JPEG, PNG o WEBP';
    }

    if (file.size > 10 * 1024 * 1024) {
      return 'La imagen es muy grande. Máximo 10MB';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      onImageSelect(e.target.result);
    };
    reader.readAsDataURL(file);
    return null;
  }, [onImageSelect, disabled]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile, disabled]);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const accentColor = accent === 'gold' ? '#eab308' : '#3b82f6';

  if (image) {
    return (
      <div className="relative aspect-[3/4] bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden group">
        <img
          src={image}
          alt={label}
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={onClear}
            disabled={disabled}
            className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors"
            data-testid={`${testId}-clear`}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute bottom-0 inset-x-0 py-2 px-3" style={{ backgroundColor: `${accentColor}dd` }}>
          <p className="text-xs text-white font-heading uppercase tracking-wider text-center font-semibold">
            {label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative aspect-[3/4] border-2 border-dashed rounded-lg
        transition-all duration-300 cursor-pointer
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${dragActive 
          ? `border-[${accentColor}] bg-[${accentColor}]/10` 
          : 'border-[#27272a] hover:border-[#3b82f6]/50 bg-[#121212]'
        }
      `}
      style={dragActive ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      data-testid={testId}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        <div className={`
          p-3 rounded-full transition-colors
          ${dragActive ? `bg-[${accentColor}]/20` : 'bg-[#1e1e1e]'}
        `}>
          {accent === 'gold' ? (
            <Award className={`w-6 h-6 ${dragActive ? 'text-[#eab308]' : 'text-gray-400'}`} />
          ) : (
            <Upload className={`w-6 h-6 ${dragActive ? 'text-[#3b82f6]' : 'text-gray-400'}`} />
          )}
        </div>
        
        <div className="text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wider text-white mb-1">
            {label}
          </p>
          {sublabel && (
            <p className="text-gray-500 text-xs">
              {sublabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const CardScanner = ({ onAnalysisComplete, isAnalyzing, setIsAnalyzing }) => {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showReferenceInfo, setShowReferenceInfo] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const analyzeCard = async () => {
    if (!frontImage) return;
    
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
        return prev + Math.random() * 10;
      });
    }, 400);

    try {
      const response = await fetch(`${API}/cards/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          front_image_base64: frontImage,
          back_image_base64: backImage,
          reference_image_base64: referenceImage,
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
        onAnalysisComplete(result, frontImage, backImage);
        setFrontImage(null);
        setBackImage(null);
        setReferenceImage(null);
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

  const clearAll = () => {
    setFrontImage(null);
    setBackImage(null);
    setReferenceImage(null);
    setError(null);
    setScanProgress(0);
  };

  const hasAnyImage = frontImage || backImage || referenceImage;

  return (
    <div className="w-full">
      {/* Main Card Upload Zones */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ImageUploadZone
          label="Frente"
          sublabel="Requerido"
          image={frontImage}
          onImageSelect={setFrontImage}
          onClear={() => setFrontImage(null)}
          disabled={isAnalyzing}
          testId="front-image-upload"
        />
        <ImageUploadZone
          label="Dorso"
          sublabel="Opcional"
          image={backImage}
          onImageSelect={setBackImage}
          onClear={() => setBackImage(null)}
          disabled={isAnalyzing}
          testId="back-image-upload"
        />
      </div>

      {/* Reference Image Section */}
      <div className="mb-6">
        <div 
          className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#27272a] rounded-t-lg cursor-pointer hover:bg-[#1e1e1e] transition-colors"
          onClick={() => setShowReferenceInfo(!showReferenceInfo)}
        >
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-[#eab308]" />
            <div>
              <p className="text-sm font-medium text-white">
                Imagen de Referencia PSA 10
              </p>
              <p className="text-xs text-gray-500">
                Sube un ejemplo de PSA 10 para comparación más precisa
              </p>
            </div>
          </div>
          <Info className={`w-4 h-4 text-gray-500 transition-transform ${showReferenceInfo ? 'rotate-180' : ''}`} />
        </div>
        
        <AnimatePresence>
          {showReferenceInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-[#121212] border border-t-0 border-[#27272a] rounded-b-lg">
                <p className="text-xs text-gray-400 mb-4">
                  Sube una imagen de una tarjeta PSA 10 de la misma tarjeta o set similar. 
                  El AI comparará tu tarjeta contra este estándar para dar un grado más preciso.
                </p>
                <div className="max-w-[200px]">
                  <ImageUploadZone
                    label="PSA 10 Ref"
                    sublabel="Opcional"
                    image={referenceImage}
                    onImageSelect={setReferenceImage}
                    onClear={() => setReferenceImage(null)}
                    disabled={isAnalyzing}
                    testId="reference-image-upload"
                    accent="gold"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-[#121212] border border-[#27272a] rounded-lg">
        <div className="flex items-start gap-3">
          <FlipHorizontal className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-medium mb-1">
              Análisis inteligente con ojo humano
            </p>
            <p className="text-xs text-gray-500">
              El AI evalúa como un experto PSA - no penaliza por artefactos de imagen. 
              {referenceImage && <span className="text-[#eab308]"> Comparando contra tu referencia PSA 10.</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Scanning Overlay */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-6 bg-[#121212] border border-[#3b82f6]/30 rounded-lg"
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <Scan className="w-8 h-8 text-[#3b82f6] animate-pulse" />
              <div className="text-center">
                <p className="font-heading text-lg uppercase tracking-wider text-white">
                  Analizando {referenceImage ? 'con referencia PSA 10' : backImage ? 'ambos lados' : 'tarjeta'}...
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  GPT-5.2 Vision evaluando como experto humano
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Progreso del análisis</span>
                <span className="font-mono text-[#3b82f6]">{Math.round(scanProgress)}%</span>
              </div>
              <Progress value={scanProgress} className="h-2" />
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
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
            data-testid="error-message"
          >
            <X className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {hasAnyImage && !isAnalyzing && (
          <Button
            variant="outline"
            onClick={clearAll}
            className="border-[#27272a] text-gray-400 hover:text-white hover:bg-white/5"
            data-testid="clear-all-btn"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
        )}
        <Button
          onClick={analyzeCard}
          disabled={!frontImage || isAnalyzing}
          className="flex-1 h-12 bg-white text-black hover:bg-gray-200 font-semibold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="analyze-btn"
        >
          <Scan className="w-5 h-5 mr-2" />
          {isAnalyzing ? 'Analizando...' : 'Analizar Tarjeta'}
        </Button>
      </div>
    </div>
  );
};

export default CardScanner;
