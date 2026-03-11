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
    { id: 'scanner', label: 'Analizar', icon: Scan },
    { id: 'monitor', label: 'Monitor', icon: ShoppingBag },
    { id: 'history', label: 'Historial', icon: History },
    { id: 'learning', label: 'Aprendizaje', icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] grid-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[#27272a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#3b82f6] rounded-sm flex items-center justify-center">
                <Scan className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-heading text-lg font-bold uppercase tracking-wider text-white">
                GradeProphet
              </h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#27272a]">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMainTab(id); if (id === 'scanner') setCurrentView('scanner'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mainTab === id 
                      ? 'bg-[#3b82f6] text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  data-testid={`tab-${id}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 hover:bg-white/5 rounded"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
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
            className="md:hidden bg-[#121212] border-b border-[#27272a]"
          >
            <div className="p-3 grid grid-cols-2 gap-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMainTab(id); if (id === 'scanner') setCurrentView('scanner'); setMobileMenuOpen(false); }}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-medium ${
                    mainTab === id 
                      ? 'bg-[#3b82f6] text-white' 
                      : 'bg-[#0a0a0a] text-gray-400 border border-[#27272a]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Full Width */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          {/* Scanner Tab */}
          {mainTab === 'scanner' && currentView === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Compact Hero */}
              <div className="text-center mb-6">
                <h2 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white mb-1">
                  Predice el Grado <span className="text-[#3b82f6]">Antes de Enviar</span>
                </h2>
                <p className="text-sm text-gray-500">
                  IA basada en estándares oficiales de PSA
                </p>
              </div>

              {/* Card Scanner - Full Width */}
              <CardScanner
                onAnalysisComplete={handleAnalysisComplete}
                isAnalyzing={isAnalyzing}
                setIsAnalyzing={setIsAnalyzing}
                ebayUrlToImport={ebayUrlToImport}
                onEbayImportComplete={handleEbayImportComplete}
              />

              {/* Compact Info Row */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="bg-[#121212] border border-[#27272a] rounded-lg p-3 text-center">
                  <Scan className="w-5 h-5 text-[#3b82f6] mx-auto mb-1" />
                  <p className="text-xs text-gray-400 font-medium">Análisis AI</p>
                </div>
                <div className="bg-[#121212] border border-[#27272a] rounded-lg p-3 text-center">
                  <Shield className="w-5 h-5 text-[#22c55e] mx-auto mb-1" />
                  <p className="text-xs text-gray-400 font-medium">PSA Standards</p>
                </div>
                <div className="bg-[#121212] border border-[#27272a] rounded-lg p-3 text-center">
                  <Brain className="w-5 h-5 text-[#eab308] mx-auto mb-1" />
                  <p className="text-xs text-gray-400 font-medium">Auto-Aprendizaje</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Analysis Result */}
          {mainTab === 'scanner' && (currentView === 'result' || currentView === 'history-detail') && currentAnalysis && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-center mb-4">
                <h2 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white mb-1">
                  Monitor de <span className="text-[#3b82f6]">Tarjetas en eBay</span>
                </h2>
                <p className="text-sm text-gray-500">
                  Agrega tarjetas y encuentra listings automáticamente
                </p>
              </div>
              <EbayMonitor onAnalyzeCard={handleAnalyzeFromEbay} />
            </motion.div>
          )}

          {/* History Tab - Now Full Width */}
          {mainTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-center mb-4">
                <h2 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white mb-1">
                  <span className="text-[#3b82f6]">Historial</span> de Análisis
                </h2>
                <p className="text-sm text-gray-500">
                  Todas tus tarjetas analizadas
                </p>
              </div>
              <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4">
                <HistoryPanel 
                  onSelectCard={handleSelectFromHistory}
                  refreshTrigger={historyRefresh}
                />
              </div>
            </motion.div>
          )}

          {/* Learning Tab - Now Full Width */}
          {mainTab === 'learning' && (
            <motion.div
              key="learning"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-center mb-4">
                <h2 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white mb-1">
                  Sistema de <span className="text-[#eab308]">Aprendizaje</span>
                </h2>
                <p className="text-sm text-gray-500">
                  Mejora las predicciones con resultados reales de PSA
                </p>
              </div>
              <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4">
                <LearningPanel refreshTrigger={historyRefresh} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272a] mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <p>© 2026 GradeProphet</p>
            <p>Predicciones mejoran con cada resultado PSA</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
