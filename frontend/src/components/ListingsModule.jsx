import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, ExternalLink, RefreshCw, Clock, Eye, Package,
  DollarSign, ShoppingBag, Plus, Search, Layers,
  Image as ImageIcon, Truck, Gavel, CheckCircle2, AlertTriangle,
  Edit2, Save, X
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { ViewToggle } from './ViewToggle';

const API = process.env.REACT_APP_BACKEND_URL;

const formatPrice = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return '-';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
};

const parseTimeLeft = (iso) => {
  if (!iso) return '';
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const d = parseInt(m[1] || 0), h = parseInt(m[2] || 0), min = parseInt(m[3] || 0);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
};

const CONDITIONS = [
  { id: 1000, label: 'Brand New' },
  { id: 2750, label: 'Like New' },
  { id: 3000, label: 'Very Good' },
  { id: 4000, label: 'Good' },
  { id: 5000, label: 'Acceptable' },
];

const SHIPPING_OPTIONS = [
  { id: 'FreeShipping', label: 'Free Shipping', cost: 0 },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50 },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50 },
];

const DURATIONS_BIN = [
  { id: 'GTC', label: 'Good Til Cancelled' },
  { id: 'Days_3', label: '3 Days' },
  { id: 'Days_7', label: '7 Days' },
  { id: 'Days_10', label: '10 Days' },
];

const DURATIONS_AUCTION = [
  { id: 'Days_3', label: '3 Days' },
  { id: 'Days_5', label: '5 Days' },
  { id: 'Days_7', label: '7 Days' },
  { id: 'Days_10', label: '10 Days' },
];


