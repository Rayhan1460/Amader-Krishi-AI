import { useState, type FormEvent } from 'react';
import { Layers, Sparkles, RefreshCw, AlertCircle, Play } from 'lucide-react';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { Button } from '../../common/Button.tsx';
import { Input } from '../../common/Input.tsx';
import { PredictionResultCard } from '../PredictionResultCard.tsx';

interface RegionalYieldToolProps {
  onViewHistory?: (recordId: number) => void;
}

export function RegionalYieldTool({ onViewHistory }: RegionalYieldToolProps) {
  const [formData, setFormData] = useState({
    Year: '2020',
    District: 'Bogura',
    Division: 'Rajshahi',
    Season: 'Kharif-1',
    Rain: '1250.0',
    Sunshine: '6.5',
    Wind: '2.1',
    TempRange: '11.4',
    NDVI_mean_season: '0.62',
    NDVI_max_season: '0.81',
    NDVI_integral: '18.4',
    NDVI_anom: '0.04',
    Pct_irrigated: '65.0',
    NDVI_peak_month: '8',
    NDVI_peak_doy: '230',
    NDVI_mean_trend2: '0.001',
    Rain_ma3: '1210.0',
    Sunshine_ma3: '6.4',
    NDVI_mean_season_ma3: '0.61',
    ndvi_rain_interaction: '775.0',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  const presets = [
    {
      name: 'Bogura Kharif-1',
      data: {
        Year: '2021',
        District: 'Bogura',
        Division: 'Rajshahi',
        Season: 'Kharif-1',
        Rain: '1300.0',
        Sunshine: '6.8',
        Wind: '2.0',
        TempRange: '11.0',
        NDVI_mean_season: '0.65',
        NDVI_max_season: '0.84',
        NDVI_integral: '19.2',
        NDVI_anom: '0.05',
        Pct_irrigated: '70.0',
        NDVI_peak_month: '8',
        NDVI_peak_doy: '232',
        NDVI_mean_trend2: '0.002',
        Rain_ma3: '1260.0',
        Sunshine_ma3: '6.6',
        NDVI_mean_season_ma3: '0.63',
        ndvi_rain_interaction: '845.0',
      },
    },
    {
      name: 'Dinajpur Rabi',
      data: {
        Year: '2020',
        District: 'Dinajpur',
        Division: 'Rangpur',
        Season: 'Rabi',
        Rain: '180.0',
        Sunshine: '7.8',
        Wind: '1.5',
        TempRange: '14.2',
        NDVI_mean_season: '0.55',
        NDVI_max_season: '0.72',
        NDVI_integral: '14.5',
        NDVI_anom: '-0.02',
        Pct_irrigated: '85.0',
        NDVI_peak_month: '2',
        NDVI_peak_doy: '45',
        NDVI_mean_trend2: '-0.001',
        Rain_ma3: '200.0',
        Sunshine_ma3: '7.6',
        NDVI_mean_season_ma3: '0.56',
        ndvi_rain_interaction: '99.0',
      },
    },
    {
      name: 'Mymensingh Kharif-2',
      data: {
        Year: '2022',
        District: 'Mymensingh',
        Division: 'Mymensingh',
        Season: 'Kharif-2',
        Rain: '1600.0',
        Sunshine: '5.8',
        Wind: '2.4',
        TempRange: '9.8',
        NDVI_mean_season: '0.70',
        NDVI_max_season: '0.88',
        NDVI_integral: '21.0',
        NDVI_anom: '0.08',
        Pct_irrigated: '60.0',
        NDVI_peak_month: '9',
        NDVI_peak_doy: '260',
        NDVI_mean_trend2: '0.003',
        Rain_ma3: '1550.0',
        Sunshine_ma3: '5.9',
        NDVI_mean_season_ma3: '0.68',
        ndvi_rain_interaction: '1120.0',
      },
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

    const payload: Record<string, any> = {};
    const numericFields = [
      'Year',
      'Rain',
      'Sunshine',
      'Wind',
      'TempRange',
      'NDVI_mean_season',
      'NDVI_max_season',
      'NDVI_integral',
      'NDVI_anom',
      'Pct_irrigated',
      'NDVI_peak_month',
      'NDVI_peak_doy',
      'NDVI_mean_trend2',
      'Rain_ma3',
      'Sunshine_ma3',
      'NDVI_mean_season_ma3',
      'ndvi_rain_interaction',
    ];

    for (const [key, val] of Object.entries(formData)) {
      if (numericFields.includes(key)) {
        const num = parseFloat(val);
        if (isNaN(num)) {
          setError(`Field '${key}' must be a valid number.`);
          setIsSubmitting(false);
          return;
        }
        payload[key] = num;
      } else {
        payload[key] = val;
      }
    }

    try {
      const res = await predictionApi.predict('regional_crop_yield', { data: payload });
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
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-charcoal-900">
              Regional Crop Yield Estimator
            </h2>
            <p className="text-xs text-sage-600">
              Model: <code className="font-mono text-forest-800">regional_crop_yield</code> • Historical Regression (Scikit-Learn 1.6)
            </p>
          </div>
        </div>
        <p className="text-xs text-charcoal-700 mt-2 leading-relaxed">
          Forecasts regional crop yield (tonnes/hectare) using historical climatic parameters, irrigation coverage, and satellite-derived seasonal NDVI trajectories.
        </p>
      </div>

      {/* Preset Selectors */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-sage-100">
          <span className="text-xs font-semibold text-charcoal-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-forest-600" />
            Regional Presets:
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

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
                District
              </label>
              <select
                value={formData.District}
                onChange={(e) => setFormData({ ...formData, District: e.target.value })}
                className="w-full text-sm rounded-xl py-2.5 px-3 bg-white border border-sage-300 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-200"
              >
                <option value="Bogura">Bogura</option>
                <option value="Dinajpur">Dinajpur</option>
                <option value="Mymensingh">Mymensingh</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Dhaka">Dhaka</option>
                <option value="Comilla">Comilla</option>
                <option value="Jessore">Jessore</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Division
              </label>
              <select
                value={formData.Division}
                onChange={(e) => setFormData({ ...formData, Division: e.target.value })}
                className="w-full text-sm rounded-xl py-2.5 px-3 bg-white border border-sage-300 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-200"
              >
                <option value="Rajshahi">Rajshahi</option>
                <option value="Rangpur">Rangpur</option>
                <option value="Mymensingh">Mymensingh</option>
                <option value="Dhaka">Dhaka</option>
                <option value="Chittagong">Chittagong</option>
                <option value="Khulna">Khulna</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Season
              </label>
              <select
                value={formData.Season}
                onChange={(e) => setFormData({ ...formData, Season: e.target.value })}
                className="w-full text-sm rounded-xl py-2.5 px-3 bg-white border border-sage-300 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-200"
              >
                <option value="Kharif-1">Kharif-1 (Early Summer)</option>
                <option value="Kharif-2">Kharif-2 (Monsoon)</option>
                <option value="Rabi">Rabi (Winter)</option>
              </select>
            </div>

            <Input
              label="Year"
              type="number"
              value={formData.Year}
              onChange={(e) => setFormData({ ...formData, Year: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input
              label="Rainfall (mm)"
              type="number"
              step="any"
              value={formData.Rain}
              onChange={(e) => setFormData({ ...formData, Rain: e.target.value })}
              required
            />
            <Input
              label="Sunshine (hrs)"
              type="number"
              step="any"
              value={formData.Sunshine}
              onChange={(e) => setFormData({ ...formData, Sunshine: e.target.value })}
              required
            />
            <Input
              label="Wind (m/s)"
              type="number"
              step="any"
              value={formData.Wind}
              onChange={(e) => setFormData({ ...formData, Wind: e.target.value })}
              required
            />
            <Input
              label="Temp Range (°C)"
              type="number"
              step="any"
              value={formData.TempRange}
              onChange={(e) => setFormData({ ...formData, TempRange: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input
              label="NDVI Mean"
              type="number"
              step="any"
              value={formData.NDVI_mean_season}
              onChange={(e) => setFormData({ ...formData, NDVI_mean_season: e.target.value })}
              required
            />
            <Input
              label="NDVI Max"
              type="number"
              step="any"
              value={formData.NDVI_max_season}
              onChange={(e) => setFormData({ ...formData, NDVI_max_season: e.target.value })}
              required
            />
            <Input
              label="NDVI Integral"
              type="number"
              step="any"
              value={formData.NDVI_integral}
              onChange={(e) => setFormData({ ...formData, NDVI_integral: e.target.value })}
              required
            />
            <Input
              label="% Irrigated"
              type="number"
              step="any"
              value={formData.Pct_irrigated}
              onChange={(e) => setFormData({ ...formData, Pct_irrigated: e.target.value })}
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
              Forecast Crop Yield
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => handleApplyPreset(presets[0].data)}
              leftIcon={<RefreshCw className="w-4 h-4 text-sage-600" />}
            >
              Reset to Bogura Default
            </Button>
          </div>
        </form>
      </div>

      {result && <PredictionResultCard result={result} onViewHistory={onViewHistory} />}
    </div>
  );
}
