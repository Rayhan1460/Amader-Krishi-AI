import { AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { Card } from '../common/Card.tsx';
import { Badge } from '../common/Badge.tsx';

export function LimitationsSection() {
  const caveats = [
    {
      modelId: 'tomato_disease_v3',
      title: 'Tomato Disease Dual-Validation Gap',
      tag: 'Computer Vision',
      finding:
        'While lab validation on PlantVillage achieves >98% accuracy, evaluation on in-the-wild PlantDoc imagery drops to ~0.440 macro F1.',
      action:
        'Independent field testing and human agronomist verification are mandatory before chemical application.',
    },
    {
      modelId: 'rice_disease',
      title: 'Rice Disease Dataset Generalization',
      tag: 'Computer Vision',
      finding:
        'Trained across 7 disease classes with 0.574 accuracy and 0.548 macro F1. Train/validation splits were not verified as field-independent.',
      action:
        'Results must be treated as diagnostic aids, not definitive phytopathological confirmations.',
    },
    {
      modelId: 'crop_recommendation',
      title: 'Public Benchmark vs Bangladesh Soil',
      tag: 'Agronomy',
      finding:
        'The underlying dataset is a standard 22-crop synthetic benchmark (macro F1 0.993) rather than an empirical soil sample repository from Bangladesh Upazilas.',
      action:
        'Should be cross-referenced with local Upazila Agriculture Office (DAE) seasonal soil advisories.',
    },
    {
      modelId: 'regional_crop_yield',
      title: 'Regional Scope vs Farm-Level Estimates',
      tag: 'Agronomy',
      finding:
        'Yield predictions operate on district-level aggregated data. The source target physical unit was not independently confirmed by the original dataset authors.',
      action:
        'Not suitable for micro-plot farm yield guarantees. Useful primarily for macro-trend division comparisons.',
    },
    {
      modelId: 'tomato_price & boro_rice_price',
      title: 'Baseline Outperforms Machine Learning',
      tag: 'Market Pricing',
      finding:
        'On historical holdout evaluation, the simple "last-observed weekly wholesale price" baseline achieves lower MAE than the gradient boosted / regression models (5.84 vs 9.61 BDT/kg for tomato).',
      action:
        'AgriSphere AI defaults to the empirical last-price baseline, displaying ML forecasts purely as supplementary reference.',
    },
  ];

  return (
    <section id="limitations" className="py-24 bg-cream-50 relative border-t border-sage-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="amber" size="md" dot className="mb-4">
            Scientific Rigor
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 tracking-tight mb-6">
            Empirical Limitations & <br />
            <span className="text-amber-700">Scientific Transparency.</span>
          </h2>
          <p className="text-base sm:text-lg text-charcoal-700 leading-relaxed">
            Unlike consumer AI tools that conceal failure modes, AgriSphere AI explicitly publishes every caveat, benchmark metric, and empirical boundary inherited from the research models.
          </p>
        </div>

        {/* Caveats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caveats.map((c) => (
            <Card
              key={c.title}
              variant="white"
              className="border-amber-200/80 bg-white/95 p-6 flex flex-col justify-between shadow-xs hover:border-amber-400 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-200">
                    {c.modelId}
                  </span>
                  <span className="text-[11px] font-semibold text-sage-600">
                    {c.tag}
                  </span>
                </div>

                <h3 className="font-display font-bold text-base text-charcoal-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{c.title}</span>
                </h3>

                <p className="text-xs text-charcoal-700 mb-4 leading-relaxed">
                  {c.finding}
                </p>
              </div>

              <div className="pt-3 border-t border-sage-200/80 bg-sage-50/60 -mx-6 -mb-6 p-4 rounded-b-2xl">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-forest-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-forest-900 font-medium leading-snug">
                    <span className="font-bold">Protocol:</span> {c.action}
                  </p>
                </div>
              </div>
            </Card>
          ))}

          {/* Research manifesto summary card */}
          <Card
            variant="glass"
            className="border-forest-300 bg-forest-900 text-cream-100 p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-emerald-400 mb-4">
                <FileText className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Open Research Standard
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-cream-50 mb-3">
                AgriSphere AI Research Integrity Pledge
              </h3>
              <p className="text-xs text-sage-300 leading-relaxed mb-4">
                We believe farmers and agronomists deserve clear statistical boundaries. We never replace verified baseline heuristics with experimental models unless empirical validation proves superior performance.
              </p>
            </div>
            <div className="text-[11px] font-mono text-emerald-300 pt-3 border-t border-forest-800">
              Verified Against Research Manifest v1.0
            </div>
          </Card>
        </div>

      </div>
    </section>
  );
}
