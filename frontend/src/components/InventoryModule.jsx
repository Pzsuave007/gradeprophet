import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, X, Edit2, Trash2, Package, DollarSign,
  Upload, Image as ImageIcon, Save, RefreshCw, RotateCcw,
  Award, Tag, ShoppingBag, Heart, Scan, ChevronLeft, Layers, Check, ExternalLink, Store, TrendingUp,
  Sun, Sliders, Palette, CircleDot, Loader2, Focus, Lock, Crop, Undo2, Sparkles, Truck, Zap, Star
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import CardScanner from './CardScanner';
import AnalysisResult from './AnalysisResult';
import { ViewToggle } from './ViewToggle';
import { Button } from './ui/button';
import CreateListingView from './CreateListingView';
import CreateLotView from './CreateLotView';
import CreatePickYourCardView from './CreatePickYourCardView';
import CreateChasePackView from './CreateChasePackView';
import SocialPostEditor from './SocialPostEditor';
import BatchUploadView from './BatchUploadView';
import PriceHistoryChart from './PriceHistoryChart';
import { usePlan } from '../hooks/usePlan';

const API = process.env.REACT_APP_BACKEND_URL;

const CONDITIONS = ['Raw', 'Graded'];
const RAW_CONDITIONS = ['Near Mint or Better', 'Excellent', 'Very Good', 'Poor'];
const GRADING_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'HGA', 'Other'];
const GRADES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];

const formatPrice = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return '-';
  return `$${n.toFixed(2)}`;
};

