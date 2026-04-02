import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp,
  BarChart3, RefreshCw, Package, Tag, ShoppingBag,
  Award, Zap, ChevronRight, ExternalLink, Wallet,
  Crosshair, Eye, Target, Activity,
  Search, ArrowRight, X, Newspaper, User as UserIcon, Lock, Gauge
} from 'lucide-react';
import axios from 'axios';
import { usePlan } from '../hooks/usePlan';
import UpgradeGate from './UpgradeGate';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
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
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: ${p.value?.toFixed(2)}</p>
      ))}
    </div>
  );
};

// Parse ISO 8601 duration to ms
function parseDuration(iso) {
  if (!iso) return 0;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return ((parseInt(m[1]||0)*24 + parseInt(m[2]||0))*3600 + parseInt(m[3]||0)*60 + parseInt(m[4]||0))*1000;
}

function formatDuration(iso) {
  const ms = parseDuration(iso);
  if (!ms) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h/24)}d ${h%24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Live countdown from ISO date
const LiveCountdown = ({ endTime }) => {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setText('ENDED'); return; }
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
      setUrgent(diff < 300000);
      setText(h > 24 ? `${Math.floor(h/24)}d ${h%24}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endTime]);
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${urgent ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/10 text-white/70'}`}>
      {text}
    </span>
  );
};

