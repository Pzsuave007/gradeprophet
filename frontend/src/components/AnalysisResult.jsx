import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  DollarSign,
  Target,
  Box,
  Layers,
  CornerDownRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

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

const AnalysisResult = ({ analysis, originalImage, onNewAnalysis }) => {
  const { grading_result } = analysis;
  
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with Overall Grade */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Card Image */}
        <div className="bg-[#121212] border border-[#27272a] rounded-lg overflow-hidden">
          <div className="aspect-[3/4] relative">
            <img
              src={originalImage}
              alt="Analyzed card"
              className="w-full h-full object-contain"
              data-testid="result-card-image"
            />
          </div>
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
          </div>

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

          {/* Value Estimates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">Valor Raw</span>
              </div>
              <p className="font-mono text-xl text-white" data-testid="raw-value">
                {grading_result.estimated_raw_value}
              </p>
            </div>
            <div className="bg-[#121212] border border-[#27272a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">Valor Graded</span>
              </div>
              <p className="font-mono text-xl text-[#22c55e]" data-testid="graded-value">
                {grading_result.estimated_graded_value}
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
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
