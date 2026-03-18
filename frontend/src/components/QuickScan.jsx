import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, X, RotateCcw, Check, Zap, ChevronRight,
  ArrowLeft, Loader2, Plus, Image as ImageIcon
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: 'collection', label: 'Collection' },
  { id: 'for_sale', label: 'For Sale' },
];

const QuickScan = ({ token, onClose, onCardAdded }) => {
  const [step, setStep] = useState('capture'); // capture | back | review | saving
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [identifying, setIdentifying] = useState(false);
  const [cardData, setCardData] = useState(null);
  const [category, setCategory] = useState('for_sale');
  const [saving, setSaving] = useState(false);
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  const compressImage = useCallback((file) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round((h / w) * MAX); w = MAX; }
          else { w = Math.round((w / h) * MAX); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const result = canvas.toDataURL('image/jpeg', 0.8);
        canvas.width = 0;
        canvas.height = 0;
        img.src = '';
        resolve(result);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }, []);

  const handleFrontCapture = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const dataUrl = await compressImage(file);
    setFrontImage(dataUrl);
    setStep('back');
  }, [compressImage]);

  const handleBackCapture = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const dataUrl = await compressImage(file);
    setBackImage(dataUrl);
    identifyCard(frontImage, dataUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compressImage, frontImage]);

  const skipBack = useCallback(() => {
    identifyCard(frontImage, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontImage]);

  const identifyCard = async (front, back) => {
    setIdentifying(true);
    setStep('review');
    try {
      const payload = { front_image_base64: front };
      if (back) payload.back_image_base64 = back;

      const res = await axios.post(`${API}/api/cards/identify`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCardData(res.data);
    } catch (err) {
      toast.error('Error identifying card');
      setCardData({
        card_name: 'Carta no identificada',
        player: '',
        year: null,
        set_name: '',
        card_number: '',
        variation: '',
        sport: '',
      });
    } finally {
      setIdentifying(false);
    }
  };

  const saveCard = async () => {
    if (!cardData) return;
    setSaving(true);
    try {
      const cardName = [
        cardData.year, cardData.set_name, cardData.player,
        cardData.card_number ? `#${cardData.card_number}` : '',
        cardData.variation
      ].filter(Boolean).join(' ') || cardData.card_name || 'Unknown Card';

      const payload = {
        card_name: cardName,
        player: cardData.player || null,
        year: cardData.year ? parseInt(cardData.year) : null,
        set_name: cardData.set_name || null,
        card_number: cardData.card_number || null,
        variation: cardData.variation || null,
        condition: cardData.is_graded ? 'Graded' : 'Raw',
        grading_company: cardData.grading_company || null,
        grade: cardData.grade || null,
        sport: cardData.sport || null,
        category,
        image_base64: frontImage,
        back_image_base64: backImage,
      };

      const res = await axios.post(`${API}/api/inventory`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Card saved to inventory');
      onCardAdded?.(res.data);
      onClose();
    } catch (err) {
      toast.error('Error saving card');
    } finally {
      setSaving(false);
    }
  };

  const retake = () => {
    setFrontImage(null);
    setBackImage(null);
    setCardData(null);
    setIdentifying(false);
    setStep('capture');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
      data-testid="quick-scan-overlay"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors" data-testid="quick-scan-close">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Close</span>
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-sm font-bold text-white">Quick Scan</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-6 py-3 shrink-0">
        {['Front', 'Back', 'Review'].map((label, i) => {
          const stepIndex = step === 'capture' ? 0 : step === 'back' ? 1 : 2;
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  isActive ? 'bg-[#3b82f6] text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-gray-600'
                }`}>
                  {isDone ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-600'}`}>{label}</span>
              </div>
              {i < 2 && <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Capture Front */}
          {step === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center justify-center h-full gap-6 py-8"
            >
              <div className="w-56 h-72 rounded-2xl border-2 border-dashed border-[#3b82f6]/40 flex flex-col items-center justify-center gap-3 bg-[#3b82f6]/5">
                <Camera className="w-12 h-12 text-[#3b82f6]/60" />
                <p className="text-sm text-gray-400 text-center px-4">Take a photo of the <strong className="text-white">front</strong> of the card</p>
              </div>
              <button
                onClick={() => frontInputRef.current?.click()}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#3b82f6] text-white font-bold text-sm hover:bg-[#2563eb] transition-colors active:scale-95"
                data-testid="quick-scan-capture-front"
              >
                <Camera className="w-5 h-5" /> Take Photo
              </button>
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFrontCapture}
                className="hidden"
                data-testid="quick-scan-front-input"
              />
              <p className="text-[11px] text-gray-600 text-center">AI will identify the card automatically</p>
            </motion.div>
          )}

          {/* Step 2: Back (optional) */}
          {step === 'back' && (
            <motion.div key="back" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center gap-5 py-6"
            >
              {/* Front preview */}
              <div className="flex items-center gap-3">
                <div className="w-20 h-28 rounded-lg overflow-hidden border border-emerald-500/30 shrink-0">
                  <img src={frontImage} alt="Front" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Front captured</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Now capture the back</p>
                </div>
              </div>

              <div className="w-56 h-72 rounded-2xl border-2 border-dashed border-amber-500/40 flex flex-col items-center justify-center gap-3 bg-amber-500/5">
                <RotateCcw className="w-12 h-12 text-amber-500/60" />
                <p className="text-sm text-gray-400 text-center px-4">Flip and take a photo of the <strong className="text-white">back</strong></p>
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={() => backInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors active:scale-95 w-full"
                  data-testid="quick-scan-capture-back"
                >
                  <Camera className="w-5 h-5" /> Back Photo
                </button>
                <button
                  onClick={skipBack}
                  className="text-xs text-gray-500 hover:text-white transition-colors py-2"
                  data-testid="quick-scan-skip-back"
                >
                  Skip - identify with front only
                </button>
              </div>
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleBackCapture}
                className="hidden"
                data-testid="quick-scan-back-input"
              />
            </motion.div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-4"
            >
              {/* Card images */}
              <div className="flex gap-3 justify-center">
                <div className="relative">
                  <div className="w-28 h-36 rounded-lg overflow-hidden border border-[#222]">
                    <img src={frontImage} alt="Front" className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] bg-[#3b82f6] text-white px-2 py-0.5 rounded-full font-bold">FRONT</span>
                </div>
                {backImage && (
                  <div className="relative">
                    <div className="w-28 h-36 rounded-lg overflow-hidden border border-[#222]">
                      <img src={backImage} alt="Back" className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold">BACK</span>
                  </div>
                )}
              </div>

              {/* AI identifying */}
              {identifying && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="w-14 h-14 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-[#3b82f6] animate-spin" />
                  </div>
                  <p className="text-sm text-gray-400">Identifying card with AI...</p>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Card data */}
              {cardData && !identifying && (
                <>
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#1a1a1a]">
                      <Zap className="w-4 h-4 text-[#3b82f6]" />
                      <span className="text-xs font-bold text-[#3b82f6] uppercase tracking-wider">AI Identification</span>
                    </div>

                    <div className="space-y-2.5">
                      <InfoRow label="Name" value={cardData.card_name} highlight data-testid="quick-scan-card-name" />
                      <InfoRow label="Player" value={cardData.player} data-testid="quick-scan-player" />
                      <div className="grid grid-cols-2 gap-2">
                        <InfoRow label="Year" value={cardData.year} data-testid="quick-scan-year" />
                        <InfoRow label="Sport" value={cardData.sport} data-testid="quick-scan-sport" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <InfoRow label="Set" value={cardData.set_name} data-testid="quick-scan-set" />
                        <InfoRow label="Number" value={cardData.card_number} data-testid="quick-scan-number" />
                      </div>
                      {cardData.variation && <InfoRow label="Variation" value={cardData.variation} data-testid="quick-scan-variation" />}
                      {cardData.is_graded && (
                        <div className="grid grid-cols-2 gap-2">
                          <InfoRow label="Grader" value={cardData.grading_company} />
                          <InfoRow label="Grade" value={cardData.grade} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.id} onClick={() => setCategory(c.id)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                          category === c.id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 border border-[#1a1a1a]'
                        }`}
                        data-testid={`quick-scan-cat-${c.id}`}
                      >{c.label}</button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={retake}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a1a1a] text-gray-400 font-semibold text-sm hover:text-white transition-colors"
                      data-testid="quick-scan-retake"
                    >
                      <RotateCcw className="w-4 h-4" /> Retake
                    </button>
                    <button onClick={saveCard} disabled={saving}
                      className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50 active:scale-[0.98]"
                      data-testid="quick-scan-save"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {saving ? 'Saving...' : 'Save to Inventory'}
                    </button>
                  </div>

                  {/* Scan another */}
                  <button onClick={() => { retake(); }}
                    className="w-full py-2.5 text-xs text-[#3b82f6] font-medium hover:underline"
                    data-testid="quick-scan-another"
                  >
                    Scan another card
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const InfoRow = ({ label, value, highlight, ...props }) => (
  <div {...props}>
    <span className="text-[10px] text-gray-600 uppercase tracking-wider block">{label}</span>
    <span className={`text-sm font-medium ${highlight ? 'text-white' : 'text-gray-300'} ${!value ? 'text-gray-600 italic' : ''}`}>
      {value || 'Not detected'}
    </span>
  </div>
);

export default QuickScan;
