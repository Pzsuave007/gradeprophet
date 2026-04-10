import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Copy, UserPlus, Users, RefreshCw, ExternalLink, Check } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ChasePackPanel = ({ packId, cardCount, spotsClaimed: initialClaimed }) => {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyerName, setBuyerName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchPack = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ebay/chase/${packId}`);
      setPack(res.data);
    } catch (err) {
      console.error('Failed to fetch chase pack:', err);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => { fetchPack(); }, [fetchPack]);

  const assignBuyer = async () => {
    if (!buyerName.trim()) return;
    setAssigning(true);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/assign`, { buyer_username: buyerName.trim() }, { withCredentials: true });
      if (res.data.success) {
        toast.success(`Spot assigned to ${buyerName}! Code: ${res.data.claim_code}`);
        setBuyerName('');
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed to assign');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign buyer');
    } finally {
      setAssigning(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyRevealLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/chase/${packId}`;
    navigator.clipboard.writeText(link);
    toast.success('Reveal link copied!');
  };

  if (loading) {
    return (
      <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
        <span className="text-xs text-gray-400">Loading chase pack...</span>
      </div>
    );
  }

  if (!pack) return null;

  const claimed = pack.spots_claimed || 0;
  const total = pack.total_spots || cardCount;
  const progress = (claimed / total) * 100;

  // Get assigned cards with codes from the full pack data via seller endpoint
  return (
    <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-3" data-testid="chase-pack-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-400">Chase Pack ({total} cards)</span>
        </div>
        <button onClick={fetchPack} className="text-gray-500 hover:text-white transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>{claimed}/{total} spots assigned</span>
          <span>{total - claimed} remaining</span>
        </div>
        <div className="h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Assign Buyer */}
      {claimed < total && (
        <div className="flex gap-2" data-testid="chase-assign-section">
          <input
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
            placeholder="eBay buyer username"
            className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50"
            data-testid="chase-buyer-input"
            onKeyDown={e => e.key === 'Enter' && assignBuyer()}
          />
          <button onClick={assignBuyer} disabled={assigning || !buyerName.trim()}
            className="px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/30 disabled:opacity-40 transition-colors"
            data-testid="chase-assign-btn">
            {assigning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Reveal Link */}
      <button onClick={copyRevealLink}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#0a0a0a] border border-[#222] text-xs text-gray-400 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
        data-testid="chase-copy-link">
        <ExternalLink className="w-3 h-3" /> Copy Reveal Page Link
      </button>

      {/* Assigned list */}
      {pack.cards?.some(c => c.claimed) && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-500 uppercase">Assigned Spots</p>
          {pack.cards.filter(c => c.claimed).map((card, idx) => (
            <div key={idx} className="flex items-center justify-between bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]">
              <span className="text-[10px] text-gray-400 truncate">{card.assigned_to || 'Buyer'}</span>
              <span className={`text-[9px] font-bold ${card.revealed ? 'text-emerald-400' : 'text-amber-400'}`}>
                {card.revealed ? 'Revealed' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Completion */}
      {pack.all_revealed && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
          <p className="text-xs font-bold text-emerald-400">All spots filled! Results are public.</p>
        </div>
      )}
    </div>
  );
};

export default ChasePackPanel;
