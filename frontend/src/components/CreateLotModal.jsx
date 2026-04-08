import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, DollarSign, Tag, Truck, Send, RefreshCw, Layers, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SHIPPING_OPTIONS = [
  { id: 'USPSFirstClass', label: 'USPS First Class', cost: 0 },
  { id: 'USPSPriority', label: 'USPS Priority', cost: 0 },
  { id: 'USPSGroundAdvantage', label: 'USPS Ground Advantage', cost: 0 },
  { id: 'FedExHomeDelivery', label: 'FedEx Home Delivery', cost: 0 },
];

const CONDITION_OPTIONS = [
  { id: 3000, label: 'Very Good' },
  { id: 4000, label: 'Good' },
  { id: 5000, label: 'Acceptable' },
  { id: 1000, label: 'New' },
];

const CreateLotModal = ({ isOpen, onClose, selectedCards, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [conditionId, setConditionId] = useState(4000);
  const [conditionDesc, setConditionDesc] = useState('');
  const [shippingService, setShippingService] = useState('USPSFirstClass');
  const [shippingCost, setShippingCost] = useState(0);
  const [bestOffer, setBestOffer] = useState(true);
  const [minOffer, setMinOffer] = useState('');
  const [autoAccept, setAutoAccept] = useState('');

  useEffect(() => {
    if (!isOpen || !selectedCards?.length) return;
    fetchPreview();
  }, [isOpen, selectedCards]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const ids = selectedCards.map(c => c.id);
      const res = await axios.post(`${API}/api/ebay/sell/lot-preview`, { card_ids: ids });
      setPreview(res.data);
      setTitle(res.data.title);
      if (res.data.suggested_price > 0) setPrice(String(res.data.suggested_price));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate lot preview');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!price || parseFloat(price) <= 0) { toast.error('Set a price for the lot'); return; }
    setPublishing(true);
    try {
      const res = await axios.post(`${API}/api/ebay/sell/create-lot`, {
        card_ids: selectedCards.map(c => c.id),
        title,
        price: parseFloat(price),
        condition_id: conditionId,
        condition_description: conditionDesc || undefined,
        shipping_service: shippingService,
        shipping_cost: shippingCost,
        best_offer: bestOffer,
        minimum_offer: minOffer ? parseFloat(minOffer) : undefined,
        auto_accept: autoAccept ? parseFloat(autoAccept) : undefined,
      });
      if (res.data.success) {
        toast.success(res.data.message);
        onSuccess?.();
        onClose();
      } else {
        toast.error(res.data.error || 'Failed to create lot listing');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create lot listing');
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}
        data-testid="lot-modal">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0f0f0f] border-b border-[#1a1a1a] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">Create Lot Listing</h2>
                <p className="text-[10px] text-gray-500">{selectedCards?.length || 0} cards selected</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" data-testid="lot-close-btn">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <span className="ml-3 text-sm text-gray-400">Generating lot preview...</span>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Cards preview grid */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cards in Lot ({preview?.card_count || selectedCards?.length})</label>
                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                  {(preview?.cards || []).map((card, i) => (
                    <div key={card.id || i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden" data-testid={`lot-card-${i}`}>
                      <div className="aspect-[3/4] bg-[#111] flex items-center justify-center overflow-hidden">
                        {card.thumbnail ? (
                          <img src={`data:image/jpeg;base64,${card.thumbnail}`} alt="" className="w-full h-full object-cover" />
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
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Listing Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50"
                  data-testid="lot-title-input" />
                <p className="text-[9px] text-gray-600 mt-1 text-right">{title.length}/80</p>
              </div>

              {/* Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Lot Price <span className="text-amber-400 font-normal">(suggested: ${preview?.suggested_price || '0'})</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input type="number" step="0.01" min="0.99" value={price} onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50"
                      data-testid="lot-price-input" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Condition</label>
                  <select value={conditionId} onChange={e => setConditionId(parseInt(e.target.value))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50"
                    data-testid="lot-condition-select">
                    {CONDITION_OPTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Shipping */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Shipping</label>
                  <select value={shippingService} onChange={e => setShippingService(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50"
                    data-testid="lot-shipping-select">
                    {SHIPPING_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Shipping Cost</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input type="number" step="0.01" min="0" value={shippingCost} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50"
                      data-testid="lot-shipping-cost-input" />
                  </div>
                </div>
              </div>

              {/* Best Offer */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
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
                          className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500/50"
                          data-testid="lot-auto-accept-input" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Decline Below</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                        <input type="number" step="0.01" min="0" value={minOffer} onChange={e => setMinOffer(e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500/50"
                          data-testid="lot-min-offer-input" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description preview */}
              {preview?.description && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description Preview</label>
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 max-h-40 overflow-y-auto text-xs text-gray-300"
                    dangerouslySetInnerHTML={{ __html: preview.description }}
                    data-testid="lot-description-preview" />
                </div>
              )}

              {/* Photo info */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <p className="text-[10px] text-amber-400 font-bold uppercase mb-1">Photos (auto-generated)</p>
                <p className="text-[10px] text-gray-500">
                  Collage images showing all cards together + individual front & back photos of each card.
                  Up to 24 photos will be uploaded to eBay.
                </p>
              </div>

              {/* Publish button */}
              <button onClick={handlePublish} disabled={publishing || !price}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-amber-500 text-black text-sm font-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                data-testid="lot-publish-btn">
                {publishing ? (
                  <><RefreshCw className="w-5 h-5 animate-spin" /> Publishing Lot to eBay...</>
                ) : (
                  <><Send className="w-5 h-5" /> Publish Lot ({selectedCards?.length} cards) to eBay</>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateLotModal;
