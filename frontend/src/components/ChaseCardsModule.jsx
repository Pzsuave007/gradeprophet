import React, { useState } from 'react';
import { Flame, Gamepad2 } from 'lucide-react';
import ChasePacksModule from './ChasePacksModule';
import PullGameModule from './PullGameModule';

const TABS = [
  { id: 'packs', label: 'Chase Packs', icon: Flame, desc: 'Pre-built packs with guaranteed chasers' },
  { id: 'pull-game', label: 'Pull Game', icon: Gamepad2, desc: 'Interactive live pull game boards' },
];

const ChaseCardsModule = () => {
  const [tab, setTab] = useState('packs');
  return (
    <div data-testid="chase-cards-module">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">Chase Cards</h1>
        <p className="text-sm text-gray-500 mt-1">Build excitement and sell more cards through interactive chase experiences.</p>
      </div>
      <div className="flex gap-2 mb-6 border-b border-[#1a1a1a]">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`chase-tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors relative ${
                active ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {active && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
      {tab === 'packs' && <ChasePacksModule />}
      {tab === 'pull-game' && <PullGameModule />}
    </div>
  );
};

export default ChaseCardsModule;
