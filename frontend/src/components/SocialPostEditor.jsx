import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  Download, ChevronLeft, Sparkles, RotateCcw,
  Eye, EyeOff, Crown, Star, Shield, Award, Type, Tag, Store, Image as ImageIcon,
  Square, Save, Trash2, FolderOpen, X, AlignLeft, AlignCenter, AlignRight,
  Plus, Flame, Heart, Trophy, Zap, Diamond, Target, CircleDot, Hexagon, Pencil
} from 'lucide-react';

/* ─── Constants ─── */
const GLOW_PRESETS = [
  { id: 'purple', label: 'Legend', r: 168, g: 85, b: 247, main: '#a855f7' },
  { id: 'gold', label: 'Gold', r: 245, g: 158, b: 11, main: '#f59e0b' },
  { id: 'blue', label: 'Ice', r: 59, g: 130, b: 246, main: '#3b82f6' },
  { id: 'red', label: 'Fire', r: 239, g: 68, b: 68, main: '#ef4444' },
  { id: 'green', label: 'Emerald', r: 16, g: 185, b: 129, main: '#10b981' },
  { id: 'white', label: 'Clean', r: 220, g: 220, b: 220, main: '#dcdcdc' },
  { id: 'pink', label: 'Flamingo', r: 236, g: 72, b: 153, main: '#ec4899' },
  { id: 'cyan', label: 'Aqua', r: 6, g: 182, b: 212, main: '#06b6d4' },
];

const BG_COLORS = [
  { id: 'black', color: '#080808', label: 'Black' },
  { id: 'charcoal', color: '#1a1a1a', label: 'Charcoal' },
  { id: 'navy', color: '#0d1b2a', label: 'Navy' },
  { id: 'midnight', color: '#1a1a2e', label: 'Midnight' },
  { id: 'forest', color: '#0a1f0a', label: 'Forest' },
  { id: 'wine', color: '#2d1b1b', label: 'Wine' },
  { id: 'slate', color: '#1e293b', label: 'Slate' },
  { id: 'white', color: '#ffffff', label: 'White' },
];

const ICON_OPTIONS = [
  { id: 'star', Icon: Star, emoji: '\u2B50' },
  { id: 'heart', Icon: Heart, emoji: '\u2764\uFE0F' },
  { id: 'trophy', Icon: Trophy, emoji: '\uD83C\uDFC6' },
  { id: 'flame', Icon: Flame, emoji: '\uD83D\uDD25' },
  { id: 'zap', Icon: Zap, emoji: '\u26A1' },
  { id: 'crown', Icon: Crown, emoji: '\uD83D\uDC51' },
  { id: 'diamond', Icon: Diamond, emoji: '\uD83D\uDC8E' },
  { id: 'shield', Icon: Shield, emoji: '\uD83D\uDEE1\uFE0F' },
  { id: 'target', Icon: Target, emoji: '\uD83C\uDFAF' },
  { id: 'award', Icon: Award, emoji: '\uD83C\uDFC5' },
];

const TIER_CONFIG = {
  rookie: { label: 'ROOKIE', Icon: Shield },
  all_star: { label: 'ALL-STAR', Icon: Star },
  hall_of_fame: { label: 'HALL OF FAME', Icon: Award },
  legend: { label: 'LEGEND', Icon: Crown },
};

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const ASPECT = CANVAS_W / CANVAS_H;
const ADMIN_EMAIL = 'pzsuave007@gmail.com';

