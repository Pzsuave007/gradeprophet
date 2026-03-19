import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rnd } from 'react-rnd';
import {
  X, Download, ChevronLeft, Sparkles, RotateCcw,
  Eye, EyeOff, Crown, Star, Shield, Award, Type, Tag, Store, Image as ImageIcon
} from 'lucide-react';

// Glow presets
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
  rookie: { label: 'Rookie', Icon: Shield },
  all_star: { label: 'All-Star', Icon: Star },
  hall_of_fame: { label: 'Hall of Fame', Icon: Award },
  legend: { label: 'Legend', Icon: Crown },
};

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const ASPECT = CANVAS_W / CANVAS_H;

// Default element positions (in % of canvas)
const DEFAULT_ELEMENTS = {
  card:      { x: 6, y: 2, w: 88, h: 66, visible: true, label: 'Card', icon: ImageIcon },
  title:     { x: 5, y: 71, w: 60, h: 10, visible: true, label: 'Title', icon: Type },
  price:     { x: 68, y: 71, w: 28, h: 6, visible: true, label: 'Price', icon: Tag },
  shopName:  { x: 25, y: 88, w: 50, h: 4, visible: true, label: 'Shop', icon: Store },
  tierBadge: { x: 30, y: 83, w: 40, h: 4, visible: true, label: 'Tier', icon: Crown },
  available: { x: 30, y: 93, w: 40, h: 3, visible: true, label: 'Tag', icon: Sparkles },
  logo:      { x: 4, y: 85, w: 10, h: 8, visible: true, label: 'Logo', icon: Store },
};

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

