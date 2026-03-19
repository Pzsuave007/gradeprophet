import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, DollarSign, BarChart3, ExternalLink,
  RefreshCw, Layers, Tag, Package, Eye, Clock, ArrowRight,
  Heart, ArrowUpRight, ArrowDownRight, Plus, X, Flame,
  Star, Target, Zap, ChevronRight, Bookmark, Bell, Calendar, Lock
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import PriceAlerts from './PriceAlerts';
import SeasonalIntelligence from './SeasonalIntelligence';
import UpgradeGate from './UpgradeGate';
import { usePlan } from '../hooks/usePlan';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return '-';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
};

const SPORT_COLORS = {
  Basketball: '#f59e0b', Baseball: '#3b82f6', Football: '#10b981',
  Soccer: '#8b5cf6', Hockey: '#06b6d4', Other: '#6b7280',
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: ${p.value?.toFixed(2)}</p>
      ))}
    </div>
  );
};

// =========== HOT CARD ROW ===========
const HotCardRow = ({ card, onLookup }) => {
  const openEbay = (e) => {
    e.stopPropagation();
    window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.query)}&_sacat=212&LH_BIN=1&_sop=15`, '_blank');
  };
  const signalColor = card.season_signal === 'Buy Now' ? '#22c55e' : card.season_signal === 'Warming Up' ? '#f59e0b' : '#ef4444';
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3.5 hover:border-orange-500/30 transition-all group cursor-pointer"
      onClick={openEbay}
      data-testid={`hot-card-${card.name.replace(/\s/g, '-').toLowerCase()}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${SPORT_COLORS[card.sport] || '#6b7280'}20` }}>
          <Flame className="w-4 h-4" style={{ color: SPORT_COLORS[card.sport] || '#6b7280' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">{card.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded"
              style={{ background: `${SPORT_COLORS[card.sport] || '#6b7280'}15`, color: SPORT_COLORS[card.sport] || '#6b7280' }}>
              {card.sport}
            </span>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
              {card.tag}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {card.season_signal && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded"
              style={{ background: `${signalColor}15`, color: signalColor }}>
              {card.season_signal}
            </span>
          )}
          <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-orange-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
};

// =========== PRICE LOOKUP RESULT ===========
const PriceLookupResult = ({ data, query, onClose }) => {
  const primary = data?.primary || {};
  const secondary = data?.secondary || {};
  const pStats = primary.stats || {};
  const sStats = secondary.stats || {};

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden" data-testid="price-lookup-result">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
        <div>
          <h3 className="text-base font-bold text-white">{query}</h3>
          <div className="flex items-center gap-2 mt-1">
            {data?.is_graded && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">{data.detected_grade}</span>}
            {data?.data_source === 'sold' && <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase">Real Sold Prices</span>}
            {data?.data_source === 'active' && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold uppercase">Active Listings</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" data-testid="close-lookup"><X className="w-4 h-4 text-gray-500" /></button>
      </div>

      {/* Big Price Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-b border-[#1a1a1a]">
        <div className="p-5 sm:border-r border-b sm:border-b-0 border-[#1a1a1a]">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">{primary.label || 'Primary'}</p>
          {pStats.count > 0 ? (
            <>
              <p className="text-3xl font-black text-white" data-testid="primary-median">{fmt(pStats.median)}</p>
              <p className="text-xs text-gray-500 mt-1">{pStats.count} sales &middot; Avg {fmt(pStats.avg)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Range: {fmt(pStats.min)} &mdash; {fmt(pStats.max)}</p>
            </>
          ) : <p className="text-lg text-gray-600 mt-2">No recent data</p>}
        </div>
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">{secondary.label || 'Secondary'}</p>
          {sStats.count > 0 ? (
            <>
              <p className="text-3xl font-black text-amber-400" data-testid="secondary-median">{fmt(sStats.median)}</p>
              <p className="text-xs text-gray-500 mt-1">{sStats.count} sales &middot; Avg {fmt(sStats.avg)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Range: {fmt(sStats.min)} &mdash; {fmt(sStats.max)}</p>
            </>
          ) : <p className="text-lg text-gray-600 mt-2">No recent data</p>}
        </div>
      </div>

      {/* Sales list - bigger items */}
      {((primary.items || []).length > 0 || (secondary.items || []).length > 0) && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Recent Comparable Sales</p>
            {data?.sold_search_url && (
              <a href={data.sold_search_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] flex items-center gap-1" data-testid="view-all-ebay-link">
                View all on eBay <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {[...(primary.items || []).slice(0, 6), ...(secondary.items || []).slice(0, 4)].map((sale, i) => (
              <a key={i} href={sale.url || data?.sold_search_url || '#'} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0a0a0a] hover:bg-white/[0.03] group transition-colors"
                data-testid={`sale-item-${i}`}>
                {sale.image_url && <img src={sale.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate group-hover:text-[#3b82f6] transition-colors">{sale.title}</p>
                  {sale.date_sold && <p className="text-[10px] text-gray-600 mt-0.5">Sold {sale.date_sold}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-black text-emerald-400">${sale.price}</p>
                  <p className="text-[9px] text-gray-600">{sale.source === 'sold' ? 'Sold' : 'Listed'}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// =========== WATCHLIST ITEM ===========
const WatchlistItem = ({ item, onLookup, onRemove }) => (
  <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#2a2a2a] transition-all group">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center flex-shrink-0">
        {item.type === 'player' ? <Star className="w-4 h-4 text-[#3b82f6]" /> : <Tag className="w-4 h-4 text-amber-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{item.name}</p>
        <p className="text-[9px] text-gray-600 uppercase">{item.type}</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onLookup(item.name + (item.type === 'player' ? ' Prizm' : '')); }}
        className="text-[9px] px-2 py-1 rounded bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 font-bold"
        data-testid={`lookup-${item.name.replace(/\s/g, '-').toLowerCase()}`}>
        Lookup
      </button>
      <button onClick={(e) => { e.stopPropagation(); onRemove(item.name); }}
        className="p-1 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`remove-${item.name.replace(/\s/g, '-').toLowerCase()}`}>
        <X className="w-3 h-3 text-red-400" />
      </button>
    </div>
  </div>
);

// =========== MAIN MARKET MODULE ===========
const MarketModule = ({ onNavigateToAccount }) => {
  const [hotCards, setHotCards] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search / Lookup state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupQuery, setLookupQuery] = useState('');

  // Watchlist add
  const [showAddWatchlist, setShowAddWatchlist] = useState(false);
  const [newWatchName, setNewWatchName] = useState('');
  const [newWatchType, setNewWatchType] = useState('player');

  const { hasFeature, planId } = usePlan();
  const hasMarketFull = hasFeature('market_full');
  const hasSeasonal = hasFeature('market_seasonal');

  const goUpgrade = () => onNavigateToAccount?.();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hot, wl, pf, sales] = await Promise.allSettled([
        axios.get(`${API}/api/market/hot-cards`),
        axios.get(`${API}/api/market/watchlist`),
        axios.get(`${API}/api/market/portfolio-health`),
        axios.get(`${API}/api/dashboard/analytics`),
      ]);
      if (hot.status === 'fulfilled') setHotCards(hot.value.data.trending || []);
      if (wl.status === 'fulfilled') setWatchlist(wl.value.data.items || []);
      if (pf.status === 'fulfilled') setPortfolio(pf.value.data);
      if (sales.status === 'fulfilled') setSalesData(sales.value.data.sales);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLookup = async (query) => {
    if (!query?.trim()) return;
    setSearchQuery(query);
    setLookupQuery(query);
    setSearchLoading(true);
    setLookupResult(null);
    try {
      const res = await axios.get(`${API}/api/market/card-value`, { params: { query: query.trim() } });
      setLookupResult(res.data);
    } catch { toast.error('Failed to load market data'); }
    finally { setSearchLoading(false); }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    handleLookup(searchQuery);
  };

  const addToWatchlist = async () => {
    if (!newWatchName.trim()) return;
    try {
      await axios.post(`${API}/api/market/watchlist`, { name: newWatchName.trim(), type: newWatchType });
      setNewWatchName('');
      setShowAddWatchlist(false);
      toast.success('Added to watchlist');
      const wl = await axios.get(`${API}/api/market/watchlist`);
      setWatchlist(wl.data.items || []);
    } catch { toast.error('Failed to add'); }
  };

  const removeFromWatchlist = async (name) => {
    try {
      await axios.delete(`${API}/api/market/watchlist/${encodeURIComponent(name)}`);
      setWatchlist(prev => prev.filter(w => w.name !== name));
      toast.success('Removed');
    } catch { toast.error('Failed to remove'); }
  };

  const s = salesData || {};
  const pf = portfolio || { items: [], total_invested: 0, total_items: 0 };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin" />
      <p className="text-xs text-gray-600">Loading market intelligence...</p>
    </div>
  );

  // Rookie: entire Market module locked
  if (!hasMarketFull && planId === 'rookie') {
    return (
      <UpgradeGate locked={true} planRequired="all_star" featureName="Market Intelligence" onUpgrade={goUpgrade}>
        <div className="space-y-5 pb-8" data-testid="market-page">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Market Intelligence</h1>
            <p className="text-xs text-gray-500 mt-0.5">Real-time market data, trends & investment insights</p>
          </div>
          <div className="h-48 bg-[#111] border border-[#1a1a1a] rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 h-64 bg-[#111] border border-[#1a1a1a] rounded-xl" />
            <div className="lg:col-span-3 h-64 bg-[#111] border border-[#1a1a1a] rounded-xl" />
          </div>
        </div>
      </UpgradeGate>
    );
  }

  return (
    <div className="space-y-5 pb-8" data-testid="market-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Market Intelligence</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time market data, trends & investment insights</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#3b82f6]/50 transition-colors" data-testid="market-refresh">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* === SEASONAL INTELLIGENCE - gated for non-Hall of Fame === */}
      {hasSeasonal ? (
        <SeasonalIntelligence />
      ) : (
        <UpgradeGate locked={true} planRequired="hall_of_fame" featureName="Seasonal Intelligence" onUpgrade={goUpgrade}>
          <div className="h-48 bg-[#111] border border-[#1a1a1a] rounded-xl flex items-center justify-center">
            <p className="text-xs text-gray-600">Seasonal market intelligence data</p>
          </div>
        </UpgradeGate>
      )}

      {/* === UPCOMING RELEASES + HOT CARDS === */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        {/* Upcoming Releases - 2 cols */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col" data-testid="upcoming-releases-section">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
            <Calendar className="w-4 h-4 text-[#3b82f6]" />
            <h2 className="text-sm font-bold text-white">Upcoming Releases</h2>
            <span className="text-[9px] text-gray-600 ml-auto">2026</span>
          </div>
          <div className="p-3 space-y-2 flex-1 overflow-y-auto">
            {(() => {
              const releases = [
                { date: 'Mar 4', name: 'Upper Deck Series 2 Hockey', sport: 'Hockey', color: '#06b6d4' },
                { date: 'Mar 6', name: 'Leaf Optichrome Baseball', sport: 'Baseball', color: '#3b82f6' },
                { date: 'Mar 27', name: 'Panini Silhouette Football', sport: 'Football', color: '#10b981' },
                { date: 'Apr 1', name: 'WNBA Prizm', sport: 'Basketball', color: '#f59e0b' },
                { date: 'Apr 15', name: 'Topps Series 2 Baseball', sport: 'Baseball', color: '#3b82f6' },
                { date: 'May 7', name: 'Bowman Chrome Baseball', sport: 'Baseball', color: '#3b82f6' },
                { date: 'Jun 4', name: 'Panini Prizm Football Draft', sport: 'Football', color: '#10b981' },
                { date: 'Sep 10', name: 'Topps Football', sport: 'Football', color: '#10b981' },
                { date: 'Oct 1', name: 'Topps Chrome Basketball', sport: 'Basketball', color: '#f59e0b' },
                { date: 'Oct 15', name: 'Panini Prizm Basketball', sport: 'Basketball', color: '#f59e0b' },
              ];
              const cm = new Date().getMonth();
              const upcoming = releases.filter(r => new Date(`${r.date} 2026`).getMonth() >= cm);
              return upcoming.map((release, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${release.color}15` }}>
                    <Calendar className="w-4 h-4" style={{ color: release.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{release.name}</p>
                    <p className="text-[9px] text-gray-600">{release.sport}</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">{release.date}</span>
                </div>
              ));
            })()}
          </div>
        </motion.div>

        {/* Hot on Market - 3 cols */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="lg:col-span-3 bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col" data-testid="hot-cards-section">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="text-sm font-bold text-white">Hot on the Market</h2>
            <span className="text-[9px] text-gray-600 ml-auto">Based on buying season</span>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {hotCards.map((card, i) => (
                <HotCardRow key={i} card={card} onLookup={handleLookup} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  );
};

export default MarketModule;
