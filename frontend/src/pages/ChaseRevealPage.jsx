import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Lock, Star, Trophy, Users, Copy, Download, ShoppingBag, Zap, Crown, Gem, Shield, Clock, Package, Check } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const TIER_CONFIG = {
  chase: { label: 'CHASER', icon: Crown, gradient: 'from-amber-500 to-orange-600', border: 'border-amber-500/50', glow: 'shadow-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400', badge: 'bg-gradient-to-r from-amber-500 to-orange-600' },
  mid: { label: 'MID TIER', icon: Zap, gradient: 'from-[#3b82f6] to-blue-600', border: 'border-[#3b82f6]/40', glow: 'shadow-[#3b82f6]/20', bg: 'bg-[#3b82f6]/5', text: 'text-[#3b82f6]', badge: 'bg-gradient-to-r from-[#3b82f6] to-blue-600' },
  low: { label: 'BASE', icon: Gem, gradient: 'from-gray-500 to-gray-600', border: 'border-white/[0.08]', glow: 'shadow-white/5', bg: 'bg-white/[0.02]', text: 'text-gray-400', badge: 'bg-gradient-to-r from-gray-600 to-gray-700' },
};

/* ===== CELEBRATION PARTICLES ===== */
const CELEBRATION_CFG = {
  low:   { count: 25,  colors: ['#9ca3af','#d1d5db','#e5e7eb','#ffffff','#c0c0c0'], sizeMin: 4, sizeMax: 9,  durMin: 2.5, durMax: 4.5, spread: 1 },
  mid:   { count: 55,  colors: ['#3b82f6','#60a5fa','#818cf8','#a78bfa','#38bdf8','#93c5fd','#ffffff'], sizeMin: 5, sizeMax: 13, durMin: 2,   durMax: 4.5, spread: 1.2 },
  chase: { count: 110, colors: ['#f59e0b','#f97316','#ef4444','#fbbf24','#fcd34d','#ffffff','#fef3c7','#fb923c','#dc2626'], sizeMin: 6, sizeMax: 18, durMin: 1.8, durMax: 5,   spread: 1.5 },
};

