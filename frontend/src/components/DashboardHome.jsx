import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  BarChart3, RefreshCw, Package, Tag, ShoppingBag,
  Clock, Award, Zap, ChevronRight, ExternalLink, Wallet,
  Crosshair, Eye, Target, Activity, Timer, AlertCircle,
  Gavel, ShoppingCart, MessageSquare, Search
} from 'lucide-react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import PortfolioTracker from './PortfolioTracker';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '$0';
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
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: ${p.value?.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

// --- Snipe Countdown ---
const SnipeCountdown = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const end = new Date(endTime);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) { setTimeLeft('ENDED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setUrgent(diff < 300000);
      if (h > 24) setTimeLeft(`${Math.floor(h / 24)}d ${h % 24}h`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  return (
    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
      urgent ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-amber-500/10 text-amber-400'
    }`} data-testid="snipe-countdown">{timeLeft}</span>
  );
};

// --- Status Badge ---
const StatusBadge = ({ status }) => {
  const map = {
    scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Scheduled' },
    monitoring: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Monitoring' },
    bidding: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Bidding!' },
    won: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Won' },
    lost: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Lost' },
  };
  const s = map[status] || map.scheduled;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

const DashboardHome = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [ebayData, setEbayData] = useState(null);
  const [ccData, setCcData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [dashTab, setDashTab] = useState('command');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [analytics, listings, cc] = await Promise.all([
        axios.get(`${API}/api/dashboard/analytics`),
        axios.get(`${API}/api/ebay/seller/my-listings?limit=50`).catch(() => ({ data: { active: [], sold: [] } })),
        axios.get(`${API}/api/dashboard/command-center`),
      ]);
      setData(analytics.data);
      setEbayData(listings.data);
      setCcData(cc.data);
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredSales = useMemo(() => {
    if (!data?.sales?.timeline) return [];
    if (dateRange === 'all') return data.sales.timeline;
    const days = { '30d': 30, '90d': 90, '180d': 180 }[dateRange] || 9999;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return data.sales.timeline.filter(s => s.date >= cutoff);
  }, [data, dateRange]);

  const filteredCumulative = useMemo(() => {
    if (!filteredSales.length) return [];
    let running = 0, runProfit = 0;
    return filteredSales.map(s => {
      running += s.total;
      runProfit += s.profit;
      return { date: s.date.slice(5), revenue: +running.toFixed(2), profit: +runProfit.toFixed(2), sale: s.total };
    });
  }, [filteredSales]);

  const filteredStats = useMemo(() => {
    const rev = filteredSales.reduce((a, s) => a + s.total, 0);
    const fees = filteredSales.reduce((a, s) => a + s.fee, 0);
    return {
      revenue: rev, fees, profit: rev - fees,
      count: filteredSales.length,
      avg: filteredSales.length ? rev / filteredSales.length : 0,
    };
  }, [filteredSales]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin" />
        <p className="text-xs text-gray-600">Loading command center...</p>
      </div>
    );
  }

  const s = data?.sales || {};
  const inv = data?.inventory || {};
  const lst = data?.listings || {};
  const cc = ccData || { snipes: { active: [], stats: {} }, monitor: {}, recent_actions: [], inventory_count: 0 };
  const snipeStats = cc.snipes?.stats || {};

  return (
    <div className="space-y-5 pb-8" data-testid="dashboard-home">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">FlipSlab HQ</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your trading command center</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden" data-testid="date-range-filter">
            {['30d', '90d', '180d', 'all'].map(r => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold transition-all ${dateRange === r ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white'}`}
                data-testid={`filter-${r}`}>
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
          <button onClick={fetchAll} className="p-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#3b82f6]/50 transition-colors" data-testid="dashboard-refresh">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="flex gap-1" data-testid="dashboard-tabs">
        {[
          { id: 'command', label: 'Command Center', icon: Activity },
          { id: 'overview', label: 'Sales Overview', icon: TrendingUp },
          { id: 'portfolio', label: 'Portfolio Value', icon: Wallet },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setDashTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              dashTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
            }`}
            data-testid={`dash-tab-${id}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* TAB: Command Center */}
      {dashTab === 'command' && (
        <CommandCenterTab
          cc={cc}
          snipeStats={snipeStats}
          lst={lst}
          inv={inv}
          filteredStats={filteredStats}
          s={s}
          onNavigate={onNavigate}
        />
      )}

      {/* TAB: Portfolio */}
      {dashTab === 'portfolio' && <PortfolioTracker />}

      {/* TAB: Sales Overview */}
      {dashTab === 'overview' && (
        <SalesOverviewTab
          filteredStats={filteredStats}
          filteredCumulative={filteredCumulative}
          s={s}
          inv={inv}
          lst={lst}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};

// ========================
// COMMAND CENTER TAB
// ========================
const CommandCenterTab = ({ cc, snipeStats, lst, inv, filteredStats, s, onNavigate }) => {
  const activeSnipes = cc.snipes?.active || [];
  const monitorItems = cc.monitor?.recent_items || [];
  const recentActions = cc.recent_actions || [];

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { icon: Crosshair, label: 'Active Snipes', value: snipeStats.active || 0, sub: `${snipeStats.total || 0} total`, color: 'bg-red-600', accent: 'text-red-400' },
          { icon: Target, label: 'Snipes Won', value: snipeStats.won || 0, sub: `${snipeStats.lost || 0} lost`, color: 'bg-emerald-600', accent: 'text-emerald-400' },
          { icon: Eye, label: 'Monitor Items', value: cc.monitor?.total || 0, sub: `${cc.monitor?.new_count || 0} new`, color: 'bg-amber-600', accent: 'text-amber-400' },
          { icon: DollarSign, label: 'Revenue', value: fmt(filteredStats.revenue), sub: `${filteredStats.count} sales`, color: 'bg-[#3b82f6]', accent: 'text-[#3b82f6]' },
          { icon: Package, label: 'Inventory', value: cc.inventory_count || 0, sub: `${lst.active_count || 0} listed`, color: 'bg-purple-600', accent: 'text-purple-400' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3.5 hover:border-[#2a2a2a] transition-colors" data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s/g, '-')}`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}><kpi.icon className="w-4 h-4 text-white" /></div>
              <span className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">{kpi.label}</span>
            </div>
            <p className={`text-xl font-black ${kpi.accent}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-gray-600 mt-0.5">{kpi.sub}</p>}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === ACTIVE SNIPES PANEL (2 cols) === */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="active-snipes-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white">Active Snipes</h2>
              {activeSnipes.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">{activeSnipes.length}</span>
              )}
            </div>
            <button onClick={() => onNavigate?.('flipfinder')} className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] font-bold uppercase tracking-wider flex items-center gap-1" data-testid="goto-sniper">
              Sniper <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {activeSnipes.length > 0 ? (
            <div className="divide-y divide-[#0f0f0f]">
              {activeSnipes.map((snipe, i) => (
                <div key={snipe.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors" data-testid={`snipe-row-${i}`}>
                  {snipe.item_image_url && (
                    <img src={snipe.item_image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-[#0a0a0a] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white truncate">{snipe.item_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={snipe.status} />
                      <span className="text-[9px] text-gray-600">Max: {fmt(snipe.max_bid)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-sm font-black text-white">{fmt(snipe.current_price)}</p>
                    <SnipeCountdown endTime={snipe.auction_end_time} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Crosshair className="w-6 h-6 text-gray-700" />
              <p className="text-xs text-gray-600">No active snipes</p>
              <button onClick={() => onNavigate?.('flipfinder')} className="text-[10px] text-[#3b82f6] hover:underline font-semibold" data-testid="goto-sniper-empty">
                Go to Flip Finder to set one up
              </button>
            </div>
          )}
        </motion.div>

        {/* === RIGHT COLUMN: Snipe Stats + Quick Actions === */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="space-y-4">
          {/* Snipe Win Rate */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4" data-testid="snipe-win-rate">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Snipe Record</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-black text-emerald-400">{snipeStats.won || 0}</p>
                <p className="text-[9px] text-gray-500">Won</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-400">{snipeStats.lost || 0}</p>
                <p className="text-[9px] text-gray-500">Lost</p>
              </div>
              <div>
                <p className="text-lg font-black text-white">{snipeStats.total || 0}</p>
                <p className="text-[9px] text-gray-500">Total</p>
              </div>
            </div>
            {snipeStats.total > 0 && (
              <div className="mt-3">
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.round((snipeStats.won / snipeStats.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-500 mt-1 text-center">
                  {Math.round((snipeStats.won / snipeStats.total) * 100)}% win rate
                </p>
              </div>
            )}
          </div>

          {/* Best Sale */}
          {s.top_sale && (
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4" data-testid="top-sale">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Best Sale</span>
              </div>
              <p className="text-2xl font-black text-amber-400">{fmt(s.top_sale.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1 truncate">{s.top_sale.title}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onNavigate?.('inventory')} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#3b82f6]/50 transition-colors text-left" data-testid="quick-inventory">
              <Package className="w-4 h-4 text-amber-400 mb-1" />
              <p className="text-[10px] font-bold text-white">Inventory</p>
              <p className="text-[9px] text-gray-600">{cc.inventory_count} cards</p>
            </button>
            <button onClick={() => onNavigate?.('flipfinder')} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#3b82f6]/50 transition-colors text-left" data-testid="quick-flipfinder">
              <Search className="w-4 h-4 text-[#3b82f6] mb-1" />
              <p className="text-[10px] font-bold text-white">Flip Finder</p>
              <p className="text-[9px] text-gray-600">{cc.monitor?.watchlist_count || 0} watching</p>
            </button>
          </div>
        </motion.div>
      </div>

      {/* === BOTTOM ROW: Monitor Feed + Recent Actions === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monitor Feed */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="monitor-feed">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Monitor Feed</h2>
              {(cc.monitor?.new_count || 0) > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">{cc.monitor.new_count} new</span>
              )}
            </div>
            <button onClick={() => onNavigate?.('flipfinder')} className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] font-bold uppercase tracking-wider flex items-center gap-1" data-testid="goto-monitor">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {monitorItems.length > 0 ? (
            <div className="divide-y divide-[#0f0f0f] max-h-[320px] overflow-y-auto">
              {monitorItems.map((item, i) => (
                <div key={item.id || i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`monitor-item-${i}`}>
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="w-9 h-9 rounded object-cover bg-[#0a0a0a] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-white truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-gray-600">{item.search_query}</span>
                      {item.listing_type === 'auction' && <Gavel className="w-2.5 h-2.5 text-amber-400" />}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-white">{item.price}</p>
                    {item.bids != null && item.bids > 0 && (
                      <p className="text-[9px] text-gray-600">{item.bids} bids</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Eye className="w-6 h-6 text-gray-700" />
              <p className="text-xs text-gray-600">No monitor items yet</p>
              <button onClick={() => onNavigate?.('flipfinder')} className="text-[10px] text-[#3b82f6] hover:underline font-semibold" data-testid="goto-monitor-empty">
                Set up a watchlist search
              </button>
            </div>
          )}
        </motion.div>

        {/* Recent Actions (Purchases & Offers) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="recent-actions">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#3b82f6]" />
              <h2 className="text-sm font-bold text-white">Recent Actions</h2>
            </div>
          </div>
          {recentActions.length > 0 ? (
            <div className="divide-y divide-[#0f0f0f] max-h-[320px] overflow-y-auto">
              {recentActions.map((action, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`action-row-${i}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    action.action === 'buy_now' ? 'bg-emerald-500/10' : 'bg-[#3b82f6]/10'
                  }`}>
                    {action.action === 'buy_now'
                      ? <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                      : <MessageSquare className="w-3.5 h-3.5 text-[#3b82f6]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-white">
                      {action.action === 'buy_now' ? 'Buy Now' : 'Offer Sent'}
                    </p>
                    <p className="text-[9px] text-gray-600 truncate">Item: {action.ebay_item_id}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-white">{fmt(action.price)}</p>
                    <span className={`text-[9px] font-bold ${action.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {action.success ? 'OK' : 'Failed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Activity className="w-6 h-6 text-gray-700" />
              <p className="text-xs text-gray-600">No recent actions</p>
              <p className="text-[10px] text-gray-700">Buy Now and Offer actions will appear here</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* === Ending Soon === */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="ending-soon">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-white">Your Listings Ending Soon</h2>
          </div>
          <button onClick={() => onNavigate?.('listings')} className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] font-bold uppercase tracking-wider flex items-center gap-1" data-testid="goto-listings">
            All Listings <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {(lst.ending_soon || []).length > 0 ? (
          <div className="divide-y divide-[#0f0f0f]">
            {(lst.ending_soon || []).slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]" data-testid={`ending-${i}`}>
                <Timer className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 truncate">{item.title}</p>
                </div>
                <span className="text-[10px] font-bold text-white flex-shrink-0">{fmt(item.price)}</span>
                {item.time_left && <SnipeCountdown endTime={new Date(Date.now() + parseISO8601Duration(item.time_left)).toISOString()} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-600 text-xs">No listings ending soon</div>
        )}
      </motion.div>
    </>
  );
};

// Parse ISO 8601 duration to milliseconds
function parseISO8601Duration(iso) {
  if (!iso) return 0;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const d = parseInt(m[1] || 0), h = parseInt(m[2] || 0), min = parseInt(m[3] || 0), sec = parseInt(m[4] || 0);
  return ((d * 24 + h) * 3600 + min * 60 + sec) * 1000;
}

// ========================
// SALES OVERVIEW TAB
// ========================
const SalesOverviewTab = ({ filteredStats, filteredCumulative, s, inv, lst, onNavigate }) => (
  <>
    {/* KPI Strip */}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[
        { icon: DollarSign, label: 'Revenue', value: fmt(filteredStats.revenue), sub: `${filteredStats.count} sales`, color: 'bg-emerald-600', accent: 'text-emerald-400' },
        { icon: TrendingUp, label: 'Profit', value: fmt(filteredStats.profit), sub: `${fmt(filteredStats.fees)} in fees`, color: 'bg-[#3b82f6]', accent: 'text-[#3b82f6]' },
        { icon: Tag, label: 'Active', value: lst.active_count, sub: fmt(lst.active_value) + ' value', color: 'bg-amber-600', accent: 'text-amber-400' },
        { icon: Package, label: 'Inventory', value: inv.total_items, sub: fmt(inv.total_invested) + ' invested', color: 'bg-purple-600', accent: 'text-purple-400' },
        { icon: Zap, label: 'Avg Sale', value: fmt(filteredStats.avg), sub: s.top_sale ? `Top: ${fmt(s.top_sale.total)}` : '', color: 'bg-rose-600', accent: 'text-rose-400' },
      ].map((kpi, i) => (
        <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3.5 hover:border-[#2a2a2a] transition-colors" data-testid={`kpi-${kpi.label.toLowerCase()}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}><kpi.icon className="w-4 h-4 text-white" /></div>
            <span className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">{kpi.label}</span>
          </div>
          <p className={`text-xl font-black ${kpi.accent}`}>{kpi.value}</p>
          {kpi.sub && <p className="text-[10px] text-gray-600 mt-0.5">{kpi.sub}</p>}
        </motion.div>
      ))}
    </div>

    {/* Revenue Chart */}
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="revenue-chart">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Sales Performance</h2>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Revenue</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Profit</span>
        </div>
      </div>
      <div className="p-4" style={{ height: 280 }}>
        {filteredCumulative.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredCumulative} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
              <YAxis stroke="#444" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#gRev)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" fill="url(#gProfit)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">No sales data in selected range</div>
        )}
      </div>
    </motion.div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Monthly Revenue */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="monthly-chart">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Monthly Revenue</h2>
        </div>
        <div className="p-3" style={{ height: 220 }}>
          {(s.monthly_chart || []).length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.monthly_chart} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="month" stroke="#444" tick={{ fontSize: 9 }} />
                <YAxis stroke="#444" tick={{ fontSize: 9 }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-xs">No monthly data</div>
          )}
        </div>
      </motion.div>

      {/* By Sport */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="sport-chart">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
          <Award className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white">By Sport</h2>
        </div>
        <div className="p-3 flex items-center" style={{ height: 220 }}>
          {(inv.by_sport || []).length > 0 ? (
            <div className="flex items-center w-full gap-3">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={inv.by_sport} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                      {inv.by_sport.map((entry) => (
                        <Cell key={entry.name} fill={SPORT_COLORS[entry.name] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2">
                {inv.by_sport.map(sp => (
                  <div key={sp.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SPORT_COLORS[sp.name] || '#6b7280' }} />
                    <span className="text-[10px] text-gray-400 flex-1">{sp.name}</span>
                    <span className="text-[10px] font-bold text-white">{sp.count}</span>
                    <span className="text-[10px] text-gray-600">{fmt(sp.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full text-gray-600 text-xs">Add cards to inventory</div>
          )}
        </div>
      </motion.div>

      {/* Top Players */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="player-chart">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
          <ShoppingBag className="w-4 h-4 text-[#3b82f6]" />
          <h2 className="text-sm font-bold text-white">Top Players</h2>
        </div>
        <div className="p-3" style={{ height: 220 }}>
          {(inv.by_player || []).length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inv.by_player} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                <XAxis type="number" stroke="#444" tick={{ fontSize: 9 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" stroke="#444" tick={{ fontSize: 9 }} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {(inv.by_player || []).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#3b82f6' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-xs">Add cards to inventory</div>
          )}
        </div>
      </motion.div>
    </div>

    {/* Recent Sales */}
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="recent-sales">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Recent Sales</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">{s.total_orders}</span>
        </div>
        <button onClick={() => onNavigate?.('listings')} className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] font-bold uppercase tracking-wider flex items-center gap-1" data-testid="view-more-sales">
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="divide-y divide-[#0f0f0f]">
        {(s.timeline || []).slice().reverse().slice(0, 8).map((sale, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`sale-row-${i}`}>
            <div className="w-6 text-center">
              <span className="text-[9px] font-bold text-gray-600">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">{sale.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-gray-600">{sale.date}</span>
                <span className="text-[9px] text-gray-700">|</span>
                <span className="text-[9px] text-gray-600">{sale.buyer}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-black text-emerald-400">{fmt(sale.total)}</p>
              <p className="text-[9px] text-gray-600">profit {fmt(sale.profit)}</p>
            </div>
          </div>
        ))}
        {!s.timeline?.length && (
          <div className="text-center py-8 text-gray-600 text-xs">No sales yet</div>
        )}
      </div>
    </motion.div>
  </>
);

export default DashboardHome;
