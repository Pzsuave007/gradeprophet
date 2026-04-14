import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Upload, X, RotateCcw, FlipHorizontal, Award, Info, Check, Trash2, Loader2, CornerDownRight, Calendar, Link, Scissors, Crop } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Input } from '../components/ui/input';
import ImageCropper from './ImageCropper';

const ImageUploadZone = ({ label, sublabel, image, onImageSelect, onClear, disabled, testId, accent, small }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, [disabled]);

  const compressToWebP = useCallback((dataUrl) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h / w) * MAX); w = MAX; }
          else { w = Math.round((w / h) * MAX); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const result = canvas.toDataURL('image/webp', 0.92);
        canvas.width = 0;
        canvas.height = 0;
        resolve(result);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }, []);

  const processFile = useCallback((file) => {
    if (!file || disabled) return null;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) return 'Please upload a JPEG, PNG, or WEBP image';
    if (file.size > 10 * 1024 * 1024) return 'Image is too large. Max 10MB';
    const reader = new FileReader();
    reader.onload = async (e) => {
      const compressed = await compressToWebP(e.target.result);
      onImageSelect(compressed);
    };
    reader.readAsDataURL(file);
    return null;
  }, [onImageSelect, disabled, compressToWebP]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  }, [processFile, disabled]);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  }, [processFile]);

  const accentColor = accent === 'gold' ? '#eab308' : '#3b82f6';

  if (image) {
    return (
      <div className={`relative ${small ? 'aspect-square' : 'aspect-[5/4]'} bg-[#121212] border border-[#1a1a1a] rounded-lg overflow-hidden group`}>
        <img src={image} alt={label} className="w-full h-full object-contain" />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button onClick={onClear} disabled={disabled} className="p-2 rounded-full bg-red-500/80 hover:bg-red-500" data-testid={`${testId}-clear`}>
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute bottom-0 inset-x-0 py-1 px-2" style={{ backgroundColor: `${accentColor}dd` }}>
          <p className="text-xs text-white font-heading uppercase tracking-wider text-center font-semibold truncate">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative ${small ? 'aspect-square' : 'aspect-[5/4]'} border-2 border-dashed rounded-lg transition-all duration-300 cursor-pointer
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${dragActive ? 'border-[#3b82f6] bg-[#3b82f6]/5' : 'border-[#27272a] hover:border-[#3b82f6]/50 bg-[#0f0f0f]'}`}
      style={dragActive ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
      onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()} data-testid={testId}
    >
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" disabled={disabled} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2">
        <Upload className={`w-5 h-5 ${dragActive ? 'text-[#3b82f6]' : 'text-gray-600'}`} />
        <p className="font-heading text-xs font-semibold uppercase tracking-wider text-white">{label}</p>
        {sublabel && <p className="text-gray-600 text-[10px]">{sublabel}</p>}
      </div>
    </div>
  );
};

const CardScanner = ({ onAnalysisComplete, isAnalyzing, setIsAnalyzing, ebayUrlToImport, onEbayImportComplete, initialCard, onInitialCardConsumed }) => {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showReferenceSection, setShowReferenceSection] = useState(false);
  const [showCornersSection, setShowCornersSection] = useState(true);
  const [savedReferences, setSavedReferences] = useState([]);
  const [savingRef, setSavingRef] = useState(false);
  const [cardYear, setCardYear] = useState('');
  const [cornerTopLeft, setCornerTopLeft] = useState(null);
  const [cornerTopRight, setCornerTopRight] = useState(null);
  const [cornerBottomLeft, setCornerBottomLeft] = useState(null);
  const [cornerBottomRight, setCornerBottomRight] = useState(null);
  const [showEbayImport, setShowEbayImport] = useState(false);
  const [ebayUrl, setEbayUrl] = useState('');
  const [ebayImages, setEbayImages] = useState([]);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState(null);
  const [ebayTitle, setEbayTitle] = useState('');
  const [selectedEbayIdx, setSelectedEbayIdx] = useState(null);
  const [croppingImage, setCroppingImage] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  // Load card from inventory when passed via initialCard
  useEffect(() => {
    if (!initialCard) return;
    const loadCard = async () => {
      try {
        const res = await fetch(`${API}/inventory/${initialCard.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.image) setFrontImage(`data:image/jpeg;base64,${data.image}`);
          if (data.back_image) setBackImage(`data:image/jpeg;base64,${data.back_image}`);
          if (data.year) setCardYear(String(data.year));
        }
      } catch {}
      if (onInitialCardConsumed) onInitialCardConsumed();
    };
    loadCard();
  }, [initialCard]);

  const fetchReferences = useCallback(async () => {
    try {
      const response = await fetch(`${API}/references`);
      if (response.ok) setSavedReferences(await response.json());
    } catch (err) { console.error('Failed to fetch references:', err); }
  }, [API]);

  useEffect(() => { fetchReferences(); }, [fetchReferences]);

  useEffect(() => {
    if (ebayUrlToImport) {
      setShowEbayImport(true);
      setEbayUrl(ebayUrlToImport);
      const autoImport = async () => {
        setEbayLoading(true); setEbayError(null); setEbayImages([]);
        try {
          const response = await fetch(`${API}/ebay/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ebayUrlToImport }) });
          const data = await response.json();
          if (data.success && data.images.length > 0) { setEbayImages(data.images); setEbayTitle(data.title || ''); }
          else setEbayError(data.error || 'No images found');
        } catch (err) { setEbayError('Error importing from eBay'); }
        finally { setEbayLoading(false); }
      };
      autoImport();
      if (onEbayImportComplete) setTimeout(() => onEbayImportComplete(), 100);
    }
  }, [ebayUrlToImport, API, onEbayImportComplete]);

  const importFromEbay = async () => {
    if (!ebayUrl.trim()) return;
    setEbayLoading(true); setEbayError(null); setEbayImages([]);
    try {
      const response = await fetch(`${API}/ebay/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ebayUrl }) });
      const data = await response.json();
      if (data.success && data.images.length > 0) { setEbayImages(data.images); setEbayTitle(data.title || ''); }
      else setEbayError(data.error || 'No images found');
    } catch (err) { setEbayError('Error importing from eBay'); }
    finally { setEbayLoading(false); }
  };

  const assignEbayImage = (imageData, type) => {
    const b64 = `data:image/jpeg;base64,${imageData}`;
    if (type === 'front') setFrontImage(b64);
    else if (type === 'back') setBackImage(b64);
    else if (type === 'corner_tl') setCornerTopLeft(b64);
    else if (type === 'corner_tr') setCornerTopRight(b64);
    else if (type === 'corner_bl') setCornerBottomLeft(b64);
    else if (type === 'corner_br') setCornerBottomRight(b64);
  };

  const autoCropCorners = async () => {
    if (!frontImage) return;
    try {
      const response = await fetch(`${API}/corners/crop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: frontImage }) });
      if (response.ok) {
        const corners = await response.json();
        setCornerTopLeft(`data:image/jpeg;base64,${corners.top_left}`);
        setCornerTopRight(`data:image/jpeg;base64,${corners.top_right}`);
        setCornerBottomLeft(`data:image/jpeg;base64,${corners.bottom_left}`);
        setCornerBottomRight(`data:image/jpeg;base64,${corners.bottom_right}`);
        setShowCornersSection(true);
      }
    } catch (err) { console.error('Failed to auto-crop corners:', err); }
  };

  const clearEbayImport = () => { setEbayUrl(''); setEbayImages([]); setEbayError(null); setEbayTitle(''); setSelectedEbayIdx(null); };

  const saveReference = async (imageData) => {
    setSavingRef(true);
    try {
      const response = await fetch(`${API}/references`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: imageData }) });
      if (response.ok) {
        const saved = await response.json();
        setSavedReferences(prev => [saved, ...prev]);
        setReferenceImage(null);
        setSelectedReferenceId(saved.id);
      }
    } catch (err) { console.error('Failed to save reference:', err); }
    finally { setSavingRef(false); }
  };

  const handleReferenceImageSelect = (imageData) => { setReferenceImage(imageData); saveReference(imageData); };

  const deleteReference = async (refId, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API}/references/${refId}`, { method: 'DELETE' });
      if (response.ok) { setSavedReferences(prev => prev.filter(r => r.id !== refId)); if (selectedReferenceId === refId) setSelectedReferenceId(null); }
    } catch (err) { console.error('Failed to delete reference:', err); }
  };

  const analyzeCard = async () => {
    if (!frontImage) return;
    setIsAnalyzing(true); setError(null); setScanProgress(0);
    const progressInterval = setInterval(() => {
      setScanProgress(prev => { if (prev >= 90) { clearInterval(progressInterval); return 90; } return prev + Math.random() * 10; });
    }, 400);
    try {
      const requestBody = { front_image_base64: frontImage, back_image_base64: backImage, scanner_mode: true };
      if (cardYear && !isNaN(parseInt(cardYear))) requestBody.card_year = parseInt(cardYear);
      if (selectedReferenceId) requestBody.reference_id = selectedReferenceId;
      if (cornerTopLeft) requestBody.corner_top_left = cornerTopLeft;
      if (cornerTopRight) requestBody.corner_top_right = cornerTopRight;
      if (cornerBottomLeft) requestBody.corner_bottom_left = cornerBottomLeft;
      if (cornerBottomRight) requestBody.corner_bottom_right = cornerBottomRight;
      const response = await fetch(`${API}/cards/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(requestBody) });
      clearInterval(progressInterval); setScanProgress(100);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          throw new Error(errorData.detail || 'Scan limit reached. Upgrade your plan for more AI scans.');
        }
        throw new Error(errorData.detail || 'Analysis failed');
      }
      const result = await response.json();
      setTimeout(() => { onAnalysisComplete(result, frontImage, backImage); setFrontImage(null); setBackImage(null); setScanProgress(0); setIsAnalyzing(false); }, 500);
    } catch (err) { clearInterval(progressInterval); setError(err.message || 'Analysis failed'); setScanProgress(0); setIsAnalyzing(false); }
  };

  const clearAll = () => { setFrontImage(null); setBackImage(null); setReferenceImage(null); setCornerTopLeft(null); setCornerTopRight(null); setCornerBottomLeft(null); setCornerBottomRight(null); setCardYear(''); setError(null); setScanProgress(0); };

  const hasAnyImage = frontImage || backImage;
  const hasReference = selectedReferenceId !== null;
  const hasCorners = cornerTopLeft || cornerTopRight || cornerBottomLeft || cornerBottomRight;
  const cornerCount = [cornerTopLeft, cornerTopRight, cornerBottomLeft, cornerBottomRight].filter(Boolean).length;
  const hasYear = cardYear && !isNaN(parseInt(cardYear));

  const getVintageLabel = (year) => {
    if (!year) return null;
    const y = parseInt(year);
    if (isNaN(y)) return null;
    if (y <= 1979) return { text: 'Vintage (Pre-1980)', color: 'text-amber-400' };
    if (y <= 1989) return { text: 'Vintage (80s)', color: 'text-amber-400' };
    if (y <= 1999) return { text: 'Semi-Vintage (90s)', color: 'text-yellow-400' };
    if (y <= 2009) return { text: '2000s', color: 'text-blue-400' };
    return { text: 'Moderna', color: 'text-gray-400' };
  };
  const vintageLabel = getVintageLabel(cardYear);

  return (
    <div className="w-full">
      {/* Two Column Layout on Desktop */}
      <div className="grid lg:grid-cols-5 gap-4">
        
        {/* LEFT: Images (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          {/* eBay Import - Compact */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setShowEbayImport(!showEbayImport)}>
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-[#22c55e]" />
                <span className="text-sm text-white font-medium">Import from eBay</span>
              </div>
              <span className="text-gray-600 text-sm">{showEbayImport ? '−' : '+'}</span>
            </div>
            {showEbayImport && (
              <div className="px-3 pb-3 border-t border-[#1a1a1a]">
                <div className="flex gap-2 mt-2">
                  <Input type="url" placeholder="https://ebay.com/itm/..." value={ebayUrl} onChange={(e) => setEbayUrl(e.target.value)}
                    disabled={ebayLoading} className="bg-[#0a0a0a] border-[#1a1a1a] text-white flex-1 h-8 text-sm" data-testid="ebay-url-input" />
                  <Button onClick={importFromEbay} disabled={ebayLoading || !ebayUrl.trim()} className="bg-[#22c55e] hover:bg-[#16a34a] h-8 px-3 text-sm" data-testid="ebay-import-btn">
                    {ebayLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Import'}
                  </Button>
                </div>
                {ebayError && <p className="text-red-400 text-xs mt-2">{ebayError}</p>}
                {ebayTitle && <p className="text-gray-500 text-xs mt-2 truncate">{ebayTitle}</p>}
                {ebayImages.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-600 mb-1.5">Click image to assign:</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {ebayImages.map((img, idx) => (
                        <div key={idx} className="relative">
                          <img src={`data:image/jpeg;base64,${img.thumbnail}`} alt={`eBay ${idx + 1}`}
                            className="w-full aspect-square object-cover rounded border border-[#1a1a1a] cursor-pointer hover:border-[#3b82f6] transition-colors"
                            onClick={() => setSelectedEbayIdx(selectedEbayIdx === idx ? null : idx)} />
                          {selectedEbayIdx === idx && (
                            <div className="absolute inset-0 bg-black/90 rounded flex flex-col items-center justify-center gap-0.5 p-1 z-10">
                              <button onClick={(e) => { e.stopPropagation(); assignEbayImage(img.base64, 'front'); setSelectedEbayIdx(null); }}
                                className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded w-full">Front</button>
                              <button onClick={(e) => { e.stopPropagation(); assignEbayImage(img.base64, 'back'); setSelectedEbayIdx(null); }}
                                className="text-[10px] bg-purple-600 text-white px-2 py-1 rounded w-full">Back</button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedEbayIdx(null); }}
                                className="text-[9px] text-gray-500 mt-0.5">Close</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={clearEbayImport} className="text-xs text-gray-500 hover:text-white mt-2">Limpiar</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Front + Back Side by Side - Compact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ImageUploadZone label="Front" sublabel="Required" image={frontImage} onImageSelect={setFrontImage}
                onClear={() => setFrontImage(null)} disabled={isAnalyzing} testId="front-image-upload" />
              {frontImage && !isAnalyzing && (
                <button onClick={() => setCroppingImage('front')}
                  className="flex items-center justify-center gap-1.5 w-full mt-1.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                  data-testid="crop-front-btn">
                  <Crop className="w-3 h-3" /> Crop
                </button>
              )}
            </div>
            <div>
              <ImageUploadZone label="Back" sublabel="Optional" image={backImage} onImageSelect={setBackImage}
                onClear={() => setBackImage(null)} disabled={isAnalyzing} testId="back-image-upload" />
              {backImage && !isAnalyzing && (
                <button onClick={() => setCroppingImage('back')}
                  className="flex items-center justify-center gap-1.5 w-full mt-1.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                  data-testid="crop-back-btn">
                  <Crop className="w-3 h-3" /> Crop
                </button>
              )}
            </div>
          </div>

          {/* Crop Modal */}
          {croppingImage && (
            <ImageCropper
              imageSrc={croppingImage === 'front' ? frontImage : backImage}
              onCropDone={(cropped) => {
                if (croppingImage === 'front') setFrontImage(cropped);
                else setBackImage(cropped);
                setCroppingImage(null);
              }}
              onCancel={() => setCroppingImage(null)}
            />
          )}

          {/* Corners - Always visible, compact row */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CornerDownRight className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span className="text-xs text-white font-medium">Corners {hasCorners && <Check className="w-3 h-3 inline text-green-500 ml-1" />}</span>
              </div>
              {frontImage && !hasCorners && (
                <Button onClick={autoCropCorners} variant="ghost" size="sm" className="text-[#3b82f6] h-6 text-[10px] px-2" data-testid="auto-crop-corners-btn">
                  <Scissors className="w-3 h-3 mr-1" />Auto-generar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <ImageUploadZone label="↖" image={cornerTopLeft} onImageSelect={setCornerTopLeft} onClear={() => setCornerTopLeft(null)} disabled={isAnalyzing} testId="corner-top-left" small />
              <ImageUploadZone label="↗" image={cornerTopRight} onImageSelect={setCornerTopRight} onClear={() => setCornerTopRight(null)} disabled={isAnalyzing} testId="corner-top-right" small />
              <ImageUploadZone label="↙" image={cornerBottomLeft} onImageSelect={setCornerBottomLeft} onClear={() => setCornerBottomLeft(null)} disabled={isAnalyzing} testId="corner-bottom-left" small />
              <ImageUploadZone label="↘" image={cornerBottomRight} onImageSelect={setCornerBottomRight} onClear={() => setCornerBottomRight(null)} disabled={isAnalyzing} testId="corner-bottom-right" small />
            </div>
          </div>
        </div>

        {/* RIGHT: Options + Actions (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Card Year */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-sm text-white font-medium">Card Year</span>
              {vintageLabel && <span className={`text-xs ${vintageLabel.color}`}>({vintageLabel.text})</span>}
            </div>
            <Input type="number" placeholder="Auto-detect" value={cardYear} onChange={(e) => setCardYear(e.target.value)}
              disabled={isAnalyzing} className="bg-[#0a0a0a] border-[#1a1a1a] text-white h-8 text-sm" min="1900" max="2025" data-testid="card-year-input" />
            <p className="text-[10px] text-gray-600 mt-1">
              {hasReference ? 'Will use PSA 10 reference year' : 'AI will auto-detect the era'}
            </p>
          </div>

          {/* PSA 10 Reference */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5"
              onClick={() => setShowReferenceSection(!showReferenceSection)}>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#eab308]" />
                <span className="text-sm text-white font-medium">PSA 10 Ref {hasReference && <Check className="w-3 h-3 inline text-green-500 ml-1" />}</span>
                <span className="text-xs text-gray-600">{savedReferences.length > 0 ? `${savedReferences.length} guardadas` : ''}</span>
              </div>
              <span className="text-gray-600 text-sm">{showReferenceSection ? '−' : '+'}</span>
            </div>
            <AnimatePresence>
              {showReferenceSection && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-3 pb-3 border-t border-[#1a1a1a] pt-2">
                    {savingRef && (
                      <div className="mb-2 p-2 bg-[#eab308]/10 border border-[#eab308]/30 rounded flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-[#eab308] animate-spin" />
                        <span className="text-xs text-[#eab308]">Leyendo label PSA...</span>
                      </div>
                    )}
                    {savedReferences.length > 0 && (
                      <ScrollArea className="h-[200px] mb-2">
                        <div className="grid grid-cols-3 gap-1.5">
                          {savedReferences.map((ref) => (
                            <div key={ref.id} onClick={() => setSelectedReferenceId(ref.id === selectedReferenceId ? null : ref.id)}
                              className={`relative cursor-pointer rounded overflow-hidden border-2 transition-all ${
                                selectedReferenceId === ref.id ? 'border-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.3)]' : 'border-transparent hover:border-[#27272a]'}`}>
                              <div className="aspect-[3/4] bg-[#1e1e1e]">
                                <img src={`data:image/jpeg;base64,${ref.image_preview}`} alt={ref.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1">
                                <p className="text-[8px] text-white truncate">{ref.name}</p>
                              </div>
                              {selectedReferenceId === ref.id && (
                                <div className="absolute top-0.5 right-0.5 bg-[#eab308] rounded-full p-0.5"><Check className="w-2.5 h-2.5 text-black" /></div>
                              )}
                              <button onClick={(e) => deleteReference(ref.id, e)}
                                className="absolute top-0.5 left-0.5 p-0.5 bg-red-500/80 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                                <Trash2 className="w-2.5 h-2.5 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    <div className="pt-2 border-t border-[#1a1a1a]">
                      <p className="text-[10px] text-gray-600 mb-1.5">Add new reference:</p>
                      <div className="w-16">
                        <ImageUploadZone label="PSA 10" image={referenceImage} onImageSelect={handleReferenceImageSelect}
                          onClear={() => setReferenceImage(null)} disabled={isAnalyzing || savingRef} testId="reference-image-upload" accent="gold" small />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Analysis Info */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FlipHorizontal className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-white font-medium mb-0.5">Expert Eye Analysis</p>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Does not penalize image artifacts.
                  {hasReference && <span className="text-[#eab308]"> Comparando vs PSA 10.</span>}
                  {!hasReference && !hasYear && <span className="text-amber-400"> Auto-detecta la era.</span>}
                  {hasYear && vintageLabel && <span className="text-amber-400"> Ajustado para {vintageLabel.text.toLowerCase()}.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Analyze Button */}
          <Button onClick={analyzeCard} disabled={!frontImage || isAnalyzing}
            className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold uppercase tracking-wider text-sm disabled:opacity-30" data-testid="analyze-btn">
            <Scan className="w-5 h-5 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'Analyze Card'}
          </Button>

          {hasAnyImage && !isAnalyzing && (
            <Button variant="outline" onClick={clearAll} className="w-full border-[#1a1a1a] text-gray-500 hover:text-white h-8 text-xs" data-testid="clear-all-btn">
              <RotateCcw className="w-3 h-3 mr-1" /> Limpiar Todo
            </Button>
          )}

          {/* Scanning Progress */}
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-3 bg-[#111] border border-[#3b82f6]/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Scan className="w-4 h-4 text-[#3b82f6] animate-pulse" />
                  <span className="text-sm text-white">Analyzing...</span>
                </div>
                <Progress value={scanProgress} className="h-1.5" />
                <p className="text-[10px] text-gray-600 mt-1">GPT-4o Vision evaluando</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2" data-testid="error-message">
                <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default CardScanner;
