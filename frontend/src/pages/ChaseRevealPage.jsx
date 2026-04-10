import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Lock, Star, Trophy, Users, Copy, Download, ShoppingBag, Store, Zap, Crown, Gem } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const TIER_CONFIG = {
  chase: { label: 'CHASER', icon: Crown, gradient: 'from-amber-500 to-orange-600', border: 'border-amber-500/50', glow: 'shadow-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400', badge: 'bg-gradient-to-r from-amber-500 to-orange-600' },
  mid: { label: 'MID TIER', icon: Zap, gradient: 'from-[#3b82f6] to-blue-600', border: 'border-[#3b82f6]/40', glow: 'shadow-[#3b82f6]/20', bg: 'bg-[#3b82f6]/5', text: 'text-[#3b82f6]', badge: 'bg-gradient-to-r from-[#3b82f6] to-blue-600' },
  low: { label: 'BASE', icon: Gem, gradient: 'from-gray-500 to-gray-600', border: 'border-white/[0.08]', glow: 'shadow-white/5', bg: 'bg-white/[0.02]', text: 'text-gray-400', badge: 'bg-gradient-to-r from-gray-600 to-gray-700' },
};

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !pack) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (!pack) return null;

  // ===== SPIN ANIMATION =====
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
            className="w-52 h-72 mx-auto"
          >
            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-2xl shadow-amber-500/40" style={{ backfaceVisibility: 'hidden' }}>
              <div className="text-center">
                <Flame className="w-16 h-16 text-white/90 mx-auto" />
                <p className="text-white font-black text-sm mt-2 tracking-wider">CHASE PACK</p>
              </div>
            </div>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="text-xl font-black text-[#f59e0b] mt-8 tracking-wide">
            Revealing your card...
          </motion.p>
        </div>
      </div>
    );
  }

  // ===== REVEALED CARD =====
  if (revealedCard) {
    const card = revealedCard.card;
    const isChase = revealedCard.is_chase;
    const shareText = isChase
      ? `I just pulled the CHASE! ${card.year} ${card.set_name} ${card.player} ${card.variation || ''} from a Chase Pack!`
      : `I pulled ${card.year} ${card.set_name} ${card.player} ${card.variation || ''} from a Chase Pack!`;
    const shareUrl = window.location.href;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    const downloadCard = () => {
      if (!card.image) return;
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${card.image}`;
      link.download = `${card.player}_${card.year}_${card.set_name}.jpg`.replace(/\s+/g, '_');
      link.click();
    };

    return (
      <div className={`min-h-screen overflow-hidden ${isChase ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}`}>
        {/* Ambient glows */}
        <div className={`absolute top-20 left-1/4 w-[600px] h-[600px] rounded-full ${isChase ? 'bg-[#f59e0b]/[0.08]' : 'bg-[#3b82f6]/[0.06]'} blur-[150px] pointer-events-none`} />
        <div className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full ${isChase ? 'bg-orange-600/[0.06]' : 'bg-[#3b82f6]/[0.04]'} blur-[120px] pointer-events-none`} />

        {isChase && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(25)].map((_, i) => (
              <motion.div key={i}
                initial={{ y: -20, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920), opacity: 0 }}
                animate={{ y: (typeof window !== 'undefined' ? window.innerHeight : 900) + 20, opacity: [0, 1, 0] }}
                transition={{ duration: 2.5 + Math.random() * 2, delay: Math.random() * 3, repeat: Infinity }}
                className="absolute text-xl">
                {['🔥', '⭐', '🏆', '💎', '✨'][Math.floor(Math.random() * 5)]}
              </motion.div>
            ))}
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center pt-8 pb-12 px-4">
          {isChase && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }} className="mb-6">
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xl shadow-lg shadow-amber-500/30">
                <Trophy className="w-6 h-6" /> CHASE CARD!
              </div>
            </motion.div>
          )}

          <motion.div initial={{ scale: 0, rotateY: 180 }} animate={{ scale: 1, rotateY: 0 }} transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}>
            {card.image ? (
              <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player}
                className={`w-64 sm:w-80 rounded-2xl shadow-2xl ${isChase ? 'shadow-amber-500/40 ring-4 ring-amber-500/40' : 'shadow-[#3b82f6]/20 ring-2 ring-white/[0.08]'}`} />
            ) : (
              <div className={`w-64 h-80 rounded-2xl flex items-center justify-center ${isChase ? 'bg-gradient-to-br from-amber-900 to-orange-900' : 'bg-[#111]'}`}>
                <Star className="w-16 h-16 text-amber-400" />
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-6 text-center">
            <p className="text-3xl font-black text-white">{card.player}</p>
            <p className="text-sm text-gray-400 mt-1">{card.year} {card.set_name}</p>
            {card.variation && <p className="text-sm text-[#f59e0b] font-bold mt-1">{card.variation}</p>}
            <p className="text-xs text-gray-500 mt-3">Congratulations, <span className="text-white font-bold">{revealedCard.buyer}</span>!</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="mt-8 w-full max-w-sm space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/30 text-[#1DA1F2] text-xs font-bold hover:bg-[#1DA1F2]/20 transition-all" data-testid="chase-share-twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share on X
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); alert('Copied!'); }}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 text-xs font-bold hover:bg-white/[0.08] transition-all" data-testid="chase-copy-share">
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </button>
            </div>
            {card.image && (
              <button onClick={downloadCard}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-300 text-xs font-bold hover:bg-white/[0.08] transition-all" data-testid="chase-download-card">
                <Download className="w-3.5 h-3.5" /> Download Card Image
              </button>
            )}
            {pack?.ebay_url && (
              <a href={pack.ebay_url} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-bold hover:bg-[#f59e0b]/20 transition-all" data-testid="chase-buy-another">
                <ShoppingBag className="w-3.5 h-3.5" /> Buy Another Spot on eBay
              </a>
            )}
            <a href={`${pack?.ebay_url ? pack.ebay_url.replace(/\/itm\/.*/, '') : 'https://www.ebay.com'}`} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-bold hover:bg-[#3b82f6]/20 transition-all" data-testid="chase-visit-store">
              <Store className="w-3.5 h-3.5" /> Visit Store
            </a>
            <button onClick={() => { setRevealedCard(null); setShowReveal(false); setClaimCode(''); fetchPack(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111] border border-white/[0.06] text-gray-400 text-xs font-medium hover:text-white hover:border-white/[0.12] transition-all" data-testid="chase-back-to-pack">
              <Flame className="w-3.5 h-3.5" /> Back to Pack
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ===== MAIN PACK VIEW =====
  const chaseCards = pack.cards?.filter(c => c.tier === 'chase') || [];
  const midCards = pack.cards?.filter(c => c.tier === 'mid') || [];
  const lowCards = pack.cards?.filter(c => c.tier === 'low') || [];

  const CardItem = ({ card, size }) => {
    const tier = TIER_CONFIG[card.tier] || TIER_CONFIG.low;
    const TierIcon = tier.icon;
    const sizeClasses = {
      large: 'w-full max-w-[280px]',
      medium: '',
      small: '',
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{ duration: 0.3 }}
        className={`relative rounded-2xl border ${tier.border} ${tier.bg} overflow-hidden shadow-lg ${tier.glow} ${sizeClasses[size]} group`}
      >
        {card.image ? (
          <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player}
            className="w-full aspect-[3/4] object-cover" />
        ) : (
          <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center">
            <Lock className="w-8 h-8 text-gray-700" />
          </div>
        )}

        {/* Tier badge */}
        <div className={`absolute top-2 left-2 ${tier.badge} text-white text-[8px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md`}>
          <TierIcon className="w-2.5 h-2.5" /> {tier.label}
        </div>

        {/* Card info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
          <p className="text-white font-black text-sm leading-tight truncate">{card.player}</p>
          <p className="text-gray-400 text-[10px] mt-0.5">{card.year} {card.set_name}</p>
          {card.variation && <p className={`${tier.text} text-[10px] font-bold mt-0.5 truncate`}>{card.variation}</p>}
        </div>

        {/* Winner overlay when all revealed */}
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
      {/* Ambient glows like landing page */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-[#f59e0b]/[0.06] blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] rounded-full bg-[#3b82f6]/[0.06] blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-16 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center">
            <span className="text-white font-black text-xs">FS</span>
          </div>
          <span className="text-white font-black tracking-tight">FLIPSLAB</span>
          <span className="text-[9px] uppercase tracking-[0.3em] text-[#3b82f6] ml-0.5 font-bold">ENGINE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Chase Card Pack</span>
          <Flame className="w-4 h-4 text-[#f59e0b]" />
        </div>
      </nav>

      {/* Hero section */}
      <div className="relative z-10 pt-12 pb-8 px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold mb-5">
            <Flame className="w-3.5 h-3.5" /> CHASE CARD PACK
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            <span className="text-[#f59e0b]">{pack.title}</span>
          </h1>
          <p className="text-gray-400 mt-3 text-sm">
            <span className="text-white font-bold">${pack.price?.toFixed(2)}</span> per spot
            <span className="mx-2 text-white/[0.15]">|</span>
            <span className="text-white font-bold">{pack.total_spots}</span> total spots
          </p>
        </motion.div>
      </div>

      {/* Claim Code Section */}
      <div className="relative z-10 max-w-lg mx-auto px-4 mb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-[#111] border border-white/[0.08] rounded-2xl p-6" data-testid="chase-claim-section">
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#f59e0b]" /> Reveal Your Card
          </h2>
          <p className="text-xs text-gray-500 mb-4">Purchased a spot? Enter your claim code below.</p>
          {error && <p className="text-xs text-red-400 mb-3 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>}
          <div className="flex gap-2">
            <input value={claimCode} onChange={e => setClaimCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              maxLength={8}
              className="flex-1 bg-[#0a0a0a] border border-white/[0.08] rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white tracking-[0.3em] uppercase focus:border-[#f59e0b]/50 outline-none transition-colors"
              data-testid="chase-claim-input" />
            <button onClick={handleReveal} disabled={revealing || !claimCode.trim()}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20"
              data-testid="chase-reveal-btn">
              {revealing ? '...' : 'REVEAL'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Cards by tier */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-16 space-y-10">

        {/* CHASERS - Big cards */}
        {chaseCards.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="flex items-center gap-2 mb-5">
              <Crown className="w-5 h-5 text-[#f59e0b]" />
              <h2 className="text-lg font-black text-white">CHASERS</h2>
              <span className="text-xs text-gray-500 ml-2">{chaseCards.length} card{chaseCards.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-5">
              {chaseCards.map((card, idx) => (
                <div key={`chase-${idx}`} className="w-[220px] sm:w-[260px]">
                  <CardItem card={card} size="large" />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* MID TIER - Medium cards */}
        {midCards.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-[#3b82f6]" />
              <h2 className="text-base font-black text-white">MID TIER</h2>
              <span className="text-xs text-gray-500 ml-2">{midCards.length} cards</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {midCards.map((card, idx) => (
                <CardItem key={`mid-${idx}`} card={card} size="medium" />
              ))}
            </div>
          </motion.section>
        )}

        {/* LOW TIER - Smaller cards */}
        {lowCards.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <div className="flex items-center gap-2 mb-4">
              <Gem className="w-4 h-4 text-gray-400" />
              <h2 className="text-base font-black text-white">BASE</h2>
              <span className="text-xs text-gray-500 ml-2">{lowCards.length} cards</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {lowCards.map((card, idx) => (
                <CardItem key={`low-${idx}`} card={card} size="small" />
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* eBay CTA */}
      {pack.ebay_url && (
        <div className="relative z-10 text-center pb-12">
          <a href={pack.ebay_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-amber-500/20"
            data-testid="chase-buy-spot-ebay">
            <ShoppingBag className="w-4 h-4" /> Buy a Spot on eBay — ${pack.price?.toFixed(2)}
          </a>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center">
        <p className="text-[10px] text-gray-600">Powered by <span className="text-[#3b82f6] font-bold">FlipSlab Engine</span></p>
      </footer>
    </div>
  );
};

export default ChaseRevealPage;