// =========== EDIT LISTING MODAL ===========
const EditListingModal = ({ isOpen, onClose, listing, onSuccess }) => {
  const [form, setForm] = useState({ title: '', price: '', quantity: 1 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (listing) {
      setForm({
        title: listing.title || '',
        price: listing.price || '',
        quantity: listing.quantity_available || 1,
      });
      setDirty(false);
    }
  }, [listing]);

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { item_id: listing.item_id };
      if (form.title !== listing.title) payload.title = form.title;
      if (parseFloat(form.price) !== listing.price) payload.price = parseFloat(form.price);
      if (parseInt(form.quantity) !== (listing.quantity_available || 1)) payload.quantity = parseInt(form.quantity);

      const res = await axios.post(`${API}/api/ebay/sell/revise`, payload);
      if (res.data.success) {
        toast.success('Listing updated on eBay!');
        if (res.data.warnings?.length > 0) {
          res.data.warnings.forEach(w => toast.warning(w, { duration: 5000 }));
        }
        onSuccess?.();
        onClose();
      } else {
        toast.error(res.data.message || 'Failed to update');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !listing) return null;

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4 overflow-y-auto" onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl w-full max-w-lg mb-8 shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#3b82f6]" />
              <h2 className="text-sm font-bold text-white">Edit Listing</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/5 rounded" data-testid="close-edit-modal"><X className="w-4 h-4 text-gray-500" /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* Listing Image + Info */}
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                {listing.image_url ? (
                  <img src={listing.image_url} alt="" className="w-full h-full object-cover" />
                ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-700" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">eBay Item ID</p>
                <p className="text-xs text-gray-400 font-mono mb-2">{listing.item_id}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500 uppercase">
                    {listing.listing_type === 'FixedPriceItem' ? 'Buy It Now' : 'Auction'}
                  </span>
                  {listing.watch_count > 0 && (
                    <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{listing.watch_count} watchers</span>
                  )}
                  <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />{parseTimeLeft(listing.time_left)}</span>
                </div>
              </div>
            </div>

            {/* Editable Title */}
            <div>
              <label className={labelCls}>Title</label>
              <input className={inputCls} value={form.title} onChange={e => handleChange('title', e.target.value)} maxLength={80} data-testid="edit-listing-title" />
              <p className="text-[10px] text-gray-600 mt-0.5 text-right">{form.title.length}/80</p>
            </div>

            {/* Price + Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Price ($)</label>
                <input className={inputCls} type="number" step="0.01" min="0.99" value={form.price} onChange={e => handleChange('price', e.target.value)} data-testid="edit-listing-price" />
              </div>
              <div>
                <label className={labelCls}>Quantity</label>
                <input className={inputCls} type="number" min="1" value={form.quantity} onChange={e => handleChange('quantity', e.target.value)} data-testid="edit-listing-quantity" />
              </div>
            </div>

            {/* Current Price Display */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Current eBay Price:</span>
                <span className="text-sm font-bold text-emerald-400">${listing.price}</span>
              </div>
              {dirty && parseFloat(form.price) !== listing.price && (
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#1a1a1a]">
                  <span className="text-[11px] text-gray-500">New Price:</span>
                  <span className="text-sm font-bold text-[#3b82f6]">${parseFloat(form.price).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <a href={listing.url} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-sm text-[#3b82f6] hover:bg-[#3b82f6]/10 flex items-center gap-1.5 transition-colors"
                data-testid="edit-view-on-ebay">
                <ExternalLink className="w-3.5 h-3.5" />View on eBay
              </a>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving || !dirty}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-40 transition-colors flex items-center gap-2"
                  data-testid="save-listing-btn">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};


// =========== CREATE LISTING MODAL ===========
const CreateListingModal = ({ isOpen, onClose, inventoryItems, onSuccess }) => {
  const [step, setStep] = useState(1); // 1=select card, 2=configure, 3=confirm
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    listing_format: 'FixedPriceItem',
    duration: 'GTC',
    condition_id: 3000,
    condition_description: '',
    shipping_option: 'FreeShipping',
    shipping_cost: 0,
  });

  const filteredItems = inventoryItems.filter(i =>
    !i.listed && (
      i.card_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.player?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleSelectCard = async (item) => {
    setSelectedItem(item);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/preview`, { inventory_item_id: item.id });
      setForm(f => ({
        ...f,
        title: res.data.title,
        description: res.data.description,
        price: res.data.suggested_price,
        condition_id: res.data.condition_id,
      }));
      setStep(2);
    } catch (err) {
      toast.error('Failed to generate listing preview');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!form.price || parseFloat(form.price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    setPublishing(true);
    setResult(null);
    try {
      const payload = {
        inventory_item_id: selectedItem.id,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        listing_format: form.listing_format,
        duration: form.duration,
        condition_id: form.condition_id,
        condition_description: form.condition_description || null,
        shipping_option: form.shipping_option,
        shipping_cost: parseFloat(form.shipping_cost) || 0,
      };
      const res = await axios.post(`${API}/api/ebay/sell/create`, payload);
      setResult(res.data);
      if (res.data.success) {
        toast.success('Listing published on eBay!');
        setStep(3);
        onSuccess?.();
      } else {
        toast.error(res.data.message || 'Failed to create listing');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish listing');
    } finally {
      setPublishing(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedItem(null);
    setResult(null);
    setForm({ title: '', description: '', price: '', listing_format: 'FixedPriceItem', duration: 'GTC', condition_id: 3000, condition_description: '', shipping_option: 'FreeShipping', shipping_cost: 0 });
  };

  if (!isOpen) return null;

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-8 sm:pt-12 px-4 overflow-y-auto" onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl w-full max-w-2xl mb-8 shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#3b82f6]" />
              <h2 className="text-sm font-bold text-white">
                {step === 1 ? 'Select Card to List' : step === 2 ? 'Configure Listing' : 'Listing Published'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`w-2 h-2 rounded-full ${step >= s ? 'bg-[#3b82f6]' : 'bg-[#222]'}`} />
                ))}
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white text-lg" data-testid="close-listing-modal">&times;</button>
            </div>
          </div>

          {/* Step 1: Select Card */}
          {step === 1 && (
            <div className="p-5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                  placeholder="Search your inventory..." value={search} onChange={e => setSearch(e.target.value)} data-testid="listing-search-input" />
              </div>
              {loading && <div className="flex items-center justify-center py-8"><RefreshCw className="w-5 h-5 text-[#3b82f6] animate-spin" /></div>}
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No unlisted cards found</p>
                    <p className="text-xs text-gray-600 mt-1">Add cards to your inventory first</p>
                  </div>
                ) : filteredItems.map((item, i) => (
                  <button key={item.id} onClick={() => handleSelectCard(item)}
                    className="w-full flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl hover:border-[#3b82f6]/50 transition-colors text-left"
                    data-testid={`select-card-${i}`}>
                    <div className="w-10 h-13 rounded bg-[#111] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                      {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-700" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.card_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.player && <span className="text-[11px] text-gray-400">{item.player}</span>}
                        {item.condition === 'Graded' && item.grade && <span className="text-[11px] text-amber-400">{item.grading_company} {item.grade}</span>}
                        {item.condition === 'Raw' && <span className="text-[10px] text-gray-600">Raw</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{formatPrice(item.purchase_price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && selectedItem && (
            <div className="p-5 space-y-4">
              {/* Card Preview */}
              <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                <div className="w-10 h-13 rounded bg-[#111] overflow-hidden flex-shrink-0">
                  {selectedItem.image ? <img src={`data:image/jpeg;base64,${selectedItem.image}`} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 text-gray-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedItem.card_name}</p>
                  <p className="text-[11px] text-gray-500">{selectedItem.player} {selectedItem.year || ''}</p>
                </div>
                <button onClick={handleReset} className="text-xs text-[#3b82f6] hover:text-[#60a5fa]">Change</button>
              </div>

              {/* Title */}
              <div>
                <label className={labelCls}>Listing Title</label>
                <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={80} data-testid="listing-title-input" />
                <p className="text-[10px] text-gray-600 mt-0.5 text-right">{form.title.length}/80</p>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} h-24 resize-none`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="listing-desc-input" />
              </div>

              {/* Price & Format */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price ($)</label>
                  <input className={inputCls} type="number" step="0.01" min="0.99" placeholder="9.99" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} data-testid="listing-price-input" />
                </div>
                <div>
                  <label className={labelCls}>Format</label>
                  <div className="flex gap-2">
                    {[{ val: 'FixedPriceItem', label: 'Buy It Now', icon: DollarSign }, { val: 'Chinese', label: 'Auction', icon: Gavel }].map(({ val, label, icon: Icon }) => (
                      <button key={val} type="button" onClick={() => setForm(f => ({ ...f, listing_format: val, duration: val === 'FixedPriceItem' ? 'GTC' : 'Days_7' }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${form.listing_format === val ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-white'}`}
                        data-testid={`format-${val}`}><Icon className="w-3.5 h-3.5" />{label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Duration & Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Duration</label>
                  <select className={inputCls} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} data-testid="listing-duration">
                    {(form.listing_format === 'FixedPriceItem' ? DURATIONS_BIN : DURATIONS_AUCTION).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Condition</label>
                  <select className={inputCls} value={form.condition_id} onChange={e => setForm(f => ({ ...f, condition_id: parseInt(e.target.value) }))} data-testid="listing-condition">
                    {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Shipping */}
              <div>
                <label className={labelCls}>Shipping</label>
                <div className="flex gap-2">
                  {SHIPPING_OPTIONS.map(({ id, label, cost }) => (
                    <button key={id} type="button" onClick={() => setForm(f => ({ ...f, shipping_option: id, shipping_cost: cost }))}
                      className={`flex-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium border transition-colors ${form.shipping_option === id ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-white'}`}
                      data-testid={`shipping-${id}`}>
                      <Truck className="w-3.5 h-3.5" />
                      <span>{label}</span>
                      <span className="text-[10px]">{cost > 0 ? `$${cost.toFixed(2)}` : 'Free'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition Description */}
              <div>
                <label className={labelCls}>Condition Notes (optional)</label>
                <input className={inputCls} placeholder="e.g. Card has minor wear on corners..." value={form.condition_description} onChange={e => setForm(f => ({ ...f, condition_description: e.target.value }))} data-testid="listing-cond-desc" />
              </div>

              {/* Publish Button */}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Back</button>
                <button onClick={handlePublish} disabled={publishing || !form.price}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:opacity-50 transition-colors flex items-center gap-2"
                  data-testid="publish-listing-btn">
                  {publishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  {publishing ? 'Publishing...' : 'Publish on eBay'}
                </button>
              </div>

              {/* Error result inline */}
              {result && !result.success && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400 text-sm mb-1"><AlertTriangle className="w-4 h-4" /><span className="font-semibold">Error</span></div>
                  <p className="text-xs text-red-300">{result.message}</p>
                  {result.errors?.map((e, i) => <p key={i} className="text-[10px] text-red-400 mt-1">Code {e.code}: {e.message}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && result?.success && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#22c55e]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Listed on eBay!</h3>
                <p className="text-sm text-gray-400 mt-1">Item ID: {result.ebay_item_id}</p>
              </div>
              {result.warnings?.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-left">
                  <p className="text-xs text-amber-400 font-semibold mb-1">Warnings:</p>
                  {result.warnings.map((w, i) => <p key={i} className="text-[10px] text-amber-300">{w}</p>)}
                </div>
              )}
              <div className="flex justify-center gap-3">
                <a href={result.url} target="_blank" rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] flex items-center gap-2"
                  data-testid="view-on-ebay-btn">
                  <ExternalLink className="w-4 h-4" />View on eBay
                </a>
                <button onClick={() => { handleReset(); }} className="px-5 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-white text-sm font-semibold hover:bg-white/5 flex items-center gap-2"
                  data-testid="list-another-btn">
                  <Plus className="w-4 h-4" />List Another
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};


// =========== MAIN LISTINGS MODULE ===========
const ListingsModule = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [ebayData, setEbayData] = useState(null);
  const [createdListings, setCreatedListings] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editListing, setEditListing] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [ebayRes, createdRes, invRes] = await Promise.allSettled([
        axios.get(`${API}/api/ebay/seller/my-listings?limit=50`),
        axios.get(`${API}/api/ebay/sell/created-listings`),
        axios.get(`${API}/api/inventory?limit=200`),
      ]);
      if (ebayRes.status === 'fulfilled') setEbayData(ebayRes.value.data);
      if (createdRes.status === 'fulfilled') setCreatedListings(createdRes.value.data.listings || []);
      if (invRes.status === 'fulfilled') setInventoryItems(invRes.value.data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const eb = ebayData || { active: [], sold: [], active_total: 0, sold_total: 0 };
  const totalValue = eb.active.reduce((s, i) => s + (i.price || 0), 0);
  const totalSold = eb.sold.reduce((s, i) => s + (i.price || 0), 0);

  const tabs = [
    { id: 'active', label: `Active (${eb.active_total || 0})`, icon: Tag },
    { id: 'sold', label: `Sold (${eb.sold_total || 0})`, icon: DollarSign },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-8" data-testid="listings-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Listings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your eBay listings</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#22c55e] text-white text-sm font-bold hover:bg-[#16a34a] transition-colors"
          data-testid="create-listing-btn">
          <Plus className="w-4 h-4" />Create Listing
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Tag, label: 'Active', val: eb.active_total || 0, color: 'bg-[#3b82f6]' },
          { icon: DollarSign, label: 'Total Value', val: formatPrice(totalValue), color: 'bg-emerald-600' },
          { icon: ShoppingBag, label: 'Sold', val: eb.sold_total || 0, color: 'bg-amber-600' },
          { icon: DollarSign, label: 'Revenue', val: formatPrice(totalSold), color: 'bg-purple-600' },
        ].map(({ icon: Icon, label, val, color }, i) => (
          <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[10px] uppercase tracking-widest text-gray-600">{label}</span>
            </div>
            <p className="text-lg font-bold text-white" data-testid={`listing-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
              }`} data-testid={`listings-tab-${id}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
        <ViewToggle view={viewMode} onChange={setViewMode} />
      </div>

      {/* Active Listings */}
      {activeTab === 'active' && (
        eb.active.length === 0 ? (
          <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
            <Tag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">No active listings</p>
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-semibold" data-testid="empty-create-btn">
              <Plus className="w-4 h-4 inline mr-1" />Create Your First Listing
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {eb.active.map((item, i) => (
              <motion.div key={item.item_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#3b82f6]/40 transition-colors group cursor-pointer"
                onClick={() => setEditListing(item)} data-testid={`active-listing-${i}`}>
                <div className="aspect-square bg-[#0a0a0a] overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/90 text-white font-bold">
                    ${item.price}
                  </span>
                  <span className="absolute top-2 right-2 text-[8px] px-1.5 py-0.5 rounded bg-black/70 text-gray-300 uppercase">
                    {item.listing_type === 'FixedPriceItem' ? 'BIN' : 'Auction'}
                  </span>
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] px-2 py-1 rounded bg-[#3b82f6] text-white font-semibold flex items-center gap-1">
                      <Edit2 className="w-2.5 h-2.5" />Edit
                    </span>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-semibold text-white line-clamp-2 leading-relaxed mb-1.5">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      {item.watch_count > 0 && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{item.watch_count}</span>}
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{parseTimeLeft(item.time_left)}</span>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="p-1 hover:bg-white/10 rounded transition-colors">
                      <ExternalLink className="w-3 h-3 text-gray-600 hover:text-[#3b82f6]" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {eb.active.map((item, i) => (
              <motion.div key={item.item_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 flex items-center gap-3 hover:border-[#3b82f6]/40 transition-colors cursor-pointer"
                onClick={() => setEditListing(item)} data-testid={`active-listing-${i}`}>
                <div className="w-12 h-12 rounded bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 text-gray-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500 uppercase">{item.listing_type === 'FixedPriceItem' ? 'Buy Now' : 'Auction'}</span>
                    {item.watch_count > 0 && <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{item.watch_count}</span>}
                    <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />{parseTimeLeft(item.time_left)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-400">${item.price}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setEditListing(item); }}
                  className="p-1.5 hover:bg-[#3b82f6]/10 rounded-lg transition-colors text-gray-500 hover:text-[#3b82f6]" data-testid={`edit-btn-${i}`}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 hover:text-[#3b82f6]" />
                </a>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Sold Listings */}
      {activeTab === 'sold' && (
        eb.sold.length === 0 ? (
          <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
            <ShoppingBag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No sold items yet</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {eb.sold.map((item, i) => (
              <motion.div key={item.item_id || i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid={`sold-listing-${i}`}>
                <div className="aspect-square bg-[#0a0a0a] overflow-hidden relative">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full bg-amber-500/90 text-white font-bold">SOLD</span>
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-semibold text-white line-clamp-2 leading-relaxed mb-1">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-400">${item.price}</span>
                    {item.buyer && <span className="text-[10px] text-gray-500">{item.buyer}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {eb.sold.map((item, i) => (
              <div key={item.item_id || i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 flex items-center gap-3" data-testid={`sold-listing-${i}`}>
                <div className="w-12 h-12 rounded bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 text-gray-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  {item.buyer && <p className="text-[11px] text-gray-500 mt-0.5">Buyer: {item.buyer}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase font-bold">Sold</span>
                  <span className="text-sm font-bold text-emerald-400">${item.price}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Listing Modal */}
      <CreateListingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        inventoryItems={inventoryItems}
        onSuccess={fetchData}
      />

      {/* Edit Listing Modal */}
      <EditListingModal
        isOpen={!!editListing}
        onClose={() => setEditListing(null)}
        listing={editListing}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default ListingsModule;
