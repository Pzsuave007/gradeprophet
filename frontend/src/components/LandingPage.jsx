import React from 'react';
import { motion } from 'framer-motion';
import {
  ScanLine, TrendingUp, Bell, Store, Layers, Zap, BarChart3,
  Upload, ArrowRight, Check, X, Crosshair, Radio,
  Crown, Star, Trophy, Camera, Shield, Users, Monitor,
  Brain, Image, FileText, Headphones, Rocket
} from 'lucide-react';

const FEATURES = [
  { icon: Crosshair, title: 'Auction Alerts', desc: 'Set a price target and relax. FlipSlab watches the auction, alerts you 1 minute before it ends, and opens eBay so you can bid. Never miss a deal.', color: '#f59e0b', img: 'https://static.prod-images.emergentagent.com/jobs/f2af8643-2cdf-4bf3-93f1-8e75056bb973/images/fba2228e6311181cf9c2d1758f4ac11b2fe700cdbf249ce22a3eff98f953af1c.png' },
  { icon: Radio, title: 'Live Market Monitor', desc: 'Track cards in real-time sorted by ending soonest. Filter by Auctions, Buy Now, or Best Offer. Set alerts, buy, or make offers — all from one screen.', color: '#3b82f6', img: 'https://static.prod-images.emergentagent.com/jobs/f2af8643-2cdf-4bf3-93f1-8e75056bb973/images/e55c10ef10fe712afceb1276142359bc8eea37c5f41b41e73b19ce2d48a67d63.png' },
  { icon: ScanLine, title: 'AI Card Scanner', desc: 'Snap a photo. AI identifies player, year, set, and condition instantly. Works with raw and graded cards.', color: '#8b5cf6', img: 'https://static.prod-images.emergentagent.com/jobs/f2af8643-2cdf-4bf3-93f1-8e75056bb973/images/0cdd6557949d1bf9e984114f7bcd8f3f5a12713dc1b8cbe21886898a9c4e61c5.png' },
  { icon: TrendingUp, title: 'Portfolio P&L', desc: 'Real-time portfolio valuation with profit/loss tracking. Know exactly what your collection is worth at any moment.', color: '#10b981', img: 'https://static.prod-images.emergentagent.com/jobs/f2af8643-2cdf-4bf3-93f1-8e75056bb973/images/f50dd5584cfb99121cef67089a584bb852a867365cd070af33bbda58717297c6.png' },
  { icon: Store, title: 'eBay Command Center', desc: 'List, manage, and end listings directly. AI-generated titles and descriptions. Track sold items with hi-res images.', color: '#ef4444', img: 'https://static.prod-images.emergentagent.com/jobs/f2af8643-2cdf-4bf3-93f1-8e75056bb973/images/058bad830b54b29becf7a3ed070019fd1c53c0bf4914ff3e2f87f31b59c47207.png' },
  { icon: Upload, title: 'Batch Upload', desc: 'Scan 20+ cards at once. AI identifies each one automatically. Built for dealers who move volume.', color: '#06b6d4', img: 'https://static.prod-images.emergentagent.com/jobs/f2af8643-2cdf-4bf3-93f1-8e75056bb973/images/8fb1feca0199f1312526368524b2f072e96315b1619225329c1abe52c84e4f81.png' },
];

const WORKFLOW = [
  { icon: ScanLine, label: 'Scan', desc: 'Snap a photo or batch scan', color: '#8b5cf6' },
  { icon: Zap, label: 'AI Identifies', desc: 'Player, year, set — instant', color: '#f59e0b' },
  { icon: Layers, label: 'Inventory', desc: 'Organize your collection', color: '#3b82f6' },
  { icon: Store, label: 'List on eBay', desc: 'One-click AI listings', color: '#ef4444' },
  { icon: BarChart3, label: 'Track P&L', desc: 'Real-time portfolio value', color: '#10b981' },
];

