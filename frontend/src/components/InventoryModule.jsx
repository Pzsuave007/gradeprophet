import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, X, Edit2, Trash2, Package, DollarSign,
  ChevronDown, Upload, Image as ImageIcon, Save, RefreshCw, Layers,
  Award, Tag
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CONDITIONS = ['Raw', 'Graded'];
const GRADING_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'HGA', 'Other'];
const GRADES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];

const formatPrice = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return '-';
  return `$${n.toFixed(2)}`;
};

// =========== ADD/EDIT MODAL ===========
const CardFormModal = ({ isOpen, onClose, onSave, editItem }) => {
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    card_name: '', player: '', year: '', set_name: '', card_number: '',
    variation: '', condition: 'Raw', grading_company: '', grade: '',
    purchase_price: '', quantity: 1, notes: '', image_base64: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setForm({
        card_name: editItem.card_name || '',
        player: editItem.player || '',
        year: editItem.year || '',
        set_name: editItem.set_name || '',
        card_number: editItem.card_number || '',
        variation: editItem.variation || '',
        condition: editItem.condition || 'Raw',
        grading_company: editItem.grading_company || '',
        grade: editItem.grade || '',
        purchase_price: editItem.purchase_price || '',
        quantity: editItem.quantity || 1,
        notes: editItem.notes || '',
        image_base64: null,
      });
      setImagePreview(editItem.image ? `data:image/jpeg;base64,${editItem.image}` : null);
    } else {
      setForm({
        card_name: '', player: '', year: '', set_name: '', card_number: '',
        variation: '', condition: 'Raw', grading_company: '', grade: '',
        purchase_price: '', quantity: 1, notes: '', image_base64: null,
      });
      setImagePreview(null);
    }
  }, [editItem, isOpen]);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, image_base64: ev.target.result }));
      setImagePreview(ev.target.result);
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
      if (payload.condition === 'Raw') { payload.grading_company = null; payload.grade = null; }

      await onSave(payload, editItem?.id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 overflow-y-auto"
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl w-full max-w-2xl mb-8 shadow-2xl"
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a]">
            <h2 className="text-sm font-bold text-white">{editItem ? 'Edit Card' : 'Add Card to Inventory'}</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/5 rounded" data-testid="modal-close"><X className="w-4 h-4 text-gray-500" /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Image Upload */}
            <div className="flex items-start gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-24 h-32 rounded-lg border-2 border-dashed border-[#222] hover:border-[#3b82f6]/50 flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0 transition-colors"
                data-testid="image-upload-area"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Card" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Upload className="w-5 h-5 text-gray-600 mx-auto" />
                    <span className="text-[9px] text-gray-600 mt-1 block">Photo</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className={labelCls}>Card Name *</label>
                  <input className={inputCls} placeholder="e.g. 1996 Topps Kobe Bryant #138"
                    value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value }))}
                    data-testid="input-card-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Player</label>
                    <input className={inputCls} placeholder="Kobe Bryant"
                      value={form.player} onChange={e => setForm(f => ({ ...f, player: e.target.value }))}
                      data-testid="input-player" />
                  </div>
                  <div>
                    <label className={labelCls}>Year</label>
                    <input className={inputCls} type="number" placeholder="1996"
                      value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                      data-testid="input-year" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Set</label>
                <input className={inputCls} placeholder="Topps Chrome"
                  value={form.set_name} onChange={e => setForm(f => ({ ...f, set_name: e.target.value }))}
                  data-testid="input-set" />
              </div>
              <div>
                <label className={labelCls}>Card #</label>
                <input className={inputCls} placeholder="#138"
                  value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))}
                  data-testid="input-card-number" />
              </div>
              <div>
                <label className={labelCls}>Variation</label>
                <input className={inputCls} placeholder="Refractor, Base..."
                  value={form.variation} onChange={e => setForm(f => ({ ...f, variation: e.target.value }))}
                  data-testid="input-variation" />
              </div>
            </div>

            {/* Row 3: Condition / Grade */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Condition</label>
                <select className={inputCls} value={form.condition}
                  onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                  data-testid="select-condition">
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {form.condition === 'Graded' && (
                <>
                  <div>
                    <label className={labelCls}>Grading Co.</label>
                    <select className={inputCls} value={form.grading_company}
                      onChange={e => setForm(f => ({ ...f, grading_company: e.target.value }))}
                      data-testid="select-grading-company">
                      <option value="">Select...</option>
                      {GRADING_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Grade</label>
                    <select className={inputCls} value={form.grade}
                      onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                      data-testid="select-grade">
                      <option value="">Select...</option>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Row 4: Price / Qty */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Purchase Price ($)</label>
                <input className={inputCls} type="number" step="0.01" placeholder="0.00"
                  value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                  data-testid="input-price" />
              </div>
              <div>
                <label className={labelCls}>Quantity</label>
                <input className={inputCls} type="number" min="1" placeholder="1"
                  value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  data-testid="input-quantity" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input className={inputCls} placeholder="Optional notes"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  data-testid="input-notes" />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50 transition-colors flex items-center gap-2"
                data-testid="save-card-btn">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editItem ? 'Update' : 'Add Card'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};


// =========== MAIN INVENTORY COMPONENT ===========
const Inventory = () => {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ condition: '', listed: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [total, setTotal] = useState(0);
  const searchTimeout = useRef(null);

  const fetchInventory = useCallback(async (searchVal) => {
    try {
      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal);
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.listed) params.append('listed', filters.listed);
      params.append('limit', '50');

      const [itemsRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/inventory?${params}`),
        axios.get(`${API}/api/inventory/stats`)
      ]);
      setItems(itemsRes.data.items);
      setTotal(itemsRes.data.total);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchInventory(search); }, [fetchInventory]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchInventory(val), 300);
  };

  const handleSave = async (payload, itemId) => {
    if (itemId) {
      await axios.put(`${API}/api/inventory/${itemId}`, payload);
      toast.success('Card updated');
    } else {
      await axios.post(`${API}/api/inventory`, payload);
      toast.success('Card added to inventory');
    }
    setEditItem(null);
    fetchInventory(search);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/api/inventory/${id}`);
      toast.success('Card removed');
      fetchInventory(search);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openEdit = (item) => { setEditItem(item); setModalOpen(true); };
  const openAdd = () => { setEditItem(null); setModalOpen(true); };

  const s = stats || {};

  return (
    <div className="space-y-5 pb-8" data-testid="inventory-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Inventory</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your card collection</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors"
          data-testid="add-card-btn">
          <Plus className="w-4 h-4" /> Add Card
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Package, label: 'Total Cards', val: s.total_quantity || 0, color: 'bg-[#3b82f6]' },
          { icon: DollarSign, label: 'Invested', val: formatPrice(s.total_invested), color: 'bg-emerald-600' },
          { icon: Award, label: 'Graded', val: s.graded || 0, color: 'bg-amber-600' },
          { icon: Tag, label: 'Listed', val: `${s.listed || 0} / ${s.not_listed || 0}`, color: 'bg-purple-600' },
        ].map(({ icon: Icon, label, val, color }, i) => (
          <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-600">{label}</span>
            </div>
            <p className="text-lg font-bold text-white" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
            placeholder="Search by name, player, set..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            data-testid="inventory-search"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
            showFilters || filters.condition || filters.listed
              ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]'
              : 'bg-[#111] border-[#1a1a1a] text-gray-400 hover:text-white'
          }`} data-testid="filter-toggle">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {(filters.condition || filters.listed) && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
          )}
        </button>
      </div>

      {/* Filter chips */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="flex flex-wrap gap-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 self-center mr-1">Condition:</span>
              {['', 'Raw', 'Graded'].map(c => (
                <button key={c} onClick={() => { setFilters(f => ({ ...f, condition: c })); setTimeout(() => fetchInventory(search), 50); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.condition === c ? 'bg-[#3b82f6] text-white' : 'bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white'
                  }`} data-testid={`filter-condition-${c || 'all'}`}>
                  {c || 'All'}
                </button>
              ))}
              <div className="w-px bg-[#1a1a1a] mx-1" />
              <span className="text-[10px] uppercase tracking-wider text-gray-500 self-center mr-1">Listed:</span>
              {[{ v: '', l: 'All' }, { v: 'true', l: 'Listed' }, { v: 'false', l: 'Not Listed' }].map(({ v, l }) => (
                <button key={v} onClick={() => { setFilters(f => ({ ...f, listed: v })); setTimeout(() => fetchInventory(search), 50); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.listed === v ? 'bg-[#3b82f6] text-white' : 'bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white'
                  }`} data-testid={`filter-listed-${v || 'all'}`}>
                  {l}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <p className="text-[11px] text-gray-600">{total} card{total !== 1 ? 's' : ''} found</p>

      {/* Card List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No cards in inventory</p>
          <p className="text-xs text-gray-600 mb-4">Add your first card to start tracking your collection</p>
          <button onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] transition-colors"
            data-testid="empty-add-card-btn">
            <Plus className="w-4 h-4 inline mr-1" /> Add Card
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <motion.div key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 flex items-center gap-3 hover:border-[#2a2a2a] transition-colors group"
              data-testid={`inventory-item-${i}`}
            >
              {/* Image */}
              <div className="w-12 h-16 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                {item.image ? (
                  <img src={`data:image/jpeg;base64,${item.image}`} alt={item.card_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-700" /></div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.card_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {item.player && <span className="text-[11px] text-gray-400">{item.player}</span>}
                  {item.year && <span className="text-[11px] text-gray-600">{item.year}</span>}
                  {item.set_name && <span className="text-[11px] text-gray-600">{item.set_name}</span>}
                  {item.variation && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{item.variation}</span>}
                </div>
              </div>

              {/* Grade / Condition badge */}
              <div className="text-center flex-shrink-0">
                {item.condition === 'Graded' && item.grade ? (
                  <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[9px] uppercase tracking-wider text-amber-400 block">{item.grading_company || 'Graded'}</span>
                    <span className="text-sm font-bold text-amber-300">{item.grade}</span>
                  </div>
                ) : (
                  <span className="text-[10px] px-2 py-1 rounded bg-[#1a1a1a] text-gray-500 uppercase">Raw</span>
                )}
              </div>

              {/* Price + Qty */}
              <div className="text-right flex-shrink-0 w-20">
                <p className="text-sm font-bold text-white">{formatPrice(item.purchase_price)}</p>
                {item.quantity > 1 && <p className="text-[10px] text-gray-600">x{item.quantity}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => openEdit(item)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-[#3b82f6] transition-colors"
                  data-testid={`edit-item-${i}`}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400 transition-colors"
                  data-testid={`delete-item-${i}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <CardFormModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} onSave={handleSave} editItem={editItem} />
    </div>
  );
};

export default Inventory;
