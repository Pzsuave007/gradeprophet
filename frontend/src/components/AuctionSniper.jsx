import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Crosshair, Plus, Trash2, ExternalLink, Clock, DollarSign,
  Loader2, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Timer, Gavel, Target, X, Zap, Eye
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  scheduled: { color: 'text-blue-400 border-blue-400/30 bg-blue-400/10', label: 'Scheduled', icon: Clock },
  monitoring: { color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10', label: 'Monitoring', icon: Eye },
  bidding: { color: 'text-orange-400 border-orange-400/30 bg-orange-400/10', label: 'Bidding...', icon: Zap },
  bid_placed: { color: 'text-green-400 border-green-400/30 bg-green-400/10', label: 'Bid Placed', icon: CheckCircle2 },
  won: { color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10', label: 'WON', icon: CheckCircle2 },
  outbid: { color: 'text-red-400 border-red-400/30 bg-red-400/10', label: 'Outbid', icon: XCircle },
  lost: { color: 'text-red-400 border-red-400/30 bg-red-400/10', label: 'Lost', icon: XCircle },
  skipped: { color: 'text-gray-400 border-gray-400/30 bg-gray-400/10', label: 'Skipped', icon: AlertCircle },
  missed: { color: 'text-gray-500 border-gray-500/30 bg-gray-500/10', label: 'Missed', icon: AlertCircle },
  cancelled: { color: 'text-gray-500 border-gray-500/30 bg-gray-500/10', label: 'Cancelled', icon: XCircle },
  error: { color: 'text-red-500 border-red-500/30 bg-red-500/10', label: 'Error', icon: AlertCircle },
};

function useCountdown(endTimeStr) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgency, setUrgency] = useState('normal');

  useEffect(() => {
    if (!endTimeStr) { setTimeLeft('--'); return; }
    const update = () => {
      const end = new Date(endTimeStr);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) { setTimeLeft('Ended'); setUrgency('ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
      setUrgency(diff < 60000 ? 'critical' : diff < 300000 ? 'warning' : 'normal');
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTimeStr]);

  return { timeLeft, urgency };
}

function SnipeCountdown({ endTime }) {
  const { timeLeft, urgency } = useCountdown(endTime);
  const colors = { critical: 'text-red-400 animate-pulse', warning: 'text-yellow-400', normal: 'text-gray-400', ended: 'text-gray-600' };
  return (
    <span className={`font-mono text-sm font-bold ${colors[urgency]}`} data-testid="snipe-countdown">
      <Timer className="w-3.5 h-3.5 inline mr-1" />{timeLeft}
    </span>
  );
}

function SnipeCard({ snipe, onCancel, onRefresh }) {
  const status = STATUS_CONFIG[snipe.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = status.icon;
  const isActive = ['scheduled', 'monitoring', 'bidding'].includes(snipe.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-[#0a0a0a] border rounded-lg overflow-hidden transition-all ${
        isActive ? 'border-[#3b82f6]/30 hover:border-[#3b82f6]/50' : 'border-[#1a1a1a]'
      }`}
      data-testid={`snipe-card-${snipe.id}`}
    >
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="w-20 h-20 rounded bg-[#111] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
          {snipe.item_image_url ? (
            <img src={snipe.item_image_url} alt="" className="w-full h-full object-contain"
              onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23121212" width="200" height="200"/></svg>'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Gavel className="w-6 h-6 text-gray-700" /></div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium line-clamp-2 mb-1">{snipe.item_title}</p>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.color}`}>
              <StatusIcon className="w-3 h-3 mr-0.5" />{status.label}
            </Badge>
            {isActive && <SnipeCountdown endTime={snipe.auction_end_time} />}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-gray-500">Current: <span className="text-white font-medium">${snipe.current_price?.toFixed(2)}</span></span>
            <span className="text-gray-500">Your Max: <span className="text-[#22c55e] font-bold">${snipe.max_bid?.toFixed(2)}</span></span>
            <span className="text-gray-500">Bids: <span className="text-white">{snipe.bid_count || 0}</span></span>
            <span className="text-gray-500">Fires: <span className="text-yellow-400">{snipe.snipe_seconds_before}s before</span></span>
          </div>
          {snipe.result_message && (
            <p className={`text-xs mt-1 ${snipe.status === 'won' ? 'text-emerald-400' : snipe.status === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
              {snipe.result_message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <a href={snipe.item_url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-[#3b82f6]" data-testid={`snipe-ebay-link-${snipe.id}`}>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {isActive && (
            <>
              <button onClick={() => onRefresh(snipe.id)}
                className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-white" data-testid={`snipe-refresh-${snipe.id}`}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onCancel(snipe.id)}
                className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-red-400" data-testid={`snipe-cancel-${snipe.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {!isActive && (
            <button onClick={() => onCancel(snipe.id)}
              className="p-1.5 rounded hover:bg-white/5 text-gray-500 hover:text-red-400" data-testid={`snipe-remove-${snipe.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const AuctionSniper = ({ prefillUrl }) => {
  const apiBase = `${API}/api`;
  const [snipes, setSnipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formMaxBid, setFormMaxBid] = useState('');
  const [formSeconds, setFormSeconds] = useState(3);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [itemPreview, setItemPreview] = useState(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ active: 0, won: 0, lost: 0 });
  const pollRef = useRef(null);

  const loadSnipes = useCallback(async () => {
    try {
      const [snipesRes, statsRes] = await Promise.all([
        axios.get(`${apiBase}/snipes`),
        axios.get(`${apiBase}/snipes-stats`)
      ]);
      setSnipes(snipesRes.data);
      setStats(statsRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiBase]);

  // Poll every 10s for active snipes
  useEffect(() => {
    loadSnipes();
    pollRef.current = setInterval(loadSnipes, 10000);
    return () => clearInterval(pollRef.current);
  }, [loadSnipes]);

  // Handle prefill from monitor
  useEffect(() => {
    if (prefillUrl) {
      setFormUrl(prefillUrl);
      setShowForm(true);
      handleCheckItem(prefillUrl);
    }
  }, [prefillUrl]);

  const handleCheckItem = async (urlOverride) => {
    const url = urlOverride || formUrl;
    if (!url.trim()) return;
    setChecking(true);
    setError('');
    setItemPreview(null);
    try {
      const r = await axios.post(`${apiBase}/snipes/check-item`, { ebay_url_or_id: url });
      if (!r.data.is_auction) {
        setError('This is not an auction. Sniping only works on auction listings.');
        return;
      }
      setItemPreview(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not check item');
    } finally { setChecking(false); }
  };

  const handleCreateSnipe = async (e) => {
    e.preventDefault();
    if (!formUrl.trim() || !formMaxBid) return;
    setCreating(true);
    setError('');
    try {
      await axios.post(`${apiBase}/snipes`, {
        ebay_url_or_id: formUrl.trim(),
        max_bid: parseFloat(formMaxBid),
        snipe_seconds_before: formSeconds,
      });
      setFormUrl('');
      setFormMaxBid('');
      setFormSeconds(3);
      setItemPreview(null);
      setShowForm(false);
      loadSnipes();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create snipe');
    } finally { setCreating(false); }
  };

  const handleCancel = async (id) => {
    const snipe = snipes.find(s => s.id === id);
    const isActive = ['scheduled', 'monitoring', 'bidding'].includes(snipe?.status);
    if (isActive && !window.confirm('Cancel this snipe?')) return;
    try {
      if (isActive) {
        await axios.delete(`${apiBase}/snipes/${id}`);
      }
      loadSnipes();
    } catch (e) { console.error(e); }
  };

  const handleRefresh = async (id) => {
    try {
      await axios.post(`${apiBase}/snipes/${id}/refresh`);
      loadSnipes();
    } catch (e) { console.error(e); }
  };

  const activeSnipes = snipes.filter(s => ['scheduled', 'monitoring', 'bidding', 'bid_placed'].includes(s.status));
  const completedSnipes = snipes.filter(s => !['scheduled', 'monitoring', 'bidding', 'bid_placed'].includes(s.status));

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-[#3b82f6]">{stats.active}</div>
          <div className="text-[9px] text-gray-600 uppercase tracking-wider">Active</div>
        </div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-[#22c55e]">{stats.won}</div>
          <div className="text-[9px] text-gray-600 uppercase tracking-wider">Won</div>
        </div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-red-400">{stats.lost}</div>
          <div className="text-[9px] text-gray-600 uppercase tracking-wider">Lost</div>
        </div>
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2.5 text-center">
          <div className="text-lg font-bold text-white">{snipes.length}</div>
          <div className="text-[9px] text-gray-600 uppercase tracking-wider">Total</div>
        </div>
      </div>

      {/* Add Snipe Button */}
      <Button onClick={() => setShowForm(!showForm)}
        className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-heading uppercase tracking-wider h-10"
        data-testid="add-snipe-btn">
        {showForm ? <><X className="w-4 h-4 mr-2" />Cancel</> : <><Crosshair className="w-4 h-4 mr-2" />New Snipe</>}
      </Button>

      {/* Add Snipe Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#3b82f6]" />Set Up Snipe
              </h3>

              {/* URL Input + Check */}
              <div className="flex gap-2">
                <Input placeholder="eBay auction URL or Item ID" value={formUrl}
                  onChange={(e) => { setFormUrl(e.target.value); setItemPreview(null); setError(''); }}
                  className="bg-[#0a0a0a] border-[#1a1a1a] text-white flex-1 h-9 text-sm"
                  data-testid="snipe-url-input" />
                <Button onClick={() => handleCheckItem()} disabled={checking || !formUrl.trim()}
                  className="bg-[#1a1a1a] hover:bg-[#222] text-white h-9 px-3"
                  data-testid="snipe-check-btn">
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                </Button>
              </div>

              {/* Item Preview */}
              {itemPreview && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-[#0a0a0a] border border-[#22c55e]/30 rounded-lg p-3 flex gap-3">
                  {itemPreview.image_url && (
                    <img src={itemPreview.image_url} alt="" className="w-16 h-16 rounded object-contain bg-[#111]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium line-clamp-2">{itemPreview.title}</p>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className="text-gray-500">Price: <span className="text-[#22c55e] font-bold">${itemPreview.current_price?.toFixed(2)}</span></span>
                      <span className="text-gray-500">Bids: <span className="text-white">{itemPreview.bid_count}</span></span>
                      {itemPreview.auction_end_time && (
                        <span className="text-gray-500">Ends: <SnipeCountdown endTime={itemPreview.auction_end_time} /></span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Bid Settings */}
              <form onSubmit={handleCreateSnipe} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Max Bid ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                      <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={formMaxBid}
                        onChange={(e) => setFormMaxBid(e.target.value)}
                        className="bg-[#0a0a0a] border-[#1a1a1a] text-white h-9 text-sm pl-7"
                        data-testid="snipe-max-bid-input" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Seconds Before End</label>
                    <select value={formSeconds} onChange={(e) => setFormSeconds(parseInt(e.target.value))}
                      className="w-full h-9 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md text-white text-sm px-2"
                      data-testid="snipe-seconds-select">
                      <option value={2}>2 sec</option>
                      <option value={3}>3 sec</option>
                      <option value={5}>5 sec</option>
                      <option value={8}>8 sec</option>
                      <option value={10}>10 sec</option>
                      <option value={15}>15 sec</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <Button type="submit" disabled={creating || !formUrl.trim() || !formMaxBid}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-heading uppercase tracking-wider h-10"
                  data-testid="snipe-create-btn">
                  {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                    : <><Crosshair className="w-4 h-4 mr-2" />Arm Snipe</>}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Snipes */}
      {loading ? (
        <div className="text-center py-8 text-gray-600"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : (
        <>
          {activeSnipes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#3b82f6]" />Active Snipes ({activeSnipes.length})
              </h3>
              {activeSnipes.map(snipe => (
                <SnipeCard key={snipe.id} snipe={snipe} onCancel={handleCancel} onRefresh={handleRefresh} />
              ))}
            </div>
          )}

          {completedSnipes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />History ({completedSnipes.length})
              </h3>
              {completedSnipes.map(snipe => (
                <SnipeCard key={snipe.id} snipe={snipe} onCancel={handleCancel} onRefresh={handleRefresh} />
              ))}
            </div>
          )}

          {snipes.length === 0 && (
            <div className="text-center py-12 text-gray-600 bg-[#111] border border-[#1a1a1a] rounded-lg">
              <Crosshair className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No snipes yet</p>
              <p className="text-xs text-gray-600 mt-1">Find an auction and set up your first snipe</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuctionSniper;
