import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Plus, Percent, Pause, Play, ChevronDown, ChevronUp, Calendar, Clock } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  RUNNING: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Active' },
  SCHEDULED: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Scheduled' },
  PAUSED: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Paused' },
  ENDED: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Ended' },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};

const StorePromotions = ({ compact = false }) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tiers, setTiers] = useState([
    { min_qty: 2, percent_off: 10 },
    { min_qty: 4, percent_off: 20 },
  ]);
  const [endDays, setEndDays] = useState(30);

  const fetchPromotions = useCallback(async () => {
    setLoadingPromos(true);
    try {
      const res = await axios.get(`${API}/api/ebay/sell/store-promotions`, { withCredentials: true });
      if (res.data.success) {
        setPromotions(res.data.promotions || []);
      }
    } catch (err) {
      console.error('Failed to fetch promotions:', err);
    } finally {
      setLoadingPromos(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const updateTier = (idx, field, val) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: parseInt(val) || 0 } : t));
  };
  const addTier = () => {
    if (tiers.length < 4) {
      const lastQty = tiers.length > 0 ? tiers[tiers.length - 1].min_qty + 2 : 2;
      const lastPct = tiers.length > 0 ? tiers[tiers.length - 1].percent_off + 10 : 10;
      setTiers([...tiers, { min_qty: lastQty, percent_off: Math.min(lastPct, 80) }]);
    }
  };
  const removeTier = (idx) => {
    if (tiers.length > 1) setTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const applyDiscount = async () => {
    const invalid = tiers.some(t => t.min_qty < 2 || t.percent_off < 5 || t.percent_off > 80);
    if (invalid) { toast.error('Min quantity must be 2+, discount must be 5-80%'); return; }
    setApplying(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/volume-discount`, {
        name: `Store Order Discount`,
        tiers: tiers.map(t => ({ min_qty: t.min_qty, percent_off: t.percent_off })),
        apply_all: true,
        end_days: endDays,
      }, { withCredentials: true });
      if (res.data.success) {
        toast.success('Order Discount applied to your store!');
        setShowCreate(false);
        fetchPromotions();
      } else {
        toast.error(res.data.error || 'Failed to apply discount');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply discount');
    } finally {
      setApplying(false);
    }
  };

  const pausePromotion = async (promoId) => {
    setActionLoading(promoId);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/store-promotions/${encodeURIComponent(promoId)}/pause`, {}, { withCredentials: true });
      if (res.data.success) {
        toast.success('Promotion paused');
        fetchPromotions();
      } else {
        toast.error(res.data.error || 'Failed to pause');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to pause');
    } finally {
      setActionLoading(null);
    }
  };

  const resumePromotion = async (promoId) => {
    setActionLoading(promoId);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/store-promotions/${encodeURIComponent(promoId)}/resume`, {}, { withCredentials: true });
      if (res.data.success) {
        toast.success('Promotion resumed');
        fetchPromotions();
      } else {
        toast.error(res.data.error || 'Failed to resume');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resume');
    } finally {
      setActionLoading(null);
    }
  };

  const deletePromotion = async (promo) => {
    if (!window.confirm(`Delete "${promo.name}"? This cannot be undone.`)) return;

    setActionLoading(promo.promotion_id);
    try {
      // If running, pause first
      if (promo.status === 'RUNNING') {
        const pauseRes = await axios.post(`${API}/api/ebay/sell/store-promotions/${encodeURIComponent(promo.promotion_id)}/pause`, {}, { withCredentials: true });
        if (!pauseRes.data.success) {
          toast.error('Failed to pause before delete: ' + (pauseRes.data.error || ''));
          setActionLoading(null);
          return;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      const res = await axios.delete(`${API}/api/ebay/sell/store-promotions/${encodeURIComponent(promo.promotion_id)}`, { withCredentials: true });
      if (res.data.success) {
        toast.success('Promotion deleted');
        fetchPromotions();
      } else {
        toast.error(res.data.error || 'Failed to delete');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const activePromos = promotions.filter(p => ['RUNNING', 'SCHEDULED', 'PAUSED'].includes(p.status));

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'}`} data-testid="store-promotions">
      {!compact && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Store Promotions</h3>
          </div>
          <button onClick={fetchPromotions} disabled={loadingPromos}
            className="text-gray-500 hover:text-white transition-colors" data-testid="promo-refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPromos ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Active Promotions List */}
      {loadingPromos ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
          <span className="ml-2 text-xs text-gray-500">Loading promotions...</span>
        </div>
      ) : activePromos.length > 0 ? (
        <div className="space-y-2" data-testid="promo-list">
          {activePromos.map((promo) => {
            const statusStyle = STATUS_COLORS[promo.status] || STATUS_COLORS.ENDED;
            const isActioning = actionLoading === promo.promotion_id;
            return (
              <div key={promo.promotion_id}
                className={`px-3 py-2.5 rounded-lg border ${statusStyle.border} ${statusStyle.bg}`}
                data-testid={`promo-item-${promo.promotion_id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate">{promo.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                        {statusStyle.label}
                      </span>
                    </div>
                    {promo.description && (
                      <p className="text-[10px] text-gray-400 truncate mb-1">{promo.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(promo.start_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDate(promo.end_date)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {promo.status === 'RUNNING' && (
                      <button onClick={() => pausePromotion(promo.promotion_id)} disabled={isActioning}
                        className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                        title="Pause" data-testid={`promo-pause-${promo.promotion_id}`}>
                        {isActioning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                      </button>
                    )}
                    {promo.status === 'PAUSED' && (
                      <button onClick={() => resumePromotion(promo.promotion_id)} disabled={isActioning}
                        className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        title="Resume" data-testid={`promo-resume-${promo.promotion_id}`}>
                        {isActioning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      </button>
                    )}
                    <button onClick={() => deletePromotion(promo)} disabled={isActioning}
                      className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      title="Delete" data-testid={`promo-delete-${promo.promotion_id}`}>
                      {isActioning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-gray-500 py-2">No active promotions. Create one below.</p>
      )}

      {/* Toggle Create Section */}
      <button onClick={() => setShowCreate(!showCreate)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#222] hover:border-emerald-500/30 text-xs text-gray-400 hover:text-emerald-400 transition-all"
        data-testid="promo-toggle-create">
        <span className="flex items-center gap-2">
          <Plus className="w-3 h-3" />
          Create New Promotion
        </span>
        {showCreate ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Create Section */}
      {showCreate && (
        <div className="space-y-3 pt-1">
          <p className="text-[10px] text-gray-500">
            Buyers get a discount when purchasing multiple items from your store. Applies to ALL your eBay listings.
          </p>

          {/* Tiers */}
          <div className="space-y-2">
            {tiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 rounded-lg border border-emerald-500/20" data-testid={`promo-tier-${idx}`}>
                <span className="text-[10px] text-emerald-400 shrink-0">Buy</span>
                <input type="number" min="2" max="20" value={tier.min_qty}
                  onChange={e => updateTier(idx, 'min_qty', e.target.value)}
                  className="w-12 bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-emerald-500/50" />
                <span className="text-[10px] text-gray-500">+ items</span>
                <input type="number" min="5" max="80" value={tier.percent_off}
                  onChange={e => updateTier(idx, 'percent_off', e.target.value)}
                  className="w-12 bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-emerald-500/50" />
                <span className="text-[10px] text-emerald-400">% off</span>
                {tiers.length > 1 && (
                  <button onClick={() => removeTier(idx)} className="ml-auto text-red-400/60 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {tiers.length < 4 && (
              <button onClick={addTier} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold" data-testid="promo-add-tier">
                <Plus className="w-3 h-3" /> Add Tier
              </button>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Duration:</span>
            <select value={endDays} onChange={e => setEndDays(parseInt(e.target.value))}
              className="bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500/50">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          {/* Apply */}
          <button onClick={applyDiscount} disabled={applying}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-black hover:bg-emerald-400 disabled:opacity-50 transition-all"
            data-testid="promo-apply-btn">
            {applying ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Applying...</>
            ) : (
              <><Percent className="w-3.5 h-3.5" /> Apply Order Discount</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default StorePromotions;
