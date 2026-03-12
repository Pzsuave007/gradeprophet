import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, DollarSign, Tag, Clock, Truck, FileText,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink,
  Image as ImageIcon, ShoppingBag, Package, Zap
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const LISTING_FORMATS = [
  { id: 'FixedPriceItem', label: 'Buy It Now', icon: DollarSign, desc: 'Fixed price' },
  { id: 'Chinese', label: 'Auction', icon: Zap, desc: 'Bidding' },
];

const DURATIONS = {
  FixedPriceItem: [
    { id: 'GTC', label: 'Good Til Cancelled' },
    { id: 'Days_30', label: '30 Days' },
    { id: 'Days_7', label: '7 Days' },
    { id: 'Days_3', label: '3 Days' },
  ],
  Chinese: [
    { id: 'Days_7', label: '7 Days' },
    { id: 'Days_5', label: '5 Days' },
    { id: 'Days_3', label: '3 Days' },
    { id: 'Days_10', label: '10 Days' },
  ],
};

const SHIPPING_OPTIONS = [
  { id: 'FreeShipping', label: 'Free Shipping', cost: 0, desc: 'You cover shipping cost' },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50, desc: 'Standard envelope/package' },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50, desc: 'Faster 1-3 day delivery' },
  { id: 'UPSGround', label: 'UPS Ground', cost: 9.99, desc: 'UPS standard delivery' },
];

const CONDITIONS = [
  { id: 1000, label: 'New', desc: 'Brand new, never opened' },
  { id: 2750, label: 'Like New', desc: 'Opened but barely used' },
  { id: 3000, label: 'Very Good', desc: 'Minor wear' },
  { id: 4000, label: 'Good', desc: 'Some wear visible' },
  { id: 5000, label: 'Acceptable', desc: 'Noticeable wear' },
];

const fmt = (v) => { const n = parseFloat(v); return isNaN(n) || n === 0 ? '-' : `$${n.toFixed(2)}`; };

