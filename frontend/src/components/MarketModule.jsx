import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, DollarSign, BarChart3, ExternalLink,
  RefreshCw, Layers, Tag, Package, Eye, Clock, ArrowRight,
  ShoppingBag, Heart, ArrowUpRight, Image as ImageIcon
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

const StatBox = ({ label, value, color }) => (
  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{label}</p>
    <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
  </div>
);

// =========== MARKET VALUE POPUP ===========
const MarketValueCard = ({ query, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/api/market/card-value`, { params: { query } });
        setData(res.data);
      } catch { toast.error('Failed to load market data'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [query]);

  if (loading) return (
    <div className="p-4 flex items-center gap-2 text-gray-500"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-xs">Loading market data...</span></div>
  );

  const raw = data?.raw?.stats || {};
  const psa10 = data?.psa10?.stats || {};

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Raw Market</p>
          {raw.count > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">{formatPrice(raw.median)}</span>
              <span className="text-[10px] text-gray-500">median ({raw.count} listings)</span>
            </div>
          ) : <span className="text-[10px] text-gray-500 italic">Sin ventas raw recientes</span>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">PSA 10 Market</p>
          {psa10.count > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-amber-400">{formatPrice(psa10.median)}</span>
              <span className="text-[10px] text-gray-500">median ({psa10.count} listings)</span>
            </div>
          ) : <span className="text-[10px] text-gray-500 italic">Sin ventas PSA 10 recientes</span>}
        </div>
      </div>
      <button onClick={onClose} className="text-[10px] text-gray-600 hover:text-gray-400">Close</button>
    </motion.div>
  );
};


// =========== MY EBAY LISTINGS TAB ===========
const MyListingsTab = ({ listings, totalValue }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  return (
    <div className="space-y-3">
      {/* Summary + Toggle */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-3">
          <StatBox label="Active Listings" value={listings.length} color="text-[#3b82f6]" />
          <StatBox label="Total Asking" value={formatPrice(totalValue)} color="text-emerald-400" />
          <StatBox label="Avg Price" value={formatPrice(listings.length > 0 ? totalValue / listings.length : 0)} color="text-gray-300" />
        </div>
        <ViewToggle view={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {listings.map((item, i) => (
            <motion.div key={item.item_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
              className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors group" data-testid={`listing-${i}`}>
              <div className="aspect-square bg-[#0a0a0a] overflow-hidden relative">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white uppercase font-bold">
                  ${item.price}
                </span>
                <span className="absolute top-2 right-2 text-[8px] px-1.5 py-0.5 rounded bg-black/70 text-gray-300 uppercase">
                  {item.listing_type === 'FixedPriceItem' ? 'BIN' : 'Auction'}
                </span>
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
        /* LIST VIEW */
        <div className="space-y-1">
          {listings.map((item, i) => (
            <div key={item.item_id} className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors">
              <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === item.item_id ? null : item.item_id)}
                data-testid={`listing-${i}`}>
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-11 h-11 rounded object-cover flex-shrink-0" />
                ) : <div className="w-11 h-11 rounded bg-[#1a1a1a] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500 uppercase">{item.listing_type === 'FixedPriceItem' ? 'Buy Now' : 'Auction'}</span>
                    {item.watch_count > 0 && <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{item.watch_count}</span>}
                    <span className="text-[10px] text-gray-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />{parseTimeLeft(item.time_left)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-400">${item.price}</p>
                  <button className="text-[9px] text-[#3b82f6] hover:text-[#60a5fa] mt-0.5">
                    {expandedId === item.item_id ? 'Hide' : 'Market Value'}
                  </button>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 hover:text-[#3b82f6]" />
                </a>
              </div>
              <AnimatePresence>
                {expandedId === item.item_id && (
                  <MarketValueCard query={item.title} onClose={() => setExpandedId(null)} />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// =========== MY COLLECTION TAB ===========
const MyCollectionTab = ({ items }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const totalInvested = items.reduce((s, i) => s + ((i.purchase_price || 0) * (i.quantity || 1)), 0);

  return (
    <div className="space-y-3">
      {/* Summary + Toggle */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-3">
          <StatBox label="Cards" value={items.length} color="text-amber-400" />
          <StatBox label="Total Invested" value={formatPrice(totalInvested)} color="text-emerald-400" />
          <StatBox label="Avg Cost" value={formatPrice(items.length > 0 ? totalInvested / items.length : 0)} color="text-gray-300" />
        </div>
        <ViewToggle view={viewMode} onChange={setViewMode} />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <Package className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No cards in inventory</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
              className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors group" data-testid={`collection-${i}`}>
              <div className="aspect-[3/4] bg-[#0a0a0a] overflow-hidden relative">
                {item.image ? (
                  <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-800" /></div>}
                {item.category === 'for_sale' ? (
                  <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white uppercase font-bold">Sale</span>
                ) : (
                  <span className="absolute top-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-[#3b82f6]/90 text-white uppercase font-bold">Col</span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-[11px] font-semibold text-white truncate">{item.card_name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  {item.condition === 'Graded' && item.grade ? (
                    <span className="text-[11px] font-bold text-amber-400">{item.grading_company} {item.grade}</span>
                  ) : <span className="text-[10px] text-gray-600">Raw</span>}
                  <span className="text-[11px] font-bold text-white">{formatPrice(item.purchase_price)}</span>
                </div>
                {item.player && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{item.player} {item.year || ''}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={item.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-colors">
              <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                data-testid={`collection-${i}`}>
                <div className="w-11 h-14 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                  {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-3.5 h-3.5 text-gray-700" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-medium text-white truncate">{item.card_name}</p>
                    {item.category === 'for_sale' ? (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase flex-shrink-0">Sale</span>
                    ) : (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] uppercase flex-shrink-0">Col</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.player && <span className="text-[10px] text-gray-500">{item.player}</span>}
                    {item.condition === 'Graded' && item.grade && (
                      <span className="text-[10px] text-amber-400">{item.grading_company} {item.grade}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">{formatPrice(item.purchase_price)}</p>
                  <button className="text-[9px] text-[#3b82f6] hover:text-[#60a5fa] mt-0.5">
                    {expandedId === item.id ? 'Hide' : 'Market Value'}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {expandedId === item.id && (
                  <MarketValueCard query={item.card_name} onClose={() => setExpandedId(null)} />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// =========== SEARCH TAB ===========
const SearchTab = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [flipData, setFlipData] = useState(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMarketData(null);
    setFlipData(null);
    try {
      const [mRes, fRes] = await Promise.all([
        axios.get(`${API}/api/market/card-value`, { params: { query: query.trim() } }),
        axios.get(`${API}/api/market/flip-calc`, { params: { query: query.trim(), grading_cost: 30 } }),
      ]);
      setMarketData(mRes.data);
      setFlipData(fRes.data);
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  };

  const raw = marketData?.raw?.stats || {};
  const psa10 = marketData?.psa10?.stats || {};
  const fp = flipData || {};

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
            placeholder='Search any card... e.g. "Luka Doncic Prizm Silver"' value={query} onChange={e => setQuery(e.target.value)}
            data-testid="market-search-input" />
        </div>
        <button type="submit" disabled={loading || !query.trim()}
          className="px-5 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors flex items-center gap-2"
          data-testid="market-search-btn">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </form>

      {loading && (
        <div className="text-center py-12"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin mx-auto mb-2" /><p className="text-xs text-gray-500">Searching eBay...</p></div>
      )}

      {!loading && marketData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Flip Calc */}
          {fp.raw_price > 0 && fp.psa10_value > 0 && (
            <div className={`bg-[#111] border rounded-xl p-4 ${fp.potential_profit > 0 ? 'border-emerald-500/30' : 'border-[#1a1a1a]'}`}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className={`w-4 h-4 ${fp.potential_profit > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Flip Calculator</h3>
                {fp.potential_profit > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase">Profitable</span>}
              </div>
              <div className="grid grid-cols-5 gap-2">
                <StatBox label="Raw" value={formatPrice(fp.raw_price)} color="text-white" />
                <StatBox label="PSA 10" value={formatPrice(fp.psa10_value)} color="text-amber-400" />
                <StatBox label="Grading" value={`$${fp.grading_cost}`} color="text-gray-400" />
                <StatBox label="Profit" value={formatPrice(fp.potential_profit)} color={fp.potential_profit > 0 ? 'text-emerald-400' : 'text-red-400'} />
                <StatBox label="ROI" value={`${fp.roi_percent}%`} color={fp.roi_percent > 0 ? 'text-emerald-400' : 'text-red-400'} />
              </div>
            </div>
          )}
          {/* Raw vs PSA 10 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                <Layers className="w-4 h-4 text-[#3b82f6]" /><h3 className="text-sm font-semibold text-white">Raw / Ungraded</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500">{raw.count || 0}</span>
              </div>
              <div className="p-3">
                {raw.count > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <StatBox label="Median" value={formatPrice(raw.median)} color="text-white" />
                      <StatBox label="Avg" value={formatPrice(raw.avg)} color="text-gray-300" />
                      <StatBox label="Range" value={`${formatPrice(raw.min)}-${formatPrice(raw.max)}`} color="text-gray-400" />
                    </div>
                    <div className="space-y-1">
                      {(marketData.raw?.items || []).slice(0, 4).map((item, i) => (
                        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.02] group" data-testid={`raw-item-${i}`}>
                          {item.image_url && <img src={item.image_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />}
                          <p className="text-[10px] text-gray-400 truncate flex-1 group-hover:text-white">{item.title}</p>
                          <span className="text-[11px] font-bold text-white">${item.price}</span>
                        </a>
                      ))}
                    </div>
                  </>
                ) : <p className="text-xs text-gray-600 text-center py-4">Sin ventas raw recientes</p>}
              </div>
            </div>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                <Tag className="w-4 h-4 text-amber-500" /><h3 className="text-sm font-semibold text-white">PSA 10</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500">{psa10.count || 0}</span>
              </div>
              <div className="p-3">
                {psa10.count > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <StatBox label="Median" value={formatPrice(psa10.median)} color="text-amber-400" />
                      <StatBox label="Avg" value={formatPrice(psa10.avg)} color="text-gray-300" />
                      <StatBox label="Range" value={`${formatPrice(psa10.min)}-${formatPrice(psa10.max)}`} color="text-gray-400" />
                    </div>
                    <div className="space-y-1">
                      {(marketData.psa10?.items || []).slice(0, 4).map((item, i) => (
                        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.02] group" data-testid={`psa10-item-${i}`}>
                          {item.image_url && <img src={item.image_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />}
                          <p className="text-[10px] text-gray-400 truncate flex-1 group-hover:text-white">{item.title}</p>
                          <span className="text-[11px] font-bold text-amber-400">${item.price}</span>
                        </a>
                      ))}
                    </div>
                  </>
                ) : <p className="text-xs text-gray-600 text-center py-4">Sin ventas PSA 10 recientes</p>}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {!loading && !marketData && (
        <div className="text-center py-12 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <BarChart3 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Search any card for market data</p>
          <p className="text-[10px] text-gray-600 mt-1">Try: "Luka Doncic Prizm Silver" or "Michael Jordan Fleer #57"</p>
        </div>
      )}
    </div>
  );
};


// =========== MAIN MARKET MODULE ===========
const MarketModule = () => {
  const [activeTab, setActiveTab] = useState('listings');
  const [ebayData, setEbayData] = useState(null);
  const [invItems, setInvItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [ebayRes, invRes] = await Promise.allSettled([
          axios.get(`${API}/api/ebay/seller/my-listings?limit=50`),
          axios.get(`${API}/api/inventory?limit=100`),
        ]);
        if (ebayRes.status === 'fulfilled') setEbayData(ebayRes.value.data);
        if (invRes.status === 'fulfilled') setInvItems(invRes.value.data.items || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const eb = ebayData || { active: [], sold: [], active_total: 0 };
  const totalListingValue = eb.active.reduce((s, i) => s + (i.price || 0), 0);
  const totalInvValue = invItems.reduce((s, i) => s + ((i.purchase_price || 0) * (i.quantity || 1)), 0);

  const tabs = [
    { id: 'listings', label: `My Listings (${eb.active_total || 0})`, icon: Tag },
    { id: 'collection', label: `My Collection (${invItems.length})`, icon: Heart },
    { id: 'search', label: 'Search Market', icon: Search },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-8" data-testid="market-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Market</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track market values for your portfolio</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">Total Portfolio</p>
          <p className="text-lg font-bold text-white">{formatPrice(totalListingValue + totalInvValue)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
            }`} data-testid={`market-tab-${id}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'listings' && (
          <motion.div key="listings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MyListingsTab listings={eb.active} totalValue={totalListingValue} />
          </motion.div>
        )}
        {activeTab === 'collection' && (
          <motion.div key="collection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MyCollectionTab items={invItems} />
          </motion.div>
        )}
        {activeTab === 'search' && (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SearchTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketModule;
