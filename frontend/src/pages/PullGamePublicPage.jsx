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
  const [cart, setCart] = useState(new Set());
  const [showCheckout, setShowCheckout] = useState(false);

  const toggleCart = (pull_number) => {
    setCart(prev => {
      const next = new Set(prev);
      if (next.has(pull_number)) next.delete(pull_number);
      else next.add(pull_number);
      return next;
    });
  };

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

  const blueBoxCards = game.blue_box_cards || [];
  const orangeBoxCards = game.orange_box_cards || [];
  const redChasers = game.red_chases || [];
  const claimedByCardId = new Set(
    (game.spots || []).filter(s => s.status === 'claimed' && s.card).map(s => s.card.card_id)
  );
  const totalChaserEvents = redChasers.length + (orangeBoxCards.length > 0 ? 1 : 0) + (blueBoxCards.length > 0 ? 1 : 0);
  const claimedChaserSpots = (game.spots || []).filter(s => s.status === 'claimed' && s.is_chaser).length;
  const odds = game.pulls_remaining > 0 ? Math.max(1, Math.round(game.pulls_remaining / Math.max(1, totalChaserEvents - claimedChaserSpots))) : 0;
  const blueAlive = !game.blue_triggered;
  const orangeAlive = !game.orange_triggered;

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
              {blueAlive && <><span>·</span><span className="text-blue-400 font-bold animate-pulse">👀 Blue Alive</span></>}
              {orangeAlive && <><span>·</span><span className="text-amber-400 font-bold">🟧 Orange Alive</span></>}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </div>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-6 lg:gap-8 items-start">
          {/* LEFT: Blue Box Chases (4 cards) */}
          <div className="order-2 lg:order-1">
            <SectionHeading icon={Crown} label="Blue Box (Pick 1 of 4)" tone="blue" />
            <BoxGrid cards={blueBoxCards} tone={BLUE_CHASE} pickedIndex={game.blue_picked_index} triggered={game.blue_triggered} />
          </div>

          {/* CENTER: Recipe Box with pull numbers */}
          <div className="order-1 lg:order-2" data-testid="board-section">
            <SectionHeading icon={Zap} label="The Board" tone="amber" />
            <RecipeBox game={game} cart={cart} onToggle={toggleCart} />
          </div>

          {/* RIGHT: Orange Box Chases (4 cards) */}
          <div className="order-3">
            <SectionHeading icon={Gift} label="Orange Box (Pick 1 of 4)" tone="amber" />
            <BoxGrid cards={orangeBoxCards} tone={ORANGE_MEGA} pickedIndex={game.orange_picked_index} triggered={game.orange_triggered} />
          </div>
        </div>

        {/* BOTTOM: Red Chases (6 cards) */}
        <div className="mt-10 lg:mt-14" data-testid="red-chases-section">
          <SectionHeading icon={Trophy} label={`Red Chases (${redChasers.length})`} tone="red" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {redChasers.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <RedChaseCard
                  card={card}
                  claimed={claimedByCardId.has(card?.card_id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {cart.size > 0 && !showCheckout && (
          <CartFloat cart={cart} currentPrice={game.current_price} onCheckout={() => setShowCheckout(true)} onClear={() => setCart(new Set())} onRemove={toggleCart} />
        )}
        {showCheckout && (
          <CheckoutModal gameId={gameId} pullNumbers={Array.from(cart).sort((a,b)=>a-b)} currentPrice={game.current_price} onClose={() => setShowCheckout(false)} />
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

// ──────── Box Grid (4 cards visible in their box, used for both Blue and Orange) ────────
const BoxGrid = ({ cards, tone, pickedIndex, triggered }) => {
  const filled = [...cards];
  while (filled.length < 4) filled.push(null);
  return (
    <div className="grid grid-cols-2 gap-3">
      {filled.slice(0, 4).map((card, i) => {
        const isPicked = pickedIndex === i;
        const wasPassed = triggered && pickedIndex !== i;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07 }}
            className={`relative rounded-xl overflow-hidden border-2 bg-gradient-to-b ${tone.bgGrad} ${tone.border} ${
              triggered ? (isPicked ? tone.glow : 'grayscale opacity-50') : tone.glow
            }`}
          >
            <div className={`absolute top-0 left-0 right-0 z-10 bg-black/70 backdrop-blur px-2 py-1 flex items-center justify-between`}>
              <div className="flex items-center gap-1">
                <Gift className={`w-2.5 h-2.5 ${tone.color}`} />
                <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${tone.color}`}>Box {i + 1}</span>
              </div>
              {!triggered && <Lock className={`w-2.5 h-2.5 ${tone.color}/70`} />}
              {isPicked && <span className="text-[8px] font-black text-emerald-400">PICKED</span>}
            </div>
            <div className="aspect-[3/4] bg-[#0a0a0a] relative pt-6">
              {card?.thumbnail ? (
                <img src={`data:image/jpeg;base64,${card.thumbnail}`} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Package className="w-10 h-10 text-gray-700" /></div>
              )}
              {!triggered && <div className={`absolute inset-0 bg-gradient-to-t ${tone.bgGrad} opacity-30 pointer-events-none`} />}
            </div>
            <div className="p-2 bg-black/40">
              <p className="text-[10px] font-bold text-white truncate">{card?.title || '???'}</p>
              <p className={`text-[9px] font-bold ${tone.color}`}>${card?.value?.toFixed(0) || '?'}</p>
            </div>
            {wasPassed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                <span className="text-xs font-black text-red-400 tracking-[0.2em] rotate-[-8deg]">PASSED</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ──────── Recipe Box (file divider style, front-facing with rounded tabs) ────────
const RecipeBox = ({ game, cart, onToggle }) => {
  const [hoveredNum, setHoveredNum] = useState(null);

  const COLS = 10;
  const rows = [];
  for (let i = 0; i < game.spots.length; i += COLS) {
    rows.push(game.spots.slice(i, i + COLS));
  }
  const renderRows = [...rows].reverse();

  return (
    <div className="relative">
      {/* Tab stack - file dividers sticking up (back rows visible above front) */}
      <div className="relative pb-1">
        {renderRows.map((row, rowIdx) => {
          const isFront = rowIdx === renderRows.length - 1;
          // Offset back rows to the right (like a fanned card catalog)
          const totalRows = renderRows.length;
          const offsetX = (totalRows - 1 - rowIdx) * 26;
          const zIndex = rowIdx + 1;
          // Each row reveals top ~30px above next row; front row sits flush on box body
          const overlap = isFront ? '-2px' : '-26px';
          return (
            <div
              key={rowIdx}
              className="flex justify-center"
              style={{
                marginBottom: overlap,
                paddingLeft: `${offsetX}px`,
                position: 'relative',
                zIndex,
              }}
            >
              {row.map(spot => (
                <PullTab
                  key={spot.pull_number}
                  spot={spot}
                  inCart={cart.has(spot.pull_number)}
                  onToggle={onToggle}
                  onHover={setHoveredNum}
                  active={hoveredNum === spot.pull_number}
                  gameActive={game.status === 'active'}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Box body (file/index card holder) - flat, front-facing */}
      <div className="relative rounded-b-2xl rounded-tr-2xl bg-gradient-to-b from-[#f4ede0] via-[#ebe1cf] to-[#dcd0b9] border-2 border-[#a89878] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7),inset_0_2px_0_rgba(255,255,255,0.5)] overflow-hidden">
        {/* Paper texture overlay */}
        <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(168,152,120,0.1)_3px,transparent_4px)] pointer-events-none" />

        <div className="relative px-5 py-6 sm:px-8 sm:py-8">
          {/* Header */}
          <div className="text-center mb-5 pb-4 border-b-2 border-[#a89878]/30 border-dashed">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#7a6a4a] mb-1">Pull Board</p>
            <p className="text-4xl sm:text-5xl font-black text-[#3d2818] tracking-tight">
              {game.pulls_remaining} <span className="text-2xl text-[#7a6a4a]">/ {game.total_pulls}</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#7a6a4a] mt-1 font-bold">pulls remaining</p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#3d2818] text-amber-200">
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Current Price</span>
              <span className="text-base font-black">${game.current_price?.toFixed(0) ?? game.tiers?.[0]?.price}</span>
            </div>
          </div>

          {/* Price tiers — interpreted as "first N pulls = $X" */}
          <div className="space-y-1.5 max-w-md mx-auto">
            {game.tiers.map((t, i) => {
              const count = t.to - t.from + 1;
              const label = i === 0 ? `First ${count} pulls` : `Next ${count} pulls`;
              const isCurrent = game.pulls_sold + 1 >= t.from && game.pulls_sold + 1 <= t.to;
              const isPast = game.pulls_sold >= t.to;
              return (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-md border transition-all ${
                  isCurrent ? 'bg-amber-500/20 border-amber-700 shadow-[0_0_0_1px_rgba(180,120,40,0.3)]' :
                  isPast ? 'bg-[#3d2818]/3 border-[#a89878]/20 opacity-50 line-through' :
                  'bg-[#3d2818]/8 border-[#a89878]/40'
                }`}>
                  <span className="text-[11px] font-bold text-[#5a4a2a] uppercase tracking-wider">
                    {isCurrent && '► '}{label}
                  </span>
                  <span className="text-base font-black text-[#3d2818]">${t.price}</span>
                </div>
              );
            })}
          </div>

          {hoveredNum !== null && hoveredNum !== undefined && (
            <p className="mt-4 text-center text-[10px] font-black uppercase tracking-wider text-[#7a4a18] animate-pulse">
              ► Click #{hoveredNum} to pull ◄
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const PullTab = ({ spot, inCart, onToggle, onHover, active, gameActive }) => {
  const available = spot.status === 'available' && gameActive;
  const claimed = spot.status === 'claimed';

  // Domed/half-circle tab style
  const baseClasses = inCart && available
    ? 'bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-600 border-emerald-800 text-white cursor-pointer'
    : available
    ? 'bg-gradient-to-b from-[#1a3a8a] via-[#0f2a6a] to-[#0a1f5a] border-[#0a1538] text-white hover:from-[#2a4ab0] cursor-pointer'
    : claimed
    ? 'bg-gradient-to-b from-[#7a1a1a] via-[#5a0a0a] to-[#3a0505] border-[#1a0202] text-red-100/80 cursor-not-allowed'
    : 'bg-gradient-to-b from-[#444] to-[#222] border-[#0a0a0a] text-gray-500 cursor-not-allowed opacity-60';

  return (
    <motion.button
      whileHover={available ? { y: -3 } : {}}
      whileTap={available ? { y: 0 } : {}}
      disabled={!available}
      onClick={() => onToggle(spot.pull_number)}
      onMouseEnter={() => onHover && onHover(spot.pull_number)}
      onMouseLeave={() => onHover && onHover(null)}
      data-testid={`pull-tab-${spot.pull_number}`}
      className={`relative inline-block transition-all border-2 ${baseClasses}`}
      style={{
        width: '52px',
        height: '52px',
        marginRight: '-1px',
        marginLeft: '-1px',
        borderTopLeftRadius: '50% 100%',
        borderTopRightRadius: '50% 100%',
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0',
        boxShadow: inCart && available
          ? '0 0 18px rgba(16,185,129,0.7), inset 0 1px 0 rgba(255,255,255,0.3)'
          : active
          ? '0 0 18px rgba(245,158,11,0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
          : 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 rgba(0,0,0,0.4)',
      }}
    >
      <span className="text-[11px] font-black leading-none block mt-2.5">
        #{spot.pull_number}
      </span>
      <span className="text-[8px] font-bold leading-none block mt-0.5 opacity-80">
        {claimed ? '✓ SOLD' : inCart ? '✓ IN CART' : `$${spot.price}`}
      </span>
    </motion.button>
  );
};

// ──────── Cart Float (sticky bottom) ────────
const CartFloat = ({ cart, currentPrice, onCheckout, onClear, onRemove }) => {
  const total = cart.size * currentPrice;
  const sortedNumbers = Array.from(cart).sort((a, b) => a - b);
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl"
      data-testid="cart-float"
    >
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl shadow-[0_20px_50px_-10px_rgba(245,158,11,0.6)] border border-amber-300 p-3 sm:p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-black" />
            <span className="text-xs font-black text-black uppercase tracking-wider">{cart.size} pull{cart.size !== 1 ? 's' : ''} in cart</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto">
            {sortedNumbers.map(n => (
              <button
                key={n}
                onClick={() => onRemove(n)}
                className="px-1.5 py-0.5 rounded bg-black/15 hover:bg-black/30 text-[10px] font-black text-black flex items-center gap-0.5 transition-colors"
                data-testid={`cart-chip-${n}`}
              >#{n} ✕</button>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-black/70 uppercase">Total</p>
          <p className="text-2xl font-black text-black leading-none">${total.toFixed(0)}</p>
        </div>
        <button
          onClick={onClear}
          className="hidden sm:block px-3 py-2 rounded-lg bg-black/15 hover:bg-black/30 text-black text-xs font-black"
          data-testid="cart-clear-btn"
        >Clear</button>
        <button
          onClick={onCheckout}
          className="px-4 py-3 rounded-xl bg-black hover:bg-[#1a1a1a] text-white text-sm font-black flex items-center gap-1.5 whitespace-nowrap"
          data-testid="cart-checkout-btn"
        >
          <Zap className="w-4 h-4" /> Checkout
        </button>
      </div>
    </motion.div>
  );
};

// ──────── Checkout Modal (multi-pull) ────────
const CheckoutModal = ({ gameId, pullNumbers, currentPrice, onClose }) => {
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'US' });
  const [submitting, setSubmitting] = useState(false);
  const total = pullNumbers.length * currentPrice;

  const submit = async () => {
    if (!email || !email.includes('@')) { toast.error('Valid email required'); return; }
    for (const k of ['first_name', 'last_name', 'line1', 'city', 'state', 'postal_code']) {
      if (!form[k]) { toast.error(`${k.replace('_', ' ')} required`); return; }
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/api/pull-game/games/${gameId}/buy-pull`, {
        pull_numbers: pullNumbers,
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
        <div className="mb-5">
          <h3 className="text-lg font-bold mb-1">Pulling {pullNumbers.length} card{pullNumbers.length !== 1 ? 's' : ''}</h3>
          <div className="flex flex-wrap gap-1 mb-3">
            {pullNumbers.map(n => (
              <span key={n} className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black">#{n}</span>
            ))}
          </div>
          <p className="text-2xl font-black text-amber-400">${total.toFixed(2)} <span className="text-xs text-gray-500 font-normal">USD</span></p>
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
          {submitting ? 'Creating session...' : `Pay $${total.toFixed(2)} & Pull ${pullNumbers.length}`}
        </button>
        <p className="text-[10px] text-gray-500 text-center mt-3">Secure payment via Stripe. Cards ship within 1 business day.</p>
      </motion.div>
    </motion.div>
  );
};

export default PullGamePublicPage;
