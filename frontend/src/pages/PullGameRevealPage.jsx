import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gem, Crown, Loader2, Trophy, Package, Gift } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const TIER = {
  mini: { label: 'MINI HIT', color: 'text-emerald-400', bg: 'from-emerald-500/30 to-emerald-900/20', icon: Sparkles },
  mid: { label: 'MID CHASE', color: 'text-amber-400', bg: 'from-amber-500/30 to-amber-900/20', icon: Gem },
  blue: { label: 'BLUE CHASE', color: 'text-blue-400', bg: 'from-blue-500/40 to-blue-900/30', icon: Crown },
};

const PullGameRevealPage = () => {
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const navigate = useNavigate();

  const [state, setState] = useState('polling'); // polling | revealing | revealed | failed | mega-select | mega-revealed
  const [spot, setSpot] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [megaCards, setMegaCards] = useState(null);
  const [megaChoice, setMegaChoice] = useState(null);
  const doneRef = useRef(false);

  const poll = useCallback(async () => {
    if (doneRef.current) return true;
    if (!sessionId) { doneRef.current = true; setState('failed'); return true; }
    try {
      const r = await axios.get(`${API}/api/pull-game/checkout/status/${sessionId}`);
      if (r.data.payment_status === 'paid' && r.data.revealed && r.data.spot) {
        doneRef.current = true;
        setSpot(r.data.spot);
        setState('revealing');
        setTimeout(() => setState('revealed'), 1800);
        return true;
      }
      if (r.data.payment_status === 'failed') { doneRef.current = true; setState('failed'); return true; }
    } catch {}
    return false;
  }, [sessionId]);

  useEffect(() => {
    let iv;
    let count = 0;
    const run = async () => {
      const done = await poll();
      count++;
      setPollCount(count);
      if (done || count > 30) {
        clearInterval(iv);
        if (count > 30 && !doneRef.current) { doneRef.current = true; setState('failed'); }
      }
    };
    run();
    iv = setInterval(run, 2000);
    return () => clearInterval(iv);
  }, [poll]);

  // When Blue Chase revealed, show mega box selection
  useEffect(() => {
    if (state === 'revealed' && spot?.chaser_tier === 'blue') {
      // Fetch game to get mega box cards count (don't reveal content - they're hidden boxes)
      axios.get(`${API}/api/pull-game/games/${gameId}`).then(() => {
        setTimeout(() => setState('mega-select'), 2500);
      });
    }
  }, [state, spot, gameId]);

  const pickMegaBox = async (index) => {
    try {
      const r = await axios.post(`${API}/api/pull-game/games/${gameId}/mega-box/${sessionId}`, { box_index: index });
      setMegaChoice(r.data.mega_card);
      setState('mega-revealed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Mega box unavailable');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {state === 'polling' && (
          <motion.div key="polling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center" data-testid="reveal-polling">
            <Loader2 className="w-12 h-12 animate-spin text-amber-400 mx-auto mb-5" />
            <h2 className="text-2xl font-black mb-2">Confirming Payment...</h2>
            <p className="text-sm text-gray-500">Hold tight — revealing your card in seconds.</p>
            <p className="text-xs text-gray-700 mt-3">Check #{pollCount}</p>
          </motion.div>
        )}

        {state === 'revealing' && (
          <motion.div key="revealing" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center" data-testid="reveal-animating">
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.15, 1, 1.15, 1] }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
              className="text-7xl mb-4"
            >
              🎴
            </motion.div>
            <h2 className="text-3xl font-black tracking-tight">REVEALING...</h2>
          </motion.div>
        )}

        {state === 'revealed' && spot && (
          <motion.div key="revealed" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full" data-testid="reveal-result">
            <RevealCard spot={spot} />
            {spot.chaser_tier !== 'blue' && (
              <button onClick={() => navigate(`/pull-game/${gameId}`)} className="mt-6 w-full px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black">
                Back to Board
              </button>
            )}
          </motion.div>
        )}

        {state === 'mega-select' && (
          <MegaBoxSelect onPick={pickMegaBox} />
        )}

        {state === 'mega-revealed' && megaChoice && (
          <motion.div key="mega-revealed" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center" data-testid="mega-revealed">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 1 }} className="text-8xl mb-5">🏆</motion.div>
            <h2 className="text-3xl font-black text-blue-400 mb-2">MEGA CHASE PULLED!</h2>
            <RevealCard spot={{ card_snapshot: megaChoice, chaser_tier: 'blue', is_chaser: true }} />
            <button onClick={() => navigate('/')} className="mt-6 w-full px-5 py-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-black">
              Game Resets — View Other Games
            </button>
          </motion.div>
        )}

        {state === 'failed' && (
          <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center" data-testid="reveal-failed">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">😕</span>
            </div>
            <h2 className="text-2xl font-black mb-2">Something Went Wrong</h2>
            <p className="text-sm text-gray-500 mb-5">We couldn't confirm your payment. If you were charged, contact support.</p>
            <button onClick={() => navigate(`/pull-game/${gameId}`)} className="px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black">
              Back to Board
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RevealCard = ({ spot }) => {
  const isChaser = spot.is_chaser;
  const tier = isChaser && spot.chaser_tier ? TIER[spot.chaser_tier] : null;
  const img = spot.card_snapshot?.thumbnail;
  const Icon = tier?.icon;

  return (
    <div className={`rounded-2xl overflow-hidden border-2 ${tier ? `bg-gradient-to-b ${tier.bg} border-white/10` : 'bg-[#111] border-white/10'}`}>
      {tier && (
        <div className="p-3 text-center border-b border-white/10">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${tier.color}`} />
            <span className={`text-xs font-black uppercase tracking-[0.3em] ${tier.color}`}>{tier.label}</span>
            <Icon className={`w-4 h-4 ${tier.color}`} />
          </div>
          <p className="text-[10px] text-gray-400">You hit a chaser!</p>
        </div>
      )}
      <div className="aspect-[3/4] bg-[#0a0a0a]">
        {img ? <img src={`data:image/jpeg;base64,${img}`} alt="" className="w-full h-full object-cover" /> : <Package className="w-20 h-20 text-gray-700 m-auto mt-20" />}
      </div>
      <div className="p-4 text-center">
        <p className="text-base font-bold text-white mb-1">{spot.card_snapshot?.title}</p>
        {spot.card_snapshot?.grading_company && spot.card_snapshot?.grade && (
          <p className="text-xs text-gray-400 mb-1">{spot.card_snapshot.grading_company} {spot.card_snapshot.grade}</p>
        )}
        <p className="text-lg font-black text-amber-400">${spot.card_snapshot?.value?.toFixed(2) || '—'}</p>
      </div>
    </div>
  );
};

const MegaBoxSelect = ({ onPick }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl w-full text-center" data-testid="mega-select">
    <motion.h2
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="text-4xl font-black text-blue-400 mb-2 tracking-tight"
    >
      👑 BLUE CHASE UNLOCKED 👑
    </motion.h2>
    <p className="text-sm text-blue-200/70 mb-8">Pick ONE of the 4 Mega Boxes below. One contains a MEGA CHASE.</p>
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => (
        <motion.button
          key={i}
          whileHover={{ scale: 1.05, rotateY: 10 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPick(i)}
          data-testid={`mega-box-${i}`}
          className="aspect-square rounded-2xl bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-blue-900/30 border-2 border-blue-400/50 shadow-[0_0_40px_rgba(59,130,246,0.5)] flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 transition-all"
        >
          <Gift className="w-16 h-16 text-blue-300 mb-3" />
          <p className="text-xl font-black text-white">BOX {i + 1}</p>
          <p className="text-[10px] text-blue-200/70 mt-1">Click to open</p>
        </motion.button>
      ))}
    </div>
  </motion.div>
);

export default PullGameRevealPage;
