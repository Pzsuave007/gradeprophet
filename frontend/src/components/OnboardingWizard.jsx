import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, ArrowRight, ArrowLeft, Check, Search, Plus, X,
  Zap, ShoppingBag, TrendingUp, BarChart3, Target, Crosshair
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SPORTS = [
  { id: 'Basketball', color: '#f59e0b', emoji: '' },
  { id: 'Baseball', color: '#3b82f6', emoji: '' },
  { id: 'Football', color: '#10b981', emoji: '' },
  { id: 'Soccer', color: '#8b5cf6', emoji: '' },
  { id: 'Hockey', color: '#06b6d4', emoji: '' },
  { id: 'Pokemon', color: '#ef4444', emoji: '' },
  { id: 'UFC/MMA', color: '#f97316', emoji: '' },
  { id: 'Wrestling', color: '#ec4899', emoji: '' },
];

const CARD_TYPES = [
  { id: 'raw', label: 'Raw Cards', desc: 'Ungraded cards' },
  { id: 'graded', label: 'Graded Slabs', desc: 'PSA, BGS, SGC' },
  { id: 'both', label: 'Both', desc: 'Raw + Graded' },
];

const SUGGESTIONS = {
  Basketball: ['Luka Doncic Prizm', 'LeBron James Rookie', 'Ja Morant Select', 'Victor Wembanyama', 'Stephen Curry Mosaic'],
  Baseball: ['Shohei Ohtani Chrome', 'Mike Trout Rookie', 'Julio Rodriguez', 'Gunnar Henderson', 'Bobby Witt Jr'],
  Football: ['Patrick Mahomes Prizm', 'CJ Stroud Rookie', 'Caleb Williams', 'Brock Purdy', 'Travis Kelce'],
  Soccer: ['Lionel Messi Topps', 'Kylian Mbappe', 'Erling Haaland', 'Jude Bellingham', 'Lamine Yamal'],
  Hockey: ['Connor McDavid', 'Connor Bedard Rookie', 'Auston Matthews', 'Sidney Crosby'],
  Pokemon: ['Charizard VMAX', 'Pikachu Illustrator', 'Mewtwo GX', 'Umbreon VMAX Alt Art'],
  'UFC/MMA': ['Conor McGregor', 'Jon Jones', 'Islam Makhachev', 'Alex Pereira'],
  Wrestling: ['Stone Cold Steve Austin', 'The Rock', 'John Cena'],
};

