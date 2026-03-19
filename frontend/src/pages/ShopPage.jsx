import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import {
  Store, MapPin, ExternalLink, Search, Filter, X,
  Package, ShoppingCart, Tag, ChevronDown, RotateCcw,
  Crown, Star, Shield, Award
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ShopPage = () => {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const res = await axios.get(`${API}/api/shop/${slug}`);
        setShop(res.data.shop);
        setItems(res.data.items || []);
      } catch (err) {
        setError(err.response?.status === 404 ? 'Shop not found' : 'Error loading shop');
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [slug]);

  const filtered = items
    .filter(i => {
      if (search) {
        const q = search.toLowerCase();
        const name = (i.card_name || '').toLowerCase();
        const player = (i.player || '').toLowerCase();
        if (!name.includes(q) && !player.includes(q)) return false;
      }
      if (sportFilter !== 'all' && i.sport !== sportFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_high') return (b.listed_price || 0) - (a.listed_price || 0);
      if (sortBy === 'price_low') return (a.listed_price || 0) - (b.listed_price || 0);
      return 0;
    });

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-xs text-gray-600 tracking-widest uppercase">Loading store...</p>
      </motion.div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Store className="w-16 h-16 text-gray-800 mx-auto" />
        <h1 className="text-2xl font-black text-white">{error}</h1>
        <p className="text-sm text-gray-600">This shop doesn't exist or has been removed.</p>
        <a href="/" className="inline-block px-6 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors">
          Go to FlipSlab Engine
        </a>
      </div>
    </div>
  );

  const logoSrc = shop.logo || shop.avatar;

  return (
    <div className="min-h-screen bg-[#050505] text-white" data-testid="public-shop-page">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-30%] left-[-15%] w-[70%] h-[70%] bg-amber-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-30%] right-[-15%] w-[60%] h-[60%] bg-blue-500/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* Hero */}
      <header className="relative border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {(() => {
            const plan = shop.plan || 'rookie';
            const glow = PLAN_GLOW[plan] || PLAN_GLOW.rookie;
            const badge = PLAN_BADGE[plan] || PLAN_BADGE.rookie;
            const BadgeIcon = badge.Icon;
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-5">
                {/* Left: Logo + Name + Location */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{
                      border: `2px solid ${glow.hoverBorder}`,
                      boxShadow: glow.hoverShadow,
                      background: `linear-gradient(135deg, ${badge.bg}, rgba(0,0,0,0.3))`,
                    }}>
                    {logoSrc ? (
                      <img src={logoSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: badge.color }} />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-none">
                      {shop.name}
                    </h1>
                    {shop.location && (
                      <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-sm">{shop.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Right: Tier Badge + Stats */}
                <div className="flex flex-col items-center sm:items-end gap-3">
                  {/* Tier Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{ background: badge.bg, border: `1px solid ${badge.borderColor}` }}>
                    <BadgeIcon className="w-3.5 h-3.5" style={{ color: badge.color }} />
                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  {/* Stats */}
                  <div className="flex gap-6 sm:gap-8">
                    {[
                      { val: shop.total_items, label: 'Cards', color: 'text-amber-400' },
                      { val: shop.sales_count || 0, label: 'Sales', color: 'text-emerald-400' },
                      { val: shop.sports?.length || 0, label: 'Sports', color: 'text-blue-400' },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.val}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-[0.15em] font-bold mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </header>

      {/* Search/Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/30 transition-colors"
              data-testid="shop-search" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${showFilters ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/[0.04] border-white/[0.06] text-gray-400'}`}
            data-testid="shop-filter-toggle">
            <Filter className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Filters</span>
          </button>
          <span className="text-xs text-gray-600 hidden sm:block">{filtered.length} cards</span>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/[0.04]">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-2">
                <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none" data-testid="shop-sport-filter">
                  <option value="all">All Sports</option>
                  {(shop.sports || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none" data-testid="shop-sort">
                  <option value="newest">Newest First</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="price_low">Price: Low to High</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cards Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <Package className="w-16 h-16 text-gray-800 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-600">No cards listed yet</h2>
            <p className="text-xs text-gray-700 mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filtered.map((item, idx) => (
              <CardTile key={item.id || idx} item={item} index={idx} plan={shop.plan} onClick={() => setSelectedCard(item)} />
            ))}
          </div>
        )}
      </main>

      {/* Card Modal */}
      <AnimatePresence>
        {selectedCard && <CardModal item={selectedCard} onClose={() => setSelectedCard(null)} />}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
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

// =========== PLAN GLOW CONFIG ===========
const PLAN_GLOW = {
  rookie:      { border: 'rgba(156,163,175,0.15)', shadow: '0 0 15px rgba(156,163,175,0.08), 0 0 30px rgba(156,163,175,0.04)', hoverShadow: '0 0 20px rgba(156,163,175,0.15), 0 0 40px rgba(156,163,175,0.08)', hoverBorder: 'rgba(156,163,175,0.25)' },
  all_star:    { border: 'rgba(59,130,246,0.2)',    shadow: '0 0 15px rgba(59,130,246,0.1), 0 0 30px rgba(59,130,246,0.05)',   hoverShadow: '0 0 20px rgba(59,130,246,0.2), 0 0 40px rgba(59,130,246,0.1)',   hoverBorder: 'rgba(59,130,246,0.35)' },
  hall_of_fame:{ border: 'rgba(245,158,11,0.2)',    shadow: '0 0 15px rgba(245,158,11,0.1), 0 0 30px rgba(245,158,11,0.05)',   hoverShadow: '0 0 20px rgba(245,158,11,0.25), 0 0 40px rgba(245,158,11,0.1)', hoverBorder: 'rgba(245,158,11,0.4)' },
  legend:      { border: 'rgba(168,85,247,0.2)',    shadow: '0 0 15px rgba(168,85,247,0.12), 0 0 30px rgba(168,85,247,0.06)', hoverShadow: '0 0 25px rgba(168,85,247,0.3), 0 0 50px rgba(168,85,247,0.12)', hoverBorder: 'rgba(168,85,247,0.45)' },
};

const PLAN_BADGE = {
  rookie:       { label: 'Rookie',       Icon: Shield, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', borderColor: 'rgba(156,163,175,0.2)' },
  all_star:     { label: 'All-Star',     Icon: Star,   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  borderColor: 'rgba(59,130,246,0.25)' },
  hall_of_fame: { label: 'Hall of Fame', Icon: Award,  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  borderColor: 'rgba(245,158,11,0.25)' },
  legend:       { label: 'Legend',       Icon: Crown,  color: '#a855f7', bg: 'rgba(168,85,247,0.1)',  borderColor: 'rgba(168,85,247,0.25)' },
};

// =========== CARD TILE ===========
const CardTile = ({ item, index, plan, onClick }) => {
  const price = item.listed_price || item.purchase_price;
  const imgSrc = item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null;
  const glow = PLAN_GLOW[plan] || PLAN_GLOW.rookie;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.6) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-white/[0.02] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        border: `1px solid ${hovered ? glow.hoverBorder : glow.border}`,
        boxShadow: hovered ? glow.hoverShadow : glow.shadow,
      }}
      data-testid={`shop-card-${index}`}
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
        <p className="text-[11px] sm:text-xs font-bold text-white truncate leading-tight">{item.card_name}</p>
        {item.player && <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.player}</p>}
        {price && (
          <p className="text-sm font-black text-amber-400 mt-1.5">${parseFloat(price).toFixed(2)}</p>
        )}
      </div>
    </motion.div>
  );
};

