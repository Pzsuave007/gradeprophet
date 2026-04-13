import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Gavel, DollarSign, Package, Trash2, Plus, ChevronRight, AlertCircle, CheckCircle, Loader2, ArrowLeft, Search, X, Timer, Zap } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

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


// ============ ADD TO SCHEDULE VIEW ============
const AddToScheduleView = ({ queueType, onBack, onAdded }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [config, setConfig] = useState({
    starting_bid: 0.99,
    reserve_price: '',
    buy_it_now: '',
    auction_duration: 'Days_7',
    price: '',
    shipping_option: 'USPSFirstClass',
    shipping_cost: 1.50,
    best_offer: false,
    interval_hours: 24,
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
  const selectAll = () => {
    const visible = filtered.map(c => c.id);
    if (visible.every(id => selected.includes(id))) setSelected(s => s.filter(id => !visible.includes(id)));
    else setSelected(s => [...new Set([...s, ...visible])]);
  };

  const filtered = cards.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.player || '').toLowerCase().includes(q) || (c.set_name || '').toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (!selected.length) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/schedule/add-bulk`, {
        card_ids: selected,
        queue_type: queueType,
        interval_hours: config.interval_hours,
        config: {
          ...(queueType === 'auction' ? {
            starting_bid: parseFloat(config.starting_bid) || 0.99,
            reserve_price: config.reserve_price ? parseFloat(config.reserve_price) : null,
            buy_it_now: config.buy_it_now ? parseFloat(config.buy_it_now) : null,
            auction_duration: config.auction_duration,
          } : {
            price: config.price ? parseFloat(config.price) : null,
            best_offer: config.best_offer,
          }),
          shipping_option: config.shipping_option,
          shipping_cost: parseFloat(config.shipping_cost) || 1.50,
        },
      }, { withCredentials: true });
      toast.success(`${res.data.added} card(s) scheduled!`);
      if (res.data.skipped > 0) toast.info(`${res.data.skipped} skipped (already listed/scheduled)`);
      onAdded();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to schedule'); }
    finally { setSubmitting(false); }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30";
  const labelCls = "text-xs text-gray-400 font-medium mb-1 block";

  return (
    <div data-testid="add-to-schedule-view">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5" data-testid="schedule-back-btn"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
        <h2 className="text-lg font-black text-white">
          Add to {queueType === 'auction' ? 'Auction' : 'Fixed Price'} Queue
        </h2>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        {queueType === 'auction' ? (
          <>
            <div><label className={labelCls}>Starting Bid</label><input type="number" step="0.01" value={config.starting_bid} onChange={e => setConfig(c => ({...c, starting_bid: e.target.value}))} className={inputCls} data-testid="starting-bid-input" /></div>
            <div><label className={labelCls}>Reserve Price</label><input type="number" step="0.01" value={config.reserve_price} onChange={e => setConfig(c => ({...c, reserve_price: e.target.value}))} placeholder="Optional" className={inputCls} data-testid="reserve-price-input" /></div>
            <div><label className={labelCls}>Buy It Now</label><input type="number" step="0.01" value={config.buy_it_now} onChange={e => setConfig(c => ({...c, buy_it_now: e.target.value}))} placeholder="Optional" className={inputCls} data-testid="buy-it-now-input" /></div>
            <div><label className={labelCls}>Duration</label>
              <select value={config.auction_duration} onChange={e => setConfig(c => ({...c, auction_duration: e.target.value}))} className={inputCls} data-testid="auction-duration-select">
                {AUCTION_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div><label className={labelCls}>Price (blank = card value)</label><input type="number" step="0.01" value={config.price} onChange={e => setConfig(c => ({...c, price: e.target.value}))} placeholder="Auto" className={inputCls} data-testid="price-input" /></div>
            <div className="flex items-end pb-1"><label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.best_offer} onChange={e => setConfig(c => ({...c, best_offer: e.target.checked}))} className="accent-amber-500" />
              <span className="text-xs text-gray-300">Best Offer</span>
            </label></div>
          </>
        )}
        <div><label className={labelCls}>Post every (hours)</label><input type="number" step="1" min="1" value={config.interval_hours} onChange={e => setConfig(c => ({...c, interval_hours: e.target.value}))} className={inputCls} data-testid="interval-input" /></div>
        <div><label className={labelCls}>Shipping Cost</label><input type="number" step="0.01" value={config.shipping_cost} onChange={e => setConfig(c => ({...c, shipping_cost: e.target.value}))} className={inputCls} data-testid="shipping-cost-input" /></div>
      </div>

      {/* Search + Select All */}
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

      {/* Card Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto pr-1">
          {filtered.map(c => {
            const sel = selected.includes(c.id);
            const img = c.thumbnail || c.store_thumbnail || c.image;
            return (
              <motion.div key={c.id} whileTap={{ scale: 0.97 }} onClick={() => toggle(c.id)}
                className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${sel ? 'border-amber-500/60 bg-amber-500/5' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.04]'}`}
                data-testid={`schedule-card-${c.id}`}>
                {img && <img src={`data:image/jpeg;base64,${img}`} alt={c.player} className="w-full aspect-[3/4] object-cover" />}
                {!img && <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center"><Package className="w-6 h-6 text-gray-700" /></div>}
                <div className="p-1.5">
                  <p className="text-[10px] font-bold text-white truncate">{c.player}</p>
                  <p className="text-[8px] text-gray-500 truncate">{c.year} {c.set_name}</p>
                </div>
                {sel && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"><CheckCircle className="w-3 h-3 text-black" /></div>}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Submit */}
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

  if (addingTo) {
    return <AddToScheduleView queueType={addingTo} onBack={() => setAddingTo(null)} onAdded={() => { setAddingTo(null); fetchQueue(); }} />;
  }

  const filtered = posts.filter(p => p.queue_type === tab);
  const pending = filtered.filter(p => p.status === 'pending');
  const completed = filtered.filter(p => p.status !== 'pending');

  return (
    <div className="max-w-5xl mx-auto" data-testid="schedule-module">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Schedule Posting</h1>
          <p className="text-xs text-gray-500 mt-0.5">Queue cards for automatic eBay posting</p>
        </div>
        <div className="flex gap-2">
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
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Upcoming ({pending.length})
              </h3>
              <div className="space-y-2">
                {pending.map((post, idx) => (
                  <PostRow key={post.id} post={post} idx={idx} onDelete={deletePost} />
                ))}
              </div>
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


// ============ POST ROW ============
const PostRow = ({ post, idx, onDelete }) => {
  const status = STATUS_STYLES[post.status] || STATUS_STYLES.pending;
  const isAuction = post.queue_type === 'auction';
  const img = post.image;

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

      {/* Schedule time */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-gray-400 font-bold">{formatDate(post.scheduled_at)}</p>
        <p className="text-[10px] text-gray-600">{formatTime(post.scheduled_at)}</p>
      </div>

      {/* Actions */}
      {post.status === 'pending' && (
        <button onClick={() => onDelete(post.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all" data-testid={`delete-post-${post.id}`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
