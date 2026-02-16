import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Package,
  Trash2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';

const LearningPanel = ({ refreshTrigger }) => {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [pendingCards, setPendingCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [feedbackData, setFeedbackData] = useState({});

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch(`${API}/learning/stats`);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }

      // Fetch all cards to show pending ones
      const cardsRes = await fetch(`${API}/cards/history`);
      if (cardsRes.ok) {
        const cards = await cardsRes.json();
        // Separate pending and graded
        setPendingCards(cards.filter(c => !c.actual_psa_grade));
      }

      // Fetch learning history
      const historyRes = await fetch(`${API}/learning/history`);
      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch learning data:', err);
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const submitFeedback = async (cardId) => {
    const data = feedbackData[cardId];
    if (!data?.actual_psa_grade) return;

    try {
      const response = await fetch(`${API}/cards/${cardId}/feedback`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_psa_grade: parseFloat(data.actual_psa_grade),
          psa_cert_number: data.psa_cert_number || null,
          status: 'graded'
        })
      });

      if (response.ok) {
        // Refresh data
        fetchData();
        setExpandedCard(null);
        setFeedbackData(prev => {
          const newData = { ...prev };
          delete newData[cardId];
          return newData;
        });
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const updateCardStatus = async (cardId, status) => {
    try {
      await fetch(`${API}/cards/${cardId}/status?status=${status}`, {
        method: 'PUT'
      });
      fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const deleteCard = async (cardId, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este análisis?')) return;
    
    try {
      const response = await fetch(`${API}/cards/${cardId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setPendingCards(prev => prev.filter(c => c.id !== cardId));
        // Also refresh stats
        const statsRes = await fetch(`${API}/learning/stats`);
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      }
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  const getGradeColor = (grade) => {
    if (grade >= 9) return '#22c55e';
    if (grade >= 7) return '#3b82f6';
    if (grade >= 5) return '#eab308';
    return '#ef4444';
  };

  const getDifferenceColor = (diff) => {
    if (Math.abs(diff) <= 0.5) return '#22c55e';
    if (Math.abs(diff) <= 1) return '#eab308';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Brain className="w-8 h-8 text-[#3b82f6] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total_analyzed}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Analizadas</p>
          </div>
          <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#3b82f6]">{stats.total_graded}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Con Feedback</p>
          </div>
          <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#22c55e]">{stats.accuracy_rate}%</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Precisión</p>
          </div>
          <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-[#eab308]">±{stats.average_difference}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Diferencia Prom.</p>
          </div>
        </div>
      )}

      {/* Accuracy Breakdown */}
      {stats && stats.total_graded > 0 && (
        <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4">
          <h4 className="text-sm font-heading uppercase tracking-wider text-white mb-3">
            Tendencia de Predicciones
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#22c55e]" />
              <div>
                <p className="text-lg font-bold text-[#22c55e]">{stats.predictions_accurate}</p>
                <p className="text-[10px] text-gray-500">Precisas (±0.5)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#eab308]" />
              <div>
                <p className="text-lg font-bold text-[#eab308]">{stats.predictions_high}</p>
                <p className="text-[10px] text-gray-500">Muy Altas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#3b82f6]" />
              <div>
                <p className="text-lg font-bold text-[#3b82f6]">{stats.predictions_low}</p>
                <p className="text-[10px] text-gray-500">Muy Bajas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Cards - Need Feedback */}
      {pendingCards.length > 0 && (
        <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#27272a] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#eab308]" />
            <h4 className="text-sm font-heading uppercase tracking-wider text-white">
              Esperando Resultados PSA ({pendingCards.length})
            </h4>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="p-3 space-y-2">
              {pendingCards.map((card) => (
                <div key={card.id} className="bg-[#0a0a0a] rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#1e1e1e] transition-colors"
                    onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                  >
                    <div className="w-10 h-14 bg-[#1e1e1e] rounded overflow-hidden flex-shrink-0">
                      {card.front_image_preview && (
                        <img
                          src={`data:image/jpeg;base64,${card.front_image_preview}`}
                          alt="Card"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {card.card_name || 'Tarjeta sin nombre'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Predicción: <span style={{ color: getGradeColor(card.grading_result?.overall_grade) }}>
                          {card.grading_result?.overall_grade?.toFixed(1)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        card.status === 'sent_to_psa' 
                          ? 'bg-[#3b82f6]/20 text-[#3b82f6]' 
                          : 'bg-[#27272a] text-gray-400'
                      }`}>
                        {card.status === 'sent_to_psa' ? 'Enviada' : 'Pendiente'}
                      </span>
                      {expandedCard === card.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedCard === card.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#27272a] overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          {card.status !== 'sent_to_psa' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCardStatus(card.id, 'sent_to_psa')}
                              className="w-full border-[#3b82f6]/50 text-[#3b82f6]"
                            >
                              <Package className="w-4 h-4 mr-2" />
                              Marcar como Enviada a PSA
                            </Button>
                          )}
                          
                          <div className="space-y-2">
                            <p className="text-xs text-gray-400">¿Ya recibiste el grado? Ingresa el resultado:</p>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.5"
                                min="1"
                                max="10"
                                placeholder="Grado PSA (1-10)"
                                value={feedbackData[card.id]?.actual_psa_grade || ''}
                                onChange={(e) => setFeedbackData(prev => ({
                                  ...prev,
                                  [card.id]: { ...prev[card.id], actual_psa_grade: e.target.value }
                                }))}
                                className="bg-[#0a0a0a] border-[#27272a] text-white flex-1"
                              />
                              <Input
                                placeholder="Cert # (opcional)"
                                value={feedbackData[card.id]?.psa_cert_number || ''}
                                onChange={(e) => setFeedbackData(prev => ({
                                  ...prev,
                                  [card.id]: { ...prev[card.id], psa_cert_number: e.target.value }
                                }))}
                                className="bg-[#0a0a0a] border-[#27272a] text-white w-32"
                              />
                            </div>
                            <Button
                              onClick={() => submitFeedback(card.id)}
                              disabled={!feedbackData[card.id]?.actual_psa_grade}
                              className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Guardar Resultado PSA
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Learning History */}
      {history.length > 0 && (
        <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#27272a] flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#22c55e]" />
            <h4 className="text-sm font-heading uppercase tracking-wider text-white">
              Historial de Aprendizaje
            </h4>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="p-3 space-y-2">
              {history.map((card) => (
                <div 
                  key={card.id} 
                  className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg"
                >
                  <div className="w-10 h-14 bg-[#1e1e1e] rounded overflow-hidden flex-shrink-0">
                    {card.front_image_preview && (
                      <img
                        src={`data:image/jpeg;base64,${card.front_image_preview}`}
                        alt="Card"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {card.card_name || 'Tarjeta'}
                    </p>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span className="text-gray-500">Predicción:</span>
                      <span style={{ color: getGradeColor(card.grading_result?.overall_grade) }}>
                        {card.grading_result?.overall_grade?.toFixed(1)}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-500">PSA:</span>
                      <span style={{ color: getGradeColor(card.actual_psa_grade) }}>
                        {card.actual_psa_grade}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div 
                      className="flex items-center gap-1"
                      style={{ color: getDifferenceColor(card.difference) }}
                    >
                      {card.accurate ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : card.difference > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="text-sm font-mono">
                        {card.difference > 0 ? '+' : ''}{card.difference}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      {card.accurate ? 'Precisa' : card.difference > 0 ? 'Alta' : 'Baja'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty State */}
      {stats?.total_graded === 0 && pendingCards.length === 0 && (
        <div className="text-center py-8">
          <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">El sistema de aprendizaje está listo</p>
          <p className="text-xs text-gray-600 mt-1">
            Analiza tarjetas y luego ingresa los resultados reales de PSA para entrenar el sistema
          </p>
        </div>
      )}
    </div>
  );
};

export default LearningPanel;
