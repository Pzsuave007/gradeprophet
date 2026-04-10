import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Lock, Unlock, Star, Trophy, Users } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ChaseRevealPage = () => {
  const { packId } = useParams();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimCode, setClaimCode] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [revealedCard, setRevealedCard] = useState(null);
  const [showReveal, setShowReveal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPack();
  }, [packId]);

  const fetchPack = async () => {
    try {
      const res = await axios.get(`${API}/api/ebay/chase/${packId}`);
      setPack(res.data);
    } catch (err) {
      setError('Chase Pack not found');
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async () => {
    if (!claimCode.trim()) return;
    setRevealing(true);
    setError('');
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/reveal`, { claim_code: claimCode.trim().toUpperCase() });
      if (res.data.success) {
        // Start reveal animation
        setShowReveal(true);
        setTimeout(() => {
          setRevealedCard(res.data);
        }, 2500);
      } else {
        setError(res.data.error || 'Invalid code');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid claim code');
    } finally {
      setRevealing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !pack) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (!pack) return null;

  // Reveal Animation Screen - Card spins slow to fast then reveals
  if (showReveal && !revealedCard) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <motion.div
            initial={{ rotateY: 0 }}
            animate={{ rotateY: [0, 360, 720, 1080, 1440, 1800, 2160, 2520, 2880, 3240, 3600] }}
            transition={{
              duration: 3.5,
              times: [0, 0.15, 0.28, 0.39, 0.48, 0.56, 0.63, 0.70, 0.78, 0.88, 1],
              ease: "easeIn",
            }}
            style={{ perspective: 800, transformStyle: 'preserve-3d' }}
            className="w-48 h-64 mx-auto"
          >
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-orange-600 via-red-600 to-yellow-500 flex items-center justify-center shadow-2xl shadow-orange-500/40"
              style={{ backfaceVisibility: 'hidden' }}>
              <Flame className="w-20 h-20 text-white/90" />
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-xl font-black text-orange-400 mt-8"
          >
            Revealing your card...
          </motion.p>
        </div>
      </div>
    );
  }

  // Revealed Card Screen
  if (revealedCard) {
    const card = revealedCard.card;
    const isChase = revealedCard.is_chase;
    return (
      <div className={`min-h-screen flex items-center justify-center overflow-hidden ${isChase ? 'bg-gradient-to-br from-[#1a0800] via-[#050505] to-[#1a0800]' : 'bg-[#050505]'}`}>
        {isChase && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -20, x: Math.random() * window.innerWidth, opacity: 0 }}
                animate={{ y: window.innerHeight + 20, opacity: [0, 1, 0] }}
                transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity }}
                className="absolute text-2xl"
              >
                {['🔥', '⭐', '🏆', '💎'][Math.floor(Math.random() * 4)]}
              </motion.div>
            ))}
          </div>
        )}
        <motion.div
          initial={{ scale: 0, rotateY: 180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="text-center relative z-10 px-4"
        >
          {isChase && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-black text-lg">
                <Trophy className="w-5 h-5" /> CHASE CARD!
              </div>
            </motion.div>
          )}

          {card.image ? (
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              src={`data:image/jpeg;base64,${card.image}`}
              alt={card.player}
              className={`w-64 sm:w-72 mx-auto rounded-xl shadow-2xl ${isChase ? 'shadow-orange-500/40 ring-4 ring-orange-500/50' : 'shadow-white/10'}`}
            />
          ) : (
            <div className={`w-64 h-80 mx-auto rounded-xl flex items-center justify-center ${isChase ? 'bg-gradient-to-br from-orange-900 to-red-900' : 'bg-[#111]'}`}>
              <Star className="w-16 h-16 text-orange-400" />
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <p className="text-2xl font-black text-white">{card.player}</p>
            <p className="text-sm text-gray-400 mt-1">{card.year} {card.set_name}</p>
            {card.variation && <p className="text-sm text-orange-400 font-bold mt-1">{card.variation}</p>}
            <p className="text-xs text-gray-500 mt-4">Congratulations, {revealedCard.buyer}!</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Main Pack View
  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Hero */}
      <div className="bg-gradient-to-b from-orange-950/30 to-transparent pt-8 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold mb-4">
            <Flame className="w-3 h-3" /> CHASE CARD PACK
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">{pack.title}</h1>
          <p className="text-sm text-gray-400">${pack.price?.toFixed(2)} per spot</p>

          {/* Spots info - only show total, not claimed */}
          <div className="mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111] text-xs text-gray-400">
              <Users className="w-3 h-3" /> {pack.total_spots} spots
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        {/* Claim Code Input */}
        <div className="bg-[#111] border border-orange-500/20 rounded-2xl p-6 mb-8" data-testid="chase-claim-section">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-orange-400" /> Enter Your Claim Code
          </h2>
          <p className="text-xs text-gray-500 mb-4">Purchased a spot? Enter your code to reveal your card.</p>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <div className="flex gap-2">
            <input
              value={claimCode}
              onChange={e => setClaimCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g. A1B2C3D4)"
              maxLength={8}
              className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white tracking-widest uppercase focus:border-orange-500/50 outline-none"
              data-testid="chase-claim-input"
            />
            <button
              onClick={handleReveal}
              disabled={revealing || !claimCode.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold hover:from-orange-500 hover:to-red-500 disabled:opacity-40 transition-all"
              data-testid="chase-reveal-btn"
            >
              {revealing ? '...' : 'Reveal'}
            </button>
          </div>
        </div>

        {/* Cards in Pack */}
        <div>
          <h2 className="text-sm font-bold text-white mb-3">{pack.total_spots} Cards in this Pack</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pack.cards?.map((card, idx) => {
              const isChase = card.is_chase;
              return (
                <div key={idx}
                  className={`relative rounded-xl border overflow-hidden ${isChase ? 'border-orange-500/50 bg-orange-500/5' : 'border-[#1a1a1a] bg-[#111]'}`}
                  data-testid={`chase-pack-card-${idx}`}
                >
                  <div className={`aspect-[3/4] flex items-center justify-center ${isChase ? 'bg-gradient-to-br from-orange-950/50 to-transparent' : 'bg-[#0a0a0a]'}`}>
                    {pack.all_revealed && card.image ? (
                      <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2">
                        {isChase ? <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" /> : <Lock className="w-6 h-6 text-gray-600 mx-auto mb-2" />}
                        <p className="text-xs text-gray-400 font-medium">{card.player}</p>
                        <p className="text-[10px] text-gray-600">{card.year} {card.set_name}</p>
                      </div>
                    )}
                  </div>
                  {isChase && (
                    <div className="absolute top-1 right-1 bg-orange-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full">
                      CHASE
                    </div>
                  )}
                  {pack.all_revealed && card.assigned_to && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                      <p className="text-[9px] text-emerald-400 font-bold truncate">{card.assigned_to}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* eBay Link */}
        {pack.ebay_url && (
          <div className="mt-8 text-center">
            <a href={pack.ebay_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] border border-[#222] text-sm text-gray-400 hover:text-white hover:border-orange-500/30 transition-all">
              Buy a Spot on eBay
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChaseRevealPage;
