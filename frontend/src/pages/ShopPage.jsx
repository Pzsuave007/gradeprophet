import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import {
  Store, MapPin, ExternalLink, Search, Filter, X,
  Package, DollarSign, ShoppingCart, Eye, Tag, Layers,
  ChevronDown, Star
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
      return 0; // newest = default order
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

  return (
    <div className="min-h-screen bg-[#050505] text-white" data-testid="public-shop-page">
      {/* Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Hero Header */}
      <header className="relative border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/20 flex items-center justify-center overflow-hidden shadow-lg shadow-amber-500/10">
                {shop.avatar ? (
                  <img src={shop.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-10 h-10 text-amber-500/60" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#050505]">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                {shop.name}
              </h1>
              {shop.location && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1.5 text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs">{shop.location}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 sm:gap-8">
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-black text-amber-400">{shop.total_items}</p>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Listed</p>
              </div>
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-black text-emerald-400">
                  ${shop.total_value >= 1000 ? `${(shop.total_value / 1000).toFixed(1)}k` : shop.total_value.toFixed(0)}
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Value</p>
              </div>
              <div className="text-center">
                <p className="text-xl sm:text-2xl font-black text-blue-400">{shop.sports?.length || 0}</p>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Sports</p>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Filters Bar */}
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
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <span className="text-xs text-gray-600 hidden sm:block">{filtered.length} cards</span>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/[0.04]">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-2">
                <select value={sportFilter} onChange={e => setSportFilter(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none"
                  data-testid="shop-sport-filter">
                  <option value="all">All Sports</option>
                  {(shop.sports || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white outline-none"
                  data-testid="shop-sort">
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
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-800 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-600">No cards listed yet</h2>
            <p className="text-xs text-gray-700 mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((item, idx) => (
              <CardTile key={item.id || idx} item={item} index={idx} onClick={() => setSelectedCard(item)} />
            ))}
          </div>
        )}
      </main>

      {/* Card Detail Modal */}
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

// =========== CARD TILE ===========
const CardTile = ({ item, index, onClick }) => {
  const price = item.listed_price || item.purchase_price;
  const imgSrc = item.image ? `data:image/jpeg;base64,${item.image}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      onClick={onClick}
      className="group relative bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden cursor-pointer hover:border-amber-500/20 hover:bg-white/[0.04] transition-all duration-300"
      data-testid={`shop-card-${index}`}
    >
      {/* Image */}
      <div className="aspect-[3/4] relative overflow-hidden bg-[#0a0a0a]">
        {imgSrc ? (
          <img src={imgSrc} alt={item.card_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-gray-800" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Quick buy overlay */}
        {item.ebay_item_id && (
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <div className="flex items-center justify-center gap-2 py-2 bg-amber-500 rounded-lg text-black text-xs font-bold">
              <ShoppingCart className="w-3.5 h-3.5" /> View on eBay
            </div>
          </div>
        )}

        {/* Sport tag */}
        {item.sport && (
          <div className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/50 text-white/70 backdrop-blur-sm">
            {item.sport}
          </div>
        )}

        {/* Condition badge */}
        {item.condition && (
          <div className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm"
            style={{ color: item.condition === 'Graded' ? '#f59e0b' : '#9ca3af' }}>
            {item.condition === 'Graded' ? `${item.grading_company || 'GRD'} ${item.grade || ''}`.trim() : 'Raw'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-bold text-white truncate leading-tight">{item.card_name}</p>
        {item.player && <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.player}</p>}
        {price && (
          <p className="text-sm font-black text-amber-400 mt-1.5">${parseFloat(price).toFixed(2)}</p>
        )}
      </div>
    </motion.div>
  );
};

// =========== CARD MODAL ===========
const CardModal = ({ item, onClose }) => {
  const imgSrc = item.image ? `data:image/jpeg;base64,${item.image}` : null;
  const backSrc = item.back_image ? `data:image/jpeg;base64,${item.back_image}` : null;
  const [showBack, setShowBack] = useState(false);
  const price = item.listed_price || item.purchase_price;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose} data-testid="shop-card-modal">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#0a0a0a] border border-white/[0.06] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          data-testid="shop-modal-close">
          <X className="w-4 h-4" />
        </button>

        {/* Image */}
        <div className="relative aspect-[3/4] max-h-[50vh] overflow-hidden bg-[#080808]">
          {imgSrc ? (
            <img src={showBack && backSrc ? backSrc : imgSrc} alt={item.card_name}
              className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-800" />
            </div>
          )}
          {backSrc && (
            <button onClick={() => setShowBack(!showBack)}
              className="absolute bottom-3 left-3 text-[10px] px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white font-bold"
              data-testid="shop-modal-flip">
              {showBack ? 'Front' : 'Back'}
            </button>
          )}
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">{item.card_name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {item.player && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {item.player}
                </span>
              )}
              {item.sport && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                  {item.sport}
                </span>
              )}
              {item.year && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                  {item.year}
                </span>
              )}
              {item.condition && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
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
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.04]">
            {price ? (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Asking Price</p>
                <p className="text-2xl font-black text-amber-400">${parseFloat(price).toFixed(2)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Price on eBay</p>
              </div>
            )}
            {item.ebay_item_id && (
              <a href={`https://www.ebay.com/itm/${item.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm hover:from-amber-400 hover:to-orange-400 transition-colors active:scale-95 transform shadow-lg shadow-amber-500/20"
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