const PLANS = [
  {
    id: 'rookie',
    name: 'ROOKIE',
    icon: Zap,
    price: 'Free',
    period: '',
    tagline: 'Start your journey',
    color: 'from-gray-600 to-gray-700',
    accent: 'text-gray-400',
    cardImage: 'https://customer-assets.emergentagent.com/job_8941a75b-2157-4d9e-882f-a0cf919e04ed/artifacts/xdgv6i1p_rookie.webp',
    limits: { cards: '30', scans: '30', listings: '30' },
    features: [
      { text: 'Dashboard (basic)', has: true },
      { text: 'AI Card Scanner', has: true },
      { text: 'eBay Connection', has: true },
      { text: 'Flip Finder', has: false },
      { text: 'Market Intelligence', has: false },
      { text: 'Photo Editor', has: false },
    ],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    id: 'all_star',
    name: 'ALL-STAR',
    icon: Star,
    price: '$9.99',
    period: '/mo',
    tagline: 'For the serious seller',
    color: 'from-blue-600 to-blue-700',
    accent: 'text-blue-400',
    cardImage: 'https://customer-assets.emergentagent.com/job_8941a75b-2157-4d9e-882f-a0cf919e04ed/artifacts/747pul21_all-start-lebron.jfif',
    limits: { cards: '200', scans: '200', listings: '200' },
    features: [
      { text: 'Full Dashboard', has: true },
      { text: 'AI Card Scanner', has: true },
      { text: 'Flip Finder: Monitor + Analyze', has: true },
      { text: 'Market (partial)', has: true },
      { text: 'Auction Alerts', has: false },
      { text: 'Photo Editor', has: false },
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    id: 'hall_of_fame',
    name: 'HALL OF FAME',
    icon: Trophy,
    price: '$14.99',
    period: '/mo',
    tagline: 'Everything you need',
    color: 'from-amber-500 to-orange-600',
    accent: 'text-amber-400',
    cardImage: 'https://customer-assets.emergentagent.com/job_8941a75b-2157-4d9e-882f-a0cf919e04ed/artifacts/h4bz6thd_hall-of-fame-kobe.webp',
    limits: { cards: '500', scans: '500', listings: '500' },
    features: [
      { text: 'Full Dashboard + Export', has: true },
      { text: 'AI Card Scanner', has: true },
      { text: 'Flip Finder: ALL features', has: true },
      { text: 'Market: Full access', has: true },
      { text: 'Photo Editor + Premium Presets', has: true },
      { text: 'Priority Support', has: true },
    ],
    cta: 'Start Now',
    highlight: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'legend',
    name: 'LEGEND',
    icon: Crown,
    price: '$24.99',
    period: '/mo',
    tagline: 'For shops & enterprises',
    color: 'from-purple-600 to-violet-700',
    accent: 'text-purple-400',
    cardImage: 'https://customer-assets.emergentagent.com/job_8941a75b-2157-4d9e-882f-a0cf919e04ed/artifacts/9dwva9ex_legend.webp',
    limits: { cards: 'Unlimited', scans: 'Unlimited', listings: 'Unlimited' },
    features: [
      { text: 'Everything in Hall of Fame', has: true },
      { text: 'Multi-Marketplace (soon)', has: true },
      { text: 'Scanner Software', has: true },
      { text: 'Team Access', has: true },
      { text: 'Advanced P&L Reports', has: true },
      { text: 'VIP Support (24h)', has: true },
    ],
    cta: 'Go Legend',
    highlight: false,
    badge: 'UNLIMITED',
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
          <a href="#actions" className="hover:text-white transition-colors">How It Works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <button onClick={onGetStarted}
          className="px-5 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.1] transition-colors"
          data-testid="nav-login-btn">
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className="relative z-10 px-6 lg:px-16 pt-20 pb-8 lg:pt-32 lg:pb-12">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-[#3b82f6]/[0.06] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#3b82f6] font-bold mb-4">A Trading Dashboard for Sports Cards</p>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.9] tracking-tight">
                TRACK.<br />
                <span className="text-[#f59e0b]">FLIP.</span><br />
                <span className="text-[#3b82f6]">SELL.</span>
              </h1>
              <p className="text-lg text-gray-400 mt-6 max-w-lg leading-relaxed">
                AI identifies your cards instantly. Manage inventory, create eBay listings in one click, monitor the market for deals, and track your profit — all from one platform.
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
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> AI identification</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> eBay connected</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> Portfolio tracking</span>
              </div>
            </motion.div>
          </div>

          {/* Slab Cards */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="flex-shrink-0 hidden lg:block relative w-[520px] h-[480px]">
            <div className="absolute top-4 left-0 w-52 rounded-xl overflow-hidden transform -rotate-6 shadow-2xl shadow-black/60 border border-white/[0.08] hover:scale-105 transition-transform duration-500"
              style={{ zIndex: 1 }}>
              <img src="https://customer-assets.emergentagent.com/job_06cf1e32-7d3e-41b3-a599-d6544d83f035/artifacts/qj87a9o0_1996-topps-138-kobe-bryant-gem-mt-10-88551.webp" alt="1996 Topps Kobe Bryant PSA 10" className="w-full h-auto" />
            </div>
            <div className="absolute top-8 left-28 w-56 rounded-xl overflow-hidden transform rotate-3 shadow-2xl shadow-[#3b82f6]/20 border border-[#3b82f6]/20 hover:scale-105 transition-transform duration-500"
              style={{ zIndex: 3 }}>
              <img src="https://customer-assets.emergentagent.com/job_06cf1e32-7d3e-41b3-a599-d6544d83f035/artifacts/fs47xwop_curry-pas-10.webp" alt="2009 Topps Stephen Curry PSA 9" className="w-full h-auto" />
            </div>
            <div className="absolute top-4 right-0 w-56 rounded-xl overflow-hidden transform rotate-6 shadow-2xl shadow-black/50 border border-white/[0.06] hover:scale-105 transition-transform duration-500"
              style={{ zIndex: 2 }}>
              <img src="https://customer-assets.emergentagent.com/job_06cf1e32-7d3e-41b3-a599-d6544d83f035/artifacts/46xv0kyq_tombrady.webp" alt="2000 Bowman Tom Brady PSA 9" className="w-full h-auto" />
            </div>
            {/* Sniper badge */}
            <div className="absolute bottom-12 left-4 px-4 py-2.5 rounded-xl bg-[#111]/90 border border-[#f59e0b]/20 backdrop-blur-xl shadow-xl" style={{ zIndex: 4 }}>
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#f59e0b]" />
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Alert Armed</p>
                  <p className="text-sm font-black text-[#f59e0b]">$73.00 max</p>
                  <p className="text-[9px] text-gray-500">Ends in 58s</p>
                </div>
              </div>
            </div>
            {/* P&L badge */}
            <div className="absolute bottom-4 right-4 px-4 py-2.5 rounded-xl bg-[#111]/90 border border-emerald-500/20 backdrop-blur-xl shadow-xl" style={{ zIndex: 4 }}>
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">Portfolio</p>
              <p className="text-lg font-black text-emerald-400">+$1,247</p>
              <p className="text-[9px] text-emerald-400">+18.3% ROI</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WORKFLOW STRIP */}
      <section id="actions" className="relative z-10 px-6 lg:px-16 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#f59e0b] font-bold mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">From Scan to Sale in Minutes</h2>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            {WORKFLOW.map((w, i) => (
              <React.Fragment key={i}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-5 rounded-xl bg-[#111] border border-white/[0.06] hover:border-white/[0.15] transition-all group w-full md:w-40"
                  data-testid={`workflow-${i}`}>
                  <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                    style={{ background: `${w.color}15`, border: `1px solid ${w.color}30` }}>
                    <w.icon className="w-5 h-5" style={{ color: w.color }} />
                  </div>
                  <p className="text-xs font-bold text-white mb-0.5">{w.label}</p>
                  <p className="text-[10px] text-gray-600 leading-relaxed">{w.desc}</p>
                </motion.div>
                {i < WORKFLOW.length - 1 && (
                  <ArrowRight className="hidden md:block w-4 h-4 text-gray-600 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES BENTO GRID */}
      <section id="features" className="relative z-10 px-6 lg:px-16 py-10">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#3b82f6] font-bold mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Everything You Need to Flip</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {FEATURES.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`group rounded-2xl border border-white/[0.06] bg-[#111] overflow-hidden hover:border-white/[0.15] transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}`}
                data-testid={`feature-${i}`}>
                <div className={`relative overflow-hidden ${i === 0 ? 'h-64 lg:h-80' : 'h-44'}`}>
                  <img src={f.img} alt={f.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/40 to-transparent" />
                  <div className="absolute bottom-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md" style={{ background: `${f.color}20`, border: `1px solid ${f.color}40` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-[var(--accent)] transition-colors" style={{ '--accent': f.color }}>{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative z-10 px-6 lg:px-16 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#3b82f6] font-bold mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Pick Your Plan</h2>
            <p className="text-sm text-gray-500 mt-3">Start free. Upgrade when you're ready to dominate.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {PLANS.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative rounded-2xl overflow-visible flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl ${
                    plan.highlight
                      ? 'bg-[#111] border-2 border-amber-500/40 shadow-lg shadow-amber-500/5'
                      : 'bg-[#111] border border-white/[0.06]'
                  }`}
                  data-testid={`landing-plan-${plan.id}`}>

                  {/* Badge */}
                  {plan.badge && (
                    <div className={`absolute -top-3 right-4 px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest z-20 ${
                      plan.highlight ? 'bg-amber-500 text-black' : 'bg-purple-500 text-white'
                    }`}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col">
                    {/* Top area: Icon+Name on left, Card floating right */}
                    <div className="relative min-h-[140px] sm:min-h-[160px]">
                      {/* Card Image - floating right, extending outside */}
                      <div className="absolute -top-8 -right-4 sm:-right-6 w-[120px] sm:w-[140px] z-10 pointer-events-none">
                        <img src={plan.cardImage} alt={`${plan.name} card`}
                          className="w-full h-auto rounded-md transition-transform"
                          style={{
                            filter: plan.id === 'rookie' ? 'drop-shadow(0 8px 24px rgba(156,163,175,0.25))' :
                                   plan.id === 'all_star' ? 'drop-shadow(0 8px 28px rgba(59,130,246,0.45))' :
                                   plan.id === 'hall_of_fame' ? 'drop-shadow(0 8px 32px rgba(245,158,11,0.55))' :
                                   'drop-shadow(0 8px 32px rgba(147,51,234,0.55))',
                          }}
                          loading="lazy" />
                      </div>

                      {/* Icon + Name + Price - left side */}
                      <div className="relative z-10 pr-[90px] sm:pr-[100px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">{plan.name}</p>
                            <p className="text-[10px] text-gray-600">{plan.tagline}</p>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mt-3">
                          <span className="text-3xl sm:text-4xl font-black text-white">{plan.price}</span>
                          {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="space-y-1.5 pb-3 border-b border-white/[0.06]">
                      {Object.entries(plan.limits).map(([key, val]) => {
                        const labels = { cards: 'Cards', scans: 'AI Scans/mo', listings: 'eBay Listings' };
                        const isUnlimited = val === 'Unlimited';
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">{labels[key]}</span>
                            <span className={`text-sm font-bold ${isUnlimited ? plan.accent : 'text-white'}`}>{val}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Features */}
                    <div className="space-y-2 flex-1">
                      {plan.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2">
                          {f.has ? (
                            <Check className={`w-3.5 h-3.5 flex-shrink-0 ${plan.accent}`} />
                          ) : (
                            <X className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
                          )}
                          <span className={`text-[11px] sm:text-xs ${f.has ? 'text-gray-300' : 'text-gray-600'}`}>{f.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <button onClick={onGetStarted}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                        plan.highlight
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                          : plan.id === 'legend'
                          ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500'
                          : plan.id === 'rookie'
                          ? 'bg-white/[0.06] text-white border border-white/[0.08] hover:bg-white/[0.1]'
                          : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                      }`}
                      data-testid={`landing-pricing-cta-${plan.id}`}>
                      {plan.cta}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-6">All paid plans include secure Stripe checkout. Cancel anytime.</p>
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
