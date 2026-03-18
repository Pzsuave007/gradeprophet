import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, ChevronLeft, Save, RefreshCw, Trash2, Eye,
  Image as ImageIcon, Check, AlertCircle, Layers, Edit2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CONDITIONS = ['Raw', 'Graded'];
const GRADING_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'HGA'];

// ============ STEP 1: UPLOAD & PAIR FILES ============
const UploadStep = ({ onFilesReady }) => {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [pairingMode, setPairingMode] = useState('alternating'); // alternating = front,back,front,back
  const [category, setCategory] = useState('collection');

  const handleFiles = (newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { toast.error('No image files found'); return; }
    // Sort by filename for consistent pairing
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setFiles(prev => [...prev, ...imageFiles]);
    toast.success(`${imageFiles.length} images added`);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const getPairs = () => {
    if (pairingMode === 'alternating') {
      // front1, back1, front2, back2...
      const pairs = [];
      for (let i = 0; i < files.length; i += 2) {
        pairs.push({
          front: files[i],
          back: files[i + 1] || null,
        });
      }
      return pairs;
    } else {
      // front only
      return files.map(f => ({ front: f, back: null }));
    }
  };

  const pairs = getPairs();
  const cardCount = pairs.length;

  const proceed = () => {
    if (files.length === 0) { toast.error('Upload some images first'); return; }
    onFilesReady(pairs, category);
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none transition-colors";

  return (
    <div className="space-y-5">
      {/* Category selection */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-2 font-medium">Save All Cards To</label>
        <div className="flex gap-2">
          {[{ val: 'collection', label: 'Collection' }, { val: 'for_sale', label: 'For Sale' }].map(({ val, label }) => (
            <button key={val} type="button" onClick={() => setCategory(val)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${category === val ? (val === 'for_sale' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]') : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-white'}`}
              data-testid={`batch-category-${val}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Pairing mode */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-gray-500 mb-2 font-medium">Image Pairing</label>
        <div className="flex gap-2">
          <button onClick={() => setPairingMode('alternating')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${pairingMode === 'alternating' ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-white'}`}
            data-testid="pairing-alternating">
            Front + Back (Alternating)
          </button>
          <button onClick={() => setPairingMode('front_only')}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${pairingMode === 'front_only' ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-white'}`}
            data-testid="pairing-front-only">
            Front Only
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5">
          {pairingMode === 'alternating'
            ? 'Files sorted by name: 1st=front, 2nd=back, 3rd=front, 4th=back...'
            : 'Each file is the front of a different card'}
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop} onDragOver={handleDragOver}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-[#222] hover:border-[#3b82f6]/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
        data-testid="batch-drop-zone"
      >
        <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400 mb-1">Drag & drop scanned images here</p>
        <p className="text-xs text-gray-600">or click to select files</p>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} className="hidden" />
      </div>

      {/* File list & pairs preview */}
      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">{files.length} images = {cardCount} card{cardCount !== 1 ? 's' : ''}</h3>
            <button onClick={() => setFiles([])} className="text-xs text-gray-500 hover:text-red-400 transition-colors" data-testid="clear-all-files">Clear All</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {pairs.map((pair, i) => (
              <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-2 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium text-center">Card {i + 1}</p>
                <div className="flex gap-1.5">
                  {/* Front thumbnail */}
                  <div className="flex-1 aspect-[3/4] bg-[#0a0a0a] rounded-lg overflow-hidden relative">
                    <img src={URL.createObjectURL(pair.front)} alt={`Front ${i+1}`} className="w-full h-full object-contain" />
                    <span className="absolute bottom-1 left-1 text-[7px] px-1 py-0.5 rounded bg-[#3b82f6]/80 text-white uppercase">Front</span>
                  </div>
                  {/* Back thumbnail */}
                  <div className="flex-1 aspect-[3/4] bg-[#0a0a0a] rounded-lg overflow-hidden relative">
                    {pair.back ? (
                      <>
                        <img src={URL.createObjectURL(pair.back)} alt={`Back ${i+1}`} className="w-full h-full object-contain" />
                        <span className="absolute bottom-1 left-1 text-[7px] px-1 py-0.5 rounded bg-amber-500/80 text-white uppercase">Back</span>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[8px] text-gray-600">No back</span>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => { removeFile(pairingMode === 'alternating' ? i*2 : i); if (pair.back && pairingMode === 'alternating') removeFile(i*2); }}
                  className="w-full text-center text-[9px] text-gray-600 hover:text-red-400 py-0.5" data-testid={`remove-pair-${i}`}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proceed button */}
      {files.length > 0 && (
        <div className="flex justify-end">
          <button onClick={proceed}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors"
            data-testid="batch-identify-btn">
            <Layers className="w-4 h-4" /> Identify {cardCount} Cards with AI
          </button>
        </div>
      )}
    </div>
  );
};

// ============ STEP 2: AI IDENTIFICATION + REVIEW ============
const ReviewStep = ({ pairs, category, onBack, onComplete }) => {
  const [cards, setCards] = useState(() =>
    pairs.map((p, i) => ({
      idx: i,
      status: 'pending', // pending, identifying, identified, error
      frontFile: p.front,
      backFile: p.back,
      frontPreview: URL.createObjectURL(p.front),
      backPreview: p.back ? URL.createObjectURL(p.back) : null,
      frontBase64: null,
      backBase64: null,
      card_name: '', player: '', year: '', set_name: '', card_number: '',
      variation: '', condition: 'Raw', grading_company: '', grade: '',
      purchase_price: '', sport: '', quantity: 1, notes: '',
    }))
  );
  const [identifying, setIdentifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const abortRef = useRef(false);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });

  const identifyAll = async () => {
    setIdentifying(true);
    abortRef.current = false;
    setProgress(0);

    for (let i = 0; i < cards.length; i++) {
      if (abortRef.current) break;

      setCards(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'identifying' } : c));

      try {
        // Convert files to base64
        const frontB64 = await fileToBase64(cards[i].frontFile);
        let backB64 = null;
        if (cards[i].backFile) {
          backB64 = await fileToBase64(cards[i].backFile);
        }

        // Call AI identification
        const payload = { front_image_base64: frontB64 };
        if (backB64) payload.back_image_base64 = backB64;

        const res = await axios.post(`${API}/api/cards/identify`, payload);
        const d = res.data;

        setCards(prev => prev.map((c, idx) => idx === i ? {
          ...c,
          status: d.error ? 'error' : 'identified',
          frontBase64: frontB64,
          backBase64: backB64,
          card_name: d.card_name || '',
          player: d.player || '',
          year: d.year ? String(d.year) : '',
          set_name: d.set_name || '',
          card_number: d.card_number || '',
          variation: d.variation || '',
          condition: d.is_graded ? 'Graded' : 'Raw',
          grading_company: d.grading_company || '',
          grade: d.grade ? String(d.grade) : '',
          sport: d.sport || '',
        } : c));
      } catch (err) {
        const frontB64 = await fileToBase64(cards[i].frontFile).catch(() => null);
        let backB64 = null;
        if (cards[i].backFile) backB64 = await fileToBase64(cards[i].backFile).catch(() => null);
        setCards(prev => prev.map((c, idx) => idx === i ? {
          ...c, status: 'error', frontBase64: frontB64, backBase64: backB64,
        } : c));
      }

      setProgress(i + 1);
    }

    setIdentifying(false);
    toast.success('AI identification complete!');
  };

  const stopIdentifying = () => { abortRef.current = true; };

  const updateCard = (idx, field, value) => {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeCard = (idx) => {
    setCards(prev => prev.filter((_, i) => i !== idx));
    if (expandedCard === idx) setExpandedCard(null);
  };

  const saveAll = async () => {
    const validCards = cards.filter(c => c.card_name.trim());
    if (validCards.length === 0) { toast.error('No cards with names to save'); return; }

    setSaving(true);
    try {
      const payload = {
        category,
        cards: validCards.map(c => ({
          card_name: c.card_name,
          player: c.player || null,
          year: c.year ? parseInt(c.year) : null,
          set_name: c.set_name || null,
          card_number: c.card_number || null,
          variation: c.variation || null,
          condition: c.condition,
          grading_company: c.condition === 'Graded' ? (c.grading_company || null) : null,
          grade: c.condition === 'Graded' && c.grade ? parseFloat(c.grade) : null,
          purchase_price: c.purchase_price ? parseFloat(c.purchase_price) : null,
          quantity: parseInt(c.quantity) || 1,
          notes: c.notes || null,
          image_base64: c.frontBase64 || null,
          back_image_base64: c.backBase64 || null,
          sport: c.sport || null,
        })),
      };

      const res = await axios.post(`${API}/api/inventory/batch-save`, payload);
      toast.success(`${res.data.saved} cards saved to inventory!`);
      if (res.data.errors?.length > 0) {
        toast.warning(`${res.data.errors.length} cards had errors`);
      }
      onComplete();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save cards');
    } finally {
      setSaving(false);
    }
  };

  const identifiedCount = cards.filter(c => c.status === 'identified').length;
  const errorCount = cards.filter(c => c.status === 'error').length;
  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">{cards.length} Cards</span>
            <span className="text-xs text-emerald-400">{identifiedCount} identified</span>
            {errorCount > 0 && <span className="text-xs text-red-400">{errorCount} errors</span>}
          </div>
          <div className="flex gap-2">
            {!identifying && progress === 0 && (
              <button onClick={identifyAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-semibold hover:bg-[#2563eb] transition-colors"
                data-testid="start-identify-btn">
                <Layers className="w-3.5 h-3.5" /> Identify All with AI
              </button>
            )}
            {identifying && (
              <button onClick={stopIdentifying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors"
                data-testid="stop-identify-btn">
                <X className="w-3.5 h-3.5" /> Stop
              </button>
            )}
          </div>
        </div>
        {(identifying || progress > 0) && (
          <div className="space-y-1">
            <div className="w-full bg-[#0a0a0a] rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-[#3b82f6] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(progress / cards.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-gray-500">{progress}/{cards.length} processed {identifying && <span className="text-[#3b82f6] ml-1">Identifying card {progress + 1}...</span>}</p>
          </div>
        )}
      </div>

      {/* Cards review table */}
      <div className="space-y-2">
        {cards.map((card, i) => (
          <div key={i} className={`bg-[#111] border rounded-xl overflow-hidden transition-colors ${card.status === 'error' ? 'border-red-500/30' : card.status === 'identified' ? 'border-emerald-500/20' : card.status === 'identifying' ? 'border-[#3b82f6]/30' : 'border-[#1a1a1a]'}`}>
            {/* Card row */}
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedCard(expandedCard === i ? null : i)} data-testid={`batch-card-row-${i}`}>
              {/* Status indicator */}
              <div className="flex-shrink-0">
                {card.status === 'identifying' && <RefreshCw className="w-4 h-4 text-[#3b82f6] animate-spin" />}
                {card.status === 'identified' && <Check className="w-4 h-4 text-emerald-400" />}
                {card.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {card.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-600" />}
              </div>

              {/* Thumbnail */}
              <div className="w-10 h-14 rounded-lg bg-[#0a0a0a] overflow-hidden flex-shrink-0">
                <img src={card.frontPreview} alt="" className="w-full h-full object-contain" />
              </div>

              {/* Card info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{card.card_name || `Card ${i + 1} - ${card.frontFile.name}`}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {card.player && <span className="text-[10px] text-gray-400">{card.player}</span>}
                  {card.year && <span className="text-[10px] text-gray-600">{card.year}</span>}
                  {card.set_name && <span className="text-[10px] text-gray-600">{card.set_name}</span>}
                  {card.condition === 'Graded' && card.grade && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">{card.grading_company} {card.grade}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setExpandedCard(expandedCard === i ? null : i); }}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-[#3b82f6]" data-testid={`edit-batch-card-${i}`}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeCard(i); }}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400" data-testid={`remove-batch-card-${i}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded edit form */}
            <AnimatePresence>
              {expandedCard === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-3 pb-3 border-t border-[#1a1a1a] pt-3">
                    <div className="flex gap-3">
                      {/* Images */}
                      <div className="flex gap-2 flex-shrink-0">
                        <div className="w-20 h-28 bg-[#0a0a0a] rounded-lg overflow-hidden">
                          <img src={card.frontPreview} alt="Front" className="w-full h-full object-contain" />
                        </div>
                        {card.backPreview && (
                          <div className="w-20 h-28 bg-[#0a0a0a] rounded-lg overflow-hidden">
                            <img src={card.backPreview} alt="Back" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                      {/* Fields */}
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Card Name *</label>
                            <input className={inputCls} value={card.card_name} onChange={e => updateCard(i, 'card_name', e.target.value)} placeholder="Card name" data-testid={`batch-input-name-${i}`} />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Player</label>
                            <input className={inputCls} value={card.player} onChange={e => updateCard(i, 'player', e.target.value)} placeholder="Player" />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Year</label>
                            <input className={inputCls} type="number" value={card.year} onChange={e => updateCard(i, 'year', e.target.value)} placeholder="Year" />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Set</label>
                            <input className={inputCls} value={card.set_name} onChange={e => updateCard(i, 'set_name', e.target.value)} placeholder="Set" />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Card #</label>
                            <input className={inputCls} value={card.card_number} onChange={e => updateCard(i, 'card_number', e.target.value)} placeholder="#" />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Variation</label>
                            <input className={inputCls} value={card.variation} onChange={e => updateCard(i, 'variation', e.target.value)} placeholder="Variation" />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Condition</label>
                            <select className={inputCls} value={card.condition} onChange={e => updateCard(i, 'condition', e.target.value)}>
                              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          {card.condition === 'Graded' && (
                            <>
                              <div>
                                <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Company</label>
                                <select className={inputCls} value={card.grading_company} onChange={e => updateCard(i, 'grading_company', e.target.value)}>
                                  <option value="">---</option>
                                  {GRADING_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Grade</label>
                                <input className={inputCls} value={card.grade} onChange={e => updateCard(i, 'grade', e.target.value)} placeholder="9.5" />
                              </div>
                            </>
                          )}
                          <div>
                            <label className="text-[9px] uppercase text-gray-500 mb-0.5 block">Price ($)</label>
                            <input className={inputCls} type="number" step="0.01" value={card.purchase_price} onChange={e => updateCard(i, 'purchase_price', e.target.value)} placeholder="0.00" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          data-testid="batch-back-btn">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{cards.filter(c => c.card_name.trim()).length} cards ready</span>
          <button onClick={saveAll} disabled={saving || cards.filter(c => c.card_name.trim()).length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            data-testid="batch-save-all-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save {cards.filter(c => c.card_name.trim()).length} Cards to Inventory
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN BATCH UPLOAD VIEW ============
const BatchUploadView = ({ onBack, onComplete }) => {
  const [step, setStep] = useState('upload'); // upload, review
  const [pairs, setPairs] = useState([]);
  const [category, setCategory] = useState('collection');

  const handleFilesReady = (filePairs, cat) => {
    setPairs(filePairs);
    setCategory(cat);
    setStep('review');
  };

  return (
    <div className="space-y-4 pb-8" data-testid="batch-upload-view">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5" data-testid="batch-view-back-btn">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Batch Upload</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {step === 'upload' ? 'Upload scanned card images (front & back)' : 'Review AI-identified cards and save to inventory'}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${step === 'upload' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {step !== 'upload' ? <Check className="w-3 h-3" /> : <span className="w-4 h-4 rounded-full bg-[#3b82f6] text-white text-[10px] flex items-center justify-center">1</span>}
          Upload
        </div>
        <div className="w-8 h-px bg-[#222]" />
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${step === 'review' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-[#111] text-gray-600'}`}>
          <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${step === 'review' ? 'bg-[#3b82f6] text-white' : 'bg-[#222] text-gray-500'}`}>2</span>
          Review & Save
        </div>
      </div>

      {step === 'upload' && <UploadStep onFilesReady={handleFilesReady} />}
      {step === 'review' && <ReviewStep pairs={pairs} category={category} onBack={() => setStep('upload')} onComplete={onComplete} />}
    </div>
  );
};

export default BatchUploadView;