const defaultLayout = () => ({
  card:        { x: 6, y: 2, w: 88, h: 66, visible: true, label: 'Card', Icon: ImageIcon },
  frame:       { x: 3, y: 0, w: 94, h: 70, visible: true, label: 'Frame', Icon: Square },
  shield:      { x: 78, y: 68, w: 10, h: 7, visible: false, label: 'Shield', Icon: Shield },
  title:       { x: 5, y: 71, w: 62, h: 10, visible: true, label: 'Title', Icon: Type, align: 'left' },
  price:       { x: 70, y: 72, w: 26, h: 5, visible: true, label: 'Price', Icon: Tag },
  logo:        { x: 3, y: 86, w: 8, h: 6, visible: true, label: 'Logo', Icon: Store },
  shopName:    { x: 13, y: 87, w: 35, h: 4, visible: true, label: 'Shop', Icon: Store, align: 'center' },
  tierBadge:   { x: 55, y: 87, w: 28, h: 4, visible: true, label: 'Tier', Icon: Crown },
  available:   { x: 30, y: 94, w: 40, h: 3, visible: true, label: 'Tag', Icon: Sparkles, align: 'center' },
  customText1: { x: 5, y: 82, w: 40, h: 4, visible: false, label: 'Text 1', Icon: Type, align: 'center', text: 'Custom Text' },
  customText2: { x: 5, y: 78, w: 40, h: 4, visible: false, label: 'Text 2', Icon: Type, align: 'center', text: 'Custom Text' },
  customText3: { x: 5, y: 74, w: 40, h: 4, visible: false, label: 'Text 3', Icon: Type, align: 'center', text: 'Custom Text' },
  icon1:       { x: 2, y: 2, w: 6, h: 5, visible: false, label: 'Icon 1', Icon: Star, iconName: 'star' },
  icon2:       { x: 90, y: 2, w: 6, h: 5, visible: false, label: 'Icon 2', Icon: Flame, iconName: 'flame' },
});

const FIXED_ELS = ['card', 'frame', 'shield', 'title', 'price', 'logo', 'shopName', 'tierBadge', 'available'];
const CUSTOM_ELS = ['customText1', 'customText2', 'customText3', 'icon1', 'icon2'];
const ALL_ELS = [...FIXED_ELS, ...CUSTOM_ELS];
const TEXT_ELS = ['title', 'shopName', 'available', 'customText1', 'customText2', 'customText3'];

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/* ─── Draggable Element ─── */
const DraggableEl = ({ id, el, containerW, containerH, selected, onSelect, onUpdate, children }) => {
  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect(id);
    const startX = e.clientX, startY = e.clientY;
    const origX = el.x, origY = el.y;
    const handleMove = (ev) => {
      const dx = ((ev.clientX - startX) / containerW) * 100;
      const dy = ((ev.clientY - startY) / containerH) * 100;
      onUpdate(id, { x: Math.max(0, Math.min(100 - el.w, origX + dx)), y: Math.max(0, Math.min(100 - el.h, origY + dy)) });
    };
    const handleUp = () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };
  const handleResize = (e) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origW = el.w, origH = el.h;
    const handleMove = (ev) => {
      const dw = ((ev.clientX - startX) / containerW) * 100;
      const dh = ((ev.clientY - startY) / containerH) * 100;
      onUpdate(id, { w: Math.max(5, Math.min(100 - el.x, origW + dw)), h: Math.max(3, Math.min(100 - el.y, origH + dh)) });
    };
    const handleUp = () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  if (!el.visible) return null;
  const left = (el.x / 100) * containerW, top = (el.y / 100) * containerH;
  const width = (el.w / 100) * containerW, height = (el.h / 100) * containerH;
  const zMap = { frame: 0, card: 1, shield: 2 };

  return (
    <div data-testid={`editor-el-${id}`} onPointerDown={handlePointerDown}
      style={{ position: 'absolute', left, top, width, height, cursor: 'move',
        zIndex: zMap[id] !== undefined ? zMap[id] : 10,
        outline: selected ? '2px solid rgba(168,85,247,0.7)' : 'none', outlineOffset: 2, touchAction: 'none' }}>
      {children}
      {selected && (
        <div onPointerDown={handleResize} data-testid={`editor-resize-${id}`}
          style={{ position: 'absolute', right: -5, bottom: -5, width: 12, height: 12,
            background: '#a855f7', borderRadius: 2, cursor: 'nwse-resize', zIndex: 20, touchAction: 'none' }} />
      )}
    </div>
  );
};

