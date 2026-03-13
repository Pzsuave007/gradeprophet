import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellRing, Plus, Trash2, RefreshCw, ArrowDown, ArrowUp,
  DollarSign, Check, X, AlertCircle, Search
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (v) => { const n = parseFloat(v); return isNaN(n) ? '-' : n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(2)}`; };

const PriceAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ search_query: '', player: '', condition_type: 'below', target_price: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API}/api/alerts`);
      setAlerts(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const createAlert = async (e) => {
    e.preventDefault();
    if (!form.search_query.trim() || !form.target_price) { toast.error('Card name and target price required'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/alerts`, {
        ...form,
        target_price: parseFloat(form.target_price),
      });
      toast.success('Alert created!');
      setForm({ search_query: '', player: '', condition_type: 'below', target_price: '', notes: '' });
      setShowForm(false);
      fetchAlerts();
    } catch (err) { toast.error('Failed to create alert'); }
    finally { setSaving(false); }
  };

  const deleteAlert = async (id) => {
    try {
      await axios.delete(`${API}/api/alerts/${id}`);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert removed');
    } catch { toast.error('Failed'); }
  };

  const checkAlerts = async () => {
    setChecking(true);
    try {
      const res = await axios.post(`${API}/api/alerts/check`);
      const triggered = res.data.results.filter(r => r.triggered);
      if (triggered.length > 0) {
        toast.success(`${triggered.length} alert${triggered.length > 1 ? 's' : ''} triggered!`);
      } else {
        toast.info('No alerts triggered');
      }
      fetchAlerts();
    } catch { toast.error('Failed to check alerts'); }
    finally { setChecking(false); }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";

  return (
    <div className="space-y-4" data-testid="price-alerts">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Price Alerts</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1a1a1a] text-gray-500">{alerts.length}</span>
        </div>
        <div className="flex gap-2">
          {alerts.length > 0 && (
            <button onClick={checkAlerts} disabled={checking}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              data-testid="check-alerts-btn">
              {checking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Check Now
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${showForm ? 'bg-red-500/10 text-red-400' : 'bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20'}`}
            data-testid="toggle-alert-form-btn">
            {showForm ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> New Alert</>}
          </button>
        </div>
      </div>

      {/* Create alert form */}
      <AnimatePresence>
        {showForm && (
          <motion.form onSubmit={createAlert} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase text-gray-500 mb-1 block">Card / Search Query *</label>
                  <input className={inputCls} placeholder="e.g. 1996 Topps Kobe Bryant PSA 10" value={form.search_query} onChange={e => setForm(f => ({ ...f, search_query: e.target.value }))} data-testid="alert-input-query" />
                </div>
                <div>
                  <label className="text-[9px] uppercase text-gray-500 mb-1 block">Player (optional)</label>
                  <input className={inputCls} placeholder="Kobe Bryant" value={form.player} onChange={e => setForm(f => ({ ...f, player: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] uppercase text-gray-500 mb-1 block">Alert When Price</label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setForm(f => ({ ...f, condition_type: 'below' }))}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${form.condition_type === 'below' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                      data-testid="alert-condition-below">
                      <ArrowDown className="w-3 h-3" /> Drops Below
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, condition_type: 'above' }))}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${form.condition_type === 'above' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-[#0a0a0a] border-[#222] text-gray-500'}`}
                      data-testid="alert-condition-above">
                      <ArrowUp className="w-3 h-3" /> Rises Above
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase text-gray-500 mb-1 block">Target Price ($) *</label>
                  <input className={inputCls} type="number" step="0.01" placeholder="200.00" value={form.target_price} onChange={e => setForm(f => ({ ...f, target_price: e.target.value }))} data-testid="alert-input-price" />
                </div>
                <div>
                  <label className="text-[9px] uppercase text-gray-500 mb-1 block">Notes</label>
                  <input className={inputCls} placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-xs font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors"
                  data-testid="create-alert-btn">
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />} Create Alert
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Alerts list */}
      {loading ? (
        <div className="flex justify-center py-6"><RefreshCw className="w-5 h-5 text-[#3b82f6] animate-spin" /></div>
      ) : alerts.length === 0 ? (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 text-center">
          <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No price alerts yet. Create one to get notified when a card hits your target price.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const isTriggered = alert.triggered;
            const CondIcon = alert.condition_type === 'below' ? ArrowDown : ArrowUp;
            return (
              <motion.div key={alert.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={`bg-[#111] border rounded-xl p-3 flex items-center gap-3 transition-colors ${isTriggered ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-[#1a1a1a]'}`}
                data-testid={`alert-item-${i}`}>
                {/* Status icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isTriggered ? 'bg-amber-500/20' : 'bg-[#1a1a1a]'}`}>
                  {isTriggered ? <BellRing className="w-4 h-4 text-amber-400" /> : <Bell className="w-4 h-4 text-gray-600" />}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{alert.search_query}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${alert.condition_type === 'below' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <CondIcon className="w-2.5 h-2.5" /> {alert.condition_type === 'below' ? 'Below' : 'Above'} {fmt(alert.target_price)}
                    </span>
                    {alert.last_price != null && (
                      <span className="text-[10px] text-gray-500">Current: {fmt(alert.last_price)}</span>
                    )}
                    {alert.last_checked && (
                      <span className="text-[9px] text-gray-600">Checked: {new Date(alert.last_checked).toLocaleDateString()}</span>
                    )}
                  </div>
                  {alert.notes && <p className="text-[9px] text-gray-600 mt-0.5">{alert.notes}</p>}
                </div>
                {/* Triggered badge */}
                {isTriggered && (
                  <span className="text-[9px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold uppercase flex-shrink-0" data-testid={`alert-triggered-${i}`}>
                    Triggered
                  </span>
                )}
                {/* Delete */}
                <button onClick={() => deleteAlert(alert.id)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400 flex-shrink-0 transition-colors"
                  data-testid={`delete-alert-${i}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PriceAlerts;
