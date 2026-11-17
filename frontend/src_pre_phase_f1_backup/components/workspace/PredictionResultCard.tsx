import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Database,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { PredictionResponse } from '../../types/index.ts';
import { Card } from '../common/Card.tsx';

interface PredictionResultCardProps {
  result: PredictionResponse;
  onViewHistory?: (recordId: number) => void;
}

export function PredictionResultCard({ result, onViewHistory }: PredictionResultCardProps) {
  const [showRaw, setShowRaw] = useState(false);
  const pred = result.prediction;

  // Formatting class labels (e.g. Tomato___Early_blight -> Early Blight)
  const formatLabel = (label: string): string => {
    return label
      .replace(/^Tomato___/i, '')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return (
    <Card variant="white" className="mt-6 border-forest-300 shadow-md">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-sage-200 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-forest-100 flex items-center justify-center text-forest-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sage-600 block">
              Inference Output
            </span>
            <h3 className="font-display font-bold text-base text-forest-950">
              {result.task}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <code className="text-[11px] font-mono bg-sage-100 text-sage-800 px-2 py-0.5 rounded border border-sage-200">
            {result.model_id}
          </code>
          {result.record_id && (
            <button
              type="button"
              onClick={() => onViewHistory && onViewHistory(result.record_id!)}
              className="text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Saved #{result.record_id}
            </button>
          )}
        </div>
      </div>

      {/* Main Result Body */}
      <div className="py-5">
        
        {/* Case 1: Image Models (predicted_class, confidence, class_probabilities) */}
        {pred.predicted_class !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-sage-600 font-medium">Top Diagnosis</span>
              {pred.confidence !== undefined && (
                <span className="text-xs font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded border border-forest-200">
                  Confidence: {(pred.confidence * 100).toFixed(1)}%
                </span>
              )}
            </div>

            <div className="text-2xl font-display font-extrabold text-charcoal-900 mb-4 tracking-tight">
              {formatLabel(String(pred.predicted_class))}
            </div>

            {/* Confidence Progress Bar */}
            {pred.confidence !== undefined && (
              <div className="w-full bg-sage-100 rounded-full h-2 mb-6 overflow-hidden">
                <div
                  className="bg-forest-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, pred.confidence * 100))}%` }}
                />
              </div>
            )}

            {/* Alternative Class Probabilities */}
            {pred.class_probabilities && Object.keys(pred.class_probabilities).length > 0 && (
              <div className="bg-cream-50/80 rounded-xl p-4 border border-sage-200 mb-4">
                <p className="text-xs font-bold text-charcoal-800 mb-2.5 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-forest-700" />
                  <span>Softmax Probability Distribution:</span>
                </p>
                <div className="space-y-2">
                  {Object.entries(pred.class_probabilities as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([cls, prob]) => (
                      <div key={cls} className="text-xs">
                        <div className="flex justify-between text-charcoal-700 mb-0.5">
                          <span className="truncate pr-2">{formatLabel(cls)}</span>
                          <span className="font-mono text-sage-600 shrink-0">
                            {(prob * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-sage-200/70 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-forest-500 h-1 rounded-full"
                            style={{ width: `${Math.max(1, prob * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Case 2: Crop Recommendation (recommended_crop, top_alternatives) */}
        {pred.recommended_crop !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-sage-600 font-medium">Recommended Crop</span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Optimal Soil Envelope
              </span>
            </div>
            <div className="text-3xl font-display font-extrabold text-forest-800 mb-4 capitalize">
              {pred.recommended_crop}
            </div>

            {pred.top_alternatives && (
              <div className="bg-cream-50/80 rounded-xl p-4 border border-sage-200 mb-4">
                <p className="text-xs font-bold text-charcoal-800 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ranked Alternative Crops:</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(pred.top_alternatives as Record<string, number>).map(
                    ([crop, prob]) => (
                      <div
                        key={crop}
                        className="bg-white rounded-lg p-2 border border-sage-200 text-xs flex justify-between items-center"
                      >
                        <span className="capitalize font-medium text-charcoal-800">{crop}</span>
                        <span className="font-mono text-[11px] text-sage-600">
                          {(prob * 100).toFixed(0)}%
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Case 3: Regional Yield (predicted_yield, unit) */}
        {pred.predicted_yield !== undefined && (
          <div>
            <span className="text-xs text-sage-600 font-medium block mb-1">
              Estimated Crop Yield
            </span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-display font-extrabold text-forest-800">
                {Number(pred.predicted_yield).toFixed(3)}
              </span>
              <span className="text-xs text-sage-700 font-medium">
                {pred.unit || 'tonnes/ha'}
              </span>
            </div>
            <p className="text-xs text-charcoal-600 bg-forest-50 p-3 rounded-xl border border-forest-100">
              Regional aggregate estimate based on division weather anomalies and seasonal NDVI integration.
            </p>
          </div>
        )}

        {/* Case 4: Flood Susceptibility (susceptibility_category, susceptibility_probability) */}
        {pred.susceptibility_category !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-sage-600 font-medium">Flood Vulnerability Classification</span>
              {pred.susceptibility_probability !== undefined && (
                <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  Risk Prob: {(pred.susceptibility_probability * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <div
              className={`text-2xl font-display font-extrabold mb-3 ${
                pred.predicted_label === 1 ? 'text-amber-700' : 'text-forest-700'
              }`}
            >
              {pred.susceptibility_category}
            </div>
            <p className="text-xs text-charcoal-600 bg-sky-50/60 p-3 rounded-xl border border-sky-100">
              Evaluated with topographic elevation, river distance, drainage density, slope, and landcover parameters.
            </p>
          </div>
        )}

        {/* Case 5: Market Price (recommended_price, baseline_price, ml_forecast) */}
        {pred.recommended_price !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-sage-600 font-medium">Recommended Wholesale Price</span>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Empirical Baseline Priority
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-display font-extrabold text-charcoal-900">
                {Number(pred.recommended_price).toFixed(2)}
              </span>
              <span className="text-xs font-bold text-forest-700">BDT/kg (Wholesale)</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
                <span className="text-[11px] font-semibold text-amber-900 block mb-0.5">
                  Last-Price Baseline:
                </span>
                <span className="text-lg font-bold text-amber-950">
                  {Number(pred.baseline_price).toFixed(2)} BDT/kg
                </span>
                <span className="text-[10px] text-amber-800 block mt-1">
                  Empirical Benchmark (Lower MAE)
                </span>
              </div>
              <div className="bg-sage-50/70 p-3 rounded-xl border border-sage-200/80">
                <span className="text-[11px] font-semibold text-charcoal-800 block mb-0.5">
                  Machine Learning Regressor:
                </span>
                <span className="text-lg font-bold text-charcoal-900">
                  {Number(pred.ml_forecast).toFixed(2)} BDT/kg
                </span>
                <span className="text-[10px] text-sage-600 block mt-1">
                  Secondary Reference Model
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Scientific Caveat Warning */}
      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Scientific Caveat: </span>
          <span>{result.caveat || pred.caveat}</span>
        </div>
      </div>

      {/* Raw JSON Inspection Accordion */}
      <div className="pt-3 border-t border-sage-200">
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs font-medium text-sage-600 hover:text-forest-700 flex items-center gap-1 cursor-pointer"
        >
          <Database className="w-3.5 h-3.5" />
          <span>{showRaw ? 'Hide Raw JSON Response' : 'Inspect Raw JSON Response'}</span>
          {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showRaw && (
          <pre className="mt-3 p-3 bg-charcoal-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}
