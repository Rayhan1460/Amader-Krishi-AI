import { useState, type FormEvent } from 'react';
import { Waves, Sparkles, RefreshCw, AlertCircle, Play } from 'lucide-react';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { Button } from '../../common/Button.tsx';
import { Input } from '../../common/Input.tsx';
import { PredictionResultCard } from '../PredictionResultCard.tsx';

interface FloodSusceptibilityToolProps {
  onViewHistory?: (recordId: number) => void;
}

export function FloodSusceptibilityTool({ onViewHistory }: FloodSusceptibilityToolProps) {
  const [formData, setFormData] = useState({
    elevation_m: '5.2',
    slope_deg: '1.2',
    dist_to_river_m: '250.0',
    drainage_density_km_per_km2: '3.4',
    landcover_class: 'Agricultural',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);

  const presets = [
    {
      name: 'Riverbank Lowland (High Risk)',
      data: {
        elevation_m: '3.5',
        slope_deg: '0.6',
        dist_to_river_m: '120.0',
        drainage_density_km_per_km2: '4.2',
        landcover_class: 'Agricultural',
      },
    },
    {
      name: 'Upland Terrace (Low Risk)',
      data: {
        elevation_m: '38.0',
        slope_deg: '5.8',
        dist_to_river_m: '2800.0',
        drainage_density_km_per_km2: '0.8',
        landcover_class: 'Forest',
      },
    },
    {
      name: 'Haor Basin Lowland',
      data: {
        elevation_m: '4.8',
        slope_deg: '0.9',
        dist_to_river_m: '320.0',
        drainage_density_km_per_km2: '3.1',
        landcover_class: 'Water',
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

    const payload = {
      elevation_m: parseFloat(formData.elevation_m),
      slope_deg: parseFloat(formData.slope_deg),
      dist_to_river_m: parseFloat(formData.dist_to_river_m),
      drainage_density_km_per_km2: parseFloat(formData.drainage_density_km_per_km2),
      landcover_class: formData.landcover_class,
    };

    if (
      isNaN(payload.elevation_m) ||
      isNaN(payload.slope_deg) ||
      isNaN(payload.dist_to_river_m) ||
      isNaN(payload.drainage_density_km_per_km2)
    ) {
      setError('Please provide valid numbers for all topographic metrics.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await predictionApi.predict('flood_susceptibility', { data: payload });
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
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-charcoal-900">
              Flood Susceptibility Risk Tool
            </h2>
            <p className="text-xs text-sage-600">
              Model: <code className="font-mono text-forest-800">flood_susceptibility</code> • Station-Held-Out Classifier (Scikit-Learn 1.6)
            </p>
          </div>
        </div>
        <p className="text-xs text-charcoal-700 mt-2 leading-relaxed">
          Evaluates local digital elevation, slope angles, hydrological river proximity, drainage density, and landcover classification for flood vulnerability.
        </p>
      </div>

      {/* Preset Selectors */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-sage-100">
          <span className="text-xs font-semibold text-charcoal-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-forest-600" />
            Topographic Scenarios:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p.data)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-colors cursor-pointer"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Elevation (meters)"
              type="number"
              step="any"
              value={formData.elevation_m}
              onChange={(e) => setFormData({ ...formData, elevation_m: e.target.value })}
              placeholder="e.g. 5.2"
              required
              helperText="Height above mean sea level"
            />

            <Input
              label="Slope (degrees)"
              type="number"
              step="any"
              value={formData.slope_deg}
              onChange={(e) => setFormData({ ...formData, slope_deg: e.target.value })}
              placeholder="e.g. 1.2"
              required
              helperText="Topographic inclination angle"
            />

            <Input
              label="Distance to River (meters)"
              type="number"
              step="any"
              value={formData.dist_to_river_m}
              onChange={(e) => setFormData({ ...formData, dist_to_river_m: e.target.value })}
              placeholder="e.g. 250"
              required
              helperText="Distance to nearest major waterway"
            />

            <Input
              label="Drainage Density (km/km²)"
              type="number"
              step="any"
              value={formData.drainage_density_km_per_km2}
              onChange={(e) =>
                setFormData({ ...formData, drainage_density_km_per_km2: e.target.value })
              }
              placeholder="e.g. 3.4"
              required
              helperText="Channel length per unit catchment area"
            />

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Landcover Classification
              </label>
              <select
                value={formData.landcover_class}
                onChange={(e) => setFormData({ ...formData, landcover_class: e.target.value })}
                className="w-full text-sm rounded-xl py-2.5 px-3 bg-white border border-sage-300 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-200"
              >
                <option value="Agricultural">Agricultural Farmland (Cropland / Paddy)</option>
                <option value="Water">Water Body / Wetland / Haor</option>
                <option value="Forest">Forest / Vegetation Canopy</option>
                <option value="Urban">Urban / Settlement Built-Up</option>
                <option value="Bareland">Bare Ground / Sand Char</option>
              </select>
            </div>
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
              Assess Flood Vulnerability
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => handleApplyPreset(presets[0].data)}
              leftIcon={<RefreshCw className="w-4 h-4 text-sage-600" />}
            >
              Reset
            </Button>
          </div>
        </form>
      </div>

      {result && <PredictionResultCard result={result} onViewHistory={onViewHistory} />}
    </div>
  );
}