const SocialPostEditor = ({ item, shopName, shopLogo, shopPlan, onClose }) => {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 400, h: 500 });
  const [elements, setElements] = useState(JSON.parse(JSON.stringify(DEFAULT_ELEMENTS)));
  const [preset, setPreset] = useState(() => {
    const planPresets = { legend: 'purple', hall_of_fame: 'gold', all_star: 'blue', rookie: 'white' };
    return GLOW_PRESETS.find(p => p.id === (planPresets[shopPlan] || 'purple')) || GLOW_PRESETS[0];
  });
  const [glowIntensity, setGlowIntensity] = useState(70);
  const [cornerRadius, setCornerRadius] = useState(16);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [cardImgLoaded, setCardImgLoaded] = useState(false);
  const [logoImgLoaded, setLogoImgLoaded] = useState(false);
  const cardImgRef = useRef(null);
  const logoImgRef = useRef(null);

  const price = item.listed_price || item.purchase_price;
  const imgSrc = item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null;
  const tierCfg = TIER_CONFIG[shopPlan] || TIER_CONFIG.rookie;
  const TierIcon = tierCfg.Icon;

  // Load images
  useEffect(() => {
    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { cardImgRef.current = img; setCardImgLoaded(true); };
      img.src = imgSrc;
    }
  }, [imgSrc]);

  useEffect(() => {
    if (shopLogo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { logoImgRef.current = img; setLogoImgLoaded(true); };
      img.src = shopLogo;
    }
  }, [shopLogo]);

  // Resize observer
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const maxW = rect.width;
      const maxH = rect.height;
      let w = maxW;
      let h = w / ASPECT;
      if (h > maxH) { h = maxH; w = h * ASPECT; }
      setContainerSize({ w, h });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Percent to pixels
  const pxX = (pct) => (pct / 100) * containerSize.w;
  const pxY = (pct) => (pct / 100) * containerSize.h;
  const pctX = (px) => (px / containerSize.w) * 100;
  const pctY = (px) => (px / containerSize.h) * 100;

  const updateEl = (key, updates) => {
    setElements(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  };

  const toggleVisibility = (key) => {
    updateEl(key, { visible: !elements[key].visible });
  };

  const resetLayout = () => {
    setElements(JSON.parse(JSON.stringify(DEFAULT_ELEMENTS)));
    setGlowIntensity(70);
    setCornerRadius(16);
    setSelected(null);
  };

  // Export to canvas
  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      const c = preset;
      const intensity = glowIntensity / 100;

      // Background
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Glow behind card
      const el = elements;
      if (el.card.visible) {
        const ccx = (el.card.x / 100) * CANVAS_W + (el.card.w / 100) * CANVAS_W / 2;
        const ccy = (el.card.y / 100) * CANVAS_H + (el.card.h / 100) * CANVAS_H / 2;
        const cSize = Math.max((el.card.w / 100) * CANVAS_W, (el.card.h / 100) * CANVAS_H);

        // Wide glow
        const g1 = ctx.createRadialGradient(ccx, ccy, cSize * 0.1, ccx, ccy, cSize * 0.9);
        g1.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.35 * intensity})`);
        g1.addColorStop(0.3, `rgba(${c.r},${c.g},${c.b},${0.15 * intensity})`);
        g1.addColorStop(0.7, `rgba(${c.r},${c.g},${c.b},${0.04 * intensity})`);
        g1.addColorStop(1, 'transparent');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Core glow
        const g2 = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cSize * 0.55);
        g2.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.2 * intensity})`);
        g2.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${0.08 * intensity})`);
        g2.addColorStop(1, 'transparent');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Edge glows
        const cardLeft = (el.card.x / 100) * CANVAS_W;
        const cardRight = cardLeft + (el.card.w / 100) * CANVAS_W;
        const cardTop = (el.card.y / 100) * CANVAS_H;
        const cardBot = cardTop + (el.card.h / 100) * CANVAS_H;
        const spread = cSize * 0.4;
        [
          [cardLeft, ccy], [cardRight, ccy],
          [ccx, cardTop], [ccx, cardBot]
        ].forEach(([ex, ey]) => {
          const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, spread);
          eg.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.3 * intensity})`);
          eg.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${0.08 * intensity})`);
          eg.addColorStop(1, 'transparent');
          ctx.fillStyle = eg;
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        });
      }

      // Helper: draw rounded rect path
      const roundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        ctx.lineTo(x + r, y + h);
        ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        ctx.lineTo(x, y + r);
        ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
        ctx.closePath();
      };

      // Draw card image
      if (el.card.visible && cardImgRef.current) {
        const dx = (el.card.x / 100) * CANVAS_W;
        const dy = (el.card.y / 100) * CANVAS_H;
        const dw = (el.card.w / 100) * CANVAS_W;
        const dh = (el.card.h / 100) * CANVAS_H;
        const r = cornerRadius * (CANVAS_W / containerSize.w);

        // Shadow
        ctx.save();
        ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.5 * intensity})`;
        ctx.shadowBlur = 60 * intensity;
        ctx.fillStyle = '#080808';
        roundRect(dx + 5, dy + 5, dw - 10, dh - 10, r);
        ctx.fill();
        ctx.restore();

        // Clipped image
        ctx.save();
        roundRect(dx, dy, dw, dh, r);
        ctx.clip();
        ctx.drawImage(cardImgRef.current, dx, dy, dw, dh);
        ctx.restore();

        // Border
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.25 * intensity})`;
        ctx.lineWidth = 2;
        roundRect(dx, dy, dw, dh, r);
        ctx.stroke();
      }

      // Draw logo
      if (el.logo.visible && logoImgRef.current) {
        const dx = (el.logo.x / 100) * CANVAS_W;
        const dy = (el.logo.y / 100) * CANVAS_H;
        const dw = (el.logo.w / 100) * CANVAS_W;
        const dh = (el.logo.h / 100) * CANVAS_H;
        ctx.save();
        roundRect(dx, dy, dw, dh, 12);
        ctx.clip();
        ctx.drawImage(logoImgRef.current, dx, dy, dw, dh);
        ctx.restore();
      }

      // Draw title
      if (el.title.visible) {
        const dx = (el.title.x / 100) * CANVAS_W;
        const dy = (el.title.y / 100) * CANVAS_H;
        const dw = (el.title.w / 100) * CANVAS_W;
        const dh = (el.title.h / 100) * CANVAS_H;
        const fontSize = Math.max(24, Math.min(42, dh * 0.4));
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'left';
        const lines = wrapText(ctx, item.card_name || '', dw);
        lines.forEach((line, i) => {
          ctx.fillText(line, dx, dy + fontSize + i * (fontSize * 1.3));
        });
      }

      // Draw price bubble
      if (el.price.visible && price) {
        const dx = (el.price.x / 100) * CANVAS_W;
        const dy = (el.price.y / 100) * CANVAS_H;
        const dw = (el.price.w / 100) * CANVAS_W;
        const dh = (el.price.h / 100) * CANVAS_H;
        const fontSize = Math.max(24, Math.min(42, dh * 0.6));
        const priceStr = `$${parseFloat(price).toFixed(2)}`;
        const br = dh / 2;

        ctx.save();
        ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`;
        ctx.shadowBlur = 20;
        ctx.fillStyle = c.main;
        roundRect(dx, dy, dw, dh, br);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#000';
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(priceStr, dx + dw / 2, dy + dh * 0.65);
      }

      // Draw tier badge
      if (el.tierBadge.visible) {
        const dx = (el.tierBadge.x / 100) * CANVAS_W;
        const dy = (el.tierBadge.y / 100) * CANVAS_H;
        const dw = (el.tierBadge.w / 100) * CANVAS_W;
        const dh = (el.tierBadge.h / 100) * CANVAS_H;
        const fontSize = Math.max(14, Math.min(22, dh * 0.5));

        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.15)`;
        roundRect(dx, dy, dw, dh, dh / 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.3)`;
        ctx.lineWidth = 1;
        roundRect(dx, dy, dw, dh, dh / 2);
        ctx.stroke();

        ctx.fillStyle = c.main;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${tierCfg.label.toUpperCase()}`, dx + dw / 2, dy + dh * 0.65);
      }

      // Draw shop name
      if (el.shopName.visible) {
        const dx = (el.shopName.x / 100) * CANVAS_W;
        const dy = (el.shopName.y / 100) * CANVAS_H;
        const dh = (el.shopName.h / 100) * CANVAS_H;
        const dw = (el.shopName.w / 100) * CANVAS_W;
        const fontSize = Math.max(16, Math.min(28, dh * 0.6));
        ctx.fillStyle = '#777';
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(shopName || 'Card Shop', dx + dw / 2, dy + dh * 0.7);
      }

      // Draw "Available Now"
      if (el.available.visible) {
        const dx = (el.available.x / 100) * CANVAS_W;
        const dy = (el.available.y / 100) * CANVAS_H;
        const dh = (el.available.h / 100) * CANVAS_H;
        const dw = (el.available.w / 100) * CANVAS_W;
        const fontSize = Math.max(12, Math.min(18, dh * 0.6));
        ctx.fillStyle = c.main;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('AVAILABLE NOW', dx + dw / 2, dy + dh * 0.7);
      }

      const link = document.createElement('a');
      link.download = `${(item.card_name || 'card').replace(/[^a-z0-9]/gi, '-').substring(0, 40)}-social.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
    setGenerating(false);
  }, [elements, preset, glowIntensity, cornerRadius, item, price, shopName, shopPlan, tierCfg, containerSize]);

  if (!imgSrc) return null;

  const renderElement = (key) => {
    const el = elements[key];
    if (!el.visible) return null;
    const isSelected = selected === key;

    let content;
    switch (key) {
      case 'card':
        content = (
          <img src={imgSrc} alt="" className="w-full h-full object-cover"
            style={{ borderRadius: cornerRadius, pointerEvents: 'none' }}
            draggable={false} />
        );
        break;
      case 'logo':
        content = shopLogo ? (
          <img src={shopLogo} alt="" className="w-full h-full object-cover rounded-xl" draggable={false} style={{ pointerEvents: 'none' }} />
        ) : (
          <div className="w-full h-full rounded-xl flex items-center justify-center" style={{ background: `rgba(${preset.r},${preset.g},${preset.b},0.15)` }}>
            <Store className="w-1/2 h-1/2" style={{ color: preset.main }} />
          </div>
        );
        break;
      case 'title':
        content = (
          <div className="text-white font-bold leading-tight overflow-hidden" style={{ fontSize: Math.max(10, pxY(el.h) * 0.3) }}>
            {item.card_name}
          </div>
        );
        break;
      case 'price':
        content = price ? (
          <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-black"
            style={{ background: preset.main, fontSize: Math.max(10, pxY(el.h) * 0.5), boxShadow: `0 0 15px rgba(${preset.r},${preset.g},${preset.b},0.5)` }}>
            ${parseFloat(price).toFixed(2)}
          </div>
        ) : null;
        break;
      case 'tierBadge':
        content = (
          <div className="w-full h-full rounded-full flex items-center justify-center gap-1 font-bold uppercase tracking-wider"
            style={{
              background: `rgba(${preset.r},${preset.g},${preset.b},0.15)`,
              border: `1px solid rgba(${preset.r},${preset.g},${preset.b},0.3)`,
              color: preset.main,
              fontSize: Math.max(8, pxY(el.h) * 0.4),
            }}>
            <TierIcon style={{ width: pxY(el.h) * 0.4, height: pxY(el.h) * 0.4 }} />
            {tierCfg.label}
          </div>
        );
        break;
      case 'shopName':
        content = (
          <div className="w-full h-full flex items-center justify-center font-bold text-gray-400"
            style={{ fontSize: Math.max(9, pxY(el.h) * 0.55) }}>
            {shopName || 'Card Shop'}
          </div>
        );
        break;
      case 'available':
        content = (
          <div className="w-full h-full flex items-center justify-center font-bold uppercase tracking-widest"
            style={{ color: preset.main, fontSize: Math.max(7, pxY(el.h) * 0.5) }}>
            AVAILABLE NOW
          </div>
        );
        break;
      default:
        content = null;
    }

    return (
      <Rnd
        key={key}
        size={{ width: pxX(el.w), height: pxY(el.h) }}
        position={{ x: pxX(el.x), y: pxY(el.y) }}
        onDragStop={(e, d) => {
          updateEl(key, { x: pctX(d.x), y: pctY(d.y) });
        }}
        onResizeStop={(e, dir, ref, delta, pos) => {
          updateEl(key, {
            w: pctX(parseFloat(ref.style.width)),
            h: pctY(parseFloat(ref.style.height)),
            x: pctX(pos.x),
            y: pctY(pos.y),
          });
        }}
        bounds="parent"
        onMouseDown={() => setSelected(key)}
        className={`${isSelected ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-transparent' : ''}`}
        style={{ zIndex: key === 'card' ? 1 : 10, cursor: 'move' }}
        minWidth={20}
        minHeight={15}
      >
        <div className="w-full h-full relative">
          {content}
          {/* Resize handle indicator */}
          {isSelected && (
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-tl-sm"
              style={{ background: preset.main, cursor: 'se-resize' }} />
          )}
        </div>
      </Rnd>
    );
  };

  // Element list for toggle buttons
  const elementKeys = ['card', 'title', 'price', 'logo', 'shopName', 'tierBadge', 'available'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
      data-testid="social-post-editor"
      onClick={() => setSelected(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-1.5 text-white font-bold text-sm">
          <Sparkles className="w-4 h-4 text-amber-400" /> Social Post
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetLayout}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white text-xs font-bold transition-colors"
            data-testid="social-reset-btn">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button onClick={handleDownload} disabled={generating}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-sm active:scale-95 transition-transform"
            data-testid="social-download-btn">
            {generating ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-3 overflow-hidden" onClick={() => setSelected(null)}>
        <div
          className="relative overflow-hidden"
          style={{
            width: containerSize.w,
            height: containerSize.h,
            background: '#080808',
            boxShadow: `0 0 ${80 * (glowIntensity / 100)}px rgba(${preset.r},${preset.g},${preset.b},${0.15 * (glowIntensity / 100)})`,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Glow background */}
          {elements.card.visible && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(circle at ${elements.card.x + elements.card.w / 2}% ${elements.card.y + elements.card.h / 2}%, rgba(${preset.r},${preset.g},${preset.b},${0.2 * (glowIntensity / 100)}) 0%, rgba(${preset.r},${preset.g},${preset.b},${0.05 * (glowIntensity / 100)}) 40%, transparent 70%)`,
            }} />
          )}
          {/* Card glow effect */}
          {elements.card.visible && (
            <div className="absolute pointer-events-none" style={{
              left: `${elements.card.x}%`, top: `${elements.card.y}%`,
              width: `${elements.card.w}%`, height: `${elements.card.h}%`,
              boxShadow: `0 0 ${60 * (glowIntensity / 100)}px ${20 * (glowIntensity / 100)}px rgba(${preset.r},${preset.g},${preset.b},${0.3 * (glowIntensity / 100)})`,
              borderRadius: cornerRadius,
            }} />
          )}
          {/* Render all elements */}
          {elementKeys.map(key => renderElement(key))}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-2 space-y-2" onClick={e => e.stopPropagation()}>
        {/* Glow Presets */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {GLOW_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                preset.id === p.id ? 'text-white scale-105' : 'text-gray-500 bg-white/[0.04] border border-white/[0.06]'
              }`}
              style={preset.id === p.id ? {
                background: `rgba(${p.r},${p.g},${p.b},0.2)`,
                border: `1px solid ${p.main}`,
                boxShadow: `0 0 12px rgba(${p.r},${p.g},${p.b},0.3)`,
              } : {}}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.main }} />
              {p.label}
            </button>
          ))}
        </div>

        {/* Sliders row */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold w-10">Glow</label>
            <input type="range" min={0} max={100} value={glowIntensity}
              onChange={e => setGlowIntensity(parseInt(e.target.value))}
              className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: preset.main }} />
            <span className="text-[9px] font-bold w-7 text-right" style={{ color: preset.main }}>{glowIntensity}%</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold w-12">Round</label>
            <input type="range" min={0} max={40} value={cornerRadius}
              onChange={e => setCornerRadius(parseInt(e.target.value))}
              className="flex-1 h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: preset.main }} />
            <span className="text-[9px] font-bold w-7 text-right" style={{ color: preset.main }}>{cornerRadius}px</span>
          </div>
        </div>

        {/* Element toggles */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {elementKeys.map(key => {
            const el = elements[key];
            const ElIcon = el.icon;
            return (
              <button
                key={key}
                onClick={() => toggleVisibility(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  el.visible ? 'bg-white/[0.08] text-white' : 'bg-white/[0.02] text-gray-600 line-through'
                }`}
                data-testid={`toggle-${key}`}
              >
                {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {el.label}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default SocialPostEditor;
