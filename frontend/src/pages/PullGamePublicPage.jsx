import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, Loader2, Lock, Package, Gift, Zap, ShoppingCart, ArrowLeft, Mail, Trophy } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const RED_CHASE = { label: 'CHASE', color: 'text-red-400', border: 'border-red-500/50', glow: 'shadow-[0_0_30px_rgba(239,68,68,0.4)]', bgGrad: 'from-red-500/10 to-red-900/5' };
const BLUE_CHASE = { label: 'BLUE CHASE', color: 'text-blue-300', border: 'border-blue-400/60', glow: 'shadow-[0_0_50px_rgba(59,130,246,0.6)]', bgGrad: 'from-blue-500/20 to-blue-900/10' };
const ORANGE_MEGA = { label: 'MEGA BOX', color: 'text-amber-300', border: 'border-amber-500/60', glow: 'shadow-[0_0_35px_rgba(245,158,11,0.5)]', bgGrad: 'from-amber-500/15 to-orange-900/10' };

const PullGamePublicPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPull, setSelectedPull] = useState(null);

  const fetchGame = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/pull-game/games/${gameId}`);
      setGame(r.data);
    } catch { toast.error('Game not found'); }
    finally { setLoading(false); }
  }, [gameId]);

  useEffect(() => { fetchGame(); }, [fetchGame]);
  useEffect(() => {
    const iv = setInterval(fetchGame, 8000);
    return () => clearInterval(iv);
  }, [fetchGame]);

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  if (!game) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-gray-500">Game not found</div>;

  const blueChaser = game.chasers.find(c => c.tier === 'blue');
  const redChasers = game.chasers.filter(c => c.tier !== 'blue');
  // Mega box cards are on the game object (admin-created list) - exposed via the spots that match mega_box_cards
  // We need them from the game API. Since public game endpoint returns mega_box_cards via game.chasers?
  // Actually mega_box_cards is a separate field on the game - we expose it via /games/{id} but currently don't. Let me add to _public_game.
  const megaCards = game.mega_box_cards || [];
  const blueAlive = game.blue_chase_alive;
  const claimedByCardId = new Set(
    game.spots.filter(s => s.status === 'claimed' && s.card).map(s => s.card.card_id)
  );

  const odds = game.pulls_remaining > 0 ? Math.max(1, Math.round(game.pulls_remaining / Math.max(1, game.chasers.length - game.claimed_chasers.length))) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden" data-testid="pull-game-public">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_100%,rgba(245,158,11,0.05),transparent_50%)] pointer-events-none" />

      {/* Header */}
      <div className="border-b border-white/5 sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-lg">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/5" data-testid="back-btn"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">{game.name}</h1>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
              <span className="text-amber-400 font-bold">{game.pulls_remaining} / {game.total_pulls} remaining</span>
              <span>·</span>
              <span>1 in {odds} odds</span>
              {blueAlive && <><span>·</span><span className="text-blue-400 font-bold animate-pulse">👀 Blue Chase Alive</span></>}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </div>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-6 lg:gap-8 items-start">
          {/* LEFT: Blue Chase */}
          <div className="order-2 lg:order-1">
            <SectionHeading icon={Crown} label="Blue Chase" tone="blue" />
            {blueChaser ? (
              <BigChaseCard
                tier={BLUE_CHASE}
                card={blueChaser.card_snapshot}
                claimed={claimedByCardId.has(blueChaser.card_snapshot?.card_id)}
                massive
              />
            ) : (
              <EmptyTile label="No Blue Chase" />
            )}
          </div>

          {/* CENTER: Tilted Recipe Box with pull numbers */}
          <div className="order-1 lg:order-2" data-testid="board-section">
            <SectionHeading icon={Zap} label="The Board" tone="amber" />
            <RecipeBox game={game} onSelect={setSelectedPull} />
          </div>

          {/* RIGHT: Mega Boxes */}
          <div className="order-3">
            <SectionHeading icon={Gift} label="Mega Box Chases" tone="amber" />
            <MegaBoxDisplay cards={megaCards} claimed={game.mega_box_claimed_index !== null && game.mega_box_claimed_index !== undefined} />
          </div>
        </div>

        {/* BOTTOM: Red Chases */}
        <div className="mt-10 lg:mt-14" data-testid="red-chases-section">
          <SectionHeading icon={Trophy} label={`Chasers (${redChasers.length})`} tone="red" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {redChasers.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <RedChaseCard
                  card={c.card_snapshot}
                  claimed={claimedByCardId.has(c.card_snapshot?.card_id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedPull && (
          <CheckoutModal gameId={gameId} spot={selectedPull} onClose={() => setSelectedPull(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ──────── Sub-components ────────

const SectionHeading = ({ icon: Icon, label, tone }) => {
  const colorMap = {
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`w-4 h-4 ${colorMap[tone]}`} />
      <h2 className={`text-xs font-black uppercase tracking-[0.25em] ${colorMap[tone]}`}>{label}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
    </div>
  );
};

const EmptyTile = ({ label }) => (
  <div className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center text-gray-600 text-xs">
    {label}
  </div>
);

const BigChaseCard = ({ tier, card, claimed, massive }) => {
  const img = card?.thumbnail;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative rounded-2xl overflow-hidden border-2 bg-gradient-to-b ${tier.bgGrad} ${tier.border} ${!claimed ? tier.glow : 'grayscale'}`}
    >
      {/* Tier ribbon */}
      <div className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur`}>
        <Crown className={`w-3.5 h-3.5 ${tier.color}`} />
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${tier.color}`}>{tier.label}</span>
      </div>
      <div className="aspect-[3/4] bg-[#0a0a0a] relative">
        {img ? <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" alt="" /> : <Package className="w-16 h-16 text-gray-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
        {claimed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-2xl font-black text-red-400 tracking-[0.3em] rotate-[-8deg]">CLAIMED</span>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-white/5">
        <p className="text-sm font-bold text-white truncate">{card?.title || 'Mystery'}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-gray-500">{card?.year} {card?.set_name}</p>
          <p className="text-lg font-black text-amber-400">${card?.value?.toFixed(0) || '—'}</p>
        </div>
      </div>
    </motion.div>
  );
};

