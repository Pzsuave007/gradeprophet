import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, History, Brain, ShoppingBag, ChevronLeft, Crosshair, Lock } from 'lucide-react';
import CardScanner from './CardScanner';
import AnalysisResult from './AnalysisResult';
import HistoryPanel from './HistoryPanel';
import LearningPanel from './LearningPanel';
import EbayMonitor from './EbayMonitor';
import AuctionSniper from './AuctionSniper';
import UpgradeGate from './UpgradeGate';
import { Button } from './ui/button';
import { usePlan } from '../hooks/usePlan';

const FlipFinder = ({ onNavigateToAccount }) => {
  const [currentView, setCurrentView] = useState('monitor');
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [subTab, setSubTab] = useState('monitor');
  const [ebayUrlToImport, setEbayUrlToImport] = useState(null);
  const [snipeUrl, setSnipeUrl] = useState(null);
  const { hasFeature, planId } = usePlan();

  const flipFinderAccess = hasFeature('flip_finder');
  const hasMonitor = hasFeature('flip_finder_monitor');
  const hasAlerts = hasFeature('flip_finder_alerts');
  const hasAnalyze = hasFeature('flip_finder_analyze');
  const hasAI = hasFeature('flip_finder_ai');

  const handleAnalysisComplete = useCallback((analysis, front, back) => {
    setCurrentAnalysis(analysis);
    setFrontImage(front);
    setBackImage(back);
    setCurrentView('result');
    setHistoryRefresh(prev => prev + 1);
  }, []);

  const handleSelectFromHistory = useCallback((card) => {
    const front = card.front_image_preview ? `data:image/jpeg;base64,${card.front_image_preview}` : null;
    const back = card.back_image_preview ? `data:image/jpeg;base64,${card.back_image_preview}` : null;
    setCurrentAnalysis(card);
    setFrontImage(front);
    setBackImage(back);
    setSubTab('scanner');
    setCurrentView('history-detail');
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setCurrentAnalysis(null); setFrontImage(null); setBackImage(null); setCurrentView('scanner');
  }, []);

  const handleBack = useCallback(() => {
    setCurrentAnalysis(null); setFrontImage(null); setBackImage(null); setCurrentView('scanner');
  }, []);

  const handleAnalyzeFromEbay = useCallback((listing) => {
    setSubTab('scanner'); setCurrentView('scanner'); setEbayUrlToImport(listing.listing_url);
  }, []);

  const handleEbayImportComplete = useCallback(() => { setEbayUrlToImport(null); }, []);

  const handleSnipeFromMonitor = useCallback((listing) => {
    setSnipeUrl(listing.listing_url || listing.item_url);
    setSubTab('sniper');
  }, []);

  const subTabs = [
    { id: 'monitor', label: 'Monitor', icon: ShoppingBag },
    { id: 'sniper', label: 'Alerts', icon: Crosshair },
    { id: 'scanner', label: 'Analyze', icon: Scan },
    { id: 'history', label: 'History', icon: History },
    { id: 'learning', label: 'AI', icon: Brain },
  ];

  const goUpgrade = () => onNavigateToAccount?.();

  // Rookie: entire Flip Finder is locked
  if (!flipFinderAccess) {
    return (
      <UpgradeGate locked={true} planRequired="mvp" featureName="Flip Finder" onUpgrade={goUpgrade}>
        <div className="w-full overflow-x-hidden">
          <div className="flex gap-1 mb-4 pb-1 -mx-1 px-1">
            {subTabs.map(({ id, label, icon: Icon }) => (
              <div key={id} className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-[#111] text-gray-500 border border-[#1a1a1a] whitespace-nowrap flex-shrink-0">
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{label}
              </div>
            ))}
          </div>
          <div className="h-64 bg-[#111] border border-[#1a1a1a] rounded-xl" />
        </div>
      </UpgradeGate>
    );
  }

  // Tab-level feature check
  const tabLocked = (id) => {
    if (id === 'monitor') return !hasMonitor;
    if (id === 'sniper') return !hasAlerts;
    if (id === 'scanner') return !hasAnalyze;
    if (id === 'learning') return !hasAI;
    return false;
  };

  const minPlanForTab = (id) => {
    if (id === 'sniper') return 'hall_of_famer';
    if (id === 'learning') return 'hall_of_famer';
    return 'mvp';
  };

  return (
    <div className="w-full overflow-x-hidden">
      {/* Sub-navigation */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {subTabs.map(({ id, label, icon: Icon }) => {
          const locked = tabLocked(id);
          return (
            <button key={id}
              onClick={() => { if (!locked) { setSubTab(id); if (id === 'scanner') setCurrentView('scanner'); } }}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap flex-shrink-0 ${
                locked ? 'bg-[#111] text-gray-700 border border-[#1a1a1a] cursor-not-allowed' :
                subTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
              }`} data-testid={`flip-tab-${id}`}>
              {locked && <Lock className="w-2.5 h-2.5" />}
              <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Check if current tab is locked */}
        {tabLocked(subTab) ? (
          <UpgradeGate locked={true} planRequired={minPlanForTab(subTab)} featureName={subTabs.find(t => t.id === subTab)?.label} onUpgrade={goUpgrade}>
            <div className="h-64 bg-[#111] border border-[#1a1a1a] rounded-xl" />
          </UpgradeGate>
        ) : (
        <>
        {subTab === 'scanner' && currentView === 'scanner' && (
          <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CardScanner onAnalysisComplete={handleAnalysisComplete} isAnalyzing={isAnalyzing} setIsAnalyzing={setIsAnalyzing}
              ebayUrlToImport={ebayUrlToImport} onEbayImportComplete={handleEbayImportComplete} />
          </motion.div>
        )}

        {subTab === 'scanner' && (currentView === 'result' || currentView === 'history-detail') && currentAnalysis && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="ghost" onClick={handleBack} className="mb-3 text-gray-400 hover:text-white" data-testid="back-btn">
              <ChevronLeft className="w-4 h-4 mr-1" />{currentView === 'history-detail' ? 'Back' : 'New Analysis'}
            </Button>
            <AnalysisResult analysis={currentAnalysis} frontImage={frontImage} backImage={backImage}
              onNewAnalysis={handleNewAnalysis} onDelete={() => setHistoryRefresh(prev => prev + 1)} onRefresh={() => setHistoryRefresh(prev => prev + 1)} />
          </motion.div>
        )}

        {subTab === 'monitor' && (
          <motion.div key="monitor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EbayMonitor onAnalyzeCard={handleAnalyzeFromEbay} onSnipeCard={handleSnipeFromMonitor} />
          </motion.div>
        )}

        {subTab === 'sniper' && (
          <motion.div key="sniper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuctionSniper prefillUrl={snipeUrl} />
          </motion.div>
        )}

        {subTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="font-heading text-lg font-bold uppercase tracking-tighter text-white mb-3">Analysis History</h2>
            <HistoryPanel onSelectCard={handleSelectFromHistory} refreshTrigger={historyRefresh} />
          </motion.div>
        )}

        {subTab === 'learning' && (
          <motion.div key="learning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="font-heading text-lg font-bold uppercase tracking-tighter text-white mb-3">Learning <span className="text-[#eab308]">System</span></h2>
            <LearningPanel refreshTrigger={historyRefresh} />
          </motion.div>
        )}
        </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlipFinder;
