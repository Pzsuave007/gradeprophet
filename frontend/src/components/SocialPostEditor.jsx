import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Download, ChevronLeft, Sparkles } from 'lucide-react';

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

const SocialPostEditor = ({ item, shopName, onClose }) => {
  const canvasRef = useRef(null);
  const [preset, setPreset] = useState(GLOW_PRESETS[0]);
  const [glowIntensity, setGlowIntensity] = useState(70);
  const [showPrice, setShowPrice] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef(null);

  const price = item.listed_price || item.purchase_price;
  const imgSrc = item.image ? `data:image/jpeg;base64,${item.image}` : item.ebay_picture || null;

  // Load image once
  useEffect(() => {
    if (!imgSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => setImgLoaded(false);
    img.src = imgSrc;
  }, [imgSrc]);

  // Draw canvas whenever settings change
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const W = 1080, H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const c = preset;
    const intensity = glowIntensity / 100;

    // Background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, W, H);

    // Card dimensions
    const maxW = W * 0.88;
    const maxH = H * 0.66;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const cw = img.width * ratio;
    const ch = img.height * ratio;
    const cx = (W - cw) / 2;
    const cy = 50;
    const centerX = W / 2;
    const centerY = cy + ch / 2;

    // === GLOW LAYERS ===
    // Layer 1: Wide ambient glow
    const g1 = ctx.createRadialGradient(centerX, centerY, ch * 0.1, centerX, centerY, ch * 0.85);
    g1.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.35 * intensity})`);
    g1.addColorStop(0.3, `rgba(${c.r},${c.g},${c.b},${0.15 * intensity})`);
    g1.addColorStop(0.7, `rgba(${c.r},${c.g},${c.b},${0.04 * intensity})`);
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    // Layer 2: Bright core glow
    const g2 = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, ch * 0.55);
    g2.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.2 * intensity})`);
    g2.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${0.08 * intensity})`);
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Layer 3: Edge light spill (4 sides)
    const edgeGlow = (ex, ey, spread) => {
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, spread);
      eg.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.3 * intensity})`);
      eg.addColorStop(0.4, `rgba(${c.r},${c.g},${c.b},${0.08 * intensity})`);
      eg.addColorStop(1, 'transparent');
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, W, H);
    };
    edgeGlow(cx, centerY, cw * 0.5);           // left edge
    edgeGlow(cx + cw, centerY, cw * 0.5);       // right edge
    edgeGlow(centerX, cy, ch * 0.35);           // top edge
    edgeGlow(centerX, cy + ch, ch * 0.35);       // bottom edge

    // === CARD SHADOW ===
    ctx.save();
    ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.5 * intensity})`;
    ctx.shadowBlur = 80 * intensity;
    ctx.fillStyle = '#080808';
    ctx.fillRect(cx + 10, cy + 10, cw - 20, ch - 20);
    ctx.restore();

    // === DRAW CARD ===
    ctx.drawImage(img, cx, cy, cw, ch);

    // Subtle bright edge border
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.25 * intensity})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Inner bright edge highlight (like light hitting the card edges)
    ctx.strokeStyle = `rgba(255,255,255,${0.06 * intensity})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);

    // === BOTTOM INFO ===
    const infoY = cy + ch + 30;

    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    const nameMaxW = showPrice && price ? W - 300 : W - 130;
    const nameLines = wrapText(ctx, item.card_name || '', nameMaxW);
    nameLines.forEach((line, i) => {
      ctx.fillText(line, 65, infoY + 42 + i * 48);
    });

    // Price bubble
    if (showPrice && price) {
      const priceStr = `$${parseFloat(price).toFixed(2)}`;
      ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, sans-serif';
      const priceW = ctx.measureText(priceStr).width;
      const bubbleW = priceW + 52;
      const bubbleH = 62;
      const bubbleX = W - 65 - bubbleW;
      const bubbleY = infoY + 8;
      const br = bubbleH / 2;

      // Bubble glow
      ctx.save();
      ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.5)`;
      ctx.shadowBlur = 25;
      ctx.fillStyle = c.main;
      ctx.beginPath();
      ctx.moveTo(bubbleX + br, bubbleY);
      ctx.lineTo(bubbleX + bubbleW - br, bubbleY);
      ctx.arc(bubbleX + bubbleW - br, bubbleY + br, br, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(bubbleX + br, bubbleY + bubbleH);
      ctx.arc(bubbleX + br, bubbleY + br, br, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(priceStr, bubbleX + bubbleW / 2, bubbleY + 43);
      ctx.textAlign = 'left';
    }

    // Footer
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.12)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(65, H - 105);
    ctx.lineTo(W - 65, H - 105);
    ctx.stroke();

    ctx.fillStyle = '#777';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shopName || 'Card Shop', W / 2, H - 62);

    ctx.fillStyle = c.main;
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('AVAILABLE NOW', W / 2, H - 34);
  }, [preset, glowIntensity, showPrice, item, price, shopName]);

  useEffect(() => {
    if (imgLoaded) drawCanvas();
  }, [imgLoaded, drawCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${(item.card_name || 'card').replace(/[^a-z0-9]/gi, '-').substring(0, 40)}-social.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!imgSrc) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-lg flex flex-col"
      data-testid="social-post-editor"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex items-center gap-1.5 text-white font-bold text-sm">
          <Sparkles className="w-4 h-4 text-amber-400" /> Social Post
        </div>
        <button onClick={handleDownload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm active:scale-95 transition-transform"
          data-testid="social-download-btn">
          <Download className="w-4 h-4" /> Save
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          className="max-h-[65vh] w-auto rounded-xl shadow-2xl"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 space-y-3">
        {/* Glow Presets */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {GLOW_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                preset.id === p.id
                  ? 'text-white shadow-lg scale-105'
                  : 'text-gray-500 bg-white/[0.04] border border-white/[0.06]'
              }`}
              style={preset.id === p.id ? {
                background: `rgba(${p.r},${p.g},${p.b},0.2)`,
                borderColor: p.main,
                border: `1px solid ${p.main}`,
                boxShadow: `0 0 15px rgba(${p.r},${p.g},${p.b},0.3)`,
              } : {}}
              data-testid={`glow-preset-${p.id}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: p.main }} />
              {p.label}
            </button>
          ))}
        </div>

        {/* Intensity Slider */}
        <div className="flex items-center gap-3">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold w-14">Glow</label>
          <input
            type="range" min={10} max={100} value={glowIntensity}
            onChange={e => setGlowIntensity(parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
            style={{ accentColor: preset.main }}
            data-testid="glow-intensity-slider"
          />
          <span className="text-[10px] font-bold w-8 text-right" style={{ color: preset.main }}>
            {glowIntensity}%
          </span>
        </div>

        {/* Toggle Price */}
        <div className="flex items-center gap-3">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold w-14">Price</label>
          <button
            onClick={() => setShowPrice(!showPrice)}
            className={`relative w-10 h-5 rounded-full transition-colors ${showPrice ? 'bg-emerald-500' : 'bg-white/10'}`}
            data-testid="toggle-price"
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showPrice ? 'left-5' : 'left-0.5'}`} />
          </button>
          <span className="text-[10px] text-gray-500">{showPrice ? 'Showing' : 'Hidden'}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SocialPostEditor;
