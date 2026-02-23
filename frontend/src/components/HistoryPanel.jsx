import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Trash2, 
  ChevronRight, 
  AlertCircle,
  RefreshCw,
  FlipHorizontal,
  ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';

const HistoryPanel = ({ onSelectCard, refreshTrigger }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API}/cards/history`);
      if (!response.ok) throw new Error('Error al cargar historial');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const deleteCard = async (cardId, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API}/cards/${cardId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar');
      setHistory(prev => prev.filter(card => card.id !== cardId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getGradeColor = (grade) => {
    if (grade >= 9) return '#22c55e';
    if (grade >= 7) return '#3b82f6';
    if (grade >= 5) return '#eab308';
    return '#ef4444';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{error}</p>
        <Button 
          variant="ghost" 
          onClick={fetchHistory}
          className="mt-3 text-[#3b82f6]"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-8 h-8 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No hay análisis previos</p>
        <p className="text-gray-600 text-xs mt-1">Tus tarjetas analizadas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 pr-4">
        <AnimatePresence>
          {history.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectCard(card)}
              className="group flex items-center gap-3 p-3 bg-[#121212] border border-[#27272a] rounded-lg cursor-pointer hover:border-[#3b82f6]/30 transition-all"
              data-testid={`history-card-${card.id}`}
            >
              {/* Thumbnail */}
              <div className="w-12 h-16 bg-[#1e1e1e] rounded overflow-hidden flex-shrink-0 relative">
                {card.front_image_preview && (
                  <img
                    src={`data:image/jpeg;base64,${card.front_image_preview}`}
                    alt="Card thumbnail"
                    className="w-full h-full object-cover"
                  />
                )}
                {card.back_image_preview && (
                  <div className="absolute bottom-0 right-0 bg-[#3b82f6] p-0.5 rounded-tl">
                    <FlipHorizontal className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {card.card_name || 'Tarjeta sin identificar'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-gray-500">
                    {formatDate(card.created_at)}
                  </p>
                  {card.ebay_url && (
                    <a 
                      href={card.ebay_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#3b82f6] hover:text-[#60a5fa]"
                      title="Ver en eBay"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Grade */}
              <div className="flex items-center gap-2">
                <span 
                  className="font-mono text-lg font-bold"
                  style={{ color: getGradeColor(card.grading_result.overall_grade) }}
                >
                  {card.grading_result.overall_grade.toFixed(1)}
                </span>
                
                {/* Delete button */}
                <button
                  onClick={(e) => deleteCard(card.id, e)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                  data-testid={`delete-card-${card.id}`}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>

                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#3b82f6] transition-colors" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
};

export default HistoryPanel;
