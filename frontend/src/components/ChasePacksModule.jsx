import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Crown, Zap, Gem, RefreshCw, Copy, UserPlus, ExternalLink, ChevronLeft, ChevronRight, Eye, DollarSign, Package, Users, Clock, Check, BarChart3, Pencil, Pause, Play, XCircle, Trash2, RotateCcw, Upload, Save, X, UserMinus, KeyRound, AlertTriangle, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLE = {
  active: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Active' },
  paused: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Paused' },
  completed: { bg: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/30', text: 'text-[#3b82f6]', label: 'Completed' },
  ended: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Ended' },
};

const TIER_OPTS = [
  { value: 'chase', label: 'Chaser', icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', badge: 'bg-gradient-to-r from-amber-500 to-orange-600' },
  { value: 'mid', label: 'Mid', icon: Zap, color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/30', badge: 'bg-gradient-to-r from-[#3b82f6] to-blue-600' },
  { value: 'low', label: 'Base', icon: Gem, color: 'text-gray-400', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]', badge: 'bg-gradient-to-r from-gray-600 to-gray-700' },
];

const TierBadge = ({ tier }) => {
  const t = TIER_OPTS.find(o => o.value === tier) || TIER_OPTS[2];
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white ${t.badge}`}>
      <Icon className="w-2 h-2" /> {t.label.toUpperCase()}
    </span>
  );
};

// ===== PACK LIST VIEW =====
const PackListView = ({ packs, loading, onSelectPack }) => {
  const activePacks = packs.filter(p => p.status === 'active' || p.status === 'paused');
  const completedPacks = packs.filter(p => p.status === 'completed' || p.status === 'ended');

  const totalRevenue = packs.reduce((sum, p) => sum + (p.spots_claimed || 0) * (p.price || 0), 0);
  const totalSpots = packs.reduce((sum, p) => sum + (p.total_spots || 0), 0);
  const totalClaimed = packs.reduce((sum, p) => sum + (p.spots_claimed || 0), 0);

  return (
    <div className="space-y-6" data-testid="chase-packs-list">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Package, color: 'text-[#f59e0b]', label: 'Active Packs', value: activePacks.length },
          { icon: Users, color: 'text-[#3b82f6]', label: 'Spots Sold', value: `${totalClaimed}`, sub: `/${totalSpots}` },
          { icon: DollarSign, color: 'text-emerald-400', label: 'Revenue', value: `$${totalRevenue.toFixed(2)}`, isGreen: true },
          { icon: BarChart3, color: 'text-purple-400', label: 'Completed', value: completedPacks.length },
        ].map((s, i) => (
          <div key={i} className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-[10px] text-gray-500 uppercase">{s.label}</span>
            </div>
            <p className={`text-2xl font-black ${s.isGreen ? 'text-emerald-400' : 'text-white'}`}>
              {s.value}{s.sub && <span className="text-sm text-gray-500 font-normal">{s.sub}</span>}
            </p>
          </div>
        ))}
      </div>

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

// ===== CONFIRM MODAL =====
const ConfirmModal = ({ title, message, onConfirm, onCancel, danger }) => (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
          <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-amber-400'}`} />
        </div>
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>
      <p className="text-sm text-gray-400 mb-5">{message}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.05] text-gray-400 text-sm font-medium hover:bg-white/[0.08] transition-colors" data-testid="confirm-cancel">Cancel</button>
        <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-bold transition-colors ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'}`} data-testid="confirm-action">Confirm</button>
      </div>
    </div>
  </div>
);

// ===== PACK DETAIL VIEW =====
const PackDetailView = ({ packId, onBack }) => {
  const [fullPack, setFullPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyerName, setBuyerName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [checkingSales, setCheckingSales] = useState(false);

  const fetchPack = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ebay/chase-packs`, { withCredentials: true });
      const myPack = res.data.packs?.find(p => p.pack_id === packId);
      setFullPack(myPack || null);
      if (myPack) {
        setEditTitle(myPack.title || '');
        setEditPrice(myPack.price?.toString() || '');
      }
    } catch {
      toast.error('Failed to load pack');
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => { fetchPack(); }, [fetchPack]);

  const saveEdits = async () => {
    setSaving(true);
    try {
      const updates = {};
      if (editTitle.trim() !== fullPack.title) updates.title = editTitle.trim();
      const newPrice = parseFloat(editPrice);
      if (!isNaN(newPrice) && newPrice !== fullPack.price) updates.price = newPrice;
      if (Object.keys(updates).length === 0) { setEditing(false); setSaving(false); return; }
      const res = await axios.patch(`${API}/api/ebay/chase/${packId}`, updates, { withCredentials: true });
      if (res.data.success) {
        toast.success('Pack updated');
        setEditing(false);
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action, body = {}) => {
    setActionLoading(action);
    try {
      let res;
      if (action === 'delete') {
        res = await axios.delete(`${API}/api/ebay/chase/${packId}`, { withCredentials: true });
      } else {
        res = await axios.post(`${API}/api/ebay/chase/${packId}/${action}`, body, { withCredentials: true });
      }
      if (res.data.success) {
        toast.success(res.data.message);
        if (action === 'delete') { onBack(); return; }
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
      setConfirm(null);
    }
  };

  const syncToEbay = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/sync-ebay`, {}, { withCredentials: true });
      if (res.data.success) toast.success(res.data.message);
      else toast.error(res.data.error || 'Sync failed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const checkSales = async () => {
    setCheckingSales(true);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/check-sales`, {}, { withCredentials: true });
      if (res.data.new_sales > 0) {
        toast.success(`${res.data.new_sales} new sale(s) detected! Buyers auto-assigned.`);
        fetchPack();
      } else {
        toast.info('No new sales found');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check failed');
    } finally {
      setCheckingSales(false);
    }
  };

  const assignBuyer = async () => {
    if (!buyerName.trim()) return;
    setAssigning(true);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/assign`, { buyer_username: buyerName.trim() }, { withCredentials: true });
      if (res.data.success) {
        toast.success(`Assigned! Code: ${res.data.claim_code}`);
        navigator.clipboard.writeText(res.data.claim_code);
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

  const unassignBuyer = async (cardId) => {
    setActionLoading(`unassign-${cardId}`);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/unassign`, { card_id: cardId }, { withCredentials: true });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
      setConfirm(null);
    }
  };

  const regenerateCode = async (cardId) => {
    setActionLoading(`regen-${cardId}`);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/regenerate-code`, { card_id: cardId }, { withCredentials: true });
      if (res.data.success) {
        navigator.clipboard.writeText(res.data.new_code);
        toast.success(`New code: ${res.data.new_code} (copied)`);
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const changeChaseCard = async (cardId) => {
    setActionLoading(`chase-${cardId}`);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/change-chase`, { card_id: cardId }, { withCredentials: true });
      if (res.data.success) {
        toast.success('Chase card updated');
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const updateTier = async (cardId, tier) => {
    setActionLoading(`tier-${cardId}`);
    try {
      const res = await axios.post(`${API}/api/ebay/chase/${packId}/update-tiers`, { tiers: { [cardId]: tier } }, { withCredentials: true });
      if (res.data.success) {
        toast.success(`Tier updated to ${tier}`);
        fetchPack();
      } else {
        toast.error(res.data.error || 'Failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const copyCode = (code) => { navigator.clipboard.writeText(code); toast.success(`Code ${code} copied!`); };
  const copyRevealLink = () => { navigator.clipboard.writeText(`${window.location.origin}/chase/${packId}`); toast.success('Reveal link copied!'); };

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-[#f59e0b]" /></div>;
  if (!fullPack) return <p className="text-gray-500 text-center py-10">Pack not found</p>;

  const claimed = fullPack.spots_claimed || 0;
  const total = fullPack.total_spots || 0;
  const progress = total > 0 ? (claimed / total) * 100 : 0;
  const status = STATUS_STYLE[fullPack.status] || STATUS_STYLE.ended;
  const assignedCards = fullPack.cards?.filter(c => c.assigned_to) || [];
  const unassignedCards = fullPack.cards?.filter(c => !c.assigned_to) || [];
  const isActive = fullPack.status === 'active';
  const isPaused = fullPack.status === 'paused';
  const isEditable = isActive || isPaused;

  return (
    <div className="space-y-4" data-testid="chase-pack-detail">
      {confirm && <ConfirmModal {...confirm} />}

      {/* Header — Click to edit title & price */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[#111] transition-colors" data-testid="pack-detail-back">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <Flame className="w-4 h-4 text-[#f59e0b] shrink-0" />

          {/* Title — click to edit */}
          {editing === 'title' ? (
            <div className="flex items-center gap-1.5">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={80} autoFocus
                className="min-w-[250px] bg-[#0a0a0a] border border-[#f59e0b]/40 rounded-lg px-3 py-1.5 text-base font-black text-white outline-none"
                data-testid="edit-title-input"
                onKeyDown={e => { if (e.key === 'Enter') saveEdits(); if (e.key === 'Escape') { setEditing(false); setEditTitle(fullPack.title); } }} />
              <button onClick={saveEdits} disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-40"
                data-testid="save-edits-btn">
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditTitle(fullPack.title); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-white/[0.05]" data-testid="cancel-edit-btn">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => isEditable && setEditing('title')}
              className={`text-base font-black text-white truncate ${isEditable ? 'hover:bg-white/[0.04] px-2 py-0.5 rounded-lg border border-transparent hover:border-white/[0.1] cursor-text transition-all group' : ''}`}
              data-testid="edit-pack-btn" title={isEditable ? 'Click to edit title' : ''}>
              {fullPack.title}
              {isEditable && <Pencil className="w-3 h-3 text-gray-600 inline ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          )}

          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${status.bg} ${status.text} border ${status.border}`}>{status.label}</span>

          {/* Price — click to edit */}
          {editing === 'price' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-400">$</span>
              <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" step="0.01" min="0.01" autoFocus
                className="w-24 bg-[#0a0a0a] border border-[#f59e0b]/40 rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
                data-testid="edit-price-input"
                onKeyDown={e => { if (e.key === 'Enter') saveEdits(); if (e.key === 'Escape') { setEditing(false); setEditPrice(fullPack.price?.toString()); } }} />
              <button onClick={saveEdits} disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-40">
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditPrice(fullPack.price?.toString()); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-white/[0.05]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => isEditable && setEditing('price')}
              className={`text-sm text-gray-400 shrink-0 ${isEditable ? 'hover:bg-white/[0.04] px-2 py-0.5 rounded-lg border border-transparent hover:border-white/[0.1] cursor-text transition-all group' : ''}`}
              title={isEditable ? 'Click to edit price' : ''}>
              ${fullPack.price?.toFixed(2)}/spot
              {isEditable && <Pencil className="w-2.5 h-2.5 text-gray-600 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          )}

          <span className="text-xs text-gray-500 shrink-0">{claimed}/{total}</span>
        </div>
      </div>

      {/* Stats bar + Quick actions — Single compact row */}
      <div className="flex items-stretch gap-3 flex-wrap">
        {/* Progress mini */}
        <div className="flex-1 min-w-[200px] bg-[#111] border border-white/[0.06] rounded-xl px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">{claimed}/{total} spots</span>
            <span className="text-emerald-400 font-bold">${(claimed * (fullPack.price || 0)).toFixed(2)}</span>
          </div>
          <div className="h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-[#3b82f6]' : 'bg-gradient-to-r from-[#f59e0b] to-orange-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5">
          <button onClick={copyRevealLink} className="px-3 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold hover:bg-[#f59e0b]/20 transition-all flex items-center gap-1.5" data-testid="copy-reveal-link">
            <ExternalLink className="w-3.5 h-3.5" /> Link
          </button>
          {isActive && (
            <button onClick={checkSales} disabled={checkingSales}
              className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
              data-testid="check-sales-btn">
              {checkingSales ? <RefreshCw className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />} Check Sales
            </button>
          )}
          {fullPack.ebay_item_id && fullPack.ebay_item_id !== 'DEMO_123456' && (
            <>
              <a href={`https://www.ebay.com/itm/${fullPack.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold hover:bg-[#3b82f6]/20 transition-all flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> eBay
              </a>
              {isEditable && (
                <button onClick={syncToEbay} disabled={syncing}
                  className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
                  data-testid="sync-ebay-btn">
                  {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Sync
                </button>
              )}
            </>
          )}
          {isActive && (
            <button onClick={() => setConfirm({ title: 'Pause Pack', message: 'Pause this pack?', onConfirm: () => handleAction('pause'), onCancel: () => setConfirm(null) })}
              disabled={!!actionLoading} className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 disabled:opacity-40 flex items-center gap-1.5" data-testid="pause-pack-btn">
              <Pause className="w-3 h-3" /> Pause
            </button>
          )}
          {isPaused && (
            <button onClick={() => handleAction('resume')} disabled={!!actionLoading}
              className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-40 flex items-center gap-1.5" data-testid="resume-pack-btn">
              {actionLoading === 'resume' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Resume
            </button>
          )}
          {isEditable && (
            <button onClick={() => setConfirm({ title: 'End Pack', message: `End pack and return ${total - claimed} cards to inventory?`, danger: true, onConfirm: () => handleAction('end'), onCancel: () => setConfirm(null) })}
              disabled={!!actionLoading} className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/10 disabled:opacity-40 flex items-center gap-1.5" data-testid="end-pack-btn">
              <XCircle className="w-3 h-3" /> End
            </button>
          )}
          <button onClick={() => setConfirm({ title: 'Delete Pack', message: 'Permanently delete this pack?', danger: true, onConfirm: () => handleAction('delete'), onCancel: () => setConfirm(null) })}
            disabled={!!actionLoading} className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/50 text-xs font-medium hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 flex items-center gap-1.5" data-testid="delete-pack-btn">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Assign buyer — Compact inline */}
      {isEditable && claimed < total && (
        <div className="flex items-center gap-2 bg-[#111] border border-[#f59e0b]/15 rounded-xl px-3 py-2" data-testid="assign-buyer-section">
          <UserPlus className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
          <span className="text-xs font-bold text-gray-400 shrink-0">Assign:</span>
          <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
            placeholder="eBay buyer username"
            className="flex-1 bg-[#0a0a0a] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#f59e0b]/40 transition-colors"
            data-testid="assign-buyer-input"
            onKeyDown={e => e.key === 'Enter' && assignBuyer()} />
          <button onClick={assignBuyer} disabled={assigning || !buyerName.trim()}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 transition-all"
            data-testid="assign-buyer-btn">
            {assigning ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Assign'}
          </button>
        </div>
      )}

      {/* ===== BUYERS PANEL — 2 columns with thumbnails ===== */}
      {assignedCards.length > 0 && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden" data-testid="buyers-panel">
          <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#3b82f6]" /> Buyers ({assignedCards.length})
            </h3>
            <span className="text-[10px] text-gray-500">{assignedCards.filter(c => c.revealed).length} revealed</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {assignedCards.map((card, idx) => (
              <div key={idx} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] lg:odd:border-r" data-testid={`buyer-row-${idx}`}>
                {/* # */}
                <span className="text-[10px] text-gray-600 font-mono w-4 shrink-0 text-center">{idx + 1}</span>
                {/* Thumbnail */}
                <div className="w-9 h-12 rounded-md overflow-hidden border border-white/[0.06] shrink-0">
                  {card.image ? (
                    <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#0a0a0a]" />
                  )}
                </div>
                {/* Buyer + Card */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#3b82f6] truncate">{card.assigned_to}</p>
                  <p className="text-[10px] text-gray-500 truncate">{card.player} — {card.year} {card.set_name}</p>
                </div>
                {/* Status */}
                {card.revealed ? (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">✓ Revealed</span>
                ) : (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded shrink-0">◌ Pending</span>
                )}
                {/* Code */}
                <code className="text-[11px] font-mono font-bold text-white bg-[#0a0a0a] border border-white/[0.08] px-2 py-1 rounded tracking-wider shrink-0">
                  {card.claim_code}
                </code>
                <button onClick={() => copyCode(card.claim_code)}
                  className="p-1 rounded hover:bg-[#f59e0b]/20 hover:text-[#f59e0b] text-gray-500 transition-all shrink-0" data-testid={`copy-code-${idx}`}>
                  <Copy className="w-3 h-3" />
                </button>
                {/* Actions */}
                <button onClick={() => regenerateCode(card.card_id)} disabled={!!actionLoading}
                  className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-[9px] font-bold hover:bg-purple-500/20 disabled:opacity-40 shrink-0"
                  data-testid={`regen-code-${idx}`}>
                  {actionLoading === `regen-${card.card_id}` ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : 'New'}
                </button>
                {isEditable && (
                  <button onClick={() => setConfirm({ title: 'Unassign', message: `Remove ${card.assigned_to}?`, danger: true, onConfirm: () => unassignBuyer(card.card_id), onCancel: () => setConfirm(null) })}
                    disabled={!!actionLoading}
                    className="p-1 rounded text-red-400/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 shrink-0"
                    data-testid={`unassign-${idx}`}>
                    <UserMinus className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CARDS — Grouped by tier (clean, no action buttons) ===== */}
      <div className="space-y-5">
        {['chase', 'mid', 'low'].map(tierKey => {
          const tierCards = (fullPack.cards || []).filter(c => (c.tier || (c.is_chase ? 'chase' : 'low')) === tierKey);
          if (tierCards.length === 0) return null;
          const tierInfo = TIER_OPTS.find(o => o.value === tierKey) || TIER_OPTS[2];
          const TIcon = tierInfo.icon;
          return (
            <div key={tierKey}>
              <div className="flex items-center gap-2 mb-2">
                <TIcon className={`w-4 h-4 ${tierInfo.color}`} />
                <span className="text-sm font-bold text-white">{tierInfo.label}</span>
                <span className="text-xs text-gray-500">({tierCards.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {tierCards.map((card, idx) => {
                  const isAssigned = !!card.assigned_to;
                  const tier = card.tier || (card.is_chase ? 'chase' : 'low');
                  return (
                    <div key={idx} className={`bg-[#111] border rounded-xl overflow-hidden group relative ${isAssigned ? 'border-emerald-500/15' : 'border-white/[0.06]'}`}>
                      <div className="relative">
                        {card.image ? (
                          <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className={`w-full aspect-[3/4] object-cover ${isAssigned ? 'brightness-75' : ''}`} />
                        ) : (
                          <div className="w-full aspect-[3/4] bg-[#0a0a0a] flex items-center justify-center"><Flame className="w-5 h-5 text-gray-700" /></div>
                        )}
                        <div className="absolute top-1.5 left-1.5">
                          <TierBadge tier={tier} />
                        </div>
                        {isAssigned && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2.5 py-2">
                            <p className="text-xs font-bold text-[#3b82f6] truncate">{card.assigned_to}</p>
                          </div>
                        )}
                        {!card.is_chase && isEditable && !isAssigned && (
                          <button onClick={() => changeChaseCard(card.card_id)} disabled={!!actionLoading}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-black/70 text-amber-400 text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 hover:bg-amber-500 hover:text-white transition-all">
                            <Crown className="w-2.5 h-2.5" /> Chase
                          </button>
                        )}
                      </div>
                      <div className="px-2.5 py-2 space-y-1">
                        <p className="text-xs font-bold text-white truncate">{card.player}</p>
                        <p className="text-[10px] text-gray-500 truncate">{card.year} {card.set_name}</p>
                        {isEditable && (
                          <select value={tier} onChange={e => updateTier(card.card_id, e.target.value)} disabled={!!actionLoading}
                            className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded px-1.5 py-1 text-[10px] text-gray-300 outline-none cursor-pointer"
                            data-testid={`tier-select-${card.card_id}`}>
                            <option value="chase">Chaser</option>
                            <option value="mid">Mid</option>
                            <option value="low">Base</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== CREATE PACK WIZARD =====
const CreatePackWizard = ({ onBack, onCreated }) => {
  const [step, setStep] = useState(1);
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]); // array of card objects
  const [tiers, setTiers] = useState({}); // { card_id: 'chase'|'mid'|'low' }
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('5.00');
  const [shipping, setShipping] = useState('USPSFirstClass');
  const [shippingCost, setShippingCost] = useState('4.50');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/api/inventory?limit=500`, { withCredentials: true });
        const available = (res.data.items || []).filter(c => c.category !== 'sold' && !c.listed && !c.in_chase_pack);
        setInventory(available);
      } catch { toast.error('Failed to load inventory'); }
      finally { setLoadingInv(false); }
    })();
  }, []);

  const toggleCard = (card) => {
    setSelected(prev => {
      const exists = prev.find(c => c.id === card.id);
      if (exists) return prev.filter(c => c.id !== card.id);
      return [...prev, card];
    });
  };

  const isSelected = (cardId) => selected.some(c => c.id === cardId);
  const chaseCount = Object.values(tiers).filter(t => t === 'chase').length;
  const filtered = inventory.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.player || '').toLowerCase().includes(q) || (c.card_name || '').toLowerCase().includes(q) || (c.set_name || '').toLowerCase().includes(q);
  });

  const setTier = (cardId, tier) => setTiers(prev => ({ ...prev, [cardId]: tier }));

  const goStep2 = () => {
    if (selected.length < 10) { toast.error('Select at least 10 cards'); return; }
    // Auto-assign default tiers
    const defaultTiers = {};
    selected.forEach((c, i) => { defaultTiers[c.id] = i === 0 ? 'chase' : 'low'; });
    setTiers(defaultTiers);
    // Auto-generate title from first chase card
    if (!title) setTitle(`${selected[0]?.player || 'Mystery'} Chase Pack`);
    setStep(2);
  };

  const goStep3 = () => {
    if (chaseCount < 1) { toast.error('Pick at least 1 Chaser card'); return; }
    setStep(3);
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (parseFloat(price) < 1) { toast.error('Price must be at least $1'); return; }
    setCreating(true);
    try {
      const chaseCardId = Object.entries(tiers).find(([, t]) => t === 'chase')?.[0] || selected[0].id;
      // Update tiers on each card before sending
      const cardIds = selected.map(c => c.id);
      const res = await axios.post(`${API}/api/ebay/sell/create-chase-pack`, {
        card_ids: cardIds,
        chase_card_id: chaseCardId,
        title: title.trim(),
        price: parseFloat(price),
        shipping_option: shipping,
        shipping_cost: parseFloat(shippingCost),
        description: `Chase Card Pack! ${selected.length} spots available. Each spot reveals a random card. Can you pull the CHASER?`,
      }, { withCredentials: true });
      if (res.data.success) {
        toast.success(`Pack created! Listed on eBay`);
        // Save tiers to the new pack
        if (res.data.pack_id) {
          await axios.post(`${API}/api/ebay/chase/${res.data.pack_id}/update-tiers`, {
            tiers: Object.entries(tiers).map(([card_id, tier]) => ({ card_id, tier })),
          }, { withCredentials: true }).catch(() => {});
        }
        onCreated();
      } else {
        toast.error(res.data.error || 'Failed to create pack');
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create pack'); }
    finally { setCreating(false); }
  };

  const tierCycle = ['low', 'mid', 'chase'];
  const cycleTier = (cardId) => {
    const cur = tiers[cardId] || 'low';
    const next = tierCycle[(tierCycle.indexOf(cur) + 1) % 3];
    setTier(cardId, next);
  };

  return (
    <div className="p-4 sm:p-6" data-testid="create-pack-wizard">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[#111] transition-colors" data-testid="wizard-back">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-white">New Chase Pack</h1>
          <p className="text-[10px] text-gray-500">Step {step} of 3</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {['Select Cards', 'Set Tiers', 'Details'].map((label, i) => (
          <div key={i} className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold transition-all ${
            step === i + 1 ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30' :
            step > i + 1 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
            'bg-[#111] text-gray-600 border border-white/[0.04]'
          }`}>
            {step > i + 1 ? <Check className="w-3 h-3 inline mr-1" /> : null}{label}
          </div>
        ))}
      </div>

      {/* STEP 1: Select Cards */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..."
              className="flex-1 bg-[#111] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#f59e0b]/40"
              data-testid="wizard-search" />
            <span className={`text-sm font-bold shrink-0 ${selected.length >= 10 ? 'text-emerald-400' : 'text-gray-500'}`}>
              {selected.length} selected
            </span>
          </div>

          {loadingInv ? (
            <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-[#f59e0b]" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-16 text-gray-500 text-sm">No unlisted cards found in inventory</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2" data-testid="wizard-card-grid">
              {filtered.map(card => {
                const thumb = card.store_thumbnail || card.thumbnail || '';
                const sel = isSelected(card.id);
                return (
                  <button key={card.id} onClick={() => toggleCard(card)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      sel ? 'border-[#f59e0b] ring-2 ring-[#f59e0b]/30 scale-[0.97]' : 'border-transparent hover:border-white/[0.15]'
                    }`} data-testid={`wizard-card-${card.id}`}>
                    {thumb ? (
                      <img src={`data:image/jpeg;base64,${thumb}`} alt={card.player} className="w-full aspect-[3/4] object-cover" />
                    ) : (
                      <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-700" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-6">
                      <p className="text-[9px] font-bold text-white truncate">{card.player || card.card_name}</p>
                      <p className="text-[8px] text-gray-400 truncate">{card.year} {card.set_name}</p>
                    </div>
                    {sel && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#f59e0b] flex items-center justify-center">
                        <Check className="w-3 h-3 text-black" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-0 pt-4 bg-[#0a0a0a]">
            <button onClick={goStep2} disabled={selected.length < 10}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm disabled:opacity-40 transition-all"
              data-testid="wizard-next-step2">
              Continue with {selected.length} Cards {selected.length < 10 ? `(need ${10 - selected.length} more)` : ''}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Set Tiers */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Tap a card to cycle its tier. You need at least <span className="text-[#f59e0b] font-bold">1 Chaser</span>.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="wizard-tier-grid">
            {selected.map(card => {
              const tier = tiers[card.id] || 'low';
              const t = TIER_OPTS.find(o => o.value === tier) || TIER_OPTS[2];
              const TIcon = t.icon;
              const thumb = card.store_thumbnail || card.thumbnail || '';
              return (
                <button key={card.id} onClick={() => cycleTier(card.id)}
                  className={`relative rounded-xl overflow-hidden border-2 ${t.border} transition-all hover:scale-[0.97]`}
                  data-testid={`wizard-tier-${card.id}`}>
                  {thumb ? (
                    <img src={`data:image/jpeg;base64,${thumb}`} alt={card.player} className="w-full aspect-[3/4] object-cover" />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-[#111] flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-700" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full text-white ${t.badge}`}>
                      <TIcon className="w-2.5 h-2.5" /> {t.label.toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                    <p className="text-[10px] font-bold text-white truncate">{card.player || card.card_name}</p>
                    <p className="text-[8px] text-gray-500">Tap to change tier</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tier summary */}
          <div className="flex gap-3 text-xs">
            {TIER_OPTS.map(t => {
              const count = Object.values(tiers).filter(v => v === t.value).length;
              return (
                <span key={t.value} className={`${t.color} font-bold`}>
                  {count} {t.label}
                </span>
              );
            })}
          </div>

          <div className="flex gap-3 sticky bottom-0 pt-4 bg-[#0a0a0a]">
            <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl bg-[#111] border border-white/[0.08] text-gray-400 text-sm font-bold">
              Back
            </button>
            <button onClick={goStep3} disabled={chaseCount < 1}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm disabled:opacity-40 transition-all"
              data-testid="wizard-next-step3">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Details & Create */}
      {step === 3 && (
        <div className="space-y-5 max-w-lg">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1.5">Pack Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Kobe Bryant Chase Pack"
              className="w-full bg-[#111] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-[#f59e0b]/40"
              data-testid="wizard-title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1.5">Price per Spot</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">$</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="1" step="0.01"
                  className="w-full bg-[#111] border border-white/[0.08] rounded-xl pl-8 pr-4 py-3 text-sm text-white font-bold outline-none focus:border-[#f59e0b]/40"
                  data-testid="wizard-price" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1.5">Shipping</label>
              <select value={shipping} onChange={e => setShipping(e.target.value)}
                className="w-full bg-[#111] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f59e0b]/40"
                data-testid="wizard-shipping">
                <option value="FreeShipping">Free Shipping</option>
                <option value="PWEEnvelope">PWE Envelope</option>
                <option value="USPSFirstClass">USPS First Class</option>
                <option value="USPSPriority">USPS Priority</option>
              </select>
            </div>
          </div>
          {shipping !== 'FreeShipping' && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1.5">Shipping Cost</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">$</span>
                <input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} min="0" step="0.50"
                  className="w-full bg-[#111] border border-white/[0.08] rounded-xl pl-8 pr-4 py-3 text-sm text-white font-bold outline-none focus:border-[#f59e0b]/40"
                  data-testid="wizard-shipping-cost" />
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-white">Summary</p>
            <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
              <span className="text-gray-500">Cards</span><span className="text-white font-bold text-right">{selected.length}</span>
              <span className="text-gray-500">Spots</span><span className="text-white font-bold text-right">{selected.length}</span>
              <span className="text-gray-500">Price/spot</span><span className="text-white font-bold text-right">${parseFloat(price || 0).toFixed(2)}</span>
              <span className="text-gray-500">Total if sold out</span><span className="text-emerald-400 font-bold text-right">${(selected.length * parseFloat(price || 0)).toFixed(2)}</span>
              <span className="text-gray-500">Chasers</span><span className="text-[#f59e0b] font-bold text-right">{chaseCount}</span>
              <span className="text-gray-500">Mid</span><span className="text-[#3b82f6] font-bold text-right">{Object.values(tiers).filter(t => t === 'mid').length}</span>
              <span className="text-gray-500">Base</span><span className="text-gray-400 font-bold text-right">{Object.values(tiers).filter(t => t === 'low').length}</span>
            </div>
          </div>

          <div className="flex gap-3 sticky bottom-0 pt-4 bg-[#0a0a0a]">
            <button onClick={() => setStep(2)} className="px-6 py-3.5 rounded-xl bg-[#111] border border-white/[0.08] text-gray-400 text-sm font-bold">
              Back
            </button>
            <button onClick={handleCreate} disabled={creating || !title.trim()}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              data-testid="wizard-create-btn">
              {creating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</> : <><Flame className="w-4 h-4" /> Create & List on eBay</>}
            </button>
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
  const [showCreate, setShowCreate] = useState(false);

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

  if (showCreate) {
    return <CreatePackWizard onBack={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchPacks(); }} />;
  }

  if (selectedPackId) {
    return <PackDetailView packId={selectedPackId} onBack={() => { setSelectedPackId(null); fetchPacks(); }} />;
  }

  return (
    <div className="p-4 sm:p-6" data-testid="chase-packs-module">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#f59e0b]" /> Chase Packs
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your Chase Card Pack listings
            <span className="inline-flex items-center gap-1 ml-2 text-emerald-500/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Auto-monitor active
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-black hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-amber-500/20"
            data-testid="new-pack-btn">
            <Flame className="w-3.5 h-3.5" /> New Pack
          </button>
          <button onClick={fetchPacks} disabled={loading}
            className="p-2 rounded-lg hover:bg-[#111] transition-colors" data-testid="refresh-packs">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
