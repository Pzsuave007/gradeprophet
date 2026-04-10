import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Crown, Zap, Gem, RefreshCw, Copy, UserPlus, ExternalLink, ChevronLeft, ChevronRight, Eye, DollarSign, Package, Users, Clock, Check, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLE = {
  active: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Active' },
  completed: { bg: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/30', text: 'text-[#3b82f6]', label: 'Completed' },
  ended: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Ended' },
};

const TIER_STYLE = {
  chase: { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'CHASER' },
  mid: { icon: Zap, color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/30', label: 'MID' },
  low: { icon: Gem, color: 'text-gray-400', bg: 'bg-white/[0.03]', border: 'border-white/[0.06]', label: 'BASE' },
};

// ===== PACK LIST VIEW =====
const PackListView = ({ packs, loading, onRefresh, onSelectPack }) => {
  const activePacks = packs.filter(p => p.status === 'active');
  const completedPacks = packs.filter(p => p.status !== 'active');

  const totalRevenue = packs.reduce((sum, p) => sum + (p.spots_claimed || 0) * (p.price || 0), 0);
  const totalSpots = packs.reduce((sum, p) => sum + (p.total_spots || 0), 0);
  const totalClaimed = packs.reduce((sum, p) => sum + (p.spots_claimed || 0), 0);

  return (
    <div className="space-y-6" data-testid="chase-packs-list">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[#f59e0b]" />
            <span className="text-[10px] text-gray-500 uppercase">Active Packs</span>
          </div>
          <p className="text-2xl font-black text-white">{activePacks.length}</p>
        </div>
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-[10px] text-gray-500 uppercase">Spots Sold</span>
          </div>
          <p className="text-2xl font-black text-white">{totalClaimed}<span className="text-sm text-gray-500 font-normal">/{totalSpots}</span></p>
        </div>
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-gray-500 uppercase">Revenue</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] text-gray-500 uppercase">Completed</span>
          </div>
          <p className="text-2xl font-black text-white">{completedPacks.length}</p>
        </div>
      </div>

      {/* Active Packs */}
      {activePacks.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#f59e0b]" /> Active Packs
          </h2>
          <div className="space-y-3">
            {activePacks.map(pack => (
              <PackCard key={pack.pack_id} pack={pack} onClick={() => onSelectPack(pack.pack_id)} />
            ))}
          </div>
        </div>
      )}

      {/* Completed/Ended */}
      {completedPacks.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-400 mb-3">Past Packs</h2>
          <div className="space-y-3">
            {completedPacks.map(pack => (
              <PackCard key={pack.pack_id} pack={pack} onClick={() => onSelectPack(pack.pack_id)} />
            ))}
          </div>
        </div>
      )}

      {packs.length === 0 && !loading && (
        <div className="text-center py-16">
          <Flame className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-sm font-medium">No Chase Packs yet</p>
          <p className="text-gray-600 text-xs mt-1">Go to Inventory, select 10+ cards, and click "Chase Pack" to create one.</p>
        </div>
      )}
    </div>
  );
};

const PackCard = ({ pack, onClick }) => {
  const status = STATUS_STYLE[pack.status] || STATUS_STYLE.ended;
  const claimed = pack.spots_claimed || 0;
  const total = pack.total_spots || 0;
  const progress = total > 0 ? (claimed / total) * 100 : 0;

  return (
    <button onClick={onClick}
      className="w-full text-left bg-[#111] border border-white/[0.06] rounded-xl p-4 hover:border-[#f59e0b]/30 transition-all group"
      data-testid={`pack-card-${pack.pack_id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
            <h3 className="text-sm font-bold text-white truncate">{pack.title}</h3>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text} border ${status.border}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-1">
            <span>${pack.price?.toFixed(2)}/spot</span>
            <span>{claimed}/{total} spots</span>
            <span>${(claimed * (pack.price || 0)).toFixed(2)} earned</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-[#3b82f6]' : 'bg-gradient-to-r from-[#f59e0b] to-orange-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#f59e0b] transition-colors shrink-0 mt-1" />
      </div>
    </button>
  );
};

// ===== PACK DETAIL VIEW =====
const PackDetailView = ({ packId, onBack }) => {
  const [pack, setPack] = useState(null);
  const [fullPack, setFullPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyerName, setBuyerName] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchPack = useCallback(async () => {
    try {
      const [pubRes, privRes] = await Promise.all([
        axios.get(`${API}/api/ebay/chase/${packId}`),
        axios.get(`${API}/api/ebay/chase-packs`, { withCredentials: true }),
      ]);
      setPack(pubRes.data);
      const myPack = privRes.data.packs?.find(p => p.pack_id === packId);
      setFullPack(myPack);
    } catch (err) {
      toast.error('Failed to load pack');
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
        toast.success(`Assigned! Code: ${res.data.claim_code}`);
        navigator.clipboard.writeText(res.data.claim_code);
        toast.success('Code copied to clipboard!');
        setBuyerName('');
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setAssigning(false);
    }
  };

  const copyRevealLink = () => {
    const link = `${window.location.origin}/chase/${packId}`;
    navigator.clipboard.writeText(link);
    toast.success('Reveal link copied!');
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-[#f59e0b]" />
      </div>
    );
  }

  if (!pack || !fullPack) return <p className="text-gray-500 text-center py-10">Pack not found</p>;

  const claimed = fullPack.spots_claimed || 0;
  const total = fullPack.total_spots || 0;
  const progress = total > 0 ? (claimed / total) * 100 : 0;
  const status = STATUS_STYLE[fullPack.status] || STATUS_STYLE.ended;

  // Organize cards by assignment status
  const assignedCards = fullPack.cards?.filter(c => c.assigned_to) || [];
  const unassignedCards = fullPack.cards?.filter(c => !c.assigned_to) || [];

  return (
    <div className="space-y-6" data-testid="chase-pack-detail">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-[#111] transition-colors" data-testid="pack-detail-back">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-white truncate flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#f59e0b] shrink-0" /> {fullPack.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text} border ${status.border}`}>{status.label}</span>
            <span>${fullPack.price?.toFixed(2)}/spot</span>
            <span>{claimed}/{total} assigned</span>
          </div>
        </div>
      </div>

      {/* Progress + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white">Spots Progress</span>
            <span className="text-xs text-gray-500">{claimed}/{total}</span>
          </div>
          <div className="h-3 bg-[#0a0a0a] rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-[#3b82f6]' : 'bg-gradient-to-r from-[#f59e0b] to-orange-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-black text-white">{claimed}</p>
              <p className="text-[10px] text-gray-500">Assigned</p>
            </div>
            <div>
              <p className="text-lg font-black text-[#f59e0b]">{total - claimed}</p>
              <p className="text-[10px] text-gray-500">Remaining</p>
            </div>
            <div>
              <p className="text-lg font-black text-emerald-400">${(claimed * (fullPack.price || 0)).toFixed(2)}</p>
              <p className="text-[10px] text-gray-500">Revenue</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <span className="text-xs font-bold text-white">Quick Actions</span>
          <button onClick={copyRevealLink}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold hover:bg-[#f59e0b]/20 transition-all"
            data-testid="copy-reveal-link">
            <ExternalLink className="w-3.5 h-3.5" /> Copy Reveal Page Link
          </button>
          {fullPack.ebay_item_id && fullPack.ebay_item_id !== 'DEMO_123456' && (
            <a href={`https://www.ebay.com/itm/${fullPack.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold hover:bg-[#3b82f6]/20 transition-all">
              <Eye className="w-3.5 h-3.5" /> View on eBay
            </a>
          )}
        </div>
      </div>

      {/* Assign Buyer */}
      {claimed < total && (
        <div className="bg-[#111] border border-[#f59e0b]/20 rounded-xl p-4" data-testid="assign-buyer-section">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#f59e0b]" /> Assign New Buyer
          </h3>
          <p className="text-[10px] text-gray-500 mb-3">Enter the buyer's eBay username. A random card will be assigned and a claim code generated.</p>
          <div className="flex gap-2">
            <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
              placeholder="eBay buyer username"
              className="flex-1 bg-[#0a0a0a] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#f59e0b]/50 transition-colors"
              data-testid="assign-buyer-input"
              onKeyDown={e => e.key === 'Enter' && assignBuyer()} />
            <button onClick={assignBuyer} disabled={assigning || !buyerName.trim()}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 transition-all"
              data-testid="assign-buyer-btn">
              {assigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {/* Assigned Cards */}
      {assignedCards.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" /> Assigned Spots ({assignedCards.length})
          </h3>
          <div className="space-y-2">
            {assignedCards.map((card, idx) => {
              const tier = TIER_STYLE[card.is_chase ? 'chase' : 'low'];
              // Determine tier from value comparison
              return (
                <div key={idx} className="flex items-center gap-3 bg-[#111] border border-white/[0.06] rounded-xl px-4 py-3">
                  {/* Card thumbnail */}
                  <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/[0.06] shrink-0">
                    {card.image ? (
                      <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
                        <Flame className="w-3 h-3 text-gray-700" />
                      </div>
                    )}
                  </div>
                  {/* Card info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate">{card.player}</p>
                      {card.is_chase && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">CHASE</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500">{card.year} {card.set_name} {card.variation || ''}</p>
                  </div>
                  {/* Buyer */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-[#3b82f6]">{card.assigned_to}</p>
                    <p className={`text-[9px] font-bold ${card.revealed ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {card.revealed ? 'Revealed' : 'Pending'}
                    </p>
                  </div>
                  {/* Copy code */}
                  <button onClick={() => copyCode(card.claim_code)}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors shrink-0" title={`Code: ${card.claim_code}`}>
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unassigned Cards */}
      {unassignedCards.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Available Cards ({unassignedCards.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {unassignedCards.map((card, idx) => (
              <div key={idx} className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="relative">
                  {card.image ? (
                    <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full aspect-[3/4] object-cover" />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-[#0a0a0a] flex items-center justify-center">
                      <Flame className="w-6 h-6 text-gray-700" />
                    </div>
                  )}
                  {card.is_chase && (
                    <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="w-2 h-2" /> CHASE
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-bold text-white truncate">{card.player}</p>
                  <p className="text-[9px] text-gray-500 truncate">{card.year} {card.set_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== MAIN MODULE =====
const ChasePacksModule = () => {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState(null);

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ebay/chase-packs`, { withCredentials: true });
      setPacks(res.data.packs || []);
    } catch (err) {
      console.error('Failed to fetch chase packs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);

  if (selectedPackId) {
    return <PackDetailView packId={selectedPackId} onBack={() => { setSelectedPackId(null); fetchPacks(); }} />;
  }

  return (
    <div className="p-4 sm:p-6" data-testid="chase-packs-module">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#f59e0b]" /> Chase Packs
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your Chase Card Pack listings</p>
        </div>
        <button onClick={fetchPacks} disabled={loading}
          className="p-2 rounded-lg hover:bg-[#111] transition-colors" data-testid="refresh-packs">
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-[#f59e0b]" />
        </div>
      ) : (
        <PackListView packs={packs} loading={loading} onRefresh={fetchPacks} onSelectPack={setSelectedPackId} />
      )}
    </div>
  );
};

export default ChasePacksModule;