const CelebrationEffect = ({ tier = 'low' }) => {
  const cfg = CELEBRATION_CFG[tier] || CELEBRATION_CFG.low;
  const particles = useMemo(() =>
    Array.from({ length: cfg.count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      delay: Math.random() * (tier === 'chase' ? 3 : 1.5),
      duration: cfg.durMin + Math.random() * (cfg.durMax - cfg.durMin),
      rotation: (Math.random() - 0.5) * 720 * cfg.spread,
      isRect: Math.random() > 0.4,
      drift: (Math.random() - 0.5) * 200,
    }))
  , [tier]);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden" data-testid="celebration-effect">
      {/* Screen flash for chase */}
      {tier === 'chase' && (
        <motion.div
          className="absolute inset-0 bg-amber-400"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}
      {tier === 'mid' && (
        <motion.div
          className="absolute inset-0 bg-blue-500"
          initial={{ opacity: 0.25 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
      {/* Confetti particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            width: p.isRect ? p.size : p.size * 0.8,
            height: p.isRect ? p.size * (1.5 + Math.random()) : p.size * 0.8,
            backgroundColor: p.color,
            borderRadius: p.isRect ? '2px' : '50%',
          }}
          initial={{ y: -30, opacity: 0, rotate: 0, x: 0 }}
          animate={{
            y: vh + 60,
            opacity: [0, 1, 1, 1, 0],
            rotate: p.rotation,
            x: p.drift,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
};

/* ===== SPOT TRACKER ===== */
const SpotCard = ({ spot }) => {
  const isClaimed = spot.claimed;
  return (
    <div className="relative" style={{ perspective: '400px' }}>
      <motion.div
        initial={false}
        animate={{ rotateY: isClaimed ? 180 : 0 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 260, damping: 22 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative w-full aspect-[3/4]"
      >
        <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-[#f59e0b]/25 flex flex-col items-center justify-between overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }} data-testid={`spot-front-${spot.number}`}>
          <div className="w-full bg-[#f59e0b]/10 border-b border-[#f59e0b]/15 py-[3px]">
            <p className="text-[7px] font-bold text-[#f59e0b]/60 text-center tracking-wider">SPOT</p>
          </div>
          <span className="text-[#f59e0b] font-black text-base leading-none">{spot.number}</span>
          <div className="pb-2"><div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]/30" /></div>
        </div>
        <div className="absolute inset-0 rounded-lg bg-[#0f0f0f] border border-emerald-500/20 flex flex-col items-center justify-between overflow-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} data-testid={`spot-back-${spot.number}`}>
          <div className="w-full bg-emerald-500/10 border-b border-emerald-500/15 py-[3px]">
            <p className="text-[7px] font-bold text-emerald-400/60 text-center tracking-wider">SOLD</p>
          </div>
          <Check className="w-3.5 h-3.5 text-emerald-400/70" />
          <div className="pb-1.5 px-1 w-full">
            <p className="text-[7px] font-bold text-gray-500 text-center truncate leading-tight">{spot.buyer || '#' + spot.number}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SpotTracker = ({ spots, totalSpots }) => {
  if (!spots || spots.length === 0) return null;
  const claimed = spots.filter(s => s.claimed).length;
  const remaining = totalSpots - claimed;
  return (
    <div className="bg-[#111]/60 border border-white/[0.05] rounded-2xl px-5 py-4" data-testid="spot-tracker">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Spot Tracker</span>
        <span className="text-[11px]">
          <span className="font-bold text-[#f59e0b]">{remaining}</span>
          <span className="text-gray-600"> / {totalSpots} left</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
        {spots.map(spot => (
          <div key={spot.number} className="w-[40px] sm:w-[48px] md:w-[52px]">
            <SpotCard spot={spot} />
          </div>
        ))}
      </div>
    </div>
  );
};

/* ===== MAIN PAGE ===== */
const ChaseRevealPage = () => {
  const { packId } = useParams();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimCode, setClaimCode] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [revealedCard, setRevealedCard] = useState(null);
  const [showReveal, setShowReveal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchPack(); }, [packId]);

  const fetchPack = async () => {
    try {
      const res = await axios.get(`${API}/api/ebay/chase/${packId}`);
      setPack(res.data);
    } catch { setError('Chase Pack not found'); }
    finally { setLoading(false); }
  };

  const handleReveal = async () => {
    if (!claimCode.trim()) return;
    setRevealing(true);
    setError('');
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/reveal`, { claim_code: claimCode.trim().toUpperCase() });
      if (res.data.success) {
        setShowReveal(true);
        setTimeout(() => setRevealedCard(res.data), 3800);
      } else { setError(res.data.error || 'Invalid code'); }
    } catch (err) { setError(err.response?.data?.detail || 'Invalid claim code'); }
    finally { setRevealing(false); }
  };

  // Loading
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Error (no pack)
  if (error && !pack) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-red-400 text-lg">{error}</p>
    </div>
  );

  if (!pack) return null;

  /* ===== SPIN ANIMATION ===== */
  if (showReveal && !revealedCard) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#f59e0b]/[0.06] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#3b82f6]/[0.06] blur-[120px] pointer-events-none" />
        <div className="text-center relative z-10">
          <motion.div
            initial={{ rotateY: 0 }}
            animate={{ rotateY: [0, 360, 720, 1080, 1440, 1800, 2160, 2520, 2880, 3240, 3600] }}
            transition={{ duration: 3.5, times: [0, 0.15, 0.28, 0.39, 0.48, 0.56, 0.63, 0.70, 0.78, 0.88, 1], ease: "easeIn" }}
            style={{ perspective: 800, transformStyle: 'preserve-3d' }}
            className="w-48 h-[272px] sm:w-56 sm:h-80 md:w-64 md:h-[360px] mx-auto relative"
          >
            {/* Front face */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-2xl shadow-amber-500/40"
              style={{ backfaceVisibility: 'hidden' }}>
              <div className="text-center">
                <Flame className="w-12 h-12 sm:w-16 sm:h-16 text-white/90 mx-auto" />
                <p className="text-white font-black text-xs sm:text-sm mt-2 tracking-wider">CHASE PACK</p>
              </div>
            </div>
            {/* Back face */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-600 via-orange-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-amber-500/40"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto">
                  <span className="text-white font-black text-sm sm:text-base">FS</span>
                </div>
                <p className="text-white/70 font-black text-[10px] sm:text-xs mt-2 tracking-widest">FLIPSLAB</p>
              </div>
            </div>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="text-lg sm:text-xl font-black text-[#f59e0b] mt-6 sm:mt-8 tracking-wide">
            Revealing your card...
          </motion.p>
        </div>
      </div>
    );
  }

  /* ===== REVEALED CARD ===== */
  if (revealedCard) {
    const card = revealedCard.card;
    const isChase = revealedCard.is_chase;
    const tier = card.tier || (isChase ? 'chase' : 'low');
    const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.low;
    const TierIcon = tierCfg.icon;

    const shareText = isChase
      ? `I just pulled the CHASE! ${card.year} ${card.set_name} ${card.player} ${card.variation || ''}`
      : `I pulled ${card.year} ${card.set_name} ${card.player} ${card.variation || ''} from a Chase Pack!`;
    const shareUrl = window.location.href;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    const downloadCard = () => {
      if (!card.image) return;
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${card.image}`;
      link.download = `${card.player}_${card.year}.jpg`.replace(/\s+/g, '_');
      link.click();
    };

    const glowColor = tier === 'chase' ? 'bg-amber-500/[0.12]' : tier === 'mid' ? 'bg-blue-500/[0.08]' : 'bg-white/[0.03]';
    const ringColor = tier === 'chase' ? 'ring-amber-500/50' : tier === 'mid' ? 'ring-blue-500/30' : 'ring-white/[0.1]';
    const shadowColor = tier === 'chase' ? 'shadow-amber-500/40' : tier === 'mid' ? 'shadow-blue-500/20' : 'shadow-white/5';

    return (
      <div className="min-h-screen bg-[#0a0a0a] overflow-hidden" data-testid="chase-revealed-view">
        {/* Celebration */}
        <CelebrationEffect tier={tier} />

        {/* Ambient glow */}
        <div className={`absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full ${glowColor} blur-[150px] pointer-events-none`} />
        <div className={`absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full ${glowColor} blur-[120px] pointer-events-none`} />

        <div className="relative z-10 flex flex-col items-center pt-6 sm:pt-8 md:pt-12 pb-12 sm:pb-16 px-4 sm:px-5">
          {/* Tier banner */}
          <motion.div initial={{ opacity: 0, scale: 0.5, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.2, type: "spring", bounce: 0.4 }} className="mb-6">
            <div className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-full ${tierCfg.badge} text-white font-black shadow-lg ${shadowColor}`}
              style={{ fontSize: tier === 'chase' ? '1.25rem' : tier === 'mid' ? '1rem' : '0.875rem' }}>
              <TierIcon className={tier === 'chase' ? 'w-6 h-6' : 'w-5 h-5'} />
              {tier === 'chase' ? 'CHASE CARD!' : tier === 'mid' ? 'MID TIER PULL!' : 'BASE PULL!'}
            </div>
          </motion.div>

          {/* Card image */}
          <motion.div
            initial={{ scale: 0, rotateY: 180 }} animate={{ scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          >
            {/* Pulsing ring for chase */}
            {tier === 'chase' && (
              <motion.div
                className="absolute -inset-4 rounded-3xl border-2 border-amber-500/40 pointer-events-none"
                animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {card.image ? (
              <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player}
                className={`w-64 sm:w-72 md:w-80 lg:w-96 rounded-2xl shadow-2xl ${shadowColor} ring-4 ${ringColor}`} />
            ) : (
              <div className={`w-64 sm:w-72 md:w-80 h-80 sm:h-96 rounded-2xl flex items-center justify-center ${tierCfg.bg}`}>
                <Star className="w-16 h-16 text-amber-400" />
              </div>
            )}
          </motion.div>

          {/* Card info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 text-center">
            <p className="text-3xl md:text-4xl font-black text-white">{card.player}</p>
            <p className="text-sm md:text-base text-gray-400 mt-1.5">{card.year} {card.set_name}</p>
            {card.variation && <p className={`text-sm md:text-base ${tierCfg.text} font-bold mt-1`}>{card.variation}</p>}
            <p className="text-sm text-gray-500 mt-4">Congratulations, <span className="text-white font-bold">{revealedCard.buyer}</span>!</p>
          </motion.div>

          {/* Spot tracker after reveal */}
          {pack.spots && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-10 w-full max-w-md">
              <SpotTracker spots={pack.spots} totalSpots={pack.total_spots} />
            </motion.div>
          )}

          {/* Action buttons */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-8 w-full max-w-md space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-[#1DA1F2] text-sm font-bold hover:bg-[#1DA1F2]/20 transition-all" data-testid="chase-share-twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share on X
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 text-sm font-bold hover:bg-white/[0.08] transition-all" data-testid="chase-copy-share">
                <Copy className="w-4 h-4" /> Copy Link
              </button>
            </div>
            {card.image && (
              <button onClick={downloadCard}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 text-sm font-bold hover:bg-white/[0.08] transition-all" data-testid="chase-download-card">
                <Download className="w-4 h-4" /> Download Card Image
              </button>
            )}
            {pack?.ebay_url && (
              <a href={pack.ebay_url} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-sm font-bold hover:bg-[#f59e0b]/20 transition-all" data-testid="chase-buy-another">
                <ShoppingBag className="w-4 h-4" /> Buy Another Spot on eBay
              </a>
            )}
            <button onClick={() => { setRevealedCard(null); setShowReveal(false); setClaimCode(''); fetchPack(); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#111] border border-white/[0.06] text-gray-400 text-sm font-medium hover:text-white transition-all" data-testid="chase-back-to-pack">
              <Flame className="w-4 h-4" /> Back to Pack
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ===== MAIN PACK VIEW ===== */
  const chaseCards = pack.cards?.filter(c => c.tier === 'chase') || [];
  const midCards = pack.cards?.filter(c => c.tier === 'mid') || [];
  const lowCards = pack.cards?.filter(c => c.tier === 'low') || [];

  const CardItem = ({ card, size = 'md' }) => {
    const tier = TIER_CONFIG[card.tier] || TIER_CONFIG.low;
    const TierIcon = tier.icon;
    const sizeClass = size === 'lg' ? 'rounded-2xl' : 'rounded-xl';
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.03, y: -4 }} transition={{ duration: 0.3 }}
        className={`relative ${sizeClass} border ${tier.border} ${tier.bg} overflow-hidden shadow-lg ${tier.glow} group`}
      >
        {card.image ? (
          <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full aspect-[3/4] object-cover" />
        ) : (
          <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center"><Lock className="w-8 h-8 text-gray-700" /></div>
        )}
        <div className={`absolute top-2.5 left-2.5 ${tier.badge} text-white text-[9px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md`}>
          <TierIcon className="w-2.5 h-2.5" /> {tier.label}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3.5 pt-10">
          <p className="text-white font-black text-sm leading-tight truncate">{card.player}</p>
          <p className="text-gray-400 text-[11px] mt-0.5">{card.year} {card.set_name}</p>
          {card.variation && <p className={`${tier.text} text-[10px] font-bold mt-0.5 truncate`}>{card.variation}</p>}
        </div>
        {pack.all_revealed && card.assigned_to && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center px-3">
              <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-black text-sm">{card.assigned_to}</p>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden" data-testid="chase-pack-page">
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#f59e0b]/[0.06] blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-[#3b82f6]/[0.04] blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-5 md:px-10 lg:px-16 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center">
            <span className="text-white font-black text-xs">FS</span>
          </div>
          <span className="text-white font-black tracking-tight">FLIPSLAB</span>
          <span className="text-[9px] uppercase tracking-[0.3em] text-[#3b82f6] ml-0.5 font-bold">ENGINE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest hidden sm:inline">Chase Card Pack</span>
          <Flame className="w-4 h-4 text-[#f59e0b]" />
        </div>
      </nav>

      {/* CONTENT */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-5 md:px-10 lg:px-16 pt-6 md:pt-12 pb-6 md:pb-8">

        {/* TITLE */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 md:mb-8 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold mb-3">
            <Flame className="w-3.5 h-3.5" /> CHASE CARD PACK
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-[#f59e0b]">
            {pack.title}
          </h1>
          <div className="flex items-center gap-4 mt-3 justify-center md:justify-start">
            <span className="text-white font-bold text-lg md:text-xl">${pack.price?.toFixed(2)} <span className="text-sm text-gray-400 font-normal">per spot</span></span>
            <span className="text-white/[0.15]">|</span>
            <span className="text-white font-bold text-lg md:text-xl">{pack.total_spots} <span className="text-sm text-gray-400 font-normal">spots</span></span>
            {pack.ebay_url && (
              <a href={pack.ebay_url} target="_blank" rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105 active:scale-95"
                data-testid="chase-buy-spot-top">
                <ShoppingBag className="w-4 h-4" /> Buy a Spot
              </a>
            )}
          </div>
        </motion.div>

        {/* CLAIM CODE — Full width prominent banner */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[#111] border border-[#f59e0b]/20 rounded-2xl p-5 md:p-6 mb-8 md:mb-10" data-testid="chase-claim-section">
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <Lock className="w-5 h-5 text-[#f59e0b]" />
              <span className="text-sm md:text-base font-black text-white tracking-wide">REVEAL YOUR CARD</span>
            </div>
            {error && <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">{error}</span>}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <input value={claimCode} onChange={e => setClaimCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE" maxLength={8}
                className="w-full sm:w-[240px] bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-5 py-3.5 text-center text-lg font-mono font-black text-white tracking-[0.3em] uppercase focus:border-[#f59e0b]/50 outline-none transition-colors"
                data-testid="chase-claim-input"
                onKeyDown={e => e.key === 'Enter' && handleReveal()} />
              <button onClick={handleReveal} disabled={revealing || !claimCode.trim()}
                className="w-full sm:w-auto px-8 md:px-12 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm md:text-base hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 transition-all shadow-lg shadow-amber-500/25"
                data-testid="chase-reveal-btn">
                {revealing ? '...' : 'REVEAL'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* CHASERS — Big centered showcase */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mb-10 md:mb-14">
          <div className="flex justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-10 flex-wrap">
            {chaseCards.map((card, idx) => (
              <div key={`chase-${idx}`} className="relative w-[85vw] max-w-[280px] sm:w-[260px] md:w-[300px] lg:w-[340px]">
                <div className="absolute -inset-6 bg-gradient-to-br from-amber-500/15 via-orange-500/8 to-transparent rounded-3xl blur-2xl pointer-events-none" />
                <div className="relative rounded-2xl border-2 border-amber-500/50 overflow-hidden shadow-2xl shadow-amber-500/25">
                  {card.image ? (
                    <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full aspect-[3/4] object-cover" />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center">
                      <Crown className="w-12 h-12 text-amber-400" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                    <Crown className="w-3 h-3" /> CHASER
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 pt-12">
                    <p className="text-white font-black text-base md:text-lg leading-tight">{card.player}</p>
                    <p className="text-gray-400 text-[11px] mt-1">{card.year} {card.set_name}</p>
                    {card.variation && <p className="text-amber-400 text-[11px] font-bold mt-0.5">{card.variation}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* SPOT TRACKER + STORE INFO — Side by side on desktop */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-5 mb-8 md:mb-14">
          {/* Spot Tracker */}
          {pack.spots && <SpotTracker spots={pack.spots} totalSpots={pack.total_spots} />}

          {/* Store Info */}
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4 space-y-3 self-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center shrink-0">
                <span className="text-white font-black text-[10px]">FS</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">FlipSlab Engine</p>
                <p className="text-[10px] text-gray-500">Powered by FlipSlab</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0a0a0a] rounded-lg p-2.5 border border-white/[0.04] text-center">
                <Shield className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                <p className="text-[9px] text-emerald-400 font-bold">Verified</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-2.5 border border-white/[0.04] text-center">
                <Package className="w-3.5 h-3.5 text-[#3b82f6] mx-auto mb-1" />
                <p className="text-[9px] text-[#3b82f6] font-bold">Ships Fast</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-2.5 border border-white/[0.04] text-center">
                <Clock className="w-3.5 h-3.5 text-[#f59e0b] mx-auto mb-1" />
                <p className="text-[9px] text-[#f59e0b] font-bold">{pack.total_spots} Spots</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* CARDS BY TIER */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-5 md:px-10 lg:px-16 pb-16 space-y-8 md:space-y-14">
        {midCards.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="flex items-center gap-2.5 mb-5">
              <Zap className="w-5 h-5 text-[#3b82f6]" />
              <h2 className="text-lg md:text-xl font-black text-white">MID TIER</h2>
              <span className="text-sm text-gray-500 ml-2">{midCards.length} cards</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
              {midCards.map((card, idx) => <CardItem key={`mid-${idx}`} card={card} />)}
            </div>
          </motion.section>
        )}

        {lowCards.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <div className="flex items-center gap-2.5 mb-5">
              <Gem className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg md:text-xl font-black text-white">BASE</h2>
              <span className="text-sm text-gray-500 ml-2">{lowCards.length} cards</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {lowCards.map((card, idx) => <CardItem key={`low-${idx}`} card={card} />)}
            </div>
          </motion.section>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center">
        <p className="text-xs text-gray-600">Powered by <span className="text-[#3b82f6] font-bold">FlipSlab Engine</span></p>
      </footer>
    </div>
  );
};

export default ChaseRevealPage;
