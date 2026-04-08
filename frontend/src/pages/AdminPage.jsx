import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Shield, DollarSign, Package, Zap, Tag, Search,
  ChevronLeft, ChevronRight, Crown, Ban, Trash2, Eye,
  RefreshCw, BarChart3, ArrowUpRight, X, AlertTriangle,
  Sliders, Plus, Save, Star, Pencil, Sun, Palette, Sparkles, Layers, Focus
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PLAN_LABELS = { rookie: 'Rookie', mvp: 'MVP', hall_of_famer: 'Hall of Famer' };
const PLAN_COLORS = { rookie: '#6b7280', mvp: '#f59e0b', hall_of_famer: '#a855f7' };
const PLAN_ICONS = { rookie: Tag, mvp: Star, hall_of_famer: Crown };
const PLAN_OPTIONS = ['rookie', 'mvp', 'hall_of_famer'];

const fmt = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '$0';
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
};

// ==================== STATS CARDS ====================
const StatsGrid = ({ stats }) => {
  const cards = [
    { label: 'Total Users', value: stats.total_users, icon: Users, color: '#3b82f6', bg: 'from-blue-600/20 to-blue-900/5', border: 'border-blue-500/20' },
    { label: 'This Week', value: stats.recent_signups, icon: ArrowUpRight, color: '#10b981', bg: 'from-emerald-600/20 to-emerald-900/5', border: 'border-emerald-500/20' },
    { label: 'Revenue', value: fmt(stats.total_revenue), icon: DollarSign, color: '#f59e0b', bg: 'from-amber-600/20 to-amber-900/5', border: 'border-amber-500/20' },
    { label: 'Paid Txns', value: stats.paid_transactions, icon: Tag, color: '#a855f7', bg: 'from-purple-600/20 to-purple-900/5', border: 'border-purple-500/20' },
    { label: 'Total Cards', value: stats.total_inventory, icon: Package, color: '#06b6d4', bg: 'from-cyan-600/20 to-cyan-900/5', border: 'border-cyan-500/20' },
    { label: 'Total Scans', value: stats.total_scans, icon: Zap, color: '#ec4899', bg: 'from-pink-600/20 to-pink-900/5', border: 'border-pink-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => (
        <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-xl p-3.5`} data-testid={`admin-stat-${c.label.toLowerCase().replace(/\s/g, '-')}`}>
          <c.icon className="w-4 h-4 mb-2" style={{ color: c.color }} />
          <p className="text-xl font-black text-white">{c.value}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">{c.label}</p>
        </motion.div>
      ))}
    </div>
  );
};

// ==================== PLAN DISTRIBUTION ====================
const PlanDistribution = ({ byPlan, total }) => (
  <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4" data-testid="plan-distribution">
    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Users by Plan</h3>
    <div className="space-y-2.5">
      {PLAN_OPTIONS.map(p => {
        const count = byPlan[p] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        const PIcon = PLAN_ICONS[p];
        return (
          <div key={p} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PIcon className="w-3.5 h-3.5" style={{ color: PLAN_COLORS[p] }} />
                <span className="text-xs font-semibold text-gray-300">{PLAN_LABELS[p]}</span>
              </div>
              <span className="text-xs font-bold text-white">{count}</span>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: PLAN_COLORS[p] }} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ==================== USER CARD ====================
const UserCard = ({ user, onViewInventory, onChangePlan, onBan, onDelete }) => {
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(user.plan_id);
  const planColor = PLAN_COLORS[user.plan_id] || '#6b7280';
  const PIcon = PLAN_ICONS[user.plan_id] || Tag;

  const handlePlanSave = async () => {
    if (selectedPlan === user.plan_id) { setChangingPlan(false); return; }
    await onChangePlan(user.user_id, selectedPlan);
    setChangingPlan(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#111] border border-[#1a1a1a] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors ${user.banned ? 'opacity-40 border-red-500/20' : ''}`}
      data-testid={`admin-user-${user.email}`}>

      {/* Top: Avatar + Name + Plan */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5 text-gray-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{user.name || 'No name'}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
            {user.created_at && (
              <p className="text-[10px] text-gray-700 mt-0.5">Joined {new Date(user.created_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>
        {/* Plan Badge */}
        {!changingPlan ? (
          <button onClick={() => setChangingPlan(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer hover:brightness-125 transition-all"
            style={{ background: `${planColor}15`, border: `1px solid ${planColor}30`, color: planColor }}
            data-testid="plan-badge-btn">
            <PIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{PLAN_LABELS[user.plan_id] || 'Rookie'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
              className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs text-white px-3 py-1.5 outline-none focus:border-blue-500/50"
              data-testid="plan-select">
              {PLAN_OPTIONS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
            </select>
            <button onClick={handlePlanSave} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 border border-emerald-500/20" data-testid="plan-save-btn">Save</button>
            <button onClick={() => { setChangingPlan(false); setSelectedPlan(user.plan_id); }} className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-bold border border-[#2a2a2a]">Cancel</button>
          </div>
        )}
      </div>

      {/* Middle: Usage Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
          <Package className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
          <p className="text-lg font-black text-white">{user.usage?.inventory || 0}</p>
          <p className="text-[10px] text-gray-600 font-semibold uppercase">Cards</p>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
          <Zap className="w-4 h-4 text-pink-400 mx-auto mb-1" />
          <p className="text-lg font-black text-white">{user.usage?.scans || 0}</p>
          <p className="text-[10px] text-gray-600 font-semibold uppercase">Scans</p>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-3 text-center">
          <Tag className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg font-black text-white">{user.usage?.listings || 0}</p>
          <p className="text-[10px] text-gray-600 font-semibold uppercase">Listings</p>
        </div>
      </div>

      {/* Bottom: Action Buttons with Labels */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onViewInventory(user)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors"
          data-testid="view-inventory-btn">
          <Eye className="w-3.5 h-3.5" /> View Cards
        </button>
        <button onClick={() => onBan(user)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            user.banned
              ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
              : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
          }`}
          data-testid="ban-btn">
          <Ban className="w-3.5 h-3.5" /> {user.banned ? 'Unban User' : 'Ban User'}
        </button>
        <button onClick={() => onDelete(user)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors ml-auto"
          data-testid="delete-btn">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      {/* Banned indicator */}
      {user.banned && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] text-red-400 font-bold uppercase">Account Banned</span>
        </div>
      )}
    </motion.div>
  );
};

// ==================== INVENTORY MODAL ====================
const InventoryModal = ({ user, onClose }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/api/admin/users/${user.user_id}/inventory?limit=100`)
      .then(res => { setItems(res.data.items || []); setTotal(res.data.total || 0); })
      .catch(() => toast.error('Failed to load inventory'))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}
      data-testid="inventory-modal">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <div>
            <h3 className="text-sm font-bold text-white">{user.name || user.email}'s Inventory</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{total} cards total</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" data-testid="close-inventory-modal">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-[#0f0f0f]">
          {loading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 text-gray-600 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-xs">No cards in inventory</div>
          ) : items.map((item, i) => (
            <div key={item.id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02]" data-testid={`inv-item-${i}`}>
              <div className="w-10 h-10 rounded-lg bg-[#0a0a0a] flex-shrink-0 overflow-hidden flex items-center justify-center">
                {item.image ? (
                  <img src={`data:image/jpeg;base64,${item.image}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-4 h-4 text-gray-700" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{item.card_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.player && <span className="text-[9px] text-gray-500">{item.player}</span>}
                  {item.sport && <span className="text-[9px] text-gray-600">{item.sport}</span>}
                  {item.condition && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{item.condition}{item.grade ? ` ${item.grade}` : ''}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {item.purchase_price ? <p className="text-xs font-bold text-emerald-400">${item.purchase_price}</p> : <p className="text-[10px] text-gray-700">-</p>}
                <p className="text-[9px] text-gray-600">{item.category}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ==================== CONFIRM MODAL ====================
const ConfirmModal = ({ title, message, confirmLabel, danger, onConfirm, onCancel }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onCancel}
    data-testid="confirm-modal">
    <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
      className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
          <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-amber-400'}`} />
        </div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <p className="text-xs text-gray-400 mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10" data-testid="confirm-cancel">Cancel</button>
        <button onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-xs font-bold ${danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
          data-testid="confirm-action">{confirmLabel}</button>
      </div>
    </motion.div>
  </motion.div>
);

// ==================== TRANSACTIONS TAB ====================
const TransactionsTab = ({ transactions }) => (
  <div className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden" data-testid="transactions-table">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a1a1a]">
      <DollarSign className="w-4 h-4 text-emerald-400" />
      <h2 className="text-sm font-bold text-white">Payment Transactions</h2>
      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 font-bold">{transactions.length}</span>
    </div>
    <div className="divide-y divide-[#0f0f0f] max-h-[400px] overflow-y-auto">
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-xs">No transactions yet</div>
      ) : transactions.map((txn, i) => (
        <div key={txn.session_id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]" data-testid={`txn-${i}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${txn.payment_status === 'paid' ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
            <DollarSign className={`w-4 h-4 ${txn.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white">{txn.user_name} <span className="text-gray-500 font-normal">({txn.user_email})</span></p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `${PLAN_COLORS[txn.plan_id] || '#6b7280'}20`, color: PLAN_COLORS[txn.plan_id] || '#6b7280' }}>
                {PLAN_LABELS[txn.plan_id] || txn.plan_id}
              </span>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${txn.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {txn.payment_status}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-black text-white">${txn.amount}</p>
            <p className="text-[9px] text-gray-600">{txn.created_at ? new Date(txn.created_at).toLocaleDateString() : '-'}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ==================== PRESETS TAB ====================
const MIXER_FIELDS = [
  { key: 'brightness', label: 'Brightness', min: -50, max: 50, icon: Sun },
  { key: 'contrast', label: 'Contrast', min: -50, max: 50, icon: Layers },
  { key: 'shadows', label: 'Shadows', min: 0, max: 100, icon: Layers },
  { key: 'highlights', label: 'Highlights', min: -50, max: 50, icon: Sparkles },
  { key: 'saturation', label: 'Saturation', min: -50, max: 80, icon: Palette },
  { key: 'temperature', label: 'Temperature', min: -50, max: 50, icon: Sun },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 50, icon: Focus },
];

const PresetsTab = () => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', brightness: 0, contrast: 0, shadows: 0, highlights: 0, saturation: 0, temperature: 0, sharpness: 0, featured: false });

  const fetchPresets = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/admin/photo-presets`, { withCredentials: true });
      setPresets(res.data.presets || []);
    } catch { toast.error('Failed to load presets'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const openNew = () => {
    setEditing('new');
    setForm({ name: '', brightness: 0, contrast: 0, shadows: 0, highlights: 0, saturation: 0, temperature: 0, sharpness: 0, featured: false });
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ name: p.name, brightness: p.brightness || 0, contrast: p.contrast || 0, shadows: p.shadows || 0, highlights: p.highlights || 0, saturation: p.saturation || 0, temperature: p.temperature || 0, sharpness: p.sharpness || 0, featured: p.featured || false });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (editing === 'new') {
        await axios.post(`${API}/api/admin/photo-presets`, form, { withCredentials: true });
        toast.success('Preset created');
      } else {
        await axios.put(`${API}/api/admin/photo-presets/${editing}`, form, { withCredentials: true });
        toast.success('Preset updated');
      }
      setEditing(null);
      fetchPresets();
    } catch { toast.error('Failed to save preset'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this preset?')) return;
    try {
      await axios.delete(`${API}/api/admin/photo-presets/${id}`, { withCredentials: true });
      toast.success('Preset deleted');
      fetchPresets();
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="text-center py-8 text-gray-600 text-xs">Loading presets...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sliders className="w-4 h-4 text-amber-400" /> Global Photo Presets</h3>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors" data-testid="admin-add-preset">
          <Plus className="w-3.5 h-3.5" /> New Preset
        </button>
      </div>

      <div className="grid gap-3">
        {presets.map(p => (
          <div key={p.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 flex items-center gap-4" data-testid={`preset-row-${p.id}`}>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              {p.featured ? <Star className="w-5 h-5 text-amber-400" /> : <Sliders className="w-5 h-5 text-gray-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{p.name}</span>
                {p.featured && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold uppercase">Featured</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[9px] text-gray-500">
                {p.brightness !== 0 && <span>Bright: {p.brightness > 0 ? '+' : ''}{p.brightness}</span>}
                {p.contrast !== 0 && <span>Contrast: {p.contrast > 0 ? '+' : ''}{p.contrast}</span>}
                {p.shadows > 0 && <span>Shadows: +{p.shadows}</span>}
                {p.highlights !== 0 && <span>Highlights: {p.highlights > 0 ? '+' : ''}{p.highlights}</span>}
                {p.saturation !== 0 && <span>Sat: {p.saturation > 0 ? '+' : ''}{p.saturation}</span>}
                {p.temperature !== 0 && <span>Temp: {p.temperature > 0 ? '+' : ''}{p.temperature}</span>}
                {p.sharpness > 0 && <span>Sharp: +{p.sharpness}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-semibold transition-colors" data-testid={`edit-preset-${p.id}`}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors" data-testid={`delete-preset-${p.id}`}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
        {presets.length === 0 && (
          <div className="text-center py-8 bg-[#111] border border-[#1a1a1a] rounded-xl">
            <Sliders className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-600">No custom presets yet</p>
            <p className="text-[10px] text-gray-700 mt-1">Create presets that all users can use in the Photo Editor</p>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-5 space-y-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{editing === 'new' ? 'New Preset' : 'Edit Preset'}</h3>
                <button onClick={() => setEditing(null)} className="p-1 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Preset name (e.g. Card Pop, eBay Pro)"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500/50"
                data-testid="preset-name-input" />

              <div className="space-y-2">
                {MIXER_FIELDS.map(({ key, label, min, max, icon: SlIcon }) => (
                  <div key={key} className="flex items-center gap-2">
                    <SlIcon className="w-3 h-3 text-gray-600 shrink-0" />
                    <label className="text-[9px] text-gray-500 uppercase tracking-wider shrink-0 w-[72px]">{label}</label>
                    <input type="range" min={min} max={max} value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) }))}
                      className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-amber-500"
                      data-testid={`preset-slider-${key}`} />
                    <span className={`text-[10px] font-bold w-8 text-right ${form[key] === 0 ? 'text-gray-600' : 'text-amber-400'}`}>
                      {form[key] > 0 ? '+' : ''}{form[key]}
                    </span>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                  className="w-4 h-4 rounded bg-[#1a1a1a] border-[#2a2a2a] text-amber-500 focus:ring-amber-500" />
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-gray-400">Featured preset</span>
              </label>

              <button onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-colors active:scale-[0.98]"
                data-testid="preset-save-btn">
                <Save className="w-4 h-4" /> {editing === 'new' ? 'Create Preset' : 'Save Changes'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==================== MAIN ADMIN PAGE ====================
const AdminPage = ({ onBack }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [inventoryUser, setInventoryUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, t] = await Promise.all([
        axios.get(`${API}/api/admin/stats`),
        axios.get(`${API}/api/admin/users?limit=${pageSize}&skip=${page * pageSize}&search=${searchQuery}`),
        axios.get(`${API}/api/admin/transactions?limit=50`),
      ]);
      setStats(s.data);
      setUsers(u.data.users || []);
      setTotalUsers(u.data.total || 0);
      setTransactions(t.data.transactions || []);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Admin access required');
        onBack?.();
      } else {
        toast.error('Failed to load admin data');
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, onBack]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleChangePlan = async (userId, newPlan) => {
    try {
      await axios.put(`${API}/api/admin/users/${userId}/plan`, { plan_id: newPlan });
      toast.success(`Plan updated to ${PLAN_LABELS[newPlan]}`);
      fetchData();
    } catch { toast.error('Failed to change plan'); }
  };

  const handleBan = async (user) => {
    setConfirmAction({
      title: user.banned ? 'Unban User' : 'Ban User',
      message: `Are you sure you want to ${user.banned ? 'unban' : 'ban'} ${user.email}?`,
      confirmLabel: user.banned ? 'Unban' : 'Ban',
      danger: !user.banned,
      onConfirm: async () => {
        try {
          await axios.put(`${API}/api/admin/users/${user.user_id}/ban`);
          toast.success(user.banned ? 'User unbanned' : 'User banned');
          fetchData();
        } catch { toast.error('Failed'); }
        setConfirmAction(null);
      },
    });
  };

  const handleDelete = async (user) => {
    setConfirmAction({
      title: 'Delete User',
      message: `This will permanently delete ${user.email} and ALL their data (inventory, scans, listings). This cannot be undone.`,
      confirmLabel: 'Delete Forever',
      danger: true,
      onConfirm: async () => {
        try {
          await axios.delete(`${API}/api/admin/users/${user.user_id}`);
          toast.success('User deleted');
          fetchData();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
        setConfirmAction(null);
      },
    });
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    setPage(0);
    fetchData();
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin" />
          <p className="text-xs text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/5 transition-colors" data-testid="admin-back-btn">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-white">Admin Panel</h1>
                <p className="text-[10px] text-gray-500">FlipSlab Engine Management</p>
              </div>
            </div>
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#3b82f6]/50 text-gray-400 hover:text-white text-xs font-semibold transition-colors" data-testid="admin-refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && <StatsGrid stats={stats} />}

        {/* Plan Distribution + Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {stats && <PlanDistribution byPlan={stats.by_plan || {}} total={stats.total_users || 0} />}

          <div className="lg:col-span-3 space-y-4">
            {/* Tab Buttons */}
            <div className="flex gap-2">
              {[
                { id: 'users', label: 'Users', icon: Users },
                { id: 'transactions', label: 'Transactions', icon: DollarSign },
                { id: 'presets', label: 'Presets', icon: Sliders },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                    activeTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
                  }`} data-testid={`admin-tab-${id}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#3b82f6]/50"
                      data-testid="admin-search-input" />
                  </div>
                  <button type="submit" className="px-4 py-2.5 rounded-lg bg-[#3b82f6] text-white text-xs font-bold hover:bg-[#2563eb]" data-testid="admin-search-btn">
                    Search
                  </button>
                </form>

                {/* Users Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {users.map(u => (
                    <UserCard key={u.user_id} user={u}
                      onViewInventory={setInventoryUser}
                      onChangePlan={handleChangePlan}
                      onBan={handleBan}
                      onDelete={handleDelete} />
                  ))}
                  {users.length === 0 && (
                    <div className="col-span-2 text-center py-12 bg-[#111] border border-[#1a1a1a] rounded-xl text-gray-600 text-xs">No users found</div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#111] border border-[#1a1a1a] text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" data-testid="prev-page">
                      <ChevronLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    <span className="text-xs text-gray-500 font-semibold">Page {page + 1} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#111] border border-[#1a1a1a] text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" data-testid="next-page">
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && <TransactionsTab transactions={transactions} />}
            {activeTab === 'presets' && <PresetsTab />}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {inventoryUser && <InventoryModal user={inventoryUser} onClose={() => setInventoryUser(null)} />}
        {confirmAction && <ConfirmModal {...confirmAction} onCancel={() => setConfirmAction(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;