const OnboardingWizard = ({ user, onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState([]);
  const [cardType, setCardType] = useState('both');
  const [searches, setSearches] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [saving, setSaving] = useState(false);

  const totalSteps = 4;

  const toggleSport = (id) => {
    setSports(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const addSearch = (q) => {
    const trimmed = (q || searchInput).trim();
    if (!trimmed || searches.includes(trimmed)) return;
    if (searches.length >= 10) { toast.error('Max 10 searches'); return; }
    setSearches(prev => [...prev, trimmed]);
    setSearchInput('');
  };

  const removeSearch = (q) => setSearches(prev => prev.filter(s => s !== q));

  const getSuggestions = () => {
    const all = [];
    sports.forEach(s => { if (SUGGESTIONS[s]) all.push(...SUGGESTIONS[s]); });
    return all.filter(s => !searches.includes(s)).slice(0, 8);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/api/onboarding/complete`, {
        sports,
        card_type: cardType,
        search_interests: searches,
      });
      toast.success('Setup complete!');
      onComplete();
    } catch (e) {
      toast.error('Error saving preferences');
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 1) return sports.length > 0;
    if (step === 2) return true;
    if (step === 3) return searches.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4" data-testid="onboarding-wizard">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#3b82f6]/[0.04] blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-[#1a1a1a]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: i <= step ? '100%' : '0%' }}
                className="h-full bg-[#3b82f6] rounded-full"
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0 - Welcome */}
          {step === 0 && (
            <StepWrapper key="welcome">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#3b82f6] flex items-center justify-center mx-auto mb-6">
                  <Layers className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight mb-2" data-testid="onboarding-welcome-title">
                  Welcome to FlipSlab, {user?.name?.split(' ')[0] || 'Trader'}!
                </h1>
                <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                  Let's set up your trading command center in 60 seconds. We'll personalize your dashboard so it's loaded with cards you actually care about.
                </p>

                <div className="grid grid-cols-3 gap-3 mt-8 max-w-sm mx-auto">
                  {[
                    { icon: Search, label: 'Find Deals' },
                    { icon: Crosshair, label: 'Track Auctions' },
                    { icon: TrendingUp, label: 'Track Profit' },
                  ].map((f, i) => (
                    <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 text-center">
                      <f.icon className="w-5 h-5 text-[#3b82f6] mx-auto mb-1.5" />
                      <p className="text-[10px] text-gray-400 font-medium">{f.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </StepWrapper>
          )}

          {/* STEP 1 - Sports */}
          {step === 1 && (
            <StepWrapper key="sports">
              <h2 className="text-2xl font-black text-white mb-1" data-testid="onboarding-sports-title">What do you collect?</h2>
              <p className="text-sm text-gray-500 mb-6">Select the sports or categories you trade. Pick as many as you want.</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SPORTS.map(s => {
                  const selected = sports.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleSport(s.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selected
                          ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                          : 'border-[#1a1a1a] bg-[#111] hover:border-[#2a2a2a]'
                      }`}
                      data-testid={`sport-${s.id.toLowerCase()}`}>
                      <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2 ${selected ? 'bg-[#3b82f6]' : 'bg-[#1a1a1a]'}`}
                        style={selected ? {} : { background: `${s.color}15` }}>
                        <ShoppingBag className="w-5 h-5" style={{ color: selected ? 'white' : s.color }} />
                      </div>
                      <p className={`text-sm font-bold ${selected ? 'text-white' : 'text-gray-400'}`}>{s.id}</p>
                      {selected && <Check className="w-4 h-4 text-[#3b82f6] mx-auto mt-1" />}
                    </button>
                  );
                })}
              </div>
            </StepWrapper>
          )}

          {/* STEP 2 - Card Type */}
          {step === 2 && (
            <StepWrapper key="cardtype">
              <h2 className="text-2xl font-black text-white mb-1" data-testid="onboarding-cardtype-title">Raw or Graded?</h2>
              <p className="text-sm text-gray-500 mb-6">This helps us filter the best deals for you.</p>

              <div className="grid grid-cols-3 gap-4">
                {CARD_TYPES.map(ct => {
                  const selected = cardType === ct.id;
                  return (
                    <button key={ct.id} onClick={() => setCardType(ct.id)}
                      className={`p-6 rounded-xl border-2 transition-all text-center ${
                        selected ? 'border-[#3b82f6] bg-[#3b82f6]/10' : 'border-[#1a1a1a] bg-[#111] hover:border-[#2a2a2a]'
                      }`}
                      data-testid={`cardtype-${ct.id}`}>
                      <BarChart3 className={`w-8 h-8 mx-auto mb-3 ${selected ? 'text-[#3b82f6]' : 'text-gray-600'}`} />
                      <p className={`text-sm font-bold mb-0.5 ${selected ? 'text-white' : 'text-gray-400'}`}>{ct.label}</p>
                      <p className="text-[10px] text-gray-600">{ct.desc}</p>
                      {selected && <Check className="w-4 h-4 text-[#3b82f6] mx-auto mt-2" />}
                    </button>
                  );
                })}
              </div>
            </StepWrapper>
          )}

          {/* STEP 3 - Search Interests */}
          {step === 3 && (
            <StepWrapper key="searches">
              <h2 className="text-2xl font-black text-white mb-1" data-testid="onboarding-searches-title">What cards are you hunting?</h2>
              <p className="text-sm text-gray-500 mb-6">Add players or specific cards you want to find on eBay. We'll start monitoring them right away.</p>

              {/* Input */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSearch()}
                    placeholder="e.g. Luka Doncic Prizm PSA 10"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                    data-testid="onboarding-search-input"
                  />
                </div>
                <button onClick={() => addSearch()}
                  disabled={!searchInput.trim()}
                  className="px-4 py-3 rounded-xl bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#2563eb] disabled:opacity-30 transition-all"
                  data-testid="onboarding-add-search-btn">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions */}
              {getSuggestions().length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-2">Suggested for you</p>
                  <div className="flex flex-wrap gap-2">
                    {getSuggestions().map(s => (
                      <button key={s} onClick={() => addSearch(s)}
                        className="px-3 py-1.5 rounded-lg bg-[#111] border border-[#1a1a1a] text-xs text-gray-400 hover:text-white hover:border-[#3b82f6]/50 transition-all"
                        data-testid={`suggestion-${s.replace(/\s/g, '-').toLowerCase()}`}>
                        <Plus className="w-3 h-3 inline mr-1" />{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Added searches */}
              {searches.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Your watchlist ({searches.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {searches.map(s => (
                      <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20">
                        <Target className="w-3 h-3 text-[#3b82f6]" />
                        <span className="text-xs text-white font-medium">{s}</span>
                        <button onClick={() => removeSearch(s)} className="text-gray-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searches.length === 0 && (
                <div className="text-center py-8 bg-[#111] border border-[#1a1a1a] rounded-xl mt-4">
                  <Search className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-600">Add at least one search to get started</p>
                </div>
              )}
            </StepWrapper>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white bg-[#111] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all"
                data-testid="onboarding-back-btn">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button onClick={onSkip}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                data-testid="onboarding-skip-btn">
                Skip setup
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600">{step + 1} / {totalSteps}</span>
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-bold hover:bg-[#2563eb] disabled:opacity-30 transition-all shadow-lg shadow-[#3b82f6]/20"
                data-testid="onboarding-next-btn">
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleFinish}
                disabled={saving || !canNext()}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#22c55e] text-white text-sm font-bold hover:bg-[#16a34a] disabled:opacity-30 transition-all shadow-lg shadow-[#22c55e]/20"
                data-testid="onboarding-finish-btn">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Setting up...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Launch Dashboard</>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StepWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.25 }}
  >
    {children}
  </motion.div>
);

export default OnboardingWizard;