// ========================
// VISUAL CARD GRID ITEM
// ========================
const CardGridItem = ({ image, title, price, subtitle, badge, badgeColor, link, countdown, onClick, testId }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="group relative bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-all hover:shadow-lg hover:shadow-black/20 cursor-pointer"
    onClick={onClick}
    data-testid={testId}
  >
    {/* Image */}
    <div className="relative aspect-square bg-[#0a0a0a] overflow-hidden">
      {image ? (
        <img src={image} alt={title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-800" /></div>
      )}
      {/* Price overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-6">
        <p className="text-base font-black text-white">{typeof price === 'number' ? fmt(price) : price}</p>
      </div>
      {/* Badge */}
      {badge && (
        <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeColor || 'bg-[#3b82f6]/90 text-white'}`}>
          {badge}
        </div>
      )}
      {/* Countdown */}
      {countdown && (
        <div className="absolute top-2 right-2">{countdown}</div>
      )}
      {/* Link icon on hover */}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 p-2 rounded-lg transition-opacity">
          <ExternalLink className="w-4 h-4 text-white" />
        </a>
      )}
    </div>
    {/* Info */}
    <div className="p-3">
      <p className="text-xs font-semibold text-white truncate leading-tight">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-500 mt-1 truncate">{subtitle}</p>}
    </div>
  </motion.div>
);

// ========================
// SALE DETAIL MODAL
// ========================
const SaleDetailModal = ({ sale, onClose }) => {
  if (!sale) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose} data-testid="sale-detail-modal">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}>
          {/* Image */}
          <div className="relative aspect-square bg-[#0a0a0a] max-h-[300px]">
            {sale.image ? (
              <img src={sale.image} alt={sale.title} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-800" /></div>
            )}
            <button onClick={onClose} className="absolute top-3 right-3 bg-black/60 p-1.5 rounded-full hover:bg-black/80 transition-colors" data-testid="close-sale-modal">
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/90 text-white">Sold</span>
            </div>
          </div>

          {/* Details */}
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white leading-snug">{sale.title}</h3>
              <p className="text-2xl font-black text-emerald-400 mt-1">{fmt(sale.total)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Sold Date</p>
                <p className="text-xs font-semibold text-white">{sale.date || 'N/A'}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">Buyer</p>
                <div className="flex items-center gap-1.5">
                  <UserIcon className="w-3 h-3 text-gray-500" />
                  <p className="text-xs font-semibold text-white truncate">{sale.buyer || 'N/A'}</p>
                </div>
              </div>
            </div>

            {sale.item_id && (
              <div className="bg-[#0a0a0a] rounded-lg p-3">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">eBay Item ID</p>
                <p className="text-xs font-mono text-gray-400">{sale.item_id}</p>
              </div>
            )}

            <a href={sale.url || `https://www.ebay.com/itm/${sale.item_id}`} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-bold transition-colors"
              data-testid="sale-view-on-ebay">
              <ExternalLink className="w-4 h-4" /> View on eBay
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ========================
// HOBBY NEWS FEED
// ========================
const HobbyNewsFeed = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/dashboard/hobby-news`)
      .then(res => setArticles(res.data?.articles || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 flex items-center justify-center gap-2">
      <RefreshCw className="w-4 h-4 text-gray-600 animate-spin" />
      <span className="text-xs text-gray-600">Loading hobby news...</span>
    </div>
  );

  if (!articles.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="hobby-news-feed">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Hobby Pulse</h2>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">Latest News</span>
      </div>
      <div className="divide-y divide-[#0f0f0f] max-h-[400px] overflow-y-auto">
        {articles.map((article, i) => (
          <a key={i} href={article.link} target="_blank" rel="noreferrer"
            className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/[0.02] transition-colors group"
            data-testid={`news-article-${i}`}>
            {/* Thumbnail */}
            <div className="w-11 h-11 rounded-lg bg-[#0a0a0a] overflow-hidden flex-shrink-0">
              {article.thumbnail ? (
                <img src={article.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Newspaper className="w-4 h-4 text-gray-800" /></div>
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-[10px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-[#3b82f6] transition-colors">{article.title}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8px] text-cyan-400 font-bold truncate">{article.source}</span>
                {article.published && (
                  <span className="text-[8px] text-gray-600 flex-shrink-0">{new Date(article.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </motion.div>
  );
};

const PLAN_LABELS = { rookie: 'Rookie', mvp: 'MVP', hall_of_famer: 'Hall of Famer', all_star: 'MVP', hall_of_fame: 'MVP', legend: 'Hall of Famer' };
const PLAN_COLORS = { rookie: '#6b7280', mvp: '#f59e0b', hall_of_famer: '#a855f7', all_star: '#f59e0b', hall_of_fame: '#f59e0b', legend: '#a855f7' };

const PlanUsageBanner = ({ getUsage, planId, onUpgrade }) => {
  const inv = getUsage('inventory');
  const scans = getUsage('scans_per_month');
  const listings = getUsage('listings');

  const meters = [
    { label: 'Inventory', current: inv.current, limit: inv.limit, unlimited: inv.unlimited, icon: Package, color: '#f59e0b' },
    { label: 'AI Scans', current: scans.current, limit: scans.limit, unlimited: scans.unlimited, icon: Zap, color: '#3b82f6' },
    { label: 'Listings', current: listings.current, limit: listings.limit, unlimited: listings.unlimited, icon: Tag, color: '#10b981' },
  ];

  const planColor = PLAN_COLORS[planId] || '#6b7280';
  const isLegend = planId === 'legend';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4"
      data-testid="plan-usage-banner"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4" style={{ color: planColor }} />
          <span className="text-xs font-bold text-white">Plan Usage</span>
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${planColor}20`, color: planColor }}>
            {PLAN_LABELS[planId] || 'Rookie'}
          </span>
        </div>
        {!isLegend && (
          <button onClick={onUpgrade}
            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            data-testid="usage-upgrade-btn">
            Upgrade <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {meters.map(({ label, current, limit, unlimited, icon: Icon, color }) => {
          const pct = unlimited ? 100 : limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
          const isNear = !unlimited && limit > 0 && pct >= 80;
          const isFull = !unlimited && limit > 0 && current >= limit;
          const barColor = isFull ? '#ef4444' : isNear ? '#f59e0b' : color;
          return (
            <div key={label} className="space-y-1.5" data-testid={`usage-meter-${label.toLowerCase().replace(/\s/g, '-')}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3" style={{ color: barColor }} />
                  <span className="text-[10px] font-semibold text-gray-400">{label}</span>
                </div>
                <span className="text-[10px] font-bold" style={{ color: isFull ? '#ef4444' : 'white' }}>
                  {unlimited ? 'Unlimited' : `${current}/${limit}`}
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: unlimited ? '100%' : `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: unlimited ? `linear-gradient(90deg, ${color}60, ${color})` : barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const DashboardHome = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [ccData, setCcData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [dashTab, setDashTab] = useState('command');
  const [selectedSale, setSelectedSale] = useState(null);
  const { hasFeature, getUsage, planId } = usePlan();
  const hasDashboardFull = hasFeature('dashboard_full');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [analytics, cc] = await Promise.all([
        axios.get(`${API}/api/dashboard/analytics`),
        axios.get(`${API}/api/dashboard/command-center`),
      ]);
      setData(analytics.data);
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
      running += s.total; runProfit += s.profit;
      return { date: s.date.slice(5), revenue: +running.toFixed(2), profit: +runProfit.toFixed(2) };
    });
  }, [filteredSales]);

  const filteredStats = useMemo(() => {
    const rev = filteredSales.reduce((a, s) => a + s.total, 0);
    const fees = filteredSales.reduce((a, s) => a + s.fee, 0);
    return { revenue: rev, fees, profit: rev - fees, count: filteredSales.length, avg: filteredSales.length ? rev / filteredSales.length : 0 };
  }, [filteredSales]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="relative"><RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin" /></div>
        <p className="text-xs text-gray-600">Loading your command center...</p>
      </div>
    );
  }

  const s = data?.sales || {};
  const inv = data?.inventory || {};
  const lst = data?.listings || {};

  return (
    <div className="space-y-5 pb-8" data-testid="dashboard-home">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">FlipSlab HQ</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your trading command center</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden" data-testid="date-range-filter">
            {['30d','90d','180d','all'].map(r => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-2.5 sm:px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold transition-all ${dateRange === r ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white'}`}
                data-testid={`filter-${r}`}>{r === 'all' ? 'All' : r}</button>
            ))}
          </div>
          <button onClick={fetchAll} className="p-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#3b82f6]/50 transition-colors" data-testid="dashboard-refresh">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Plan Usage Banner */}
      <PlanUsageBanner getUsage={getUsage} planId={planId} onUpgrade={() => onNavigate?.('account')} />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide" data-testid="dashboard-tabs">
        {[
          { id: 'command', label: 'Command Center', icon: Activity, locked: false },
          { id: 'overview', label: 'Sales Overview', icon: TrendingUp, locked: !hasDashboardFull },
        ].map(({ id, label, icon: Icon, locked }) => (
          <button key={id} onClick={() => { if (!locked) setDashTab(id); }}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
              locked ? 'bg-[#111] text-gray-700 border border-[#1a1a1a] cursor-not-allowed' :
              dashTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
            }`} data-testid={`dash-tab-${id}`}>
            {locked && <Lock className="w-3 h-3" />}
            <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {dashTab === 'command' && <CommandCenterTab cc={ccData} analytics={data} filteredStats={filteredStats} onNavigate={onNavigate} onSelectSale={setSelectedSale} onSwitchTab={setDashTab} />}
      {dashTab === 'overview' && (
        hasDashboardFull ? (
          <SalesOverviewTab filteredStats={filteredStats} filteredCumulative={filteredCumulative} s={s} inv={inv} lst={lst} onNavigate={onNavigate} />
        ) : (
          <UpgradeGate locked={true} planRequired="mvp" featureName="Sales Overview" onUpgrade={() => onNavigate?.('account')}>
            <div className="h-64 bg-[#111] border border-[#1a1a1a] rounded-xl" />
          </UpgradeGate>
        )
      )}

      {/* Sale Detail Modal */}
      {selectedSale && <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
    </div>
  );
};


// ========================
// COMMAND CENTER TAB
// ========================
const CommandCenterTab = ({ cc, analytics, filteredStats, onNavigate, onSelectSale, onSwitchTab }) => {
  const recentSales = cc?.recent_sales || [];
  const monitorItems = cc?.monitor?.recent_items || [];
  const activeSnipes = cc?.snipes?.active || [];
  const snipeStats = cc?.snipes?.stats || {};
  const lsSummary = cc?.listings_summary || {};
  const s = analytics?.sales || {};

  const handleKpiClick = (label) => {
    if (label === 'Total Revenue' || label === 'Net Profit') onSwitchTab?.('overview');
    else if (label === 'Active Listings') onNavigate?.('listings');
    else if (label === 'Alerts') onNavigate?.('flipfinder');
  };

  return (
    <>
      {/* #1 — KPI Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: 'Total Revenue', value: fmt(filteredStats.revenue), sub: `${filteredStats.count} sales`, color: 'from-emerald-600/20 to-emerald-900/5', border: 'border-emerald-500/20', accent: 'text-emerald-400', iconBg: 'bg-emerald-500' },
          { icon: TrendingUp, label: 'Net Profit', value: fmt(filteredStats.profit), sub: `${fmt(filteredStats.fees)} fees`, color: 'from-blue-600/20 to-blue-900/5', border: 'border-blue-500/20', accent: 'text-blue-400', iconBg: 'bg-blue-500' },
          { icon: Tag, label: 'Active Listings', value: lsSummary.active_count || 0, sub: `${fmt(lsSummary.active_value)} value`, color: 'from-amber-600/20 to-amber-900/5', border: 'border-amber-500/20', accent: 'text-amber-400', iconBg: 'bg-amber-500' },
          { icon: Crosshair, label: 'Alerts', value: `${snipeStats.won || 0}W / ${snipeStats.lost || 0}L`, sub: `${snipeStats.active || 0} active`, color: 'from-red-600/20 to-red-900/5', border: 'border-red-500/20', accent: 'text-red-400', iconBg: 'bg-red-500' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            onClick={() => handleKpiClick(kpi.label)}
            className={`relative bg-gradient-to-br ${kpi.color} border ${kpi.border} rounded-xl p-4 overflow-hidden cursor-pointer hover:brightness-110 transition-all`} data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s/g, '-')}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.iconBg}`}><kpi.icon className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-black ${kpi.accent}`}>{kpi.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* #2 — AUCTION ALERTS as visual cards + RIGHT COLUMN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2" data-testid="active-alerts-panel">
          <SectionHeader icon={Crosshair} color="text-red-400" title="Auction Alerts" count={activeSnipes.length}
            action={{ label: 'Alerts', onClick: () => onNavigate?.('flipfinder') }} />
          {activeSnipes.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {activeSnipes.map((snipe, i) => {
                const itemId = snipe.ebay_item_id?.split('|')[1] || snipe.ebay_item_id;
                const ebayUrl = `https://www.ebay.com/itm/${itemId}`;
                return (
                  <div key={snipe.id}
                    className="group relative bg-gradient-to-br from-red-600/10 via-[#111] to-[#0a0a0a] border border-red-500/15 rounded-xl overflow-hidden hover:border-red-500/30 transition-all"
                    data-testid={`snipe-card-${i}`}>
                    {/* Image */}
                    <div className="relative aspect-square bg-[#0a0a0a] overflow-hidden">
                      {snipe.item_image_url ? (
                        <img src={snipe.item_image_url} alt="" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Crosshair className="w-8 h-8 text-gray-800" /></div>
                      )}
                      {/* Price overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 pt-8">
                        <div className="flex items-center justify-between">
                          <p className="text-base font-black text-white">{fmt(snipe.current_price)}</p>
                          <LiveCountdown endTime={snipe.auction_end_time} />
                        </div>
                      </div>
                      {/* Status badge */}
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/90 text-white">
                        Armed
                      </div>
                    </div>
                    {/* Info + Actions */}
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-white truncate">{snipe.item_title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Max: <span className="text-emerald-400 font-bold">{fmt(snipe.max_bid)}</span></span>
                        <a href={ebayUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[10px] font-bold transition-colors"
                          data-testid={`snipe-ebay-btn-${i}`}>
                          <ExternalLink className="w-3 h-3" /> eBay
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyGrid message="No active alerts" cta="Arm an alert in Flip Finder" onAction={() => onNavigate?.('flipfinder')} icon={Crosshair} />
          )}
        </motion.div>

        {/* Right Column */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
          {s.top_sale && (
            <div className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/20 rounded-xl p-4" data-testid="top-sale">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Best Sale</span>
              </div>
              <p className="text-3xl font-black text-amber-400">{fmt(s.top_sale.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1 truncate">{s.top_sale.title}</p>
            </div>
          )}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4" data-testid="snipe-record">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Alert Record</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-black text-emerald-400">{snipeStats.won || 0}</p><p className="text-[9px] text-gray-500">Won</p></div>
              <div><p className="text-lg font-black text-red-400">{snipeStats.lost || 0}</p><p className="text-[9px] text-gray-500">Lost</p></div>
              <div><p className="text-lg font-black text-white">{snipeStats.total || 0}</p><p className="text-[9px] text-gray-500">Total</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Package, label: 'Inventory', sub: `${cc?.inventory_count || 0} cards`, nav: 'inventory', color: 'text-amber-400' },
              { icon: Search, label: 'Flip Finder', sub: `${cc?.monitor?.watchlist_count || 0} watching`, nav: 'flipfinder', color: 'text-blue-400' },
            ].map(q => (
              <button key={q.nav} onClick={() => onNavigate?.(q.nav)}
                className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors text-left" data-testid={`quick-${q.nav}`}>
                <q.icon className={`w-4 h-4 ${q.color} mb-1`} />
                <p className="text-[10px] font-bold text-white">{q.label}</p>
                <p className="text-[9px] text-gray-600">{q.sub}</p>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* #3 — MONITOR FEED + HOBBY NEWS (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monitor Feed - left 2 cols */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="lg:col-span-2" data-testid="monitor-feed-grid">
          <SectionHeader icon={Eye} color="text-purple-400" title="Monitor Feed" count={cc?.monitor?.total}
            action={{ label: 'Flip Finder', onClick: () => onNavigate?.('flipfinder') }}
            extra={cc?.monitor?.new_count > 0 ? <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold">{cc.monitor.new_count} new</span> : null}
          />
          {monitorItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {monitorItems.map((item, i) => (
                <CardGridItem key={item.id || i}
                  image={item.image_url}
                  title={item.title}
                  price={item.price}
                  subtitle={item.search_query}
                  badge={item.listing_type === 'auction' ? 'Auction' : item.accepts_offers ? 'Offers' : 'BIN'}
                  badgeColor={item.listing_type === 'auction' ? 'bg-amber-500/90 text-white' : 'bg-blue-500/90 text-white'}
                  onClick={() => onNavigate?.('flipfinder')}
                  testId={`monitor-item-${i}`}
                />
              ))}
            </div>
          ) : (
            <EmptyGrid message="No monitor items yet" cta="Set up a watchlist search" onAction={() => onNavigate?.('flipfinder')} icon={Search} />
          )}
        </motion.div>

        {/* Hobby News - right 1 col */}
        <HobbyNewsFeed />
      </div>

      {/* #4 — RECENT SALES GRID (Ending Soon style: compact 6-col) */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        data-testid="recent-sales-grid">
        <SectionHeader icon={DollarSign} color="text-emerald-400" title="Recent Sales" count={filteredStats.count}
          action={{ label: 'View All', onClick: () => onNavigate?.('listings') }} />
        {recentSales.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {recentSales.slice(0, 6).map((sale, i) => (
              <CardGridItem key={i}
                image={sale.image}
                title={sale.title}
                price={sale.total}
                subtitle={`${sale.date} · ${sale.buyer}`}
                badge="Sold"
                badgeColor="bg-emerald-500/90 text-white"
                onClick={() => onSelectSale?.(sale)}
                testId={`recent-sale-${i}`}
              />
            ))}
          </div>
        ) : (
          <EmptyGrid message="No sales yet" cta="View Listings" onAction={() => onNavigate?.('listings')} icon={DollarSign} />
        )}
      </motion.div>
    </>
  );
};
// ========================
const SectionHeader = ({ icon: Icon, color, title, count, action, extra }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {count != null && count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 font-bold">{count}</span>}
      {extra}
    </div>
    {action && (
      <button onClick={action.onClick} className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] font-bold uppercase tracking-wider flex items-center gap-1" data-testid={`goto-${title.toLowerCase().replace(/\s/g, '-')}`}>
        {action.label} <ChevronRight className="w-3 h-3" />
      </button>
    )}
  </div>
);

// ========================
// Empty Grid Placeholder
// ========================
const EmptyGrid = ({ message, cta, onAction, icon: Icon }) => (
  <div className="bg-[#111] border border-[#1a1a1a] rounded-xl flex flex-col items-center justify-center py-10 gap-2">
    <Icon className="w-6 h-6 text-gray-700" />
    <p className="text-xs text-gray-600">{message}</p>
    {cta && (
      <button onClick={onAction} className="text-[10px] text-[#3b82f6] hover:underline font-semibold flex items-center gap-1">
        {cta} <ArrowRight className="w-3 h-3" />
      </button>
    )}
  </div>
);


// ========================
// SALES OVERVIEW TAB
// ========================
const SalesOverviewTab = ({ filteredStats, filteredCumulative, s, inv, lst, onNavigate }) => (
  <>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
        <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /><h2 className="text-sm font-bold text-white">Sales Performance</h2></div>
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
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
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
      {/* Monthly */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="monthly-chart">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]"><BarChart3 className="w-4 h-4 text-amber-400" /><h2 className="text-sm font-bold text-white">Monthly Revenue</h2></div>
        <div className="p-3" style={{ height: 220 }}>
          {(s.monthly_chart || []).length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.monthly_chart} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" /><XAxis dataKey="month" stroke="#444" tick={{ fontSize: 9 }} /><YAxis stroke="#444" tick={{ fontSize: 9 }} tickFormatter={v => `$${v}`} />
                <Tooltip content={<ChartTooltip />} /><Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]} /><Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-gray-600 text-xs">No monthly data</div>}
        </div>
      </motion.div>

      {/* By Sport */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="sport-chart">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]"><Award className="w-4 h-4 text-purple-400" /><h2 className="text-sm font-bold text-white">By Sport</h2></div>
        <div className="p-3 flex items-center" style={{ height: 220 }}>
          {(inv.by_sport || []).length > 0 ? (
            <div className="flex items-center w-full gap-3">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={inv.by_sport} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                    {inv.by_sport.map(e => <Cell key={e.name} fill={SPORT_COLORS[e.name] || '#6b7280'} />)}
                  </Pie><Tooltip formatter={v => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2">
                {inv.by_sport.map(sp => (
                  <div key={sp.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SPORT_COLORS[sp.name] || '#6b7280' }} />
                    <span className="text-[10px] text-gray-400 flex-1">{sp.name}</span>
                    <span className="text-[10px] font-bold text-white">{sp.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="flex items-center justify-center w-full text-gray-600 text-xs">Add cards to inventory</div>}
        </div>
      </motion.div>

      {/* Top Players */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="player-chart">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]"><ShoppingBag className="w-4 h-4 text-[#3b82f6]" /><h2 className="text-sm font-bold text-white">Top Players</h2></div>
        <div className="p-3" style={{ height: 220 }}>
          {(inv.by_player || []).length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inv.by_player} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} /><XAxis type="number" stroke="#444" tick={{ fontSize: 9 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" stroke="#444" tick={{ fontSize: 9 }} width={80} /><Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Value" fill="#3b82f6" radius={[0,4,4,0]}>{(inv.by_player || []).map((_, i) => <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#3b82f6' : '#6366f1'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-gray-600 text-xs">Add cards to inventory</div>}
        </div>
      </motion.div>
    </div>

    {/* Recent Sales */}
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
      className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="recent-sales">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /><h2 className="text-sm font-bold text-white">Recent Sales</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">{s.total_orders}</span></div>
        <button onClick={() => onNavigate?.('listings')} className="text-[10px] text-[#3b82f6] hover:text-[#60a5fa] font-bold uppercase tracking-wider flex items-center gap-1" data-testid="view-more-sales">View All <ChevronRight className="w-3 h-3" /></button>
      </div>
      <div className="divide-y divide-[#0f0f0f]">
        {(s.timeline || []).slice().reverse().slice(0, 8).map((sale, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors" data-testid={`sale-row-${i}`}>
            <div className="w-6 text-center"><span className="text-[9px] font-bold text-gray-600">{i+1}</span></div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">{sale.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-gray-600">{sale.date}</span><span className="text-[9px] text-gray-700">|</span><span className="text-[9px] text-gray-600">{sale.buyer}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-black text-emerald-400">{fmt(sale.total)}</p>
              <p className="text-[9px] text-gray-600">profit {fmt(sale.profit)}</p>
            </div>
          </div>
        ))}
        {!s.timeline?.length && <div className="text-center py-8 text-gray-600 text-xs">No sales yet</div>}
      </div>
    </motion.div>
  </>
);

export default DashboardHome;
