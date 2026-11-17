import { Eye, Layers, Waves, TrendingUp, Cpu, Database, Check } from 'lucide-react';
import { Card } from '../common/Card.tsx';
import { Badge } from '../common/Badge.tsx';

export function CapabilitiesSection() {
  const capabilities = [
    {
      icon: <Eye className="w-6 h-6 text-emerald-400" />,
      badge: 'Computer Vision',
      title: 'Plant Leaf Pathology Interception',
      description:
        'Dual-architecture deep learning models for leaf-level diagnostics. Inspects foliar imagery for 8 tomato pathologies and 7 rice conditions with embedded pixel normalization and full softmax confidence calibration.',
      features: [
        'ResNet / CNN Mobile Architectures',
        'Direct 224x224 RGB image tensors',
        'Confidence calibrated class probabilities',
        'Field-level validation caveats acknowledged',
      ],
      tag: 'Models: tomato_disease_v3, rice_disease',
    },
    {
      icon: <Layers className="w-6 h-6 text-emerald-400" />,
      badge: 'Soil Agronomy',
      title: 'Precision Crop Recommendation',
      description:
        'Multivariate soil macro-nutrient analysis evaluating Nitrogen (N), Phosphorus (P), Potassium (K), alongside temperature, humidity, pH, and precipitation to identify optimal planting choices among 22 benchmark crops.',
      features: [
        'Macro-nutrient NPK balancing',
        'Top-5 alternative crop rankings',
        'Environmental suitability envelope',
        'Macro F1 0.993 public benchmark',
      ],
      tag: 'Model: crop_recommendation',
    },
    {
      icon: <Waves className="w-6 h-6 text-emerald-400" />,
      badge: 'Disaster Preparedness',
      title: 'Geospatial Flood Susceptibility',
      description:
        'Topographic and hydrological vulnerability scoring based on digital elevation, slope angles, river proximity, drainage density, and landcover classification using station-held-out cross-validation.',
      features: [
        'Digital elevation & slope metrics',
        'Hydrological proximity parameters',
        'Station-held-out evaluation (AP 0.716)',
        'Calibrated binary risk probabilities',
      ],
      tag: 'Model: flood_susceptibility',
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-emerald-400" />,
      badge: 'Econometrics',
      title: 'Wholesale Market Price Intelligence',
      description:
        'Historical weekly wholesale price analysis in Bangladeshi Taka (BDT/kg) for perishables (tomato) and staple grains (boro rice), strictly enforcing empirical baseline dominance over volatile ML regression.',
      features: [
        'Wholesale BDT/kg market tracking',
        'Strict Last-Price Baseline priority',
        'Empirical MAE transparency (5.84 vs 9.61)',
        'Historical lag and rolling mean features',
      ],
      tag: 'Models: tomato_price, boro_rice_price',
    },
  ];

  return (
    <section id="capabilities" className="py-24 bg-charcoal-900 text-cream-100 relative overflow-hidden">
      {/* Decorative background grid and gradients */}
      <div className="absolute inset-0 bg-subtle-grid opacity-20 pointer-events-none" />
      <div className="absolute -top-40 right-0 w-[500px] h-[500px] bg-forest-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 left-0 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="charcoal" size="md" dot className="mb-4 text-emerald-400 border-emerald-900/60">
            System Architecture
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-cream-50 tracking-tight mb-6">
            Four Core Agronomic Pillars, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-forest-300">
              Zero Unchecked Assumptions.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-sage-300 leading-relaxed">
            Every inference path is wired directly to verified models trained on real agricultural datasets,
            prioritizing empirical accuracy, transparent limitations, and field reliability.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {capabilities.map((cap) => (
            <Card
              key={cap.title}
              variant="dark"
              hoverEffect
              className="border border-forest-900/80 bg-charcoal-800/80 p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-forest-900/90 border border-forest-700/60 flex items-center justify-center">
                    {cap.icon}
                  </div>
                  <span className="text-xs font-semibold text-emerald-400/90 bg-forest-950/80 border border-forest-800 px-3 py-1 rounded-full">
                    {cap.badge}
                  </span>
                </div>

                <h3 className="font-display font-bold text-xl text-cream-50 mb-3 tracking-tight">
                  {cap.title}
                </h3>
                <p className="text-sm text-sage-300 mb-6 leading-relaxed">
                  {cap.description}
                </p>

                <ul className="space-y-2.5 mb-8">
                  {cap.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5 text-xs text-cream-200">
                      <div className="w-4 h-4 rounded-full bg-forest-900/80 flex items-center justify-center text-emerald-400 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-charcoal-700/80 flex items-center justify-between text-xs text-sage-400">
                <span className="font-mono text-[11px] text-emerald-400/80">{cap.tag}</span>
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <Database className="w-3.5 h-3.5" /> Deterministic Pipeline
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Architecture Guarantee Strip */}
        <div className="mt-16 bg-forest-950/70 border border-forest-800/60 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-forest-800/80 flex items-center justify-center text-emerald-400 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-base text-cream-50">
                Direct Model Execution Protocol
              </h4>
              <p className="text-xs text-sage-300 max-w-xl">
                No simulated synthetic responses. The backend directly loads <code className="text-emerald-300 bg-forest-900 px-1.5 py-0.5 rounded">.keras</code> and <code className="text-emerald-300 bg-forest-900 px-1.5 py-0.5 rounded">.joblib</code> binaries verified with SHA-256 integrity hashes.
              </p>
            </div>
          </div>
          <a href="#limitations" className="shrink-0">
            <span className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4">
              Review Research Caveats &rarr;
            </span>
          </a>
        </div>

      </div>
    </section>
  );
}
