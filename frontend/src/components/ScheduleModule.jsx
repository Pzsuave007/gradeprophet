import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Gavel, DollarSign, Package, Trash2, Plus, ChevronRight, AlertCircle, CheckCircle, Loader2, ArrowLeft, Search, X, Timer, Zap, Rocket, Edit2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import StrategyLauncher from './StrategyLauncher';

const API = process.env.REACT_APP_BACKEND_URL;

const AUCTION_DURATIONS = [
  { value: 'Days_1', label: '1 Day' },
  { value: 'Days_3', label: '3 Days' },
  { value: 'Days_5', label: '5 Days' },
  { value: 'Days_7', label: '7 Days' },
  { value: 'Days_10', label: '10 Days' },
];

const STATUS_STYLES = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Scheduled' },
  posted: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Posted' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
  cancelled: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Cancelled' },
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};
const formatTimeZones = (iso) => {
  if (!iso) return { pt: '', ct: '', et: '' };
  const d = new Date(iso);
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  const fmt = (offset) => {
    let h = (utcH + offset + 24) % 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${utcM.toString().padStart(2, '0')} ${ampm}`;
  };
  return { pt: fmt(-7), ct: fmt(-5), et: fmt(-4) };
};


const SHIPPING_OPTIONS_SCHED = [
  { id: 'FreeShipping', label: 'Free Shipping', cost: 0 },
  { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50 },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50 },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50 },
];

// ============ ADD TO SCHEDULE VIEW ============
const AddToScheduleView = ({ queueType, onBack, onAdded }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [config, setConfig] = useState({
    starting_bid: 0.99, reserve_price: '', buy_it_now: '',
    auction_duration: 'Days_7', price: '',
    shipping_option: 'PWEEnvelope', shipping_cost: 2.50,
    best_offer: true, post_hour: '19', post_minute: '00',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await axios.get(`${API}/api/inventory?category=for_sale&listed=false&limit=200`, { withCredentials: true });
        setCards(res.data.items || []);
      } catch { toast.error('Failed to load inventory'); }
      finally { setLoading(false); }
    };
    fetchCards();
  }, []);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const filtered = cards.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.player || '').toLowerCase().includes(q) || (c.set_name || '').toLowerCase().includes(q) || (c.card_name || '').toLowerCase().includes(q);
  });
  const selectAll = () => {
    const vis = filtered.map(c => c.id);
    if (vis.every(id => selected.includes(id))) setSelected(s => s.filter(id => !vis.includes(id)));
    else setSelected(s => [...new Set([...s, ...vis])]);
  };

  const handleSubmit = async () => {
    if (!selected.length) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/schedule/add-bulk`, {
        card_ids: selected, queue_type: queueType, ...config,
        starting_bid: parseFloat(config.starting_bid) || 0.99,
        reserve_price: config.reserve_price ? parseFloat(config.reserve_price) : null,
        buy_it_now: config.buy_it_now ? parseFloat(config.buy_it_now) : null,
        price: config.price ? parseFloat(config.price) : null,
        shipping_cost: parseFloat(config.shipping_cost) || 0,
        post_hour: parseInt(config.post_hour),
        post_minute: parseInt(config.post_minute),
      }, { withCredentials: true });
      toast.success(`${selected.length} card(s) scheduled!`);
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule');
    } finally { setSubmitting(false); }
  };

  const isAuction = queueType === 'auction';
  const inputCls = "w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30";
  const labelCls = "text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block";

  return (
    <div data-testid="add-to-schedule-view">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5" data-testid="schedule-back-btn"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            {isAuction ? <Gavel className="w-5 h-5 text-amber-400" /> : <DollarSign className="w-5 h-5 text-emerald-400" />}
            Schedule {isAuction ? 'Auctions' : 'Fixed Price'}
          </h2>
          <p className="text-[10px] text-gray-500">Select cards and configure posting settings</p>
        </div>
      </div>

      <div className="space-y-4 mb-5">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs font-bold text-white mb-3">{isAuction ? 'Auction Settings' : 'Pricing'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isAuction ? (<>
              <div><label className={labelCls}>Starting Bid</label><input type="number" step="0.01" value={config.starting_bid} onChange={e => setConfig(c => ({...c, starting_bid: e.target.value}))} className={inputCls} data-testid="starting-bid-input" /></div>
              <div><label className={labelCls}>Reserve Price</label><input type="number" step="0.01" value={config.reserve_price} onChange={e => setConfig(c => ({...c, reserve_price: e.target.value}))} placeholder="Optional" className={inputCls} data-testid="reserve-price-input" /></div>
              <div><label className={labelCls}>Buy It Now</label><input type="number" step="0.01" value={config.buy_it_now} onChange={e => setConfig(c => ({...c, buy_it_now: e.target.value}))} placeholder="Optional" className={inputCls} data-testid="buy-it-now-input" /></div>
              <div><label className={labelCls}>Duration</label>
                <select value={config.auction_duration} onChange={e => setConfig(c => ({...c, auction_duration: e.target.value}))} className={inputCls} data-testid="auction-duration-select">
                  {AUCTION_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select></div>
            </>) : (<>
              <div><label className={labelCls}>Price (blank = card value)</label><input type="number" step="0.01" value={config.price} onChange={e => setConfig(c => ({...c, price: e.target.value}))} placeholder="Auto" className={inputCls} data-testid="price-input" /></div>
              <div className="flex items-end pb-2"><label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${config.best_offer ? 'bg-emerald-500' : 'bg-[#333]'}`}
                  onClick={() => setConfig(c => ({...c, best_offer: !c.best_offer}))}><div className={`w-3 h-3 rounded-full bg-white transition-transform ${config.best_offer ? 'translate-x-4' : ''}`} /></div>
                <span className="text-xs text-gray-300">Best Offer</span>
              </label></div>
            </>)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs font-bold text-white mb-3">Post Time (Central)</p>
          <div className="flex items-center gap-3">
            <select value={config.post_hour} onChange={e => setConfig(c => ({...c, post_hour: e.target.value}))} className={inputCls + " w-32"} data-testid="schedule-post-hour">
              {[15,16,17,18,19,20,21,22].map(h => (<option key={h} value={h}>{h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}</option>))}
            </select>
            <select value={config.post_minute} onChange={e => setConfig(c => ({...c, post_minute: e.target.value}))} className={inputCls + " w-24"} data-testid="schedule-post-minute">
              {['00','15','30','45'].map(m => <option key={m} value={m}>:{m}</option>)}
            </select>
            <span className="text-xs text-gray-500 font-bold">CT</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">Cards will be spaced 10 min apart within each day</p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs font-bold text-white mb-3">Shipping</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SHIPPING_OPTIONS_SCHED.map(s => (
              <button key={s.id} onClick={() => setConfig(c => ({...c, shipping_option: s.id, shipping_cost: s.cost}))}
                className={`p-3 rounded-xl text-left transition-all border-2 ${config.shipping_option === s.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]'}`}
                data-testid={`schedule-ship-${s.id}`}>
                <p className={`text-xs font-bold ${config.shipping_option === s.id ? 'text-amber-400' : 'text-gray-400'}`}>{s.label}</p>
                <p className={`text-sm font-black mt-1 ${config.shipping_option === s.id ? 'text-white' : 'text-gray-500'}`}>{s.cost === 0 ? 'Free' : `$${s.cost.toFixed(2)}`}</p>
              </button>))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..." className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-white/10" data-testid="schedule-search" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-500" /></button>}
        </div>
        <button onClick={selectAll} className="text-xs text-amber-400 hover:text-amber-300 font-bold shrink-0" data-testid="select-all-btn">
          {filtered.length > 0 && filtered.every(c => selected.includes(c.id)) ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 max-h-[350px] overflow-y-auto pr-1">
          {filtered.map(c => {
            const sel = selected.includes(c.id);
            const img = c.thumbnail || c.store_thumbnail || c.image;
            return (
              <motion.div key={c.id} whileTap={{ scale: 0.97 }} onClick={() => toggle(c.id)}
                className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${sel ? 'border-amber-500/60 bg-amber-500/5' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.04]'}`}
                data-testid={`schedule-card-${c.id}`}>
                {img && <img src={`data:image/jpeg;base64,${img}`} alt={c.player} className="w-full aspect-[3/4] object-cover" />}
                {!img && <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center"><Package className="w-5 h-5 text-gray-700" /></div>}
                <div className="p-1">
                  <p className="text-[8px] font-bold text-white truncate">{c.player}</p>
                  <p className="text-[7px] text-gray-500 truncate">{c.year} {c.set_name}</p>
                </div>
                {sel && <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center"><CheckCircle className="w-2 h-2 text-black" /></div>}
              </motion.div>);
          })}
        </div>
      )}

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.04]">
        <p className="text-xs text-gray-500">{selected.length} card(s) selected</p>
        <button onClick={handleSubmit} disabled={!selected.length || submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black text-sm font-black disabled:opacity-30 hover:shadow-lg hover:shadow-amber-500/20 transition-shadow"
          data-testid="schedule-submit-btn">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
          Schedule {selected.length} Card{selected.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
};


// ============ MAIN SCHEDULE MODULE ============
const ScheduleModule = () => {
  const [tab, setTab] = useState('fixed_price');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState(null); // 'fixed_price' | 'auction' | null
  const [showStrategy, setShowStrategy] = useState(false);
  const [showBulkTime, setShowBulkTime] = useState(false);
  const [bulkHour, setBulkHour] = useState('19');
  const [bulkMinute, setBulkMinute] = useState('00');
  const [bulkTimeUpdating, setBulkTimeUpdating] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/schedule/queue`, { withCredentials: true });
      setPosts(res.data.posts || []);
    } catch { toast.error('Failed to load schedule'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const deletePost = async (id) => {
    try {
      await axios.delete(`${API}/api/schedule/${id}`, { withCredentials: true });
      setPosts(p => p.filter(x => x.id !== id));
      toast.success('Removed from schedule');
    } catch { toast.error('Failed to remove'); }
  };

  const clearQueue = async () => {
    try {
      const res = await axios.delete(`${API}/api/schedule/clear/${tab}`, { withCredentials: true });
      toast.success(`${res.data.deleted} post(s) cleared`);
      fetchQueue();
    } catch { toast.error('Failed to clear queue'); }
  };

  const editPostTime = async (postId, newDate) => {
    try {
      await axios.put(`${API}/api/schedule/${postId}`, { scheduled_at: newDate }, { withCredentials: true });
      toast.success('Post time updated');
      fetchQueue();
    } catch { toast.error('Failed to update time'); }
  };

  const bulkChangeTime = async (queueType) => {
    setBulkTimeUpdating(true);
    try {
      const res = await axios.post(`${API}/api/schedule/bulk-change-time`, {
        hour: parseInt(bulkHour),
        minute: parseInt(bulkMinute),
        queue_type: queueType || null,
      }, { withCredentials: true });
      toast.success(`Updated ${res.data.updated} posts to ${bulkHour}:${bulkMinute} CT`);
      setShowBulkTime(false);
      fetchQueue();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
    finally { setBulkTimeUpdating(false); }
  };

  if (showStrategy) {
    return <StrategyLauncher onBack={() => setShowStrategy(false)} onDone={() => { setShowStrategy(false); fetchQueue(); }} />;
  }

  if (addingTo) {
    return <AddToScheduleView queueType={addingTo} onBack={() => setAddingTo(null)} onAdded={() => { setAddingTo(null); fetchQueue(); }} />;
  }

  const filtered = posts.filter(p => p.queue_type === tab);
  const pending = filtered.filter(p => p.status === 'pending');
  const completed = filtered.filter(p => p.status !== 'pending');

  // Strategy reminder: check when last auction ends
  const auctionPosts = posts.filter(p => p.queue_type === 'auction' && p.status === 'pending');
  const lastAuction = auctionPosts.length > 0 ? auctionPosts[auctionPosts.length - 1] : null;
  const lastAuctionEnd = lastAuction ? new Date(new Date(lastAuction.scheduled_at).getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const daysUntilNoAuctions = lastAuctionEnd ? Math.ceil((lastAuctionEnd - now) / (1000 * 60 * 60 * 24)) : null;
  const showReminder = daysUntilNoAuctions !== null && daysUntilNoAuctions <= 3 && daysUntilNoAuctions >= 0;
  const isUrgent = daysUntilNoAuctions !== null && daysUntilNoAuctions <= 1;

  return (
    <div className="max-w-5xl mx-auto" data-testid="schedule-module">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Schedule Posting</h1>
          <p className="text-xs text-gray-500 mt-0.5">Queue cards for automatic eBay posting</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStrategy(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-black hover:shadow-lg hover:shadow-orange-500/20 transition-shadow" data-testid="launch-strategy-btn">
            <Rocket className="w-3.5 h-3.5" /> Launch Strategy
          </button>
          <button onClick={() => setAddingTo(tab)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black text-xs font-black hover:shadow-lg hover:shadow-amber-500/20 transition-shadow" data-testid="add-to-schedule-btn">
            <Plus className="w-3.5 h-3.5" /> Add Cards
          </button>
          {pending.length > 0 && (
            <button onClick={clearQueue} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-gray-400 hover:text-red-400 hover:border-red-500/20 transition-colors" data-testid="clear-queue-btn">
              <Trash2 className="w-3.5 h-3.5" /> Clear Queue
            </button>
          )}
        </div>
      </div>

      {/* Strategy Reminder */}
      {showReminder && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-3 rounded-xl mb-5 border ${isUrgent ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}
          data-testid="strategy-reminder-banner">
          <Rocket className={`w-5 h-5 shrink-0 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          <div className="flex-1">
            <p className={`text-xs font-bold ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
              {isUrgent ? 'Your auctions end tomorrow!' : `${daysUntilNoAuctions} days left of auctions`}
            </p>
            <p className="text-[10px] text-gray-500">Launch a new strategy to keep the traffic flowing</p>
          </div>
          <button onClick={() => setShowStrategy(true)}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-colors ${isUrgent ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
            data-testid="strategy-reminder-launch-btn">
            Launch Now
          </button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04] w-fit">
        {[
          { id: 'fixed_price', label: 'Fixed Price', icon: DollarSign },
          { id: 'auction', label: 'Auctions', icon: Gavel },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            data-testid={`schedule-tab-${t.id}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            <span className={`ml-1 text-[10px] ${tab === t.id ? 'text-amber-400' : 'text-gray-600'}`}>
              {posts.filter(p => p.queue_type === t.id && p.status === 'pending').length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400 font-bold">No {tab === 'auction' ? 'auctions' : 'listings'} scheduled</p>
          <p className="text-xs text-gray-600 mt-1">Add cards from your inventory to get started</p>
          <button onClick={() => setAddingTo(tab)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-amber-400 hover:bg-white/[0.06] transition-colors" data-testid="schedule-empty-add-btn">
            <Plus className="w-3.5 h-3.5" /> Add Cards to Queue
          </button>
        </div>
      ) : (
        <>
          {/* Pending (upcoming) */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Upcoming ({pending.length})
                </h3>
                <button onClick={() => setShowBulkTime(!showBulkTime)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                  data-testid="bulk-change-time-btn">
                  <Clock className="w-3 h-3" /> Change All Times
                </button>
              </div>

              {showBulkTime && (
                <div className="flex flex-wrap items-center gap-3 p-3 mb-3 rounded-xl bg-amber-500/5 border border-amber-500/15" data-testid="bulk-time-panel">
                  <span className="text-xs text-gray-400">New time:</span>
                  <select value={bulkHour} onChange={e => setBulkHour(e.target.value)}
                    className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none" data-testid="bulk-hour-select">
                    {[15,16,17,18,19,20,21,22].map(h => (
                      <option key={h} value={h}>{h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}</option>
                    ))}
                  </select>
                  <select value={bulkMinute} onChange={e => setBulkMinute(e.target.value)}
                    className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none" data-testid="bulk-minute-select">
                    {['00','15','30','45'].map(m => <option key={m} value={m}>:{m}</option>)}
                  </select>
                  <span className="text-xs text-gray-500 font-bold">CT</span>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => bulkChangeTime(tab)} disabled={bulkTimeUpdating}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 disabled:opacity-50 transition-colors"
                      data-testid="bulk-time-apply-tab">
                      {bulkTimeUpdating ? 'Updating...' : `Apply to ${tab === 'auction' ? 'Auctions' : 'Fixed Price'}`}
                    </button>
                    <button onClick={() => bulkChangeTime(null)} disabled={bulkTimeUpdating}
                      className="px-4 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs font-bold hover:bg-white/10 disabled:opacity-50 transition-colors"
                      data-testid="bulk-time-apply-all">
                      Apply to All
                    </button>
                  </div>
                </div>
              )}
              {/* Group by day */}
              {(() => {
                const groups = {};
                pending.forEach(p => {
                  const d = new Date(p.scheduled_at);
                  const key = d.toISOString().split('T')[0];
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(p);
                });
                return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayPosts]) => {
                  const d = new Date(date + 'T12:00:00');
                  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const dayName = days[d.getDay()];
                  const isWeekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;
                  return (
                    <div key={date} className="mb-5">
                      <div className={`flex items-center gap-2 mb-2 px-1 ${isWeekend ? 'text-emerald-400' : 'text-gray-400'}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{dayName}</span>
                        <span className="text-xs text-gray-500">{months[d.getMonth()]} {d.getDate()}</span>
                        <span className="text-[10px] text-gray-600 ml-auto">{dayPosts.length} cards</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {dayPosts.map((post, idx) => (
                          <PostCard key={post.id} post={post} onDelete={deletePost} onEdit={editPostTime} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Completed (posted/failed) */}
          {completed.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" /> History ({completed.length})
              </h3>
              <div className="space-y-2">
                {completed.map((post, idx) => (
                  <PostRow key={post.id} post={post} idx={idx} onDelete={deletePost} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};


// ============ POST CARD (Visual Grid) ============
const PostCard = ({ post, onDelete, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const status = STATUS_STYLES[post.status] || STATUS_STYLES.pending;
  const isAuction = post.queue_type === 'auction';
  const img = post.image;

  const startEdit = () => {
    const d = new Date(post.scheduled_at);
    const central = new Date(d.getTime() - 5 * 60 * 60 * 1000);
    setEditDate(central.toISOString().split('T')[0]);
    const h = central.getHours().toString().padStart(2, '0');
    const m = central.getMinutes().toString().padStart(2, '0');
    setEditTime(`${h}:${m}`);
    setEditing(true);
  };

  const saveEdit = () => {
    const localDate = new Date(`${editDate}T${editTime}:00`);
    const utcDate = new Date(localDate.getTime() + 5 * 60 * 60 * 1000);
    onEdit(post.id, utcDate.toISOString());
    setEditing(false);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] transition-colors group"
      data-testid={`schedule-post-${post.id}`}>
      <div className="flex gap-3 p-2.5">
        {/* Big Thumbnail */}
        <div className="w-20 h-28 rounded-lg overflow-hidden bg-[#111] shrink-0">
          {img ? <img src={`data:image/jpeg;base64,${img}`} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-700" /></div>}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <p className="text-sm font-bold text-white truncate">{post.title || post.player}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isAuction ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                {isAuction ? 'AUCTION' : 'FIXED'}
              </span>
              <span className="text-xs text-gray-400 font-bold">
                {isAuction ? `$${post.starting_bid} start` : `$${post.price}`}
              </span>
              {isAuction && (
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Timer className="w-3 h-3" />{(post.auction_duration || '').replace('Days_', '')}d</span>
              )}
            </div>
          </div>

          {editing ? (
            <div className="flex items-center gap-1.5 mt-2">
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="bg-[#0a0a0a] border border-white/10 rounded px-1.5 py-1 text-[10px] text-white outline-none flex-1" />
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                className="bg-[#0a0a0a] border border-white/10 rounded px-1.5 py-1 text-[10px] text-white outline-none w-20" />
              <button onClick={saveEdit} className="p-1 rounded bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3" /></button>
              <button onClick={() => setEditing(false)} className="p-1 rounded bg-white/5 text-gray-500"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-2">
              <div className="text-[10px] space-y-0.5">
                {(() => { const tz = formatTimeZones(post.scheduled_at); return (<>
                  <p className="text-amber-400 font-bold">{tz.ct} CT</p>
                  <p className="text-gray-500">{tz.pt} PT &middot; {tz.et} ET</p>
                </>); })()}
              </div>
              {post.status === 'pending' && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={startEdit} className="p-1 rounded hover:bg-amber-500/10 text-gray-600 hover:text-amber-400" data-testid={`edit-post-${post.id}`}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(post.id)} className="p-1 rounded hover:bg-red-500/10 text-gray-600 hover:text-red-400" data-testid={`delete-post-${post.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {post.error_message && (
        <div className="px-2.5 pb-2">
          <p className="text-[10px] text-red-400 flex items-center gap-1 truncate"><AlertCircle className="w-3 h-3 shrink-0" />{post.error_message}</p>
        </div>
      )}
    </div>
  );
};


// ============ POST ROW (for History) ============
const PostRow = ({ post, idx, onDelete, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const status = STATUS_STYLES[post.status] || STATUS_STYLES.pending;
  const isAuction = post.queue_type === 'auction';
  const img = post.image;

  const startEdit = () => {
    const d = new Date(post.scheduled_at);
    // Convert UTC to Central (UTC-5 CDT)
    const central = new Date(d.getTime() - 5 * 60 * 60 * 1000);
    setEditDate(central.toISOString().split('T')[0]);
    const h = central.getHours().toString().padStart(2, '0');
    const m = central.getMinutes().toString().padStart(2, '0');
    setEditTime(`${h}:${m}`);
    setEditing(true);
  };

  const saveEdit = () => {
    // Convert Central back to UTC
    const localDate = new Date(`${editDate}T${editTime}:00`);
    const utcDate = new Date(localDate.getTime() + 5 * 60 * 60 * 1000);
    onEdit(post.id, utcDate.toISOString());
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors group"
      data-testid={`schedule-post-${post.id}`}
    >
      {/* Thumbnail */}
      <div className="w-12 h-16 rounded-lg overflow-hidden bg-[#111] shrink-0">
        {img ? <img src={`data:image/jpeg;base64,${img}`} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-gray-700" /></div>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{post.title || post.player}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.bg} ${status.text}`}>{status.label}</span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1">
            {isAuction ? <Gavel className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
            {isAuction ? `$${post.starting_bid} start` : `$${post.price}`}
          </span>
          {isAuction && post.buy_it_now && (
            <span className="text-[10px] text-gray-500">BIN: ${post.buy_it_now}</span>
          )}
          {isAuction && (
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Timer className="w-3 h-3" />{(post.auction_duration || '').replace('Days_', '')}d</span>
          )}
        </div>
        {post.error_message && (
          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1 truncate"><AlertCircle className="w-3 h-3 shrink-0" />{post.error_message}</p>
        )}
      </div>

      {/* Schedule time - editable */}
      {editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none" data-testid={`edit-date-${post.id}`} />
          <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none" data-testid={`edit-time-${post.id}`} />
          <span className="text-[9px] text-gray-500">CT</span>
          <button onClick={saveEdit} className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" data-testid={`save-edit-${post.id}`}>
            <CheckCircle className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="p-1 rounded-lg bg-white/5 text-gray-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="text-right shrink-0 cursor-pointer group/time" onClick={() => post.status === 'pending' && startEdit()}>
          <p className="text-[10px] text-gray-400 font-bold">{formatDate(post.scheduled_at)}</p>
          {(() => { const tz = formatTimeZones(post.scheduled_at); return (<>
            <p className="text-[10px] text-amber-400 font-bold">{tz.ct} CT</p>
            <p className="text-[9px] text-gray-600">{tz.pt} PT &middot; {tz.et} ET</p>
          </>); })()}
          {post.status === 'pending' && <p className="text-[9px] text-amber-500/0 group-hover/time:text-amber-500/70 transition-colors">edit</p>}
        </div>
      )}

      {/* Actions */}
      {post.status === 'pending' && !editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={startEdit} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-gray-600 hover:text-amber-400" data-testid={`edit-post-${post.id}`}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(post.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400" data-testid={`delete-post-${post.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {post.status === 'posted' && post.ebay_item_id && (
        <a href={`https://www.ebay.com/itm/${post.ebay_item_id}`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/5 text-gray-600 hover:text-white transition-all">
          <ChevronRight className="w-3.5 h-3.5" />
        </a>
      )}
    </motion.div>
  );
};

export default ScheduleModule;
