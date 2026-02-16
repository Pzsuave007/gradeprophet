import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scan, 
  History, 
  Brain, 
  Shield,
  ChevronLeft,
  Menu,
  X
} from 'lucide-react';
import CardScanner from '../components/CardScanner';
import AnalysisResult from '../components/AnalysisResult';
import HistoryPanel from '../components/HistoryPanel';
import LearningPanel from '../components/LearningPanel';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const Dashboard = () => {
  const [currentView, setCurrentView] = useState('scanner'); // scanner | result | history-detail
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('history');

  const handleAnalysisComplete = useCallback((analysis, front, back) => {
    setCurrentAnalysis(analysis);
    setFrontImage(front);
    setBackImage(back);
    setCurrentView('result');
    setHistoryRefresh(prev => prev + 1);
  }, []);

  const handleSelectFromHistory = useCallback((card) => {
    // Reconstruct the images from preview
    const front = card.front_image_preview 
      ? `data:image/jpeg;base64,${card.front_image_preview}`
      : null;
    const back = card.back_image_preview 
      ? `data:image/jpeg;base64,${card.back_image_preview}`
      : null;
    setCurrentAnalysis(card);
    setFrontImage(front);
    setBackImage(back);
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
    if (currentView === 'history-detail') {
      setCurrentAnalysis(null);
      setFrontImage(null);
      setBackImage(null);
      setCurrentView('scanner');
    } else {
      handleNewAnalysis();
    }
  }, [currentView, handleNewAnalysis]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] grid-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#3b82f6] rounded-sm flex items-center justify-center">
                <Scan className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold uppercase tracking-wider text-white">
                  GradeProphet
                </h1>
                <p className="text-xs text-gray-500 tracking-widest uppercase">
                  AI Grading Predictor
                </p>
              </div>
            </div>

            {/* Desktop Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-[#22c55e]" />
                <span className="text-gray-400">PSA Standards</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Brain className="w-4 h-4 text-[#3b82f6]" />
                <span className="text-gray-400">AI + Learning</span>
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 hover:bg-white/5 rounded"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Menu className="w-6 h-6 text-white" />
              )}
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
            <div className="p-4">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Historial Reciente
              </h3>
              <HistoryPanel 
                onSelectCard={handleSelectFromHistory}
                refreshTrigger={historyRefresh}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {currentView === 'scanner' && (
                <motion.div
                  key="scanner"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {/* Hero Section */}
                  <div className="text-center mb-8">
                    <h2 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tighter text-white mb-4">
                      Predice el Grado<br />
                      <span className="text-[#3b82f6]">Antes de Enviar</span>
                    </h2>
                    <p className="text-gray-400 max-w-xl mx-auto">
                      Usa inteligencia artificial para evaluar tus tarjetas deportivas 
                      basándose en los estándares oficiales de PSA. Ahorra dinero enviando 
                      solo las tarjetas que valen la pena.
                    </p>
                  </div>

                  {/* Card Scanner */}
                  <CardScanner
                    onAnalysisComplete={handleAnalysisComplete}
                    isAnalyzing={isAnalyzing}
                    setIsAnalyzing={setIsAnalyzing}
                  />

                  {/* Info Cards */}
                  <div className="grid sm:grid-cols-3 gap-4 mt-8">
                    <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
                      <div className="w-10 h-10 bg-[#3b82f6]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Scan className="w-5 h-5 text-[#3b82f6]" />
                      </div>
                      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white mb-1">
                        Análisis AI
                      </h3>
                      <p className="text-xs text-gray-500">
                        GPT-5.2 Vision evalúa tu tarjeta
                      </p>
                    </div>
                    <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
                      <div className="w-10 h-10 bg-[#22c55e]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Shield className="w-5 h-5 text-[#22c55e]" />
                      </div>
                      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white mb-1">
                        Estándares PSA
                      </h3>
                      <p className="text-xs text-gray-500">
                        Basado en criterios oficiales
                      </p>
                    </div>
                    <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
                      <div className="w-10 h-10 bg-[#eab308]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Brain className="w-5 h-5 text-[#eab308]" />
                      </div>
                      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white mb-1">
                        Sistema Aprendizaje
                      </h3>
                      <p className="text-xs text-gray-500">
                        Mejora con cada resultado
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {(currentView === 'result' || currentView === 'history-detail') && currentAnalysis && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {/* Back Button */}
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="mb-4 text-gray-400 hover:text-white"
                    data-testid="back-btn"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {currentView === 'history-detail' ? 'Volver al Scanner' : 'Nuevo Análisis'}
                  </Button>

                  <AnalysisResult
                    analysis={currentAnalysis}
                    frontImage={frontImage}
                    backImage={backImage}
                    onNewAnalysis={handleNewAnalysis}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar - History & Learning (Desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
                <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
                  <TabsList className="w-full grid grid-cols-2 bg-[#0a0a0a] rounded-none border-b border-[#27272a]">
                    <TabsTrigger 
                      value="history" 
                      className="rounded-none data-[state=active]:bg-[#121212] data-[state=active]:text-white font-heading uppercase tracking-wider text-xs py-3"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Historial
                    </TabsTrigger>
                    <TabsTrigger 
                      value="learning"
                      className="rounded-none data-[state=active]:bg-[#121212] data-[state=active]:text-white font-heading uppercase tracking-wider text-xs py-3"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Aprendizaje
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="history" className="mt-0 p-4">
                    <HistoryPanel 
                      onSelectCard={handleSelectFromHistory}
                      refreshTrigger={historyRefresh}
                    />
                  </TabsContent>
                  <TabsContent value="learning" className="mt-0 p-4">
                    <LearningPanel refreshTrigger={historyRefresh} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272a] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© 2026 GradeProphet. Powered by AI + Learning.</p>
            <p className="text-xs">
              Nota: Las predicciones mejoran con cada resultado real de PSA.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
