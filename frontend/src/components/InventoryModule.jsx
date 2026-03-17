import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, X, Edit2, Trash2, Package, DollarSign,
  Upload, Image as ImageIcon, Save, RefreshCw, RotateCcw,
  Award, Tag, ShoppingBag, Heart, Scan, ChevronLeft, Layers, Check, ExternalLink, Store, TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import CardScanner from './CardScanner';
import AnalysisResult from './AnalysisResult';
import { ViewToggle } from './ViewToggle';
import { Button } from './ui/button';
import CreateListingView from './CreateListingView';
import BatchUploadView from './BatchUploadView';
import PriceHistoryChart from './PriceHistoryChart';

const API = process.env.REACT_APP_BACKEND_URL;

const CONDITIONS = ['Raw', 'Graded'];
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
    variation: '', condition: 'Raw', grading_company: '', grade: '',
    purchase_price: '', quantity: 1, notes: '', image_base64: null, back_image_base64: null, category: 'collection', sport: '',
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
        condition: editItem.condition || 'Raw', grading_company: editItem.grading_company || '', grade: editItem.grade || '',
        purchase_price: editItem.purchase_price || '', quantity: editItem.quantity || 1, notes: editItem.notes || '',
        image_base64: null, back_image_base64: null, category: editItem.category || 'collection', sport: editItem.sport || '',
      });
      setImagePreview(editItem.image ? `data:image/jpeg;base64,${editItem.image}` : null);
      setBackImagePreview(editItem.back_image ? `data:image/jpeg;base64,${editItem.back_image}` : null);
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
        sport: d.sport || f.sport,
      }));
      toast.success(backImageData ? 'Card identified with front + back!' : 'Card identified! Review the details below.');
    } catch { toast.error('AI identification failed'); }
    finally { setIdentifying(false); }
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setForm(f => ({ ...f, image_base64: dataUrl }));
      setImagePreview(dataUrl);
      identifyCard(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleBackImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const backDataUrl = ev.target.result;
      setForm(f => ({ ...f, back_image_base64: backDataUrl }));
      setBackImagePreview(backDataUrl);
      // Re-identify with both images if front image exists (back has year, card#, set info)
      if (form.image_base64) {
        toast.info('Re-identifying with front + back images...');
        identifyCard(form.image_base64, backDataUrl);
      }
    };
    reader.readAsDataURL(file);
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
      payload.quantity = parseInt(payload.quantity) || 1;
      if (!payload.image_base64) delete payload.image_base64;
      if (!payload.back_image_base64) delete payload.back_image_base64;
      if (!payload.sport) delete payload.sport;
      if (payload.condition === 'Raw') { payload.grading_company = null; payload.grade = null; }
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
            {[{ val: 'collection', label: 'Collection', icon: Heart }, { val: 'for_sale', label: 'For Sale', icon: ShoppingBag }].map(({ val, label, icon: Icon }) => (
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
          {form.condition === 'Graded' && (<>
            <div><label className={labelCls}>Grading Co.</label><select className={inputCls} value={form.grading_company} onChange={e => setForm(f => ({ ...f, grading_company: e.target.value }))} data-testid="select-grading-company"><option value="">Select...</option>{GRADING_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>Grade</label><select className={inputCls} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} data-testid="select-grade"><option value="">Select...</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
          </>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Purchase Price ($)</label><input className={inputCls} type="number" step="0.01" placeholder="0.00" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} data-testid="input-price" /></div>
          <div><label className={labelCls}>Quantity</label><input className={inputCls} type="number" min="1" placeholder="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} data-testid="input-quantity" /></div>
          <div><label className={labelCls}>Notes</label><input className={inputCls} placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-notes" /></div>
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

// =========== INVENTORY LIST VIEW ===========
const InventoryList = ({ activeCategory, onCategoryChange }) => {
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

  // Add/Edit inline view state
  const [showForm, setShowForm] = useState(false);
  const [chartCard, setChartCard] = useState(null); // card for price history chart

  const fetchInventory = useCallback(async (searchVal) => {
    try {
      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal);
      if (filters.condition) params.append('condition', filters.condition);
      if (activeCategory === 'listed') {
        params.append('listed', 'true');
      } else if (activeCategory !== 'all') {
        params.append('category', activeCategory);
        params.append('listed', 'false');
      }
      if (filters.listed) params.append('listed', filters.listed);
      params.append('limit', '50');
      const [itemsRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/inventory?${params}`),
        axios.get(`${API}/api/inventory/stats`)
      ]);
      setItems(itemsRes.data.items); setTotal(itemsRes.data.total); setStats(statsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters, activeCategory]);

  useEffect(() => { fetchInventory(search); }, [fetchInventory]);

  const handleSearch = (val) => { setSearch(val); clearTimeout(searchTimeout.current); searchTimeout.current = setTimeout(() => fetchInventory(val), 300); };
  const handleSave = async (payload, itemId) => {
    if (itemId) { await axios.put(`${API}/api/inventory/${itemId}`, payload); toast.success('Card updated'); }
    else { await axios.post(`${API}/api/inventory`, payload); toast.success('Card added'); }
    setEditItem(null); fetchInventory(search);
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
    { id: 'for_sale', label: 'For Sale', icon: ShoppingBag, count: s.for_sale_count || 0 },
    { id: 'listed', label: 'Listed', icon: Store, count: s.listed || 0 },
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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
        {!selectMode ? (
          <>
            {activeCategory !== 'listed' && <button onClick={() => setSelectMode(true)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white text-sm transition-colors" data-testid="select-mode-btn"><Check className="w-4 h-4" /> Select</button>}
            {activeCategory !== 'listed' && <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors" data-testid="add-card-btn"><Plus className="w-4 h-4" /> Add</button>}
          </>
        ) : (
          <>
            <button onClick={selectAll} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white text-sm transition-colors" data-testid="select-all-btn">
              {selected.size === items.length ? 'Deselect All' : 'Select All'}
            </button>
            <button onClick={exitSelectMode} className="px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white text-sm" data-testid="cancel-select-btn">Cancel</button>
            <button onClick={startListOnEbay} disabled={selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors" data-testid="list-on-ebay-btn">
              <ShoppingBag className="w-4 h-4" /> List {selected.size > 0 ? `(${selected.size})` : ''} on eBay
            </button>
          </>
        )}
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

      {loading ? (<div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-4">{activeCategory === 'listed' ? 'No cards listed on eBay yet' : 'No cards found'}</p>
          {activeCategory !== 'listed' && <button onClick={openAdd} className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold" data-testid="empty-add-card-btn"><Plus className="w-4 h-4 inline mr-1" /> Add Card</button>}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => selectMode && toggleSelect(item.id)}
              className={`bg-[#111] border rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors group cursor-pointer ${selected.has(item.id) ? 'border-[#3b82f6] ring-1 ring-[#3b82f6]/30' : 'border-[#1a1a1a]'}`} data-testid={`inventory-item-${i}`}>
              <div className="aspect-[3/4] bg-[#0a0a0a] overflow-hidden relative" style={{ perspective: '600px' }}>
                <div
                  className="w-full h-full transition-transform duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flippedCards.has(item.id) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* FRONT */}
                  <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                    {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt={item.card_name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  </div>
                  {/* BACK */}
                  {item.back_image && (
                    <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <img src={`data:image/jpeg;base64,${item.back_image}`} alt={`${item.card_name} back`} className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
                {item.category === 'for_sale' ? <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white uppercase font-bold">Sale</span>
                  : item.listed ? <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/90 text-white uppercase font-bold flex items-center gap-0.5"><Store className="w-2.5 h-2.5" />eBay</span>
                  : <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-[#3b82f6]/90 text-white uppercase font-bold">Col</span>}
                {item.listed && activeCategory !== 'listed' && <span className="absolute bottom-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/90 text-white uppercase font-bold">Listed</span>}
                {item.back_image && (
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
                    {!item.listed && <button onClick={(e) => { e.stopPropagation(); listSingleItem(item); }} className="p-1 rounded bg-emerald-600/80 text-white hover:bg-emerald-500" data-testid={`list-item-${i}`} title="List on eBay"><ShoppingBag className="w-3 h-3" /></button>}
                    {item.listed && item.ebay_item_id && <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 rounded bg-amber-600/80 text-white hover:bg-amber-500" title="View on eBay"><ExternalLink className="w-3 h-3" /></a>}
                    <button onClick={(e) => { e.stopPropagation(); setChartCard(chartCard?.id === item.id ? null : item); }} className="p-1 rounded bg-black/60 text-white hover:bg-purple-500" data-testid={`chart-item-${i}`} title="Price History"><TrendingUp className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1 rounded bg-black/60 text-white hover:bg-[#3b82f6]" data-testid={`edit-item-${i}`}><Edit2 className="w-3 h-3" /></button>
                    {!item.listed && <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1 rounded bg-black/60 text-white hover:bg-red-500" data-testid={`delete-item-${i}`}><Trash2 className="w-3 h-3" /></button>}
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-semibold text-white truncate">{item.card_name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  {item.condition === 'Graded' && item.grade ? <span className="text-[11px] font-bold text-amber-400">{item.grading_company} {item.grade}</span> : <span className="text-[10px] text-gray-600">Raw</span>}
                  <span className="text-[11px] font-bold text-white">{item.listed && item.listed_price ? formatPrice(item.listed_price) : formatPrice(item.purchase_price)}</span>
                </div>
                {item.player && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{item.player} {item.year || ''}</p>}
                {item.listed && item.listed_price && item.purchase_price > 0 && (
                  <p className={`text-[9px] mt-0.5 font-medium ${item.listed_price - item.purchase_price > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.listed_price - item.purchase_price > 0 ? '+' : ''}{formatPrice(item.listed_price - item.purchase_price)} profit
                  </p>
                )}
              </div>
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
                {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt={item.card_name} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-700" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-sm font-semibold text-white truncate">{item.card_name}</p>
                  {item.listed ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex-shrink-0 uppercase font-medium flex items-center gap-0.5"><Store className="w-2.5 h-2.5" />Listed</span>
                    : item.category === 'for_sale' ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0 uppercase font-medium">For Sale</span>
                    : <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] flex-shrink-0 uppercase font-medium">Collection</span>}
                  {item.back_image && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0 uppercase font-medium">F+B</span>}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {item.player && <span className="text-[11px] text-gray-400">{item.player}</span>}
                  {item.year && <span className="text-[11px] text-gray-600">{item.year}</span>}
                  {item.set_name && <span className="text-[11px] text-gray-600">{item.set_name}</span>}
                  {item.variation && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{item.variation}</span>}
                </div>
              </div>
              <div className="text-center flex-shrink-0">
                {item.condition === 'Graded' && item.grade ? <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20"><span className="text-[9px] uppercase tracking-wider text-amber-400 block">{item.grading_company || 'Graded'}</span><span className="text-sm font-bold text-amber-300">{item.grade}</span></div> : <span className="text-[10px] px-2 py-1 rounded bg-[#1a1a1a] text-gray-500 uppercase">Raw</span>}
              </div>
              <div className="text-right flex-shrink-0 w-20">
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
    </>
  );
};

// =========== MAIN INVENTORY WITH SCANNER ===========
const InventoryModule = () => {
  const [mainTab, setMainTab] = useState('cards');
  const [activeCategory, setActiveCategory] = useState('all');
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
        {mainTab === 'cards' && (<motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><InventoryList activeCategory={activeCategory} onCategoryChange={setActiveCategory} /></motion.div>)}
        {mainTab === 'batch' && (<motion.div key="batch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <BatchUploadView onBack={() => setMainTab('cards')} onComplete={() => { setMainTab('cards'); setActiveCategory('all'); }} />
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