// =========== ADD/EDIT INLINE VIEW ===========
const CardFormView = ({ onBack, onSave, editItem }) => {
  const fileRef = useRef(null);
  const backFileRef = useRef(null);
  const [form, setForm] = useState({
    card_name: '', player: '', year: '', set_name: '', card_number: '',
    variation: '', condition: 'Raw', card_condition: 'Near Mint or Better', grading_company: '', grade: '', cert_number: '',
    purchase_price: '', card_value: '', quantity: 1, notes: '', image_base64: null, back_image_base64: null, category: 'collection', sport: '',
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [backImagePreview, setBackImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);

  useEffect(() => {
    if (editItem) {
      setForm({
        card_name: editItem.card_name || '', player: editItem.player || '', year: editItem.year || '',
        set_name: editItem.set_name || '', card_number: editItem.card_number || '', variation: editItem.variation || '',
        condition: editItem.condition || 'Raw', card_condition: editItem.card_condition || 'Near Mint or Better',
        grading_company: editItem.grading_company || '', grade: editItem.grade || '',
        cert_number: editItem.cert_number || '',
        purchase_price: editItem.purchase_price || '', card_value: editItem.card_value || '', quantity: editItem.quantity || 1, notes: editItem.notes || '',
        image_base64: null, back_image_base64: null, category: editItem.category || 'collection', sport: editItem.sport || '',
      });
      const frontThumb = editItem.store_thumbnail || editItem.thumbnail;
      setImagePreview(frontThumb ? `data:image/${editItem.store_thumbnail ? 'webp' : 'jpeg'};base64,${frontThumb}` : null);
      setBackImagePreview(editItem.back_thumbnail ? `data:image/jpeg;base64,${editItem.back_thumbnail}` : null);
    }
  }, [editItem]);

  const identifyCard = async (frontImageData, backImageData = null) => {
    setIdentifying(true);
    try {
      const payload = { front_image_base64: frontImageData };
      if (backImageData) payload.back_image_base64 = backImageData;
      const res = await axios.post(`${API}/api/cards/identify`, payload);
      const d = res.data;
      if (d.error) { toast.error('Could not identify card'); return; }
      setForm(f => ({
        ...f,
        card_name: d.card_name || f.card_name,
        player: d.player || f.player,
        year: d.year ? String(d.year) : f.year,
        set_name: d.set_name || f.set_name,
        card_number: d.card_number || f.card_number,
        variation: d.variation || f.variation,
        condition: d.is_graded ? 'Graded' : 'Raw',
        grading_company: d.grading_company || f.grading_company,
        grade: d.grade ? String(d.grade) : f.grade,
        cert_number: d.cert_number || f.cert_number,
        sport: d.sport || f.sport,
      }));
      toast.success(backImageData ? 'Card identified with front + back!' : 'Card identified! Review the details below.');
    } catch { toast.error('AI identification failed'); }
    finally { setIdentifying(false); }
  };

  const compressMobileImage = useCallback((file) => {
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
        const result = canvas.toDataURL('image/webp', 0.82);
        canvas.width = 0;
        canvas.height = 0;
        img.src = '';
        resolve(result);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }, []);

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressMobileImage(file);
    setForm(f => ({ ...f, image_base64: dataUrl }));
    setImagePreview(dataUrl);
    identifyCard(dataUrl);
  };

  const handleBackImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const backDataUrl = await compressMobileImage(file);
    setForm(f => ({ ...f, back_image_base64: backDataUrl }));
    setBackImagePreview(backDataUrl);
    // Re-identify with both images if front image exists (back has year, card#, set info)
    if (form.image_base64) {
      toast.info('Re-identifying with front + back images...');
      identifyCard(form.image_base64, backDataUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.card_name.trim()) { toast.error('Card name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      payload.year = payload.year ? parseInt(payload.year) : null;
      payload.grade = payload.grade ? parseFloat(payload.grade) : null;
      payload.purchase_price = payload.purchase_price ? parseFloat(payload.purchase_price) : null;
      payload.card_value = payload.card_value ? parseFloat(payload.card_value) : null;
      payload.quantity = parseInt(payload.quantity) || 1;
      if (!payload.image_base64) delete payload.image_base64;
      if (!payload.back_image_base64) delete payload.back_image_base64;
      if (!payload.sport) delete payload.sport;
      if (payload.condition === 'Raw') { payload.grading_company = null; payload.grade = null; payload.cert_number = null; }
      await onSave(payload, editItem?.id);
      onBack();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <div className="space-y-4 pb-8" data-testid="card-form-view">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5" data-testid="form-back-btn">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{editItem ? 'Edit Card' : 'Add Card to Inventory'}</h1>
          <p className="text-xs text-gray-500">{editItem ? 'Update card details' : 'Upload front photo to auto-identify with AI'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        {/* Category */}
        <div><label className={labelCls}>Category</label>
          <div className="flex gap-2">
            {[{ val: 'collection', label: 'Collection', icon: Heart }, { val: 'for_sale', label: 'Inventory', icon: ShoppingBag }].map(({ val, label, icon: Icon }) => (
              <button key={val} type="button" onClick={() => setForm(f => ({ ...f, category: val }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${form.category === val ? (val === 'for_sale' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]') : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-white'}`}
                data-testid={`category-${val}`}><Icon className="w-4 h-4" />{label}</button>
            ))}
          </div>
        </div>

        {/* Front + Back images */}
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex gap-4">
            {/* Front image */}
            <div className="relative flex-shrink-0">
              <label className={`${labelCls} text-center mb-1.5`}>Front</label>
              <div onClick={() => fileRef.current?.click()}
                className="w-28 h-36 rounded-xl border-2 border-dashed border-[#222] hover:border-[#3b82f6]/50 flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
                data-testid="image-upload-area">
                {imagePreview ? <img src={imagePreview} alt="Front" className="w-full h-full object-contain" />
                  : <div className="text-center p-2"><Upload className="w-5 h-5 text-gray-600 mx-auto mb-1" /><span className="text-[9px] text-gray-500 block">Front Photo</span><span className="text-[8px] text-[#3b82f6] block mt-0.5">AI Auto-Fill</span></div>}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </div>
              {identifying && (
                <div className="absolute inset-0 mt-5 bg-black/70 rounded-xl flex flex-col items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-[#3b82f6] animate-spin mb-1" />
                  <span className="text-[9px] text-[#3b82f6] font-medium">Identifying...</span>
                </div>
              )}
            </div>
            {/* Back image */}
            <div className="flex-shrink-0">
              <label className={`${labelCls} text-center mb-1.5`}>Back</label>
              <div onClick={() => backFileRef.current?.click()}
                className="w-28 h-36 rounded-xl border-2 border-dashed border-[#222] hover:border-amber-500/50 flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
                data-testid="back-image-upload-area">
                {backImagePreview ? <img src={backImagePreview} alt="Back" className="w-full h-full object-contain" />
                  : <div className="text-center p-2"><Upload className="w-5 h-5 text-gray-600 mx-auto mb-1" /><span className="text-[9px] text-gray-500 block">Back Photo</span><span className="text-[8px] text-amber-400 block mt-0.5">Better ID</span></div>}
                <input ref={backFileRef} type="file" accept="image/*" onChange={handleBackImage} className="hidden" />
              </div>
            </div>
          </div>
          {/* Card name + player + year */}
          <div className="flex-1 w-full space-y-3">
            <div><label className={labelCls}>Card Name *</label><input className={inputCls} placeholder="e.g. 1996 Topps Kobe Bryant #138" value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))} data-testid="input-card-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Player</label><input className={inputCls} placeholder="Kobe Bryant" value={form.player} onChange={e => setForm(f => ({ ...f, player: e.target.value }))} data-testid="input-player" /></div>
              <div><label className={labelCls}>Year</label><input className={inputCls} type="number" placeholder="1996" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} data-testid="input-year" /></div>
            </div>
          </div>
        </div>

        {identifying && (
          <div className="flex items-center gap-2 bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg px-3 py-2">
            <RefreshCw className="w-4 h-4 text-[#3b82f6] animate-spin flex-shrink-0" />
            <p className="text-xs text-[#3b82f6]">AI is analyzing your card... fields will auto-fill momentarily</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Set</label><input className={inputCls} placeholder="Topps Chrome" value={form.set_name} onChange={e => setForm(f => ({ ...f, set_name: e.target.value }))} data-testid="input-set" /></div>
          <div><label className={labelCls}>Card #</label><input className={inputCls} placeholder="#138" value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} data-testid="input-card-number" /></div>
          <div><label className={labelCls}>Variation</label><input className={inputCls} placeholder="Refractor..." value={form.variation} onChange={e => setForm(f => ({ ...f, variation: e.target.value }))} data-testid="input-variation" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Condition</label><select className={inputCls} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} data-testid="select-condition">{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          {form.condition === 'Raw' && (
            <div><label className={labelCls}>Card Condition</label><select className={inputCls} value={form.card_condition} onChange={e => setForm(f => ({ ...f, card_condition: e.target.value }))} data-testid="select-card-condition">{RAW_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          )}
          {form.condition === 'Graded' && (<>
            <div><label className={labelCls}>Grading Co.</label><select className={inputCls} value={form.grading_company} onChange={e => setForm(f => ({ ...f, grading_company: e.target.value }))} data-testid="select-grading-company"><option value="">Select...</option>{GRADING_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>Grade</label><select className={inputCls} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} data-testid="select-grade"><option value="">Select...</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
          </>)}
        </div>
        {form.condition === 'Graded' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>Cert #</label><input className={inputCls} placeholder="e.g. 12345678" value={form.cert_number} onChange={e => setForm(f => ({ ...f, cert_number: e.target.value }))} data-testid="input-cert-number" /></div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Purchase Price ($)</label><input className={inputCls} type="number" step="0.01" placeholder="0.00" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} data-testid="input-price" /></div>
          <div><label className={labelCls}>Value ($)</label><input className={inputCls} type="number" step="0.01" placeholder="0.00" value={form.card_value} onChange={e => setForm(f => ({ ...f, card_value: e.target.value }))} data-testid="input-value" /></div>
          <div><label className={labelCls}>Quantity</label><input className={inputCls} type="number" min="1" placeholder="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} data-testid="input-quantity" /></div>
        </div>
        <div><label className={labelCls}>Notes</label><input className={inputCls} placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-notes" /></div>
        {/* Price Lookup */}
        <div className="grid grid-cols-2 gap-2">
          <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent([form.year, form.set_name, form.variation, form.player, form.card_number ? '#' + form.card_number : '', form.condition === 'Graded' && form.grading_company ? form.grading_company : '', form.condition === 'Graded' && form.grade ? form.grade : ''].filter(Boolean).join(' '))}&_sacat=0&_from=R40&LH_Sold=1&rt=nc&LH_Complete=1`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-xs hover:bg-yellow-500/20 active:scale-95 transition-all"
            data-testid="edit-lookup-ebay">
            <TrendingUp className="w-4 h-4" /> eBay Sold
          </a>
          <a href={`https://app.cardladder.com/sales-history?direction=desc&sort=date&q=${encodeURIComponent([form.year, form.set_name, form.variation, form.player, form.card_number ? '#' + form.card_number : '', form.condition === 'Graded' && form.grading_company ? form.grading_company : '', form.condition === 'Graded' && form.grade ? form.grade : ''].filter(Boolean).join(' '))}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold text-xs hover:bg-[#3b82f6]/20 active:scale-95 transition-all"
            data-testid="edit-lookup-cardladder">
            <TrendingUp className="w-4 h-4" /> CardLadder
          </a>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onBack} className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors" data-testid="form-cancel-btn">Cancel</button>
          <button type="submit" disabled={saving || identifying} className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50 transition-colors flex items-center gap-2" data-testid="save-card-btn">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editItem ? 'Update' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  );
};

// =========== CROP OVERLAY ===========
const CropOverlay = ({ onCropApply, onCropCancel }) => {
  const [rect, setRect] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [handle, setHandle] = useState(null);
  const overlayRef = React.useRef(null);

  const getPos = (e) => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(clientY - bounds.top, bounds.height)),
    };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    setDragStart(pos);
    setDragging(true);
    setRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setHandle(null);
  };

  const onHandleDown = (e, h) => {
    e.preventDefault();
    e.stopPropagation();
    setHandle(h);
    setDragStart(getPos(e));
  };

  const onPointerMove = (e) => {
    if (!dragging && !handle) return;
    e.preventDefault();
    const pos = getPos(e);
    const el = overlayRef.current;
    if (!el) return;
    const bw = el.getBoundingClientRect().width;
    const bh = el.getBoundingClientRect().height;

    if (dragging && dragStart) {
      const x = Math.min(dragStart.x, pos.x);
      const y = Math.min(dragStart.y, pos.y);
      const w = Math.abs(pos.x - dragStart.x);
      const h = Math.abs(pos.y - dragStart.y);
      setRect({ x, y, w: Math.min(w, bw - x), h: Math.min(h, bh - y) });
    } else if (handle && rect && dragStart) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      let { x, y, w, h } = rect;
      if (handle.includes('l')) { x = Math.max(0, x + dx); w = Math.max(20, w - dx); }
      if (handle.includes('r')) { w = Math.max(20, Math.min(w + dx, bw - x)); }
      if (handle.includes('t')) { y = Math.max(0, y + dy); h = Math.max(20, h - dy); }
      if (handle.includes('b')) { h = Math.max(20, Math.min(h + dy, bh - y)); }
      setRect({ x, y, w, h });
      setDragStart(pos);
    }
  };

  const onPointerUp = () => {
    setDragging(false);
    setHandle(null);
    setDragStart(null);
  };

  const applyCrop = () => {
    if (!rect || rect.w < 20 || rect.h < 20) return;
    // Pass raw pixel coordinates relative to the overlay container
    onCropApply({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  };

  const handles = ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'];
  const handlePos = (h) => {
    if (!rect) return {};
    const s = { position: 'absolute', width: 14, height: 14, background: '#3b82f6', border: '2px solid white', borderRadius: 2, zIndex: 10, touchAction: 'none' };
    if (h === 'tl') return { ...s, left: rect.x - 7, top: rect.y - 7, cursor: 'nwse-resize' };
    if (h === 'tr') return { ...s, left: rect.x + rect.w - 7, top: rect.y - 7, cursor: 'nesw-resize' };
    if (h === 'bl') return { ...s, left: rect.x - 7, top: rect.y + rect.h - 7, cursor: 'nesw-resize' };
    if (h === 'br') return { ...s, left: rect.x + rect.w - 7, top: rect.y + rect.h - 7, cursor: 'nwse-resize' };
    if (h === 't') return { ...s, left: rect.x + rect.w / 2 - 7, top: rect.y - 7, cursor: 'ns-resize' };
    if (h === 'b') return { ...s, left: rect.x + rect.w / 2 - 7, top: rect.y + rect.h - 7, cursor: 'ns-resize' };
    if (h === 'l') return { ...s, left: rect.x - 7, top: rect.y + rect.h / 2 - 7, cursor: 'ew-resize' };
    if (h === 'r') return { ...s, left: rect.x + rect.w - 7, top: rect.y + rect.h / 2 - 7, cursor: 'ew-resize' };
    return s;
  };

  return (
    <div className="absolute inset-0 z-30" data-testid="crop-overlay">
      <div ref={overlayRef} className="absolute inset-0 cursor-crosshair" style={{ touchAction: 'none' }}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}>
        {rect && rect.w > 5 && rect.h > 5 && (
          <>
            <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x}px ${rect.y}px, ${rect.x}px ${rect.y + rect.h}px, ${rect.x + rect.w}px ${rect.y + rect.h}px, ${rect.x + rect.w}px ${rect.y}px, ${rect.x}px ${rect.y}px)`
            }} />
            <div className="absolute pointer-events-none border-2 border-white/80" style={{
              left: rect.x, top: rect.y, width: rect.w, height: rect.h
            }}>
              <div className="absolute inset-0">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-white/70 bg-black/60 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                {Math.round(rect.w)} x {Math.round(rect.h)}
              </div>
            </div>
            {handles.map(h => (
              <div key={h} style={handlePos(h)}
                onMouseDown={(e) => onHandleDown(e, h)} onTouchStart={(e) => onHandleDown(e, h)} />
            ))}
          </>
        )}
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-40">
        <button onClick={onCropCancel}
          className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-gray-300 text-xs font-bold border border-[#2a2a2a] hover:bg-[#222]"
          data-testid="crop-cancel-btn">Cancel</button>
        <button onClick={applyCrop} disabled={!rect || rect.w < 20 || rect.h < 20}
          className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-bold hover:bg-[#2563eb] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          data-testid="crop-apply-btn">
          <Crop className="w-3.5 h-3.5" /> Apply Crop
        </button>
      </div>
    </div>
  );
};

// =========== CARD DETAIL FULLSCREEN ===========
const PRESETS = [
  { id: 'original', label: 'Original', icon: ImageIcon, brightness: 100, contrast: 100, saturate: 100, sharpness: 0, shadows: 0 },
  { id: 'scanner', label: 'Scanner Fix', icon: Zap, brightness: 112, contrast: 95, saturate: 120, sharpness: 0, shadows: 65 },
  { id: 'bright', label: 'Bright', icon: Sun, brightness: 118, contrast: 97, saturate: 105, sharpness: 0, shadows: 40 },
  { id: 'clean', label: 'Clean', icon: Layers, brightness: 106, contrast: 105, saturate: 90, sharpness: 0, shadows: 15 },
  { id: 'sharp', label: 'Sharp', icon: Focus, brightness: 104, contrast: 106, saturate: 98, sharpness: 30, shadows: 0 },
  { id: 'ebay', label: 'eBay Ready', icon: ShoppingBag, brightness: 115, contrast: 102, saturate: 110, sharpness: 0, shadows: 50 },
  { id: 'pop', label: 'Pop', icon: Palette, brightness: 110, contrast: 108, saturate: 135, sharpness: 0, shadows: 55 },
];

const CardDetailModal = ({ item, onClose, onEdit, onDelete, onList, onFlip, isFlipped, onImageSaved }) => {
  const [showEditor, setShowEditor] = useState(false);
  const [showSocialPost, setShowSocialPost] = useState(false);
  const [activePreset, setActivePreset] = useState('original');
  const [intensity, setIntensity] = useState(50);
  const [showBefore, setShowBefore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [undoData, setUndoData] = useState(null);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [mixer, setMixer] = useState({
    brightness: 0, contrast: 0, shadows: 0, highlights: 0,
    saturation: 0, temperature: 0, sharpness: 0,
  });
  const MIXER_DEFAULT = { brightness: 0, contrast: 0, shadows: 0, highlights: 0, saturation: 0, temperature: 0, sharpness: 0 };
  const [customPresets, setCustomPresets] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const imgContainerRef = React.useRef(null);
  const editorImgRef = React.useRef(null);
  const { hasFeature } = usePlan();
  const canEditPhoto = hasFeature('photo_editor');

  // Fetch global presets + check admin
  useEffect(() => {
    if (showEditor) {
      axios.get(`${API}/api/settings/photo-presets`, { withCredentials: true })
        .then(r => setCustomPresets(r.data.presets || []))
        .catch(() => {});
      axios.get(`${API}/api/auth/me`, { withCredentials: true })
        .then(r => { if (r.data.email === 'pzsuave007@gmail.com') setIsAdmin(true); })
        .catch(() => {});
    }
  }, [showEditor]);

  const handleSaveAsPreset = async () => {
    if (!savePresetName.trim()) return;
    try {
      const res = await axios.post(`${API}/api/admin/photo-presets`, {
        name: savePresetName.trim(),
        ...mixer,
        featured: false,
      }, { withCredentials: true });
      setCustomPresets(prev => [...prev, res.data]);
      setShowSavePreset(false);
      setSavePresetName('');
    } catch { /* ignore */ }
  };
  const [shopName, setShopName] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [shopPlan, setShopPlan] = useState('rookie');

  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL;
    axios.get(`${API}/api/settings`)
      .then(r => {
        setShopName(r.data.shop_name || r.data.display_name || '');
        setShopLogo(r.data.shop_logo || '');
      })
      .catch(() => {});
    axios.get(`${API}/api/subscription/my-plan`)
      .then(r => setShopPlan(r.data.plan_id || 'rookie'))
      .catch(() => {});
  }, []);

  const [fullImages, setFullImages] = useState({ front: null, back: null, loaded: false });

  // Load full-res images when detail opens
  useEffect(() => {
    if (!item?.id) return;
    setFullImages({ front: null, back: null, loaded: false });
    axios.get(`${API}/api/inventory/${item.id}`, { withCredentials: true })
      .then(r => {
        const d = r.data;
        setFullImages({
          front: d.image || null,
          back: d.back_image || null,
          loaded: true,
        });
      })
      .catch(() => setFullImages(prev => ({ ...prev, loaded: true })));
  }, [item?.id]);

  if (!item) return null;
  const hasBack = !!fullImages.back || !!item.back_thumbnail;
  const frontSrc = fullImages.front ? `data:image/jpeg;base64,${fullImages.front}`
    : item.store_thumbnail ? `data:image/webp;base64,${item.store_thumbnail}`
    : item.thumbnail ? `data:image/jpeg;base64,${item.thumbnail}`
    : item.ebay_picture || null;
  const backSrc = fullImages.back ? `data:image/jpeg;base64,${fullImages.back}`
    : item.back_thumbnail ? `data:image/jpeg;base64,${item.back_thumbnail}` : null;

  // Check if active preset is a custom one
  const isCustomPreset = activePreset.startsWith('custom_');
  const customPreset = isCustomPreset ? customPresets.find(p => p.id === activePreset) : null;

  // Compute filters from preset+intensity OR mixer values
  const preset = PRESETS.find(p => p.id === activePreset) || PRESETS[0];
  const pct = intensity / 100;

  const filters = showMixer ? {
    brightness: 100 + mixer.brightness,
    contrast: 100 + mixer.contrast,
    saturate: 100 + mixer.saturation,
    sharpness: Math.max(0, mixer.sharpness),
    shadows: Math.max(0, mixer.shadows),
    highlights: mixer.highlights,
    temperature: mixer.temperature,
  } : isCustomPreset && customPreset ? {
    brightness: Math.round(100 + (customPreset.brightness || 0) * pct),
    contrast: Math.round(100 + (customPreset.contrast || 0) * pct),
    saturate: Math.round(100 + (customPreset.saturation || 0) * pct),
    sharpness: Math.round(Math.max(0, (customPreset.sharpness || 0) * pct)),
    shadows: Math.round(Math.max(0, (customPreset.shadows || 0) * pct)),
    highlights: Math.round((customPreset.highlights || 0) * pct),
    temperature: Math.round((customPreset.temperature || 0) * pct),
  } : {
    brightness: Math.round(100 + (preset.brightness - 100) * pct),
    contrast: Math.round(100 + (preset.contrast - 100) * pct),
    saturate: Math.round(100 + (preset.saturate - 100) * pct),
    sharpness: Math.round((preset.sharpness || 0) * pct),
    shadows: Math.round((preset.shadows || 0) * pct),
    highlights: 0,
    temperature: 0,
  };

  const sharpAmt = filters.sharpness / 100;
  const sharpKernel = `0 ${-sharpAmt} 0 ${-sharpAmt} ${1 + 4 * sharpAmt} ${-sharpAmt} 0 ${-sharpAmt} 0`;
  const shadowGamma = filters.shadows > 0 ? Math.max(0.4, 1 - (filters.shadows / 100) * 0.55) : 1;
  const highlightGamma = filters.highlights !== 0 ? Math.max(0.5, Math.min(1.5, 1 - (filters.highlights / 100) * 0.4)) : 1;
  const tempShift = filters.temperature / 100; // -0.5 to +0.5

  const hasShadowLift = filters.shadows > 0;
  const hasHighlightAdj = filters.highlights !== 0;
  const hasSharpness = filters.sharpness > 0;
  const hasTempAdj = filters.temperature !== 0;
  const hasAdvanced = hasShadowLift || hasHighlightAdj || hasSharpness || hasTempAdj;

  // Build tone curve table for shadows + highlights
  const buildToneCurve = () => {
    const pts = 17; // 17 points for feComponentTransfer table
    const vals = [];
    for (let i = 0; i < pts; i++) {
      let v = i / (pts - 1); // 0 to 1
      // Shadow lift (gamma on lower range)
      if (hasShadowLift) v = Math.pow(v, shadowGamma);
      // Highlight adjustment (gamma on upper range)
      if (hasHighlightAdj) {
        const t = Math.max(0, (v - 0.5) * 2); // 0 at midpoint, 1 at white
        const adj = t * (1 - Math.pow(v, highlightGamma));
        v = Math.min(1, v + adj * 0.3);
      }
      vals.push(v.toFixed(4));
    }
    return vals.join(' ');
  };
  const toneCurveTable = (hasShadowLift || hasHighlightAdj) ? buildToneCurve() : null;

  // Temperature color matrix: warm adds red/yellow, cool adds blue
  const tempMatrix = hasTempAdj
    ? `${1 + tempShift * 0.15} 0 0 0 ${tempShift * 0.03}  0 ${1 + tempShift * 0.05} 0 0 0  0 0 ${1 - tempShift * 0.15} 0 ${-tempShift * 0.03}  0 0 0 1 0`
    : null;

  const filterStyle = (showBefore || (activePreset === 'original' && !showMixer) || (showMixer && Object.values(mixer).every(v => v === 0)))
    ? 'none'
    : `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)${hasAdvanced ? ' url(#card-adv-filter)' : ''}`;
  const hasChanges = showMixer ? Object.values(mixer).some(v => v !== 0) : (activePreset !== 'original');

  const saveEnhanced = async (side) => {
    const src = side === 'back' ? backSrc : frontSrc;
    if (!src) return;
    setSaving(true);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new window.Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;
      ctx.drawImage(img, 0, 0);

      // Apply shadow lifting + highlights + temperature via pixel manipulation
      if (filters.shadows > 0 || filters.highlights !== 0 || filters.temperature !== 0) {
        const w = canvas.width, h = canvas.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const sGamma = filters.shadows > 0 ? Math.max(0.4, 1 - (filters.shadows / 100) * 0.55) : 1;
        const hGamma = filters.highlights !== 0 ? Math.max(0.5, Math.min(1.5, 1 - (filters.highlights / 100) * 0.4)) : 1;
        const tShift = filters.temperature / 100;

        // Build per-channel LUTs
        const lutR = new Uint8Array(256);
        const lutG = new Uint8Array(256);
        const lutB = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
          let v = i / 255;
          // Shadows: gamma curve
          if (filters.shadows > 0) v = Math.pow(v, sGamma);
          // Highlights: adjust upper range
          if (filters.highlights !== 0) {
            const t = Math.max(0, (v - 0.5) * 2);
            const adj = t * (1 - Math.pow(v, hGamma));
            v = Math.min(1, v + adj * 0.3);
          }
          // Base value clamped
          const base = Math.min(255, Math.max(0, Math.round(v * 255)));
          // Temperature: warm adds R/Y, cool adds B
          lutR[i] = Math.min(255, Math.max(0, Math.round(base * (1 + tShift * 0.15) + tShift * 8)));
          lutG[i] = Math.min(255, Math.max(0, Math.round(base * (1 + tShift * 0.05))));
          lutB[i] = Math.min(255, Math.max(0, Math.round(base * (1 - tShift * 0.15) - tShift * 8)));
        }
        for (let i = 0; i < d.length; i += 4) {
          d[i] = lutR[d[i]];
          d[i + 1] = lutG[d[i + 1]];
          d[i + 2] = lutB[d[i + 2]];
        }
        ctx.putImageData(imageData, 0, 0);
      }

      if (filters.sharpness > 0) {
        const s = filters.sharpness / 100;
        const w = canvas.width, h = canvas.height;
        const imageData = ctx.getImageData(0, 0, w, h);
        const srcPx = new Uint8ClampedArray(imageData.data);
        const dst = imageData.data;
        const k = [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0];
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
              let v = 0;
              for (let ky = -1; ky <= 1; ky++)
                for (let kx = -1; kx <= 1; kx++)
                  v += srcPx[((y + ky) * w + (x + kx)) * 4 + c] * k[(ky + 1) * 3 + (kx + 1)];
              dst[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, Math.round(v)));
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      const enhanced = canvas.toDataURL('image/webp', 0.92);
      canvas.width = 0;
      canvas.height = 0;
      const field = side === 'back' ? 'back_image_base64' : 'image_base64';
      const res = await axios.put(`${API}/api/inventory/${item.id}`, { [field]: enhanced });
      // Update fullImages so editor shows the change immediately
      if (res.data?.image || res.data?.back_image) {
        setFullImages(prev => ({
          ...prev,
          front: res.data.image || prev.front,
          back: res.data.back_image || prev.back,
        }));
      }
      toast.success(`${side === 'front' ? 'Front' : 'Back'} image enhanced!`);
      onImageSaved?.(res.data);
      setActivePreset('original');
      setIntensity(75);
    } catch (err) {
      console.error('Save enhanced error:', err);
      toast.error('Error saving enhanced image');
    } finally {
      setSaving(false);
    }
  };

  const applyCrop = async (cropPixels) => {
    // CRITICAL: Capture container/image rects BEFORE changing state
    // because setCropMode(false) will re-render, resize the container,
    // and change the image position (editor controls panel reappears)
    const src = isFlipped && backSrc ? backSrc : frontSrc;
    if (!src || !imgContainerRef.current || !editorImgRef.current) return;

    const containerRect = imgContainerRef.current.getBoundingClientRect();
    const imgRect = editorImgRef.current.getBoundingClientRect();

    setSaving(true);
    setCropMode(false);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new window.Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
      });

      // Offset of the rendered image within the container (captured BEFORE state change)
      const offsetX = imgRect.left - containerRect.left;
      const offsetY = imgRect.top - containerRect.top;

      // Scale from displayed pixels to source image pixels
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      // Convert crop coordinates from container space to source image space
      const imgX = (cropPixels.x - offsetX) * scaleX;
      const imgY = (cropPixels.y - offsetY) * scaleY;
      const imgW = cropPixels.w * scaleX;
      const imgH = cropPixels.h * scaleY;

      // Clamp to image bounds
      const sx = Math.max(0, Math.round(imgX));
      const sy = Math.max(0, Math.round(imgY));
      const sw = Math.min(Math.round(imgW), img.naturalWidth - sx);
      const sh = Math.min(Math.round(imgH), img.naturalHeight - sy);

      if (sw < 10 || sh < 10) {
        toast.error('Crop area too small');
        setSaving(false);
        return;
      }

      // Save original for undo before cropping
      const side = isFlipped ? 'back' : 'front';
      setUndoData({ side, originalBase64: src });

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const cropped = canvas.toDataURL('image/webp', 0.92);
      canvas.width = 0;
      canvas.height = 0;

      const field = side === 'back' ? 'back_image_base64' : 'image_base64';
      const res = await axios.put(`${API}/api/inventory/${item.id}`, { [field]: cropped });
      // Update fullImages so editor shows the crop immediately
      if (res.data?.image || res.data?.back_image) {
        setFullImages(prev => ({
          ...prev,
          front: res.data.image || prev.front,
          back: res.data.back_image || prev.back,
        }));
      }
      toast.success('Image cropped! Use Undo to revert.');
      onImageSaved?.(res.data);
    } catch (err) {
      console.error('Crop error:', err);
      toast.error('Error cropping image');
    } finally {
      setSaving(false);
    }
  };

  const undoCrop = async () => {
    if (!undoData) return;
    setSaving(true);
    try {
      const field = undoData.side === 'back' ? 'back_image_base64' : 'image_base64';
      const res = await axios.put(`${API}/api/inventory/${item.id}`, { [field]: undoData.originalBase64 });
      // Update fullImages so editor shows the undo immediately
      if (res.data?.image || res.data?.back_image) {
        setFullImages(prev => ({
          ...prev,
          front: res.data.image || prev.front,
          back: res.data.back_image || prev.back,
        }));
      }
      toast.success('Crop undone! Original image restored.');
      onImageSaved?.(res.data);
      setUndoData(null);
    } catch (err) {
      console.error('Undo error:', err);
      toast.error('Error undoing crop');
    } finally {
      setSaving(false);
    }
  };

  const syncPhotosToEbay = async () => {
    if (!item.ebay_item_id) {
      toast.error('This card has no active eBay listing');
      return;
    }
    setSyncingPhotos(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/update-photos`, { inventory_item_id: item.id });
      if (res.data.success) {
        toast.success(`Photos updated on eBay! (${res.data.photos_uploaded} photos)`);
      } else {
        toast.error(res.data.message || 'Failed to update photos');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error syncing photos to eBay');
    } finally {
      setSyncingPhotos(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-[#0a0a0a] flex flex-col"
      data-testid="card-detail-modal"
    >
      {/* SVG filter for advanced adjustments (shadows, highlights, temperature, sharpness) */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          {hasAdvanced && (
            <filter id="card-adv-filter" colorInterpolationFilters="sRGB">
              {toneCurveTable && (
                <feComponentTransfer>
                  <feFuncR type="table" tableValues={toneCurveTable} />
                  <feFuncG type="table" tableValues={toneCurveTable} />
                  <feFuncB type="table" tableValues={toneCurveTable} />
                </feComponentTransfer>
              )}
              {tempMatrix && (
                <feColorMatrix type="matrix" values={tempMatrix} />
              )}
              {hasSharpness && (
                <feConvolveMatrix order="3" kernelMatrix={sharpKernel} preserveAlpha="true" />
              )}
            </filter>
          )}
        </defs>
      </svg>

      {showEditor && frontSrc ? (
        /* ========== PHOTO EDITOR MODE ========== */
        <>
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0">
            <button onClick={() => { setShowEditor(false); setActivePreset('original'); }}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors" data-testid="editor-close-btn">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Done</span>
            </button>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Photo Editor
            </h3>
            <button
              onTouchStart={() => setShowBefore(true)} onTouchEnd={() => setShowBefore(false)}
              onMouseDown={() => setShowBefore(true)} onMouseUp={() => setShowBefore(false)} onMouseLeave={() => setShowBefore(false)}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-[#1a1a1a] text-gray-400 font-bold active:bg-white/10"
              data-testid="before-after-btn">
              {showBefore ? 'Before' : 'Hold: Before'}
            </button>
          </div>

          {/* Image Preview - fills available space */}
          <div ref={imgContainerRef} className="flex-1 relative flex items-center justify-center bg-[#111] mx-3 mt-2 rounded-xl overflow-hidden min-h-0">
            {showBefore && (
              <div className="absolute top-3 left-3 z-20 text-[10px] px-2 py-1 rounded bg-white/20 text-white font-bold uppercase backdrop-blur-sm">Original</div>
            )}
            <img ref={editorImgRef} src={isFlipped && backSrc ? backSrc : frontSrc} alt={item.card_name}
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ filter: cropMode ? 'none' : filterStyle }} />
            {cropMode && (
              <CropOverlay
                onCropApply={applyCrop}
                onCropCancel={() => setCropMode(false)}
              />
            )}
            {saving && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            {hasBack && !cropMode && (
              <button onClick={onFlip}
                className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold shadow-lg active:scale-95"
                data-testid="editor-flip-btn">
                <RotateCcw className="w-3 h-3" /> {isFlipped ? 'FRONT' : 'BACK'}
              </button>
            )}
          </div>

          {/* Editor Controls - fixed at bottom */}
          {!cropMode && (
          <div className="shrink-0 bg-[#0a0a0a] border-t border-[#1a1a1a] px-3 pt-3 pb-6" data-testid="photo-editor-panel">
            {/* Crop + Undo + Preset Buttons */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-2">
              <button onClick={() => setCropMode(true)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold shrink-0 transition-all active:scale-95 bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-amber-500/50 hover:text-amber-400"
                data-testid="crop-tool-btn">
                <Crop className="w-4 h-4" />
                Crop
              </button>
              {undoData && (
                <button onClick={undoCrop} disabled={saving}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold shrink-0 transition-all active:scale-95 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                  data-testid="undo-crop-btn">
                  <Undo2 className="w-4 h-4" />
                  Undo
                </button>
              )}
              {item.ebay_item_id && (
                <button onClick={syncPhotosToEbay} disabled={syncingPhotos}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold shrink-0 transition-all active:scale-95 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                  data-testid="sync-ebay-photos-editor-btn">
                  {syncingPhotos ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  eBay Sync
                </button>
              )}
              <div className="w-px bg-[#2a2a2a] shrink-0 my-1" />
              {PRESETS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => {
                    setActivePreset(id);
                    if (showMixer) {
                      const p = PRESETS.find(pr => pr.id === id) || PRESETS[0];
                      setMixer({ brightness: p.brightness - 100, contrast: p.contrast - 100, shadows: p.shadows || 0, highlights: 0, saturation: p.saturate - 100, temperature: 0, sharpness: p.sharpness || 0 });
                    }
                  }}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold shrink-0 transition-all active:scale-95 ${
                    activePreset === id && !showMixer
                      ? 'bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20'
                      : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a]'
                  }`}
                  data-testid={`preset-${id}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
              {/* Custom Global Presets */}
              {customPresets.length > 0 && <div className="w-px bg-[#2a2a2a] shrink-0 my-1" />}
              {customPresets.map(cp => (
                <button key={cp.id} onClick={() => {
                    setActivePreset(cp.id);
                    setShowMixer(false);
                    if (showMixer) {
                      setMixer({ brightness: cp.brightness || 0, contrast: cp.contrast || 0, shadows: cp.shadows || 0, highlights: cp.highlights || 0, saturation: cp.saturation || 0, temperature: cp.temperature || 0, sharpness: cp.sharpness || 0 });
                    }
                  }}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold shrink-0 transition-all active:scale-95 ${
                    activePreset === cp.id
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-[#1a1a1a] text-amber-400/60 border border-amber-500/20'
                  }`}
                  data-testid={`preset-${cp.id}`}>
                  {cp.featured ? <Star className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
                  {cp.name}
                </button>
              ))}
              <div className="w-px bg-[#2a2a2a] shrink-0 my-1" />
              <button onClick={() => {
                  if (!showMixer) {
                    const p = PRESETS.find(pr => pr.id === activePreset) || PRESETS[0];
                    const pct2 = intensity / 100;
                    setMixer({
                      brightness: Math.round((p.brightness - 100) * pct2),
                      contrast: Math.round((p.contrast - 100) * pct2),
                      shadows: Math.round((p.shadows || 0) * pct2),
                      highlights: 0,
                      saturation: Math.round((p.saturate - 100) * pct2),
                      temperature: 0,
                      sharpness: Math.round((p.sharpness || 0) * pct2),
                    });
                  }
                  setShowMixer(!showMixer);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold shrink-0 transition-all active:scale-95 ${
                  showMixer
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a]'
                }`}
                data-testid="mixer-toggle-btn">
                <Sliders className="w-4 h-4" />
                Mixer
              </button>
            </div>

            {/* Mixer Sliders Panel */}
            {showMixer ? (
              <div className="space-y-1.5 mb-3" data-testid="mixer-panel">
                {[
                  { key: 'brightness', label: 'Brightness', min: -50, max: 50, icon: Sun },
                  { key: 'contrast', label: 'Contrast', min: -50, max: 50, icon: CircleDot },
                  { key: 'shadows', label: 'Shadows', min: 0, max: 100, icon: Layers },
                  { key: 'highlights', label: 'Highlights', min: -50, max: 50, icon: Sparkles },
                  { key: 'saturation', label: 'Saturation', min: -50, max: 80, icon: Palette },
                  { key: 'temperature', label: 'Temperature', min: -50, max: 50, icon: Sun },
                  { key: 'sharpness', label: 'Sharpness', min: 0, max: 50, icon: Focus },
                ].map(({ key, label, min, max, icon: SlIcon }) => (
                  <div key={key} className="flex items-center gap-2">
                    <SlIcon className="w-3 h-3 text-gray-600 shrink-0" />
                    <label className="text-[9px] text-gray-500 uppercase tracking-wider shrink-0 w-[72px]">{label}</label>
                    <input type="range" min={min} max={max} value={mixer[key]}
                      onChange={e => setMixer(m => ({ ...m, [key]: parseInt(e.target.value) }))}
                      className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-amber-500"
                      data-testid={`mixer-${key}`} />
                    <span className={`text-[10px] font-bold w-8 text-right ${mixer[key] === 0 ? 'text-gray-600' : 'text-amber-400'}`}>
                      {mixer[key] > 0 ? '+' : ''}{mixer[key]}
                    </span>
                  </div>
                ))}
                <button onClick={() => setMixer({...MIXER_DEFAULT})}
                  className="text-[9px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider mt-1"
                  data-testid="mixer-reset">
                  Reset All
                </button>
                {isAdmin && Object.values(mixer).some(v => v !== 0) && !showSavePreset && (
                  <button onClick={() => setShowSavePreset(true)}
                    className="flex items-center gap-1.5 text-[9px] text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider mt-1 ml-auto"
                    data-testid="save-as-preset-btn">
                    <Star className="w-3 h-3" /> Save as Preset
                  </button>
                )}
                {showSavePreset && (
                  <div className="flex items-center gap-2 mt-2 w-full">
                    <input value={savePresetName} onChange={e => setSavePresetName(e.target.value)}
                      placeholder="Preset name..."
                      className="flex-1 bg-[#1a1a1a] border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-amber-500"
                      onKeyDown={e => e.key === 'Enter' && handleSaveAsPreset()}
                      data-testid="save-preset-name-input" autoFocus />
                    <button onClick={handleSaveAsPreset}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[10px] font-bold hover:bg-amber-400 transition-colors"
                      data-testid="save-preset-confirm">Save</button>
                    <button onClick={() => { setShowSavePreset(false); setSavePresetName(''); }}
                      className="px-2 py-1.5 rounded-lg bg-white/5 text-gray-500 text-[10px] hover:text-white transition-colors">Cancel</button>
                  </div>
                )}
              </div>
            ) : (
            /* Intensity Slider (preset mode) */
            activePreset !== 'original' && (
              <div className="flex items-center gap-3 mb-3">
                <label className="text-[9px] text-gray-500 uppercase tracking-wider shrink-0 w-16">Intensity</label>
                <input type="range" min={10} max={100} value={intensity}
                  onChange={e => setIntensity(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-[#3b82f6]"
                  data-testid="slider-intensity" />
                <span className="text-[10px] font-bold text-[#3b82f6] w-8 text-right">{intensity}%</span>
              </div>
            ))}

            {/* Save Button */}
            {hasChanges && (
              <button onClick={() => saveEnhanced(isFlipped ? 'back' : 'front')} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
                data-testid="save-enhanced-front">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save {isFlipped ? 'Back' : 'Front'} Image
              </button>
            )}
          </div>
          )}
        </>
      ) : (
        /* ========== NORMAL DETAIL VIEW ========== */
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] shrink-0">
            <button onClick={onClose} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors" data-testid="card-detail-close">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex items-center gap-2">
              {frontSrc && (
                canEditPhoto ? (
                  <button onClick={() => setShowEditor(true)}
                    className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1 transition-colors bg-[#1a1a1a] text-gray-400 hover:text-white"
                    data-testid="card-detail-edit-photo">
                    <Sliders className="w-3 h-3" /> Edit Photo
                  </button>
                ) : (
                  <button
                    onClick={() => toast.info('Photo Editor requires Hall of Fame plan or higher. Upgrade in Account settings.')}
                    className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1 transition-colors bg-[#1a1a1a] text-gray-600 cursor-not-allowed"
                    data-testid="card-detail-edit-photo-locked">
                    <Lock className="w-3 h-3" /> Edit Photo
                  </button>
                )
              )}
              {item.listed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold uppercase">Listed</span>}
              {item.category === 'for_sale' && !item.listed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase">Inventory</span>}
              {item.category === 'collection' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] font-bold uppercase">Collection</span>}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Card Image - Large */}
            <div className="relative bg-[#111] mx-4 mt-4 rounded-2xl overflow-hidden" style={{ height: '50vh', perspective: '800px' }}>
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-500"
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                <div className="absolute inset-0 flex items-center justify-center p-4" style={{ backfaceVisibility: 'hidden' }}>
                  {frontSrc
                    ? <img src={frontSrc} alt={item.card_name} className="max-w-full max-h-full object-contain rounded-lg transition-all" style={{ filter: filterStyle }} />
                    : <div className="flex flex-col items-center gap-2 text-gray-700"><ImageIcon className="w-16 h-16" /><span className="text-xs">No image</span></div>
                  }
                </div>
                {hasBack && (
                  <div className="absolute inset-0 flex items-center justify-center p-4" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <img src={backSrc} alt={`${item.card_name} back`} className="max-w-full max-h-full object-contain rounded-lg transition-all" style={{ filter: filterStyle }} />
                  </div>
                )}
              </div>
              {hasBack && (
                <button onClick={onFlip}
                  className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-lg active:scale-95 transition-transform"
                  data-testid="card-detail-flip">
                  <RotateCcw className="w-4 h-4" />
                  {isFlipped ? 'FRONT' : 'BACK'}
                </button>
              )}
            </div>

            {/* Card Info */}
            <div className="px-4 pt-4 pb-2 space-y-3">
              <h2 className="text-lg font-bold text-white leading-tight" data-testid="card-detail-name">{item.card_name}</h2>
              <div className="flex flex-wrap gap-2">
                {item.player && <span className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300">{item.player}</span>}
                {item.year && <span className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300">{item.year}</span>}
                {item.sport && <span className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300">{item.sport}</span>}
                {item.set_name && <span className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300">{item.set_name}</span>}
                {item.card_number && <span className="text-xs px-2.5 py-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300">#{item.card_number}</span>}
                {item.variation && <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">{item.variation}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Condition</p>
                  <p className={`text-sm font-bold mt-0.5 ${item.condition === 'Graded' ? 'text-amber-400' : 'text-gray-300'}`}>
                    {item.condition === 'Graded' && item.grade ? `${item.grading_company} ${item.grade}` : 'Raw'}
                  </p>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cost</p>
                  <p className="text-sm font-bold text-white mt-0.5">{item.purchase_price ? `$${Number(item.purchase_price).toFixed(2)}` : '-'}</p>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Value</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{item.card_value ? `$${Number(item.card_value).toFixed(2)}` : '-'}</p>
                </div>
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.listed ? 'Listed' : 'Qty'}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{item.listed && item.listed_price ? `$${Number(item.listed_price).toFixed(2)}` : item.quantity || 1}</p>
                </div>
              </div>
              {item.condition === 'Graded' && item.cert_number && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Cert #</span>
                  <span className="text-sm font-mono font-bold text-amber-300" data-testid="cert-number-display">{item.cert_number}</span>
                </div>
              )}
              {item.notes && <p className="text-xs text-gray-500 italic">{item.notes}</p>}

              {/* Price Lookup Links */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Price Lookup</p>
                <div className="grid grid-cols-2 gap-2">
                  <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent([item.year, item.set_name, item.variation, item.player, item.card_number ? '#' + item.card_number : '', item.condition === 'Graded' && item.grading_company ? item.grading_company : '', item.condition === 'Graded' && item.grade ? item.grade : ''].filter(Boolean).join(' '))}&_sacat=0&_from=R40&LH_Sold=1&rt=nc&LH_Complete=1`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-xs hover:bg-yellow-500/20 active:scale-95 transition-all"
                    data-testid="lookup-ebay-sold">
                    <TrendingUp className="w-4 h-4" /> eBay Sold
                  </a>
                  <a href={`https://app.cardladder.com/sales-history?direction=desc&sort=date&q=${encodeURIComponent([item.year, item.set_name, item.variation, item.player, item.card_number ? '#' + item.card_number : '', item.condition === 'Graded' && item.grading_company ? item.grading_company : '', item.condition === 'Graded' && item.grade ? item.grade : ''].filter(Boolean).join(' '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold text-xs hover:bg-[#3b82f6]/20 active:scale-95 transition-all"
                    data-testid="lookup-cardladder">
                    <TrendingUp className="w-4 h-4" /> CardLadder
                  </a>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-4 pb-20 pt-2 grid grid-cols-2 gap-2">
              {!item.listed && (
                <button onClick={() => { onClose(); onList(item); }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm active:scale-95 transition-transform"
                  data-testid="card-detail-list">
                  <ShoppingBag className="w-5 h-5" /> List on eBay
                </button>
              )}
              {item.listed && item.ebay_item_id && (
                <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-sm active:scale-95 transition-transform">
                  <ExternalLink className="w-5 h-5" /> View on eBay
                </a>
              )}
              {item.listed && item.ebay_item_id && (
                <button onClick={syncPhotosToEbay} disabled={syncingPhotos}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
                  data-testid="sync-ebay-photos-detail-btn">
                  {syncingPhotos ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  {syncingPhotos ? 'Syncing...' : 'Update eBay Photos'}
                </button>
              )}
              <button onClick={() => { onClose(); onEdit(item); }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-[#3b82f6] font-bold text-sm active:scale-95 transition-transform"
                data-testid="card-detail-edit">
                <Edit2 className="w-5 h-5" /> Edit Card
              </button>
              <button onClick={onClose}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold text-sm active:scale-95 transition-transform"
                data-testid="card-detail-price">
                <TrendingUp className="w-5 h-5" /> Price History
              </button>
              {(item.image || item.ebay_picture) && (
                <button onClick={() => setShowSocialPost(true)}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-sm active:scale-95 transition-transform"
                  data-testid="card-detail-social">
                  <Sparkles className="w-5 h-5" /> Social Post
                </button>
              )}
              {!item.listed && (
                <button onClick={() => { onClose(); onDelete(item.id); }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-sm active:scale-95 transition-transform col-span-2"
                  data-testid="card-detail-delete">
                  <Trash2 className="w-5 h-5" /> Delete Card
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <AnimatePresence>
        {showSocialPost && (
          <SocialPostEditor
            item={item}
            shopName={shopName}
            shopLogo={shopLogo}
            shopPlan={shopPlan}
            onClose={() => setShowSocialPost(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =========== INVENTORY LIST VIEW ===========
const InventoryList = ({ activeCategory, onCategoryChange, pendingDetailCard, onDetailCardConsumed, pendingAddCategory, onAddCategoryConsumed }) => {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [filters, setFilters] = useState({ condition: '', listed: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [total, setTotal] = useState(0);
  const searchTimeout = useRef(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [showBulkShipping, setShowBulkShipping] = useState(false);
  const [bulkShippingOption, setBulkShippingOption] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkCondition, setShowBulkCondition] = useState(false);
  const [bulkConditionValue, setBulkConditionValue] = useState('');
  const [showBulkPreset, setShowBulkPreset] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [showPickYourCard, setShowPickYourCard] = useState(false);
  const [showChasePack, setShowChasePack] = useState(false);
  const [bulkPresetId, setBulkPresetId] = useState('');
  const [bulkPresets, setBulkPresets] = useState([]);

  // Add/Edit inline view state
  const [showForm, setShowForm] = useState(false);
  const [chartCard, setChartCard] = useState(null); // card for price history chart
  const [detailCard, setDetailCard] = useState(null); // fullscreen card detail on mobile

  const fetchInventory = useCallback(async (searchVal) => {
    try {
      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal);
      if (filters.condition) params.append('condition', filters.condition);
      if (activeCategory === 'listed') {
        params.append('listed', 'true');
      } else if (activeCategory === 'sold') {
        params.append('category', 'sold');
      } else if (activeCategory !== 'all') {
        params.append('category', activeCategory);
        params.append('listed', 'false');
      }
      if (filters.listed) params.append('listed', filters.listed);
      params.append('limit', '500');
      const [itemsRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/inventory?${params}`),
        axios.get(`${API}/api/inventory/stats`)
      ]);
      setItems(itemsRes.data.items); setTotal(itemsRes.data.total); setStats(statsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters, activeCategory]);

  // On mount: sync eBay sold items first, then load inventory
  const syncDone = useRef(false);
  useEffect(() => {
    if (syncDone.current) return;
    syncDone.current = true;
    axios.get(`${API}/api/ebay/my-listings?limit=200&sold_limit=200&sold_days=60`)
      .catch(() => {})
      .finally(() => fetchInventory(search));
  }, []);

  useEffect(() => { if (syncDone.current) fetchInventory(search); }, [fetchInventory]);

  // Refresh data when user returns to this browser tab
  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchInventory(search); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchInventory, search]);

  // Handle pending detail card from Quick Scan or external navigation
  useEffect(() => {
    if (pendingDetailCard) {
      setDetailCard(pendingDetailCard);
      onDetailCardConsumed?.();
    }
  }, [pendingDetailCard, onDetailCardConsumed]);

  // Handle pending add category from Collection page
  useEffect(() => {
    if (pendingAddCategory) {
      setShowForm(true);
      setEditItem({ category: pendingAddCategory });
      onAddCategoryConsumed?.();
    }
  }, [pendingAddCategory, onAddCategoryConsumed]);

  const handleSearch = (val) => { setSearch(val); clearTimeout(searchTimeout.current); searchTimeout.current = setTimeout(() => fetchInventory(val), 300); };
  const handleSave = async (payload, itemId) => {
    try {
      if (itemId) { await axios.put(`${API}/api/inventory/${itemId}`, payload); toast.success('Card updated'); setEditItem(null); fetchInventory(search); }
      else {
        const res = await axios.post(`${API}/api/inventory`, payload);
        toast.success('Card added');
        setEditItem(null);
        setShowForm(false);
        await fetchInventory(search);
        // Open the newly created card in detail view
        if (res.data && res.data.id) {
          setDetailCard(res.data);
        }
      }
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(err.response.data?.detail || 'Plan limit reached. Upgrade your plan.', { duration: 5000 });
      } else {
        toast.error('Failed to save card');
      }
    }
  };
  const handleDelete = async (id) => { try { await axios.delete(`${API}/api/inventory/${id}`); toast.success('Removed'); fetchInventory(search); } catch { toast.error('Failed'); } };
  const openEdit = (item) => { setEditItem(item); setShowForm(true); };
  const openAdd = () => { setEditItem(null); setShowForm(true); };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const startListOnEbay = () => {
    if (selected.size === 0) { toast.error('Select at least one card'); return; }
    setShowCreateListing(true);
  };
  const listSingleItem = (item) => {
    setSelected(new Set([item.id]));
    setShowCreateListing(true);
  };

  const SHIPPING_OPTS = [
    { id: 'FreeShipping', label: 'Free Shipping', cost: 0 },
    { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50 },
    { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50 },
    { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50 },
  ];

  const bulkUpdateShipping = async () => {
    if (!bulkShippingOption) { toast.error('Select a shipping option'); return; }
    const selectedItems = items.filter(i => selected.has(i.id) && i.ebay_item_id);
    if (selectedItems.length === 0) { toast.error('No eBay items selected'); return; }
    const opt = SHIPPING_OPTS.find(s => s.id === bulkShippingOption);
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/bulk-revise-shipping`, {
        item_ids: selectedItems.map(i => i.ebay_item_id),
        shipping_option: bulkShippingOption,
        shipping_cost: opt?.cost || 0,
      });
      if (res.data.success) {
        toast.success(`Shipping updated on ${res.data.updated}/${res.data.total} listings`);
        setShowBulkShipping(false);
        exitSelectMode();
      } else {
        toast.error('Failed to update shipping');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update shipping');
    } finally {
      setBulkUpdating(false);
    }
  };

  const bulkUpdateCondition = async () => {
    if (!bulkConditionValue) { toast.error('Select a condition'); return; }
    const selectedIds = items.filter(i => selected.has(i.id) && i.condition !== 'Graded').map(i => i.id);
    if (selectedIds.length === 0) { toast.error('No raw cards selected'); return; }
    setBulkUpdating(true);
    try {
      const res = await axios.put(`${API}/api/inventory/bulk-update-condition`, {
        item_ids: selectedIds,
        card_condition: bulkConditionValue,
      });
      toast.success(`Condition updated on ${res.data.updated} cards`);
      setShowBulkCondition(false);
      exitSelectMode();
      fetchInventory(search);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update condition');
    } finally {
      setBulkUpdating(false);
    }
  };

  // Fetch presets for bulk apply
  useEffect(() => {
    axios.get(`${API}/api/settings/photo-presets`, { withCredentials: true })
      .then(r => setBulkPresets(r.data.presets || []))
      .catch(() => {});
  }, []);

  const BULK_PRESET_OPTIONS = [
    { id: 'scanner', label: 'Scanner Fix', brightness: 112, contrast: 95, saturate: 120, sharpness: 0, shadows: 65 },
    { id: 'bright', label: 'Bright', brightness: 118, contrast: 97, saturate: 105, sharpness: 0, shadows: 40 },
    { id: 'clean', label: 'Clean', brightness: 106, contrast: 105, saturate: 90, sharpness: 0, shadows: 15 },
    { id: 'sharp', label: 'Sharp', brightness: 104, contrast: 106, saturate: 98, sharpness: 30, shadows: 0 },
    { id: 'ebay', label: 'eBay Ready', brightness: 115, contrast: 102, saturate: 110, sharpness: 0, shadows: 50 },
    { id: 'pop', label: 'Pop', brightness: 110, contrast: 108, saturate: 135, sharpness: 0, shadows: 55 },
  ];

  const bulkApplyPreset = async () => {
    if (!bulkPresetId) { toast.error('Select a preset'); return; }
    const selectedIds = items.filter(i => selected.has(i.id)).map(i => i.id);
    if (selectedIds.length === 0) { toast.error('No cards selected'); return; }

    // Get preset settings
    let preset = BULK_PRESET_OPTIONS.find(p => p.id === bulkPresetId);
    if (!preset) {
      const custom = bulkPresets.find(p => p.id === bulkPresetId);
      if (custom) {
        preset = {
          brightness: 100 + (custom.brightness || 0),
          contrast: 100 + (custom.contrast || 0),
          saturate: 100 + (custom.saturation || 0),
          shadows: custom.shadows || 0,
          sharpness: custom.sharpness || 0,
          highlights: custom.highlights || 0,
          temperature: custom.temperature || 0,
        };
      }
    }
    if (!preset) { toast.error('Preset not found'); return; }

    setBulkUpdating(true);
    try {
      const res = await axios.put(`${API}/api/inventory/bulk-apply-preset`, {
        item_ids: selectedIds,
        brightness: preset.brightness,
        contrast: preset.contrast,
        saturate: preset.saturate,
        shadows: preset.shadows || 0,
        sharpness: preset.sharpness || 0,
        highlights: preset.highlights || 0,
        temperature: preset.temperature || 0,
      }, { withCredentials: true });
      toast.success(`Preset applied to ${res.data.processed} cards`);
      setShowBulkPreset(false);
      setBulkPresetId('');
      exitSelectMode();
      fetchInventory(search);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply preset');
    } finally {
      setBulkUpdating(false);
    }
  };


  const [flippedCards, setFlippedCards] = useState(new Set());
  const toggleFlip = (e, itemId) => {
    e.stopPropagation();
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Show Create Lot view (full page, like CreateListingView)
  if (showLotModal) {
    const selectedItems = items.filter(i => selected.has(i.id));
    return (
      <CreateLotView
        items={selectedItems}
        onBack={() => { setShowLotModal(false); exitSelectMode(); }}
        onSuccess={() => { setShowLotModal(false); exitSelectMode(); fetchInventory(search); }}
      />
    );
  }

  // Show Pick Your Card view
  if (showPickYourCard) {
    const selectedItems = items.filter(i => selected.has(i.id));
    return (
      <CreatePickYourCardView
        items={selectedItems}
        onBack={() => { setShowPickYourCard(false); exitSelectMode(); }}
        onSuccess={() => { setShowPickYourCard(false); exitSelectMode(); fetchInventory(search); }}
      />
    );
  }

  // Show Chase Pack view
  if (showChasePack) {
    const selectedItems = items.filter(i => selected.has(i.id));
    return (
      <CreateChasePackView
        items={selectedItems}
        onBack={() => { setShowChasePack(false); exitSelectMode(); }}
        onSuccess={() => { setShowChasePack(false); exitSelectMode(); fetchInventory(search); }}
      />
    );
  }

  // Show Create Listing view
  if (showCreateListing) {
    const selectedItems = items.filter(i => selected.has(i.id));
    return (
      <CreateListingView
        items={selectedItems}
        onBack={() => { setShowCreateListing(false); exitSelectMode(); }}
        onSuccess={() => { setShowCreateListing(false); exitSelectMode(); fetchInventory(search); }}
      />
    );
  }

  // Show Add/Edit form view (inline, no popup)
  if (showForm) {
    return (
      <CardFormView
        editItem={editItem}
        onBack={() => { setShowForm(false); setEditItem(null); }}
        onSave={handleSave}
      />
    );
  }
  const s = stats || {};

  const categoryTabs = [
    { id: 'all', label: 'All', count: s.total_cards || 0 },
    { id: 'collection', label: 'Collection', icon: Heart, count: s.collection_count || 0 },
    { id: 'for_sale', label: 'Inventory', icon: ShoppingBag, count: s.for_sale_count || 0 },
    { id: 'listed', label: 'Listed', icon: Store, count: s.listed || 0 },
    { id: 'sold', label: 'Sold', icon: TrendingUp, count: s.sold_count || 0 },
  ];

  return (
    <>
      {/* KPI Stats - hidden on mobile */}
      <div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Package, label: 'Total Cards', val: s.total_cards || 0, color: 'bg-[#3b82f6]' },
          { icon: DollarSign, label: 'Invested', val: formatPrice(s.total_invested), color: 'bg-emerald-600' },
          { icon: Award, label: 'Graded', val: s.graded || 0, color: 'bg-amber-600' },
          { icon: Tag, label: 'Listed', val: s.listed || 0, color: 'bg-amber-600' },
        ].map(({ icon: Icon, label, val, color }, i) => (
          <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5"><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-3.5 h-3.5 text-white" /></div><span className="text-[10px] uppercase tracking-widest text-gray-600">{label}</span></div>
            <p className="text-lg font-bold text-white" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-[#1a1a1a] pb-px mb-4 overflow-x-auto scrollbar-hide">
        {categoryTabs.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => onCategoryChange(id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeCategory === id ? 'border-[#3b82f6] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            data-testid={`tab-${id}`}>{Icon && <Icon className="w-3.5 h-3.5" />}{label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeCategory === id ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#1a1a1a] text-gray-600'}`}>{count}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <div className="flex-1 min-w-[150px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
            placeholder="Search..." value={search} onChange={e => handleSearch(e.target.value)} data-testid="inventory-search" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${showFilters || filters.condition || filters.listed ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#111] border-[#1a1a1a] text-gray-400 hover:text-white'}`} data-testid="filter-toggle">
          <Filter className="w-4 h-4" />
        </button>
        <ViewToggle view={viewMode} onChange={setViewMode} />
        {activeCategory !== 'sold' && (
          <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${selectMode ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#111] border-[#1a1a1a] text-gray-400 hover:text-white'}`}
            data-testid="select-mode-btn">
            <Check className="w-4 h-4" /> {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
        {selectMode && (
          <button onClick={selectAll} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white text-sm transition-colors" data-testid="select-all-btn">
            {selected.size === items.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
        {activeCategory === 'listed' ? (
          <button onClick={() => setShowBulkShipping(true)} disabled={!selectMode || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 disabled:opacity-30 transition-colors" data-testid="bulk-shipping-btn">
            <Truck className="w-4 h-4" /> Update Shipping {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        ) : activeCategory !== 'sold' ? (
          <>
            <button onClick={() => setShowBulkPreset(true)} disabled={!selectMode || selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 disabled:opacity-30 transition-colors" data-testid="bulk-preset-btn">
              <Sparkles className="w-4 h-4" /> Preset {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
            <button onClick={() => setShowBulkCondition(true)} disabled={!selectMode || selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-30 transition-colors" data-testid="bulk-condition-btn">
              Condition {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
            <button onClick={startListOnEbay} disabled={!selectMode || selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-30 transition-colors" data-testid="list-on-ebay-btn">
              <ShoppingBag className="w-4 h-4" /> List {selected.size > 0 ? `(${selected.size})` : ''} on eBay
            </button>
            <button onClick={() => setShowLotModal(true)} disabled={!selectMode || selected.size < 2 || selected.size > 15}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 disabled:opacity-30 transition-colors" data-testid="create-lot-btn">
              <Layers className="w-4 h-4" /> Create Lot {selected.size >= 2 && selected.size <= 15 ? `(${selected.size})` : ''}
            </button>
            <button onClick={() => setShowPickYourCard(true)} disabled={!selectMode || selected.size < 2}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-30 transition-colors" data-testid="pick-your-card-btn">
              <Tag className="w-4 h-4" /> You Pick {selected.size >= 2 ? `(${selected.size})` : ''}
            </button>
            <button onClick={() => setShowChasePack(true)} disabled={!selectMode || selected.size < 10}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 text-white text-sm font-semibold hover:from-orange-500 hover:to-red-500 disabled:opacity-30 transition-colors" data-testid="create-chase-pack-btn">
              Chase Pack {selected.size >= 10 ? `(${selected.size})` : '(10+)'}
            </button>
          </>
        ) : null}
        {activeCategory !== 'listed' && activeCategory !== 'sold' && <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors" data-testid="add-card-btn"><Plus className="w-4 h-4" /> Add</button>}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <div className="flex flex-wrap gap-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 self-center mr-1">Condition:</span>
              {['', 'Raw', 'Graded'].map(c => (<button key={c} onClick={() => { setFilters(f => ({ ...f, condition: c })); setTimeout(() => fetchInventory(search), 50); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filters.condition === c ? 'bg-[#3b82f6] text-white' : 'bg-[#111] border border-[#1a1a1a] text-gray-400'}`} data-testid={`filter-condition-${c || 'all'}`}>{c || 'All'}</button>))}
              <div className="w-px bg-[#1a1a1a] mx-1" />
              <span className="text-[10px] uppercase tracking-wider text-gray-500 self-center mr-1">Listed:</span>
              {[{ v: '', l: 'All' }, { v: 'true', l: 'Listed' }, { v: 'false', l: 'Not Listed' }].map(({ v, l }) => (<button key={v} onClick={() => { setFilters(f => ({ ...f, listed: v })); setTimeout(() => fetchInventory(search), 50); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filters.listed === v ? 'bg-[#3b82f6] text-white' : 'bg-[#111] border border-[#1a1a1a] text-gray-400'}`} data-testid={`filter-listed-${v || 'all'}`}>{l}</button>))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] text-gray-600 mb-3">{total} card{total !== 1 ? 's' : ''}</p>

      {/* Bulk Shipping Update Modal */}
      <AnimatePresence>
        {showBulkShipping && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="bg-[#111] border border-amber-500/30 rounded-xl p-4" data-testid="bulk-shipping-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-bold text-white">Bulk Update Shipping</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{selected.size} items</span>
                </div>
                <button onClick={() => setShowBulkShipping(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {SHIPPING_OPTS.map(s => (
                  <button key={s.id} onClick={() => setBulkShippingOption(s.id)}
                    className={`px-3 py-2.5 rounded-lg text-left transition-all ${bulkShippingOption === s.id ? 'bg-amber-500/15 border-2 border-amber-500/50 ring-1 ring-amber-500/20' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                    data-testid={`bulk-ship-opt-${s.id}`}>
                    <p className={`text-xs font-bold ${bulkShippingOption === s.id ? 'text-amber-400' : 'text-gray-400'}`}>{s.label}</p>
                    <p className="text-[10px] text-gray-600">{s.cost > 0 ? `$${s.cost.toFixed(2)}` : 'Free'}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={bulkUpdateShipping} disabled={!bulkShippingOption || bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  data-testid="bulk-ship-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <><Truck className="w-4 h-4" /> Apply to {selected.size} Listings</>}
                </button>
                <button onClick={() => setShowBulkShipping(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="bulk-ship-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Condition Update Panel */}
      <AnimatePresence>
        {showBulkCondition && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="bg-[#111] border border-violet-500/30 rounded-xl p-4" data-testid="bulk-condition-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Bulk Update Condition</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">{selected.size} cards</span>
                </div>
                <button onClick={() => setShowBulkCondition(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {RAW_CONDITIONS.map(c => (
                  <button key={c} onClick={() => setBulkConditionValue(c)}
                    className={`px-3 py-2.5 rounded-lg text-left transition-all ${bulkConditionValue === c ? 'bg-violet-500/15 border-2 border-violet-500/50 ring-1 ring-violet-500/20' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                    data-testid={`bulk-cond-opt-${c.replace(/\s/g, '-').toLowerCase()}`}>
                    <p className={`text-xs font-bold ${bulkConditionValue === c ? 'text-violet-400' : 'text-gray-400'}`}>{c}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={bulkUpdateCondition} disabled={!bulkConditionValue || bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 disabled:opacity-50 transition-colors"
                  data-testid="bulk-cond-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <>Apply to {selected.size} Cards</>}
                </button>
                <button onClick={() => setShowBulkCondition(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="bulk-cond-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Preset Apply Panel */}
      <AnimatePresence>
        {showBulkPreset && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="bg-[#111] border border-orange-500/30 rounded-xl p-4" data-testid="bulk-preset-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <p className="text-sm font-bold text-white">Apply Preset to Images</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{selected.size} cards (front + back)</span>
                </div>
                <button onClick={() => setShowBulkPreset(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <p className="text-[11px] text-gray-500 mb-3">This permanently applies the preset to both front and back images and regenerates thumbnails.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
                {BULK_PRESET_OPTIONS.map(p => (
                  <button key={p.id} onClick={() => setBulkPresetId(p.id)}
                    className={`px-3 py-2.5 rounded-lg text-center transition-all ${bulkPresetId === p.id ? 'bg-orange-500/15 border-2 border-orange-500/50 ring-1 ring-orange-500/20' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                    data-testid={`bulk-preset-opt-${p.id}`}>
                    <p className={`text-xs font-bold ${bulkPresetId === p.id ? 'text-orange-400' : 'text-gray-400'}`}>{p.label}</p>
                  </button>
                ))}
              </div>
              {bulkPresets.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Custom Presets</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
                    {bulkPresets.map(cp => (
                      <button key={cp.id} onClick={() => setBulkPresetId(cp.id)}
                        className={`px-3 py-2.5 rounded-lg text-center transition-all ${bulkPresetId === cp.id ? 'bg-orange-500/15 border-2 border-orange-500/50 ring-1 ring-orange-500/20' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                        data-testid={`bulk-preset-opt-${cp.id}`}>
                        <p className={`text-xs font-bold ${bulkPresetId === cp.id ? 'text-orange-400' : 'text-gray-400'}`}>{cp.name}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="flex items-center gap-3">
                <button onClick={bulkApplyPreset} disabled={!bulkPresetId || bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 disabled:opacity-50 transition-colors"
                  data-testid="bulk-preset-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Applying...</> : <><Sparkles className="w-4 h-4" /> Apply to {selected.size} Cards</>}
                </button>
                <button onClick={() => { setShowBulkPreset(false); setBulkPresetId(''); }} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="bulk-preset-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (<div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-4">{activeCategory === 'listed' ? 'No cards listed on eBay yet' : activeCategory === 'sold' ? 'No sold items yet' : 'No cards found'}</p>
          {activeCategory !== 'listed' && activeCategory !== 'sold' && <button onClick={openAdd} className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold" data-testid="empty-add-card-btn"><Plus className="w-4 h-4 inline mr-1" /> Add Card</button>}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => selectMode ? toggleSelect(item.id) : setDetailCard(item)}
              className={`bg-[#1a1a1a] border rounded-xl overflow-hidden hover:border-[#3a3a3a] transition-colors group cursor-pointer ${selected.has(item.id) ? 'border-[#3b82f6] ring-1 ring-[#3b82f6]/30' : 'border-[#2a2a2a]'}`} data-testid={`inventory-item-${i}`}>
              <div className="aspect-[3/4] bg-[#111] overflow-hidden relative" style={{ perspective: '600px' }}>
                <div
                  className="w-full h-full transition-transform duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flippedCards.has(item.id) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* FRONT */}
                  <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                    {item.ebay_picture ? <img src={item.ebay_picture} alt={item.card_name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      : (item.store_thumbnail || item.thumbnail) ? <img src={`data:image/${item.store_thumbnail ? 'webp' : 'jpeg'};base64,${item.store_thumbnail || item.thumbnail}`} alt={item.card_name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  </div>
                  {/* BACK */}
                  {item.back_thumbnail && (
                    <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <img src={`data:image/jpeg;base64,${item.back_thumbnail}`} alt={`${item.card_name} back`} className="w-full h-full object-contain" loading="lazy" />
                    </div>
                  )}
                </div>
                {item.category === 'for_sale' ? <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white uppercase font-bold">Sale</span>
                  : item.listed ? <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/90 text-white uppercase font-bold flex items-center gap-0.5"><Store className="w-2.5 h-2.5" />eBay</span>
                  : <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-[#3b82f6]/90 text-white uppercase font-bold">Col</span>}
                {item.listed && activeCategory !== 'listed' && <span className="absolute bottom-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/90 text-white uppercase font-bold">Listed</span>}
                {item.back_thumbnail && (
                  <button
                    onClick={(e) => toggleFlip(e, item.id)}
                    className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/90 hover:bg-emerald-400 text-white text-[10px] font-bold uppercase transition-colors shadow-lg backdrop-blur-sm"
                    data-testid={`flip-card-${i}`}
                    title={flippedCards.has(item.id) ? 'Show Front' : 'Show Back'}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {flippedCards.has(item.id) ? 'FRONT' : 'BACK'}
                  </button>
                )}
                {/* Select checkbox */}
                {selectMode && (
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected.has(item.id) ? 'bg-[#3b82f6] border-[#3b82f6]' : 'bg-black/50 border-gray-500'}`}>
                    {selected.has(item.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}
                {!selectMode && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-semibold text-white leading-tight">{item.card_name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  {item.condition === 'Graded' && item.grade ? <span className="text-[11px] font-bold text-amber-400">{item.grading_company} {item.grade}</span> : <span className="text-[10px] text-gray-500">{item.card_condition || 'Raw'}</span>}
                  <span className="text-[11px] text-white"><span className="text-[8px] text-gray-500 uppercase mr-1">Invested</span><span className="font-bold">{formatPrice(item.purchase_price)}</span></span>
                </div>
                {item.player && <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{item.player} {item.year || ''}</p>}
                {item.listed && item.listed_price && item.purchase_price > 0 && (
                  <p className={`text-[9px] mt-0.5 font-medium ${item.listed_price - item.purchase_price > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.listed_price - item.purchase_price > 0 ? '+' : ''}{formatPrice(item.listed_price - item.purchase_price)} profit
                  </p>
                )}
              </div>
              {/* Action buttons - below card info */}
              {!selectMode && (
                <div className="flex items-stretch border-t border-[#2a2a2a] bg-[#151515]" data-testid={`card-actions-${i}`}>
                  {!item.listed && (
                    <button onClick={(e) => { e.stopPropagation(); listSingleItem(item); }}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-emerald-400 hover:bg-emerald-500/15 active:bg-emerald-500/25 transition-colors"
                      data-testid={`list-item-${i}`}>
                      <ShoppingBag className="w-4 h-4" /><span className="text-[9px] font-bold">List</span>
                    </button>
                  )}
                  {item.listed && item.ebay_item_id && (
                    <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-amber-400 hover:bg-amber-500/15 active:bg-amber-500/25 transition-colors">
                      <ExternalLink className="w-4 h-4" /><span className="text-[9px] font-bold">eBay</span>
                    </a>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setChartCard(chartCard?.id === item.id ? null : item); }}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-purple-400 hover:bg-purple-500/15 active:bg-purple-500/25 transition-colors"
                    data-testid={`chart-item-${i}`}>
                    <TrendingUp className="w-4 h-4" /><span className="text-[9px] font-bold">Price</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[#3b82f6] hover:bg-[#3b82f6]/15 active:bg-[#3b82f6]/25 transition-colors"
                    data-testid={`edit-item-${i}`}>
                    <Edit2 className="w-4 h-4" /><span className="text-[9px] font-bold">Edit</span>
                  </button>
                  {!item.listed && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-red-400 hover:bg-red-500/15 active:bg-red-500/25 transition-colors"
                      data-testid={`delete-item-${i}`}>
                      <Trash2 className="w-4 h-4" /><span className="text-[9px] font-bold">Delete</span>
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => selectMode && toggleSelect(item.id)}
              className={`bg-[#111] border rounded-xl p-3 flex items-center gap-3 hover:border-[#2a2a2a] transition-colors group cursor-pointer ${selected.has(item.id) ? 'border-[#3b82f6] ring-1 ring-[#3b82f6]/30' : 'border-[#1a1a1a]'}`} data-testid={`inventory-item-${i}`}>
              {/* Select checkbox */}
              {selectMode && (
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(item.id) ? 'bg-[#3b82f6] border-[#3b82f6]' : 'bg-transparent border-gray-600'}`}>
                  {selected.has(item.id) && <Check className="w-3 h-3 text-white" />}
                </div>
              )}
              <div className="w-12 h-16 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                {item.ebay_picture ? <img src={item.ebay_picture} alt={item.card_name} className="w-full h-full object-contain" loading="lazy" />
                  : (item.store_thumbnail || item.thumbnail) ? <img src={`data:image/${item.store_thumbnail ? 'webp' : 'jpeg'};base64,${item.store_thumbnail || item.thumbnail}`} alt={item.card_name} className="w-full h-full object-contain" loading="lazy" />
                  : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-700" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-sm font-semibold text-white leading-tight">{item.card_name}</p>
                  {item.listed ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex-shrink-0 uppercase font-medium flex items-center gap-0.5"><Store className="w-2.5 h-2.5" />Listed</span>
                    : item.category === 'for_sale' ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0 uppercase font-medium">Inventory</span>
                    : <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] flex-shrink-0 uppercase font-medium">Collection</span>}
                  {item.back_thumbnail && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0 uppercase font-medium">F+B</span>}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {item.player && <span className="text-[11px] text-gray-400">{item.player}</span>}
                  {item.year && <span className="text-[11px] text-gray-600">{item.year}</span>}
                  {item.set_name && <span className="text-[11px] text-gray-600">{item.set_name}</span>}
                  {item.variation && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{item.variation}</span>}
                </div>
              </div>
              <div className="text-center flex-shrink-0">
                {item.condition === 'Graded' && item.grade ? <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20"><span className="text-[9px] uppercase tracking-wider text-amber-400 block">{item.grading_company || 'Graded'}</span><span className="text-sm font-bold text-amber-300">{item.grade}</span></div> : <span className="text-[10px] px-2 py-1 rounded bg-[#1a1a1a] text-gray-500">{item.card_condition || 'Raw'}</span>}
              </div>
              <div className="text-right flex-shrink-0 w-28">
                <p className="text-sm font-bold text-white">{item.listed && item.listed_price ? formatPrice(item.listed_price) : formatPrice(item.purchase_price)}</p>
                {item.listed && item.purchase_price > 0 && item.listed_price && (
                  <p className={`text-[9px] font-medium ${item.listed_price - item.purchase_price > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Cost: {formatPrice(item.purchase_price)}
                  </p>
                )}
                {!item.listed && item.quantity > 1 && <p className="text-[10px] text-gray-600">x{item.quantity}</p>}
              </div>
              {!selectMode && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {!item.listed && <button onClick={(e) => { e.stopPropagation(); listSingleItem(item); }} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400" data-testid={`list-item-${i}`} title="List on eBay"><ShoppingBag className="w-3.5 h-3.5" /></button>}
                  {item.listed && item.ebay_item_id && <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-gray-500 hover:text-amber-400" title="View on eBay"><ExternalLink className="w-3.5 h-3.5" /></a>}
                  <button onClick={(e) => { e.stopPropagation(); setChartCard(chartCard?.id === item.id ? null : item); }} className="p-1.5 rounded-lg hover:bg-purple-500/10 text-gray-500 hover:text-purple-400" data-testid={`chart-item-list-${i}`} title="Price History"><TrendingUp className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-[#3b82f6]" data-testid={`edit-item-${i}`}><Edit2 className="w-3.5 h-3.5" /></button>
                  {!item.listed && <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400" data-testid={`delete-item-${i}`}><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Price History Chart Panel */}
      <AnimatePresence>
        {chartCard && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden" data-testid="price-chart-panel">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 mt-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" /> Price History: {chartCard.card_name}
                </h3>
                <button onClick={() => setChartCard(null)} className="p-1 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <PriceHistoryChart card={chartCard} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Detail Fullscreen Modal */}
      <AnimatePresence>
        {detailCard && (
          <CardDetailModal
            item={detailCard}
            onClose={() => setDetailCard(null)}
            onEdit={(item) => { setDetailCard(null); openEdit(item); }}
            onDelete={(id) => { setDetailCard(null); handleDelete(id); }}
            onList={(item) => { setDetailCard(null); listSingleItem(item); }}
            onImageSaved={(updatedCard) => { setDetailCard(updatedCard); fetchInventory(search); }}
            onFlip={() => {
              setFlippedCards(prev => {
                const next = new Set(prev);
                if (next.has(detailCard.id)) next.delete(detailCard.id);
                else next.add(detailCard.id);
                return next;
              });
            }}
            isFlipped={flippedCards.has(detailCard.id)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// =========== MAIN INVENTORY WITH SCANNER ===========
const InventoryModule = ({ pendingDetailCard, onDetailCardConsumed, pendingAddCategory, onAddCategoryConsumed }) => {
  const [mainTab, setMainTab] = useState('cards');
  const [activeCategory, setActiveCategory] = useState('for_sale');
  const [scannerView, setScannerView] = useState('scan');
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalysisComplete = useCallback((analysis, front, back) => { setCurrentAnalysis(analysis); setFrontImage(front); setBackImage(back); setScannerView('result'); }, []);
  const handleNewScan = useCallback(() => { setCurrentAnalysis(null); setFrontImage(null); setBackImage(null); setScannerView('scan'); }, []);

  return (
    <div className="space-y-5 pb-8" data-testid="inventory-page">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-white tracking-tight">Inventory</h1><p className="text-xs text-gray-500 mt-0.5">Manage your card collection</p></div>
      </div>
      <div className="flex gap-1 mb-1 overflow-x-auto scrollbar-hide">
        {[{ id: 'cards', label: 'My Cards', icon: Layers }, { id: 'batch', label: 'Batch Upload', icon: Upload }, { id: 'scan', label: 'Scan Card', icon: Scan }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${mainTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'}`}
            data-testid={`inv-tab-${id}`}><Icon className="w-4 h-4" />{label}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {mainTab === 'cards' && (<motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><InventoryList activeCategory={activeCategory} onCategoryChange={setActiveCategory} pendingDetailCard={pendingDetailCard} onDetailCardConsumed={onDetailCardConsumed} pendingAddCategory={pendingAddCategory} onAddCategoryConsumed={onAddCategoryConsumed} /></motion.div>)}
        {mainTab === 'batch' && (<motion.div key="batch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <BatchUploadView onBack={() => setMainTab('cards')} onComplete={() => { setMainTab('cards'); setActiveCategory('for_sale'); }} />
        </motion.div>)}
        {mainTab === 'scan' && (<motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {scannerView === 'scan' && <CardScanner onAnalysisComplete={handleAnalysisComplete} isAnalyzing={isAnalyzing} setIsAnalyzing={setIsAnalyzing} />}
          {scannerView === 'result' && currentAnalysis && (<>
            <Button variant="ghost" onClick={handleNewScan} className="mb-3 text-gray-400 hover:text-white" data-testid="back-to-scan-btn"><ChevronLeft className="w-4 h-4 mr-1" /> New Scan</Button>
            <AnalysisResult analysis={currentAnalysis} frontImage={frontImage} backImage={backImage} onNewAnalysis={handleNewScan} onDelete={handleNewScan} onRefresh={() => {}} />
          </>)}
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
};

export default InventoryModule;
