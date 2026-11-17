import { useState, useEffect, type FormEvent } from 'react';
import { Layers, Sparkles, RefreshCw, AlertCircle, Play, Building2, Sliders } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { Button } from '../../common/Button.tsx';
import { Input } from '../../common/Input.tsx';
import { PredictionResultCard } from '../PredictionResultCard.tsx';
import { FarmCropRecommendationPanel } from './FarmCropRecommendationPanel.tsx';

import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface CropRecommendationToolProps {
  initialFarmId?: number | null;
  onViewHistory?: (recordId: number) => void;
  onNavigateToTab?: (tab: WorkspaceTab, arg?: string, extraId?: number) => void;
}

export function CropRecommendationTool({
  initialFarmId,
  onViewHistory,
  onNavigateToTab,
}: CropRecommendationToolProps) {
  const { t } = useLanguage();
  const [activeSubMode, setActiveSubMode] = useState<'farm_aware' | 'general_presets'>('farm_aware');

  useEffect(() => {
    if (initialFarmId) {
      setActiveSubMode('farm_aware');
    }
  }, [initialFarmId]);

  // General Preset Form State
  const [formData, setFormData] = useState({
    N: '90',
    P: '42',
    K: '43',
    temperature: '20.8',
    humidity: '82.0',
    ph: '6.5',
    rainfall: '202.9',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  const presets = [
    {
      name: 'Rice Delta Preset',
      data: { N: '90', P: '42', K: '43', temperature: '23.6', humidity: '80.3', ph: '6.5', rainfall: '220.5' },
    },
    {
      name: 'Jute Floodplain',
      data: { N: '78', P: '46', K: '40', temperature: '25.0', humidity: '79.5', ph: '6.7', rainfall: '175.0' },
    },
    {
      name: 'Winter Maize',
      data: { N: '80', P: '48', K: '20', temperature: '22.0', humidity: '65.0', ph: '6.2', rainfall: '70.0' },
    },
    {
      name: 'Chickpea / Pulses',
      data: { N: '40', P: '65', K: '80', temperature: '18.5', humidity: '55.0', ph: '7.1', rainfall: '65.0' },
    },
  ];

  const handleApplyPreset = (data: typeof formData) => {
    setFormData(data);
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: Record<string, number> = {};
    for (const [key, val] of Object.entries(formData)) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        setError(`Feature '${key}' must be a valid number.`);
        setIsSubmitting(false);
        return;
      }
      payload[key] = num;
    }

    try {
      const res = await predictionApi.predict('crop_recommendation', { data: payload });
      setResult(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      N: '90',
      P: '42',
      K: '43',
      temperature: '20.8',
      humidity: '82.0',
      ph: '6.5',
      rainfall: '202.9',
    });
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Mode Segmented Controls */}
      <div className="flex items-center justify-between p-1.5 rounded-2xl bg-forest-950 border border-forest-800 shadow-xs max-w-md">
        <button
          type="button"
          data-testid="mode-farm-aware-btn"
          onClick={() => setActiveSubMode('farm_aware')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubMode === 'farm_aware'
              ? 'bg-forest-800 text-gold-300 border border-gold-400/40 shadow-xs'
              : 'text-sage-400 hover:text-cream-100 hover:bg-forest-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-gold-400" />
          <span className="font-bengali">{t('খামারভিত্তিক বিশ্লেষণ', 'Farm-Aware Analysis')}</span>
        </button>

        <button
          type="button"
          data-testid="mode-general-presets-btn"
          onClick={() => setActiveSubMode('general_presets')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeSubMode === 'general_presets'
              ? 'bg-forest-800 text-gold-300 border border-gold-400/40 shadow-xs'
              : 'text-sage-400 hover:text-cream-100 hover:bg-forest-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-sage-400" />
          <span className="font-bengali">{t('সাধারণ প্রিসেট কনসোল', 'General Presets')}</span>
        </button>
      </div>

      {/* Render Active Sub-Mode */}
      {activeSubMode === 'farm_aware' ? (
        <FarmCropRecommendationPanel
          initialFarmId={initialFarmId}
          onViewHistory={onViewHistory}
          onNavigateToTab={onNavigateToTab}
        />
      ) : (
        /* Legacy / General Research Console */
        <div className="space-y-6">
          {/* Tool Header */}
          <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-charcoal-900">
                  Precision Crop Recommendation Engine (General Research)
                </h2>
                <p className="text-xs text-sage-600">
                  Model: <code className="font-mono text-forest-800">crop_recommendation</code> • Multi-Class Pipeline (Scikit-Learn 1.6)
                </p>
              </div>
            </div>
            <p className="text-xs text-charcoal-700 mt-2 leading-relaxed">
              Evaluates soil macro-nutrients (N, P, K) and environmental parameters to identify the most suitable target crop across 22 benchmark cultivars.
            </p>
          </div>

          {/* Preset Selectors */}
          <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-sage-100">
              <span className="text-xs font-semibold text-charcoal-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-forest-600" />
                Agronomic Presets:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p.data)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-sage-50 text-sage-800 border border-sage-200 hover:bg-forest-50 hover:text-forest-900 hover:border-forest-300 transition-colors cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Nitrogen (N) ratio"
                  type="number"
                  step="any"
                  value={formData.N}
                  onChange={(e) => setFormData({ ...formData, N: e.target.value })}
                  placeholder="e.g. 90"
                  required
                  helperText="Soil Nitrogen content (0 - 140)"
                />
                <Input
                  label="Phosphorus (P) ratio"
                  type="number"
                  step="any"
                  value={formData.P}
                  onChange={(e) => setFormData({ ...formData, P: e.target.value })}
                  placeholder="e.g. 42"
                  required
                  helperText="Soil Phosphorus content (5 - 145)"
                />
                <Input
                  label="Potassium (K) ratio"
                  type="number"
                  step="any"
                  value={formData.K}
                  onChange={(e) => setFormData({ ...formData, K: e.target.value })}
                  placeholder="e.g. 43"
                  required
                  helperText="Soil Potassium content (5 - 205)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label="Temperature (°C)"
                  type="number"
                  step="any"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  placeholder="e.g. 23.5"
                  required
                  helperText="Ambient temp (8 - 45 °C)"
                />
                <Input
                  label="Humidity (%)"
                  type="number"
                  step="any"
                  value={formData.humidity}
                  onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                  placeholder="e.g. 80.0"
                  required
                  helperText="Relative humidity (10 - 100%)"
                />
                <Input
                  label="Soil pH"
                  type="number"
                  step="any"
                  value={formData.ph}
                  onChange={(e) => setFormData({ ...formData, ph: e.target.value })}
                  placeholder="e.g. 6.5"
                  required
                  helperText="Acidity / Basicity (3.5 - 9.5)"
                />
                <Input
                  label="Precipitation (mm)"
                  type="number"
                  step="any"
                  value={formData.rainfall}
                  onChange={(e) => setFormData({ ...formData, rainfall: e.target.value })}
                  placeholder="e.g. 200.0"
                  required
                  helperText="Seasonal rainfall in mm"
                />
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  leftIcon={<Play className="w-4 h-4" />}
                  className="font-semibold"
                >
                  Compute Recommendation
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={handleReset}
                  leftIcon={<RefreshCw className="w-4 h-4 text-sage-600" />}
                >
                  Reset
                </Button>
              </div>
            </form>
          </div>

          {result && <PredictionResultCard result={result} onViewHistory={onViewHistory} />}
        </div>
      )}
    </div>
  );
}
