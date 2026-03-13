import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScanLine, TrendingUp, Bell, Store, Layers, Zap, BarChart3,
  Upload, Shield, ArrowRight, Check, ChevronRight, Star
} from 'lucide-react';

const FEATURES = [
  { icon: ScanLine, title: 'AI Card Scanner', desc: 'Snap a photo. AI identifies player, year, set, and condition instantly.', size: 'large', color: '#3b82f6' },
  { icon: TrendingUp, title: 'Portfolio P&L', desc: 'Real-time portfolio valuation with profit/loss tracking. Know exactly what your collection is worth.', size: 'tall', color: '#10b981' },
  { icon: Store, title: 'eBay Integration', desc: 'List directly to eBay with AI-generated titles, descriptions, and market-based pricing.', size: 'small', color: '#f59e0b' },
  { icon: Bell, title: 'Price Alerts', desc: 'Get notified when cards hit your target buy or sell price.', size: 'small', color: '#ef4444' },
  { icon: Upload, title: 'Batch Upload', desc: 'Scan 20+ cards at once. AI identifies each one automatically.', size: 'small', color: '#8b5cf6' },
  { icon: BarChart3, title: 'Market Intelligence', desc: 'Price history charts, sold comparisons, and trend analysis.', size: 'small', color: '#06b6d4' },
];

const PLANS = [
  {
    name: 'ROOKIE',
    price: 'Free',
    period: '',
    desc: 'Start tracking your collection',
    features: ['Up to 50 cards', 'AI card identification', 'Basic portfolio value', 'Manual market lookup', 'eBay connection'],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'HALL OF FAME',
    price: '$9.99',
    period: '/mo',
    desc: 'For serious traders & flippers',
    features: ['Unlimited cards', 'AI card identification', 'Real-time portfolio P&L', 'Price alerts (unlimited)', 'Batch upload (20+ cards)', 'Auto market refresh', 'Priority support', 'Advanced analytics'],
    cta: 'Start Free Trial',
    highlight: true,
  },
];

