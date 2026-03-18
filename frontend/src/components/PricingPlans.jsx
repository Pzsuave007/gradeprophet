import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Star, Trophy, Zap, Check, X, ChevronRight,
  BarChart3, Camera, Tag, Shield, Users, Monitor,
  Crosshair, Brain, Image, FileText, Headphones, Rocket
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PLAN_META = {
  rookie: {
    icon: Zap,
    color: 'from-gray-600 to-gray-700',
    accent: 'text-gray-400',
    border: 'border-gray-700/50',
    bg: 'bg-gray-900/40',
    badge: null,
    tagline: 'Start your journey',
  },
  all_star: {
    icon: Star,
    color: 'from-blue-600 to-blue-700',
    accent: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-950/20',
    badge: null,
    tagline: 'For the serious seller',
  },
  hall_of_fame: {
    icon: Trophy,
    color: 'from-amber-500 to-orange-600',
    accent: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/20',
    badge: 'MOST POPULAR',
    tagline: 'Everything you need',
  },
  legend: {
    icon: Crown,
    color: 'from-purple-600 to-violet-700',
    accent: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-950/20',
    badge: 'UNLIMITED',
    tagline: 'For shops & enterprises',
  },
};

const FEATURE_LIST = [
  { key: 'inventory', label: 'Cards in Inventory', type: 'limit' },
  { key: 'scans_per_month', label: 'AI Scans / Month', type: 'limit' },
  { key: 'listings', label: 'eBay Listings', type: 'limit' },
  { key: 'dashboard_full', label: 'Full Dashboard', icon: BarChart3, type: 'feature' },
  { key: 'flip_finder_monitor', label: 'Flip Finder: Monitor', icon: Crosshair, type: 'feature' },
  { key: 'flip_finder_analyze', label: 'Flip Finder: Analyze', icon: Crosshair, type: 'feature' },
  { key: 'flip_finder_alerts', label: 'Auction Alerts', icon: Crosshair, type: 'feature' },
  { key: 'flip_finder_ai', label: 'Flip Finder: AI', icon: Brain, type: 'feature' },
  { key: 'market_full', label: 'Market Intelligence', icon: BarChart3, type: 'feature' },
  { key: 'market_seasonal', label: 'Seasonal Intelligence', icon: BarChart3, type: 'feature' },
  { key: 'photo_editor', label: 'Photo Editor', icon: Image, type: 'feature' },
  { key: 'photo_presets_premium', label: 'Premium Presets', icon: Image, type: 'feature' },
  { key: 'export_reports', label: 'Export Reports', icon: FileText, type: 'feature' },
  { key: 'priority_support', label: 'Priority Support', icon: Headphones, type: 'feature' },
  { key: 'multi_marketplace', label: 'Multi-Marketplace', icon: Tag, type: 'feature', coming: true },
  { key: 'team_access', label: 'Team Access', icon: Users, type: 'feature' },
  { key: 'scanner_software', label: 'Scanner Software', icon: Monitor, type: 'feature' },
];

const PricingPlans = ({ currentPlanId, onPlanChange }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get(`${API}/api/subscription/plans`);
        setPlans(res.data.plans || []);
      } catch { toast.error('Failed to load plans'); }
      finally { setLoading(false); }
    };
    fetchPlans();
  }, []);

  const handleSubscribe = async (planId) => {
    if (planId === 'rookie') {
      if (!window.confirm('Downgrade to Rookie (Free)? Your limits will be reduced.')) return;
      try {
        await axios.post(`${API}/api/subscription/downgrade-to-free`);
        toast.success('Downgraded to Rookie plan');
        onPlanChange?.();
      } catch { toast.error('Failed to downgrade'); }
      return;
    }

    setCheckingOut(planId);
    try {
      const origin = window.location.origin;
      const res = await axios.post(`${API}/api/subscription/checkout`, {
        plan_id: planId,
        origin_url: origin,
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Checkout failed');
    } finally {
      setCheckingOut(null);
    }
  };

  const formatLimit = (val) => {
    if (val === -1) return 'Unlimited';
    return val.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pricing-plans">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Choose Your Plan</h2>
        <p className="text-xs sm:text-sm text-gray-500">Scale your card business with the right tools</p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((plan, i) => {
          const meta = PLAN_META[plan.id] || PLAN_META.rookie;
          const Icon = meta.icon;
          const isCurrent = currentPlanId === plan.id;
          const isPopular = plan.id === 'hall_of_fame';

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-xl border ${isPopular ? 'border-amber-500/50 ring-1 ring-amber-500/20' : meta.border} ${meta.bg} overflow-hidden flex flex-col`}
              data-testid={`plan-card-${plan.id}`}
            >
              {/* Badge */}
              {meta.badge && (
                <div className={`absolute top-0 right-0 px-2.5 py-1 rounded-bl-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${
                  isPopular ? 'bg-amber-500 text-black' : 'bg-purple-500 text-white'
                }`}>
                  {meta.badge}
                </div>
              )}

              {/* Plan Header */}
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">{plan.name}</h3>
                    <p className="text-[10px] sm:text-[11px] text-gray-500">{meta.tagline}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="text-2xl sm:text-3xl font-black text-white">Free</span>
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl font-black text-white">${plan.price}</span>
                      <span className="text-xs text-gray-500">/mo</span>
                    </>
                  )}
                </div>

                {/* Limits - prominent */}
                <div className="space-y-1.5">
                  {['inventory', 'scans_per_month', 'listings'].map((key) => {
                    const val = plan.limits?.[key];
                    const labels = {
                      inventory: 'Cards',
                      scans_per_month: 'AI Scans/mo',
                      listings: 'eBay Listings',
                    };
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] text-gray-500">{labels[key]}</span>
                        <span className={`text-xs sm:text-sm font-bold ${val === -1 ? meta.accent : 'text-white'}`}>
                          {formatLimit(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5 mx-4" />

              {/* Features */}
              <div className="p-4 sm:p-5 flex-1 space-y-1.5">
                {FEATURE_LIST.filter(f => f.type === 'feature').map(({ key, label, coming }) => {
                  const has = plan.features?.[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {has ? (
                        <Check className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 ${meta.accent}`} />
                      ) : (
                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-700 flex-shrink-0" />
                      )}
                      <span className={`text-[10px] sm:text-[11px] ${has ? 'text-gray-300' : 'text-gray-600'}`}>
                        {label}
                        {coming && has && <span className="text-[8px] ml-1 text-amber-400/70">SOON</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* CTA Button */}
              <div className="p-4 sm:p-5 pt-0">
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-lg text-center text-xs font-bold text-gray-500 bg-gray-800/50 border border-gray-700/50"
                    data-testid={`plan-current-${plan.id}`}>
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={checkingOut === plan.id}
                    className={`w-full py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isPopular
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                        : plan.id === 'legend'
                        ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500'
                        : plan.id === 'rookie'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                    }`}
                    data-testid={`plan-subscribe-${plan.id}`}
                  >
                    {checkingOut === plan.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {plan.price === 0 ? 'Downgrade' : currentPlanId === 'rookie' ? 'Get Started' : 'Upgrade'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom note */}
      <p className="text-center text-[10px] sm:text-[11px] text-gray-600">
        All paid plans include a secure checkout via Stripe. Cancel anytime.
      </p>
    </div>
  );
};

export default PricingPlans;
