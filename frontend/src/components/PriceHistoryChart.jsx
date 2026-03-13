import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, RefreshCw, ExternalLink, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, Cell
} from 'recharts';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (v) => { const n = parseFloat(v); return isNaN(n) ? '-' : n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(2)}`; };

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs shadow-xl max-w-xs">
      <p className="text-white font-bold mb-0.5">${d?.price?.toFixed(2)}</p>
      <p className="text-gray-400 text-[10px]">{d?.date}</p>
      {d?.title && <p className="text-gray-500 text-[9px] mt-0.5 truncate">{d.title}</p>}
    </div>
  );
};

const PriceHistoryChart = ({ card, query }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildQuery = () => {
    if (query) return query;
    if (!card) return '';
    const parts = [];
    if (card.year) parts.push(String(card.year));
    if (card.set_name) parts.push(card.set_name);
    if (card.player) parts.push(card.player);
    if (card.card_number) {
      const cn = card.card_number;
      parts.push(cn.startsWith('#') ? cn : `#${cn}`);
    }
    if (card.condition === 'Graded' && card.grading_company && card.grade) {
      parts.push(`${card.grading_company} ${card.grade}`);
    }
    return parts.join(' ') || card.card_name || '';
  };

  const fetchHistory = async () => {
    const q = buildQuery();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/api/market/card-value`, { params: { query: q } });
      const items = res.data?.primary?.items || [];
      // Transform to chart data
      const chartData = items
        .filter(item => item.sold_price && item.sold_date)
        .map(item => ({
          date: item.sold_date,
          price: parseFloat(item.sold_price),
          title: item.title,
          url: item.url,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setData({
        chartData,
        stats: res.data?.primary?.stats || {},
        query: q,
        dataSource: res.data?.data_source,
      });
    } catch (err) {
      setError('Failed to fetch price history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [card?.id, query]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <RefreshCw className="w-5 h-5 text-[#3b82f6] animate-spin" />
      <span className="text-xs text-gray-500 ml-2">Loading price history...</span>
    </div>
  );

  if (error) return (
    <div className="text-center py-6 text-xs text-gray-500">{error}</div>
  );

  if (!data || data.chartData.length === 0) return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 text-center">
      <BarChart3 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
      <p className="text-xs text-gray-500">No sales data available for price history</p>
      <button onClick={fetchHistory} className="mt-2 text-[10px] text-[#3b82f6] hover:underline">Try again</button>
    </div>
  );

  const { chartData, stats } = data;
  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const latestPrice = chartData[chartData.length - 1]?.price || 0;
  const oldestPrice = chartData[0]?.price || 0;
  const trend = latestPrice - oldestPrice;
  const trendPct = oldestPrice > 0 ? ((trend / oldestPrice) * 100) : 0;
  const TrendIcon = trend >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="space-y-3" data-testid="price-history-chart">
      {/* Stats strip */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] border border-[#1a1a1a]">
          <DollarSign className="w-3 h-3 text-[#3b82f6]" />
          <span className="text-[10px] text-gray-500">Median</span>
          <span className="text-xs font-bold text-white">{fmt(stats.median)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] border border-[#1a1a1a]">
          <BarChart3 className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500">Range</span>
          <span className="text-xs font-bold text-white">{fmt(minPrice)} — {fmt(maxPrice)}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${trend >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <TrendIcon className={`w-3 h-3 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
          <span className="text-[10px] text-gray-500">Trend</span>
          <span className={`text-xs font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trend >= 0 ? '+' : ''}{trendPct.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] border border-[#1a1a1a]">
          <span className="text-[10px] text-gray-500">Sales</span>
          <span className="text-xs font-bold text-white">{stats.count || chartData.length}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#3b82f6]" /> Recent Sales
          </h4>
          <button onClick={fetchHistory} className="text-[9px] text-gray-500 hover:text-[#3b82f6] transition-colors flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" /> Refresh
          </button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} tickFormatter={d => d?.slice(5)} />
            <YAxis tick={{ fill: '#666', fontSize: 9 }} tickFormatter={v => `$${v}`} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="price" stroke="#3b82f6" fill="url(#priceGrad)" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', stroke: '#0a0a0a', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent sales list */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1a1a1a]">
          <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Recent Sold</h4>
        </div>
        <div className="divide-y divide-[#0a0a0a] max-h-48 overflow-y-auto">
          {chartData.slice(-10).reverse().map((item, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-2 hover:bg-white/[0.02]" data-testid={`sale-item-${i}`}>
              <span className="text-xs font-bold text-white w-16">{fmt(item.price)}</span>
              <span className="text-[10px] text-gray-500 w-20">{item.date}</span>
              <span className="text-[9px] text-gray-600 flex-1 truncate">{item.title}</span>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#3b82f6]">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PriceHistoryChart;