const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden" data-testid="landing-page">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />

      {/* NAV */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-16 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#3b82f6] flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight">FlipSlab</span>
            <span className="text-[9px] uppercase tracking-[0.3em] text-[#3b82f6] ml-1.5 font-bold">ENGINE</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <button onClick={onGetStarted}
          className="px-5 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.1] transition-colors"
          data-testid="nav-login-btn">
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className="relative z-10 px-6 lg:px-16 pt-20 pb-24 lg:pt-32 lg:pb-36">
        {/* Blue orb glow */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-[#3b82f6]/[0.06] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#3b82f6] font-bold mb-4">The Operating System for Card Traders</p>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.9] tracking-tight">
                SCAN.<br />
                <span className="text-[#3b82f6]">FLIP.</span><br />
                PROFIT.
              </h1>
              <p className="text-lg text-gray-400 mt-6 max-w-lg leading-relaxed">
                AI-powered inventory management, real-time portfolio tracking, and instant eBay listings. Everything you need to run your card business.
              </p>
              <div className="flex items-center gap-4 mt-8">
                <button onClick={onGetStarted}
                  className="group flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#2563eb] transition-all shadow-lg shadow-[#3b82f6]/20"
                  data-testid="hero-cta-btn">
                  Start Free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <a href="#features"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                  See Features
                </a>
              </div>
              <div className="flex items-center gap-6 mt-8 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> Free to start</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> No credit card</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> eBay connected</span>
              </div>
            </motion.div>
          </div>

          {/* CSS Slab Cards */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="flex-shrink-0 hidden lg:block relative w-[380px] h-[420px]">
            {/* Floating slab card 1 */}
            <div className="absolute top-0 left-0 w-52 h-72 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent backdrop-blur-sm transform -rotate-6 shadow-2xl shadow-black/50"
              style={{ perspective: '1000px' }}>
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/[0.06]">
                <span className="text-[8px] font-bold text-amber-400 tracking-widest uppercase">PSA</span>
                <span className="text-[14px] font-black text-white">10</span>
              </div>
              <div className="m-2 h-48 rounded-lg bg-gradient-to-br from-[#3b82f6]/20 via-purple-500/10 to-amber-500/10 flex items-center justify-center">
                <span className="text-[10px] text-gray-500 font-mono">CARD IMAGE</span>
              </div>
              <div className="px-3 py-1">
                <p className="text-[8px] text-gray-400 font-mono truncate">2024 Prizm Wembanyama RC</p>
              </div>
              {/* Holographic shimmer */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-pulse pointer-events-none" />
            </div>
            {/* Floating slab card 2 */}
            <div className="absolute top-16 left-36 w-52 h-72 rounded-xl border border-[#3b82f6]/20 bg-gradient-to-br from-[#3b82f6]/[0.08] to-transparent backdrop-blur-sm transform rotate-3 shadow-2xl shadow-[#3b82f6]/10"
              style={{ perspective: '1000px' }}>
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#3b82f6]/10">
                <span className="text-[8px] font-bold text-[#3b82f6] tracking-widest uppercase">BGS</span>
                <span className="text-[14px] font-black text-white">9.5</span>
              </div>
              <div className="m-2 h-48 rounded-lg bg-gradient-to-br from-[#3b82f6]/10 via-cyan-500/10 to-emerald-500/10 flex items-center justify-center">
                <span className="text-[10px] text-gray-500 font-mono">CARD IMAGE</span>
              </div>
              <div className="px-3 py-1">
                <p className="text-[8px] text-gray-400 font-mono truncate">2003 Topps LeBron James RC</p>
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-[#3b82f6]/[0.04] to-transparent animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
            </div>
            {/* P&L badge floating */}
            <div className="absolute bottom-8 left-4 px-4 py-2.5 rounded-xl bg-[#111] border border-emerald-500/20 backdrop-blur-xl shadow-xl">
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Portfolio</p>
              <p className="text-lg font-black text-emerald-400">+$1,247</p>
              <p className="text-[9px] text-emerald-400">+18.3% ROI</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES BENTO GRID */}
      <section id="features" className="relative z-10 px-6 lg:px-16 py-20">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#3b82f6] font-bold mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Everything You Need to Flip</h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
            {FEATURES.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-2xl border border-white/[0.06] bg-[#111] p-6 hover:border-white/[0.12] transition-all group ${i === 0 ? 'col-span-2 row-span-1' : i === 1 ? 'row-span-2' : ''}`}
                data-testid={`feature-${i}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative z-10 px-6 lg:px-16 py-20">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#3b82f6] font-bold mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Pick Your Plan</h2>
            <p className="text-sm text-gray-500 mt-3">Start free. Upgrade when you're ready.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {PLANS.map((plan, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`rounded-2xl p-8 transition-all ${plan.highlight
                  ? 'bg-[#111] border-2 border-[#3b82f6]/40 shadow-lg shadow-[#3b82f6]/5 relative'
                  : 'bg-[#111] border border-white/[0.06]'}`}
                data-testid={`pricing-${plan.name.toLowerCase().replace(/\s/g, '-')}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#3b82f6] text-[9px] font-bold uppercase tracking-widest text-white">
                    Most Popular
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-3 mb-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
                </div>
                <p className="text-xs text-gray-500 mb-6">{plan.desc}</p>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-3.5 h-3.5 text-[#3b82f6] flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onGetStarted}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${plan.highlight
                    ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb] shadow-lg shadow-[#3b82f6]/20'
                    : 'bg-white/[0.06] text-white border border-white/[0.08] hover:bg-white/[0.1]'}`}
                  data-testid={`pricing-cta-${i}`}>
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 px-6 lg:px-16 py-12 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#3b82f6]" />
            <span className="text-sm font-bold text-white">FlipSlab Engine</span>
          </div>
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} FlipSlab Engine. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
