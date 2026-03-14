import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, ExternalLink, RefreshCw, Clock, Eye, Package,
  DollarSign, ShoppingBag, Plus, Search, Layers,
  Image as ImageIcon, Truck, Gavel, CheckCircle2, AlertTriangle,
  Edit2, Save, X, ChevronLeft, TrendingUp, BarChart3, ArrowUpRight, Trash2
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


// =========== LISTING DETAIL / EDIT VIEW (INLINE, NO POPUP) ===========
const ListingDetail = ({ listing, onBack, onSuccess, onEndListing }) => {
  const [form, setForm] = useState({ title: '', price: '', quantity: 1, description: '' });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const listingId = listing?.item_id;

  // Initialize form when listing changes
  useEffect(() => {
    if (listing) {
      setForm({
        title: listing.title || '',
        price: listing.price || '',
        quantity: listing.quantity_available || 1,
        description: '',
      });
      setDirty(false);
    }
  }, [listingId]);

  // Fetch market data separately - only when listing ID changes
  useEffect(() => {
    if (!listing?.title) return;
    let cancelled = false;
    const fetchMarket = async () => {
      setLoadingMarket(true);
      try {
        const params = { query: listing.title };
        if (listing.item_id) params.ebay_item_id = listing.item_id;
        const res = await axios.get(`${API}/api/market/card-value`, { params });
        if (!cancelled) setMarketData(res.data);
      } catch {
        if (!cancelled) setMarketData(null);
      } finally {
        if (!cancelled) setLoadingMarket(false);
      }
    };
    fetchMarket();
    return () => { cancelled = true; };
  }, [listingId]);

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
      if (form.description.trim()) payload.description = form.description;

      const res = await axios.post(`${API}/api/ebay/sell/revise`, payload);
      if (res.data.success) {
        toast.success('Listing updated on eBay!');
        if (res.data.warnings?.length > 0) {
          res.data.warnings.forEach(w => toast.warning(w, { duration: 5000 }));
        }
        onSuccess?.();
        onBack();
      } else {
        toast.error(res.data.message || 'Failed to update');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  const primary = marketData?.primary || {};
  const secondary = marketData?.secondary || {};
  const primaryStats = primary.stats || {};
  const secondaryStats = secondary.stats || {};
  const primaryItems = primary.items || [];
  const secondaryItems = secondary.items || [];
  const isGraded = marketData?.is_graded || false;
  const detectedGrade = marketData?.detected_grade || '';

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1.5 font-medium";

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="space-y-5" data-testid="listing-detail-view">

      {/* Back Button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors" data-testid="back-to-listings">
        <ChevronLeft className="w-4 h-4" />Back to Listings
      </button>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* LEFT: Image + Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card Image */}
          <div className="rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#1a1a1a]">
            {listing.image_url ? (
              <img src={listing.image_url} alt={listing.title} className="w-full aspect-square object-contain" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center"><ImageIcon className="w-16 h-16 text-gray-800" /></div>
            )}
          </div>

          {/* Listing Info */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-gray-600">eBay Item ID</span>
              <span className="text-xs text-gray-400 font-mono">{listing.item_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-gray-600">Format</span>
              <span className="text-xs text-gray-300">{listing.listing_type === 'FixedPriceItem' ? 'Buy It Now' : 'Auction'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-gray-600">Time Left</span>
              <span className="text-xs text-gray-300 flex items-center gap-1"><Clock className="w-3 h-3" />{parseTimeLeft(listing.time_left)}</span>
            </div>
            {listing.watch_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-600">Watchers</span>
                <span className="text-xs text-amber-400 flex items-center gap-1"><Eye className="w-3 h-3" />{listing.watch_count}</span>
              </div>
            )}
            <a href={listing.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] text-sm text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
              data-testid="detail-view-on-ebay">
              <ExternalLink className="w-4 h-4" />View on eBay
            </a>
            {onEndListing && (
              <button onClick={() => onEndListing(listing.item_id)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#0a0a0a] border border-red-900/30 text-sm text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                data-testid="detail-end-listing-btn">
                <Trash2 className="w-4 h-4" />End Listing
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Edit Fields + Market Data */}
        <div className="lg:col-span-3 space-y-4">

          {/* YOUR PRICE + MARKET COMPARISON - Combined prominent panel */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="market-comparison-panel">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
              <BarChart3 className="w-4 h-4 text-[#3b82f6]" />
              <h3 className="text-sm font-bold text-white">Price & Market Comparison</h3>
              {!loadingMarket && marketData?.data_source === 'sold' && <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase font-bold ml-auto">Sold Data</span>}
              {!loadingMarket && marketData?.data_source === 'active' && <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase font-bold ml-auto">Active Listings</span>}
            </div>

            {/* Price Comparison Summary - Always visible when data is loaded */}
            <div className="p-4 space-y-4">
              {/* Your Price vs Market - BIG prominent comparison */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Your Price</p>
                  <p className="text-2xl font-black text-white" data-testid="your-price-display">${listing.price}</p>
                  {dirty && parseFloat(form.price) !== listing.price && (
                    <p className="text-sm font-bold text-[#3b82f6] mt-0.5">&rarr; ${parseFloat(form.price).toFixed(2)}</p>
                  )}
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Market Median</p>
                  {loadingMarket ? (
                    <RefreshCw className="w-5 h-5 text-[#3b82f6] animate-spin mx-auto mt-1" />
                  ) : primaryStats.count > 0 ? (
                    <>
                      <p className="text-2xl font-black text-emerald-400" data-testid="market-median-display">{formatPrice(primaryStats.median)}</p>
                      <p className="text-[9px] text-gray-600">{primaryStats.count} sold &middot; {primary.label}</p>
                    </>
                  ) : secondaryStats.count > 0 ? (
                    <>
                      <p className="text-2xl font-black text-amber-400">{formatPrice(secondaryStats.median)}</p>
                      <p className="text-[9px] text-gray-600">{secondaryStats.count} sold &middot; {secondary.label}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 mt-1">No data</p>
                  )}
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Status</p>
                  {loadingMarket ? (
                    <RefreshCw className="w-5 h-5 text-gray-600 animate-spin mx-auto mt-1" />
                  ) : (() => {
                    const median = primaryStats.count > 0 ? primaryStats.median : secondaryStats.median;
                    if (!median) return <p className="text-sm text-gray-600 mt-1">-</p>;
                    const diff = listing.price - median;
                    const pct = Math.round((diff / median) * 100);
                    if (listing.price > median * 1.2) return (
                      <div data-testid="price-status">
                        <p className="text-xl font-black text-amber-400">+{pct}%</p>
                        <p className="text-[9px] text-amber-400">Above market</p>
                      </div>
                    );
                    if (listing.price < median * 0.8) return (
                      <div data-testid="price-status">
                        <p className="text-xl font-black text-emerald-400">{pct}%</p>
                        <p className="text-[9px] text-emerald-400">Below market</p>
                      </div>
                    );
                    return (
                      <div data-testid="price-status">
                        <p className="text-xl font-black text-white">{pct > 0 ? '+' : ''}{pct}%</p>
                        <p className="text-[9px] text-gray-400">Fair price</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Grade detection indicator */}
              {isGraded && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-300">Graded card: <span className="font-bold">{detectedGrade}</span> — comparing with same grade sales</span>
                </div>
              )}

              {/* Detailed stats */}
              {!loadingMarket && (primaryStats.count > 0 || secondaryStats.count > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{primary.label || 'Primary'}</p>
                    {primaryStats.count > 0 ? (
                      <>
                        <p className="text-lg font-bold text-white">{formatPrice(primaryStats.median)}</p>
                        <p className="text-[10px] text-gray-500">{primaryStats.count} sold &middot; Avg {formatPrice(primaryStats.avg)}</p>
                        <p className="text-[10px] text-gray-600">Range: {formatPrice(primaryStats.min)} - {formatPrice(primaryStats.max)}</p>
                      </>
                    ) : <p className="text-xs text-gray-600 italic">No recent sales</p>}
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{secondary.label || 'Secondary'}</p>
                    {secondaryStats.count > 0 ? (
                      <>
                        <p className="text-lg font-bold text-amber-400">{formatPrice(secondaryStats.median)}</p>
                        <p className="text-[10px] text-gray-500">{secondaryStats.count} sold &middot; Avg {formatPrice(secondaryStats.avg)}</p>
                        <p className="text-[10px] text-gray-600">Range: {formatPrice(secondaryStats.min)} - {formatPrice(secondaryStats.max)}</p>
                      </>
                    ) : <p className="text-xs text-gray-600 italic">No recent sales</p>}
                  </div>
                </div>
              )}

              {/* Recent Sales */}
              {!loadingMarket && (primaryItems.length > 0 || secondaryItems.length > 0) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-600">Recent Sales</p>
                    {marketData?.sold_search_url && (
                      <a href={marketData.sold_search_url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors" data-testid="view-all-sold-link">
                        View all on eBay &rarr;
                      </a>
                    )}
                  </div>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {[...primaryItems.slice(0, 5), ...secondaryItems.slice(0, 3)].map((sale, i) => (
                      <a key={i} href={sale.url || marketData?.sold_search_url || '#'} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.05] group cursor-pointer" data-testid={`sold-item-link-${i}`}>
                        {sale.image_url && <img src={sale.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-400 truncate group-hover:text-[#3b82f6]">{sale.title}</p>
                          {sale.date_sold && <p className="text-[9px] text-gray-600">Sold {sale.date_sold}</p>}
                        </div>
                        <span className="text-xs font-bold text-emerald-400 flex-shrink-0">${sale.price}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {loadingMarket && (
                <div className="flex items-center gap-2 text-gray-500 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Searching eBay sold listings...</span>
                </div>
              )}
            </div>
          </div>

          {/* Edit Fields */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
              <Edit2 className="w-4 h-4 text-[#3b82f6]" />
              <h3 className="text-sm font-bold text-white">Edit Listing</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Title */}
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

              {/* Description update */}
              <div>
                <label className={labelCls}>Update Description (optional)</label>
                <textarea className={`${inputCls} h-20 resize-none`} placeholder="Leave empty to keep current description..." value={form.description} onChange={e => handleChange('description', e.target.value)} data-testid="edit-listing-desc" />
              </div>

              {/* Save Button */}
              <button onClick={handleSave} disabled={saving || !dirty}
                className="w-full py-3 rounded-lg text-sm font-bold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                data-testid="save-listing-btn">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Applying Changes...' : 'Apply Changes to eBay'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};


// =========== CREATE LISTING MODAL ===========
const CreateListingModal = ({ isOpen, onClose, inventoryItems, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', price: '', listing_format: 'FixedPriceItem',
    duration: 'GTC', condition_id: 3000, condition_description: '',
    shipping_option: 'FreeShipping', shipping_cost: 0,
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
      setForm(f => ({ ...f, title: res.data.title, description: res.data.description, price: res.data.suggested_price, condition_id: res.data.condition_id }));
      setStep(2);
    } catch { toast.error('Failed to generate listing preview'); }
    finally { setLoading(false); }
  };

  const handlePublish = async () => {
    if (!form.price || parseFloat(form.price) <= 0) { toast.error('Enter a valid price'); return; }
    setPublishing(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/create`, {
        inventory_item_id: selectedItem.id, title: form.title, description: form.description,
        price: parseFloat(form.price), listing_format: form.listing_format, duration: form.duration,
        condition_id: form.condition_id, condition_description: form.condition_description || null,
        shipping_option: form.shipping_option, shipping_cost: parseFloat(form.shipping_cost) || 0,
      });
      setResult(res.data);
      if (res.data.success) { toast.success('Listing published on eBay!'); setStep(3); onSuccess?.(); }
      else { toast.error(res.data.message || 'Failed to create listing'); }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to publish'); }
    finally { setPublishing(false); }
  };

  const handleReset = () => {
    setStep(1); setSelectedItem(null); setResult(null);
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

          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#3b82f6]" />
              <h2 className="text-sm font-bold text-white">
                {step === 1 ? 'Select Card to List' : step === 2 ? 'Configure Listing' : 'Listing Published'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">{[1, 2, 3].map(s => <div key={s} className={`w-2 h-2 rounded-full ${step >= s ? 'bg-[#3b82f6]' : 'bg-[#222]'}`} />)}</div>
              <button onClick={onClose} className="text-gray-500 hover:text-white text-lg" data-testid="close-listing-modal">&times;</button>
            </div>
          </div>

          {/* Step 1: Select */}
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
                  <div className="text-center py-8"><Package className="w-8 h-8 text-gray-700 mx-auto mb-2" /><p className="text-sm text-gray-500">No unlisted cards</p></div>
                ) : filteredItems.map((item, i) => (
                  <button key={item.id} onClick={() => handleSelectCard(item)}
                    className="w-full flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl hover:border-[#3b82f6]/50 transition-colors text-left"
                    data-testid={`select-card-${i}`}>
                    <div className="w-10 h-13 rounded bg-[#111] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                      {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 text-gray-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.card_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.player && <span className="text-[11px] text-gray-400">{item.player}</span>}
                        {item.condition === 'Graded' && item.grade && <span className="text-[11px] text-amber-400">{item.grading_company} {item.grade}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white flex-shrink-0">{formatPrice(item.purchase_price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && selectedItem && (
            <div className="p-5 space-y-4">
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
              <div>
                <label className={labelCls}>Listing Title</label>
                <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={80} data-testid="listing-title-input" />
                <p className="text-[10px] text-gray-600 mt-0.5 text-right">{form.title.length}/80</p>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} h-24 resize-none`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="listing-desc-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price ($)</label>
                  <input className={inputCls} type="number" step="0.01" min="0.99" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} data-testid="listing-price-input" />
                </div>
                <div>
                  <label className={labelCls}>Format</label>
                  <div className="flex gap-2">
                    {[{ val: 'FixedPriceItem', label: 'BIN', icon: DollarSign }, { val: 'Chinese', label: 'Auction', icon: Gavel }].map(({ val, label, icon: Icon }) => (
                      <button key={val} type="button" onClick={() => setForm(f => ({ ...f, listing_format: val, duration: val === 'FixedPriceItem' ? 'GTC' : 'Days_7' }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${form.listing_format === val ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                        data-testid={`format-${val}`}><Icon className="w-3.5 h-3.5" />{label}</button>
                    ))}
                  </div>
                </div>
              </div>
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
              <div>
                <label className={labelCls}>Shipping</label>
                <div className="flex gap-2">
                  {SHIPPING_OPTIONS.map(({ id, label, cost }) => (
                    <button key={id} type="button" onClick={() => setForm(f => ({ ...f, shipping_option: id, shipping_cost: cost }))}
                      className={`flex-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium border transition-colors ${form.shipping_option === id ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                      data-testid={`shipping-${id}`}><Truck className="w-3.5 h-3.5" /><span>{label}</span><span className="text-[10px]">{cost > 0 ? `$${cost.toFixed(2)}` : 'Free'}</span></button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5">Back</button>
                <button onClick={handlePublish} disabled={publishing || !form.price}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:opacity-50 flex items-center gap-2"
                  data-testid="publish-listing-btn">
                  {publishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                  {publishing ? 'Publishing...' : 'Publish on eBay'}
                </button>
              </div>
              {result && !result.success && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400 text-sm mb-1"><AlertTriangle className="w-4 h-4" /><span className="font-semibold">Error</span></div>
                  <p className="text-xs text-red-300">{result.message}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && result?.success && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-[#22c55e]" /></div>
              <div><h3 className="text-lg font-bold text-white">Listed on eBay!</h3><p className="text-sm text-gray-400 mt-1">Item ID: {result.ebay_item_id}</p></div>
              <div className="flex justify-center gap-3">
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] flex items-center gap-2" data-testid="view-on-ebay-btn"><ExternalLink className="w-4 h-4" />View on eBay</a>
                <button onClick={handleReset} className="px-5 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-white text-sm font-semibold hover:bg-white/5 flex items-center gap-2" data-testid="list-another-btn"><Plus className="w-4 h-4" />List Another</button>
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
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [ebayRes, invRes] = await Promise.allSettled([
        axios.get(`${API}/api/ebay/seller/my-listings?limit=200`),
        axios.get(`${API}/api/inventory?limit=200`),
      ]);
      if (ebayRes.status === 'fulfilled') {
        const raw = ebayRes.value.data;
        // Transform API response: { listings, total } -> { active, sold, active_total, sold_total }
        const listings = (raw.listings || raw.active || []).map(item => ({
          item_id: item.itemid || item.item_id || '',
          title: item.title || '',
          price: item.price || 0,
          image_url: item.image_url || '',
          time_left: item.time_left || '',
          watch_count: item.watchers ?? item.watch_count ?? 0,
          quantity_available: item.quantity ?? item.quantity_available ?? 1,
          listing_type: item.listing_type || 'FixedPriceItem',
          url: item.url || '',
          bids: item.bids || 0,
        }));
        const sold = (raw.sold || []).map(item => ({
          item_id: item.itemid || item.item_id || '',
          title: item.title || '',
          price: item.price || 0,
          image_url: item.image_url || '',
          buyer: item.buyer || '',
        }));
        setEbayData({
          active: listings,
          sold: sold,
          active_total: raw.total ?? raw.active_total ?? listings.length,
          sold_total: raw.sold_total ?? sold.length,
        });
      }
      if (invRes.status === 'fulfilled') setInventoryItems(invRes.value.data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const endListing = async (itemId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('End this listing on eBay? This cannot be undone.')) return;
    try {
      const res = await axios.delete(`${API}/api/ebay/sell/${itemId}`);
      if (res.data.success) {
        toast.success('Listing ended on eBay');
        setSelectedListing(null);
        setLoading(true);
        fetchData();
      } else {
        toast.error(res.data.message || 'Failed to end listing');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to end listing');
    }
  };

  const eb = ebayData || { active: [], sold: [], active_total: 0, sold_total: 0 };
  const totalValue = eb.active.reduce((s, i) => s + (i.price || 0), 0);
  const totalSold = eb.sold.reduce((s, i) => s + (i.price || 0), 0);

  const tabs = [
    { id: 'active', label: `Active (${eb.active_total || 0})`, icon: Tag },
    { id: 'sold', label: `Sold (${eb.sold_total || 0})`, icon: DollarSign },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>;

  // If a listing is selected, show detail view
  if (selectedListing) {
    return (
      <div className="pb-8" data-testid="listings-page">
        <ListingDetail
          listing={selectedListing}
          onBack={() => setSelectedListing(null)}
          onSuccess={() => { setSelectedListing(null); setLoading(true); fetchData(); }}
          onEndListing={endListing}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8" data-testid="listings-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Listings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your eBay listings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); fetchData(); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-400 text-sm hover:text-white hover:border-[#3b82f6]/30 transition-colors"
            data-testid="refresh-listings-btn">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#22c55e] text-white text-sm font-bold hover:bg-[#16a34a] transition-colors"
            data-testid="create-listing-btn">
            <Plus className="w-4 h-4" />Create Listing
          </button>
        </div>
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
                className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#3b82f6]/50 transition-all cursor-pointer group"
                onClick={() => setSelectedListing(item)} data-testid={`active-listing-${i}`}>
                <div className="aspect-square bg-[#0a0a0a] overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  {/* Big Price Badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-2.5">
                    <span className="text-lg font-black text-white drop-shadow-lg">${item.price}</span>
                  </div>
                  <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded bg-black/70 text-gray-200 uppercase font-bold">
                    {item.listing_type === 'FixedPriceItem' ? 'BIN' : 'Auction'}
                  </span>
                  {/* Action overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <span className="px-3 py-1.5 rounded-lg bg-[#3b82f6] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                      <Edit2 className="w-3.5 h-3.5" />Edit
                    </span>
                    <button onClick={(e) => endListing(item.item_id, e)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg hover:bg-red-500 transition-colors"
                      data-testid={`end-listing-${i}`}>
                      <Trash2 className="w-3.5 h-3.5" />End
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-relaxed mb-2">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      {item.watch_count > 0 && <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{item.watch_count}</span>}
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{parseTimeLeft(item.time_left)}</span>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="p-1 hover:bg-white/10 rounded transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-gray-600 hover:text-[#3b82f6]" />
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
                onClick={() => setSelectedListing(item)} data-testid={`active-listing-${i}`}>
                <div className="w-14 h-14 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
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
                  <p className="text-lg font-black text-white">${item.price}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setSelectedListing(item); }}
                  className="p-2 hover:bg-[#3b82f6]/10 rounded-lg transition-colors text-gray-500 hover:text-[#3b82f6]" data-testid={`edit-btn-${i}`}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={(e) => endListing(item.item_id, e)}
                  className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-500 hover:text-red-500" data-testid={`end-btn-${i}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
                <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <ExternalLink className="w-4 h-4 text-gray-600 hover:text-[#3b82f6]" />
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
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-2.5">
                    <span className="text-lg font-black text-emerald-400">${item.price}</span>
                  </div>
                  <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded bg-amber-500/90 text-white font-bold uppercase">Sold</span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-relaxed mb-1">{item.title}</p>
                  {item.buyer && <p className="text-[10px] text-gray-500">Buyer: {item.buyer}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {eb.sold.map((item, i) => (
              <div key={item.item_id || i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 flex items-center gap-3" data-testid={`sold-listing-${i}`}>
                <div className="w-14 h-14 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 text-gray-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  {item.buyer && <p className="text-[11px] text-gray-500 mt-0.5">Buyer: {item.buyer}</p>}
                </div>
                <span className="text-[9px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 uppercase font-bold flex-shrink-0">Sold</span>
                <span className="text-lg font-black text-emerald-400 flex-shrink-0">${item.price}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Create Listing Modal */}
      <CreateListingModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} inventoryItems={inventoryItems} onSuccess={fetchData} />
    </div>
  );
};

export default ListingsModule;
