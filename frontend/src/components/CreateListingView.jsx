import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, DollarSign, Tag, Clock, Truck, FileText,
  RefreshCw, CheckCircle2, AlertCircle, ExternalLink,
  Image as ImageIcon, ShoppingBag, Package, Zap, TrendingUp
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
  { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50, desc: 'Raw cards in envelope (US)', domestic: true },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50, desc: 'Standard envelope/package' },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50, desc: 'Faster 1-3 day delivery' },
];

const SPORTS = ['Basketball', 'Baseball', 'Football', 'Soccer', 'Hockey', 'Wrestling', 'Racing', 'Golf', 'Tennis', 'Boxing', 'MMA', 'Other'];
const GRADING_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'HGA', 'CSG', 'BVG', 'BCCG', 'KSA', 'GMA', 'ISA'];
const GRADE_OPTIONS = ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1', 'Authentic'];

const CONDITIONS = [
  { id: 400010, label: 'Near Mint or Better', desc: 'Pack fresh / Mint condition' },
  { id: 400011, label: 'Excellent', desc: 'Minor corner/edge wear' },
  { id: 400012, label: 'Very Good', desc: 'Visible wear, still presentable' },
  { id: 400013, label: 'Poor', desc: 'Heavy wear, creases, or damage' },
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
              {f.market_data && (
                <div className="mt-1.5 p-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg" data-testid={`market-data-${index}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">eBay Sold Data</span>
                  </div>
                  <div className="flex items-baseline gap-3 text-xs">
                    <span className="text-white font-bold">${f.market_data.market_value?.toFixed(2)}</span>
                    <span className="text-gray-500">median</span>
                    {f.market_data.price_range && (
                      <span className="text-gray-600">${f.market_data.price_range.low?.toFixed(2)} – ${f.market_data.price_range.high?.toFixed(2)}</span>
                    )}
                    <span className="text-gray-600">{f.market_data.sold_count} sold</span>
                  </div>
                  {f.purchase_price > 0 && (
                    <div className="text-[10px] mt-1 text-gray-500">
                      Your cost: ${Number(f.purchase_price).toFixed(2)} | Profit at suggested: ${(f.market_data.market_value - f.purchase_price).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
              {/* Price Lookup Links */}
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent([f.year, f.set_name, f.variation, f.player, f.card_number ? '#' + f.card_number : '', f.is_graded && f.grading_company ? f.grading_company : '', f.is_graded && f.grade ? f.grade : ''].filter(Boolean).join(' '))}&_sacat=0&_from=R40&LH_Sold=1&rt=nc&LH_Complete=1`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-[10px] hover:bg-yellow-500/20 active:scale-95 transition-all"
                  data-testid={`lookup-ebay-${index}`}>
                  <TrendingUp className="w-3 h-3" /> eBay Sold
                </a>
                <a href={`https://app.cardladder.com/sales-history?direction=desc&sort=date&q=${encodeURIComponent([f.year, f.set_name, f.variation, f.player, f.card_number ? '#' + f.card_number : '', f.is_graded && f.grading_company ? f.grading_company : '', f.is_graded && f.grade ? f.grade : ''].filter(Boolean).join(' '))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold text-[10px] hover:bg-[#3b82f6]/20 active:scale-95 transition-all"
                  data-testid={`lookup-cardladder-${index}`}>
                  <TrendingUp className="w-3 h-3" /> CardLadder
                </a>
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
                value={f.condition_id || 400010} onChange={e => update('condition_id', parseInt(e.target.value))}
                data-testid={`condition-select-${index}`}>
                {CONDITIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.label} — {c.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* eBay Required Item Specifics */}
          <div className="border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-[#0d0d0d] border-b border-[#1a1a1a]">
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">eBay Required Details</p>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Sport *</label>
                  <select className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                    value={f.sport || ''} onChange={e => update('sport', e.target.value)}
                    data-testid={`sport-select-${index}`}>
                    <option value="">Select sport...</option>
                    {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Player *</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                    value={f.player || ''} onChange={e => update('player', e.target.value)}
                    placeholder="Player name"
                    data-testid={`player-input-${index}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Season / Year</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                    value={f.season || ''} onChange={e => update('season', e.target.value)}
                    placeholder="2012"
                    data-testid={`season-input-${index}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Set / Brand</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                    value={f.set_name || ''} onChange={e => update('set_name', e.target.value)}
                    placeholder="Panini Prizm"
                    data-testid={`set-input-${index}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Card #</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                    value={f.card_number || ''} onChange={e => update('card_number', e.target.value)}
                    placeholder="#97"
                    data-testid={`card-number-input-${index}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Variation</label>
                  <input className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                    value={f.variation || ''} onChange={e => update('variation', e.target.value)}
                    placeholder="Refractor, Silver..."
                    data-testid={`variation-input-${index}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Graded?</label>
                  <select className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                    value={f.is_graded ? 'yes' : 'no'} onChange={e => update('is_graded', e.target.value === 'yes')}
                    data-testid={`graded-select-${index}`}>
                    <option value="no">No (Raw)</option>
                    <option value="yes">Yes (Graded)</option>
                  </select>
                </div>
              </div>
              {f.is_graded && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Grading Company *</label>
                    <select className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                      value={f.grading_company || ''} onChange={e => update('grading_company', e.target.value)}
                      data-testid={`grading-company-${index}`}>
                      <option value="">Select...</option>
                      {GRADING_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Grade *</label>
                    <select className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                      value={f.grade || ''} onChange={e => update('grade', e.target.value)}
                      data-testid={`grade-select-${index}`}>
                      <option value="">Select...</option>
                      {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shipping */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 block">Shipping</label>
            <div className="grid grid-cols-2 gap-2">
              {SHIPPING_OPTIONS.map(s => (
                <button key={s.id} onClick={() => onChange(index, { ...f, shipping_option: s.id, shipping_cost: s.cost })}
                  className={`px-3 py-2 rounded-lg text-left transition-colors ${f.shipping_option === s.id ? 'bg-[#3b82f6]/10 border border-[#3b82f6]/30' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                  data-testid={`shipping-${s.id}-${index}`}>
                  <p className={`text-xs font-bold ${f.shipping_option === s.id ? 'text-[#3b82f6]' : 'text-gray-400'}`}>{s.label}</p>
                  <p className="text-[9px] text-gray-600">{s.cost > 0 ? `$${s.cost.toFixed(2)}` : 'Free'} — {s.desc}</p>
                  {s.domestic && <p className="text-[9px] text-amber-400 mt-0.5">US Domestic Only</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Best Offer + Quantity row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Best Offer Toggle - Only for BIN */}
            {f.listing_format === 'FixedPriceItem' && (
              <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
                <div>
                  <p className="text-xs text-white font-medium">Accept Best Offers</p>
                  <p className="text-[9px] text-gray-600">Buyers can send price offers</p>
                </div>
                <button type="button" onClick={() => update('best_offer', !f.best_offer)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${f.best_offer ? 'bg-[#3b82f6]' : 'bg-[#333]'}`}
                  data-testid={`best-offer-toggle-${index}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${f.best_offer ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
            {/* Quantity */}
            <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-white font-medium">Quantity</p>
                <p className="text-[9px] text-gray-600">How many of this card?</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => update('quantity', Math.max(1, (f.quantity || 1) - 1))}
                  className="w-7 h-7 rounded-lg bg-[#1a1a1a] text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold"
                  data-testid={`qty-minus-${index}`}>-</button>
                <span className="text-sm text-white font-bold w-6 text-center" data-testid={`qty-value-${index}`}>{f.quantity || 1}</span>
                <button type="button" onClick={() => update('quantity', (f.quantity || 1) + 1)}
                  className="w-7 h-7 rounded-lg bg-[#1a1a1a] text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold"
                  data-testid={`qty-plus-${index}`}>+</button>
              </div>
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

  // Load preview data for all items + user settings + AI descriptions
  useEffect(() => {
    const loadPreviews = async () => {
      setLoadingPreviews(true);

      // Load user settings for location defaults
      let userSettings = {};
      try {
        const settingsRes = await axios.get(`${API}/api/settings`);
        userSettings = settingsRes.data || {};
      } catch {}

      const defaultPostal = userSettings.postal_code || '';
      const defaultLocation = userSettings.location || '';
      const defaultShipping = userSettings.default_shipping || 'USPSFirstClass';
      const shippingCosts = { FreeShipping: 0, PWEEnvelope: 2.50, USPSFirstClass: 4.50, USPSPriority: 8.50 };

      const defaultSport = userSettings.default_sport || '';

      const newForms = [];
      for (const item of items) {
        try {
          // Load preview + AI listing in parallel
          const [previewRes, aiRes] = await Promise.allSettled([
            axios.post(`${API}/api/ebay/sell/preview`, { inventory_item_id: item.id }),
            axios.post(`${API}/api/ebay/sell/ai-listing`, {
              card_name: item.card_name, player: item.player, year: item.year,
              set_name: item.set_name, card_number: item.card_number, variation: item.variation,
              condition: item.condition, grading_company: item.grading_company,
              grade: item.grade, sport: item.sport,
            }),
          ]);
          const p = previewRes.status === 'fulfilled' ? previewRes.value.data : {};
          const ai = aiRes.status === 'fulfilled' ? aiRes.value.data : {};
          newForms.push({
            title: ai.title || p.title || item.card_name || '',
            description: ai.description || p.description || '',
            price: item.card_value ? Number(item.card_value).toFixed(2) : (p.suggested_price || (item.purchase_price ? (item.purchase_price * 1.3).toFixed(2) : '9.99')),
            purchase_price: p.purchase_price || item.purchase_price || 0,
            market_data: p.market_data || null,
            listing_format: 'FixedPriceItem',
            duration: 'GTC',
            condition_id: p.condition_id || 400010,
            condition_description: '',
            shipping_option: defaultShipping,
            shipping_cost: shippingCosts[defaultShipping] || 4.50,
            postal_code: defaultPostal,
            location: defaultLocation,
            sport: item.sport || defaultSport,
            player: item.player || '',
            season: item.year ? String(item.year) : '',
            set_name: item.set_name || '',
            card_number: item.card_number || '',
            variation: item.variation || '',
            is_graded: item.condition === 'Graded',
            grading_company: item.grading_company || '',
            grade: item.grade ? String(item.grade).replace(/\.0$/, '') : '',
            cert_number: item.cert_number || '',
            best_offer: false,
            quantity: item.quantity || 1,
            status: null, error: null, ebay_item_id: null,
          });
        } catch {
          newForms.push({
            title: item.card_name || '', description: '',
            price: item.card_value ? Number(item.card_value).toFixed(2) : (item.purchase_price ? (item.purchase_price * 1.3).toFixed(2) : '9.99'),
            listing_format: 'FixedPriceItem', duration: 'GTC',
            condition_id: 400010, condition_description: '',
            shipping_option: defaultShipping, shipping_cost: shippingCosts[defaultShipping] || 4.50,
            postal_code: defaultPostal, location: defaultLocation,
            sport: item.sport || defaultSport, player: item.player || '',
            season: item.year ? String(item.year) : '', set_name: item.set_name || '',
            card_number: item.card_number || '', variation: item.variation || '',
            is_graded: item.condition === 'Graded',
            grading_company: item.grading_company || '',
            grade: item.grade ? String(item.grade).replace(/\.0$/, '') : '',
            cert_number: item.cert_number || '',
            best_offer: false, quantity: item.quantity || 1,
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
          postal_code: form.postal_code || '',
          location: form.location || '',
          sport: form.sport || '',
          player: form.player || '',
          season: form.season || '',
          set_name: form.set_name || '',
          card_number: form.card_number || '',
          grading_company: form.is_graded ? (form.grading_company || null) : null,
          grade: form.is_graded ? (form.grade || null) : null,
          cert_number: form.is_graded ? (form.cert_number || null) : null,
          best_offer: form.best_offer || false,
        });

        if (res.data.success) {
          updateForm(i, { ...form, status: 'success', ebay_item_id: res.data.ebay_item_id });
          successCount++;
        } else {
          updateForm(i, { ...form, status: 'error', error: res.data.message || 'Failed to create listing' });
        }
      } catch (err) {
        const msg = err.response?.status === 403
          ? (err.response.data?.detail || 'Listing limit reached. Upgrade your plan.')
          : (err.response?.data?.detail || err.message || 'Network error');
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
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-500">Shipping:</span>
              {SHIPPING_OPTIONS.map(s => (
                <button key={s.id} onClick={() => setForms(prev => prev.map(fm => fm.status !== 'success' ? { ...fm, shipping_option: s.id, shipping_cost: s.cost } : fm))}
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
