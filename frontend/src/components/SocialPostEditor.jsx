import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  Download, ChevronLeft, Sparkles, RotateCcw,
  Eye, EyeOff, Crown, Star, Shield, Award, Type, Tag, Store, Image as ImageIcon, Square,
  Save, Trash2, FolderOpen, X
} from 'lucide-react';

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

const TIER_CONFIG = {
  rookie: { label: 'ROOKIE', Icon: Shield },
  all_star: { label: 'ALL-STAR', Icon: Star },
  hall_of_fame: { label: 'HALL OF FAME', Icon: Award },
  legend: { label: 'LEGEND', Icon: Crown },
};

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const ASPECT = CANVAS_W / CANVAS_H;

const defaultLayout = () => ({
  card:      { x: 6, y: 2, w: 88, h: 66, visible: true, label: 'Card', Icon: ImageIcon },
  frame:     { x: 3, y: 0, w: 94, h: 70, visible: true, label: 'Frame', Icon: Square },
  title:     { x: 5, y: 71, w: 62, h: 10, visible: true, label: 'Title', Icon: Type },
  price:     { x: 70, y: 72, w: 26, h: 5, visible: true, label: 'Price', Icon: Tag },
  logo:      { x: 3, y: 86, w: 8, h: 6, visible: true, label: 'Logo', Icon: Store },
  shopName:  { x: 13, y: 87, w: 35, h: 4, visible: true, label: 'Shop', Icon: Store },
  tierBadge: { x: 55, y: 87, w: 28, h: 4, visible: true, label: 'Tier', Icon: Crown },
  available: { x: 30, y: 94, w: 40, h: 3, visible: true, label: 'Tag', Icon: Sparkles },
});

