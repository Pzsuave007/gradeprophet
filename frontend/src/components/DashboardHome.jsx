import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Layers, Tag, Zap, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus, ExternalLink,
  BarChart3, RefreshCw, Package, Award, ShoppingBag,
  Heart, ArrowRight, Clock, Eye, CheckCircle
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const formatPrice = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '$0';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
};

const parseTimeLeft = (iso) => {
  if (!iso) return 'N/A';
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const d = parseInt(m[1] || 0), h = parseInt(m[2] || 0), min = parseInt(m[3] || 0);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
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
  const [ebayData, setEbayData] = useState(null);
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        axios.get(`${API}/api/inventory/stats`),
        axios.get(`${API}/api/inventory?limit=6&sort_by=created_at&sort_dir=desc`),
        axios.get(`${API}/api/ebay/seller/my-listings?limit=50`),
        axios.get(`${API}/api/dashboard/movers`),
      ]);
      if (results[0].status === 'fulfilled') setInvStats(results[0].value.data);
      if (results[1].status === 'fulfilled') setInvRecent(results[1].value.data.items || []);
      if (results[2].status === 'fulfilled') setEbayData(results[2].value.data);
      if (results[3].status === 'fulfilled') setMovers(results[3].value.data);
    } catch (err) { console.error('Dashboard fetch error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (<div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-[#3b82f6] animate-spin" /></div>);
  }

  const s = invStats || {};
  const eb = ebayData || { active: [], sold: [], active_total: 0, sold_total: 0 };
  const totalEbayValue = eb.active.reduce((sum, i) => sum + (i.price || 0), 0);
  const totalSoldValue = eb.sold.reduce((sum, i) => sum + (i.price || 0), 0);

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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Tag} label="Active Listings" value={eb.active_total} sub={`${formatPrice(totalEbayValue)} total value`} color="bg-[#3b82f6]" delay={0} />
        <KpiCard icon={DollarSign} label="Sold" value={eb.sold_total} sub={`${formatPrice(totalSoldValue)} in sales`} color="bg-emerald-600" delay={1} />
        <KpiCard icon={Package} label="Inventory" value={s.total_quantity || 0} sub={`${s.collection_count || 0} col, ${s.for_sale_count || 0} for sale`} color="bg-amber-600" delay={2} />
        <KpiCard icon={DollarSign} label="Invested" value={formatPrice(s.total_invested || 0)} sub={`${s.graded || 0} graded, ${s.raw || 0} raw`} color="bg-purple-600" delay={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SECTION: Active eBay Listings (2 cols) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-xl">
          <SectionHeader icon={Tag} title={`eBay Listings (${eb.active_total})`} color="text-[#3b82f6]"
            onViewMore={() => onNavigate && onNavigate('listings')} testId="view-more-listings" />
          <div className="p-2">
            {eb.active.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No active listings</p>
                <p className="text-[10px] text-gray-600 mt-1">Connect your eBay account in Settings</p>
              </div>
            ) : (
              <div className="space-y-px">
                {eb.active.slice(0, 8).map((item, i) => (
                  <a key={item.item_id} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors group"
                    data-testid={`ebay-listing-${i}`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#1a1a1a] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate group-hover:text-[#3b82f6] transition-colors">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gray-500 uppercase">{item.listing_type === 'FixedPriceItem' ? 'Buy Now' : 'Auction'}</span>
                        {item.watch_count > 0 && <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{item.watch_count}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-400">${item.price}</p>
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-[10px]">{parseTimeLeft(item.time_left)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* SECTION: Recent Sales (1 col) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl">
          <SectionHeader icon={CheckCircle} title={`Recent Sales (${eb.sold_total})`} color="text-emerald-400" />
          <div className="p-2">
            {eb.sold.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No recent sales</p>
              </div>
            ) : (
              <div className="space-y-px">
                {eb.sold.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors" data-testid={`sold-item-${i}`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[#1a1a1a] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{item.title}</p>
                      {item.buyer && <p className="text-[10px] text-gray-600">Buyer: {item.buyer}</p>}
                    </div>
                    <span className="text-sm font-bold text-emerald-400 flex-shrink-0">${item.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SECTION: My Inventory */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl">
          <SectionHeader icon={Layers} title="My Inventory" color="text-amber-500"
            onViewMore={() => onNavigate && onNavigate('inventory')} testId="view-more-inventory" />
          <div className="p-2">
            {invRecent.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No cards in inventory</p>
                <button onClick={() => onNavigate && onNavigate('inventory')} className="mt-2 text-xs text-[#3b82f6] hover:text-[#60a5fa]">Add your first card</button>
              </div>
            ) : (
              <div className="space-y-px">
                {invRecent.slice(0, 5).map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors" data-testid={`dash-inv-${i}`}>
                    <div className="w-9 h-12 rounded bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                      {item.image ? <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-3 h-3 text-gray-700" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{item.card_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.category === 'for_sale' ? <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">Sale</span> : <span className="text-[8px] px-1 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] uppercase">Col</span>}
                        {item.condition === 'Graded' && item.grade && <span className="text-[10px] text-amber-400">{item.grading_company} {item.grade}</span>}
                      </div>
                    </div>
                    {item.purchase_price > 0 && <span className="text-xs font-medium text-gray-400">${item.purchase_price}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* SECTION: Flip Finder - Movers */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-[#111] border border-[#1a1a1a] rounded-xl">
          <SectionHeader icon={BarChart3} title="Flip Finder - Movers" color="text-purple-400"
            onViewMore={() => onNavigate && onNavigate('flipfinder')} testId="view-more-flipfinder" />
          <div className="p-2">
            {movers.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No price data yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Monitor eBay in Flip Finder</p>
              </div>
            ) : (
              <div className="space-y-px">
                {movers.slice(0, 5).map((m, i) => (
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
    </div>
  );
};

export default DashboardHome;
