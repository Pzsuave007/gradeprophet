import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Layers, Tag, Zap, TrendingUp,
  Clock, ArrowUpRight, ArrowDownRight, Minus, ExternalLink,
  BarChart3, Eye, RefreshCw, Package, Award, ShoppingBag,
  Heart, Search, ArrowRight
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const formatPrice = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '$0';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
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

const SectionHeader = ({ icon: Icon, title, color, onViewMore, testId }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
    </div>
    {onViewMore && (
      <button onClick={onViewMore}
        className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#3b82f6] hover:text-[#60a5fa] font-medium transition-colors"
        data-testid={testId}>
        View More <ArrowRight className="w-3 h-3" />
      </button>
    )}
  </div>
);

const KpiCard = ({ icon: Icon, label, value, sub, color, delay }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.08, duration: 0.35 }}
    className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4.5 h-4.5 text-white" /></div>
      <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white tracking-tight" data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </motion.div>
);

const DashboardHome = ({ onNavigate }) => {
  const [invStats, setInvStats] = useState(null);
  const [invRecent, setInvRecent] = useState([]);
  const [movers, setMovers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [invStatsRes, invRecentRes, moversRes, oppsRes] = await Promise.all([
        axios.get(`${API}/api/inventory/stats`),
        axios.get(`${API}/api/inventory?limit=6&sort_by=created_at&sort_dir=desc`),
        axios.get(`${API}/api/dashboard/movers`),
        axios.get(`${API}/api/dashboard/opportunities`),
      ]);
      setInvStats(invStatsRes.data);
      setInvRecent(invRecentRes.data.items || []);
      setMovers(moversRes.data);
      setOpportunities(oppsRes.data);
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (<div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>);
  }

  const s = invStats || {};

  return (
    <div className="space-y-6 pb-8" data-testid="dashboard-home">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Overview of your FlipSlab operation</p>
        </div>
        <button onClick={fetchDashboard} className="p-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#3b82f6]/50 transition-colors" data-testid="dashboard-refresh">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* KPI Grid - Inventory focused */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="My Cards" value={s.total_quantity || 0} sub={`${s.collection_count || 0} collection, ${s.for_sale_count || 0} for sale`} color="bg-[#3b82f6]" delay={0} />
        <KpiCard icon={DollarSign} label="Invested" value={formatPrice(s.total_invested || 0)} sub={`Avg ${formatPrice(s.avg_price || 0)} per card`} color="bg-emerald-600" delay={1} />
        <KpiCard icon={Award} label="Graded" value={s.graded || 0} sub={`${s.raw || 0} raw cards`} color="bg-amber-600" delay={2} />
        <KpiCard icon={Tag} label="Listed" value={s.listed || 0} sub={`${s.not_listed || 0} not listed`} color="bg-purple-600" delay={3} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* SECTION: Inventory - Recent Cards (2 cols) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <SectionHeader icon={Layers} title="My Inventory" color="text-[#3b82f6]"
            onViewMore={() => onNavigate && onNavigate('inventory')} testId="view-more-inventory" />
          <div className="p-3">
            {invRecent.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No cards in inventory yet</p>
                <button onClick={() => onNavigate && onNavigate('inventory')} className="mt-2 text-xs text-[#3b82f6] hover:text-[#60a5fa]">Add your first card</button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {invRecent.slice(0, 5).map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors" data-testid={`dash-inv-${i}`}>
                    <div className="w-10 h-13 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                      {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-3 h-3 text-gray-700" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{item.card_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.player && <span className="text-[10px] text-gray-500">{item.player}</span>}
                        {item.category === 'for_sale' ? (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">Sale</span>
                        ) : (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] uppercase">Col</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {item.condition === 'Graded' && item.grade ? (
                        <span className="text-xs font-bold text-amber-400">{item.grading_company} {item.grade}</span>
                      ) : (
                        <span className="text-[10px] text-gray-600">Raw</span>
                      )}
                      {item.purchase_price > 0 && <p className="text-[10px] text-gray-500">${item.purchase_price}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* SECTION: Flip Finder - Price Movers (1 col) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl">
          <SectionHeader icon={BarChart3} title="Flip Finder - Movers" color="text-amber-500"
            onViewMore={() => onNavigate && onNavigate('flipfinder')} testId="view-more-flipfinder" />
          <div className="p-2">
            {movers.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No price data yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Monitor eBay in Flip Finder</p>
              </div>
            ) : (
              <div className="space-y-1">
                {movers.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors" data-testid={`mover-${i}`}>
                    {m.image_url ? <img src={m.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded bg-[#1a1a1a] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{m.search_query}</p>
                      <p className="text-[10px] text-gray-500">{m.listings_count} listings</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-white">${m.latest_price}</p>
                      <div className={`flex items-center gap-0.5 justify-end ${m.price_change_pct > 0 ? 'text-emerald-400' : m.price_change_pct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {m.price_change_pct > 0 ? <ArrowUpRight className="w-3 h-3" /> : m.price_change_pct < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
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

      {/* SECTION: Flip Opportunities */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl">
        <SectionHeader icon={Zap} title="Flip Finder - Opportunities" color="text-purple-400"
          onViewMore={() => onNavigate && onNavigate('flipfinder')} testId="view-more-opportunities" />
        <div className="p-3">
          {opportunities.length === 0 ? (
            <div className="text-center py-6">
              <Zap className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No flip opportunities found yet</p>
              <p className="text-[10px] text-gray-600 mt-1">Use the eBay Monitor in Flip Finder</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {opportunities.slice(0, 5).map((opp, i) => (
                <a key={opp.id || i} href={opp.listing_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg hover:border-purple-500/30 transition-colors group"
                  data-testid={`opportunity-${i}`}>
                  {opp.image_url ? <img src={opp.image_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" /> : <div className="w-12 h-12 rounded bg-[#1a1a1a] flex-shrink-0" />}
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
