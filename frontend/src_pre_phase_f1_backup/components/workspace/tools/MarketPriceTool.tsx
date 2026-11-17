import { useState, type FormEvent } from 'react';
import { TrendingUp, Sparkles, RefreshCw, AlertCircle, Play, Info } from 'lucide-react';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { Button } from '../../common/Button.tsx';
import { Input } from '../../common/Input.tsx';
import { PredictionResultCard } from '../PredictionResultCard.tsx';

interface MarketPriceToolProps {
  initialCommodity?: 'tomato_price' | 'boro_rice_price';
  onViewHistory?: (recordId: number) => void;
}

export function MarketPriceTool({
  initialCommodity = 'tomato_price',
  onViewHistory,
}: MarketPriceToolProps) {
  const [commodity, setCommodity] = useState<'tomato_price' | 'boro_rice_price'>(initialCommodity);

  const tomatoDefault = {
    lag_1: '45.0',
    lag_2: '42.5',
    lag_3: '40.0',
    lag_4: '38.0',
    lag_8: '35.0',
    lag_12: '32.0',
    past_mean_4: '41.38',
    past_mean_8: '38.25',
    month: '11',
    week_of_month: '1',
  };

  const riceDefault = {
    lag_1: '52.5',
    lag_2: '52.0',
    lag_3: '51.8',
    lag_4: '51.5',
    lag_8: '50.2',
    lag_12: '49.8',
    past_mean_4: '51.95',
    past_mean_8: '51.10',
    month: '11',
    week_of_month: '1',
  };

  const [formData, setFormData] = useState(
    initialCommodity === 'tomato_price' ? tomatoDefault : riceDefault
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  const handleCommodityChange = (newComm: 'tomato_price' | 'boro_rice_price') => {
    setCommodity(newComm);
    setFormData(newComm === 'tomato_price' ? tomatoDefault : riceDefault);
    setResult(null);
    setError(null);
  };

  const presets =
    commodity === 'tomato_price'
      ? [
          { name: 'Recent Peak Season (45 BDT)', data: tomatoDefault },
          {
            name: 'Post-Harvest Low (28 BDT)',
            data: {
              lag_1: '28.0',
              lag_2: '30.0',
              lag_3: '32.5',
              lag_4: '35.0',
              lag_8: '42.0',
              lag_12: '48.0',
              past_mean_4: '31.38',
              past_mean_8: '36.50',
              month: '2',
              week_of_month: '3',
            },
          },
          {
            name: 'Monsoon Scarcity (65 BDT)',
            data: {
              lag_1: '65.0',
              lag_2: '60.0',
              lag_3: '58.0',
              lag_4: '54.0',
              lag_8: '48.0',
              lag_12: '42.0',
              past_mean_4: '59.25',
              past_mean_8: '53.60',
              month: '7',
              week_of_month: '2',
            },
          },
        ]
      : [
          { name: 'Stable Wholesale (52.5 BDT)', data: riceDefault },
          {
            name: 'Harvest Season Dip (48.0 BDT)',
            data: {
              lag_1: '48.0',
              lag_2: '49.0',
              lag_3: '50.5',
              lag_4: '52.0',
              lag_8: '53.5',
              lag_12: '54.0',
              past_mean_4: '49.88',
              past_mean_8: '51.50',
              month: '5',
              week_of_month: '2',
            },
          },
        ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: Record<string, number> = {};
    for (const [key, val] of Object.entries(formData)) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        setError(`Field '${key}' must be a valid number.`);
        setIsSubmitting(false);
        return;
      }
      payload[key] = num;
    }

    try {
      const res = await predictionApi.predict(commodity, { data: payload });
      setResult(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tool Header */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-charcoal-900">
                Wholesale Commodity Price Forecaster
              </h2>
              <p className="text-xs text-sage-600">
                Model: <code className="font-mono text-forest-800">{commodity}</code> • Baseline-Dominant Pipeline
              </p>
            </div>
          </div>

          {/* Commodity Switcher */}
          <div className="flex items-center bg-sage-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleCommodityChange('tomato_price')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                commodity === 'tomato_price'
                  ? 'bg-white text-forest-900 shadow-xs'
                  : 'text-sage-700 hover:text-charcoal-900'
              }`}
            >
              Tomato Wholesale
            </button>
            <button
              type="button"
              onClick={() => handleCommodityChange('boro_rice_price')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                commodity === 'boro_rice_price'
                  ? 'bg-white text-forest-900 shadow-xs'
                  : 'text-sage-700 hover:text-charcoal-900'
              }`}
            >
              Boro Rice Wholesale
            </button>
          </div>
        </div>

        {/* Scientific Baseline Note */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            <strong>Empirical Finding:</strong> On holdout research datasets, the last-observed weekly price baseline achieves lower error (Tomato MAE 5.84 vs 9.61; Rice MAE 0.737 vs 0.753). AgriSphere AI recommends the baseline price as primary advice.
          </span>
        </div>
      </div>

      {/* Preset Selectors */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-sage-100">
          <span className="text-xs font-semibold text-charcoal-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-forest-600" />
            Historical Scenarios:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setFormData(p.data);
                  setError(null);
                  setResult(null);
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input
              label="Lag 1 (Last Observed BDT/kg) *"
              type="number"
              step="any"
              value={formData.lag_1}
              onChange={(e) => setFormData({ ...formData, lag_1: e.target.value })}
              required
              helperText="Most recent wholesale price"
            />
            <Input
              label="Lag 2 (2 Weeks Ago BDT/kg)"
              type="number"
              step="any"
              value={formData.lag_2}
              onChange={(e) => setFormData({ ...formData, lag_2: e.target.value })}
              required
            />
            <Input
              label="Lag 3 (3 Weeks Ago BDT/kg)"
              type="number"
              step="any"
              value={formData.lag_3}
              onChange={(e) => setFormData({ ...formData, lag_3: e.target.value })}
              required
            />
            <Input
              label="Lag 4 (4 Weeks Ago BDT/kg)"
              type="number"
              step="any"
              value={formData.lag_4}
              onChange={(e) => setFormData({ ...formData, lag_4: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input
              label="Lag 8 (8 Weeks Ago BDT/kg)"
              type="number"
              step="any"
              value={formData.lag_8}
              onChange={(e) => setFormData({ ...formData, lag_8: e.target.value })}
              required
            />
            <Input
              label="Lag 12 (12 Weeks Ago BDT/kg)"
              type="number"
              step="any"
              value={formData.lag_12}
              onChange={(e) => setFormData({ ...formData, lag_12: e.target.value })}
              required
            />
            <Input
              label="Past 4-Week Mean (BDT/kg)"
              type="number"
              step="any"
              value={formData.past_mean_4}
              onChange={(e) => setFormData({ ...formData, past_mean_4: e.target.value })}
              required
            />
            <Input
              label="Past 8-Week Mean (BDT/kg)"
              type="number"
              step="any"
              value={formData.past_mean_8}
              onChange={(e) => setFormData({ ...formData, past_mean_8: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Month (1 - 12)"
              type="number"
              min="1"
              max="12"
              value={formData.month}
              onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              required
            />
            <Input
              label="Week of Month (1 - 5)"
              type="number"
              min="1"
              max="5"
              value={formData.week_of_month}
              onChange={(e) => setFormData({ ...formData, week_of_month: e.target.value })}
              required
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
              Run Price Evaluation
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setFormData(commodity === 'tomato_price' ? tomatoDefault : riceDefault);
                setResult(null);
                setError(null);
              }}
              leftIcon={<RefreshCw className="w-4 h-4 text-sage-600" />}
            >
              Reset to Default
            </Button>
          </div>
        </form>
      </div>

      {result && <PredictionResultCard result={result} onViewHistory={onViewHistory} />}
    </div>
  );
}
