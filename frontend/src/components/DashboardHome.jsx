import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Layers, Tag, Zap, TrendingUp, TrendingDown,
  Clock, ArrowUpRight, ArrowDownRight, Minus, ExternalLink,
  BarChart3, Eye, RefreshCw
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const formatPrice = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '$0';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const KpiCard = ({ icon: Icon, label, value, sub, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.08, duration: 0.35 }}
    className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors"
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white tracking-tight" data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </motion.div>
);

const DashboardHome = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes, oppsRes, moversRes] = await Promise.all([
        axios.get(`${API}/api/dashboard/stats`),
        axios.get(`${API}/api/dashboard/recent`),
        axios.get(`${API}/api/dashboard/opportunities`),
        axios.get(`${API}/api/dashboard/movers`)
      ]);
      setStats(statsRes.data);
      setRecent(recentRes.data);
      setOpportunities(oppsRes.data);
      setMovers(moversRes.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" />
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="space-y-6 pb-8" data-testid="dashboard-home">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Overview of your FlipSlab operation</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="p-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#3b82f6]/50 transition-colors"
          data-testid="dashboard-refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Est. Value" value={formatPrice(s.estimated_value || 0)} sub={`${s.interested_listings || 0} tracked items`} color="bg-emerald-600" delay={0} />
        <KpiCard icon={Layers} label="Cards Scanned" value={s.total_cards || 0} sub={`${s.high_grade_cards || 0} graded PSA 8+`} color="bg-[#3b82f6]" delay={1} />
        <KpiCard icon={Tag} label="eBay Listings" value={s.total_listings || 0} sub={`${s.new_listings || 0} new this cycle`} color="bg-amber-600" delay={2} />
        <KpiCard icon={Zap} label="Opportunities" value={s.flip_opportunities || 0} sub={`${s.watchlist_count || 0} cards in watchlist`} color="bg-purple-600" delay={3} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recently Scanned - Takes 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#3b82f6]" />
              <h2 className="text-sm font-semibold text-white">Recently Scanned</h2>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('flipfinder')}
              className="text-[10px] uppercase tracking-widest text-[#3b82f6] hover:text-[#60a5fa] font-medium"
              data-testid="view-all-scanned"
            >
              View All
            </button>
          </div>
          <div className="p-3">
            {recent.length === 0 ? (
              <div className="text-center py-8">
                <Eye className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No cards scanned yet</p>
                <button
                  onClick={() => onNavigate && onNavigate('flipfinder')}
                  className="mt-2 text-xs text-[#3b82f6] hover:text-[#60a5fa]"
                >
                  Scan your first card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {recent.map((card, i) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                    className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden hover:border-[#2a2a2a] transition-colors cursor-pointer group"
                    data-testid={`recent-card-${i}`}
                  >
                    {card.front_image_preview && (
                      <div className="aspect-[3/4] bg-[#0a0a0a] overflow-hidden">
                        <img
                          src={`data:image/jpeg;base64,${card.front_image_preview}`}
                          alt={card.card_name || 'Card'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-[11px] font-medium text-white truncate">{card.card_name || 'Unknown Card'}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs font-bold ${
                          (card.grading_result?.overall_grade || 0) >= 8 ? 'text-emerald-400' :
                          (card.grading_result?.overall_grade || 0) >= 6 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          PSA {card.grading_result?.overall_grade || '?'}
                        </span>
                        <span className="text-[10px] text-gray-600">{formatDate(card.created_at)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Market Movers - 1 col */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-white">Price Movers</h2>
            </div>
          </div>
          <div className="p-2">
            {movers.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No price data yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Add cards to your watchlist to track prices</p>
              </div>
            ) : (
              <div className="space-y-1">
                {movers.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                    data-testid={`mover-${i}`}
                  >
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[#1a1a1a] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{m.search_query}</p>
                      <p className="text-[10px] text-gray-500">{m.listings_count} listings</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-white">${m.latest_price}</p>
                      <div className={`flex items-center gap-0.5 justify-end ${
                        m.price_change_pct > 0 ? 'text-emerald-400' : m.price_change_pct < 0 ? 'text-red-400' : 'text-gray-500'
                      }`}>
                        {m.price_change_pct > 0 ? <ArrowUpRight className="w-3 h-3" /> : 
                         m.price_change_pct < 0 ? <ArrowDownRight className="w-3 h-3" /> : 
                         <Minus className="w-3 h-3" />}
                        <span className="text-[10px] font-medium">{Math.abs(m.price_change_pct)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Flip Opportunities */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Flip Opportunities</h2>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('flipfinder')}
            className="text-[10px] uppercase tracking-widest text-[#3b82f6] hover:text-[#60a5fa] font-medium"
            data-testid="view-all-opportunities"
          >
            Monitor
          </button>
        </div>
        <div className="p-3">
          {opportunities.length === 0 ? (
            <div className="text-center py-6">
              <Zap className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No flip opportunities found yet</p>
              <p className="text-[10px] text-gray-600 mt-1">Use the eBay Monitor to find deals</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {opportunities.slice(0, 5).map((opp, i) => (
                <a
                  key={opp.id || i}
                  href={opp.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg hover:border-purple-500/30 transition-colors group"
                  data-testid={`opportunity-${i}`}
                >
                  {opp.image_url ? (
                    <img src={opp.image_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[#1a1a1a] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white truncate">{opp.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-bold text-emerald-400">{opp.price}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500 uppercase">{opp.listing_type}</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400 flex-shrink-0 transition-colors" />
                </a>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardHome;
