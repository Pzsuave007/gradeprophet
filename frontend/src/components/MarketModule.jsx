import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, DollarSign, BarChart3, ExternalLink,
  RefreshCw, ArrowUpRight, Layers, Tag
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const formatPrice = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return '-';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
};

const StatBox = ({ label, value, color }) => (
  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{label}</p>
    <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
  </div>
);

const MarketModule = () => {
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
      const [marketRes, flipRes] = await Promise.all([
        axios.get(`${API}/api/market/card-value`, { params: { query: query.trim() } }),
        axios.get(`${API}/api/market/flip-calc`, { params: { query: query.trim(), grading_cost: 30 } }),
      ]);
      setMarketData(marketRes.data);
      setFlipData(flipRes.data);
    } catch (err) {
      toast.error('Search failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const raw = marketData?.raw?.stats || {};
  const psa10 = marketData?.psa10?.stats || {};
  const fp = flipData || {};

  return (
    <div className="space-y-5 pb-8" data-testid="market-page">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Market</h1>
        <p className="text-xs text-gray-500 mt-0.5">Search real-time market prices and flip opportunities</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-9 pr-3 py-3 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
            placeholder="Search card... e.g. 1996 Topps Chrome Kobe Bryant #138"
            value={query}
            onChange={e => setQuery(e.target.value)}
            data-testid="market-search-input"
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()}
          className="px-6 py-3 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors flex items-center gap-2"
          data-testid="market-search-btn">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Searching eBay market data...</p>
        </div>
      )}

      {/* Results */}
      {!loading && marketData && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Flip Calculator Card */}
            {fp.raw_price > 0 && fp.psa10_value > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-[#111] border rounded-xl p-5 ${fp.potential_profit > 0 ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className={`w-5 h-5 ${fp.potential_profit > 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                  <h2 className="text-sm font-bold text-white">Flip Calculator</h2>
                  {fp.potential_profit > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase font-medium">Profitable</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatBox label="Raw Price" value={formatPrice(fp.raw_price)} color="text-white" />
                  <StatBox label="PSA 10 Value" value={formatPrice(fp.psa10_value)} color="text-amber-400" />
                  <StatBox label="Grading Cost" value={`$${fp.grading_cost}`} color="text-gray-400" />
                  <StatBox label="Potential Profit" value={formatPrice(fp.potential_profit)} color={fp.potential_profit > 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <StatBox label="ROI" value={`${fp.roi_percent}%`} color={fp.roi_percent > 0 ? 'text-emerald-400' : 'text-red-400'} />
                </div>
              </motion.div>
            )}

            {/* Market Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Raw Prices */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <Layers className="w-4 h-4 text-[#3b82f6]" />
                  <h3 className="text-sm font-semibold text-white">Raw / Ungraded</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500">{raw.count || 0} listings</span>
                </div>
                <div className="p-4">
                  {raw.count > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <StatBox label="Median" value={formatPrice(raw.median)} color="text-white" />
                        <StatBox label="Average" value={formatPrice(raw.avg)} color="text-gray-300" />
                        <StatBox label="Range" value={`${formatPrice(raw.min)} - ${formatPrice(raw.max)}`} color="text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        {(marketData.raw?.items || []).slice(0, 5).map((item, i) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors group" data-testid={`raw-item-${i}`}>
                            {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                            <p className="text-[11px] text-gray-400 truncate flex-1 group-hover:text-white">{item.title}</p>
                            <span className="text-xs font-bold text-white">${item.price}</span>
                            <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-[#3b82f6]" />
                          </a>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-sm text-gray-500 text-center py-4">No raw listings found</p>}
                </div>
              </div>

              {/* PSA 10 Prices */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-white">PSA 10 / Gem Mint</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500">{psa10.count || 0} listings</span>
                </div>
                <div className="p-4">
                  {psa10.count > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <StatBox label="Median" value={formatPrice(psa10.median)} color="text-amber-400" />
                        <StatBox label="Average" value={formatPrice(psa10.avg)} color="text-gray-300" />
                        <StatBox label="Range" value={`${formatPrice(psa10.min)} - ${formatPrice(psa10.max)}`} color="text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        {(marketData.psa10?.items || []).slice(0, 5).map((item, i) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors group" data-testid={`psa10-item-${i}`}>
                            {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                            <p className="text-[11px] text-gray-400 truncate flex-1 group-hover:text-white">{item.title}</p>
                            <span className="text-xs font-bold text-amber-400">${item.price}</span>
                            <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-amber-400" />
                          </a>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-sm text-gray-500 text-center py-4">No PSA 10 listings found</p>}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Empty state */}
      {!loading && !marketData && (
        <div className="text-center py-16 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <BarChart3 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">Search for any card to see market data</p>
          <p className="text-xs text-gray-600">Try: "Luka Doncic Prizm Silver" or "Michael Jordan Fleer #57"</p>
        </div>
      )}
    </div>
  );
};

export default MarketModule;
