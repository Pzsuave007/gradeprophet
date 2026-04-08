import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, ExternalLink, RefreshCw, Clock, Eye, Package,
  DollarSign, ShoppingBag, Plus, Search, Layers,
  Image as ImageIcon, Truck, Gavel, CheckCircle2, AlertTriangle,  Edit2, Save, X, ChevronLeft, ChevronRight, TrendingUp, BarChart3, ArrowUpRight, Trash2, User,
  ArrowDownUp, Calendar, ChevronDown, Check
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
  { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50, domestic: true },
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
const ListingDetail = ({ listing, cardData: initialCardData, onBack, onSuccess, onEndListing }) => {
  const [form, setForm] = useState({ title: '', price: '', quantity: 1, description: '', best_offer: false, shipping_option: null, shipping_cost: 0 });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [cardData, setCardData] = useState(initialCardData || null);
  const [lotInfo, setLotInfo] = useState(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const listingId = listing?.item_id;

  // Check if this listing is a lot
  useEffect(() => {
    if (!listingId) return;
    axios.get(`${API}/api/ebay/sell/lot-check/${listingId}`).then(res => {
      if (res.data.is_lot) setLotInfo(res.data);
    }).catch(() => {});
  }, [listingId]);

  const handleRegenImages = async () => {
    setRegenLoading(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/lot-regenerate-images`, { ebay_item_id: listingId });
      if (res.data.success) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.error || 'Failed to regenerate images');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to regenerate images');
    } finally {
      setRegenLoading(false);
    }
  };

  // Fetch card data from inventory if not passed
  useEffect(() => {
    if (initialCardData) { setCardData(initialCardData); return; }
    if (!listingId) return;
    axios.get(`${API}/api/inventory?ebay_item_id=${listingId}&limit=1`).then(res => {
      const items = res.data.items || [];
      if (items.length > 0) setCardData(items[0]);
    }).catch(() => {});
  }, [listingId, initialCardData]);

  // Initialize form when listing changes
  useEffect(() => {
    if (listing) {
      setForm({
        title: listing.title || '',
        price: listing.price || '',
        quantity: listing.quantity_available || 1,
        description: '',
        best_offer: false,
        shipping_option: null,
        shipping_cost: 0,
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
      if (form.best_offer) payload.best_offer = true;
      if (form.shipping_option) {
        payload.shipping_option = form.shipping_option;
        payload.shipping_cost = form.shipping_cost;
      }

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

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 sm:py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-500 mb-1 sm:mb-1.5 font-medium";

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="space-y-4 sm:space-y-5" data-testid="listing-detail-view">

      {/* Back Button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors" data-testid="back-to-listings">
        <ChevronLeft className="w-4 h-4" />Back to Listings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* LEFT: Image + Info */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Card Image - smaller on mobile */}
          <div className="rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#1a1a1a]">
            {listing.image_url ? (
              <img src={listing.image_url} alt={listing.title} className="w-full aspect-[4/3] sm:aspect-square object-contain" />
            ) : (
              <div className="w-full aspect-[4/3] sm:aspect-square flex items-center justify-center"><ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-800" /></div>
            )}
          </div>

          {/* Listing Info */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600">eBay Item ID</span>
              <span className="text-[11px] sm:text-xs text-gray-400 font-mono">{listing.item_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600">Format</span>
              <span className="text-[11px] sm:text-xs text-gray-300">{listing.listing_type === 'FixedPriceItem' ? 'Buy It Now' : 'Auction'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600">Time Left</span>
              <span className="text-[11px] sm:text-xs text-gray-300 flex items-center gap-1"><Clock className="w-3 h-3" />{parseTimeLeft(listing.time_left)}</span>
            </div>
            {listing.watch_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600">Watchers</span>
                <span className="text-[11px] sm:text-xs text-amber-400 flex items-center gap-1"><Eye className="w-3 h-3" />{listing.watch_count}</span>
              </div>
            )}
            {cardData?.cert_number && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-600">Cert #</span>
                <span className="text-[11px] sm:text-xs text-amber-300 font-mono font-bold" data-testid="listing-cert-number">{cardData.cert_number}</span>
              </div>
            )}
            <div className="flex gap-2">
              <a href={listing.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] text-xs sm:text-sm text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
                data-testid="detail-view-on-ebay">
                <ExternalLink className="w-3.5 h-3.5" />eBay
              </a>
              {onEndListing && (
                <button onClick={() => onEndListing(listing.item_id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-lg bg-[#0a0a0a] border border-red-900/30 text-xs sm:text-sm text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                  data-testid="detail-end-listing-btn">
                  <Trash2 className="w-3.5 h-3.5" />End
                </button>
              )}
            </div>

            {/* Lot: Regenerate Images */}
            {lotInfo && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">Bundle ({lotInfo.card_count} cards)</span>
                </div>
                <button onClick={handleRegenImages} disabled={regenLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                  data-testid="regen-images-btn">
                  {regenLoading ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Regenerating Images...</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5" /> Regenerate & Upload Images</>
                  )}
                </button>
              </div>
            )}

            {/* Price Lookup Links */}
            <div className="space-y-1.5 mt-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Price Lookup</p>
              {(() => {
                const c = cardData || {};
                const FILLER = /\b(card|cards|sports|basketball|baseball|football|soccer|hockey|legend|legends|star|rookie|rc|hot|invest|investment|rare|sp|ssp|lot|nm|ex|vg|good|fair|poor)\b/gi;
                const hasCardData = c.player || c.year || c.set_name;
                const searchQ = hasCardData
                  ? [c.year, c.set_name, c.variation, c.player, c.card_number ? '#' + c.card_number : '', c.condition === 'Graded' && c.grading_company ? c.grading_company : '', c.condition === 'Graded' && c.grade ? c.grade : ''].filter(Boolean).join(' ')
                  : (listing.title || '').replace(FILLER, '').replace(/\s{2,}/g, ' ').trim();
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQ)}&_sacat=0&_from=R40&LH_Sold=1&rt=nc&LH_Complete=1`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-xs hover:bg-yellow-500/20 active:scale-95 transition-all"
                      data-testid="listing-lookup-ebay-sold">
                      <TrendingUp className="w-4 h-4" /> eBay Sold
                    </a>
                    <a href={`https://app.cardladder.com/sales-history?direction=desc&sort=date&q=${encodeURIComponent(searchQ)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-bold text-xs hover:bg-[#3b82f6]/20 active:scale-95 transition-all"
                      data-testid="listing-lookup-cardladder">
                      <TrendingUp className="w-4 h-4" /> CardLadder
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="lg:col-span-3 space-y-3 sm:space-y-4">

          {/* YOUR PRICE + MARKET COMPARISON - Combined prominent panel */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="market-comparison-panel">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#1a1a1a]">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3b82f6]" />
              <h3 className="text-xs sm:text-sm font-bold text-white">Price & Market</h3>
              {!loadingMarket && marketData?.data_source === 'sold' && <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase font-bold ml-auto">Sold</span>}
              {!loadingMarket && marketData?.data_source === 'active' && <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase font-bold ml-auto">Active</span>}
            </div>

            {/* Price Comparison Summary */}
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Your Price vs Market */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 sm:p-3 text-center">
                  <p className="text-[8px] sm:text-[10px] uppercase tracking-wider text-gray-600 mb-0.5 sm:mb-1">Your Price</p>
                  <p className="text-lg sm:text-2xl font-black text-white" data-testid="your-price-display">${listing.price}</p>
                  {dirty && parseFloat(form.price) !== listing.price && (
                    <p className="text-xs sm:text-sm font-bold text-[#3b82f6] mt-0.5">&rarr; ${parseFloat(form.price).toFixed(2)}</p>
                  )}
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 sm:p-3 text-center">
                  <p className="text-[8px] sm:text-[10px] uppercase tracking-wider text-gray-600 mb-0.5 sm:mb-1">Median</p>
                  {loadingMarket ? (
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-[#3b82f6] animate-spin mx-auto mt-1" />
                  ) : primaryStats.count > 0 ? (
                    <>
                      <p className="text-lg sm:text-2xl font-black text-emerald-400" data-testid="market-median-display">{formatPrice(primaryStats.median)}</p>
                      <p className="text-[8px] sm:text-[9px] text-gray-600">{primaryStats.count} sold</p>
                    </>
                  ) : secondaryStats.count > 0 ? (
                    <>
                      <p className="text-lg sm:text-2xl font-black text-amber-400">{formatPrice(secondaryStats.median)}</p>
                      <p className="text-[8px] sm:text-[9px] text-gray-600">{secondaryStats.count} sold</p>
                    </>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">No data</p>
                  )}
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 sm:p-3 text-center">
                  <p className="text-[8px] sm:text-[10px] uppercase tracking-wider text-gray-600 mb-0.5 sm:mb-1">Status</p>
                  {loadingMarket ? (
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 animate-spin mx-auto mt-1" />
                  ) : (() => {
                    const median = primaryStats.count > 0 ? primaryStats.median : secondaryStats.median;
                    if (!median) return <p className="text-xs sm:text-sm text-gray-600 mt-1">-</p>;
                    const diff = listing.price - median;
                    const pct = Math.round((diff / median) * 100);
                    if (listing.price > median * 1.2) return (
                      <div data-testid="price-status">
                        <p className="text-base sm:text-xl font-black text-amber-400">+{pct}%</p>
                        <p className="text-[8px] sm:text-[9px] text-amber-400">Above</p>
                      </div>
                    );
                    if (listing.price < median * 0.8) return (
                      <div data-testid="price-status">
                        <p className="text-base sm:text-xl font-black text-emerald-400">{pct}%</p>
                        <p className="text-[8px] sm:text-[9px] text-emerald-400">Below</p>
                      </div>
                    );
                    return (
                      <div data-testid="price-status">
                        <p className="text-base sm:text-xl font-black text-white">{pct > 0 ? '+' : ''}{pct}%</p>
                        <p className="text-[8px] sm:text-[9px] text-gray-400">Fair</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Grade detection indicator */}
              {isGraded && (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2">
                  <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs text-amber-300">Graded: <span className="font-bold">{detectedGrade}</span></span>
                </div>
              )}

              {/* Detailed stats */}
              {!loadingMarket && (primaryStats.count > 0 || secondaryStats.count > 0) && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 sm:p-3">
                    <p className="text-[8px] sm:text-[10px] uppercase tracking-wider text-gray-600 mb-0.5 sm:mb-1">{primary.label || 'Primary'}</p>
                    {primaryStats.count > 0 ? (
                      <>
                        <p className="text-base sm:text-lg font-bold text-white">{formatPrice(primaryStats.median)}</p>
                        <p className="text-[9px] sm:text-[10px] text-gray-500">{primaryStats.count} sold</p>
                        <p className="text-[8px] sm:text-[10px] text-gray-600">{formatPrice(primaryStats.min)} - {formatPrice(primaryStats.max)}</p>
                      </>
                    ) : <p className="text-[10px] sm:text-xs text-gray-600 italic">No data</p>}
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 sm:p-3">
                    <p className="text-[8px] sm:text-[10px] uppercase tracking-wider text-gray-600 mb-0.5 sm:mb-1">{secondary.label || 'Secondary'}</p>
                    {secondaryStats.count > 0 ? (
                      <>
                        <p className="text-base sm:text-lg font-bold text-amber-400">{formatPrice(secondaryStats.median)}</p>
                        <p className="text-[9px] sm:text-[10px] text-gray-500">{secondaryStats.count} sold</p>
                        <p className="text-[8px] sm:text-[10px] text-gray-600">{formatPrice(secondaryStats.min)} - {formatPrice(secondaryStats.max)}</p>
                      </>
                    ) : <p className="text-[10px] sm:text-xs text-gray-600 italic">No data</p>}
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
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#1a1a1a]">
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3b82f6]" />
              <h3 className="text-xs sm:text-sm font-bold text-white">Edit Listing</h3>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Title */}
              <div>
                <label className={labelCls}>Title</label>
                <input className={inputCls} value={form.title} onChange={e => handleChange('title', e.target.value)} maxLength={80} data-testid="edit-listing-title" />
                <p className="text-[9px] sm:text-[10px] text-gray-600 mt-0.5 text-right">{form.title.length}/80</p>
              </div>

              {/* Price + Quantity */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                <textarea className={`${inputCls} h-16 sm:h-20 resize-none`} placeholder="Leave empty to keep current..." value={form.description} onChange={e => handleChange('description', e.target.value)} data-testid="edit-listing-desc" />
              </div>

              {/* Best Offer Toggle */}
              {listing.listing_type === 'FixedPriceItem' && (
                <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
                  <div>
                    <p className="text-xs sm:text-sm text-white font-medium">Accept Best Offers</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500">Buyers can send offers</p>
                  </div>
                  <button type="button" onClick={() => handleChange('best_offer', !form.best_offer)}
                    className={`relative w-10 sm:w-11 h-5 sm:h-6 rounded-full transition-colors flex-shrink-0 ${form.best_offer ? 'bg-[#3b82f6]' : 'bg-[#333]'}`}
                    data-testid="edit-best-offer-toggle">
                    <span className={`absolute top-0.5 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-white transition-transform ${form.best_offer ? 'translate-x-[20px] sm:translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {/* Update Shipping */}
              <div>
                <label className={labelCls}>Update Shipping (optional)</label>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {SHIPPING_OPTIONS.map(({ id, label, cost, domestic }) => (
                    <button key={id} type="button" onClick={() => { handleChange('shipping_option', id); setForm(f => ({ ...f, shipping_cost: cost })); }}
                      className={`flex flex-col items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-medium border transition-colors ${form.shipping_option === id ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                      data-testid={`edit-shipping-${id}`}>
                      <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="text-center leading-tight">{label}</span>
                      <span className="text-[9px] sm:text-[10px]">{cost > 0 ? `$${cost.toFixed(2)}` : 'Free'}</span>
                      {domestic && <span className="text-[8px] sm:text-[9px] text-amber-400">US Only</span>}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] sm:text-[10px] text-gray-600 mt-1">Leave unselected to keep current</p>
              </div>

              {/* Save Button */}
              <button onClick={handleSave} disabled={saving || !dirty}
                className="w-full py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-bold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                data-testid="save-listing-btn">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Applying...' : 'Apply Changes to eBay'}
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
    shipping_option: 'FreeShipping', shipping_cost: 0, best_offer: false,
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
        best_offer: form.best_offer,
      });
      setResult(res.data);
      if (res.data.success) { toast.success('Listing published on eBay!'); setStep(3); onSuccess?.(); }
      else { toast.error(res.data.message || 'Failed to create listing'); }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to publish'); }
    finally { setPublishing(false); }
  };

  const handleReset = () => {
    setStep(1); setSelectedItem(null); setResult(null);
    setForm({ title: '', description: '', price: '', listing_format: 'FixedPriceItem', duration: 'GTC', condition_id: 3000, condition_description: '', shipping_option: 'FreeShipping', shipping_cost: 0, best_offer: false });
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
                      {(item.store_thumbnail || item.thumbnail) ? <img src={`data:image/${item.store_thumbnail ? 'webp' : 'jpeg'};base64,${item.store_thumbnail || item.thumbnail}`} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 text-gray-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.card_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.player && <span className="text-[11px] text-gray-400">{item.player}</span>}
                        {item.condition === 'Graded' && item.grade && <span className="text-[11px] text-amber-400">{item.grading_company} {item.grade}</span>}
                        {item.back_thumbnail ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">F+B</span>
                        ) : (
                          <span className="text-[10px] text-gray-500 bg-gray-500/10 px-1.5 py-0.5 rounded">Front</span>
                        )}
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
                <div className="flex gap-2 flex-shrink-0">
                  <div className="w-10 h-13 rounded bg-[#111] overflow-hidden border border-[#1a1a1a]">
                    {(selectedItem.store_thumbnail || selectedItem.thumbnail) ? <img src={`data:image/${selectedItem.store_thumbnail ? 'webp' : 'jpeg'};base64,${selectedItem.store_thumbnail || selectedItem.thumbnail}`} alt="Front" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-2 text-gray-700" />}
                  </div>
                  {selectedItem.back_thumbnail && (
                    <div className="w-10 h-13 rounded bg-[#111] overflow-hidden border border-[#1a1a1a]">
                      <img src={`data:image/jpeg;base64,${selectedItem.back_thumbnail}`} alt="Back" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedItem.card_name}</p>
                  <p className="text-[11px] text-gray-500">{selectedItem.player} {selectedItem.year || ''}</p>
                  <p className="text-[10px] mt-0.5">{selectedItem.back_thumbnail ? <span className="text-emerald-400">Front + Back images</span> : <span className="text-amber-400">Front image only</span>}</p>
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
                <div className="grid grid-cols-2 gap-2">
                  {SHIPPING_OPTIONS.map(({ id, label, cost, domestic }) => (
                    <button key={id} type="button" onClick={() => setForm(f => ({ ...f, shipping_option: id, shipping_cost: cost }))}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium border transition-colors ${form.shipping_option === id ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                      data-testid={`shipping-${id}`}>
                      <Truck className="w-3.5 h-3.5" />
                      <span>{label}</span>
                      <span className="text-[10px]">{cost > 0 ? `$${cost.toFixed(2)}` : 'Free'}</span>
                      {domestic && <span className="text-[9px] text-amber-400">US Only</span>}
                    </button>
                  ))}
                </div>
              </div>
              {/* Best Offer Toggle - Only for BIN format */}
              {form.listing_format === 'FixedPriceItem' && (
                <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm text-white font-medium">Accept Best Offers</p>
                    <p className="text-[10px] text-gray-500">Buyers can send you price offers</p>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, best_offer: !f.best_offer }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.best_offer ? 'bg-[#3b82f6]' : 'bg-[#333]'}`}
                    data-testid="best-offer-toggle">
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.best_offer ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}
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
const SORT_OPTIONS_ACTIVE = [
  { id: 'listed_desc', label: 'Newest Listed', icon: Clock },
  { id: 'listed_asc', label: 'Oldest Listed', icon: Clock },
  { id: 'time_asc', label: 'Ending Soonest', icon: Clock },
  { id: 'price_desc', label: 'Price: High to Low', icon: ArrowUpRight },
  { id: 'price_asc', label: 'Price: Low to High', icon: DollarSign },
  { id: 'watchers_desc', label: 'Most Watched', icon: Eye },
  { id: 'title_asc', label: 'Title A-Z', icon: Tag },
];

const SORT_OPTIONS_SOLD = [
  { id: 'date_desc', label: 'Newest First', icon: Clock },
  { id: 'date_asc', label: 'Oldest First', icon: Clock },
  { id: 'price_desc', label: 'Price: High to Low', icon: ArrowUpRight },
  { id: 'price_asc', label: 'Price: Low to High', icon: DollarSign },
  { id: 'title_asc', label: 'Title A-Z', icon: Tag },
];

const SOLD_DAYS_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 60 days' },
];

const parseTimeLeftMinutes = (iso) => {
  if (!iso) return 999999;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 999999;
  return (parseInt(m[1] || 0) * 1440) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
};

const sortItems = (items, sortBy, type) => {
  const sorted = [...items];
  switch (sortBy) {
    case 'price_desc': return sorted.sort((a, b) => b.price - a.price);
    case 'price_asc': return sorted.sort((a, b) => a.price - b.price);
    case 'watchers_desc': return sorted.sort((a, b) => (b.watch_count || 0) - (a.watch_count || 0));
    case 'title_asc': return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'time_asc': return sorted.sort((a, b) => parseTimeLeftMinutes(a.time_left) - parseTimeLeftMinutes(b.time_left));
    case 'listed_desc': return sorted.sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0));
    case 'listed_asc': return sorted.sort((a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0));
    case 'date_desc': return sorted.sort((a, b) => new Date(b.sold_date || 0) - new Date(a.sold_date || 0));
    case 'date_asc': return sorted.sort((a, b) => new Date(a.sold_date || 0) - new Date(b.sold_date || 0));
    default: return sorted;
  }
};

const LOAD_BATCH = 50;

const ListingsModule = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [ebayData, setEbayData] = useState({ active: [], sold: [], active_total: 0, sold_total: 0 });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeShowCount, setActiveShowCount] = useState(LOAD_BATCH);
  const [soldShowCount, setSoldShowCount] = useState(LOAD_BATCH);
  const [viewMode, setViewMode] = useState('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [activeSort, setActiveSort] = useState('listed_desc');
  const [soldSort, setSoldSort] = useState('date_desc');
  const [soldDays, setSoldDays] = useState(30);
  const [listingsSearch, setListingsSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showBulkShipping, setShowBulkShipping] = useState(false);
  const [bulkShippingOption, setBulkShippingOption] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkCondition, setShowBulkCondition] = useState(false);
  const [bulkConditionValue, setBulkConditionValue] = useState('');
  const [showBulkOffer, setShowBulkOffer] = useState(false);
  const [showBulkSpecifics, setShowBulkSpecifics] = useState(false);
  const [showBulkPromote, setShowBulkPromote] = useState(false);
  const [promoteCampaigns, setPromoteCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [promoteAdRate, setPromoteAdRate] = useState(5);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [promotedListingIds, setPromotedListingIds] = useState(new Set());
  const [showCampaignView, setShowCampaignView] = useState(false);
  const [campaignAds, setCampaignAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);

  const toggleSelect = (itemId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); setShowBulkShipping(false); setShowBulkCondition(false); setShowBulkOffer(false); setShowBulkSpecifics(false); setShowBulkPromote(false); };

  const CARD_CONDITIONS = ['Near Mint or Better', 'Excellent', 'Very Good', 'Poor'];

  const bulkUpdateCondition = async () => {
    if (!bulkConditionValue) { toast.error('Select a condition'); return; }
    const selectedIds = allSortedActive.filter(i => selected.has(i.item_id)).map(i => i.item_id);
    if (selectedIds.length === 0) { toast.error('No items selected'); return; }
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/bulk-revise-condition`, {
        item_ids: selectedIds,
        card_condition: bulkConditionValue,
      });
      toast.success(res.data.note || `Condition updated on ${res.data.updated} items`);
      setShowBulkCondition(false);
      exitSelectMode();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update condition');
    } finally {
      setBulkUpdating(false);
    }
  };

  const bulkToggleBestOffer = async (enable) => {
    const selectedIds = allSortedActive.filter(i => selected.has(i.item_id)).map(i => i.item_id);
    if (selectedIds.length === 0) { toast.error('No items selected'); return; }
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/bulk-revise-best-offer`, {
        item_ids: selectedIds,
        enable,
      });
      toast.success(res.data.note || `Best Offer ${enable ? 'enabled' : 'disabled'} on ${res.data.updated} listings`);
      setShowBulkOffer(false);
      exitSelectMode();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update best offer');
    } finally {
      setBulkUpdating(false);
    }
  };


  const bulkUpdateShipping = async (items) => {
    if (!bulkShippingOption) { toast.error('Select a shipping option'); return; }
    const selectedItems = items.filter(i => selected.has(i.item_id));
    if (selectedItems.length === 0) { toast.error('No items selected'); return; }
    const opt = SHIPPING_OPTIONS.find(s => s.id === bulkShippingOption);
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/bulk-revise-shipping`, {
        item_ids: selectedItems.map(i => i.item_id),
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

  const bulkUpdateSpecifics = async () => {
    const selectedIds = allSortedActive.filter(i => selected.has(i.item_id)).map(i => i.item_id);
    if (selectedIds.length === 0) { toast.error('No items selected'); return; }
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/bulk-revise-specifics`, {
        item_ids: selectedIds,
      });
      toast.success(res.data.note || `Specifics updated on ${res.data.updated} listings`);
      setShowBulkSpecifics(false);
      exitSelectMode();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update specifics');
    } finally {
      setBulkUpdating(false);
    }
  };


  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await axios.get(`${API}/api/ebay/promoted/campaigns`);
      if (res.data.success) {
        const camps = res.data.campaigns || [];
        setPromoteCampaigns(camps);
        if (camps.length > 0) {
          const firstId = selectedCampaign || camps[0].campaign_id;
          if (!selectedCampaign) setSelectedCampaign(firstId);
          // Load promoted listing IDs from all running campaigns
          const allPromoted = new Set();
          for (const c of camps.filter(cc => cc.status === 'RUNNING')) {
            try {
              const adsRes = await axios.get(`${API}/api/ebay/promoted/campaign/${c.campaign_id}/ads`);
              if (adsRes.data.success) {
                adsRes.data.promoted_listing_ids.forEach(id => allPromoted.add(id));
              }
            } catch (_) {}
          }
          setPromotedListingIds(allPromoted);
        }
      }
    } catch (err) {
      toast.error('Failed to load campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchCampaignAds = async (campaignId) => {
    setLoadingAds(true);
    try {
      const res = await axios.get(`${API}/api/ebay/promoted/campaign/${campaignId}/ads`);
      if (res.data.success) {
        setCampaignAds(res.data.ads || []);
      }
    } catch (err) {
      toast.error('Failed to load campaign ads');
    } finally {
      setLoadingAds(false);
    }
  };

  const createCampaign = async () => {
    const name = newCampaignName.trim() || 'FlipSlab Promoted Listings';
    setCreatingCampaign(true);
    try {
      const res = await axios.post(`${API}/api/ebay/promoted/create-campaign`, {
        campaign_name: name,
        bid_percentage: promoteAdRate,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setNewCampaignName('');
        await fetchCampaigns();
        if (res.data.campaign_id) setSelectedCampaign(res.data.campaign_id);
      } else {
        toast.error(res.data.error || 'Failed to create campaign');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create campaign');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const bulkPromoteListings = async () => {
    if (!selectedCampaign) { toast.error('Select a campaign first'); return; }
    const selectedIds = allSortedActive.filter(i => selected.has(i.item_id)).map(i => i.item_id);
    if (selectedIds.length === 0) { toast.error('No items selected'); return; }
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/promoted/bulk-add`, {
        campaign_id: selectedCampaign,
        item_ids: selectedIds,
        bid_percentage: promoteAdRate,
      });
      if (res.data.success) {
        toast.success(res.data.note || `Promoted ${res.data.promoted} listings`);
        if (res.data.error_details?.length > 0) {
          toast.warning(`${res.data.errors} listings had issues: ${res.data.error_details[0]}`);
        }
        setShowBulkPromote(false);
        exitSelectMode();
      } else {
        toast.error(res.data.error || 'Failed to promote listings');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to promote listings');
    } finally {
      setBulkUpdating(false);
    }
  };

  const bulkRemovePromotions = async () => {
    if (!selectedCampaign) { toast.error('Select a campaign first'); return; }
    const selectedIds = allSortedActive.filter(i => selected.has(i.item_id)).map(i => i.item_id);
    if (selectedIds.length === 0) { toast.error('No items selected'); return; }
    setBulkUpdating(true);
    try {
      const res = await axios.post(`${API}/api/ebay/promoted/bulk-remove`, {
        campaign_id: selectedCampaign,
        item_ids: selectedIds,
      });
      toast.success(res.data.note || 'Promotions removed');
      setShowBulkPromote(false);
      exitSelectMode();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove promotions');
    } finally {
      setBulkUpdating(false);
    }
  };

  const openPromotePanel = () => {
    setShowBulkPromote(true);
    setShowCampaignView(false);
    fetchCampaigns();
  };

  const openCampaignView = (campaignId) => {
    setShowCampaignView(true);
    fetchCampaignAds(campaignId || selectedCampaign);
  };

  const campaignAction = async (campaignId, action) => {
    try {
      let res;
      if (action === 'delete') {
        res = await axios.delete(`${API}/api/ebay/promoted/campaign/${campaignId}`);
      } else {
        res = await axios.post(`${API}/api/ebay/promoted/campaign/${campaignId}/${action}`);
      }
      if (res.data.success) {
        toast.success(res.data.message);
        fetchCampaigns();
      } else {
        toast.error(res.data.error || `Failed to ${action} campaign`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} campaign`);
    }
  };

  const removeAdFromCampaign = async (campaignId, listingId) => {
    try {
      const res = await axios.post(`${API}/api/ebay/promoted/campaign/${campaignId}/remove-ads`, {
        listing_ids: [listingId],
      });
      if (res.data.success) {
        toast.success('Ad removed');
        setCampaignAds(prev => prev.filter(a => a.listing_id !== listingId));
        setPromotedListingIds(prev => { const n = new Set(prev); n.delete(listingId); return n; });
      } else {
        toast.error(res.data.error || 'Failed to remove ad');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove ad');
    }
  };



  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      const refreshParam = forceRefresh ? '&force_refresh=true' : '';
      const [ebayRes, invRes] = await Promise.allSettled([
        axios.get(`${API}/api/ebay/seller/my-listings?sold_days=${soldDays}${refreshParam}`),
        axios.get(`${API}/api/inventory?limit=500`),
      ]);
      if (ebayRes.status === 'fulfilled') {
        const raw = ebayRes.value.data;
        const activeItems = (raw.active || []).map(item => ({
          item_id: item.itemid || item.item_id || '',
          title: item.title || '',
          price: item.price || 0,
          image_url: (item.image_url || '').replace('s-l140', 's-l400').replace('s-l225', 's-l400').replace('s-l800', 's-l400'),
          time_left: item.time_left || '',
          watch_count: item.watchers ?? item.watch_count ?? 0,
          quantity_available: item.quantity ?? item.quantity_available ?? 1,
          listing_type: item.listing_type || 'FixedPriceItem',
          url: item.url || '',
          bids: item.bids || 0,
          start_time: item.start_time || '',
        }));
        const soldItems = (raw.sold || []).map(item => ({
          item_id: item.itemid || item.item_id || '',
          title: item.title || '',
          price: item.price || 0,
          image_url: (item.image_url || '').replace('s-l140', 's-l400').replace('s-l225', 's-l400').replace('s-l800', 's-l400'),
          buyer: item.buyer || '',
          sold_date: item.sold_date || '',
          quantity_sold: item.quantity_sold || 1,
          url: item.url || '',
        }));
        setEbayData({
          active: activeItems,
          sold: soldItems,
          active_total: raw.active_total ?? activeItems.length,
          sold_total: raw.sold_total ?? soldItems.length,
        });
        if (raw.cached && forceRefresh) {
          toast.info('Refreshing from eBay...');
        }
      }
      if (invRes.status === 'fulfilled') setInventoryItems(invRes.value.data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [soldDays]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
  };

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  // Refresh data when user returns to this browser tab
  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  const loadMoreActive = () => setActiveShowCount(prev => prev + LOAD_BATCH);
  const loadMoreSold = () => setSoldShowCount(prev => prev + LOAD_BATCH);

  const [fixingFalseSold, setFixingFalseSold] = useState(false);
  const fixFalseSold = async () => {
    setFixingFalseSold(true);
    try {
      const res = await axios.post(`${API}/api/ebay/fix-false-sold`);
      if (res.data.fixed > 0) {
        toast.success(`Restored ${res.data.fixed} items that were incorrectly marked as sold`);
        setLoading(true);
        fetchData();
      } else {
        toast.info('No incorrectly sold items found');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fix sold items');
    } finally {
      setFixingFalseSold(false);
    }
  };

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

  const eb = ebayData;

  // Build sport map from inventory items
  const sportMap = {};
  inventoryItems.forEach(inv => { if (inv.ebay_item_id && inv.sport) sportMap[inv.ebay_item_id] = inv.sport; });
  const SPORT_KEYWORDS = { Basketball: /basketball|nba|topps chrome|prizm|hoops|mosaic|donruss optic/i, Baseball: /baseball|mlb|bowman|topps series|gypsy queen|heritage/i, Football: /football|nfl|playoff|contenders/i, Soccer: /soccer|fifa|premier league|futbol/i, Hockey: /hockey|nhl|upper deck.*ice/i };
  const detectSport = (item) => {
    if (sportMap[item.item_id]) return sportMap[item.item_id];
    const t = item.title || '';
    for (const [sport, regex] of Object.entries(SPORT_KEYWORDS)) { if (regex.test(t)) return sport; }
    return 'Other';
  };

  // Get available sports from all listings
  const allSports = [...new Set([...eb.active, ...eb.sold].map(detectSport))].sort();

  const filterBySearchAndSport = (items) => items.filter(i => {
    const matchSearch = !listingsSearch || (i.title || '').toLowerCase().includes(listingsSearch.toLowerCase());
    const matchSport = sportFilter === 'all' || detectSport(i) === sportFilter;
    return matchSearch && matchSport;
  });

  const allSortedActive = filterBySearchAndSport(sortItems(eb.active, activeSort, 'active'));
  const allSortedSold = filterBySearchAndSport(sortItems(eb.sold, soldSort, 'sold'));
  const sortedActive = allSortedActive.slice(0, activeShowCount);
  const sortedSold = allSortedSold.slice(0, soldShowCount);
  const totalValue = eb.active.reduce((s, i) => s + (i.price || 0), 0);
  const totalSold = eb.sold.reduce((s, i) => s + (i.price || 0), 0);
  const hasMoreActive = activeShowCount < allSortedActive.length;
  const hasMoreSold = soldShowCount < allSortedSold.length;

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
          cardData={inventoryItems.find(i => i.ebay_item_id === selectedListing.item_id)}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          <button onClick={fixFalseSold} disabled={fixingFalseSold}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-amber-400 text-sm hover:text-amber-300 hover:border-amber-500/30 transition-colors disabled:opacity-50"
            data-testid="fix-false-sold-btn"
            title="Fix items incorrectly marked as sold">
            {fixingFalseSold ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="hidden sm:inline">{fixingFalseSold ? 'Fixing...' : 'Fix Sold'}</span>
          </button>
          {activeTab === 'active' && (
            <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${selectMode ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#111] border-[#1a1a1a] text-gray-400 hover:text-white'}`}
              data-testid="listings-select-mode-btn">
              <Check className="w-4 h-4" /> {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {selectMode && (
            <button onClick={() => {
              if (selected.size === allSortedActive.length) setSelected(new Set());
              else setSelected(new Set(allSortedActive.map(i => i.item_id)));
            }} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-400 hover:text-white text-sm transition-colors" data-testid="listings-select-all-btn">
              {selected.size === allSortedActive.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {activeTab === 'active' && (
            <>
              <button onClick={() => setShowBulkShipping(true)} disabled={!selectMode || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 disabled:opacity-30 transition-colors" data-testid="listings-bulk-shipping-btn">
                <Truck className="w-4 h-4" /> Shipping {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
              <button onClick={() => setShowBulkCondition(true)} disabled={!selectMode || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-30 transition-colors" data-testid="listings-bulk-condition-btn">
                Condition {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
              <button onClick={() => setShowBulkOffer(true)} disabled={!selectMode || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-30 transition-colors" data-testid="listings-bulk-offer-btn">
                Best Offer {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
              <button onClick={() => setShowBulkSpecifics(true)} disabled={!selectMode || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 disabled:opacity-30 transition-colors" data-testid="listings-bulk-specifics-btn">
                <BarChart3 className="w-4 h-4" /> Specifics {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
              <button onClick={openPromotePanel} disabled={!selectMode || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 disabled:opacity-30 transition-colors" data-testid="listings-bulk-promote-btn">
                <TrendingUp className="w-4 h-4" /> Promote {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
            </>
          )}
          <button onClick={() => { setShowCampaignView(!showCampaignView); if (!showCampaignView) fetchCampaigns(); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${showCampaignView ? 'bg-orange-600/10 border-orange-500/30 text-orange-400' : 'bg-[#111] border-[#1a1a1a] text-gray-400 hover:text-white'}`}
            data-testid="campaigns-view-btn">
            <TrendingUp className="w-4 h-4" /> Campaigns
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#22c55e] text-white text-sm font-bold hover:bg-[#16a34a] transition-colors"
            data-testid="create-listing-btn">
            <Plus className="w-4 h-4" />Create Listing
          </button>
        </div>
      </div>

      {/* Campaign View Panel */}
      <AnimatePresence>
        {showCampaignView && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-orange-500/20 rounded-xl p-4" data-testid="campaigns-panel">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                  <p className="text-sm font-bold text-white">Promoted Listings Campaigns</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{promoteCampaigns.length} campaigns</span>
                </div>
                <button onClick={() => setShowCampaignView(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>

              {loadingCampaigns ? (
                <div className="flex items-center gap-2 py-4 justify-center text-xs text-gray-500"><RefreshCw className="w-4 h-4 animate-spin" /> Loading campaigns...</div>
              ) : promoteCampaigns.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No campaigns yet. Use the Promote button to create one.</p>
              ) : (
                <div className="space-y-2">
                  {promoteCampaigns.map((c) => (
                    <div key={c.campaign_id} className={`p-3 rounded-lg border transition-colors ${selectedCampaign === c.campaign_id ? 'bg-orange-500/5 border-orange-500/30' : 'bg-[#0a0a0a] border-[#1a1a1a]'}`}
                      data-testid={`campaign-${c.campaign_id}`}>
                      <div className="flex items-center justify-between">
                        <div className="cursor-pointer flex-1" onClick={() => { setSelectedCampaign(c.campaign_id); fetchCampaignAds(c.campaign_id); }}>
                          <p className="text-sm font-semibold text-white">{c.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.status === 'RUNNING' ? 'bg-green-500/20 text-green-400' : c.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{c.status}</span>
                            <span className="text-[10px] text-gray-500">Ad Rate: <span className="text-orange-400 font-bold">{c.bid_percentage}%</span></span>
                            {c.start_date && <span className="text-[10px] text-gray-600">Since {new Date(c.start_date).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.status === 'RUNNING' && (
                            <button onClick={() => campaignAction(c.campaign_id, 'pause')} className="px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold hover:bg-yellow-500/20 transition-colors" data-testid={`campaign-pause-${c.campaign_id}`}>Pause</button>
                          )}
                          {c.status === 'PAUSED' && (
                            <button onClick={() => campaignAction(c.campaign_id, 'resume')} className="px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold hover:bg-green-500/20 transition-colors" data-testid={`campaign-resume-${c.campaign_id}`}>Resume</button>
                          )}
                          {(c.status === 'RUNNING' || c.status === 'PAUSED') && (
                            <button onClick={() => { if (window.confirm('End this campaign? This cannot be undone.')) campaignAction(c.campaign_id, 'end'); }} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors" data-testid={`campaign-end-${c.campaign_id}`}>End</button>
                          )}
                          {c.status === 'ENDED' && (
                            <button onClick={() => { if (window.confirm('Delete this campaign permanently?')) campaignAction(c.campaign_id, 'delete'); }} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors" data-testid={`campaign-delete-${c.campaign_id}`}>Delete</button>
                          )}
                          <button onClick={() => { setSelectedCampaign(c.campaign_id); fetchCampaignAds(c.campaign_id); }} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Campaign Ads - Card Grid */}
              {selectedCampaign && (
                <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-white">Promoted Listings ({campaignAds.length})</p>
                    {loadingAds ? <RefreshCw className="w-3.5 h-3.5 text-gray-500 animate-spin" /> : (
                      <button onClick={() => fetchCampaignAds(selectedCampaign)} className="text-[10px] text-gray-500 hover:text-white transition-colors flex items-center gap-1"><RefreshCw className="w-3 h-3" />Refresh</button>
                    )}
                  </div>
                  {campaignAds.length === 0 && !loadingAds ? (
                    <p className="text-xs text-gray-600 text-center py-6">No promoted listings in this campaign yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                      {campaignAds.map((ad) => {
                        const listing = allSortedActive.find(l => l.item_id === ad.listing_id);
                        return (
                          <div key={ad.ad_id || ad.listing_id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden group relative" data-testid={`campaign-ad-${ad.listing_id}`}>
                            <div className="aspect-square bg-[#111] overflow-hidden relative">
                              {listing?.image_url ? (
                                <img src={listing.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                              {/* Price badge */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-2.5">
                                <span className="text-lg font-black text-white drop-shadow-lg">${listing?.price || '—'}</span>
                              </div>
                              {/* Ad rate badge */}
                              <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded bg-orange-500/90 text-white uppercase font-bold flex items-center gap-0.5">
                                <TrendingUp className="w-2.5 h-2.5" />{ad.bid_percentage}%
                              </span>
                              {/* Status badge */}
                              <span className={`absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded font-bold ${ad.status === 'ACTIVE' ? 'bg-green-500/90 text-white' : 'bg-gray-500/90 text-white'}`}>{ad.status}</span>
                              {/* Remove overlay on hover */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <button onClick={() => { if (window.confirm('Remove this listing from the campaign?')) removeAdFromCampaign(selectedCampaign, ad.listing_id); }}
                                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg hover:bg-red-500 transition-colors"
                                  data-testid={`remove-ad-${ad.listing_id}`}>
                                  <X className="w-3.5 h-3.5" />Remove
                                </button>
                              </div>
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-semibold text-white line-clamp-2 leading-relaxed">{listing?.title || ad.listing_id}</p>
                              {listing?.watch_count > 0 && (
                                <span className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-1"><Eye className="w-3 h-3" />{listing.watch_count}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


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

      {/* Tabs + Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id); exitSelectMode(); }}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
                }`} data-testid={`listings-tab-${id}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 rounded-lg bg-[#111] border border-[#1a1a1a] text-gray-500 hover:text-white hover:border-[#3b82f6]/50 transition-colors disabled:opacity-50"
              title="Sync from eBay" data-testid="refresh-listings-btn">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <ViewToggle view={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Search Bar + Sport Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input type="text" placeholder="Search listings..." value={listingsSearch} onChange={e => setListingsSearch(e.target.value)}
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors"
              data-testid="listings-search-input" />
            {listingsSearch && (
              <button onClick={() => setListingsSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors" data-testid="listings-search-clear">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {allSports.length > 1 && (
            <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
              className="appearance-none bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#3b82f6] focus:outline-none cursor-pointer hover:border-[#333] transition-colors"
              data-testid="sport-filter-select">
              <option value="all" className="bg-[#111] text-white">All Sports</option>
              {allSports.map(s => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
            </select>
          )}
        </div>

        {/* Sort + Filters Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={activeTab === 'active' ? activeSort : soldSort}
              onChange={e => activeTab === 'active' ? setActiveSort(e.target.value) : setSoldSort(e.target.value)}
              className="appearance-none bg-[#111] border border-[#1a1a1a] rounded-lg pl-8 pr-8 py-2 text-xs text-white focus:border-[#3b82f6] focus:outline-none cursor-pointer hover:border-[#333] transition-colors"
              data-testid="sort-select"
            >
              {(activeTab === 'active' ? SORT_OPTIONS_ACTIVE : SORT_OPTIONS_SOLD).map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <ArrowDownUp className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-3 h-3 text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sold-only controls */}
          {activeTab === 'sold' && (
            <>
              {/* Date Range */}
              <div className="relative">
                <select
                  value={soldDays}
                  onChange={e => { setSoldDays(parseInt(e.target.value)); }}
                  className="appearance-none bg-[#111] border border-[#1a1a1a] rounded-lg pl-8 pr-8 py-2 text-xs text-white focus:border-[#3b82f6] focus:outline-none cursor-pointer hover:border-[#333] transition-colors"
                  data-testid="sold-days-select"
                >
                  {SOLD_DAYS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <Calendar className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3 h-3 text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </>
          )}

          <span className="text-[10px] text-gray-600 ml-auto">
            {activeTab === 'active' ? `${sortedActive.length} of ${allSortedActive.length} listings` : `${sortedSold.length} of ${allSortedSold.length} sold`}
          </span>
        </div>
      </div>

      {/* Bulk Shipping Panel */}
      <AnimatePresence>
        {showBulkShipping && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-amber-500/30 rounded-xl p-4" data-testid="listings-bulk-shipping-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-bold text-white">Bulk Update Shipping</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{selected.size} items</span>
                </div>
                <button onClick={() => setShowBulkShipping(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {SHIPPING_OPTIONS.map(s => (
                  <button key={s.id} onClick={() => setBulkShippingOption(s.id)}
                    className={`px-3 py-2.5 rounded-lg text-left transition-all ${bulkShippingOption === s.id ? 'bg-amber-500/15 border-2 border-amber-500/50 ring-1 ring-amber-500/20' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                    data-testid={`listings-bulk-ship-opt-${s.id}`}>
                    <p className={`text-xs font-bold ${bulkShippingOption === s.id ? 'text-amber-400' : 'text-gray-400'}`}>{s.label}</p>
                    <p className="text-[10px] text-gray-600">{s.cost > 0 ? `$${s.cost.toFixed(2)}` : 'Free'}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => bulkUpdateShipping(allSortedActive)} disabled={!bulkShippingOption || bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                  data-testid="listings-bulk-ship-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <><Truck className="w-4 h-4" /> Apply to {selected.size} Listings</>}
                </button>
                <button onClick={() => setShowBulkShipping(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="listings-bulk-ship-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Condition Panel */}
      <AnimatePresence>
        {showBulkCondition && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-violet-500/30 rounded-xl p-4" data-testid="listings-bulk-condition-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Bulk Update Condition</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">{selected.size} listings</span>
                </div>
                <button onClick={() => setShowBulkCondition(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {CARD_CONDITIONS.map(c => (
                  <button key={c} onClick={() => setBulkConditionValue(c)}
                    className={`px-3 py-2.5 rounded-lg text-left transition-all ${bulkConditionValue === c ? 'bg-violet-500/15 border-2 border-violet-500/50 ring-1 ring-violet-500/20' : 'bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                    data-testid={`listings-bulk-cond-opt-${c.replace(/\s/g, '-').toLowerCase()}`}>
                    <p className={`text-xs font-bold ${bulkConditionValue === c ? 'text-violet-400' : 'text-gray-400'}`}>{c}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={bulkUpdateCondition} disabled={!bulkConditionValue || bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 disabled:opacity-50 transition-colors"
                  data-testid="listings-bulk-cond-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <>Apply to {selected.size} Listings</>}
                </button>
                <button onClick={() => setShowBulkCondition(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="listings-bulk-cond-cancel-btn">Cancel</button>
              </div>
              <p className="text-[10px] text-gray-600 mt-3">Updates inventory + tries to revise on eBay (eBay may restrict condition changes on some listings)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Best Offer Panel */}
      <AnimatePresence>
        {showBulkOffer && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-emerald-500/30 rounded-xl p-4" data-testid="listings-bulk-offer-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Bulk Best Offer</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{selected.size} listings</span>
                </div>
                <button onClick={() => setShowBulkOffer(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => bulkToggleBestOffer(true)} disabled={bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  data-testid="bulk-offer-enable-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <>Enable Best Offer</>}
                </button>
                <button onClick={() => bulkToggleBestOffer(false)} disabled={bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 transition-colors"
                  data-testid="bulk-offer-disable-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <>Disable Best Offer</>}
                </button>
                <button onClick={() => setShowBulkOffer(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="bulk-offer-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Item Specifics Panel */}
      <AnimatePresence>
        {showBulkSpecifics && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-cyan-500/30 rounded-xl p-4" data-testid="listings-bulk-specifics-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Bulk Update Item Specifics</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">{selected.size} listings</span>
                </div>
                <button onClick={() => setShowBulkSpecifics(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <p className="text-xs text-gray-400 mb-4">This will add expanded Item Specifics (Type, Manufacturer, League, Material, Year, etc.) to improve eBay Cassini search ranking. Data is pulled from your inventory.</p>
              <div className="flex items-center gap-3">
                <button onClick={bulkUpdateSpecifics} disabled={bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                  data-testid="listings-bulk-specifics-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</> : <><BarChart3 className="w-4 h-4" /> Update {selected.size} Listings</>}
                </button>
                <button onClick={() => setShowBulkSpecifics(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="listings-bulk-specifics-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Promote Panel */}
      <AnimatePresence>
        {showBulkPromote && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-orange-500/30 rounded-xl p-4" data-testid="listings-bulk-promote-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Promoted Listings Standard</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{selected.size} listings</span>
                </div>
                <button onClick={() => setShowBulkPromote(false)} className="p-1 rounded hover:bg-white/5"><X className="w-4 h-4 text-gray-500" /></button>
              </div>

              {/* Campaign selector */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1.5">Campaign</label>
                {loadingCampaigns ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading campaigns...</div>
                ) : promoteCampaigns.length > 0 ? (
                  <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:border-orange-500/50 outline-none"
                    data-testid="promote-campaign-select">
                    {promoteCampaigns.map(c => (
                      <option key={c.campaign_id} value={c.campaign_id}>{c.name} ({c.status}) - {c.bid_percentage}%</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-500 mb-2">No campaigns found. Create one below.</p>
                )}
              </div>

              {/* Create campaign */}
              <div className="flex items-center gap-2 mb-4">
                <input type="text" placeholder="New campaign name..." value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)}
                  className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500/50 outline-none"
                  data-testid="promote-new-campaign-name" />
                <button onClick={createCampaign} disabled={creatingCampaign}
                  className="px-3 py-2 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-bold hover:bg-orange-600/30 disabled:opacity-50 transition-colors whitespace-nowrap"
                  data-testid="promote-create-campaign-btn">
                  {creatingCampaign ? 'Creating...' : '+ New Campaign'}
                </button>
              </div>

              {/* Ad Rate slider */}
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1.5">Ad Rate: <span className="text-orange-400 font-bold">{promoteAdRate}%</span></label>
                <input type="range" min="1" max="20" step="0.5" value={promoteAdRate} onChange={e => setPromoteAdRate(parseFloat(e.target.value))}
                  className="w-full accent-orange-500" data-testid="promote-ad-rate-slider" />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>1%</span><span>5%</span><span>10%</span><span>15%</span><span>20%</span>
                </div>
              </div>

              <p className="text-[10px] text-gray-500 mb-3">You only pay when a buyer clicks your promoted ad AND purchases. Fee = {promoteAdRate}% of sale price.</p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={bulkPromoteListings} disabled={!selectedCampaign || bulkUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-500 disabled:opacity-50 transition-colors"
                  data-testid="promote-apply-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Promoting...</> : <><TrendingUp className="w-4 h-4" /> Promote {selected.size} Listings</>}
                </button>
                <button onClick={bulkRemovePromotions} disabled={!selectedCampaign || bulkUpdating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-bold hover:bg-red-500 disabled:opacity-50 transition-colors"
                  data-testid="promote-remove-btn">
                  {bulkUpdating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Removing...</> : <>Remove Promotion</>}
                </button>
                <button onClick={() => setShowBulkPromote(false)} className="px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-gray-400 text-sm hover:text-white transition-colors" data-testid="promote-cancel-btn">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Listings */}
      {activeTab === 'active' && (
        sortedActive.length === 0 ? (
          <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
            <Tag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">No active listings</p>
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-semibold" data-testid="empty-create-btn">
              <Plus className="w-4 h-4 inline mr-1" />Create Your First Listing
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {sortedActive.map((item, i) => (
              <motion.div key={item.item_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                className={`bg-[#1a1a1a] border rounded-xl overflow-hidden transition-all cursor-pointer group ${selected.has(item.item_id) ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-[#2a2a2a] hover:border-[#3b82f6]/50'}`}
                onClick={() => selectMode ? toggleSelect(item.item_id) : setSelectedListing(item)} data-testid={`active-listing-${i}`}>
                <div className="aspect-square bg-[#111] overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  {/* Selection checkbox */}
                  {selectMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selected.has(item.item_id) ? 'bg-amber-500 border-amber-500' : 'bg-black/50 border-gray-400'}`}>
                        {selected.has(item.item_id) && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  )}
                  {/* Big Price Badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-2.5">
                    <span className="text-lg font-black text-white drop-shadow-lg">${item.price}</span>
                  </div>
                  <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded bg-black/70 text-gray-200 uppercase font-bold">
                    {item.listing_type === 'FixedPriceItem' ? 'BIN' : 'Auction'}
                  </span>
                  {promotedListingIds.has(item.item_id) && (
                    <span className="absolute top-2 right-16 text-[9px] px-2 py-0.5 rounded bg-orange-500/90 text-white uppercase font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-2.5 h-2.5" />AD
                    </span>
                  )}
                  {/* Action overlay on hover - only when not in select mode */}
                  {!selectMode && (
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
                  )}
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
            {sortedActive.map((item, i) => (
              <motion.div key={item.item_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className={`bg-[#1a1a1a] border rounded-xl p-3 flex items-center gap-3 transition-colors cursor-pointer ${selected.has(item.item_id) ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-[#2a2a2a] hover:border-[#3b82f6]/40'}`}
                onClick={() => selectMode ? toggleSelect(item.item_id) : setSelectedListing(item)} data-testid={`active-listing-${i}`}>
                {selectMode && (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(item.item_id) ? 'bg-amber-500 border-amber-500' : 'bg-transparent border-gray-600'}`}>
                    {selected.has(item.item_id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}
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
                {!selectMode && (
                  <>
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
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Load More - Active */}
      {activeTab === 'active' && hasMoreActive && (
        <div className="flex justify-center pt-2">
          <button onClick={loadMoreActive}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm font-semibold text-gray-400 hover:text-white hover:border-[#3b82f6]/40 transition-all"
            data-testid="load-more-active-btn">
            <Plus className="w-4 h-4" /> Load More ({allSortedActive.length - sortedActive.length} remaining)
          </button>
        </div>
      )}

      {/* Sold Listings */}
      {activeTab === 'sold' && (
        sortedSold.length === 0 ? (
          <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
            <ShoppingBag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No sold items yet</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {sortedSold.map((item, i) => (
              <motion.div key={item.item_id || i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden group cursor-pointer hover:border-emerald-500/30 transition-all"
                onClick={() => item.url && window.open(item.url, '_blank')} data-testid={`sold-listing-${i}`}>
                <div className="aspect-square bg-[#111] overflow-hidden relative">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-2.5">
                    <span className="text-lg font-black text-emerald-400">${item.price}</span>
                  </div>
                  <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded bg-emerald-500/90 text-white font-bold uppercase">Sold</span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-relaxed mb-1.5">{item.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      {item.buyer && <p className="text-[10px] text-gray-500 flex items-center gap-1"><User className="w-2.5 h-2.5" />{item.buyer}</p>}
                      {item.sold_date && <p className="text-[10px] text-gray-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(item.sold_date).toLocaleDateString()}</p>}
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="p-1 hover:bg-white/10 rounded transition-colors">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-600 hover:text-emerald-400" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedSold.map((item, i) => (
              <div key={item.item_id || i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex items-center gap-3 hover:border-emerald-500/30 transition-colors" data-testid={`sold-listing-${i}`}>
                <div className="w-14 h-14 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                  {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 text-gray-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {item.buyer && <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{item.buyer}</span>}
                    {item.sold_date && <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{new Date(item.sold_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <span className="text-[9px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 uppercase font-bold flex-shrink-0">Sold</span>
                <span className="text-lg font-black text-emerald-400 flex-shrink-0">${item.price}</span>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <ExternalLink className="w-4 h-4 text-gray-600 hover:text-emerald-400" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Load More - Sold */}
      {activeTab === 'sold' && hasMoreSold && (
        <div className="flex justify-center pt-2">
          <button onClick={loadMoreSold}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] border border-[#1a1a1a] text-sm font-semibold text-gray-400 hover:text-white hover:border-emerald-500/40 transition-all"
            data-testid="load-more-sold-btn">
            <Plus className="w-4 h-4" /> Load More ({allSortedSold.length - sortedSold.length} remaining)
          </button>
        </div>
      )}

      {/* Create Listing Modal */}
      <CreateListingModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} inventoryItems={inventoryItems} onSuccess={() => { setLoading(true); fetchData(); }} />
    </div>
  );
};

export default ListingsModule;