const RedChaseCard = ({ card, claimed }) => {
  const img = card?.thumbnail;
  return (
    <div className={`relative rounded-xl overflow-hidden border-2 bg-gradient-to-b ${RED_CHASE.bgGrad} ${RED_CHASE.border} ${!claimed ? RED_CHASE.glow : 'grayscale opacity-60'}`}>
      <div className={`absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur`}>
        <Sparkles className={`w-2.5 h-2.5 ${RED_CHASE.color}`} />
        <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${RED_CHASE.color}`}>CHASE</span>
      </div>
      <div className="aspect-[3/4] bg-[#0a0a0a] relative">
        {img ? <img src={`data:image/jpeg;base64,${img}`} className="w-full h-full object-cover" alt="" /> : <Package className="w-10 h-10 text-gray-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
        {claimed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-sm font-black text-red-400 tracking-[0.25em] rotate-[-8deg]">CLAIMED</span>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-bold text-white truncate">{card?.title || 'Mystery'}</p>
        <p className="text-[10px] text-amber-400 font-bold">${card?.value?.toFixed(0) || '—'}</p>
      </div>
    </div>
  );
};

// ──────── Mega Box Display ────────
const MegaBoxDisplay = ({ cards, claimed }) => {
  // 4 cards in a 2x2 grid with orange glow, but styled as "sealed boxes"
  const filled = [...cards];
  while (filled.length < 4) filled.push(null);
  return (
    <div className="grid grid-cols-2 gap-3">
      {filled.slice(0, 4).map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.07 }}
          className={`relative rounded-xl overflow-hidden border-2 bg-gradient-to-b ${ORANGE_MEGA.bgGrad} ${ORANGE_MEGA.border} ${!claimed ? ORANGE_MEGA.glow : 'grayscale'}`}
        >
          {/* Box label strip */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-black/70 backdrop-blur px-2 py-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Gift className={`w-2.5 h-2.5 ${ORANGE_MEGA.color}`} />
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${ORANGE_MEGA.color}`}>Box {i + 1}</span>
            </div>
            <Lock className="w-2.5 h-2.5 text-amber-400/70" />
          </div>
          <div className="aspect-[3/4] bg-[#0a0a0a] relative pt-6">
            {card?.thumbnail ? (
              <img src={`data:image/jpeg;base64,${card.thumbnail}`} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="w-10 h-10 text-gray-700" />
              </div>
            )}
            {/* Sealed overlay - amber tint */}
            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 via-transparent to-amber-500/10 pointer-events-none" />
          </div>
          <div className="p-2 bg-black/40">
            <p className="text-[10px] font-bold text-white truncate">{card?.title || '???'}</p>
            <p className="text-[9px] text-amber-400 font-bold">${card?.value?.toFixed(0) || '?'}</p>
          </div>
          {claimed && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
              <span className="text-xs font-black text-red-400 tracking-[0.2em] rotate-[-8deg]">OPENED</span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

// ──────── Recipe Box (tilted, numbers as tabs) ────────
const RecipeBox = ({ game, onSelect }) => {
  const [hoveredNum, setHoveredNum] = useState(null);
  return (
    <div
      className="relative"
      style={{
        perspective: '1200px',
      }}
    >
      <div
        className="relative"
        style={{
          transform: 'rotateX(8deg) rotateZ(-2deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Outer "wood/leather" frame */}
        <div className="relative rounded-2xl bg-gradient-to-b from-[#1a1310] via-[#0f0a08] to-[#0a0605] border-2 border-[#3d2818] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,215,150,0.1)] p-4 sm:p-5">
          {/* Subtle grain */}
          <div className="absolute inset-0 rounded-2xl opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(255,200,120,0.08),transparent_50%)] pointer-events-none" />

          {/* Tab numbers along the top (sticking up out of the box) */}
          <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-center relative mb-3 sm:mb-4" style={{ marginTop: '-22px' }}>
            {game.spots.map(spot => (
              <PullTab
                key={spot.pull_number}
                spot={spot}
                onSelect={onSelect}
                onHover={setHoveredNum}
                active={hoveredNum === spot.pull_number}
                gameActive={game.status === 'active'}
              />
            ))}
          </div>

          {/* Inner box "depth" - below tabs, like the filing drawer */}
          <div className="rounded-xl bg-gradient-to-b from-[#050201] to-[#000] border border-[#2a1a10] shadow-[inset_0_6px_20px_rgba(0,0,0,0.8)] px-3 py-4 sm:px-5 sm:py-5">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-1.5">Pull Board</p>
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-600 tracking-tight">
                {game.pulls_remaining} / {game.total_pulls}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">pulls remaining</p>

              {/* Price tiers as rows */}
              <div className="mt-4 space-y-1 max-w-sm mx-auto">
                {game.tiers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-black/50 border border-amber-900/30">
                    <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider">Pulls {t.from}–{t.to}</span>
                    <span className="text-xs font-black text-amber-300">${t.price}</span>
                  </div>
                ))}
              </div>

              {hoveredNum && (
                <p className="mt-3 text-[10px] font-bold text-amber-400">
                  Tap #{hoveredNum} to pull
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PullTab = ({ spot, onSelect, onHover, active, gameActive }) => {
  const available = spot.status === 'available' && gameActive;
  const claimed = spot.status === 'claimed';
  return (
    <motion.button
      whileHover={available ? { y: -4, scale: 1.05 } : {}}
      whileTap={available ? { scale: 0.95 } : {}}
      disabled={!available}
      onClick={() => onSelect(spot)}
      onMouseEnter={() => onHover && onHover(spot.pull_number)}
      onMouseLeave={() => onHover && onHover(null)}
      data-testid={`pull-tab-${spot.pull_number}`}
      className={`relative transition-all ${
        available
          ? 'cursor-pointer'
          : claimed
          ? 'cursor-not-allowed'
          : 'cursor-not-allowed opacity-40'
      }`}
      style={{
        width: '34px',
        height: '46px',
      }}
    >
      {/* Tab body (index card sticking out) */}
      <div
        className={`w-full h-full rounded-t-[4px] rounded-b-sm flex flex-col items-center justify-between py-1 px-0.5 relative overflow-hidden ${
          available
            ? 'bg-gradient-to-b from-amber-100 via-amber-200 to-amber-400 border border-amber-600 shadow-[0_3px_6px_rgba(0,0,0,0.5)]'
            : claimed
            ? 'bg-gradient-to-b from-red-300 via-red-400 to-red-600 border border-red-800'
            : 'bg-gradient-to-b from-gray-600 to-gray-800 border border-gray-700'
        }`}
      >
        {/* Punch hole / notch */}
        <div className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-amber-800/60' : claimed ? 'bg-red-900/70' : 'bg-gray-900/70'}`} />
        <span className={`text-[9px] font-black leading-none ${available ? 'text-amber-950' : claimed ? 'text-red-950' : 'text-gray-400'}`}>
          #{spot.pull_number}
        </span>
        <span className={`text-[8px] font-black leading-none ${available ? 'text-amber-900' : 'text-gray-900'}`}>
          {claimed ? '✓' : `$${spot.price}`}
        </span>
      </div>
      {active && (
        <motion.div
          layoutId="tab-glow"
          className="absolute inset-0 rounded-t-[4px] shadow-[0_0_18px_rgba(245,158,11,0.6)] pointer-events-none"
        />
      )}
    </motion.button>
  );
};

// ──────── Checkout Modal (unchanged logic) ────────
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
