import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gem, Crown, Loader2, Trophy, Package, Gift } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const TIER = {
  red: { label: 'RED CHASE', color: 'text-red-400', bg: 'from-red-500/30 to-red-900/20', icon: Sparkles },
  orange: { label: 'ORANGE BOX', color: 'text-amber-400', bg: 'from-amber-500/30 to-amber-900/20', icon: Gem },
  blue: { label: 'BLUE BOX', color: 'text-blue-400', bg: 'from-blue-500/40 to-blue-900/30', icon: Crown },
};

const PullGameRevealPage = () => {
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const navigate = useNavigate();

  const [state, setState] = useState('polling'); // polling | revealing | revealed-card | box-select | box-revealed | summary | failed
  const [spots, setSpots] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [orangeBox, setOrangeBox] = useState([]);
  const [blueBox, setBlueBox] = useState([]);
  const [revealedSpots, setRevealedSpots] = useState([]); // accumulator for summary
  const doneRef = useRef(false);

  const currentSpot = spots[currentIdx];

  const poll = useCallback(async () => {
    if (doneRef.current) return true;
    if (!sessionId) { doneRef.current = true; setState('failed'); return true; }
    try {
      const r = await axios.get(`${API}/api/pull-game/checkout/status/${sessionId}`);
      if (r.data.payment_status === 'paid' && r.data.revealed && (r.data.spots || r.data.spot)) {
        doneRef.current = true;
        const spotsList = r.data.spots || (r.data.spot ? [r.data.spot] : []);
        setSpots(spotsList);
        // Pre-fetch box card pools (in case any are triggers)
        try {
          const gameRes = await axios.get(`${API}/api/pull-game/games/${gameId}`);
          setOrangeBox(gameRes.data.orange_box_cards || []);
          setBlueBox(gameRes.data.blue_box_cards || []);
        } catch {}
        setCurrentIdx(0);
        setState('revealing');
        return true;
      }
      if (r.data.payment_status === 'failed') { doneRef.current = true; setState('failed'); return true; }
    } catch {}
    return false;
  }, [sessionId, gameId]);

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

  // Drive reveal sequence
  useEffect(() => {
    if (state !== 'revealing' || !currentSpot) return;
    const t = setTimeout(() => {
      if (currentSpot.is_trigger) {
        setState('box-select');
      } else {
        setState('revealed-card');
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [state, currentSpot]);

  const continueNext = () => {
    setRevealedSpots(prev => [...prev, currentSpot]);
    if (currentIdx + 1 < spots.length) {
      setCurrentIdx(currentIdx + 1);
      setState('revealing');
    } else {
      setState('summary');
    }
  };

  const pickBox = async (index) => {
    try {
      const r = await axios.post(`${API}/api/pull-game/games/${gameId}/box-pick/${sessionId}`, {
        box_index: index,
        trigger_type: currentSpot.trigger_type,
      });
      // Update current spot with the picked card
      const updatedSpot = { ...currentSpot, card_snapshot: r.data.card };
      const newSpots = [...spots];
      newSpots[currentIdx] = updatedSpot;
      setSpots(newSpots);
      setState('box-revealed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Box pick failed');
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

        {state === 'revealing' && currentSpot && (
          <motion.div key={`revealing-${currentIdx}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center" data-testid="reveal-animating">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-500/70 font-black mb-3">Pull {currentIdx + 1} of {spots.length}</p>
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.15, 1, 1.15, 1] }}
              transition={{ duration: 1.4, ease: 'easeInOut' }}
              className="text-7xl mb-4"
            >
              🎴
            </motion.div>
            <h2 className="text-3xl font-black tracking-tight">REVEALING #{currentSpot.pull_number}...</h2>
          </motion.div>
        )}

        {state === 'revealed-card' && currentSpot && (
          <motion.div key={`revealed-${currentIdx}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full" data-testid="reveal-result">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-500/70 font-black mb-2 text-center">Pull #{currentSpot.pull_number} · {currentIdx + 1}/{spots.length}</p>
            <RevealCard spot={currentSpot} />
            <button onClick={continueNext} className="mt-6 w-full px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black" data-testid="continue-next-btn">
              {currentIdx + 1 < spots.length ? `Reveal Pull #${spots[currentIdx + 1].pull_number} →` : 'See Summary'}
            </button>
          </motion.div>
        )}

        {state === 'box-select' && currentSpot && (
          <BoxSelect
            tone={currentSpot.trigger_type}
            cards={currentSpot.trigger_type === 'orange' ? orangeBox : blueBox}
            onPick={pickBox}
            pullNumber={currentSpot.pull_number}
          />
        )}

        {state === 'box-revealed' && currentSpot?.card_snapshot && (
          <motion.div key={`box-revealed-${currentIdx}`} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center" data-testid="box-revealed">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 1 }} className="text-8xl mb-5">{currentSpot.trigger_type === 'blue' ? '🏆' : '💎'}</motion.div>
            <h2 className={`text-3xl font-black mb-2 ${currentSpot.trigger_type === 'blue' ? 'text-blue-400' : 'text-amber-400'}`}>
              {currentSpot.trigger_type === 'blue' ? 'BLUE BOX PULLED!' : 'ORANGE BOX PULLED!'}
            </h2>
            <RevealCard spot={currentSpot} />
            <button onClick={continueNext} className={`mt-6 w-full px-5 py-3 rounded-lg font-black ${currentSpot.trigger_type === 'blue' ? 'bg-blue-500 hover:bg-blue-400 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`} data-testid="continue-next-btn">
              {currentIdx + 1 < spots.length ? `Reveal Pull #${spots[currentIdx + 1].pull_number} →` : 'See Summary'}
            </button>
          </motion.div>
        )}

        {state === 'summary' && (
          <motion.div key="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl w-full" data-testid="reveal-summary">
            <div className="text-center mb-6">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-6xl mb-3">🎉</motion.div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">All Pulls Revealed!</h2>
              <p className="text-sm text-gray-400 mt-2">{spots.length} card{spots.length !== 1 ? 's' : ''} on the way to your door</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {spots.map((s, i) => (
                <div key={i} className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                  <div className="aspect-[3/4] bg-[#0a0a0a]">
                    {s.card_snapshot?.thumbnail ? <img src={`data:image/jpeg;base64,${s.card_snapshot.thumbnail}`} className="w-full h-full object-cover" alt="" /> : <Package className="w-12 h-12 text-gray-700 m-auto mt-12" />}
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-bold text-gray-500">#{s.pull_number}</p>
                    <p className="text-xs font-bold text-white truncate">{s.card_snapshot?.title || '?'}</p>
                    <p className="text-[10px] text-amber-400 font-bold">${s.card_snapshot?.value?.toFixed(0) || '?'}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate(`/pull-game/${gameId}`)} className="w-full px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black" data-testid="back-to-board-btn">
              Back to Board
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

const BoxSelect = ({ tone, cards, onPick, pullNumber }) => {
  const isBlue = tone === 'blue';
  const colorClass = isBlue ? 'text-blue-400' : 'text-amber-400';
  const bgClass = isBlue
    ? 'from-blue-500/30 via-purple-500/20 to-blue-900/30 border-blue-400/50 shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:border-blue-300'
    : 'from-amber-500/30 via-orange-500/20 to-amber-900/30 border-amber-400/50 shadow-[0_0_40px_rgba(245,158,11,0.5)] hover:border-amber-300';
  const headline = isBlue ? '👑 BLUE BOX UNLOCKED 👑' : '💎 ORANGE BOX UNLOCKED 💎';
  const subline = isBlue ? 'Pick ONE of the 4 Blue Boxes — one is the MEGA chase ($600).' : 'Pick ONE of the 4 Orange Boxes to claim a mid-value chase.';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl w-full text-center" data-testid="box-select">
      {pullNumber && <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 font-black mb-2">Pull #{pullNumber}</p>}
      <motion.h2
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`text-4xl font-black mb-2 tracking-tight ${colorClass}`}
      >
        {headline}
      </motion.h2>
      <p className="text-sm text-gray-400 mb-8">{subline}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPick(i)}
            data-testid={`box-${i}`}
            className={`aspect-[3/4] rounded-2xl bg-gradient-to-br ${bgClass} border-2 flex flex-col items-center justify-center cursor-pointer transition-all`}
          >
            <Gift className={`w-12 h-12 ${colorClass} mb-3`} />
            <p className="text-xl font-black text-white">BOX {i + 1}</p>
            <p className="text-[10px] text-gray-300/70 mt-1">Click to open</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default PullGameRevealPage;
