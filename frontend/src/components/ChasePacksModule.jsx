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
    <div className="space-y-6" data-testid="chase-pack-detail">
      {confirm && <ConfirmModal {...confirm} />}

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-[#111] transition-colors mt-0.5" data-testid="pack-detail-back">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase mb-1 block">Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={80}
                  className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#f59e0b]/50"
                  data-testid="edit-title-input" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase mb-1 block">Price per spot ($)</label>
                <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" step="0.01" min="0.01"
                  className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#f59e0b]/50"
                  data-testid="edit-price-input" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdits} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                  data-testid="save-edits-btn">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
                <button onClick={() => { setEditing(false); setEditTitle(fullPack.title); setEditPrice(fullPack.price?.toString()); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.05] text-gray-400 text-xs font-medium hover:bg-white/[0.08] transition-colors"
                  data-testid="cancel-edit-btn">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-black text-white truncate flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#f59e0b] shrink-0" /> {fullPack.title}
              </h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text} border ${status.border}`}>{status.label}</span>
                <span>${fullPack.price?.toFixed(2)}/spot</span>
                <span>{claimed}/{total} assigned</span>
              </div>
            </>
          )}
        </div>
        {/* Edit button */}
        {!editing && isEditable && (
          <button onClick={() => setEditing(true)}
            className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors" data-testid="edit-pack-btn" title="Edit">
            <Pencil className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Progress + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <div><p className="text-lg font-black text-white">{claimed}</p><p className="text-[10px] text-gray-500">Assigned</p></div>
            <div><p className="text-lg font-black text-[#f59e0b]">{total - claimed}</p><p className="text-[10px] text-gray-500">Remaining</p></div>
            <div><p className="text-lg font-black text-emerald-400">${(claimed * (fullPack.price || 0)).toFixed(2)}</p><p className="text-[10px] text-gray-500">Revenue</p></div>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
          <span className="text-xs font-bold text-white">Actions</span>
          <button onClick={copyRevealLink}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] text-xs font-bold hover:bg-[#f59e0b]/20 transition-all"
            data-testid="copy-reveal-link">
            <ExternalLink className="w-3.5 h-3.5" /> Copy Reveal Link
          </button>
          {fullPack.ebay_item_id && fullPack.ebay_item_id !== 'DEMO_123456' && (
            <>
              <a href={`https://www.ebay.com/itm/${fullPack.ebay_item_id}`} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold hover:bg-[#3b82f6]/20 transition-all">
                <Eye className="w-3.5 h-3.5" /> View on eBay
              </a>
              {isEditable && (
                <button onClick={syncToEbay} disabled={syncing}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 disabled:opacity-40 transition-all"
                  data-testid="sync-ebay-btn">
                  {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Sync to eBay
                </button>
              )}
            </>
          )}

          {/* Status Controls */}
          <div className="border-t border-white/[0.06] pt-2.5 space-y-2">
            {isActive && (
              <button onClick={() => setConfirm({ title: 'Pause Pack', message: 'This will pause the pack. You can resume it later.', onConfirm: () => handleAction('pause'), onCancel: () => setConfirm(null) })}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 disabled:opacity-40 transition-all"
                data-testid="pause-pack-btn">
                <Pause className="w-3.5 h-3.5" /> Pause Pack
              </button>
            )}
            {isPaused && (
              <button onClick={() => handleAction('resume')} disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-40 transition-all"
                data-testid="resume-pack-btn">
                {actionLoading === 'resume' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Resume Pack
              </button>
            )}
            {isEditable && (
              <button onClick={() => setConfirm({ title: 'End Pack', message: `This will end the pack and return ${total - claimed} unassigned cards to inventory. This cannot be undone.`, danger: true, onConfirm: () => handleAction('end'), onCancel: () => setConfirm(null) })}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/10 disabled:opacity-40 transition-all"
                data-testid="end-pack-btn">
                <XCircle className="w-3.5 h-3.5" /> End Pack
              </button>
            )}
            <button onClick={() => setConfirm({ title: 'Delete Pack', message: 'This will permanently delete this pack and return unassigned cards to inventory. This cannot be undone.', danger: true, onConfirm: () => handleAction('delete'), onCancel: () => setConfirm(null) })}
              disabled={!!actionLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/60 text-xs font-medium hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 transition-all"
              data-testid="delete-pack-btn">
              <Trash2 className="w-3.5 h-3.5" /> Delete Pack
            </button>
          </div>
        </div>
      </div>

      {/* Assign Buyer */}
      {isEditable && claimed < total && (
        <div className="bg-[#111] border border-[#f59e0b]/20 rounded-xl p-4" data-testid="assign-buyer-section">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
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
            {assignedCards.map((card, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-[#111] border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/[0.06] shrink-0">
                  {card.image ? (
                    <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center"><Flame className="w-3 h-3 text-gray-700" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white truncate">{card.player}</p>
                    <TierBadge tier={card.tier || (card.is_chase ? 'chase' : 'low')} />
                  </div>
                  <p className="text-[10px] text-gray-500">{card.year} {card.set_name} {card.variation || ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-[#3b82f6]">{card.assigned_to}</p>
                  <p className={`text-[9px] font-bold ${card.revealed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {card.revealed ? 'Revealed' : 'Pending'}
                  </p>
                </div>
                {/* Tier selector */}
                {isEditable && (
                  <select
                    value={card.tier || (card.is_chase ? 'chase' : 'low')}
                    onChange={e => updateTier(card.card_id, e.target.value)}
                    disabled={!!actionLoading}
                    className="bg-[#0a0a0a] border border-white/[0.08] rounded-lg px-2 py-1 text-[10px] text-gray-300 outline-none cursor-pointer shrink-0"
                    data-testid={`tier-select-${card.card_id}`}>
                    <option value="chase">Chaser</option>
                    <option value="mid">Mid</option>
                    <option value="low">Base</option>
                  </select>
                )}
                {/* Card actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => copyCode(card.claim_code)}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors" title={`Code: ${card.claim_code}`}>
                    <Copy className="w-3 h-3 text-gray-400" />
                  </button>
                  <button onClick={() => regenerateCode(card.card_id)}
                    disabled={!!actionLoading}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-purple-500/20 transition-colors" title="Regenerate code">
                    {actionLoading === `regen-${card.card_id}` ? <RefreshCw className="w-3 h-3 animate-spin text-purple-400" /> : <KeyRound className="w-3 h-3 text-purple-400" />}
                  </button>
                  {isEditable && (
                    <button onClick={() => setConfirm({ title: 'Unassign Buyer', message: `Remove ${card.assigned_to} from this spot? The card will become available again with a new claim code.`, danger: true, onConfirm: () => unassignBuyer(card.card_id), onCancel: () => setConfirm(null) })}
                      disabled={!!actionLoading}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/20 transition-colors" title="Unassign buyer">
                      <UserMinus className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
              <div key={idx} className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden group relative">
                <div className="relative">
                  {card.image ? (
                    <img src={`data:image/jpeg;base64,${card.image}`} alt={card.player} className="w-full aspect-[3/4] object-cover" />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-[#0a0a0a] flex items-center justify-center"><Flame className="w-6 h-6 text-gray-700" /></div>
                  )}
                  {/* Tier badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <TierBadge tier={card.tier || (card.is_chase ? 'chase' : 'low')} />
                  </div>
                  {/* Make chase button */}
                  {!card.is_chase && isEditable && (
                    <button onClick={() => changeChaseCard(card.card_id)}
                      disabled={!!actionLoading}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-black/70 text-amber-400 text-[7px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-amber-500 hover:text-white transition-all"
                      title="Make Chase Card">
                      {actionLoading === `chase-${card.card_id}` ? <RefreshCw className="w-2 h-2 animate-spin" /> : <Crown className="w-2 h-2" />} Set Chase
                    </button>
                  )}
                </div>
                <div className="p-2">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-bold text-white truncate">{card.player}</p>
                  </div>
                  <p className="text-[9px] text-gray-500 truncate">{card.year} {card.set_name}</p>
                  {/* Tier selector */}
                  {isEditable && (
                    <select
                      value={card.tier || (card.is_chase ? 'chase' : 'low')}
                      onChange={e => updateTier(card.card_id, e.target.value)}
                      disabled={!!actionLoading}
                      className="mt-1.5 w-full bg-[#0a0a0a] border border-white/[0.08] rounded px-1.5 py-1 text-[9px] text-gray-300 outline-none cursor-pointer"
                      data-testid={`tier-select-${card.card_id}`}>
                      <option value="chase">Chaser</option>
                      <option value="mid">Mid Tier</option>
                      <option value="low">Base</option>
                    </select>
                  )}
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
