import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link2, CheckCircle, XCircle, RefreshCw, Save, MapPin, User, Package, Smartphone, Copy, Eye, EyeOff, Crown, Store, ExternalLink, Download, QrCode } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import PricingPlans from './PricingPlans';
import StorePromotions from './StorePromotions';

const API = process.env.REACT_APP_BACKEND_URL;

const PLAN_NAMES = { rookie: 'Rookie', mvp: 'MVP', hall_of_famer: 'Hall of Famer', all_star: 'MVP', hall_of_fame: 'MVP', legend: 'Hall of Famer' };
const PLAN_COLORS = { rookie: 'text-gray-400', mvp: 'text-amber-400', hall_of_famer: 'text-purple-400', all_star: 'text-amber-400', hall_of_fame: 'text-amber-400', legend: 'text-purple-400' };

const AccountModule = () => {
  const [ebayStatus, setEbayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ display_name: '', postal_code: '', location: '', default_shipping: 'USPSFirstClass', default_sport: 'Basketball' });
  const [saving, setSaving] = useState(false);
  const [scannerToken, setScannerToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('rookie');
  const [showPricing, setShowPricing] = useState(false);
  const [shopSlug, setShopSlug] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/subscription/my-plan`);
      setCurrentPlan(res.data.plan_id || 'rookie');
    } catch {}
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const [ebayRes, settingsRes] = await Promise.allSettled([
        axios.get(`${API}/api/ebay/oauth/status`),
        axios.get(`${API}/api/settings`),
      ]);
      if (ebayRes.status === 'fulfilled') setEbayStatus(ebayRes.value.data);
      if (settingsRes.status === 'fulfilled') {
        setSettings(s => ({ ...s, ...settingsRes.value.data }));
        if (settingsRes.value.data.shop_slug) setShopSlug(settingsRes.value.data.shop_slug);
        if (settingsRes.value.data.shop_name) setShopName(settingsRes.value.data.shop_name);
        if (settingsRes.value.data.shop_logo) setShopLogo(settingsRes.value.data.shop_logo);
      }
    } catch { setEbayStatus({ connected: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    checkStatus();
    fetchPlan();
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
      window.location.href = res.data.authorization_url;
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

  const saveShopSlug = async () => {
    if (!shopSlug.trim()) { toast.error('Enter a shop URL'); return; }
    setSavingSlug(true);
    try {
      await axios.put(`${API}/api/settings/shop-slug`, { slug: shopSlug.trim().toLowerCase() });
      if (shopName.trim()) {
        await axios.put(`${API}/api/settings/shop-profile`, { shop_name: shopName.trim(), ...(shopLogo ? { shop_logo: shopLogo } : {}) });
      }
      toast.success('Shop saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSavingSlug(false); }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { if (w > h) { h = Math.round((h / w) * MAX); w = MAX; } else { w = Math.round((w / h) * MAX); h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const logo64 = canvas.toDataURL('image/webp', 0.85);
        setShopLogo(logo64);
        axios.put(`${API}/api/settings/shop-profile`, { shop_logo: logo64 }).then(() => toast.success('Logo uploaded!')).catch(() => toast.error('Failed to upload logo'));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const shopUrl = shopSlug ? `${window.location.origin}/shop/${shopSlug}` : '';

  const inputCls = "w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-wider text-gray-500 mb-1 font-medium";

  return (
    <div className="space-y-5 pb-8" data-testid="account-page">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Account</h1>
        <p className="text-xs text-gray-500 mt-0.5">Profile, subscription, and integrations</p>
      </div>

      {/* Subscription Plan */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Subscription</h2>
          </div>
          <button onClick={() => setShowPricing(!showPricing)}
            className="text-[11px] sm:text-xs text-[#3b82f6] hover:text-[#60a5fa] font-semibold transition-colors"
            data-testid="toggle-pricing-btn">
            {showPricing ? 'Hide Plans' : 'View Plans'}
          </button>
        </div>
        <div className="p-4 sm:p-5">
          {!showPricing ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Current Plan</p>
                <p className={`text-lg sm:text-xl font-black ${PLAN_COLORS[currentPlan] || 'text-white'}`} data-testid="current-plan-name">
                  {PLAN_NAMES[currentPlan] || 'Rookie'}
                </p>
              </div>
              <button onClick={() => setShowPricing(true)}
                className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[11px] sm:text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-colors"
                data-testid="upgrade-btn">
                {currentPlan === 'legend' ? 'Manage' : 'Upgrade'}
              </button>
            </div>
          ) : (
            <PricingPlans currentPlanId={currentPlan} onPlanChange={() => { fetchPlan(); setShowPricing(false); }} />
          )}
        </div>
      </motion.div>

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

      {/* My Shop */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">My Card Shop</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Create a public storefront to share your listed cards. Anyone with the link can browse your cards and buy on eBay.</p>

          {/* Logo Upload */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-xl bg-[#0a0a0a] border border-[#222] flex items-center justify-center overflow-hidden flex-shrink-0">
              {shopLogo ? (
                <img src={shopLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-6 h-6 text-gray-700" />
              )}
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Shop Logo</label>
              <label className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-bold cursor-pointer hover:bg-white/10 transition-colors inline-block"
                data-testid="upload-shop-logo-btn">
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>

          {/* Shop Name */}
          <div>
            <label className={labelCls}>Shop Name</label>
            <input className={inputCls} value={shopName} onChange={e => setShopName(e.target.value)}
              placeholder="My Card Collection" maxLength={60}
              data-testid="input-shop-name" />
          </div>

          {/* Shop URL */}
          <div>
            <label className={labelCls}>Shop URL</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden focus-within:border-amber-500/50 transition-colors">
                <span className="text-[10px] text-gray-600 pl-3 whitespace-nowrap">{window.location.host}/shop/</span>
                <input className="flex-1 bg-transparent border-none px-1 py-2.5 text-sm text-amber-400 font-bold placeholder-gray-700 focus:outline-none"
                  value={shopSlug} onChange={e => setShopSlug(e.target.value.replace(/[^a-z0-9_-]/gi, '').toLowerCase())}
                  placeholder="your-shop-name" maxLength={30}
                  data-testid="input-shop-slug" />
              </div>
              <button onClick={saveShopSlug} disabled={savingSlug || !shopSlug.trim()}
                className="px-4 py-2.5 rounded-lg bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                data-testid="save-shop-slug-btn">
                {savingSlug ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          </div>
          {shopSlug && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => { navigator.clipboard.writeText(shopUrl); toast.success('Shop URL copied!'); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors"
                  data-testid="copy-shop-url-btn">
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </button>
                <a href={`/shop/${shopSlug}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
                  data-testid="view-shop-btn">
                  <ExternalLink className="w-3.5 h-3.5" /> View My Shop
                </a>
              </div>
              {/* Store QR Code */}
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4" data-testid="shop-qr-section">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode className="w-4 h-4 text-[#3b82f6]" />
                  <p className="text-xs font-bold text-white">Store QR Code</p>
                  <span className="text-[10px] text-gray-600">For labels & packaging</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="bg-white p-3 rounded-lg" data-testid="shop-qr-code">
                    <QRCodeCanvas value={shopUrl} size={200} level="H" includeMargin={false} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] text-gray-500 max-w-[180px]">Scan to visit your store. Download and add to your labels.</p>
                    <button onClick={() => {
                      const canvas = document.querySelector('[data-testid="shop-qr-code"] canvas');
                      if (!canvas) return;
                      // Create high-res QR for download (600px)
                      const hiRes = document.createElement('canvas');
                      hiRes.width = 600;
                      hiRes.height = 600;
                      const ctx = hiRes.getContext('2d');
                      ctx.imageSmoothingEnabled = false;
                      ctx.drawImage(canvas, 0, 0, 600, 600);
                      const link = document.createElement('a');
                      link.download = `flipslab-store-${shopSlug}-qr.png`;
                      link.href = hiRes.toDataURL('image/png');
                      link.click();
                      toast.success('QR Code downloaded!');
                    }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold hover:bg-[#3b82f6]/20 transition-colors"
                      data-testid="download-qr-btn">
                      <Download className="w-3.5 h-3.5" /> Download PNG (High Res)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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

      {/* Store Promotions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6" data-testid="store-promotions-section">
        <h2 className="text-base font-black text-white mb-4">Store Promotions</h2>
        <StorePromotions />
      </motion.div>
    </div>
  );
};

export default AccountModule;
