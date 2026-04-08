import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Layers, DollarSign, Send, RefreshCw, Image as ImageIcon, Package, Truck, Tag } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SHIPPING_OPTIONS = [
  { id: 'FreeShipping', label: 'Free Shipping', cost: 0, desc: 'You cover shipping cost' },
  { id: 'PWEEnvelope', label: 'PWE Envelope', cost: 2.50, desc: 'Raw cards in envelope (US)' },
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 4.50, desc: 'Standard envelope/package' },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 8.50, desc: 'Faster 1-3 day delivery' },
];

const CONDITIONS = [
  { id: 400010, label: 'Near Mint or Better', desc: 'Pack fresh / Mint condition' },
  { id: 400011, label: 'Excellent', desc: 'Minor corner/edge wear' },
  { id: 400012, label: 'Very Good', desc: 'Visible wear, still presentable' },
  { id: 400013, label: 'Poor', desc: 'Heavy wear, creases, or damage' },
];

const CreateLotView = ({ items, onBack, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [conditionId, setConditionId] = useState(400010);
  const [conditionDesc, setConditionDesc] = useState('');
  const [shippingOption, setShippingOption] = useState('USPSFirstClass');
  const [shippingCost, setShippingCost] = useState(4.50);
  const [bestOffer, setBestOffer] = useState(true);
  const [minOffer, setMinOffer] = useState('');
  const [autoAccept, setAutoAccept] = useState('');

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const ids = items.map(c => c.id);
      const res = await axios.post(`${API}/api/ebay/sell/lot-preview`, { card_ids: ids });
      setPreview(res.data);
      setTitle(res.data.title);
      if (res.data.suggested_price > 0) setPrice(String(res.data.suggested_price));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate lot preview');
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (items?.length) fetchPreview();
  }, [items, fetchPreview]);

  const handleShippingChange = (optionId) => {
    const opt = SHIPPING_OPTIONS.find(s => s.id === optionId);
    if (opt) {
      setShippingOption(opt.id);
      setShippingCost(opt.cost);
    }
  };

  const handlePublish = async () => {
    if (!price || parseFloat(price) <= 0) { toast.error('Set a price for the lot'); return; }
    setPublishing(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/create-lot`, {
        card_ids: items.map(c => c.id),
        title,
        price: parseFloat(price),
        condition_id: conditionId,
        condition_description: conditionDesc || undefined,
        shipping_service: shippingOption,
        shipping_cost: shippingCost,
        best_offer: bestOffer,
        minimum_offer: minOffer ? parseFloat(minOffer) : undefined,
        auto_accept: autoAccept ? parseFloat(autoAccept) : undefined,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        onSuccess?.();
      } else {
        toast.error(res.data.error || 'Failed to create lot listing');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create lot listing');
    } finally {
      setPublishing(false);
    }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <div className="space-y-5 pb-8" data-testid="create-lot-view">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5" data-testid="lot-back-btn">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Create Lot Listing</h1>
            <p className="text-xs text-gray-500">{items.length} cards selected</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
          <span className="ml-3 text-sm text-gray-400">Generating lot preview...</span>
        </div>
      ) : (
        <div className="max-w-3xl space-y-5">
          {/* Collage Preview */}
          {preview?.collage_preview && (
            <div>
              <label className={labelCls}>Lot Photo Preview</label>
              <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 flex items-center justify-center">
                <img
                  src={`data:image/jpeg;base64,${preview.collage_preview}`}
                  alt="Lot collage preview"
                  className="max-w-full max-h-[300px] object-contain rounded-lg"
                  data-testid="lot-collage-preview"
                />
              </div>
              <p className="text-[9px] text-gray-600 mt-1">This collage + individual card photos will be uploaded to eBay</p>
            </div>
          )}

          {/* Cards in Lot */}
          <div>
            <label className={labelCls}>Cards in Lot ({items.length})</label>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {items.map((card, i) => (
                <div key={card.id || i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden" data-testid={`lot-card-${i}`}>
                  <div className="aspect-[3/4] bg-[#111] flex items-center justify-center overflow-hidden">
                    {card.store_thumbnail || card.thumbnail ? (
                      <img src={`data:image/${card.store_thumbnail ? 'webp' : 'jpeg'};base64,${card.store_thumbnail || card.thumbnail}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-700" />
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="text-[9px] text-white font-semibold truncate">{card.player || card.card_name}</p>
                    <p className="text-[8px] text-gray-600 truncate">{card.year} {card.set_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Listing Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              className={inputCls} data-testid="lot-title-input" />
            <p className="text-[9px] text-gray-600 mt-1 text-right">{title.length}/80</p>
          </div>

          {/* Price + Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Lot Price {preview?.suggested_price ? <span className="text-amber-400 font-normal">(suggested: ${preview.suggested_price})</span> : null}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input type="number" step="0.01" min="0.99" value={price} onChange={e => setPrice(e.target.value)}
                  placeholder="0.00" className={`${inputCls} pl-9`} data-testid="lot-price-input" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Condition</label>
              <select value={conditionId} onChange={e => setConditionId(parseInt(e.target.value))}
                className={inputCls} data-testid="lot-condition-select">
                {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <p className="text-[9px] text-gray-600 mt-1">{CONDITIONS.find(c => c.id === conditionId)?.desc}</p>
            </div>
          </div>

          {/* Shipping */}
          <div>
            <label className={labelCls}>Shipping</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SHIPPING_OPTIONS.map(s => (
                <button key={s.id} onClick={() => handleShippingChange(s.id)}
                  className={`px-3 py-2.5 rounded-lg text-left transition-colors border ${shippingOption === s.id ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#2a2a2a]'}`}
                  data-testid={`lot-shipping-${s.id}`}>
                  <p className={`text-xs font-bold ${shippingOption === s.id ? 'text-amber-400' : 'text-gray-400'}`}>{s.label}</p>
                  <p className="text-[10px] text-gray-600">{s.cost > 0 ? `$${s.cost.toFixed(2)}` : 'Free'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Best Offer */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={bestOffer} onChange={e => setBestOffer(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1a1a1a] border-[#2a2a2a] text-amber-500 focus:ring-amber-500"
                data-testid="lot-best-offer-check" />
              <span className="text-xs font-bold text-gray-300">Accept Best Offer</span>
            </label>
            {bestOffer && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Auto-Accept Above</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input type="number" step="0.01" min="0" value={autoAccept} onChange={e => setAutoAccept(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500/50"
                      data-testid="lot-auto-accept-input" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Decline Below</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input type="number" step="0.01" min="0" value={minOffer} onChange={e => setMinOffer(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500/50"
                      data-testid="lot-min-offer-input" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description preview */}
          {preview?.description && (
            <div>
              <label className={labelCls}>Description Preview</label>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 max-h-40 overflow-y-auto text-xs text-gray-300"
                dangerouslySetInnerHTML={{ __html: preview.description }}
                data-testid="lot-description-preview" />
            </div>
          )}

          {/* Photo info */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[10px] text-amber-400 font-bold uppercase mb-1">Photos (auto-generated)</p>
            <p className="text-[10px] text-gray-500">
              Collage images + individual front & back photos of each card. Up to 24 photos uploaded to eBay.
            </p>
          </div>

          {/* Publish button */}
          <button onClick={handlePublish} disabled={publishing || !price}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-amber-500 text-black text-sm font-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            data-testid="lot-publish-btn">
            {publishing ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Publishing Lot to eBay...</>
            ) : (
              <><Send className="w-5 h-5" /> Publish Lot ({items.length} cards) to eBay</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateLotView;
