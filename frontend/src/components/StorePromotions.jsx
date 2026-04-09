import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, Trash2, Plus, Percent } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const StorePromotions = ({ compact = false }) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tiers, setTiers] = useState([
    { min_qty: 2, percent_off: 10 },
    { min_qty: 4, percent_off: 20 },
  ]);
  const [endDays, setEndDays] = useState(30);

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
      });
      if (res.data.success) {
        toast.success('Order Discount applied to your store!');
      } else {
        toast.error(res.data.error || 'Failed to apply discount');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply discount');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-4'}`} data-testid="store-promotions">
      {!compact && (
        <div className="flex items-center gap-2 mb-1">
          <Percent className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Store Order Discount</h3>
        </div>
      )}
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
  );
};

export default StorePromotions;
