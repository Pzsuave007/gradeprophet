import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight,
  RefreshCw, BarChart3, Package, Zap, ChevronRight, LayoutGrid, List
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const API = process.env.REACT_APP_BACKEND_URL;

const fmt = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '$0';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
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

const PortfolioTracker = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [viewMode, setViewMode] = useState('grid');
  const abortRef = useRef(false);

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API}/api/portfolio/summary`);
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSummary(); }, []);

  const refreshAllValues = async () => {
    if (!data?.cards?.length) return;
    setRefreshing(true);
    abortRef.current = false;
    const cards = data.cards;
    setProgress({ current: 0, total: cards.length });

    for (let i = 0; i < cards.length; i++) {
      if (abortRef.current) break;
      try {
        await axios.post(`${API}/api/portfolio/refresh-value/${cards[i].id}`);
      } catch {}
      setProgress({ current: i + 1, total: cards.length });
    }

    // Save snapshot after refresh
    try { await axios.post(`${API}/api/portfolio/snapshot`); } catch {}

    setRefreshing(false);
    toast.success('Portfolio values updated!');
    fetchSummary();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" />
    </div>
  );

  if (!data) return null;

  const pnlColor = data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlBg = data.pnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20';
  const PnlIcon = data.pnl >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="space-y-4" data-testid="portfolio-tracker">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Portfolio Value', value: fmt(data.total_market_value), icon: DollarSign, color: 'bg-[#3b82f6]', sub: `${data.valued_cards}/${data.total_cards} valued` },
          { label: 'Total Invested', value: fmt(data.total_invested), icon: Package, color: 'bg-amber-600', sub: `${data.total_cards} cards` },
          { label: 'P&L', value: `${data.pnl >= 0 ? '+' : ''}${fmt(data.pnl)}`, icon: TrendingUp, color: data.pnl >= 0 ? 'bg-emerald-600' : 'bg-red-600', sub: `${data.roi >= 0 ? '+' : ''}${data.roi}% ROI` },
          { label: 'Avg Card Value', value: data.valued_cards > 0 ? fmt(data.total_market_value / data.valued_cards) : '-', icon: BarChart3, color: 'bg-purple-600', sub: data.unvalued_cards > 0 ? `${data.unvalued_cards} need refresh` : 'All valued' },
        ].map(({ label, value, icon: Icon, color, sub }, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-600">{label}</span>
            </div>
            <p className="text-xl font-bold text-white" data-testid={`portfolio-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Refresh button + progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data.valued_cards > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${pnlBg}`}>
              <PnlIcon className={`w-3.5 h-3.5 ${pnlColor}`} />
              <span className={`text-xs font-bold ${pnlColor}`}>{data.pnl >= 0 ? '+' : ''}{fmt(data.pnl)}</span>
              <span className="text-[10px] text-gray-500">({data.roi >= 0 ? '+' : ''}{data.roi}%)</span>
            </div>
          )}
        </div>
        <button onClick={refreshing ? () => { abortRef.current = true; } : refreshAllValues}
          disabled={!data.cards.length}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${refreshing ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'}`}
          data-testid="refresh-portfolio-btn">
          {refreshing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Stop ({progress.current}/{progress.total})</>
            : <><Zap className="w-3.5 h-3.5" /> Refresh All Values</>}
        </button>
      </div>

      {refreshing && (
        <div className="w-full bg-[#0a0a0a] rounded-full h-1.5 overflow-hidden">
          <motion.div className="h-full bg-[#3b82f6] rounded-full" animate={{ width: `${(progress.current / progress.total) * 100}%` }} />
        </div>
      )}

      {/* Value Trend Chart */}
      {data.snapshots?.length > 1 && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#3b82f6]" /> Portfolio Value Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.snapshots}>
              <defs>
                <linearGradient id="portValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="portInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
              <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="total_market_value" name="Market Value" stroke="#3b82f6" fill="url(#portValue)" strokeWidth={2} />
              <Area type="monotone" dataKey="total_invested" name="Invested" stroke="#f59e0b" fill="url(#portInvested)" strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cards with values - Grid/List toggle */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Card Values</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">{data.valued_cards} of {data.total_cards} valued</span>
            <div className="flex bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] p-0.5" data-testid="portfolio-view-toggle">
              <button onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white'}`}
                data-testid="portfolio-view-grid-btn">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white'}`}
                data-testid="portfolio-view-list-btn">
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {data.cards.slice(0, 20).map((card, i) => {
              const pnl = card.market_value && card.purchase_price ? card.market_value - card.purchase_price : null;
              return (
                <motion.div key={card.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#2a2a2a] transition-colors group"
                  data-testid={`portfolio-card-grid-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-gray-600 font-mono">#{i + 1}</span>
                    {pnl !== null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-white truncate mb-0.5" title={card.card_name}>{card.card_name}</p>
                  <p className="text-[9px] text-gray-500 truncate">{card.player} {card.year || ''}</p>
                  <p className="text-[9px] text-gray-600 mb-2">{card.condition === 'Graded' ? `${card.grading_company} ${card.grade}` : 'Raw'}</p>
                  <div className="flex items-end justify-between pt-2 border-t border-[#1a1a1a]">
                    <div>
                      <p className="text-[8px] text-gray-600 uppercase tracking-wider">Market</p>
                      <p className="text-sm font-bold text-white">{card.market_value > 0 ? fmt(card.market_value) : '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-gray-600 uppercase tracking-wider">Cost</p>
                      <p className="text-[10px] text-gray-400">{fmt(card.purchase_price)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {data.cards.length === 0 && (
              <div className="col-span-full px-4 py-8 text-center text-sm text-gray-500">No cards in collection</div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {data.cards.slice(0, 20).map((card, i) => {
              const pnl = card.market_value && card.purchase_price ? card.market_value - card.purchase_price : null;
              return (
                <div key={card.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors" data-testid={`portfolio-card-${i}`}>
                  <span className="text-[10px] text-gray-600 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{card.card_name}</p>
                    <p className="text-[10px] text-gray-500">{card.player} {card.year || ''} {card.condition === 'Graded' ? `${card.grading_company} ${card.grade}` : 'Raw'}</p>
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <p className="text-xs font-bold text-white">{card.market_value > 0 ? fmt(card.market_value) : '-'}</p>
                    <p className="text-[9px] text-gray-600">Cost: {fmt(card.purchase_price)}</p>
                  </div>
                  {pnl !== null && (
                    <div className={`text-right flex-shrink-0 w-16 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      <p className="text-[10px] font-bold">{pnl >= 0 ? '+' : ''}{fmt(pnl)}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {data.cards.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No cards in collection</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioTracker;
