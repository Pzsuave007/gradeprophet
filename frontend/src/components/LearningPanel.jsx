import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Target, CheckCircle, ChevronDown, ChevronUp, Save, Package, Trash2 } from 'lucide-react';
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
      const [statsRes, cardsRes, historyRes] = await Promise.all([
        fetch(`${API}/learning/stats`), fetch(`${API}/cards/history`), fetch(`${API}/learning/history`)
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (cardsRes.ok) { const cards = await cardsRes.json(); setPendingCards(cards.filter(c => !c.actual_psa_grade)); }
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [API]);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

  const submitFeedback = async (cardId) => {
    const data = feedbackData[cardId];
    if (!data?.actual_psa_grade) return;
    try {
      const r = await fetch(`${API}/cards/${cardId}/feedback`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_psa_grade: parseFloat(data.actual_psa_grade), psa_cert_number: data.psa_cert_number || null, status: 'graded' }) });
      if (r.ok) { fetchData(); setExpandedCard(null); setFeedbackData(prev => { const n = { ...prev }; delete n[cardId]; return n; }); }
    } catch (err) { console.error(err); }
  };

  const updateCardStatus = async (cardId, status) => {
    try { await fetch(`${API}/cards/${cardId}/status?status=${status}`, { method: 'PUT' }); fetchData(); } catch (err) { console.error(err); }
  };

  const deleteCard = async (cardId, e) => {
    e.stopPropagation();
    if (!window.confirm('Eliminar análisis?')) return;
    try {
      const r = await fetch(`${API}/cards/${cardId}`, { method: 'DELETE' });
      if (r.ok) { setPendingCards(prev => prev.filter(c => c.id !== cardId)); const s = await fetch(`${API}/learning/stats`); if (s.ok) setStats(await s.json()); }
    } catch (err) { console.error(err); }
  };

  const getGradeColor = (g) => { if (g >= 9) return '#22c55e'; if (g >= 7) return '#3b82f6'; if (g >= 5) return '#eab308'; return '#ef4444'; };
  const getDifferenceColor = (d) => { if (Math.abs(d) <= 0.5) return '#22c55e'; if (Math.abs(d) <= 1) return '#eab308'; return '#ef4444'; };

  if (loading) return <div className="flex items-center justify-center py-12"><Brain className="w-6 h-6 text-[#3b82f6] animate-pulse" /></div>;

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* LEFT: Stats + History */}
      <div className="lg:col-span-2 space-y-3">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-white">{stats.total_analyzed}</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Analizadas</p>
            </div>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-[#3b82f6]">{stats.total_graded}</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Con Feedback</p>
            </div>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-[#22c55e]">{stats.accuracy_rate}%</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Precisión</p>
            </div>
            <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-[#eab308]">±{stats.average_difference}</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Dif. Promedio</p>
            </div>
          </div>
        )}

        {/* Accuracy Breakdown */}
        {stats && stats.total_graded > 0 && (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-2">Tendencia</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#22c55e]" />
                <span className="text-sm font-bold text-[#22c55e]">{stats.predictions_accurate}</span>
                <span className="text-[10px] text-gray-600">Precisas (±0.5)</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#eab308]" />
                <span className="text-sm font-bold text-[#eab308]">{stats.predictions_high}</span>
                <span className="text-[10px] text-gray-600">Muy Altas</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[#3b82f6]" />
                <span className="text-sm font-bold text-[#3b82f6]">{stats.predictions_low}</span>
                <span className="text-[10px] text-gray-600">Muy Bajas</span>
              </div>
            </div>
          </div>
        )}

        {/* Learning History */}
        {history.length > 0 && (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-[#22c55e]" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">Historial</span>
            </div>
            <ScrollArea className="max-h-[250px]">
              <div className="divide-y divide-[#1a1a1a]">
                {history.map((card) => (
                  <div key={card.id} className="flex items-center gap-2 p-2.5">
                    <div className="w-8 h-10 bg-[#0a0a0a] rounded overflow-hidden flex-shrink-0">
                      {card.front_image_preview && <img src={`data:image/jpeg;base64,${card.front_image_preview}`} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white truncate">{card.card_name || 'Tarjeta'}</p>
                      <div className="flex items-center gap-1 text-[10px] mt-0.5">
                        <span style={{ color: getGradeColor(card.grading_result?.overall_grade) }}>{card.grading_result?.overall_grade?.toFixed(1)}</span>
                        <span className="text-gray-700">→</span>
                        <span style={{ color: getGradeColor(card.actual_psa_grade) }}>{card.actual_psa_grade}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" style={{ color: getDifferenceColor(card.difference) }}>
                      {card.accurate ? <CheckCircle className="w-3 h-3" /> : card.difference > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="text-xs font-mono">{card.difference > 0 ? '+' : ''}{card.difference}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* RIGHT: Pending Cards */}
      <div className="lg:col-span-3 space-y-3">
        {pendingCards.length > 0 ? (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#eab308]" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">Esperando Resultados PSA ({pendingCards.length})</span>
            </div>
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-[#1a1a1a]">
                {pendingCards.map((card) => (
                  <div key={card.id} className="bg-[#0a0a0a]/50">
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}>
                      <div className="w-10 h-14 bg-[#0a0a0a] rounded overflow-hidden flex-shrink-0">
                        {card.front_image_preview && <img src={`data:image/jpeg;base64,${card.front_image_preview}`} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{card.card_name || 'Tarjeta sin nombre'}</p>
                        <p className="text-[10px] text-gray-600">
                          Predicción: <span style={{ color: getGradeColor(card.grading_result?.overall_grade) }}>{card.grading_result?.overall_grade?.toFixed(1)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={(e) => deleteCard(card.id, e)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3 h-3 text-red-400" /></button>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${card.status === 'sent_to_psa' ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#1a1a1a] text-gray-500'}`}>
                          {card.status === 'sent_to_psa' ? 'Enviada' : 'Pendiente'}
                        </span>
                        {expandedCard === card.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
                      </div>
                    </div>
                    <AnimatePresence>
                      {expandedCard === card.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="px-3 pb-3 space-y-2 border-t border-[#1a1a1a] pt-2">
                            {card.status !== 'sent_to_psa' && (
                              <Button variant="outline" size="sm" onClick={() => updateCardStatus(card.id, 'sent_to_psa')}
                                className="w-full border-[#3b82f6]/50 text-[#3b82f6] h-7 text-xs">
                                <Package className="w-3 h-3 mr-1" />Marcar Enviada a PSA
                              </Button>
                            )}
                            <p className="text-[10px] text-gray-600">¿Ya recibiste el grado? Ingresa el resultado:</p>
                            <div className="flex gap-1.5">
                              <Input type="number" step="0.5" min="1" max="10" placeholder="Grado (1-10)"
                                value={feedbackData[card.id]?.actual_psa_grade || ''}
                                onChange={(e) => setFeedbackData(prev => ({ ...prev, [card.id]: { ...prev[card.id], actual_psa_grade: e.target.value } }))}
                                className="bg-[#0a0a0a] border-[#1a1a1a] text-white flex-1 h-7 text-xs" />
                              <Input placeholder="Cert #" value={feedbackData[card.id]?.psa_cert_number || ''}
                                onChange={(e) => setFeedbackData(prev => ({ ...prev, [card.id]: { ...prev[card.id], psa_cert_number: e.target.value } }))}
                                className="bg-[#0a0a0a] border-[#1a1a1a] text-white w-24 h-7 text-xs" />
                            </div>
                            <Button onClick={() => submitFeedback(card.id)} disabled={!feedbackData[card.id]?.actual_psa_grade}
                              className="w-full bg-[#22c55e] hover:bg-[#16a34a] h-7 text-xs">
                              <Save className="w-3 h-3 mr-1" />Guardar Resultado
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-12 bg-[#111] border border-[#1a1a1a] rounded-lg">
            <Brain className="w-8 h-8 text-gray-800 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Sin tarjetas pendientes</p>
            <p className="text-gray-700 text-xs mt-1">Analiza tarjetas y ingresa resultados PSA para entrenar el sistema</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningPanel;
