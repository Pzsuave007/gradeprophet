import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  Target,
  Box,
  Layers,
  CornerDownRight,
  FlipHorizontal,
  Trash2,
  Package,
  Save,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';

const GradeDisplay = ({ score, label, icon: Icon, issues }) => {
  const getGradeColor = (grade) => {
    if (grade >= 9) return '#22c55e';
    if (grade >= 7) return '#3b82f6';
    if (grade >= 5) return '#eab308';
    return '#ef4444';
  };

  const color = getGradeColor(score);

  return (
    <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4 hover:border-[#3b82f6]/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400 uppercase tracking-wider font-heading">{label}</span>
        </div>
        <span 
          className="font-mono text-2xl font-bold"
          style={{ color }}
        >
          {score.toFixed(1)}
        </span>
      </div>
      <Progress 
        value={score * 10} 
        className="h-2 mb-2"
        style={{ '--progress-color': color }}
      />
      {issues && issues.length > 0 && (
        <div className="mt-3 space-y-1">
          {issues.map((issue, idx) => (
            <p key={idx} className="text-xs text-gray-500 flex items-start gap-1">
              <span className="text-red-400">•</span>
              {issue}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const AnalysisResult = ({ analysis, frontImage, backImage, onNewAnalysis, onDelete, onRefresh }) => {
  const { grading_result } = analysis;
  const [activeTab, setActiveTab] = useState('front');
  const [showFeedback, setShowFeedback] = useState(false);
  const [actualGrade, setActualGrade] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const hasBothSides = frontImage && backImage;
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;
  
  const getOverallGradeColor = (grade) => {
    if (grade >= 9.5) return { color: '#eab308', label: 'GEM MINT' };
    if (grade >= 9) return { color: '#22c55e', label: 'MINT' };
    if (grade >= 8) return { color: '#22c55e', label: 'NM-MT' };
    if (grade >= 7) return { color: '#3b82f6', label: 'NM' };
    if (grade >= 6) return { color: '#3b82f6', label: 'EX-MT' };
    if (grade >= 5) return { color: '#94a3b8', label: 'EX' };
    if (grade >= 4) return { color: '#94a3b8', label: 'VG-EX' };
    return { color: '#ef4444', label: 'FAIR-GOOD' };
  };

  const gradeInfo = getOverallGradeColor(grading_result.overall_grade);

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este análisis?')) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${API}/cards/${analysis.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        onDelete?.();
        onNewAnalysis();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkSent = async () => {
    try {
      await fetch(`${API}/cards/${analysis.id}/status?status=sent_to_psa`, {
        method: 'PUT'
      });
      onRefresh?.();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!actualGrade) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API}/cards/${analysis.id}/feedback`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_psa_grade: parseFloat(actualGrade),
          psa_cert_number: certNumber || null,
          status: 'graded'
        })
      });
      
      if (response.ok) {
        setShowFeedback(false);
        onRefresh?.();
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSaving(false);
    }
  };

  // Check if this card already has feedback
  const hasActualGrade = analysis.actual_psa_grade !== null && analysis.actual_psa_grade !== undefined;
  const isSentToPSA = analysis.status === 'sent_to_psa';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with Overall Grade */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Card Images */}
        <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
          {hasBothSides ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-[#0a0a0a] rounded-none border-b border-[#27272a]">
                <TabsTrigger 
                  value="front" 
                  className="rounded-none data-[state=active]:bg-[#121212] data-[state=active]:text-white font-heading uppercase tracking-wider text-sm"
                >
                  Frente
                </TabsTrigger>
                <TabsTrigger 
                  value="back"
                  className="rounded-none data-[state=active]:bg-[#121212] data-[state=active]:text-white font-heading uppercase tracking-wider text-sm"
                >
                  Dorso
                </TabsTrigger>
              </TabsList>
              <TabsContent value="front" className="mt-0">
                <div className="aspect-[3/4] relative">
                  <img
                    src={frontImage}
                    alt="Card front"
                    className="w-full h-full object-contain"
                    data-testid="result-front-image"
                  />
                </div>
              </TabsContent>
              <TabsContent value="back" className="mt-0">
                <div className="aspect-[3/4] relative">
                  <img
                    src={backImage}
                    alt="Card back"
                    className="w-full h-full object-contain"
                    data-testid="result-back-image"
                  />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="aspect-[3/4] relative">
              <img
                src={frontImage}
                alt="Analyzed card"
                className="w-full h-full object-contain"
                data-testid="result-card-image"
              />
            </div>
          )}
          {grading_result.card_info && (
            <div className="p-4 border-t border-[#27272a]">
              <p className="font-heading text-lg font-semibold text-white uppercase">
                {grading_result.card_info}
              </p>
            </div>
          )}
        </div>

        {/* Overall Grade */}
        <div className="space-y-4">
          <div 
            className="bg-[#121212] border border-[#27272a] rounded-lg p-6 text-center"
            style={{ borderColor: `${gradeInfo.color}30` }}
          >
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-2">
              Grado PSA Estimado
            </p>
            <div 
              className="text-7xl font-heading font-black mb-2"
              style={{ color: gradeInfo.color }}
              data-testid="overall-grade"
            >
              {grading_result.overall_grade.toFixed(1)}
            </div>
            <p 
              className="text-lg font-heading uppercase tracking-wider"
              style={{ color: gradeInfo.color }}
            >
              {gradeInfo.label}
            </p>
            {hasBothSides && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                <FlipHorizontal className="w-4 h-4" />
                <span>Análisis de ambos lados</span>
              </div>
            )}
          </div>

          {/* Actual PSA Grade (if has feedback) */}
          {hasActualGrade && (
            <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Grado Real PSA</p>
              <p className="text-4xl font-heading font-black text-[#22c55e]">
                {analysis.actual_psa_grade}
              </p>
              {analysis.psa_cert_number && (
                <p className="text-xs text-gray-500 mt-1">Cert: {analysis.psa_cert_number}</p>
              )}
              <div className="mt-2 text-xs">
                {Math.abs(grading_result.overall_grade - analysis.actual_psa_grade) <= 0.5 ? (
                  <span className="text-[#22c55e]">✓ Predicción precisa</span>
                ) : grading_result.overall_grade > analysis.actual_psa_grade ? (
                  <span className="text-[#eab308]">↑ Predijimos más alto</span>
                ) : (
                  <span className="text-[#3b82f6]">↓ Predijimos más bajo</span>
                )}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className={`
            p-4 rounded-lg flex items-center gap-4
            ${grading_result.send_to_psa 
              ? 'bg-green-500/10 border border-green-500/30' 
              : 'bg-red-500/10 border border-red-500/30'
            }
          `}>
            {grading_result.send_to_psa ? (
              <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            )}
            <div>
              <p className={`font-semibold ${grading_result.send_to_psa ? 'text-green-400' : 'text-red-400'}`}>
                {grading_result.send_to_psa ? '¡Recomendado enviar a PSA!' : 'No recomendado para PSA'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {grading_result.psa_recommendation}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-grades Grid */}
      <div>
        <h3 className="font-heading text-xl font-semibold uppercase tracking-wider text-white mb-4">
          Desglose de Grados
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GradeDisplay 
            score={grading_result.centering.score} 
            label="Centrado" 
            icon={Target}
            issues={grading_result.centering.issues}
          />
          <GradeDisplay 
            score={grading_result.corners.score} 
            label="Esquinas" 
            icon={CornerDownRight}
            issues={grading_result.corners.issues}
          />
          <GradeDisplay 
            score={grading_result.surface.score} 
            label="Superficie" 
            icon={Layers}
            issues={grading_result.surface.issues}
          />
          <GradeDisplay 
            score={grading_result.edges.score} 
            label="Bordes" 
            icon={Box}
            issues={grading_result.edges.issues}
          />
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="bg-[#121212] border border-[#27272a] rounded-lg p-6">
        <h3 className="font-heading text-lg font-semibold uppercase tracking-wider text-white mb-3">
          Resumen del Análisis
        </h3>
        <p className="text-gray-300 leading-relaxed" data-testid="analysis-summary">
          {grading_result.analysis_summary}
        </p>
      </div>

      {/* Feedback Section - For entering actual PSA grade */}
      {!hasActualGrade && (
        <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="w-full p-4 flex items-center justify-between hover:bg-[#1e1e1e] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-[#eab308]" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">
                  {isSentToPSA ? '¿Ya recibiste el grado?' : '¿Vas a enviar esta tarjeta?'}
                </p>
                <p className="text-xs text-gray-500">
                  {isSentToPSA ? 'Ingresa el resultado para que el sistema aprenda' : 'Marca como enviada o ingresa el resultado'}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              isSentToPSA 
                ? 'bg-[#3b82f6]/20 text-[#3b82f6]' 
                : 'bg-[#27272a] text-gray-400'
            }`}>
              {isSentToPSA ? 'Enviada a PSA' : 'Pendiente'}
            </span>
          </button>
          
          {showFeedback && (
            <div className="p-4 border-t border-[#27272a] space-y-4">
              {!isSentToPSA && (
                <Button
                  variant="outline"
                  onClick={handleMarkSent}
                  className="w-full border-[#3b82f6]/50 text-[#3b82f6] hover:bg-[#3b82f6]/10"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Marcar como Enviada a PSA
                </Button>
              )}
              
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Ingresa el grado real cuando lo recibas:</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    placeholder="Grado PSA (1-10)"
                    value={actualGrade}
                    onChange={(e) => setActualGrade(e.target.value)}
                    className="bg-[#0a0a0a] border-[#27272a] text-white flex-1"
                  />
                  <Input
                    placeholder="Cert # (opcional)"
                    value={certNumber}
                    onChange={(e) => setCertNumber(e.target.value)}
                    className="bg-[#0a0a0a] border-[#27272a] text-white sm:w-32"
                  />
                </div>
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={!actualGrade || saving}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Resultado PSA'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={deleting}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          data-testid="delete-analysis-btn"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {deleting ? 'Eliminando...' : 'Eliminar Análisis'}
        </Button>
        <Button
          onClick={onNewAnalysis}
          className="flex-1 h-12 bg-white text-black hover:bg-gray-200 font-semibold uppercase tracking-wider"
          data-testid="new-analysis-btn"
        >
          Analizar Otra Tarjeta
        </Button>
      </div>
    </motion.div>
  );
};

export default AnalysisResult;
