import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Upload, X, RotateCcw, FlipHorizontal, Award, Info, Check, Library, Trash2, Loader2, CornerDownRight, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Input } from '../components/ui/input';

const ImageUploadZone = ({ label, sublabel, image, onImageSelect, onClear, disabled, testId, accent, small }) => {
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
  const aspectClass = small ? 'aspect-square' : 'aspect-[3/4]';

  if (image) {
    return (
      <div className={`relative ${aspectClass} bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden group`}>
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
        <div className="absolute bottom-0 inset-x-0 py-1.5 px-2" style={{ backgroundColor: `${accentColor}dd` }}>
          <p className="text-xs text-white font-heading uppercase tracking-wider text-center font-semibold truncate">
            {label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative ${aspectClass} border-2 border-dashed rounded-lg
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
      
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
        <div className={`p-2 rounded-full transition-colors ${dragActive ? `bg-[${accentColor}]/20` : 'bg-[#1e1e1e]'}`}>
          {accent === 'gold' ? (
            <Award className={`w-5 h-5 ${dragActive ? 'text-[#eab308]' : 'text-gray-400'}`} />
          ) : (
            <Upload className={`w-5 h-5 ${dragActive ? 'text-[#3b82f6]' : 'text-gray-400'}`} />
          )}
        </div>
        
        <div className="text-center">
          <p className="font-heading text-xs font-semibold uppercase tracking-wider text-white mb-0.5">
            {label}
          </p>
          {sublabel && (
            <p className="text-gray-500 text-[10px]">
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
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showReferenceSection, setShowReferenceSection] = useState(false);
  const [showCornersSection, setShowCornersSection] = useState(false);
  const [savedReferences, setSavedReferences] = useState([]);
  const [savingRef, setSavingRef] = useState(false);
  const [referenceMode, setReferenceMode] = useState('library');
  const [cardYear, setCardYear] = useState('');
  // Corner images state
  const [cornerTopLeft, setCornerTopLeft] = useState(null);
  const [cornerTopRight, setCornerTopRight] = useState(null);
  const [cornerBottomLeft, setCornerBottomLeft] = useState(null);
  const [cornerBottomRight, setCornerBottomRight] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  // Fetch saved references
  const fetchReferences = useCallback(async () => {
    try {
      const response = await fetch(`${API}/references`);
      if (response.ok) {
        const data = await response.json();
        setSavedReferences(data);
      }
    } catch (err) {
      console.error('Failed to fetch references:', err);
    }
  }, [API]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  // Auto-save reference when image is uploaded
  const saveReference = async (imageData) => {
    setSavingRef(true);
    try {
      const response = await fetch(`${API}/references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageData
          // name is omitted - backend will auto-read from PSA label
        })
      });
      
      if (response.ok) {
        const saved = await response.json();
        setSavedReferences(prev => [saved, ...prev]);
        setReferenceImage(null);
        setSelectedReferenceId(saved.id);
        setReferenceMode('library');
      }
    } catch (err) {
      console.error('Failed to save reference:', err);
    } finally {
      setSavingRef(false);
    }
  };

  // Handle reference image selection - auto save
  const handleReferenceImageSelect = (imageData) => {
    setReferenceImage(imageData);
    // Automatically save the reference
    saveReference(imageData);
  };

  // Delete reference
  const deleteReference = async (refId, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API}/references/${refId}`, { method: 'DELETE' });
      if (response.ok) {
        setSavedReferences(prev => prev.filter(r => r.id !== refId));
        if (selectedReferenceId === refId) {
          setSelectedReferenceId(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete reference:', err);
    }
  };

  const analyzeCard = async () => {
    if (!frontImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    setScanProgress(0);

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
      const requestBody = {
        front_image_base64: frontImage,
        back_image_base64: backImage,
      };

      // Add card year if provided (for vintage consideration)
      if (cardYear && !isNaN(parseInt(cardYear))) {
        requestBody.card_year = parseInt(cardYear);
      }

      // Add reference from library if selected
      if (selectedReferenceId) {
        requestBody.reference_id = selectedReferenceId;
      }

      // Add corner images if provided (for detailed corner analysis)
      if (cornerTopLeft) requestBody.corner_top_left = cornerTopLeft;
      if (cornerTopRight) requestBody.corner_top_right = cornerTopRight;
      if (cornerBottomLeft) requestBody.corner_bottom_left = cornerBottomLeft;
      if (cornerBottomRight) requestBody.corner_bottom_right = cornerBottomRight;

      const response = await fetch(`${API}/cards/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
    setCornerTopLeft(null);
    setCornerTopRight(null);
    setCornerBottomLeft(null);
    setCornerBottomRight(null);
    setError(null);
    setScanProgress(0);
  };

  const hasAnyImage = frontImage || backImage;
  const hasReference = selectedReferenceId !== null;
  const hasCorners = cornerTopLeft || cornerTopRight || cornerBottomLeft || cornerBottomRight;
  const cornerCount = [cornerTopLeft, cornerTopRight, cornerBottomLeft, cornerBottomRight].filter(Boolean).length;

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

      {/* Corner Photos Section */}
      <div className="mb-4">
        <div 
          className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#27272a] rounded-lg cursor-pointer hover:bg-[#1e1e1e] transition-colors"
          onClick={() => setShowCornersSection(!showCornersSection)}
        >
          <div className="flex items-center gap-3">
            <CornerDownRight className="w-5 h-5 text-[#3b82f6]" />
            <div>
              <p className="text-sm font-medium text-white">
                Fotos de Esquinas {hasCorners && <Check className="w-4 h-4 inline text-green-500 ml-1" />}
              </p>
              <p className="text-xs text-gray-500">
                {hasCorners ? `${cornerCount}/4 esquinas` : 'Opcional - Para análisis más detallado'}
              </p>
            </div>
          </div>
          <Info className={`w-4 h-4 text-gray-500 transition-transform ${showCornersSection ? 'rotate-180' : ''}`} />
        </div>
        
        <AnimatePresence>
          {showCornersSection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-[#121212] border border-t-0 border-[#27272a] rounded-b-lg">
                <p className="text-xs text-gray-400 mb-3">
                  Sube fotos cercanas de cada esquina (como las de eBay) para un análisis más preciso de las esquinas.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <ImageUploadZone
                    label="↖ Izq"
                    image={cornerTopLeft}
                    onImageSelect={setCornerTopLeft}
                    onClear={() => setCornerTopLeft(null)}
                    disabled={isAnalyzing}
                    testId="corner-top-left"
                    small
                  />
                  <ImageUploadZone
                    label="↗ Der"
                    image={cornerTopRight}
                    onImageSelect={setCornerTopRight}
                    onClear={() => setCornerTopRight(null)}
                    disabled={isAnalyzing}
                    testId="corner-top-right"
                    small
                  />
                  <ImageUploadZone
                    label="↙ Izq"
                    image={cornerBottomLeft}
                    onImageSelect={setCornerBottomLeft}
                    onClear={() => setCornerBottomLeft(null)}
                    disabled={isAnalyzing}
                    testId="corner-bottom-left"
                    small
                  />
                  <ImageUploadZone
                    label="↘ Der"
                    image={cornerBottomRight}
                    onImageSelect={setCornerBottomRight}
                    onClear={() => setCornerBottomRight(null)}
                    disabled={isAnalyzing}
                    testId="corner-bottom-right"
                    small
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* PSA 10 Reference Section */}
      <div className="mb-6">
        <div 
          className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#27272a] rounded-t-lg cursor-pointer hover:bg-[#1e1e1e] transition-colors"
          onClick={() => setShowReferenceSection(!showReferenceSection)}
        >
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-[#eab308]" />
            <div>
              <p className="text-sm font-medium text-white">
                Referencia PSA 10 {hasReference && <Check className="w-4 h-4 inline text-green-500 ml-1" />}
              </p>
              <p className="text-xs text-gray-500">
                {savedReferences.length > 0 ? `${savedReferences.length} en biblioteca` : 'Sube un PSA 10 para comparar'}
              </p>
            </div>
          </div>
          <Info className={`w-4 h-4 text-gray-500 transition-transform ${showReferenceSection ? 'rotate-180' : ''}`} />
        </div>
        
        <AnimatePresence>
          {showReferenceSection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-[#121212] border border-t-0 border-[#27272a] rounded-b-lg">
                {/* Saving indicator */}
                {savingRef && (
                  <div className="mb-4 p-3 bg-[#eab308]/10 border border-[#eab308]/30 rounded-lg flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#eab308] animate-spin" />
                    <div>
                      <p className="text-sm text-[#eab308] font-medium">Leyendo label del PSA...</p>
                      <p className="text-xs text-gray-500">Extrayendo información automáticamente</p>
                    </div>
                  </div>
                )}

                {/* Library Grid */}
                {savedReferences.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Tu Biblioteca</p>
                    <ScrollArea className="h-[180px]">
                      <div className="grid grid-cols-3 gap-2">
                        {savedReferences.map((ref) => (
                          <div
                            key={ref.id}
                            onClick={() => setSelectedReferenceId(ref.id === selectedReferenceId ? null : ref.id)}
                            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              selectedReferenceId === ref.id 
                                ? 'border-[#eab308] shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                                : 'border-transparent hover:border-[#27272a]'
                            }`}
                          >
                            <div className="aspect-[3/4] bg-[#1e1e1e]">
                              <img
                                src={`data:image/jpeg;base64,${ref.image_preview}`}
                                alt={ref.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1.5">
                              <p className="text-[9px] text-white truncate leading-tight">{ref.name}</p>
                            </div>
                            {selectedReferenceId === ref.id && (
                              <div className="absolute top-1 right-1 bg-[#eab308] rounded-full p-0.5">
                                <Check className="w-3 h-3 text-black" />
                              </div>
                            )}
                            <button
                              onClick={(e) => deleteReference(ref.id, e)}
                              className="absolute top-1 left-1 p-1 bg-red-500/80 rounded-full opacity-0 hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Add New Reference */}
                <div className="pt-3 border-t border-[#27272a]">
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Agregar Nueva Referencia</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Sube una foto del PSA 10 - el sistema leerá el label automáticamente
                  </p>
                  <div className="w-24">
                    <ImageUploadZone
                      label="PSA 10"
                      image={referenceImage}
                      onImageSelect={handleReferenceImageSelect}
                      onClear={() => setReferenceImage(null)}
                      disabled={isAnalyzing || savingRef}
                      testId="reference-image-upload"
                      accent="gold"
                      small
                    />
                  </div>
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
              {hasReference && <span className="text-[#eab308]"> Comparando contra referencia PSA 10.</span>}
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
                  Analizando {hasReference ? 'con referencia PSA 10' : backImage ? 'ambos lados' : 'tarjeta'}...
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
