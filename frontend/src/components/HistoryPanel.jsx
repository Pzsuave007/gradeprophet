import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2, ChevronRight, AlertCircle, RefreshCw, FlipHorizontal } from 'lucide-react';
import { Button } from '../components/ui/button';

const HistoryPanel = ({ onSelectCard, refreshTrigger }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const fetchHistory = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/cards/history`);
      if (!r.ok) throw new Error('Error al cargar');
      setHistory(await r.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, [refreshTrigger]);

  const deleteCard = async (cardId, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/cards/${cardId}`, { method: 'DELETE' });
      if (r.ok) setHistory(prev => prev.filter(c => c.id !== cardId));
    } catch (err) { console.error(err); }
  };

  const getGradeColor = (grade) => {
    if (grade >= 9) return '#22c55e';
    if (grade >= 7) return '#3b82f6';
    if (grade >= 5) return '#eab308';
    return '#ef4444';
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 text-gray-600 animate-spin" /></div>;
  if (error) return <div className="text-center py-12"><AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" /><p className="text-gray-500 text-sm">{error}</p><Button variant="ghost" onClick={fetchHistory} className="mt-2 text-[#3b82f6] text-xs">Reintentar</Button></div>;
  if (history.length === 0) return <div className="text-center py-12"><Clock className="w-6 h-6 text-gray-700 mx-auto mb-2" /><p className="text-gray-600 text-sm">No hay análisis previos</p></div>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <AnimatePresence>
        {history.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectCard(card)}
            className="group bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden cursor-pointer hover:border-[#3b82f6]/30 transition-all"
            data-testid={`history-card-${card.id}`}
          >
            {/* Card Image */}
            <div className="relative aspect-[4/3] bg-[#0a0a0a]">
              {card.front_image_preview ? (
                <img src={`data:image/jpeg;base64,${card.front_image_preview}`} alt="Card" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Clock className="w-8 h-8 text-gray-800" /></div>
              )}
              {card.back_image_preview && (
                <div className="absolute top-1.5 right-1.5 bg-[#3b82f6] p-1 rounded"><FlipHorizontal className="w-2.5 h-2.5 text-white" /></div>
              )}
              {/* Grade Badge */}
              <div className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded font-mono text-sm font-bold"
                style={{ backgroundColor: `${getGradeColor(card.grading_result.overall_grade)}22`, color: getGradeColor(card.grading_result.overall_grade), border: `1px solid ${getGradeColor(card.grading_result.overall_grade)}44` }}>
                {card.grading_result.overall_grade.toFixed(1)}
              </div>
              {/* Delete */}
              <button onClick={(e) => deleteCard(card.id, e)}
                className="absolute top-1.5 left-1.5 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-red-500/60 transition-all" data-testid={`delete-card-${card.id}`}>
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>
            {/* Card Info */}
            <div className="p-2.5">
              <p className="text-xs text-white font-medium truncate">{card.card_name || 'Tarjeta sin identificar'}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{formatDate(card.created_at)}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default HistoryPanel;
