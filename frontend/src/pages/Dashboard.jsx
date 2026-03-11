import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scan, 
  History, 
  Brain, 
  Shield,
  ChevronLeft,
  Menu,
  X,
  ShoppingBag
} from 'lucide-react';
import CardScanner from '../components/CardScanner';
import AnalysisResult from '../components/AnalysisResult';
import HistoryPanel from '../components/HistoryPanel';
import LearningPanel from '../components/LearningPanel';
import EbayMonitor from '../components/EbayMonitor';
import { Button } from '../components/ui/button';

const Dashboard = () => {
  const [currentView, setCurrentView] = useState('scanner');
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mainTab, setMainTab] = useState('scanner');
  const [ebayUrlToImport, setEbayUrlToImport] = useState(null);

  const handleAnalysisComplete = useCallback((analysis, front, back) => {
    setCurrentAnalysis(analysis);
    setFrontImage(front);
    setBackImage(back);
    setCurrentView('result');
    setHistoryRefresh(prev => prev + 1);
  }, []);

  const handleSelectFromHistory = useCallback((card) => {
    const front = card.front_image_preview 
      ? `data:image/jpeg;base64,${card.front_image_preview}`
      : null;
    const back = card.back_image_preview 
      ? `data:image/jpeg;base64,${card.back_image_preview}`
      : null;
    setCurrentAnalysis(card);
    setFrontImage(front);
    setBackImage(back);
    setMainTab('scanner');
    setCurrentView('history-detail');
    setMobileMenuOpen(false);
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setCurrentAnalysis(null);
    setFrontImage(null);
    setBackImage(null);
    setCurrentView('scanner');
  }, []);

  const handleBack = useCallback(() => {
    setCurrentAnalysis(null);
    setFrontImage(null);
    setBackImage(null);
    setCurrentView('scanner');
  }, []);

  const handleAnalyzeFromEbay = useCallback((listing) => {
    setMainTab('scanner');
    setCurrentView('scanner');
    setEbayUrlToImport(listing.listing_url);
  }, []);

  const handleEbayImportComplete = useCallback(() => {
    setEbayUrlToImport(null);
  }, []);

  const tabs = [
    { id: 'scanner', label: 'Analizar', shortLabel: 'Analizar', icon: Scan },
    { id: 'monitor', label: 'Monitor eBay', shortLabel: 'Monitor', icon: ShoppingBag },
    { id: 'history', label: 'Historial', shortLabel: 'Historial', icon: History },
    { id: 'learning', label: 'Aprendizaje', shortLabel: 'AI', icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header - Slim */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#3b82f6] rounded flex items-center justify-center">
                <Scan className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                GradeProphet
              </h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-0.5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMainTab(id); if (id === 'scanner') setCurrentView('scanner'); }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-all ${
                    mainTab === id 
                      ? 'bg-[#3b82f6] text-white' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                  data-testid={`tab-${id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Mobile Menu */}
            <button
              className="md:hidden p-1.5 hover:bg-white/5 rounded"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#121212] border-b border-[#1a1a1a]"
          >
            <div className="p-2 grid grid-cols-4 gap-1">
              {tabs.map(({ id, shortLabel, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMainTab(id); if (id === 'scanner') setCurrentView('scanner'); setMobileMenuOpen(false); }}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded text-xs font-medium ${
                    mainTab === id 
                      ? 'bg-[#3b82f6] text-white' 
                      : 'bg-[#0a0a0a] text-gray-400 border border-[#1a1a1a]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {shortLabel}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Full Width, No Max Width */}
      <main className="w-full px-4 sm:px-6 py-4">
        <AnimatePresence mode="wait">
          {/* Scanner Tab */}
          {mainTab === 'scanner' && currentView === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CardScanner
                onAnalysisComplete={handleAnalysisComplete}
                isAnalyzing={isAnalyzing}
                setIsAnalyzing={setIsAnalyzing}
                ebayUrlToImport={ebayUrlToImport}
                onEbayImportComplete={handleEbayImportComplete}
              />
            </motion.div>
          )}

          {/* Analysis Result */}
          {mainTab === 'scanner' && (currentView === 'result' || currentView === 'history-detail') && currentAnalysis && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <Button
                variant="ghost"
                onClick={handleBack}
                className="mb-3 text-gray-400 hover:text-white"
                data-testid="back-btn"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {currentView === 'history-detail' ? 'Volver' : 'Nuevo Análisis'}
              </Button>
              <AnalysisResult
                analysis={currentAnalysis}
                frontImage={frontImage}
                backImage={backImage}
                onNewAnalysis={handleNewAnalysis}
                onDelete={() => setHistoryRefresh(prev => prev + 1)}
                onRefresh={() => setHistoryRefresh(prev => prev + 1)}
              />
            </motion.div>
          )}

          {/* Monitor Tab */}
          {mainTab === 'monitor' && (
            <motion.div
              key="monitor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <EbayMonitor onAnalyzeCard={handleAnalyzeFromEbay} />
            </motion.div>
          )}

          {/* History Tab */}
          {mainTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <h2 className="font-heading text-xl font-bold uppercase tracking-tighter text-white mb-4">
                Historial de Análisis
              </h2>
              <div className="bg-[#121212] border border-[#1a1a1a] rounded-lg p-4">
                <HistoryPanel 
                  onSelectCard={handleSelectFromHistory}
                  refreshTrigger={historyRefresh}
                />
              </div>
            </motion.div>
          )}

          {/* Learning Tab */}
          {mainTab === 'learning' && (
            <motion.div
              key="learning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <h2 className="font-heading text-xl font-bold uppercase tracking-tighter text-white mb-4">
                Sistema de <span className="text-[#eab308]">Aprendizaje</span>
              </h2>
              <div className="bg-[#121212] border border-[#1a1a1a] rounded-lg p-4">
                <LearningPanel refreshTrigger={historyRefresh} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;