/* ─── Main Editor ─── */
const SocialPostEditor = ({ item, shopName: propShopName, shopLogo: propShopLogo, shopPlan: propShopPlan, onClose }) => {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState(null);
  const [els, setEls] = useState(defaultLayout);
  const [glow, setGlow] = useState(70);
  const [radius, setRadius] = useState(16);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bgColor, setBgColor] = useState('#080808');

  // Self-fetch shop data
  const [fetchedShopName, setFetchedShopName] = useState('');
  const [fetchedShopLogo, setFetchedShopLogo] = useState('');
  const [fetchedShopPlan, setFetchedShopPlan] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL;
    if (!API) return;
    axios.get(`${API}/api/settings`, { withCredentials: true })
      .then(r => { setFetchedShopName(r.data.shop_name || r.data.display_name || ''); setFetchedShopLogo(r.data.shop_logo || ''); })
      .catch(() => {});
    axios.get(`${API}/api/subscription/my-plan`, { withCredentials: true })
      .then(r => setFetchedShopPlan(r.data.plan_id || ''))
      .catch(() => {});
    axios.get(`${API}/api/auth/me`, { withCredentials: true })
      .then(r => { if (r.data.email === ADMIN_EMAIL) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const shopName = propShopName || fetchedShopName;
  const shopLogo = propShopLogo || fetchedShopLogo;
  const shopPlan = propShopPlan || fetchedShopPlan || 'rookie';

  const [preset, setPreset] = useState(GLOW_PRESETS[0]);
  useEffect(() => {
    const map = { legend: 'purple', hall_of_fame: 'gold', all_star: 'blue' };
    const found = GLOW_PRESETS.find(p => p.id === (map[shopPlan] || 'purple'));
    if (found) setPreset(found);
  }, [shopPlan]);

  const price = item.listed_price || item.purchase_price;
  const imgSrc = item.image ? `data:image/webp;base64,${item.image}` : item.ebay_picture || null;
  const tier = TIER_CONFIG[shopPlan] || TIER_CONFIG.rookie;
  const TierIcon = tier.Icon;

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pad = 16;
      let w = rect.width - pad * 2, h = w / ASPECT;
      if (h > rect.height - pad * 2) { h = rect.height - pad * 2; w = h * ASPECT; }
      if (w > 0 && h > 0) setContainerSize({ w: Math.round(w), h: Math.round(h) });
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, []);

  const updateEl = (id, patch) => setEls(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const toggleVis = (id) => updateEl(id, { visible: !els[id].visible });
  const resetAll = () => { setEls(defaultLayout()); setGlow(70); setRadius(16); setBgColor('#080808'); setSel(null); };

  /* ─── Global Presets ─── */
  const [savedPresets, setSavedPresets] = useState([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL;
    if (!API) return;
    axios.get(`${API}/api/settings/editor-presets`, { withCredentials: true })
      .then(r => setSavedPresets(r.data.presets || []))
      .catch(() => {});
  }, []);

  const savePreset = async () => {
    if (!presetName.trim() || !isAdmin) return;
    setSavingPreset(true);
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const elData = {};
      ALL_ELS.forEach(k => { const { Icon, ...rest } = els[k]; elData[k] = rest; });
      const res = await axios.post(`${API}/api/settings/editor-presets`, {
        name: presetName.trim(),
        data: { els: elData, presetId: preset.id, glow, radius, bgColor },
      }, { withCredentials: true });
      setSavedPresets(prev => [...prev, res.data.preset]);
      setPresetName('');
    } catch (e) { console.error('Save preset failed:', e); }
    setSavingPreset(false);
  };

  const deletePreset = async (id) => {
    if (!isAdmin) return;
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      await axios.delete(`${API}/api/settings/editor-presets/${id}`, { withCredentials: true });
      setSavedPresets(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error('Delete failed:', e); }
  };

  const applyPreset = (p) => {
    const d = p.data;
    if (d.els) {
      const restored = {};
      ALL_ELS.forEach(k => { const def = defaultLayout()[k]; restored[k] = { ...def, ...(d.els[k] || {}) }; });
      setEls(restored);
    }
    if (d.presetId) { const f = GLOW_PRESETS.find(g => g.id === d.presetId); if (f) setPreset(f); }
    if (d.glow !== undefined) setGlow(d.glow);
    if (d.radius !== undefined) setRadius(d.radius);
    if (d.bgColor) setBgColor(d.bgColor);
    setShowPresetMenu(false);
  };

  /* ─── Canvas Export ─── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const W = CANVAS_W, H = CANVAS_H;
      const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
      const ctx = cvs.getContext('2d');
      const c = preset;
      const inten = glow / 100;

      // BG
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);

      // Glow behind card
      if (els.card.visible) {
        const cx = (els.card.x + els.card.w / 2) / 100 * W;
        const cy = (els.card.y + els.card.h / 2) / 100 * H;
        const sz = Math.max(els.card.w / 100 * W, els.card.h / 100 * H);
        [[0, 0.35], [0.3, 0.12], [0.7, 0.03]].forEach(([stop, alpha]) => {
          const g = ctx.createRadialGradient(cx, cy, sz * 0.05, cx, cy, sz * (0.5 + stop));
          g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${alpha * inten})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        });
      }

      const rr = (x, y, w, h, r) => {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0); ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2); ctx.lineTo(x + r, y + h);
        ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI); ctx.lineTo(x, y + r);
        ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2); ctx.closePath();
      };

      // Card image
      if (els.card.visible && imgSrc) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc; });
        const dx = els.card.x / 100 * W, dy = els.card.y / 100 * H;
        const dw = els.card.w / 100 * W, dh = els.card.h / 100 * H;
        const rd = radius * (W / (containerSize?.w || 400));
        ctx.save(); ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.5 * inten})`; ctx.shadowBlur = 60 * inten;
        rr(dx, dy, dw, dh, rd); ctx.fillStyle = bgColor; ctx.fill(); ctx.restore();
        ctx.save(); rr(dx, dy, dw, dh, rd); ctx.clip(); ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.25 * inten})`; ctx.lineWidth = 2; rr(dx, dy, dw, dh, rd); ctx.stroke();
      }

      // Frame
      if (els.frame.visible) {
        const dx = els.frame.x / 100 * W, dy = els.frame.y / 100 * H;
        const dw = els.frame.w / 100 * W, dh = els.frame.h / 100 * H;
        const rd = radius * (W / (containerSize?.w || 400));
        ctx.save(); ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.15 * inten})`; ctx.shadowBlur = 15 * inten;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.5 * inten})`; ctx.lineWidth = 3;
        rr(dx, dy, dw, dh, rd); ctx.stroke(); ctx.restore();
      }

      // Shield
      if (els.shield.visible) {
        const dx = els.shield.x / 100 * W, dy = els.shield.y / 100 * H;
        const dw = els.shield.w / 100 * W, dh = els.shield.h / 100 * H;
        ctx.save();
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.15)`;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.4)`;
        ctx.lineWidth = 2;
        const mx = dx + dw / 2, topY = dy, botY = dy + dh;
        ctx.beginPath(); ctx.moveTo(mx, topY);
        ctx.quadraticCurveTo(dx + dw, topY, dx + dw, topY + dh * 0.4);
        ctx.quadraticCurveTo(dx + dw, botY - dh * 0.1, mx, botY);
        ctx.quadraticCurveTo(dx, botY - dh * 0.1, dx, topY + dh * 0.4);
        ctx.quadraticCurveTo(dx, topY, mx, topY);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // Helper for text alignment
      const drawAlignedText = (text, dx, dy, dw, dh, align, fs, color) => {
        ctx.fillStyle = color;
        ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = align || 'center';
        const ax = align === 'left' ? dx : align === 'right' ? dx + dw : dx + dw / 2;
        const lines = wrapText(ctx, text, dw);
        lines.forEach((l, i) => ctx.fillText(l, ax, dy + fs + i * fs * 1.3));
      };

      // Title
      if (els.title.visible) {
        const dx = els.title.x / 100 * W, dy = els.title.y / 100 * H;
        const dw = els.title.w / 100 * W, dh = els.title.h / 100 * H;
        const fs = Math.max(24, Math.min(42, dh * 0.35));
        const textColor = bgColor === '#ffffff' ? '#111' : '#fff';
        drawAlignedText(item.card_name || '', dx, dy, dw, dh, els.title.align, fs, textColor);
      }

      // Price
      if (els.price.visible && price) {
        const dx = els.price.x / 100 * W, dy = els.price.y / 100 * H;
        const dw = els.price.w / 100 * W, dh = els.price.h / 100 * H;
        const fs = Math.max(24, Math.min(42, dh * 0.55));
        ctx.save(); ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`; ctx.shadowBlur = 20;
        ctx.fillStyle = c.main; rr(dx, dy, dw, dh, dh / 2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#000'; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText(`$${parseFloat(price).toFixed(2)}`, dx + dw / 2, dy + dh * 0.65);
      }

      // Logo
      if (els.logo.visible && shopLogo) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise(r => { img.onload = r; img.onerror = r; img.src = shopLogo; });
        if (img.complete && img.naturalWidth) {
          const dx = els.logo.x / 100 * W, dy = els.logo.y / 100 * H;
          const dw = els.logo.w / 100 * W, dh = els.logo.h / 100 * H;
          ctx.save(); rr(dx, dy, dw, dh, 12); ctx.clip(); ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
        }
      }

      // Shop name
      if (els.shopName.visible) {
        const dx = els.shopName.x / 100 * W, dy = els.shopName.y / 100 * H;
        const dw = els.shopName.w / 100 * W, dh = els.shopName.h / 100 * H;
        const fs = Math.max(16, Math.min(28, dh * 0.6));
        drawAlignedText(shopName || 'Card Shop', dx, dy, dw, dh, els.shopName.align, fs, '#777');
      }

      // Tier badge
      if (els.tierBadge.visible) {
        const dx = els.tierBadge.x / 100 * W, dy = els.tierBadge.y / 100 * H;
        const dw = els.tierBadge.w / 100 * W, dh = els.tierBadge.h / 100 * H;
        const fs = Math.max(14, Math.min(22, dh * 0.5));
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.15)`; rr(dx, dy, dw, dh, dh / 2); ctx.fill();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.3)`; ctx.lineWidth = 1; rr(dx, dy, dw, dh, dh / 2); ctx.stroke();
        ctx.fillStyle = c.main; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText(tier.label, dx + dw / 2, dy + dh * 0.65);
      }

      // Available
      if (els.available.visible) {
        const dx = els.available.x / 100 * W, dy = els.available.y / 100 * H;
        const dw = els.available.w / 100 * W, dh = els.available.h / 100 * H;
        const fs = Math.max(12, Math.min(18, dh * 0.6));
        drawAlignedText('AVAILABLE NOW', dx, dy, dw, dh, els.available.align, fs, c.main);
      }

      // Custom texts
      ['customText1', 'customText2', 'customText3'].forEach(k => {
        if (!els[k].visible) return;
        const dx = els[k].x / 100 * W, dy = els[k].y / 100 * H;
        const dw = els[k].w / 100 * W, dh = els[k].h / 100 * H;
        const fs = Math.max(14, Math.min(32, dh * 0.5));
        const textColor = bgColor === '#ffffff' ? '#111' : '#fff';
        drawAlignedText(els[k].text || 'Custom Text', dx, dy, dw, dh, els[k].align, fs, textColor);
      });

      // Icons
      ['icon1', 'icon2'].forEach(k => {
        if (!els[k].visible) return;
        const dx = els[k].x / 100 * W, dy = els[k].y / 100 * H;
        const dw = els[k].w / 100 * W, dh = els[k].h / 100 * H;
        const iconOpt = ICON_OPTIONS.find(i => i.id === els[k].iconName);
        if (iconOpt) {
          const fs = Math.min(dw, dh) * 0.8;
          ctx.font = `${fs}px -apple-system,sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(iconOpt.emoji, dx + dw / 2, dy + dh / 2);
        }
      });

      const a = document.createElement('a');
      a.download = `${(item.card_name || 'card').replace(/[^a-z0-9]/gi, '-').substring(0, 40)}-social.png`;
      a.href = cvs.toDataURL('image/png'); a.click();
    } catch (e) { console.error('Export failed:', e); }
    setSaving(false);
  }, [els, preset, glow, radius, bgColor, imgSrc, item, price, shopName, shopLogo, tier, containerSize]);

  /* ─── Preview renderers ─── */
  const renderInner = (key, cW, cH) => {
    const e = els[key];
    const elH = (e.h / 100) * cH;
    const glowI = glow / 100;
    const textColor = bgColor === '#ffffff' ? '#111' : '#fff';
    const subColor = bgColor === '#ffffff' ? '#555' : '#777';

    switch (key) {
      case 'card':
        return imgSrc ? (
          <div style={{ width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden',
            boxShadow: `0 0 ${30 * glowI}px rgba(${preset.r},${preset.g},${preset.b},${0.4 * glowI})`,
            border: `1px solid rgba(${preset.r},${preset.g},${preset.b},${0.2 * glowI})` }}>
            <img src={imgSrc} alt="card" draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: radius }} />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: radius, background: '#1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            <ImageIcon style={{ width: 40, height: 40 }} />
          </div>
        );

      case 'frame':
        return (
          <div style={{ width: '100%', height: '100%', borderRadius: radius,
            border: `2px solid rgba(${preset.r},${preset.g},${preset.b},${0.5 * glowI})`,
            boxShadow: `0 0 ${15 * glowI}px rgba(${preset.r},${preset.g},${preset.b},${0.15 * glowI})`,
            pointerEvents: 'none' }} />
        );

      case 'shield':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield style={{ width: '80%', height: '80%', color: preset.main,
              filter: `drop-shadow(0 0 ${8 * glowI}px rgba(${preset.r},${preset.g},${preset.b},0.4))` }} />
          </div>
        );

      case 'title':
        return (
          <div style={{ color: textColor, fontWeight: 800, fontSize: Math.max(10, elH * 0.3),
            lineHeight: 1.2, overflow: 'hidden', wordBreak: 'break-word', userSelect: 'none',
            textAlign: e.align || 'left' }}>
            {item.card_name || 'Card Title'}
          </div>
        );

      case 'price':
        return price ? (
          <div style={{ width: '100%', height: '100%', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: preset.main,
            fontWeight: 800, color: '#000', fontSize: Math.max(10, elH * 0.5),
            boxShadow: `0 0 15px rgba(${preset.r},${preset.g},${preset.b},0.5)`, userSelect: 'none' }}>
            ${parseFloat(price).toFixed(2)}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666',
            fontSize: Math.max(10, elH * 0.5), fontWeight: 800, userSelect: 'none' }}>$0.00</div>
        );

      case 'logo':
        return shopLogo ? (
          <img src={shopLogo} alt="logo" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: 12, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: `rgba(${preset.r},${preset.g},${preset.b},0.15)` }}>
            <Store style={{ width: '50%', height: '50%', color: preset.main }} />
          </div>
        );

      case 'shopName':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: e.align === 'left' ? 'flex-start' : e.align === 'right' ? 'flex-end' : 'center',
            fontWeight: 700, color: subColor, fontSize: Math.max(8, elH * 0.55), userSelect: 'none' }}>
            {shopName || 'Card Shop'}
          </div>
        );

      case 'tierBadge':
        return (
          <div style={{ width: '100%', height: '100%', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            background: `rgba(${preset.r},${preset.g},${preset.b},0.15)`,
            border: `1px solid rgba(${preset.r},${preset.g},${preset.b},0.3)`,
            color: preset.main, fontWeight: 800, fontSize: Math.max(7, elH * 0.4),
            letterSpacing: '0.05em', userSelect: 'none' }}>
            <TierIcon style={{ width: elH * 0.4, height: elH * 0.4 }} />{tier.label}
          </div>
        );

      case 'available':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: e.align === 'left' ? 'flex-start' : e.align === 'right' ? 'flex-end' : 'center',
            fontWeight: 800, letterSpacing: '0.1em', color: preset.main,
            fontSize: Math.max(7, elH * 0.5), userSelect: 'none' }}>AVAILABLE NOW</div>
        );

      case 'customText1': case 'customText2': case 'customText3':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: e.align === 'left' ? 'flex-start' : e.align === 'right' ? 'flex-end' : 'center',
            fontWeight: 700, color: textColor, fontSize: Math.max(8, elH * 0.45),
            userSelect: 'none', overflow: 'hidden', wordBreak: 'break-word' }}>
            {e.text || 'Custom Text'}
          </div>
        );

      case 'icon1': case 'icon2': {
        const iconOpt = ICON_OPTIONS.find(i => i.id === e.iconName);
        const IconComp = iconOpt?.Icon || Star;
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconComp style={{ width: '80%', height: '80%', color: preset.main,
              filter: `drop-shadow(0 0 ${6 * glowI}px rgba(${preset.r},${preset.g},${preset.b},0.4))` }} />
          </div>
        );
      }

      default: return null;
    }
  };

  /* ─── Selected element controls ─── */
  const selEl = sel ? els[sel] : null;
  const isTextEl = sel && TEXT_ELS.includes(sel);
  const isCustomText = sel && sel.startsWith('customText');
  const isIconEl = sel && sel.startsWith('icon');

  const cW = containerSize?.w || 0;
  const cH = containerSize?.h || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      onClick={() => setSel(null)} data-testid="social-post-editor">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} data-testid="editor-back-btn"
          className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-1.5 text-white font-bold text-sm">
          <Sparkles className="w-4 h-4 text-amber-400" /> Social Post
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPresetMenu(!showPresetMenu)} data-testid="editor-presets-btn"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white text-xs font-bold">
            <FolderOpen className="w-3 h-3" /> Presets
            {savedPresets.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: preset.main, color: '#000' }}>
                {savedPresets.length}
              </span>
            )}
          </button>
          <button onClick={resetAll} data-testid="editor-reset-btn"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white text-xs font-bold">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving} data-testid="editor-save-btn"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-sm active:scale-95">
            {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : <Download className="w-4 h-4" />} Save
          </button>
        </div>
      </div>

      {/* Preset Menu */}
      {showPresetMenu && (
        <div className="absolute top-12 right-4 z-[70] w-72 rounded-xl border border-white/[0.08] bg-[#111] shadow-2xl"
          onClick={e => e.stopPropagation()}>
          {isAdmin && (
            <div className="p-3 border-b border-white/[0.06]">
              <div className="text-xs font-bold text-gray-400 uppercase mb-2">Save as Global Preset</div>
              <div className="flex gap-2">
                <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()} placeholder="Preset name..." maxLength={30}
                  data-testid="preset-name-input"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-xs outline-none focus:border-purple-500/50 placeholder:text-gray-600" />
                <button onClick={savePreset} disabled={savingPreset || !presetName.trim() || savedPresets.length >= 5}
                  data-testid="preset-save-btn"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30"
                  style={{ background: preset.main, color: '#000' }}>
                  {savingPreset ? <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : <Save className="w-3 h-3" />} Save
                </button>
              </div>
            </div>
          )}
          <div className="p-2 max-h-52 overflow-y-auto">
            {savedPresets.length === 0 ? (
              <div className="text-center text-gray-600 text-xs py-4">No presets available</div>
            ) : savedPresets.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] group">
                <button onClick={() => applyPreset(p)}
                  className="flex-1 text-left text-sm text-gray-300 font-medium hover:text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: GLOW_PRESETS.find(g => g.id === p.data?.presetId)?.main || '#888' }} />
                  {p.name}
                </button>
                {isAdmin && (
                  <button onClick={() => deletePreset(p.id)} data-testid={`delete-preset-${p.id}`}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-white/[0.06]">
            <button onClick={() => setShowPresetMenu(false)}
              className="w-full py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-white hover:bg-white/[0.04] flex items-center justify-center gap-1">
              <X className="w-3 h-3" /> Close
            </button>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
        onClick={() => setSel(null)}>
        {containerSize ? (
          <div data-testid="editor-canvas" onClick={e => e.stopPropagation()}
            style={{ width: cW, height: cH, position: 'relative', overflow: 'hidden', background: bgColor,
              boxShadow: `0 0 ${60 * (glow / 100)}px rgba(${preset.r},${preset.g},${preset.b},${0.12 * (glow / 100)})` }}>
            {els.card.visible && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at ${els.card.x + els.card.w / 2}% ${els.card.y + els.card.h / 2}%, rgba(${preset.r},${preset.g},${preset.b},${0.2 * (glow / 100)}) 0%, transparent 65%)` }} />
            )}
            {ALL_ELS.map(k => (
              <DraggableEl key={k} id={k} el={els[k]} containerW={cW} containerH={cH}
                selected={sel === k} onSelect={setSel} onUpdate={updateEl}>
                {renderInner(k, cW, cH)}
              </DraggableEl>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Loading editor...</div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-2 space-y-2" onClick={e => e.stopPropagation()}>

        {/* Selected element controls */}
        {sel && selEl && (
          <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
            <span className="text-[10px] font-bold text-gray-500 uppercase w-14">{selEl.label}</span>

            {isTextEl && (
              <div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
                  <button key={a} onClick={() => updateEl(sel, { align: a })}
                    data-testid={`align-${a}`}
                    className={`p-1 rounded ${selEl.align === a ? 'bg-white/[0.12] text-white' : 'text-gray-600 hover:text-gray-300'}`}>
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            {isCustomText && (
              <div className="flex items-center gap-1 flex-1">
                <Pencil className="w-3 h-3 text-gray-500" />
                <input type="text" value={selEl.text || ''} onChange={e => updateEl(sel, { text: e.target.value })}
                  data-testid="custom-text-input" maxLength={60}
                  className="flex-1 px-2 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white text-xs outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                  placeholder="Enter text..." />
              </div>
            )}

            {isIconEl && (
              <div className="flex gap-1 overflow-x-auto">
                {ICON_OPTIONS.map(({ id, Icon }) => (
                  <button key={id} onClick={() => updateEl(sel, { iconName: id })}
                    data-testid={`icon-pick-${id}`}
                    className={`p-1 rounded ${selEl.iconName === id ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]'}`}>
                    <Icon className="w-3.5 h-3.5" style={{ color: selEl.iconName === id ? preset.main : '#666' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Glow Presets + BG Color */}
        <div className="flex gap-3">
          <div className="flex gap-1.5 overflow-x-auto flex-1" data-testid="editor-presets">
            {GLOW_PRESETS.map(p => (
              <button key={p.id} onClick={() => setPreset(p)} data-testid={`preset-${p.id}`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  preset.id === p.id ? 'text-white scale-105' : 'text-gray-500 bg-white/[0.04] border border-white/[0.06]'}`}
                style={preset.id === p.id ? { background: `rgba(${p.r},${p.g},${p.b},0.2)`,
                  border: `1px solid ${p.main}`, boxShadow: `0 0 12px rgba(${p.r},${p.g},${p.b},0.3)` } : {}}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.main }} />{p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 items-center shrink-0">
            <span className="text-[9px] text-gray-500 font-bold">BG</span>
            {BG_COLORS.map(b => (
              <button key={b.id} onClick={() => setBgColor(b.color)} data-testid={`bg-${b.id}`}
                title={b.label}
                className="w-4 h-4 rounded-full border transition-all"
                style={{ background: b.color,
                  borderColor: bgColor === b.color ? preset.main : 'rgba(255,255,255,0.1)',
                  boxShadow: bgColor === b.color ? `0 0 8px ${preset.main}` : 'none',
                  transform: bgColor === b.color ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold w-10">Glow</label>
            <input type="range" min={0} max={100} value={glow} onChange={e => setGlow(+e.target.value)}
              className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: preset.main }} />
            <span className="text-[9px] font-bold w-7 text-right" style={{ color: preset.main }}>{glow}%</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold w-12">Round</label>
            <input type="range" min={0} max={40} value={radius} onChange={e => setRadius(+e.target.value)}
              className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: preset.main }} />
            <span className="text-[9px] font-bold w-7 text-right" style={{ color: preset.main }}>{radius}px</span>
          </div>
        </div>

        {/* Toggle Visibility */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" data-testid="editor-toggles">
          {ALL_ELS.map(k => {
            const e = els[k];
            return (
              <button key={k} onClick={() => toggleVis(k)} data-testid={`toggle-${k}`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  e.visible ? 'bg-white/[0.08] text-white' : 'bg-white/[0.02] text-gray-600 line-through'}`}>
                {e.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}{e.label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default SocialPostEditor;
