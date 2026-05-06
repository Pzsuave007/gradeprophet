import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gem, Crown, Loader2, Lock, Package, Trophy, Zap, ShoppingCart, ArrowLeft, Mail, MapPin, User as UserIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const TIER = {
  mini: { label: 'Mini Hit', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/40', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]', icon: Sparkles },
  mid: { label: 'Mid Chase', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/40', glow: 'shadow-[0_0_25px_rgba(245,158,11,0.4)]', icon: Gem },
  blue: { label: 'Blue Chase', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/40', glow: 'shadow-[0_0_30px_rgba(59,130,246,0.5)]', icon: Crown },
};

const PullGamePublicPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPull, setSelectedPull] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const fetchGame = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/pull-game/games/${gameId}`);
      setGame(r.data);
    } catch { toast.error('Game not found'); }
    finally { setLoading(false); }
  }, [gameId]);

  useEffect(() => { fetchGame(); }, [fetchGame]);

  // Poll every 8s for live updates
  useEffect(() => {
    const iv = setInterval(fetchGame, 8000);
    return () => clearInterval(iv);
  }, [fetchGame]);

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  if (!game) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-gray-500">Game not found</div>;

  const remainingChasers = game.chasers.filter(c => !game.claimed_chasers.some(cc => cc.pull_number && game.spots.find(s => s.pull_number === cc.pull_number && s.card?.card_id === c.card_snapshot?.card_id)));
  const odds = game.pulls_remaining > 0 ? Math.max(1, Math.round(game.pulls_remaining / Math.max(1, game.chasers.length - game.claimed_chasers.length))) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white" data-testid="pull-game-public">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0a0a0a] to-transparent border-b border-white/5 sticky top-0 z-20 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-black tracking-tight">{game.name}</h1>
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="text-amber-400 font-bold">{game.pulls_remaining} pulls remaining</span>
              <span>·</span>
              <span>1 in {odds} odds</span>
              {game.blue_chase_alive && <><span>·</span><span className="text-blue-400 font-bold animate-pulse">👀 Blue Chase Still Alive</span></>}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Visible Chasers */}
        <section className="mb-8">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Trophy className="w-3.5 h-3.5" /> Visible Chasers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {game.chasers.map((c, i) => {
              const claimed = game.claimed_chasers.find(cc => game.spots.find(s => s.pull_number === cc.pull_number && s.card?.card_id === c.card_snapshot?.card_id));
              const meta = TIER[c.tier];
              const img = c.card_snapshot?.thumbnail;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className={`relative rounded-xl overflow-hidden border-2 ${claimed ? 'border-red-500/40 grayscale' : `${meta.bg} ${meta.glow}`}`}
                >
                  <div className="aspect-[3/4] bg-[#0a0a0a]">
                    {img ? <img src={`data:image/jpeg;base64,${img}`} alt="" className="w-full h-full object-cover" /> : <Package className="w-12 h-12 text-gray-700 m-auto mt-20" />}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 backdrop-blur">
                      <meta.icon className={`w-3 h-3 ${meta.color}`} />
                      <span className={`text-[9px] font-black uppercase ${meta.color}`}>{meta.label}</span>
                    </div>
                    {claimed && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-lg font-black text-red-400 tracking-wider">CLAIMED</span></div>}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-white truncate">{c.card_snapshot?.title || 'Mystery'}</p>
                    <p className="text-[10px] text-amber-400 font-bold">${c.card_snapshot?.value?.toFixed(0) || '?'}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Pull Board */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-400" /> The Board</h2>
          {game.status !== 'active' ? (
            <div className="py-12 text-center text-gray-500 bg-[#0a0a0a] rounded-xl border border-white/5">
              Game is {game.status}. Check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {game.spots.map(s => {
                const available = s.status === 'available';
                const claimed = s.status === 'claimed';
                const tier = claimed && s.chaser_tier ? TIER[s.chaser_tier] : null;
                return (
                  <button
                    key={s.pull_number}
                    disabled={!available}
                    onClick={() => { setSelectedPull(s); setShowCheckout(true); }}
                    data-testid={`pull-spot-${s.pull_number}`}
                    className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-center transition-all ${
                      available ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer' :
                      claimed && tier ? `${tier.bg} ${tier.glow}` :
                      'bg-[#111] border-white/5 opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <span className={`text-[10px] font-black ${available ? 'text-amber-400' : tier ? tier.color : 'text-gray-600'}`}>#{s.pull_number}</span>
                    {available ? (
                      <span className="text-[11px] font-bold text-white">${s.price}</span>
                    ) : claimed ? (
                      tier ? <tier.icon className={`w-3 h-3 ${tier.color}`} /> : <Lock className="w-3 h-3 text-gray-600" />
                    ) : (
                      <Lock className="w-3 h-3 text-gray-600" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showCheckout && selectedPull && (
          <CheckoutModal
            gameId={gameId}
            spot={selectedPull}
            onClose={() => setShowCheckout(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============== CHECKOUT MODAL ==============
const CheckoutModal = ({ gameId, spot, onClose }) => {
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'US' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email || !email.includes('@')) { toast.error('Valid email required'); return; }
    for (const k of ['first_name', 'last_name', 'line1', 'city', 'state', 'postal_code']) {
      if (!form[k]) { toast.error(`${k.replace('_', ' ')} required`); return; }
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/pull-game/games/${gameId}/buy-pull`, {
        pull_number: spot.pull_number,
        email,
        shipping_address: form,
        origin_url: window.location.origin,
      });
      // Redirect to Stripe
      window.location.href = res.data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout failed');
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        data-testid="checkout-modal"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <span className="text-lg font-black text-amber-400">#{spot.pull_number}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold">Pull #{spot.pull_number}</h3>
            <p className="text-sm text-amber-400 font-bold">${spot.price} USD</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
            <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" data-testid="guest-email" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="First name" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} data-testid="ship-first-name" />
            <input className={inputCls} placeholder="Last name" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
          </div>
          <input className={inputCls} placeholder="Address line 1" value={form.line1} onChange={e => setForm(f => ({ ...f, line1: e.target.value }))} data-testid="ship-line1" />
          <input className={inputCls} placeholder="Address line 2 (optional)" value={form.line2} onChange={e => setForm(f => ({ ...f, line2: e.target.value }))} />
          <div className="grid grid-cols-3 gap-2">
            <input className={inputCls} placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            <input className={inputCls} placeholder="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
            <input className={inputCls} placeholder="ZIP" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-black font-black transition-colors"
          data-testid="checkout-submit-btn"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
          {submitting ? 'Creating session...' : `Pay $${spot.price} & Pull`}
        </button>
        <p className="text-[10px] text-gray-500 text-center mt-3">Secure payment via Stripe. Card ships within 1 business day.</p>
      </motion.div>
    </motion.div>
  );
};

export default PullGamePublicPage;
