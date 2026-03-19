import React from 'react';
import { Lock, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

const PLAN_NAMES = { rookie: 'Rookie', all_star: 'All-Star', hall_of_fame: 'Hall of Fame', legend: 'Legend' };

const UpgradeGate = ({ locked, planRequired, featureName, onUpgrade, children }) => {
  if (!locked) return children;

  return (
    <div className="relative" data-testid={`upgrade-gate-${featureName?.replace(/\s+/g, '-').toLowerCase()}`}>
      {/* Blurred content behind */}
      <div className="pointer-events-none select-none opacity-20 blur-[2px]">
        {children}
      </div>

      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl"
      >
        <div className="flex flex-col items-center gap-3 p-6 max-w-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{featureName || 'Feature'} Locked</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Upgrade to <span className="text-amber-400 font-semibold">{PLAN_NAMES[planRequired] || 'a higher plan'}</span> to unlock
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
            data-testid="upgrade-gate-btn"
          >
            Upgrade Now <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default UpgradeGate;
