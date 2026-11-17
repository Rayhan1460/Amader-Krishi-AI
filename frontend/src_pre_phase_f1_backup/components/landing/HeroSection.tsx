import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Cpu, Sparkles, Activity, Eye, Layers, TrendingUp } from 'lucide-react';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-subtle-mesh">
      {/* Subtle background decorative orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-forest-300/20 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-amber-400/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Core Value Proposition */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 mb-6">
              <Badge variant="forest" size="md" dot>
                Validated Research Handoff • 7 AI Models Active
              </Badge>
              <span className="hidden sm:inline-flex items-center text-xs font-semibold text-sage-600 bg-white/60 px-2.5 py-1 rounded-full border border-sage-200">
                TensorFlow 2.21 + Scikit-Learn
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-forest-950 tracking-tight leading-[1.1] mb-6">
              Smarter Farming <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-forest-700 via-forest-600 to-emerald-600">
                Starts Here.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg sm:text-xl font-semibold text-forest-900 mb-4 tracking-tight">
              AgriSphere AI — From Soil to Market, One AI System.
            </p>

            {/* Supporting Description */}
            <p className="text-base sm:text-lg text-charcoal-700 max-w-2xl mb-8 leading-relaxed">
              Unifying deep computer vision, soil-to-crop classification, regional yield regression,
              flood susceptibility analysis, and wholesale price baselines into a single,
              scientifically grounded agronomic intelligence platform for Bangladesh agriculture.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
              <Link to="/register">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto font-semibold shadow-lg shadow-forest-800/20"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Get Started Free
                </Button>
              </Link>
              <a href="#models">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto font-semibold"
                  leftIcon={<Cpu className="w-4 h-4 text-forest-700" />}
                >
                  Explore 7 Research Models
                </Button>
              </a>
            </div>

            {/* Trust Points */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-sage-200/90 w-full text-xs sm:text-sm font-medium text-charcoal-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                <span>Zero Hallucinations</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-forest-600 shrink-0" />
                <span>SHA-256 Verified</span>
              </div>
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Baseline-First Pricing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Interactive Agricultural Hub Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Outer decorative card frame */}
              <div className="glass-card rounded-3xl p-6 shadow-2xl border border-white/80 relative z-10 backdrop-blur-xl">
                
                {/* Header of the Hub */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-sage-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-forest-900">
                      Multi-Model Orchestrator
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-forest-100 text-forest-800 px-2 py-0.5 rounded-md font-semibold">
                    v0.1.0-READY
                  </span>
                </div>

                {/* Simulated Real-Time AI Inference Cards */}
                <div className="space-y-3">
                  
                  {/* Card 1: Tomato Disease Model */}
                  <div className="bg-white/95 rounded-xl p-3.5 border border-sage-200/80 shadow-xs hover:border-forest-400 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-charcoal-900">tomato_disease_v3</p>
                          <p className="text-[10px] text-sage-600">Keras CNN • 8 Pathology Classes</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded border border-forest-200">
                        Top Class: Healthy (99.8%)
                      </span>
                    </div>
                    <div className="w-full bg-sage-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-forest-600 h-1.5 rounded-full" style={{ width: '99.8%' }} />
                    </div>
                  </div>

                  {/* Card 2: Soil Crop Recommendation */}
                  <div className="bg-white/95 rounded-xl p-3.5 border border-sage-200/80 shadow-xs hover:border-forest-400 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-charcoal-900">crop_recommendation</p>
                          <p className="text-[10px] text-sage-600">NPK + Climate • 22 Target Crops</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Top Crop: Jute (Macro F1 0.99)
                      </span>
                    </div>
                    <div className="w-full bg-sage-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: '99%' }} />
                    </div>
                  </div>

                  {/* Card 3: Flood Susceptibility */}
                  <div className="bg-white/95 rounded-xl p-3.5 border border-sage-200/80 shadow-xs hover:border-forest-400 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-800">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-charcoal-900">flood_susceptibility</p>
                          <p className="text-[10px] text-sage-600">Geospatial Station-Held-Out Binary</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        Low Susceptibility (0.18 Prob)
                      </span>
                    </div>
                    <div className="w-full bg-sage-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: '18%' }} />
                    </div>
                  </div>

                  {/* Card 4: Tomato & Rice Price Baseline */}
                  <div className="bg-white/95 rounded-xl p-3.5 border border-sage-200/80 shadow-xs hover:border-forest-400 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-charcoal-900">tomato_price</p>
                          <p className="text-[10px] text-sage-600">Weekly Wholesale • Lag-1 Baseline Rule</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Recommended: 45.00 BDT/kg
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800/80 italic">
                      Notice: Baseline beats ML in empirical MAE (5.84 vs 9.61)
                    </p>
                  </div>
                </div>

                {/* Footer status summary */}
                <div className="mt-4 pt-3 border-t border-sage-200/80 flex items-center justify-between text-[11px] text-sage-700">
                  <span>Backend: FastAPI 127.0.0.1:8000</span>
                  <span className="font-semibold text-forest-700">All 7 Models Checksum Verified</span>
                </div>
              </div>

              {/* Floating accent badge */}
              <div className="absolute -bottom-5 -left-4 sm:-left-6 glass-card px-4 py-2.5 rounded-2xl shadow-xl border border-white flex items-center gap-3 z-20">
                <div className="w-8 h-8 rounded-full bg-forest-700 flex items-center justify-center text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-charcoal-900">Deterministic Weights</p>
                  <p className="text-[10px] text-sage-600">No Mock Code • Exact Research Artifacts</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
