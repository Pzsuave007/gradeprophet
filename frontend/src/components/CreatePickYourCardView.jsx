import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, DollarSign, Send, RefreshCw, Image as ImageIcon, Tag, Truck, Layers } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SHIPPING_OPTIONS = [
  { id: 'FreeShipping', label: 'Free Shipping', cost: 0 },
  { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50 },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50 },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50 },
];

const CONDITIONS = [
  { id: 400010, label: 'Near Mint or Better' },
  { id: 400011, label: 'Excellent' },
  { id: 400012, label: 'Very Good' },
  { id: 400013, label: 'Poor' },
];

const CreatePickYourCardView = ({ items, onBack, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState('');
  const [cards, setCards] = useState([]);
  const [bulkPrice, setBulkPrice] = useState('');
  const [conditionId, setConditionId] = useState(400010);
  const [shippingOption, setShippingOption] = useState('USPSFirstClass');
  const [shippingCost, setShippingCost] = useState(4.50);
  const [bestOffer, setBestOffer] = useState(false);
  const [bulkSavings, setBulkSavings] = useState(true);
  const [tiers, setTiers] = useState([
    { min_qty: 2, percent_off: 10 },
    { min_qty: 3, percent_off: 20 },
  ]);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const ids = items.map(c => c.id);
      const res = await axios.post(`${API}/api/ebay/sell/pick-preview`, { card_ids: ids });
      setTitle(res.data.title);
      setCards(res.data.cards.map(c => ({ ...c, price: c.card_value > 0 ? String(c.card_value) : '0.99', quantity: '1' })));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (items?.length) fetchPreview();
  }, [items, fetchPreview]);

  const applyBulkPrice = () => {
    if (!bulkPrice || parseFloat(bulkPrice) <= 0) return;
    setCards(prev => prev.map(c => ({ ...c, price: bulkPrice })));
    toast.success(`Price set to $${bulkPrice} for all ${cards.length} cards`);
  };

  const updateCardPrice = (idx, val) => {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, price: val } : c));
  };

  const updateCardQty = (idx, val) => {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, quantity: val } : c));
  };

  const handleShippingChange = (optionId) => {
    const opt = SHIPPING_OPTIONS.find(s => s.id === optionId);
    if (opt) { setShippingOption(opt.id); setShippingCost(opt.cost); }
  };

  const updateTier = (idx, field, val) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: parseInt(val) || 0 } : t));
  };
  const addTier = () => {
    if (tiers.length < 3) {
      const lastQty = tiers.length > 0 ? tiers[tiers.length - 1].min_qty + 1 : 2;
      const lastPct = tiers.length > 0 ? tiers[tiers.length - 1].percent_off + 10 : 10;
      setTiers([...tiers, { min_qty: lastQty, percent_off: Math.min(lastPct, 50) }]);
    }
  };
  const removeTier = (idx) => {
    if (tiers.length > 1) setTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePublish = async () => {
    const invalidCards = cards.filter(c => !c.price || parseFloat(c.price) <= 0);
    if (invalidCards.length > 0) { toast.error('All cards must have a price'); return; }
    setPublishing(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/create-pick-your-card`, {
        cards: cards.map(c => ({ id: c.id, label: c.label, price: parseFloat(c.price), quantity: parseInt(c.quantity) || 1 })),
        title,
        condition_id: conditionId,
        shipping_service: shippingOption,
        shipping_cost: shippingCost,
        best_offer: bestOffer,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        // Apply Bulk Savings if enabled (with delay for eBay indexing)
        if (bulkSavings && tiers.length > 0 && res.data.ebay_item_id) {
          toast.info('Applying Bulk Savings (waiting for eBay to index listing)...');
          await new Promise(r => setTimeout(r, 8000));
          try {
            const discountRes = await axios.post(`${API}/api/ebay/sell/volume-discount`, {
              ebay_item_id: res.data.ebay_item_id,
              name: `Bulk Savings - ${title.substring(0, 30)}`,
              tiers: tiers,
              end_days: 30,
            });
            if (discountRes.data.success) {
              toast.success('Bulk Savings applied!');
            } else {
              toast.error('Bulk Savings failed: ' + (discountRes.data.error || '') + '. You can apply it manually from eBay Seller Hub.');
            }
          } catch (discErr) {
            toast.error('Bulk Savings failed. You can apply it from eBay Seller Hub.');
            console.error('Bulk savings error:', discErr);
          }
        }
        onSuccess?.();
      } else {
        toast.error(res.data.error || 'Failed to create listing');
        if (res.data.debug) console.error('eBay Pick Error:', res.data.debug);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create listing');
    } finally {
      setPublishing(false);
    }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <div className="space-y-5 pb-8" data-testid="create-pick-your-card-view">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5" data-testid="pick-back-btn">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Tag className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pick Your Card Listing</h1>
            <p className="text-xs text-gray-500">{items.length} cards as variations in one listing</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
          <span className="ml-3 text-sm text-gray-400">Generating preview...</span>
        </div>
      ) : (
        <div className="max-w-4xl space-y-5">
          {/* Title */}
          <div>
            <label className={labelCls}>Listing Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              className={inputCls} data-testid="pick-title-input" />
            <p className="text-[9px] text-gray-600 mt-1 text-right">{title.length}/80</p>
          </div>

          {/* Bulk Price Setter */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <label className="block text-[11px] uppercase tracking-wider text-emerald-400 mb-2 font-bold">Set Price for All Cards</label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 max-w-[200px]">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input type="number" step="0.01" min="0.01" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                  placeholder="e.g. 0.99" className={`${inputCls} pl-9`} data-testid="pick-bulk-price-input" />
              </div>
              <button onClick={applyBulkPrice} disabled={!bulkPrice || parseFloat(bulkPrice) <= 0}
                className="px-4 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 transition-colors"
                data-testid="pick-apply-bulk-btn">
                Apply to All ({cards.length})
              </button>
            </div>
          </div>

          {/* Cards List with Individual Prices */}
          <div>
            <label className={labelCls}>Cards & Prices ({cards.length})</label>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[44px_1fr_100px_70px] gap-3 px-4 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a]">
                <span className="text-[9px] text-gray-600 uppercase"></span>
                <span className="text-[9px] text-gray-600 uppercase">Card (Variation Label)</span>
                <span className="text-[9px] text-gray-600 uppercase">Price</span>
                <span className="text-[9px] text-gray-600 uppercase">Qty</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-[#1a1a1a]">
                {cards.map((card, idx) => (
                  <div key={card.id || idx} className="grid grid-cols-[44px_1fr_100px_70px] gap-3 px-4 py-2 items-center hover:bg-white/[0.02]" data-testid={`pick-card-row-${idx}`}>
                    <div className="w-10 h-12 rounded bg-[#0a0a0a] overflow-hidden flex items-center justify-center">
                      {card.thumbnail ? (
                        <img src={`data:image/webp;base64,${card.thumbnail}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-gray-700" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white font-semibold truncate">{card.label}</p>
                      <p className="text-[9px] text-gray-600 truncate">{card.year} {card.set_name}</p>
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
                      <input type="number" step="0.01" min="0.01" value={card.price}
                        onChange={e => updateCardPrice(idx, e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded pl-6 pr-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50"
                        data-testid={`pick-price-${idx}`} />
                    </div>
                    <input type="number" min="1" max="99" value={card.quantity}
                      onChange={e => updateCardQty(idx, e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-1.5 text-xs text-white text-center outline-none focus:border-emerald-500/50"
                      data-testid={`pick-qty-${idx}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Condition + Shipping row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Condition</label>
              <select value={conditionId} onChange={e => setConditionId(parseInt(e.target.value))}
                className={inputCls} data-testid="pick-condition-select">
                {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Shipping</label>
              <div className="grid grid-cols-2 gap-2">
                {SHIPPING_OPTIONS.map(s => (
                  <button key={s.id} onClick={() => handleShippingChange(s.id)}
                    className={`px-3 py-2 rounded-lg text-left transition-colors border ${shippingOption === s.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                    data-testid={`pick-shipping-${s.id}`}>
                    <p className={`text-[10px] font-bold ${shippingOption === s.id ? 'text-emerald-400' : 'text-gray-400'}`}>{s.label}</p>
                    <p className="text-[9px] text-gray-600">{s.cost > 0 ? `$${s.cost.toFixed(2)}` : 'Free'}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Best Offer */}
          <label className="flex items-center gap-2 cursor-pointer bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
            <input type="checkbox" checked={bestOffer} onChange={e => setBestOffer(e.target.checked)}
              className="w-4 h-4 rounded bg-[#1a1a1a] border-[#2a2a2a] text-emerald-500 focus:ring-emerald-500"
              data-testid="pick-best-offer-check" />
            <span className="text-xs font-bold text-gray-300">Accept Best Offer</span>
          </label>

          {/* Bulk Savings */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={bulkSavings} onChange={e => setBulkSavings(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1a1a1a] border-[#2a2a2a] text-emerald-500 focus:ring-emerald-500"
                data-testid="pick-bulk-savings-check" />
              <span className="text-xs font-bold text-gray-300">Enable Bulk Savings</span>
              <span className="text-[9px] text-gray-600">(Volume discount when buying multiple)</span>
            </label>
            {bulkSavings && (
              <div className="space-y-2 pl-6">
                {/* Base tier info */}
                <div className="flex items-center gap-3 px-3 py-2 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
                  <span className="text-[10px] text-gray-500 w-16">Buy 1</span>
                  <span className="text-xs text-white font-bold">Full price</span>
                </div>
                {/* Discount tiers */}
                {tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-emerald-500/5 rounded-lg border border-emerald-500/20" data-testid={`bulk-tier-${idx}`}>
                    <span className="text-[10px] text-emerald-400 w-16 shrink-0">Buy</span>
                    <input type="number" min="2" max="10" value={tier.min_qty}
                      onChange={e => updateTier(idx, 'min_qty', e.target.value)}
                      className="w-14 bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-emerald-500/50" />
                    <span className="text-[10px] text-gray-500">+</span>
                    <input type="number" min="1" max="50" value={tier.percent_off}
                      onChange={e => updateTier(idx, 'percent_off', e.target.value)}
                      className="w-14 bg-[#0a0a0a] border border-[#222] rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-emerald-500/50" />
                    <span className="text-[10px] text-emerald-400">% off</span>
                    {tiers.length > 1 && (
                      <button onClick={() => removeTier(idx)} className="text-red-400 text-[10px] hover:text-red-300 ml-auto">Remove</button>
                    )}
                  </div>
                ))}
                {tiers.length < 3 && (
                  <button onClick={addTier}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold" data-testid="add-tier-btn">
                    + Add Tier
                  </button>
                )}
                {/* Preview of final prices */}
                {bulkPrice && parseFloat(bulkPrice) > 0 && (
                  <div className="bg-[#0a0a0a] rounded-lg p-2 mt-1">
                    <p className="text-[9px] text-gray-500 mb-1">Price preview (base ${bulkPrice}):</p>
                    <div className="flex gap-3">
                      <span className="text-[10px] text-white">Buy 1: <b>${parseFloat(bulkPrice).toFixed(2)}</b></span>
                      {tiers.map((t, i) => {
                        const discounted = (parseFloat(bulkPrice) * (1 - t.percent_off / 100)).toFixed(2);
                        return <span key={i} className="text-[10px] text-emerald-400">Buy {t.min_qty}+: <b>${discounted}/ea</b></span>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">How it works on eBay</p>
            <p className="text-[10px] text-gray-500">
              Buyers see a "Pick your card(s)" dropdown to choose which card they want. Each card has its own photo and price. One listing, {cards.length} variations.
            </p>
          </div>

          {/* Publish */}
          <button onClick={handlePublish} disabled={publishing}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-emerald-500 text-black text-sm font-black hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            data-testid="pick-publish-btn">
            {publishing ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Creating {cards.length} Variations on eBay...</>
            ) : (
              <><Send className="w-5 h-5" /> Publish Pick Your Card ({cards.length} variations)</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreatePickYourCardView;
