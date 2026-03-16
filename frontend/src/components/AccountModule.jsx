import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link2, CheckCircle, XCircle, RefreshCw, Save, MapPin, User, Package, Smartphone, Copy, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AccountModule = () => {
  const [ebayStatus, setEbayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ display_name: '', postal_code: '', location: '', default_shipping: 'USPSFirstClass', default_sport: 'Basketball' });
  const [saving, setSaving] = useState(false);
  const [scannerToken, setScannerToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const [ebayRes, settingsRes] = await Promise.allSettled([
        axios.get(`${API}/api/ebay/oauth/status`),
        axios.get(`${API}/api/settings`),
      ]);
      if (ebayRes.status === 'fulfilled') setEbayStatus(ebayRes.value.data);
      if (settingsRes.status === 'fulfilled') setSettings(s => ({ ...s, ...settingsRes.value.data }));
    } catch { setEbayStatus({ connected: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    checkStatus();
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('ebay_auth');
    if (authResult === 'success') {
      toast.success('eBay account connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
      checkStatus();
    } else if (authResult && authResult !== 'success') {
      toast.error(`eBay connection failed: ${authResult}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    try {
      const res = await axios.get(`${API}/api/ebay/oauth/authorize`);
      window.location.href = res.data.auth_url;
    } catch { toast.error('Failed to generate eBay authorization URL'); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/settings`, settings);
      toast.success('Settings saved!');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <div className="space-y-5 pb-8" data-testid="account-page">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Account</h1>
        <p className="text-xs text-gray-500 mt-0.5">Profile, location, and integrations</p>
      </div>

      {/* Seller Profile */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center gap-2">
          <User className="w-4 h-4 text-[#3b82f6]" />
          <h2 className="text-sm font-bold text-white">Seller Profile</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Display Name</label>
            <input className={inputCls} value={settings.display_name || ''} placeholder="Your seller name"
              onChange={e => setSettings(s => ({ ...s, display_name: e.target.value }))} data-testid="input-display-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />ZIP Code</label>
              <input className={inputCls} value={settings.postal_code || ''} placeholder="99201"
                onChange={e => setSettings(s => ({ ...s, postal_code: e.target.value }))} data-testid="input-postal-code" />
            </div>
            <div>
              <label className={labelCls}><MapPin className="w-3 h-3 inline mr-1" />City, State</label>
              <input className={inputCls} value={settings.location || ''} placeholder="Spokane, WA"
                onChange={e => setSettings(s => ({ ...s, location: e.target.value }))} data-testid="input-location" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}><Package className="w-3 h-3 inline mr-1" />Default Shipping</label>
              <select className={inputCls} value={settings.default_shipping || 'USPSFirstClass'}
                onChange={e => setSettings(s => ({ ...s, default_shipping: e.target.value }))} data-testid="select-default-shipping">
                <option value="FreeShipping">Free Shipping</option>
                <option value="USPSFirstClass">USPS First Class ($4.50)</option>
                <option value="USPSPriority">USPS Priority ($8.50)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Default Sport</label>
              <select className={inputCls} value={settings.default_sport || 'Basketball'}
                onChange={e => setSettings(s => ({ ...s, default_sport: e.target.value }))} data-testid="select-default-sport">
                {['Basketball', 'Baseball', 'Football', 'Soccer', 'Hockey', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button onClick={saveSettings} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors"
            data-testid="save-settings-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Settings
          </button>
        </div>
      </motion.div>

      {/* eBay Integration */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#3b82f6]" />
          <h2 className="text-sm font-bold text-white">eBay Integration</h2>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">Checking...</span></div>
          ) : ebayStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">eBay Connected</p>
                  <p className="text-[11px] text-gray-500">{ebayStatus.updated_at ? `Updated: ${new Date(ebayStatus.updated_at).toLocaleString()}` : ''}</p>
                </div>
              </div>
              <button onClick={handleConnect} className="text-xs text-[#3b82f6] hover:text-[#60a5fa]" data-testid="ebay-reconnect-btn">Reconnect account</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-400">Not Connected</p>
              </div>
              <button onClick={handleConnect}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-semibold hover:bg-[#2563eb]"
                data-testid="ebay-connect-btn"><Link2 className="w-4 h-4" />Connect eBay Account</button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Scanner Token */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">FlipSlab Scanner Token</h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">
            Genera un token para conectar la app de escritorio FlipSlab Scanner.
            Pega este token en el campo "Scanner Token" de la app.
          </p>
          {scannerToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input readOnly value={showToken ? scannerToken : '************************************'}
                  className={`${inputCls} font-mono text-xs`} data-testid="scanner-token-display" />
                <button onClick={() => setShowToken(!showToken)}
                  className="p-2 rounded-lg bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
                  data-testid="toggle-token-visibility">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(scannerToken); toast.success('Token copiado!'); }}
                  className="p-2 rounded-lg bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
                  data-testid="copy-token-btn">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-amber-400/70">Este token expira en 90 dias. Guardalo en un lugar seguro.</p>
            </div>
          ) : (
            <button onClick={async () => {
              setGeneratingToken(true);
              try {
                const res = await axios.post(`${API}/api/auth/scanner-token`);
                setScannerToken(res.data.scanner_token);
                setShowToken(true);
                toast.success('Scanner token generado!');
              } catch { toast.error('Error generando token'); }
              finally { setGeneratingToken(false); }
            }}
              disabled={generatingToken}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
              data-testid="generate-scanner-token-btn">
              {generatingToken ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              Generar Scanner Token
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AccountModule;
