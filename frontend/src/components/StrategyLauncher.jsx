import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, ArrowLeft, ArrowRight, Search, X, Package, CheckCircle, Gavel, DollarSign, Loader2, AlertCircle, Zap, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const StrategyLauncher = ({ onBack, onDone }) => {
  const [step, setStep] = useState(1);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [auctionIds, setAuctionIds] = useState(new Set());
  const [prices, setPrices] = useState({});
  const [lookingUp, setLookingUp] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [config, setConfig] = useState({
    auction_start_pct: 50,
    auto_decline_pct: 70,
    auto_accept_pct: 10,
    shipping_option: 'USPSFirstClass',
    shipping_cost: 1.50,
    batch_size: 5,
  });

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await axios.get(`${API}/api/inventory?category=for_sale&listed=false&limit=500`, { withCredentials: true });
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

  const toggleAuction = (id) => {
    setAuctionIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedCards = cards.filter(c => selected.includes(c.id));
  const auctionCards = selectedCards.filter(c => auctionIds.has(c.id));
  const fixedCards = selectedCards.filter(c => !auctionIds.has(c.id));

  const lookupPrices = async () => {
    setLookingUp(true);
    const newPrices = { ...prices };
    for (const card of selectedCards) {
      if (newPrices[card.id]) continue;
      // Use card_value or listed_price if available
      const existingPrice = card.card_value || card.listed_price || card.purchase_price;
      if (existingPrice && parseFloat(existingPrice) > 0) {
        newPrices[card.id] = parseFloat(existingPrice);
        continue;
      }
      // Try market lookup
      try {
        const parts = [card.year, card.set_name, card.player].filter(Boolean).join(' ');
        if (parts) {
          const res = await axios.post(`${API}/api/ebay/sell/preview`, { inventory_item_id: card.id }, { withCredentials: true });
          if (res.data.market_data?.market_value) {
            newPrices[card.id] = res.data.market_data.market_value;
          } else if (res.data.suggested_price) {
            newPrices[card.id] = res.data.suggested_price;
          }
        }
      } catch {}
    }
    setPrices(newPrices);
    setLookingUp(false);
    const found = Object.keys(newPrices).length;
    const missing = selectedCards.length - found;
    if (missing > 0) toast.info(`${missing} cards need manual pricing`);
    else toast.success('All prices found!');
  };

  const handleLaunch = async () => {
    const missingPrice = selectedCards.filter(c => !prices[c.id] || prices[c.id] <= 0);
    if (missingPrice.length > 0) {
      toast.error(`${missingPrice.length} cards still need a price`);
      return;
    }
    setLaunching(true);
    try {
      const res = await axios.post(`${API}/api/schedule/launch-strategy`, {
        auction_card_ids: Array.from(auctionIds),
        fixed_card_ids: fixedCards.map(c => c.id),
        prices,
        auction_start_pct: config.auction_start_pct,
        auto_decline_pct: config.auto_decline_pct,
        auto_accept_pct: config.auto_accept_pct,
        shipping_option: config.shipping_option,
        shipping_cost: config.shipping_cost,
        batch_size: config.batch_size,
      }, { withCredentials: true });
      toast.success(res.data.note);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to launch strategy');
    } finally { setLaunching(false); }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/30";
  const labelCls = "text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 block";

  return (
    <div data-testid="strategy-launcher">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5" data-testid="strategy-back-btn">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-amber-400" /> eBay Strategy Launcher
          </h2>
          <p className="text-[10px] text-gray-500">Auctions drive traffic, Fixed Price closes sales</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-1.5 rounded-full transition-colors ${step >= s ? 'bg-amber-500' : 'bg-white/[0.06]'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Select Cards */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..."
                  className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-white/10"
                  data-testid="strategy-search" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-gray-500" /></button>}
              </div>
              <button onClick={() => {
                const vis = filtered.map(c => c.id);
                if (vis.every(id => selected.includes(id))) setSelected(s => s.filter(id => !vis.includes(id)));
                else setSelected(s => [...new Set([...s, ...vis])]);
              }} className="text-xs text-amber-400 hover:text-amber-300 font-bold shrink-0" data-testid="strategy-select-all">
                {filtered.length > 0 && filtered.every(c => selected.includes(c.id)) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {filtered.map(c => {
                  const sel = selected.includes(c.id);
                  const img = c.thumbnail || c.store_thumbnail || c.image;
                  return (
                    <motion.div key={c.id} whileTap={{ scale: 0.97 }} onClick={() => toggle(c.id)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${sel ? 'border-amber-500/60 bg-amber-500/5' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.04]'}`}
                      data-testid={`strategy-card-${c.id}`}>
                      {img && <img src={`data:image/jpeg;base64,${img}`} alt={c.player} className="w-full aspect-[3/4] object-cover" />}
                      {!img && <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center"><Package className="w-5 h-5 text-gray-700" /></div>}
                      <div className="p-1">
                        <p className="text-[9px] font-bold text-white truncate">{c.player}</p>
                        <p className="text-[8px] text-gray-500 truncate">{c.year} {c.set_name}</p>
                      </div>
                      {sel && <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"><CheckCircle className="w-2.5 h-2.5 text-black" /></div>}
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.04]">
              <p className="text-xs text-gray-500">{selected.length} cards selected</p>
              <button onClick={() => { if (selected.length < 2) { toast.error('Select at least 2 cards'); return; } setStep(2); }}
                disabled={selected.length < 2}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black text-sm font-black disabled:opacity-30"
                data-testid="strategy-next-step1">
                Next: Pick Auctions <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Pick Auction Items + Set Prices */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <p className="text-xs text-amber-400 font-bold">Tap cards to mark as AUCTION (traffic drivers)</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Auctions post 1/day. Everything else posts as fixed price in batches of {config.batch_size}/day.</p>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={lookupPrices} disabled={lookingUp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-bold hover:bg-[#3b82f6]/30 disabled:opacity-50 transition-colors"
                data-testid="strategy-lookup-prices">
                {lookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {lookingUp ? 'Looking up...' : 'Auto-Lookup Prices'}
              </button>
              <div className="flex items-center gap-3 ml-auto text-[10px]">
                <span className="text-amber-400 font-bold"><Gavel className="w-3 h-3 inline" /> {auctionCards.length} Auctions</span>
                <span className="text-emerald-400 font-bold"><DollarSign className="w-3 h-3 inline" /> {fixedCards.length} Fixed</span>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {selectedCards.map(c => {
                const isAuction = auctionIds.has(c.id);
                const img = c.thumbnail || c.store_thumbnail || c.image;
                const hasPrice = prices[c.id] && prices[c.id] > 0;
                return (
                  <div key={c.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${isAuction ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/[0.04] bg-white/[0.02]'}`}>
                    <button onClick={() => toggleAuction(c.id)}
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isAuction ? 'bg-amber-500 text-black' : 'bg-white/[0.04] text-gray-500 hover:text-white'}`}
                      data-testid={`strategy-toggle-auction-${c.id}`}>
                      <Gavel className="w-4 h-4" />
                    </button>
                    <div className="w-8 h-10 rounded-lg overflow-hidden bg-[#111] shrink-0">
                      {img ? <img src={`data:image/jpeg;base64,${img}`} alt="" className="w-full h-full object-cover" /> : <Package className="w-3 h-3 text-gray-700 m-auto mt-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.player}</p>
                      <p className="text-[9px] text-gray-500 truncate">{c.year} {c.set_name}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isAuction ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {isAuction ? 'AUCTION' : 'FIXED'}
                    </span>
                    <div className="w-24 shrink-0">
                      <input type="number" step="0.01" min="0"
                        className={`w-full bg-[#0a0a0a] border rounded-lg px-2 py-1.5 text-xs text-right text-white outline-none ${hasPrice ? 'border-white/[0.06]' : 'border-red-500/40'}`}
                        value={prices[c.id] || ''}
                        onChange={e => setPrices(p => ({ ...p, [c.id]: e.target.value ? parseFloat(e.target.value) : '' }))}
                        placeholder="$0.00"
                        data-testid={`strategy-price-${c.id}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.04]">
              <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-white font-bold" data-testid="strategy-back-step2">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
              </button>
              <button onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black text-sm font-black"
                data-testid="strategy-next-step2">
                Next: Review & Launch <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Configure & Launch */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                <p className="text-2xl font-black text-amber-400">{auctionCards.length}</p>
                <p className="text-[10px] text-gray-500 font-bold">AUCTIONS</p>
                <p className="text-[9px] text-gray-600">1 per day</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <p className="text-2xl font-black text-emerald-400">{fixedCards.length}</p>
                <p className="text-[10px] text-gray-500 font-bold">FIXED PRICE</p>
                <p className="text-[9px] text-gray-600">{config.batch_size}/day batches</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                <p className="text-2xl font-black text-white">{Math.max(auctionCards.length, Math.ceil(fixedCards.length / config.batch_size))}</p>
                <p className="text-[10px] text-gray-500 font-bold">TOTAL DAYS</p>
                <p className="text-[9px] text-gray-600">to complete</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                <p className="text-2xl font-black text-white">{selected.length}</p>
                <p className="text-[10px] text-gray-500 font-bold">TOTAL CARDS</p>
                <p className="text-[9px] text-gray-600">in strategy</p>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div>
                <label className={labelCls}>Auction Start %</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="10" max="90" step="5" value={config.auction_start_pct}
                    onChange={e => setConfig(c => ({ ...c, auction_start_pct: e.target.value }))}
                    className={inputCls + " text-center"} data-testid="strategy-auction-pct" />
                  <span className="text-[10px] text-gray-500">% of comp</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Auction starting bid</p>
              </div>
              <div>
                <label className={labelCls}>Auto-Decline %</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="99" step="5" value={config.auto_decline_pct}
                    onChange={e => setConfig(c => ({ ...c, auto_decline_pct: e.target.value }))}
                    className={inputCls + " text-center"} data-testid="strategy-decline-pct" />
                  <span className="text-[10px] text-gray-500">%</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Reject offers below</p>
              </div>
              <div>
                <label className={labelCls}>Auto-Accept %</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="99" step="5" value={config.auto_accept_pct}
                    onChange={e => setConfig(c => ({ ...c, auto_accept_pct: e.target.value }))}
                    className={inputCls + " text-center"} data-testid="strategy-accept-pct" />
                  <span className="text-[10px] text-gray-500">%</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Accept within</p>
              </div>
              <div>
                <label className={labelCls}>Batch Size</label>
                <input type="number" min="3" max="10" step="1" value={config.batch_size}
                  onChange={e => setConfig(c => ({ ...c, batch_size: parseInt(e.target.value) || 5 }))}
                  className={inputCls + " text-center"} data-testid="strategy-batch-size" />
                <p className="text-[9px] text-gray-600 mt-1">Fixed price per day</p>
              </div>
              <div>
                <label className={labelCls}>Shipping</label>
                <select value={config.shipping_option} onChange={e => setConfig(c => ({ ...c, shipping_option: e.target.value }))}
                  className={inputCls} data-testid="strategy-shipping">
                  <option value="FreeShipping">Free Shipping</option>
                  <option value="USPSFirstClass">USPS First Class</option>
                  <option value="USPSPriority">USPS Priority</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ship Cost</label>
                <input type="number" step="0.50" value={config.shipping_cost}
                  onChange={e => setConfig(c => ({ ...c, shipping_cost: parseFloat(e.target.value) || 0 }))}
                  className={inputCls + " text-center"} data-testid="strategy-ship-cost" />
              </div>
            </div>

            {/* Missing Prices Warning */}
            {selectedCards.some(c => !prices[c.id] || prices[c.id] <= 0) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">
                  {selectedCards.filter(c => !prices[c.id] || prices[c.id] <= 0).length} cards need a price. Go back and set them manually.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/[0.04]">
              <button onClick={() => setStep(2)} className="text-xs text-gray-400 hover:text-white font-bold" data-testid="strategy-back-step3">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
              </button>
              <button onClick={handleLaunch} disabled={launching || selectedCards.some(c => !prices[c.id] || prices[c.id] <= 0)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black text-sm font-black disabled:opacity-30 hover:shadow-lg hover:shadow-amber-500/20 transition-shadow"
                data-testid="strategy-launch-btn">
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {launching ? 'Launching...' : 'Launch Strategy'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StrategyLauncher;
