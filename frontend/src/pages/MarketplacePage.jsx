import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Search, Filter, X, Package, ShoppingCart, Tag,
  ChevronDown, RotateCcw, Crown, Star, Shield, Award,
  ChevronLeft, ChevronRight, ExternalLink, TrendingUp, Users, Sparkles
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const PLAN_GLOW = {
  rookie:      { border: 'rgba(156,163,175,0.15)', shadow: '0 0 15px rgba(156,163,175,0.08)', hoverShadow: '0 0 20px rgba(156,163,175,0.15), 0 0 40px rgba(156,163,175,0.08)', hoverBorder: 'rgba(156,163,175,0.25)' },
  mvp:          { border: 'rgba(245,158,11,0.2)', shadow: '0 0 15px rgba(245,158,11,0.1)', hoverShadow: '0 0 20px rgba(245,158,11,0.25), 0 0 40px rgba(245,158,11,0.1)', hoverBorder: 'rgba(245,158,11,0.4)' },
  hall_of_famer:{ border: 'rgba(147,51,234,0.2)', shadow: '0 0 15px rgba(147,51,234,0.1)', hoverShadow: '0 0 20px rgba(147,51,234,0.25), 0 0 40px rgba(147,51,234,0.1)', hoverBorder: 'rgba(147,51,234,0.4)' },
  all_star:    { border: 'rgba(245,158,11,0.2)', shadow: '0 0 15px rgba(245,158,11,0.1)', hoverShadow: '0 0 20px rgba(245,158,11,0.25), 0 0 40px rgba(245,158,11,0.1)', hoverBorder: 'rgba(245,158,11,0.4)' },
  hall_of_fame:{ border: 'rgba(245,158,11,0.2)', shadow: '0 0 15px rgba(245,158,11,0.1)', hoverShadow: '0 0 20px rgba(245,158,11,0.25), 0 0 40px rgba(245,158,11,0.1)', hoverBorder: 'rgba(245,158,11,0.4)' },
  legend:      { border: 'rgba(168,85,247,0.2)', shadow: '0 0 15px rgba(168,85,247,0.12)', hoverShadow: '0 0 25px rgba(168,85,247,0.3), 0 0 50px rgba(168,85,247,0.12)', hoverBorder: 'rgba(168,85,247,0.45)' },
};

