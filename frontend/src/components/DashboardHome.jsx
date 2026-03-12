import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  BarChart3, RefreshCw, Package, Tag, ShoppingBag,
  Clock, Award, Zap, ChevronRight, ExternalLink
} from 'lucide-react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
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

const parseTimeLeft = (iso) => {
  if (!iso) return '';
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const d = parseInt(m[1] || 0), h = parseInt(m[2] || 0);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h`;
  return '<1h';
};

// Custom tooltip for area chart
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

const DashboardHome = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [ebayData, setEbayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [analytics, listings] = await Promise.all([
        axios.get(`${API}/api/dashboard/analytics`),
        axios.get(`${API}/api/ebay/seller/my-listings?limit=50`),
      ]);
      setData(analytics.data);
      setEbayData(listings.data);
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredSales = useMemo(() => {
    if (!data?.sales?.timeline) return [];
    if (dateRange === 'all') return data.sales.timeline;
    const now = new Date();
    const days = { '30d': 30, '90d': 90, '180d': 180 }[dateRange] || 9999;
    const cutoff = new Date(now - days * 86400000).toISOString().slice(0, 10);
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
        <p className="text-xs text-gray-600">Loading your analytics...</p>
      </div>
    );
  }

  const s = data?.sales || {};
  const inv = data?.inventory || {};
  const lst = data?.listings || {};
  const eb = ebayData || { active: [], sold: [] };

  return (
    <div className="space-y-5 pb-8" data-testid="dashboard-home">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">FlipSlab HQ</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your trading command center</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date filter */}
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

      {/* === MAIN CHART: Revenue / Profit over time === */}
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
        {/* === MONTHLY REVENUE BARS === */}
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

        {/* === INVENTORY BY SPORT PIE === */}
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
                  {inv.by_sport.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SPORT_COLORS[s.name] || '#6b7280' }} />
                      <span className="text-[10px] text-gray-400 flex-1">{s.name}</span>
                      <span className="text-[10px] font-bold text-white">{s.count}</span>
                      <span className="text-[10px] text-gray-600">{fmt(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full text-gray-600 text-xs">Add cards to inventory</div>
            )}
          </div>
        </motion.div>

        {/* === TOP PLAYERS === */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === RECENT SALES TABLE (2 cols) === */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="recent-sales">
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

        {/* === ENDING SOON + TOP SALE (1 col) === */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="space-y-4">
          {/* Top Sale */}
          {s.top_sale && (
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4" data-testid="top-sale">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Best Sale</span>
              </div>
              <p className="text-2xl font-black text-amber-400">{fmt(s.top_sale.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1 truncate">{s.top_sale.title}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{s.top_sale.date}</p>
            </div>
          )}

          {/* Ending Soon */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="ending-soon">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
              <Clock className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white">Ending Soon</h2>
            </div>
            <div className="divide-y divide-[#0f0f0f]">
              {(lst.ending_soon || []).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02]" data-testid={`ending-${i}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 truncate">{item.title}</p>
                  </div>
                  <span className="text-[10px] font-bold text-white flex-shrink-0">{fmt(item.price)}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold flex-shrink-0">{parseTimeLeft(item.time_left)}</span>
                </div>
              ))}
              {!(lst.ending_soon || []).length && (
                <div className="text-center py-4 text-gray-600 text-xs">No listings ending soon</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onNavigate?.('inventory')} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#3b82f6]/50 transition-colors text-left" data-testid="quick-inventory">
              <Package className="w-4 h-4 text-amber-400 mb-1" />
              <p className="text-[10px] font-bold text-white">Inventory</p>
              <p className="text-[9px] text-gray-600">{inv.total_items} cards</p>
            </button>
            <button onClick={() => onNavigate?.('listings')} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#3b82f6]/50 transition-colors text-left" data-testid="quick-listings">
              <Tag className="w-4 h-4 text-[#3b82f6] mb-1" />
              <p className="text-[10px] font-bold text-white">Listings</p>
              <p className="text-[9px] text-gray-600">{lst.active_count} active</p>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardHome;
