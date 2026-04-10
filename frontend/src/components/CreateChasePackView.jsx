import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Flame, DollarSign, Send, RefreshCw, Star, Truck, Package } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SHIPPING_OPTIONS = [
  { id: 'FreeShipping', label: 'Free Shipping', cost: 0 },
  { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50 },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50 },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50 },
];

const CreateChasePackView = ({ items, onBack, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [chaseCardId, setChaseCardId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [shippingOption, setShippingOption] = useState('USPSFirstClass');
  const [shippingCost, setShippingCost] = useState(4.50);

  // Auto-select the first card with highest value as chase
  useEffect(() => {
    if (items.length > 0 && !chaseCardId) {
      const sorted = [...items].sort((a, b) => {
        const va = a.card_value || a.listed_price || a.purchase_price || 0;
        const vb = b.card_value || b.listed_price || b.purchase_price || 0;
        return Number(vb) - Number(va);
      });
      setChaseCardId(sorted[0].id);
    }
  }, [items, chaseCardId]);

  const fetchPreview = useCallback(async () => {
    if (!chaseCardId) return;
    setLoading(true);
    try {
      const ids = items.map(c => c.id);
      const res = await axios.post(`${API}/api/ebay/sell/chase-preview`, { card_ids: ids, chase_card_id: chaseCardId });
      setPreview(res.data);
      setTitle(res.data.title);
      setDescription(res.data.description);
      if (res.data.suggested_price > 0) setPrice(String(res.data.suggested_price));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }, [items, chaseCardId]);

  useEffect(() => {
    if (chaseCardId) fetchPreview();
  }, [chaseCardId, fetchPreview]);

  const publish = async () => {
    if (!title || !price || !chaseCardId) {
      toast.error('Title, price, and chase card are required');
      return;
    }
    setPublishing(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/create-chase-pack`, {
        card_ids: items.map(c => c.id),
        chase_card_id: chaseCardId,
        title,
        description,
        price: parseFloat(price),
        condition_id: 4000,
        shipping_option: shippingOption,
        shipping_cost: shippingCost,
        best_offer: false,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        onSuccess();
      } else {
        toast.error(res.data.error || 'Failed to create listing');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create listing');
    } finally {
      setPublishing(false);
    }
  };

  const getCardValue = (item) => {
    const v = item.card_value || item.listed_price || item.purchase_price || 0;
    return Number(v);
  };

  const totalValue = items.reduce((sum, i) => sum + getCardValue(i), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 sm:p-6" data-testid="create-chase-pack-view">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-[#111] transition-colors" data-testid="chase-back-btn">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" /> Create Chase Card Pack
          </h1>
          <p className="text-xs text-gray-500">{items.length} cards selected</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Card Selection & Chase picker */}
        <div className="space-y-4">
          {/* Chase Card Selector */}
          <div className="bg-[#111] border border-orange-500/30 rounded-xl p-4">
            <h3 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" /> Select Chase Card
            </h3>
            <p className="text-[10px] text-gray-500 mb-3">Tap a card to set it as the CHASE (main attraction)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[500px] overflow-y-auto">
              {items.map(item => {
                const isChase = item.id === chaseCardId;
                const val = getCardValue(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => setChaseCardId(item.id)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${isChase ? 'border-orange-500 ring-2 ring-orange-500/30 scale-105' : 'border-[#222] hover:border-gray-600'}`}
                    data-testid={`chase-card-${item.id}`}
                  >
                    {item.thumbnail || item.image ? (
                      <img src={`data:image/jpeg;base64,${item.thumbnail || item.image}`} alt={item.player} className="w-full aspect-[3/4] object-cover" />
                    ) : (
                      <div className="w-full aspect-[3/4] bg-[#1a1a1a] flex items-center justify-center text-xs text-gray-600">No img</div>
                    )}
                    {isChase && (
                      <div className="absolute top-1 left-1 bg-orange-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full">
                        CHASE
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5">
                      <p className="text-[8px] text-white truncate font-medium">{item.player}</p>
                      {val > 0 && <p className="text-[8px] text-emerald-400 font-bold">${val.toFixed(2)}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Pricing
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-[#0a0a0a] rounded-lg p-3 border border-[#222]">
                <p className="text-[10px] text-gray-500 uppercase">Total Value</p>
                <p className="text-lg font-black text-white">${totalValue.toFixed(2)}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-3 border border-[#222]">
                <p className="text-[10px] text-gray-500 uppercase">Suggested/Spot</p>
                <p className="text-lg font-black text-emerald-400">${preview?.suggested_price?.toFixed(2) || '...'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-500">Spots</p>
                <p className="text-sm font-bold text-white">{items.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Revenue (est.)</p>
                <p className="text-sm font-bold text-emerald-400">${(parseFloat(price || 0) * items.length).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview & Settings */}
        <div className="space-y-4">
          {/* Collage Preview */}
          {loading ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-8 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
              <span className="ml-2 text-sm text-gray-400">Generating preview...</span>
            </div>
          ) : preview?.collage ? (
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-2">eBay Preview</p>
              <img src={`data:image/jpeg;base64,${preview.collage}`} alt="Chase Pack Collage" className="w-full rounded-lg" />
            </div>
          ) : null}

          {/* Title */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase mb-1 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value.slice(0, 80))}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 outline-none"
              data-testid="chase-title-input" />
            <p className="text-[10px] text-gray-600 mt-1">{title.length}/80</p>
          </div>

          {/* Price per spot */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase mb-1 block">Price per Spot ($)</label>
            <input type="number" step="0.01" min="0.99" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500/50 outline-none"
              data-testid="chase-price-input" />
          </div>

          {/* Shipping */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase mb-1 block flex items-center gap-1">
              <Truck className="w-3 h-3" /> Shipping
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SHIPPING_OPTIONS.map(opt => (
                <button key={opt.id}
                  onClick={() => { setShippingOption(opt.id); setShippingCost(opt.cost); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${shippingOption === opt.id ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-[#0a0a0a] border-[#222] text-gray-400 hover:text-white'}`}
                  data-testid={`chase-ship-${opt.id}`}>
                  {opt.label} {opt.cost > 0 ? `$${opt.cost.toFixed(2)}` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Publish Button */}
          <button onClick={publish} disabled={publishing || loading || !title || !price || !chaseCardId}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white text-sm font-black hover:from-orange-500 hover:to-red-500 disabled:opacity-40 transition-all"
            data-testid="chase-publish-btn">
            {publishing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Listing on eBay...</>
            ) : (
              <><Flame className="w-4 h-4" /> List Chase Pack on eBay ({items.length} spots)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateChasePackView;