// =========== CARD TILE ===========
const MarketCardTile = ({ item, index, onClick }) => {
  const price = item.listed_price || item.purchase_price;
  const imgSrc = item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null;
  const glow = PLAN_GLOW[item.seller_plan] || PLAN_GLOW.rookie;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-white/[0.02] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        border: `1px solid ${hovered ? glow.hoverBorder : glow.border}`,
        boxShadow: hovered ? glow.hoverShadow : glow.shadow,
      }}
      data-testid={`marketplace-card-${index}`}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-[#0a0a0a]">
        {imgSrc ? (
          <img src={imgSrc} alt={item.card_name} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-gray-800" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {item.ebay_item_id && (
          <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <div className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl text-black text-xs font-bold shadow-lg">
              <ShoppingCart className="w-3.5 h-3.5" /> Buy on eBay
            </div>
          </div>
        )}

        {item.sport && (
          <div className="absolute top-2 left-2 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/50 text-white/70 backdrop-blur-sm border border-white/10">
            {item.sport}
          </div>
        )}
        {item.condition && (
          <div className="absolute top-2 right-2 text-[8px] font-bold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10"
            style={{ color: item.condition === 'Graded' ? '#f59e0b' : '#9ca3af' }}>
            {item.condition === 'Graded' ? `${item.grading_company || ''} ${item.grade || ''}`.trim() : 'Raw'}
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-[11px] sm:text-xs font-bold text-white leading-tight">{item.card_name}</p>
        {item.player && <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{item.player}</p>}
        <div className="flex items-center justify-between mt-1.5">
          {price ? (
            <p className="text-sm font-black text-amber-400">${parseFloat(price).toFixed(2)}</p>
          ) : <span />}
          {item.seller_name && (
            <p className="text-[9px] text-gray-600 truncate max-w-[60%] text-right">{item.seller_name}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};


// =========== CARD MODAL ===========
const MarketCardModal = ({ item, items, onNavigate, onClose }) => {
  const baseFront = item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null;
  const baseBack = item.back_image ? `data:image/jpeg;base64,${item.back_image}` : null;
  const [frontSrc, setFrontSrc] = useState(baseFront);
  const [backSrc, setBackSrc] = useState(baseBack);
  const [flipped, setFlipped] = useState(false);
  const price = item.listed_price || item.purchase_price;

  const currentIdx = items ? items.findIndex(i => (i.ebay_item_id || i.card_name) === (item.ebay_item_id || item.card_name) && i.seller_name === item.seller_name) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = items && currentIdx < items.length - 1;
  const goNext = useCallback(() => { if (hasNext) onNavigate(items[currentIdx + 1]); }, [hasNext, items, currentIdx, onNavigate]);
  const goPrev = useCallback(() => { if (hasPrev) onNavigate(items[currentIdx - 1]); }, [hasPrev, items, currentIdx, onNavigate]);

  const touchRef = useRef(null);
  const handleTouchStart = (e) => { touchRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchRef.current;
    if (diff > 60) goPrev();
    else if (diff < -60) goNext();
    touchRef.current = null;
  };

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'ArrowLeft') goPrev(); else if (e.key === 'ArrowRight') goNext(); else if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, onClose]);

  useEffect(() => {
    setFlipped(false);
    setFrontSrc(item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null);
    setBackSrc(item.back_image ? `data:image/jpeg;base64,${item.back_image}` : null);
  }, [item]);

  // Try to fetch eBay images for back if we have a seller slug
  useEffect(() => {
    if (baseBack || !item.ebay_item_id || !item.seller_slug || item.image) return;
    fetch(`${API}/api/shop/${item.seller_slug}/item/${item.ebay_item_id}`)
      .then(r => r.json())
      .then(data => {
        const imgs = data.images || [];
        if (imgs.length > 0 && !baseFront) setFrontSrc(imgs[0]);
        if (imgs.length > 1) setBackSrc(imgs[1]);
      })
      .catch(() => {});
  }, [item.ebay_item_id, item.seller_slug, baseFront, baseBack, item.image]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose} data-testid="marketplace-card-modal">
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative bg-[#0a0a0a] border border-white/[0.06] rounded-none sm:rounded-3xl w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[95vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

        <button onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/10"
          data-testid="marketplace-modal-close">
          <X className="w-5 h-5" />
        </button>

        {hasPrev && (
          <button onClick={goPrev} data-testid="marketplace-modal-prev"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/10">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {hasNext && (
          <button onClick={goNext} data-testid="marketplace-modal-next"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/10">
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {items && items.length > 1 && (
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] text-gray-400 font-medium border border-white/10">
            {currentIdx + 1} / {items.length}
          </div>
        )}

        {/* 3D Flip Card - Full width on mobile */}
        <div className="relative mx-1 mt-1 mb-0 sm:mx-4 sm:mt-4 sm:mb-2 flex-1 min-h-0 sm:flex-shrink-0 sm:flex-grow-0" style={{ perspective: 1200 }}>
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative w-full h-full sm:aspect-[3/4] sm:max-h-[50vh] mx-auto cursor-pointer"
            onClick={() => backSrc && setFlipped(!flipped)}
          >
            <div className="absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden bg-[#080808]"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              {frontSrc ? (
                <img src={frontSrc} alt={item.card_name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package className="w-16 h-16 text-gray-800" /></div>
              )}
            </div>
            {backSrc && (
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden bg-[#080808]"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <img src={backSrc} alt="Back" className="w-full h-full object-contain" />
              </div>
            )}
          </motion.div>
          {backSrc && (
            <button onClick={() => setFlipped(!flipped)}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-white/70 hover:text-white transition-colors"
              data-testid="marketplace-modal-flip">
              <RotateCcw className="w-3 h-3" /> {flipped ? 'View Front' : 'View Back'}
            </button>
          )}
        </div>

        {/* Card Info */}
        <div className="px-3 pb-3 pt-1.5 sm:px-5 sm:pb-5 sm:pt-2 space-y-1.5 sm:space-y-2.5 flex-shrink-0">
          <div className="text-center">
            <h2 className="text-xs sm:text-base font-black text-white leading-tight">{item.card_name}</h2>
            <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
              {item.player && (
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {item.player}
                </span>
              )}
              {item.sport && (
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">
                  {item.sport}
                </span>
              )}
              {item.year && (
                <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">{item.year}</span>
              )}
              {item.condition && (
                <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                  style={{
                    color: item.condition === 'Graded' ? '#f59e0b' : '#9ca3af',
                    borderColor: item.condition === 'Graded' ? 'rgba(245,158,11,0.2)' : 'rgba(156,163,175,0.2)',
                    background: item.condition === 'Graded' ? 'rgba(245,158,11,0.1)' : 'rgba(156,163,175,0.05)',
                  }}>
                  {item.condition === 'Graded' ? `${item.grading_company || ''} ${item.grade || ''}`.trim() : 'Raw'}
                </span>
              )}
            </div>
          </div>

          {/* Seller Info */}
          {item.seller_name && (
            <div className="flex items-center gap-2 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              {item.seller_logo ? (
                <img src={item.seller_logo} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/5 flex items-center justify-center"><Store className="w-3 h-3 text-gray-600" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold text-white truncate">{item.seller_name}</p>
                {item.seller_slug && (
                  <a href={`/shop/${item.seller_slug}`} className="text-[9px] sm:text-[10px] text-[#3b82f6] hover:underline" onClick={e => e.stopPropagation()}>
                    Visit Store
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Price + Buy */}
          <div className="flex items-center justify-between gap-3 pt-1.5 sm:pt-2.5 border-t border-white/[0.04]">
            {price ? (
              <div>
                <p className="text-[8px] sm:text-[9px] text-gray-600 uppercase tracking-[0.15em] font-bold">Asking Price</p>
                <p className="text-lg sm:text-xl font-black text-amber-400">${parseFloat(price).toFixed(2)}</p>
              </div>
            ) : (
              <div><p className="text-xs text-gray-500">Price on eBay</p></div>
            )}
            {item.ebay_item_id && (
              <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs sm:text-sm hover:from-amber-400 hover:to-orange-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                data-testid="marketplace-buy-ebay-btn">
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Buy on eBay
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};


// =========== MAIN MARKETPLACE PAGE ===========
const MarketplacePage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [availableSports, setAvailableSports] = useState([]);
  const [availableSellers, setAvailableSellers] = useState([]);
  const [total, setTotal] = useState(0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sportFilter !== 'all') params.set('sport', sportFilter);
      if (conditionFilter !== 'all') params.set('condition', conditionFilter);
      if (sellerFilter !== 'all') params.set('seller', sellerFilter);
      if (search) params.set('search', search);
      params.set('sort', sortBy);

      const res = await axios.get(`${API}/api/marketplace?${params.toString()}`);
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.sports) setAvailableSports(res.data.sports);
      if (res.data.sellers) setAvailableSellers(res.data.sellers);
    } catch (err) {
      console.error('Marketplace fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [sportFilter, conditionFilter, sellerFilter, search, sortBy]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const activeFilterCount = [sportFilter !== 'all', conditionFilter !== 'all', sellerFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#050505] text-white" data-testid="marketplace-page">
      {/* Ambient Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] bg-amber-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-30%] right-[-15%] w-[60%] h-[60%] bg-purple-500/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* Hero */}
      <header className="relative border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-none">
                  FlipSlab <span className="text-amber-400">Marketplace</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Browse cards from all sellers</p>
              </div>
            </div>
            <div className="flex gap-6 sm:gap-10 mt-2">
              {[
                { val: total, label: 'Cards', icon: Package, color: 'text-amber-400' },
                { val: availableSellers.length, label: 'Sellers', icon: Users, color: 'text-blue-400' },
                { val: availableSports.length, label: 'Sports', icon: Tag, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.15em] font-bold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </header>

      {/* Search + Filters Bar */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by player, card, or set..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/30 transition-colors"
              data-testid="marketplace-search" />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${showFilters ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/[0.04] border-white/[0.06] text-gray-400'}`}
            data-testid="marketplace-filter-toggle">
            <Filter className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-black text-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="hidden sm:block appearance-none bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer hover:border-white/10 transition-colors"
            data-testid="marketplace-sort">
            <option value="newest" className="bg-[#111] text-white">Newest</option>
            <option value="price_high" className="bg-[#111] text-white">Price: High → Low</option>
            <option value="price_low" className="bg-[#111] text-white">Price: Low → High</option>
          </select>
          <span className="text-xs text-gray-600 hidden sm:block">{items.length} cards</span>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/[0.04]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-2">
                <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none" data-testid="marketplace-sport-filter">
                  <option value="all" className="bg-[#111] text-white">All Sports</option>
                  {availableSports.map(s => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                </select>
                <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none" data-testid="marketplace-condition-filter">
                  <option value="all" className="bg-[#111] text-white">All Conditions</option>
                  <option value="Graded" className="bg-[#111] text-white">Graded</option>
                  <option value="Raw" className="bg-[#111] text-white">Raw</option>
                </select>
                <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none max-w-[180px]" data-testid="marketplace-seller-filter">
                  <option value="all" className="bg-[#111] text-white">All Sellers</option>
                  {availableSellers.map(s => <option key={s.name} value={s.name} className="bg-[#111] text-white">{s.name}</option>)}
                </select>
                {/* Sort for mobile */}
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="sm:hidden bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none" data-testid="marketplace-sort-mobile">
                  <option value="newest" className="bg-[#111] text-white">Newest</option>
                  <option value="price_high" className="bg-[#111] text-white">Price: High → Low</option>
                  <option value="price_low" className="bg-[#111] text-white">Price: Low → High</option>
                </select>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setSportFilter('all'); setConditionFilter('all'); setSellerFilter('all'); }}
                    className="px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-colors"
                    data-testid="marketplace-clear-filters">
                    Clear All
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cards Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-xs text-gray-600 tracking-widest uppercase">Loading marketplace...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <Package className="w-16 h-16 text-gray-800 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-600">No cards found</h2>
            <p className="text-xs text-gray-700 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
            {items.map((item, idx) => (
              <MarketCardTile key={`${item.ebay_item_id || item.card_name}-${idx}`} item={item} index={idx} onClick={() => setSelectedCard(item)} />
            ))}
          </div>
        )}
      </main>

      {/* Card Modal */}
      <AnimatePresence>
        {selectedCard && <MarketCardModal item={selectedCard} items={items} onNavigate={setSelectedCard} onClose={() => setSelectedCard(null)} />}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-gray-600 hover:text-white transition-colors">
            <div className="w-5 h-5 bg-gradient-to-br from-amber-500 to-red-500 rounded" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Powered by FlipSlab Engine</span>
          </a>
          <p className="text-[10px] text-gray-700">flipslabengine.com</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketplacePage;
