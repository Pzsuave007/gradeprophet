import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, History, Brain, ShoppingBag, ChevronLeft, Crosshair } from 'lucide-react';
import CardScanner from './CardScanner';
import AnalysisResult from './AnalysisResult';
import HistoryPanel from './HistoryPanel';
import LearningPanel from './LearningPanel';
import EbayMonitor from './EbayMonitor';
import AuctionSniper from './AuctionSniper';
import { Button } from './ui/button';

const FlipFinder = () => {
  const [currentView, setCurrentView] = useState('monitor');
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [subTab, setSubTab] = useState('monitor');
  const [ebayUrlToImport, setEbayUrlToImport] = useState(null);
  const [snipeUrl, setSnipeUrl] = useState(null);

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
    { id: 'sniper', label: 'Auction Alerts', icon: Crosshair },
    { id: 'scanner', label: 'Analyze', icon: Scan },
    { id: 'history', label: 'History', icon: History },
    { id: 'learning', label: 'AI', icon: Brain },
  ];

  return (
    <div className="w-full">
      {/* Sub-navigation */}
      <div className="flex gap-1 mb-4">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setSubTab(id); if (id === 'scanner') setCurrentView('scanner'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
              subTab === id ? 'bg-[#3b82f6] text-white' : 'bg-[#111] text-gray-500 hover:text-white border border-[#1a1a1a]'
            }`} data-testid={`flip-tab-${id}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
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
      </AnimatePresence>
    </div>
  );
};

export default FlipFinder;