// =========== SINGLE CARD LISTING FORM ===========
const CardListingForm = ({ item, preview, index, form, onChange, compact }) => {
  const f = form || {};
  const update = (key, val) => onChange(index, { ...f, [key]: val });

  return (
    <div className={`bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden ${compact ? '' : 'mb-4'}`} data-testid={`listing-form-${index}`}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a]">
        <div className="w-10 h-14 rounded-lg bg-[#0a0a0a] overflow-hidden flex-shrink-0">
          {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-700" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{item.card_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.player && <span className="text-[10px] text-gray-500">{item.player}</span>}
            {item.condition === 'Graded' && item.grade && <span className="text-[10px] text-amber-400">{item.grading_company} {item.grade}</span>}
            <span className="text-[10px] text-gray-600">Cost: {fmt(item.purchase_price)}</span>
          </div>
        </div>
        {f.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
        {f.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
      </div>

      {f.status !== 'success' && (
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Listing Title</label>
            <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
              value={f.title || ''} onChange={e => update('title', e.target.value)} maxLength={80}
              data-testid={`title-input-${index}`} />
            <p className="text-[9px] text-gray-700 mt-1 text-right">{(f.title || '').length}/80</p>
          </div>

          {/* Price + Format row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Price (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input type="number" step="0.01" min="0.99"
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                  value={f.price || ''} onChange={e => update('price', e.target.value)}
                  data-testid={`price-input-${index}`} />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Format</label>
              <div className="flex gap-1">
                {LISTING_FORMATS.map(lf => (
                  <button key={lf.id} onClick={() => update('listing_format', lf.id)}
                    className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-bold transition-colors ${f.listing_format === lf.id ? 'bg-[#3b82f6] text-white' : 'bg-[#0a0a0a] border border-[#1a1a1a] text-gray-500 hover:text-white'}`}
                    data-testid={`format-${lf.id}-${index}`}>
                    {lf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Duration + Condition row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Duration</label>
              <select className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                value={f.duration || 'GTC'} onChange={e => update('duration', e.target.value)}
                data-testid={`duration-select-${index}`}>
                {(DURATIONS[f.listing_format] || DURATIONS.FixedPriceItem).map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Condition</label>
              <select className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                value={f.condition_id || 3000} onChange={e => update('condition_id', parseInt(e.target.value))}
                data-testid={`condition-select-${index}`}>
                {CONDITIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.label} — {c.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Shipping */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Shipping</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIPPING_OPTIONS.map(s => (
                <button key={s.id} onClick={() => { update('shipping_option', s.id); update('shipping_cost', s.cost); }}
                  className={`px-3 py-2 rounded-lg text-left transition-colors ${f.shipping_option === s.id ? 'bg-[#3b82f6]/10 border border-[#3b82f6]/30' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                  data-testid={`shipping-${s.id}-${index}`}>
                  <p className={`text-xs font-bold ${f.shipping_option === s.id ? 'text-[#3b82f6]' : 'text-gray-400'}`}>{s.label}</p>
                  <p className="text-[9px] text-gray-600">{s.cost > 0 ? `$${s.cost.toFixed(2)}` : 'Free'} — {s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Description</label>
            <textarea rows={4}
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none resize-none"
              value={f.description || ''} onChange={e => update('description', e.target.value)}
              placeholder="Card condition details, shipping info, etc..."
              data-testid={`description-input-${index}`} />
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">ZIP Code</label>
              <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                value={f.postal_code || ''} onChange={e => update('postal_code', e.target.value)}
                placeholder="90210"
                data-testid={`postal-code-${index}`} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Location</label>
              <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                value={f.location || ''} onChange={e => update('location', e.target.value)}
                placeholder="Los Angeles, CA"
                data-testid={`location-${index}`} />
            </div>
          </div>

          {/* Condition Description (for graded cards) */}
          {item.condition === 'Graded' && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Condition Notes</label>
              <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                value={f.condition_description || ''} onChange={e => update('condition_description', e.target.value)}
                placeholder="e.g., Clean case, perfect centering..."
                data-testid={`condition-desc-${index}`} />
            </div>
          )}

          {f.error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{f.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {f.status === 'success' && (
        <div className="p-4 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-bold text-emerald-400">Listed on eBay!</p>
          </div>
          {f.ebay_item_id && (
            <a href={`https://www.ebay.com/itm/${f.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#3b82f6] hover:text-[#60a5fa] flex items-center gap-1" data-testid={`ebay-link-${index}`}>
              View on eBay <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// =========== MAIN CREATE LISTING VIEW ===========
const CreateListingView = ({ items, onBack, onSuccess }) => {
  const [forms, setForms] = useState([]);
  const [loadingPreviews, setLoadingPreviews] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);

  // Load preview data for all items
  useEffect(() => {
    const loadPreviews = async () => {
      setLoadingPreviews(true);
      const newForms = [];
      for (const item of items) {
        try {
          const res = await axios.post(`${API}/api/ebay/sell/preview`, { inventory_item_id: item.id });
          const p = res.data;
          newForms.push({
            title: p.title || item.card_name || '',
            description: p.description || '',
            price: p.suggested_price || (item.purchase_price ? (item.purchase_price * 1.3).toFixed(2) : '9.99'),
            listing_format: 'FixedPriceItem',
            duration: 'GTC',
            condition_id: p.condition_id || 3000,
            condition_description: '',
            shipping_option: 'USPSFirstClass',
            shipping_cost: 4.50,
            postal_code: '90210',
            location: 'Los Angeles, CA',
            status: null, error: null, ebay_item_id: null,
          });
        } catch {
          newForms.push({
            title: item.card_name || '', description: '',
            price: item.purchase_price ? (item.purchase_price * 1.3).toFixed(2) : '9.99',
            listing_format: 'FixedPriceItem', duration: 'GTC',
            condition_id: 3000, condition_description: '',
            shipping_option: 'USPSFirstClass', shipping_cost: 4.50,
            postal_code: '90210', location: 'Los Angeles, CA',
            status: null, error: null, ebay_item_id: null,
          });
        }
      }
      setForms(newForms);
      setLoadingPreviews(false);
    };
    loadPreviews();
  }, [items]);

  const updateForm = (index, newForm) => {
    setForms(prev => prev.map((f, i) => i === index ? newForm : f));
  };

  // Apply price to all
  const applyToAll = (field, value) => {
    setForms(prev => prev.map(f => f.status !== 'success' ? { ...f, [field]: value } : f));
  };

  // Publish all listings
  const publishAll = async () => {
    setPublishing(true);
    setPublishProgress(0);
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const form = forms[i];
      if (form.status === 'success') { successCount++; continue; }

      try {
        const res = await axios.post(`${API}/api/ebay/sell/create`, {
          inventory_item_id: item.id,
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          listing_format: form.listing_format,
          duration: form.duration,
          condition_id: form.condition_id,
          condition_description: form.condition_description || '',
          shipping_option: form.shipping_option,
          shipping_cost: form.shipping_cost,
          category_id: '261328',
          postal_code: form.postal_code || '90210',
          location: form.location || 'US',
          sport: item.sport || 'Basketball',
          grading_company: item.grading_company || null,
          grade: item.grade ? String(item.grade) : null,
        });

        if (res.data.success) {
          updateForm(i, { ...form, status: 'success', ebay_item_id: res.data.ebay_item_id });
          successCount++;
        } else {
          updateForm(i, { ...form, status: 'error', error: res.data.message || 'Failed to create listing' });
        }
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Network error';
        updateForm(i, { ...form, status: 'error', error: msg });
      }
      setPublishProgress(i + 1);
    }

    setPublishing(false);
    if (successCount === items.length) {
      toast.success(`${successCount} listing${successCount > 1 ? 's' : ''} created!`);
    } else if (successCount > 0) {
      toast.success(`${successCount}/${items.length} listings created`);
    } else {
      toast.error('Failed to create listings');
    }
  };

  const pendingCount = forms.filter(f => f.status !== 'success').length;
  const successCount = forms.filter(f => f.status === 'success').length;
  const allDone = successCount === items.length;

  if (loadingPreviews) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin" />
        <p className="text-sm text-gray-400">Preparing {items.length} listing{items.length > 1 ? 's' : ''}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8" data-testid="create-listing-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5" data-testid="back-to-inventory">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Create eBay Listing{items.length > 1 ? 's' : ''}</h1>
            <p className="text-xs text-gray-500">{items.length} card{items.length > 1 ? 's' : ''} selected</p>
          </div>
        </div>

        {!allDone && (
          <button onClick={publishAll} disabled={publishing || pendingCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            data-testid="publish-all-btn">
            {publishing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Publishing {publishProgress}/{items.length}</>
            ) : (
              <><ShoppingBag className="w-4 h-4" /> Publish {pendingCount > 1 ? `All ${pendingCount}` : ''} to eBay</>
            )}
          </button>
        )}

        {allDone && (
          <button onClick={onSuccess}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#2563eb] transition-colors"
            data-testid="done-btn">
            <CheckCircle2 className="w-4 h-4" /> Done — Back to Inventory
          </button>
        )}
      </div>

      {/* Progress bar */}
      {publishing && (
        <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
          <motion.div className="bg-emerald-500 h-1.5 rounded-full"
            initial={{ width: 0 }} animate={{ width: `${(publishProgress / items.length) * 100}%` }}
            transition={{ duration: 0.3 }} />
        </div>
      )}

      {/* Batch actions */}
      {items.length > 1 && !allDone && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Apply to all listings</p>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Format:</span>
              {LISTING_FORMATS.map(lf => (
                <button key={lf.id} onClick={() => applyToAll('listing_format', lf.id)}
                  className="px-2 py-1 rounded text-[10px] font-bold bg-[#0a0a0a] border border-[#1a1a1a] text-gray-400 hover:text-white hover:border-[#3b82f6] transition-colors"
                  data-testid={`batch-format-${lf.id}`}>
                  {lf.label}
                </button>
              ))}
            </div>
            <div className="w-px bg-[#1a1a1a]" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Shipping:</span>
              {SHIPPING_OPTIONS.slice(0, 3).map(s => (
                <button key={s.id} onClick={() => { applyToAll('shipping_option', s.id); applyToAll('shipping_cost', s.cost); }}
                  className="px-2 py-1 rounded text-[10px] font-bold bg-[#0a0a0a] border border-[#1a1a1a] text-gray-400 hover:text-white hover:border-[#3b82f6] transition-colors"
                  data-testid={`batch-shipping-${s.id}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Card listing forms */}
      {items.map((item, i) => (
        <CardListingForm key={item.id} item={item} index={i} form={forms[i]} onChange={updateForm} compact={items.length > 3} />
      ))}
    </div>
  );
};

export default CreateListingView;
