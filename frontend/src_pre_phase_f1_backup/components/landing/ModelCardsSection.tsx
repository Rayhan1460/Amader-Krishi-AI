import { useState } from 'react';
import { Eye, Layers, Waves, TrendingUp, AlertTriangle, ShieldCheck, Binary, Sparkles } from 'lucide-react';
import { Card } from '../common/Card.tsx';
import { Badge } from '../common/Badge.tsx';

interface ModelCardData {
  id: string;
  name: string;
  category: 'vision' | 'agronomy' | 'risk' | 'market';
  categoryLabel: string;
  type: string;
  framework: string;
  sha256Prefix: string;
  inputSummary: string;
  outputSummary: string;
  metrics: string;
  caveat: string;
  icon: typeof Eye;
}

export function ModelCardsSection() {
  const [filter, setFilter] = useState<'all' | 'vision' | 'agronomy' | 'risk' | 'market'>('all');

  const models: ModelCardData[] = [
    {
      id: 'tomato_disease_v3',
      name: 'Tomato Disease Diagnosis',
      category: 'vision',
      categoryLabel: 'Computer Vision',
      type: 'Deep CNN (Keras)',
      framework: 'TensorFlow 2.21',
      sha256Prefix: '9d7adb96...',
      inputSummary: '224x224 RGB Leaf Image Tensor (Base64 / Multipart)',
      outputSummary: '8 Pathology Classes + Calibrated Softmax Confidences',
      metrics: 'PlantVillage F1 0.98 | PlantDoc Real-World Macro F1 ~0.44',
      caveat: 'Experimental checkpoint. PlantDoc macro F1 about 0.440; independent field test REQUIRED.',
      icon: Eye,
    },
    {
      id: 'rice_disease',
      name: 'Rice Leaf Condition Classifier',
      category: 'vision',
      categoryLabel: 'Computer Vision',
      type: 'Deep CNN (Keras)',
      framework: 'TensorFlow 2.21',
      sha256Prefix: 'fd8223a1...',
      inputSummary: '224x224 RGB Leaf Image Tensor (Base64 / Multipart)',
      outputSummary: '7 Classes (Blast, Tungro, Scald, Insect, Stripes, etc.)',
      metrics: 'Accuracy 0.574 | Macro F1 0.548',
      caveat: 'Seven classes; reported accuracy 0.574, macro F1 0.548; split not verified field-independent.',
      icon: Eye,
    },
    {
      id: 'crop_recommendation',
      name: 'Precision Crop Recommendation',
      category: 'agronomy',
      categoryLabel: 'Agronomy',
      type: 'Multi-Class Classifier',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '8280d325...',
      inputSummary: 'Soil N, P, K, Temperature, Humidity, pH, Rainfall',
      outputSummary: 'Top Crop Class + Ranked Top-5 Alternative Probabilities',
      metrics: 'Benchmark Macro F1: 0.993 across 22 Crops',
      caveat: 'Public 22-crop benchmark; NOT validated advice for Bangladesh farmland.',
      icon: Layers,
    },
    {
      id: 'regional_crop_yield',
      name: 'Regional Crop Yield Forecasting',
      category: 'agronomy',
      categoryLabel: 'Agronomy',
      type: 'Multivariate Regressor',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '8f75c90b...',
      inputSummary: '20 Features: Year, District, Division, Season, Weather, NDVI',
      outputSummary: 'Forecast Yield (tonnes/ha regional estimate)',
      metrics: 'MAE: 0.260 source units on historical test set',
      caveat: 'Regional historical research; MAE 0.260; physical units not independently verified; NOT farm-level.',
      icon: Layers,
    },
    {
      id: 'flood_susceptibility',
      name: 'Flood Susceptibility Index',
      category: 'risk',
      categoryLabel: 'Risk & Climate',
      type: 'Binary Risk Classifier',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '25c0ba62...',
      inputSummary: 'Elevation, Slope, River Distance, Drainage Density, Landcover',
      outputSummary: 'Binary Risk Classification + Susceptibility Probability',
      metrics: 'Station-held-out AP: 0.716 | F1: 0.702',
      caveat: 'Station-held-out AP 0.716 F1 0.702; static historical flood susceptibility, NOT real-time cyclone alert.',
      icon: Waves,
    },
    {
      id: 'tomato_price',
      name: 'Tomato Wholesale Market Price',
      category: 'market',
      categoryLabel: 'Market Pricing',
      type: 'Time-Series Regressor',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: 'd1ac325e...',
      inputSummary: 'Historical Price Lags (1, 2, 3, 4, 8, 12), Rolling Means, Month',
      outputSummary: 'Recommended Price (BDT/kg) + Baseline Comparison',
      metrics: 'Last-Price Baseline MAE 5.84 < ML Forecast MAE 9.61',
      caveat: 'Weekly WHOLESALE BDT/kg research; model MAE 9.61 > last-price baseline MAE 5.84; prefer baseline.',
      icon: TrendingUp,
    },
    {
      id: 'boro_rice_price',
      name: 'Boro Rice Wholesale Price',
      category: 'market',
      categoryLabel: 'Market Pricing',
      type: 'Time-Series Regressor',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '914e70a4...',
      inputSummary: 'Historical Price Lags (1, 2, 3, 4, 8, 12), Rolling Means, Month',
      outputSummary: 'Recommended Price (BDT/kg) + Baseline Comparison',
      metrics: 'Last-Price Baseline MAE 0.737 < ML Forecast MAE 0.753',
      caveat: 'Weekly WHOLESALE BDT/kg research; model MAE 0.753 > last-price baseline MAE 0.737; prefer baseline.',
      icon: TrendingUp,
    },
  ];

  const filteredModels =
    filter === 'all' ? models : models.filter((m) => m.category === filter);

  const categories = [
    { key: 'all', label: 'All Models (7)' },
    { key: 'vision', label: 'Computer Vision (2)' },
    { key: 'agronomy', label: 'Agronomy & Soil (2)' },
    { key: 'risk', label: 'Climate & Flood (1)' },
    { key: 'market', label: 'Market Prices (2)' },
  ];

  return (
    <section id="models" className="py-24 bg-cream-100 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="forest" size="md" dot className="mb-4">
            Research Inventory
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 tracking-tight mb-6">
            Seven Original Research Models, <br />
            <span className="text-forest-600">Full Mathematical Transparency.</span>
          </h2>
          <p className="text-base sm:text-lg text-charcoal-700 leading-relaxed">
            Every model below is an actual saved artifact loaded and executed directly by our FastAPI backend.
            We explicitly present scientific metrics, input specifications, and empirical research caveats.
          </p>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key as typeof filter)}
                className={`text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                  filter === c.key
                    ? 'bg-forest-800 text-white shadow-sm shadow-forest-900/20'
                    : 'bg-white/80 text-charcoal-700 border border-sage-300 hover:bg-sage-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Models Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.map((model) => {
            const Icon = model.icon;
            return (
              <Card
                key={model.id}
                variant="white"
                hoverEffect
                className="flex flex-col justify-between border-sage-200/90 shadow-sm hover:border-forest-500"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-forest-50 border border-forest-200/70 flex items-center justify-center text-forest-700">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sage-600 block">
                          {model.categoryLabel}
                        </span>
                        <code className="text-xs font-mono font-bold text-forest-900">
                          {model.id}
                        </code>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-semibold bg-sage-100 text-sage-800 px-2 py-0.5 rounded border border-sage-200">
                      {model.framework}
                    </span>
                  </div>

                  {/* Model Title */}
                  <h3 className="font-display font-bold text-lg text-charcoal-900 mb-2">
                    {model.name}
                  </h3>

                  {/* Architecture & SHA-256 */}
                  <div className="flex items-center gap-2 mb-4 text-[11px] text-sage-700">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Binary className="w-3.5 h-3.5" /> {model.type}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-forest-700">
                      <ShieldCheck className="w-3.5 h-3.5" /> SHA: {model.sha256Prefix}
                    </span>
                  </div>

                  {/* Input Contract */}
                  <div className="bg-cream-50/90 rounded-xl p-3 mb-3 border border-sage-200 text-xs">
                    <span className="font-semibold text-charcoal-800 block mb-1">
                      Input Specification:
                    </span>
                    <span className="text-charcoal-600 text-[11px] leading-relaxed block">
                      {model.inputSummary}
                    </span>
                  </div>

                  {/* Output Contract */}
                  <div className="bg-cream-50/90 rounded-xl p-3 mb-4 border border-sage-200 text-xs">
                    <span className="font-semibold text-charcoal-800 block mb-1">
                      Inference Output:
                    </span>
                    <span className="text-charcoal-600 text-[11px] leading-relaxed block">
                      {model.outputSummary}
                    </span>
                  </div>

                  {/* Research Metric */}
                  <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-forest-50/70 border border-forest-100 text-xs text-forest-900 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-forest-600 shrink-0" />
                    <span className="text-[11px]">{model.metrics}</span>
                  </div>
                </div>

                {/* Caveat Footer */}
                <div className="pt-3 border-t border-sage-200/90 flex items-start gap-2 bg-amber-50/50 -mx-6 -mb-6 p-4 rounded-b-2xl border-t-amber-200/50">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-snug">
                    <span className="font-bold">Caveat:</span> {model.caveat}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

      </div>
    </section>
  );
}
