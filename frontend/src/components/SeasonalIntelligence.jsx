import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Thermometer, Calendar,
  ChevronDown, ChevronUp, ArrowRight, Flame, Snowflake, Sun,
  ExternalLink, ShoppingCart, Loader2
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// ===== SEASONAL DATA ENGINE =====
const SPORTS = [
  {
    name: 'Basketball',
    abbr: 'NBA',
    color: '#f59e0b',
    // Month index 0-11: 0=Jan, 11=Dec
    // Signal: 1=BUY(cold), 2=WARMING, 3=HOT(sell)
    cycle: [3, 3, 3, 3, 3, 2, 1, 1, 1, 2, 3, 3],
    buyMonths: 'Jun - Sep',
    sellMonths: 'Oct - May',
    reason: {
      buy: 'Post-Finals cooldown. Prices at their lowest — stock up on stars & rookies.',
      sell: 'Regular season & playoffs fuel demand. Star performances drive prices up.',
      warming: 'Season approaching or winding down. Prices shifting — watch closely.',
    },
    keyEvents: [
      { month: 9, label: 'Season Starts' },
      { month: 1, label: 'All-Star Weekend' },
      { month: 3, label: 'Playoffs Begin' },
      { month: 5, label: 'NBA Finals' },
    ],
  },
  {
    name: 'Football',
    abbr: 'NFL',
    color: '#10b981',
    cycle: [3, 3, 1, 1, 1, 1, 2, 3, 3, 3, 3, 3],
    buyMonths: 'Mar - Jun',
    sellMonths: 'Aug - Feb',
    reason: {
      buy: 'Post-Super Bowl & pre-draft lull. Best prices for rookies & veterans.',
      sell: 'Season in full swing. Fantasy football + playoffs = peak demand.',
      warming: 'Draft hype or offseason transition. Prices starting to move.',
    },
    keyEvents: [
      { month: 1, label: 'Super Bowl' },
      { month: 3, label: 'NFL Draft' },
      { month: 8, label: 'Season Starts' },
      { month: 0, label: 'Playoffs' },
    ],
  },
  {
    name: 'Baseball',
    abbr: 'MLB',
    color: '#3b82f6',
    cycle: [1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    buyMonths: 'Oct - Feb',
    sellMonths: 'Mar - Oct',
    reason: {
      buy: 'Post-World Series hibernation. Cards sit unsold — time to buy low.',
      sell: 'Spring training through World Series. Demand peaks mid-summer & October.',
      warming: 'Spring training hype building. New releases hitting the market.',
    },
    keyEvents: [
      { month: 2, label: 'Spring Training' },
      { month: 3, label: 'Opening Day' },
      { month: 6, label: 'All-Star Game' },
      { month: 9, label: 'World Series' },
    ],
  },
  {
    name: 'Hockey',
    abbr: 'NHL',
    color: '#06b6d4',
    cycle: [3, 3, 3, 3, 3, 2, 1, 1, 2, 3, 3, 3],
    buyMonths: 'Jun - Aug',
    sellMonths: 'Oct - May',
    reason: {
      buy: 'Post-Stanley Cup summer lull. Lowest entry point for hockey cards.',
      sell: 'Regular season & Stanley Cup chase. Young Guns rookies drive the market.',
      warming: 'Pre-season buzz building. Training camp generates rookie excitement.',
    },
    keyEvents: [
      { month: 9, label: 'Season Starts' },
      { month: 3, label: 'Playoffs Begin' },
      { month: 5, label: 'Stanley Cup Finals' },
    ],
  },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const UPCOMING_RELEASES_2026 = [
  { date: 'Mar 4', name: 'Upper Deck Series 2 Hockey', sport: 'Hockey', color: '#06b6d4' },
  { date: 'Mar 6', name: 'Leaf Optichrome Baseball', sport: 'Baseball', color: '#3b82f6' },
  { date: 'Mar 27', name: 'Panini Silhouette Football', sport: 'Football', color: '#10b981' },
  { date: 'Apr 1', name: 'WNBA Prizm', sport: 'Basketball', color: '#f59e0b' },
  { date: 'Apr 15', name: 'Topps Series 2 Baseball', sport: 'Baseball', color: '#3b82f6' },
  { date: 'May 7', name: 'Bowman Chrome Baseball', sport: 'Baseball', color: '#3b82f6' },
  { date: 'Jun 4', name: 'Panini Prizm Football Draft', sport: 'Football', color: '#10b981' },
  { date: 'Sep 10', name: 'Topps Football', sport: 'Football', color: '#10b981' },
  { date: 'Oct 1', name: 'Topps Chrome Basketball', sport: 'Basketball', color: '#f59e0b' },
  { date: 'Oct 15', name: 'Panini Prizm Basketball', sport: 'Basketball', color: '#f59e0b' },
];

const getSignalInfo = (signal) => {
  if (signal === 3) return { label: 'SELL', sublabel: 'Prices High', icon: Flame, bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', text: '#ef4444', glow: 'rgba(239,68,68,0.15)' };
  if (signal === 2) return { label: 'WATCH', sublabel: 'Shifting', icon: Sun, bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', glow: 'rgba(245,158,11,0.15)' };
  return { label: 'BUY', sublabel: 'Prices Low', icon: Snowflake, bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: '#22c55e', glow: 'rgba(34,197,94,0.15)' };
};

const getBarColor = (signal) => {
  if (signal === 3) return '#ef4444';
  if (signal === 2) return '#f59e0b';
  return '#22c55e';
};

// ===== MARKET PULSE GAUGE =====
const PulseGauge = ({ sport, currentMonth }) => {
  const signal = sport.cycle[currentMonth];
  const info = getSignalInfo(signal);
  const Icon = info.icon;
  const reasonKey = signal === 3 ? 'sell' : signal === 1 ? 'buy' : 'warming';

  // Calculate gauge angle (0-180)
  const gaugeAngle = signal === 1 ? 30 : signal === 2 ? 90 : 150;
  const rad = (gaugeAngle * Math.PI) / 180;
  const needleX = 50 + 35 * Math.cos(Math.PI - rad);
  const needleY = 50 - 35 * Math.sin(Math.PI - rad);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] border rounded-xl p-4 relative overflow-hidden group hover:border-opacity-50 transition-all"
      style={{ borderColor: `${sport.color}30` }}
      data-testid={`pulse-${sport.abbr.toLowerCase()}`}
    >
      {/* Subtle glow */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl" style={{ background: info.glow }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${sport.color}20` }}>
            <span className="text-[10px] font-black" style={{ color: sport.color }}>{sport.abbr}</span>
          </div>
          <span className="text-xs font-bold text-white">{sport.name}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: info.bg, border: `1px solid ${info.border}` }}>
          <Icon className="w-3 h-3" style={{ color: info.text }} />
          <span className="text-[10px] font-black tracking-wider" style={{ color: info.text }}>{info.label}</span>
        </div>
      </div>

      {/* Mini Gauge SVG */}
      <div className="flex justify-center mb-2">
        <svg width="100" height="55" viewBox="0 0 100 55">
          {/* Background arc */}
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
          {/* Green zone */}
          <path d="M 10 50 A 40 40 0 0 1 30 14" fill="none" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
          {/* Yellow zone */}
          <path d="M 30 14 A 40 40 0 0 1 70 14" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
          {/* Red zone */}
          <path d="M 70 14 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" opacity="0.4" />
          {/* Needle */}
          <line x1="50" y1="50" x2={needleX} y2={needleY} stroke={info.text} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill={info.text} />
        </svg>
      </div>

      {/* Recommendation */}
      <p className="text-[10px] text-gray-400 leading-relaxed text-center">{sport.reason[reasonKey]}</p>

      {/* Buy/Sell months */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
        <div className="text-center flex-1">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider">Buy Window</p>
          <p className="text-[10px] font-bold text-emerald-400 mt-0.5">{sport.buyMonths}</p>
        </div>
        <div className="w-px h-6 bg-[#1a1a1a]" />
        <div className="text-center flex-1">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider">Sell Window</p>
          <p className="text-[10px] font-bold text-red-400 mt-0.5">{sport.sellMonths}</p>
        </div>
      </div>
    </motion.div>
  );
};

// ===== ACTION RECOMMENDATIONS =====
const ActionCard = ({ sport, signal, currentMonth }) => {
  const isBuy = signal === 1;
  const isSell = signal === 3;
  const actionColor = isBuy ? '#22c55e' : isSell ? '#ef4444' : '#f59e0b';
  const actionText = isBuy ? 'BUY' : isSell ? 'SELL' : 'HOLD';
  const actionIcon = isBuy ? TrendingDown : isSell ? TrendingUp : Sun;
  const Icon = actionIcon;

  const tips = {
    buy: [
      `${sport.name} cards are in their offseason dip.`,
      `Look for undervalued rookies and graded cards (PSA/BGS).`,
      `Stock up now — prices will rise when the season starts.`,
    ],
    sell: [
      `${sport.name} is in peak season — demand is high.`,
      `List your ${sport.name} cards now for maximum returns.`,
      `Star players performing well? Their cards are at peak value.`,
    ],
    hold: [
      `${sport.name} market is transitioning — watch for trends.`,
      `Hold valuable cards — prices may still move up.`,
      `Good time to research and plan your next moves.`,
    ],
  };

  const tipKey = isBuy ? 'buy' : isSell ? 'sell' : 'hold';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all"
      data-testid={`action-${sport.abbr.toLowerCase()}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${actionColor}15`, border: `1px solid ${actionColor}30` }}>
        <Icon className="w-5 h-5" style={{ color: actionColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider"
            style={{ background: `${actionColor}15`, color: actionColor }}>{actionText}</span>
          <span className="text-xs font-bold text-white">{sport.name}</span>
          <span className="text-[9px] text-gray-600 ml-auto">{sport.abbr}</span>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">{tips[tipKey][0]}</p>
        <p className="text-[10px] text-gray-600 mt-0.5">{tips[tipKey][1]}</p>
      </div>
    </motion.div>
  );
};

// ===== SEASON TIMELINE =====
const SeasonTimeline = ({ currentMonth }) => {
  return (
    <div className="space-y-3">
      {SPORTS.map((sport) => (
        <div key={sport.abbr} className="flex items-center gap-3" data-testid={`timeline-${sport.abbr.toLowerCase()}`}>
          {/* Sport label */}
          <div className="w-16 flex-shrink-0 text-right">
            <span className="text-[10px] font-bold" style={{ color: sport.color }}>{sport.abbr}</span>
          </div>
          {/* Timeline bars */}
          <div className="flex-1 flex gap-[2px] h-7 rounded-lg overflow-hidden">
            {sport.cycle.map((signal, monthIdx) => {
              const isCurrent = monthIdx === currentMonth;
              const barColor = getBarColor(signal);
              return (
                <div key={monthIdx} className="flex-1 relative group cursor-default flex items-end justify-center"
                  style={{
                    background: isCurrent ? barColor : `${barColor}30`,
                    borderBottom: isCurrent ? `3px solid white` : 'none',
                  }}>
                  <span className={`text-[7px] font-bold pb-0.5 ${isCurrent ? 'text-white' : 'text-transparent group-hover:text-gray-400'} transition-colors`}>
                    {MONTH_NAMES[monthIdx]}
                  </span>
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#222] text-[9px] text-white px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {MONTH_NAMES[monthIdx]}: {signal === 3 ? 'SELL' : signal === 1 ? 'BUY' : 'WATCH'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {/* Legend */}
      <div className="flex items-center justify-center gap-5 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#22c55e]" />
          <span className="text-[9px] text-gray-500 font-medium">BUY (Low prices)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#f59e0b]" />
          <span className="text-[9px] text-gray-500 font-medium">WATCH (Shifting)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#ef4444]" />
          <span className="text-[9px] text-gray-500 font-medium">SELL (High prices)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-3 rounded-sm border-b-2 border-white bg-gray-600" />
          <span className="text-[9px] text-gray-500 font-medium">You are here</span>
        </div>
      </div>
    </div>
  );
};

// ===== UPCOMING RELEASES =====
const UpcomingReleases = ({ currentMonth }) => {
  const upcoming = UPCOMING_RELEASES_2026.filter((r) => {
    const releaseMonth = new Date(`${r.date} 2026`).getMonth();
    return releaseMonth >= currentMonth;
  }).slice(0, 6);

  if (upcoming.length === 0) return null;

  return (
    <div className="space-y-2">
      {upcoming.map((release, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all"
          data-testid={`release-${i}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${release.color}15` }}>
            <Calendar className="w-4 h-4" style={{ color: release.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{release.name}</p>
            <p className="text-[9px] text-gray-600">{release.sport}</p>
          </div>
          <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">{release.date}</span>
        </motion.div>
      ))}
    </div>
  );
};

// ===== SEASONAL DEALS FROM EBAY =====
const SeasonalDeals = () => {
  const [deals, setDeals] = useState([]);
  const [buySports, setBuySports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const res = await axios.get(`${API}/api/market/seasonal-deals`);
        setDeals(res.data.deals || []);
        setBuySports(res.data.buy_sports || []);
      } catch (e) {
        console.warn('Seasonal deals fetch failed:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
        <span className="text-xs text-gray-600 ml-2">Loading deals...</span>
      </div>
    );
  }

  if (deals.length === 0) return null;

  const sportColor = { Basketball: '#f59e0b', Football: '#10b981', Baseball: '#3b82f6', Hockey: '#06b6d4' };

  return (
    <div className="space-y-2" data-testid="seasonal-deals">
      {deals.map((deal, i) => (
        <motion.a
          key={deal.item_id || i}
          href={deal.ebay_url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0d0d0d] border border-[#1a1a1a] hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition-all group cursor-pointer"
          data-testid={`deal-${i}`}
        >
          {/* Card image */}
          <div className="w-12 h-16 rounded-md overflow-hidden bg-[#1a1a1a] flex-shrink-0">
            {deal.image_url ? (
              <img src={deal.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-gray-700" />
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-300 font-medium truncate leading-tight">{deal.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${sportColor[deal.sport] || '#666'}15`, color: sportColor[deal.sport] || '#666' }}>
                {deal.sport}
              </span>
              {deal.condition && (
                <span className="text-[8px] text-gray-600 truncate">{deal.condition}</span>
              )}
            </div>
          </div>
          {/* Price + link */}
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-black text-emerald-400">{deal.price_value > 0 ? deal.price : 'Bid'}</p>
            <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-emerald-400 ml-auto mt-1 transition-colors" />
          </div>
        </motion.a>
      ))}
    </div>
  );
};

// ===== MAIN COMPONENT =====
const SeasonalIntelligence = () => {
  const [expanded, setExpanded] = useState(true);
  const currentMonth = useMemo(() => new Date().getMonth(), []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4" data-testid="seasonal-intelligence">

      {/* Section Header */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-red-500/20 flex items-center justify-center">
            <Thermometer className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">Seasonal Intelligence</h2>
            <p className="text-[10px] text-gray-600">
              {MONTH_FULL[currentMonth]} Market — Know when to buy & sell
            </p>
          </div>
        </div>
        <button className="p-1.5 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-colors"
          data-testid="toggle-seasonal">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
      </div>

      {expanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

          {/* 1. MARKET PULSE - 4 Gauges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SPORTS.map((sport) => (
              <PulseGauge key={sport.abbr} sport={sport} currentMonth={currentMonth} />
            ))}
          </div>

          {/* 2. WHAT TO DO RIGHT NOW + 3. TIMELINE + 4. RELEASES */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Left: Actions + Releases - 2 cols */}
            <div className="lg:col-span-2 space-y-4">
              {/* What To Do Right Now */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white">What To Do Right Now</h3>
                </div>
                <div className="p-3 space-y-2">
                  {SPORTS.map((sport) => (
                    <ActionCard key={sport.abbr} sport={sport} signal={sport.cycle[currentMonth]} currentMonth={currentMonth} />
                  ))}
                </div>
              </div>

              {/* Upcoming Releases */}
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <Calendar className="w-4 h-4 text-[#3b82f6]" />
                  <h3 className="text-xs font-bold text-white">Upcoming Releases</h3>
                  <span className="text-[9px] text-gray-600 ml-auto">2026</span>
                </div>
                <div className="p-3">
                  <UpcomingReleases currentMonth={currentMonth} />
                </div>
              </div>
            </div>

            {/* Right: Season Timeline + Seasonal Deals - 3 cols */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white">Season Calendar</h3>
                  <span className="text-[9px] text-gray-600 ml-auto">12-Month Cycle</span>
                </div>
                <div className="p-4">
                  <SeasonTimeline currentMonth={currentMonth} />
                  {/* Key Events below timeline */}
                  <div className="mt-5 pt-4 border-t border-[#1a1a1a]">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-3">Key Events This Month</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SPORTS.flatMap(sport =>
                        sport.keyEvents
                          .filter(e => e.month === currentMonth)
                          .map(e => (
                            <div key={`${sport.abbr}-${e.label}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d0d0d]">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sport.color }} />
                              <span className="text-[10px] text-gray-400">
                                <span className="font-bold" style={{ color: sport.color }}>{sport.abbr}</span> — {e.label}
                              </span>
                            </div>
                          ))
                      )}
                      {SPORTS.every(sport => sport.keyEvents.every(e => e.month !== currentMonth)) && (
                        <p className="text-[10px] text-gray-600 col-span-2">No major events this month</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seasonal Deals from eBay */}
              <div className="bg-[#111] border border-emerald-500/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white">Buy Season Deals</h3>
                  <span className="text-[9px] text-emerald-400/60 ml-auto">Live from eBay</span>
                </div>
                <div className="p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <SeasonalDeals />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default SeasonalIntelligence;