const EL_KEYS = ['card', 'frame', 'title', 'price', 'logo', 'shopName', 'tierBadge', 'available'];

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
  const ref = useRef(null);
  const dragRef = useRef(null);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect(id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;

    const handleMove = (ev) => {
      const dx = ((ev.clientX - startX) / containerW) * 100;
      const dy = ((ev.clientY - startY) / containerH) * 100;
      onUpdate(id, { x: Math.max(0, Math.min(100 - el.w, origX + dx)), y: Math.max(0, Math.min(100 - el.h, origY + dy)) });
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleResize = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = el.w;
    const origH = el.h;

    const handleMove = (ev) => {
      const dw = ((ev.clientX - startX) / containerW) * 100;
      const dh = ((ev.clientY - startY) / containerH) * 100;
      onUpdate(id, { w: Math.max(5, Math.min(100 - el.x, origW + dw)), h: Math.max(3, Math.min(100 - el.y, origH + dh)) });
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  if (!el.visible) return null;

  const left = (el.x / 100) * containerW;
  const top = (el.y / 100) * containerH;
  const width = (el.w / 100) * containerW;
  const height = (el.h / 100) * containerH;

  return (
    <div
      ref={ref}
      data-testid={`editor-el-${id}`}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute', left, top, width, height,
        cursor: 'move', zIndex: id === 'card' ? 1 : id === 'frame' ? 2 : 10,
        outline: selected ? '2px solid rgba(168,85,247,0.7)' : 'none',
        outlineOffset: 2,
        touchAction: 'none',
      }}
    >
      {children}
      {selected && (
        <div
          onPointerDown={handleResize}
          data-testid={`editor-resize-${id}`}
          style={{
            position: 'absolute', right: -5, bottom: -5, width: 12, height: 12,
            background: '#a855f7', borderRadius: 2, cursor: 'nwse-resize', zIndex: 20,
            touchAction: 'none',
          }}
        />
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
  const [imgLoaded, setImgLoaded] = useState(false);

  // Self-fetch shop data (fallback if props are empty)
  const [fetchedShopName, setFetchedShopName] = useState('');
  const [fetchedShopLogo, setFetchedShopLogo] = useState('');
  const [fetchedShopPlan, setFetchedShopPlan] = useState('');

  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL;
    if (!API) return;
    axios.get(`${API}/api/settings`, { withCredentials: true })
      .then(r => {
        setFetchedShopName(r.data.shop_name || r.data.display_name || '');
        setFetchedShopLogo(r.data.shop_logo || '');
      }).catch(() => {});
    axios.get(`${API}/api/subscription/my-plan`, { withCredentials: true })
      .then(r => setFetchedShopPlan(r.data.plan_id || ''))
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
  const imgSrc = item.image
    ? `data:image/webp;base64,${item.image}`
    : item.ebay_picture || null;
  const tier = TIER_CONFIG[shopPlan] || TIER_CONFIG.rookie;
  const TierIcon = tier.Icon;

  // Measure available space for the canvas preview
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pad = 16;
      let w = rect.width - pad * 2;
      let h = w / ASPECT;
      if (h > rect.height - pad * 2) {
        h = rect.height - pad * 2;
        w = h * ASPECT;
      }
      if (w > 0 && h > 0) setContainerSize({ w: Math.round(w), h: Math.round(h) });
    };
    // Use requestAnimationFrame to ensure layout is complete
    const raf = requestAnimationFrame(() => { measure(); });
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, []);

  const updateEl = (id, patch) => setEls(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const toggleVis = (id) => updateEl(id, { visible: !els[id].visible });
  const resetAll = () => { setEls(defaultLayout()); setGlow(70); setRadius(16); setSel(null); };

  /* ─── Custom Presets ─── */
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
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const elData = {};
      EL_KEYS.forEach(k => {
        const { Icon, ...rest } = els[k];
        elData[k] = rest;
      });
      const payload = {
        name: presetName.trim(),
        data: { els: elData, presetId: preset.id, glow, radius },
      };
      const res = await axios.post(`${API}/api/settings/editor-presets`, payload, { withCredentials: true });
      setSavedPresets(prev => [...prev, res.data.preset]);
      setPresetName('');
      setShowPresetMenu(false);
    } catch (e) {
      console.error('Save preset failed:', e);
    }
    setSavingPreset(false);
  };

  const deletePreset = async (id) => {
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
      EL_KEYS.forEach(k => {
        const def = defaultLayout()[k];
        restored[k] = { ...def, ...(d.els[k] || {}) };
      });
      setEls(restored);
    }
    if (d.presetId) {
      const found = GLOW_PRESETS.find(g => g.id === d.presetId);
      if (found) setPreset(found);
    }
    if (d.glow !== undefined) setGlow(d.glow);
    if (d.radius !== undefined) setRadius(d.radius);
    setShowPresetMenu(false);
  };

  /* ─── Canvas Export ─── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const W = CANVAS_W, H = CANVAS_H;
      const cvs = document.createElement('canvas');
      cvs.width = W; cvs.height = H;
      const ctx = cvs.getContext('2d');
      const c = preset;
      const inten = glow / 100;

      // BG
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, W, H);

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
        const cl = els.card.x / 100 * W, cr = cl + els.card.w / 100 * W;
        const ct = els.card.y / 100 * H, cb = ct + els.card.h / 100 * H;
        [[cl, cy], [cr, cy], [cx, ct], [cx, cb]].forEach(([ex, ey]) => {
          const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, sz * 0.35);
          eg.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.25 * inten})`);
          eg.addColorStop(1, 'transparent');
          ctx.fillStyle = eg; ctx.fillRect(0, 0, W, H);
        });
      }

      const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        ctx.lineTo(x + w, y + h - r); ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
        ctx.closePath();
      };

      // Card image
      if (els.card.visible && imgSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc; });
        const dx = els.card.x / 100 * W, dy = els.card.y / 100 * H;
        const dw = els.card.w / 100 * W, dh = els.card.h / 100 * H;
        const rd = radius * (W / (containerSize?.w || 400));
        ctx.save();
        ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.5 * inten})`;
        ctx.shadowBlur = 60 * inten;
        rr(dx, dy, dw, dh, rd); ctx.fillStyle = '#080808'; ctx.fill();
        ctx.restore();
        ctx.save(); rr(dx, dy, dw, dh, rd); ctx.clip();
        ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.25 * inten})`;
        ctx.lineWidth = 2; rr(dx, dy, dw, dh, rd); ctx.stroke();
      }

      // Frame
      if (els.frame.visible) {
        const dx = els.frame.x / 100 * W, dy = els.frame.y / 100 * H;
        const dw = els.frame.w / 100 * W, dh = els.frame.h / 100 * H;
        const rd = radius * (W / (containerSize?.w || 400));
        ctx.save();
        ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.15 * inten})`;
        ctx.shadowBlur = 15 * inten;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.5 * inten})`;
        ctx.lineWidth = 3;
        rr(dx, dy, dw, dh, rd); ctx.stroke();
        ctx.restore();
      }

      // Logo
      if (els.logo.visible && shopLogo) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise(r => { img.onload = r; img.onerror = r; img.src = shopLogo; });
        if (img.complete && img.naturalWidth) {
          const dx = els.logo.x / 100 * W, dy = els.logo.y / 100 * H;
          const dw = els.logo.w / 100 * W, dh = els.logo.h / 100 * H;
          ctx.save(); rr(dx, dy, dw, dh, 12); ctx.clip();
          ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
        }
      }

      // Title
      if (els.title.visible) {
        const dx = els.title.x / 100 * W, dw = els.title.w / 100 * W;
        const dy = els.title.y / 100 * H, dh = els.title.h / 100 * H;
        const fs = Math.max(24, Math.min(42, dh * 0.35));
        ctx.fillStyle = '#fff'; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'left';
        wrapText(ctx, item.card_name || '', dw).forEach((l, i) => {
          ctx.fillText(l, dx, dy + fs + i * fs * 1.3);
        });
      }

      // Price
      if (els.price.visible && price) {
        const dx = els.price.x / 100 * W, dy = els.price.y / 100 * H;
        const dw = els.price.w / 100 * W, dh = els.price.h / 100 * H;
        const fs = Math.max(24, Math.min(42, dh * 0.55));
        ctx.save(); ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`; ctx.shadowBlur = 20;
        ctx.fillStyle = c.main; rr(dx, dy, dw, dh, dh / 2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#000'; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`$${parseFloat(price).toFixed(2)}`, dx + dw / 2, dy + dh * 0.65);
      }

      // Tier badge
      if (els.tierBadge.visible) {
        const dx = els.tierBadge.x / 100 * W, dy = els.tierBadge.y / 100 * H;
        const dw = els.tierBadge.w / 100 * W, dh = els.tierBadge.h / 100 * H;
        const fs = Math.max(14, Math.min(22, dh * 0.5));
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.15)`;
        rr(dx, dy, dw, dh, dh / 2); ctx.fill();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.3)`; ctx.lineWidth = 1;
        rr(dx, dy, dw, dh, dh / 2); ctx.stroke();
        ctx.fillStyle = c.main; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(tier.label, dx + dw / 2, dy + dh * 0.65);
      }

      // Shop name
      if (els.shopName.visible) {
        const dx = els.shopName.x / 100 * W, dy = els.shopName.y / 100 * H;
        const dw = els.shopName.w / 100 * W, dh = els.shopName.h / 100 * H;
        const fs = Math.max(16, Math.min(28, dh * 0.6));
        ctx.fillStyle = '#777'; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(shopName || 'Card Shop', dx + dw / 2, dy + dh * 0.7);
      }

      // Available
      if (els.available.visible) {
        const dx = els.available.x / 100 * W, dy = els.available.y / 100 * H;
        const dw = els.available.w / 100 * W, dh = els.available.h / 100 * H;
        const fs = Math.max(12, Math.min(18, dh * 0.6));
        ctx.fillStyle = c.main; ctx.font = `bold ${fs}px -apple-system,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('AVAILABLE NOW', dx + dw / 2, dy + dh * 0.7);
      }

      const a = document.createElement('a');
      a.download = `${(item.card_name || 'card').replace(/[^a-z0-9]/gi, '-').substring(0, 40)}-social.png`;
      a.href = cvs.toDataURL('image/png');
      a.click();
    } catch (e) { console.error('Export failed:', e); }
    setSaving(false);
  }, [els, preset, glow, radius, imgSrc, item, price, shopName, shopLogo, tier, containerSize]);

  /* ─── Preview element renderers ─── */
  const renderInner = (key, cW, cH) => {
    const e = els[key];
    const elW = (e.w / 100) * cW;
    const elH = (e.h / 100) * cH;
    const glowI = glow / 100;

    switch (key) {
      case 'card':
        return imgSrc ? (
          <div style={{ width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden',
            boxShadow: `0 0 ${30 * glowI}px rgba(${preset.r},${preset.g},${preset.b},${0.4 * glowI})`,
            border: `1px solid rgba(${preset.r},${preset.g},${preset.b},${0.2 * glowI})`,
          }}>
            <img
              src={imgSrc}
              alt="card"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: radius }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: radius, background: '#1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            <ImageIcon style={{ width: 40, height: 40 }} />
          </div>
        );

      case 'frame':
        return (
          <div style={{
            width: '100%', height: '100%',
            borderRadius: radius,
            border: `2px solid rgba(${preset.r},${preset.g},${preset.b},${0.5 * glowI})`,
            boxShadow: `0 0 ${15 * glowI}px rgba(${preset.r},${preset.g},${preset.b},${0.15 * glowI}), inset 0 0 ${10 * glowI}px rgba(${preset.r},${preset.g},${preset.b},${0.05 * glowI})`,
            pointerEvents: 'none',
          }} />
        );

      case 'title':
        return (
          <div style={{ color: '#fff', fontWeight: 800, fontSize: Math.max(10, elH * 0.3),
            lineHeight: 1.2, overflow: 'hidden', wordBreak: 'break-word', userSelect: 'none' }}>
            {item.card_name || 'Card Title'}
          </div>
        );

      case 'price':
        return price ? (
          <div style={{ width: '100%', height: '100%', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: preset.main,
            fontWeight: 800, color: '#000', fontSize: Math.max(10, elH * 0.5),
            boxShadow: `0 0 15px rgba(${preset.r},${preset.g},${preset.b},0.5)`,
            userSelect: 'none',
          }}>
            ${parseFloat(price).toFixed(2)}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666',
            fontSize: Math.max(10, elH * 0.5), fontWeight: 800, userSelect: 'none' }}>
            $0.00
          </div>
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
            justifyContent: 'center', fontWeight: 700, color: '#777',
            fontSize: Math.max(8, elH * 0.55), userSelect: 'none' }}>
            {shopName || 'Card Shop'}
          </div>
        );

      case 'tierBadge':
        return (
          <div style={{ width: '100%', height: '100%', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            background: `rgba(${preset.r},${preset.g},${preset.b},0.15)`,
            border: `1px solid rgba(${preset.r},${preset.g},${preset.b},0.3)`,
            color: preset.main, fontWeight: 800,
            fontSize: Math.max(7, elH * 0.4), letterSpacing: '0.05em', userSelect: 'none' }}>
            <TierIcon style={{ width: elH * 0.4, height: elH * 0.4 }} />
            {tier.label}
          </div>
        );

      case 'available':
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800, letterSpacing: '0.1em',
            color: preset.main, fontSize: Math.max(7, elH * 0.5), userSelect: 'none' }}>
            AVAILABLE NOW
          </div>
        );

      default: return null;
    }
  };

  /* ─── RENDER ─── */
  const cW = containerSize?.w || 0;
  const cH = containerSize?.h || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      onClick={() => setSel(null)}
      data-testid="social-post-editor"
    >
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white text-xs font-bold relative">
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

      {/* Preset Menu Dropdown */}
      {showPresetMenu && (
        <div className="absolute top-12 right-4 z-[70] w-72 rounded-xl border border-white/[0.08] bg-[#111] shadow-2xl"
          onClick={e => e.stopPropagation()}>
          <div className="p-3 border-b border-white/[0.06]">
            <div className="text-xs font-bold text-gray-400 uppercase mb-2">Save Current Layout</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePreset()}
                placeholder="Preset name..."
                maxLength={30}
                data-testid="preset-name-input"
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white text-xs outline-none focus:border-purple-500/50 placeholder:text-gray-600"
              />
              <button onClick={savePreset} disabled={savingPreset || !presetName.trim() || savedPresets.length >= 5}
                data-testid="preset-save-btn"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                style={{ background: preset.main, color: '#000' }}>
                {savingPreset ? <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  : <Save className="w-3 h-3" />} Save
              </button>
            </div>
            {savedPresets.length >= 5 && (
              <div className="text-[10px] text-amber-400/70 mt-1">Max 5 presets reached. Delete one to save a new one.</div>
            )}
          </div>
          <div className="p-2 max-h-52 overflow-y-auto">
            {savedPresets.length === 0 ? (
              <div className="text-center text-gray-600 text-xs py-4">No saved presets yet</div>
            ) : (
              savedPresets.map(p => (
                <div key={p.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] group transition-colors"
                  data-testid={`saved-preset-${p.id}`}>
                  <button onClick={() => applyPreset(p)}
                    data-testid={`apply-preset-${p.id}`}
                    className="flex-1 text-left text-sm text-gray-300 font-medium hover:text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: GLOW_PRESETS.find(g => g.id === p.data?.presetId)?.main || '#888' }} />
                    {p.name}
                  </button>
                  <button onClick={() => deletePreset(p.id)}
                    data-testid={`delete-preset-${p.id}`}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-white/[0.06]">
            <button onClick={() => setShowPresetMenu(false)}
              className="w-full py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all flex items-center justify-center gap-1">
              <X className="w-3 h-3" /> Close
            </button>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
        onClick={() => setSel(null)}>
        {containerSize ? (
          <div
            data-testid="editor-canvas"
            onClick={e => e.stopPropagation()}
            style={{
              width: cW, height: cH, position: 'relative', overflow: 'hidden',
              background: '#080808',
              boxShadow: `0 0 ${60 * (glow / 100)}px rgba(${preset.r},${preset.g},${preset.b},${0.12 * (glow / 100)})`,
            }}
          >
            {/* Radial glow background */}
            {els.card.visible && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at ${els.card.x + els.card.w / 2}% ${els.card.y + els.card.h / 2}%, rgba(${preset.r},${preset.g},${preset.b},${0.2 * (glow / 100)}) 0%, transparent 65%)`,
              }} />
            )}

            {/* All interactive elements */}
            {EL_KEYS.map(k => (
              <DraggableEl
                key={k}
                id={k}
                el={els[k]}
                containerW={cW}
                containerH={cH}
                selected={sel === k}
                onSelect={setSel}
                onUpdate={updateEl}
              >
                {renderInner(k, cW, cH)}
              </DraggableEl>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Loading editor...</div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-2 space-y-2"
        onClick={e => e.stopPropagation()}>
        {/* Glow Presets */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" data-testid="editor-presets">
          {GLOW_PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p)}
              data-testid={`preset-${p.id}`}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                preset.id === p.id ? 'text-white scale-105' : 'text-gray-500 bg-white/[0.04] border border-white/[0.06]'
              }`}
              style={preset.id === p.id ? {
                background: `rgba(${p.r},${p.g},${p.b},0.2)`,
                border: `1px solid ${p.main}`,
                boxShadow: `0 0 12px rgba(${p.r},${p.g},${p.b},0.3)`,
              } : {}}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.main }} />
              {p.label}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold w-10">Glow</label>
            <input type="range" min={0} max={100} value={glow}
              onChange={e => setGlow(+e.target.value)}
              className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: preset.main }} />
            <span className="text-[9px] font-bold w-7 text-right" style={{ color: preset.main }}>{glow}%</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold w-12">Round</label>
            <input type="range" min={0} max={40} value={radius}
              onChange={e => setRadius(+e.target.value)}
              className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: preset.main }} />
            <span className="text-[9px] font-bold w-7 text-right" style={{ color: preset.main }}>{radius}px</span>
          </div>
        </div>

        {/* Toggle Visibility */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" data-testid="editor-toggles">
          {EL_KEYS.map(k => {
            const e = els[k];
            return (
              <button key={k} onClick={() => toggleVis(k)}
                data-testid={`toggle-${k}`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  e.visible ? 'bg-white/[0.08] text-white' : 'bg-white/[0.02] text-gray-600 line-through'
                }`}>
                {e.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {e.label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default SocialPostEditor;