// =========== CARD MODAL WITH 3D FLIP ===========
const CardModal = ({ item, onClose }) => {
  const frontSrc = item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null;
  const backSrc = item.back_image ? `data:image/jpeg;base64,${item.back_image}` : null;
  const [flipped, setFlipped] = useState(false);
  const price = item.listed_price || item.purchase_price;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose} data-testid="shop-card-modal">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative bg-[#0a0a0a] border border-white/[0.06] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/10"
          data-testid="shop-modal-close">
          <X className="w-5 h-5" />
        </button>

        {/* 3D Flip Card */}
        <div className="relative mx-4 mt-4 mb-3" style={{ perspective: 1200 }}>
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative aspect-[3/4] max-h-[65vh] cursor-pointer"
            onClick={() => backSrc && setFlipped(!flipped)}
          >
            {/* Front */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden bg-[#080808]"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              {frontSrc ? (
                <img src={frontSrc} alt={item.card_name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-800" />
                </div>
              )}
            </div>
            {/* Back */}
            {backSrc && (
              <div className="absolute inset-0 rounded-2xl overflow-hidden bg-[#080808]"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <img src={backSrc} alt="Back" className="w-full h-full object-contain" />
              </div>
            )}
          </motion.div>

          {/* Flip hint */}
          {backSrc && (
            <button
              onClick={() => setFlipped(!flipped)}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-white/70 hover:text-white transition-colors"
              data-testid="shop-modal-flip">
              <RotateCcw className="w-3 h-3" /> {flipped ? 'View Front' : 'View Back'}
            </button>
          )}
        </div>

        {/* Card Info */}
        <div className="px-5 pb-6 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">{item.card_name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {item.player && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {item.player}
                </span>
              )}
              {item.sport && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                  {item.sport}
                </span>
              )}
              {item.year && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                  {item.year}
                </span>
              )}
              {item.condition && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
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

          {/* Price + Buy */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/[0.04]">
            {price ? (
              <div>
                <p className="text-[9px] text-gray-600 uppercase tracking-[0.15em] font-bold">Asking Price</p>
                <p className="text-2xl font-black text-amber-400">${parseFloat(price).toFixed(2)}</p>
              </div>
            ) : (
              <div><p className="text-sm text-gray-500">Price on eBay</p></div>
            )}
            {item.ebay_item_id && (
              <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm hover:from-amber-400 hover:to-orange-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                data-testid="shop-buy-ebay-btn">
                <ShoppingCart className="w-4 h-4" /> Buy on eBay
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ShopPage;
