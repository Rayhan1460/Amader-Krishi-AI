import { Bot, User, Sparkles, CornerDownLeft, Eye, ShieldAlert } from 'lucide-react';
import { Badge } from '../common/Badge.tsx';

export function AIAssistantPreview() {
  return (
    <section className="py-24 bg-cream-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <Badge variant="amber" size="md">
              Phase D2 Preview • Illustrative Concept
            </Badge>
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 tracking-tight mb-4">
            Unified Conversational Agronomy
          </h2>
          <p className="text-base sm:text-lg text-charcoal-700 leading-relaxed">
            In Phase D2, AgriSphere AI will integrate a natural language co-pilot capable of orchestrating all seven models in a single conversational thread.
          </p>
        </div>

        {/* Mock Chat Interface Container */}
        <div className="max-w-3xl mx-auto glass-card rounded-3xl p-6 sm:p-8 shadow-xl border border-sage-200/90 bg-white/80 backdrop-blur-md relative">
          
          {/* Header of Chat Mockup */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-sage-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center text-emerald-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-forest-950">
                    AgriSphere Agronomic Co-Pilot
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Preview Mockup
                  </span>
                </div>
                <p className="text-xs text-sage-600">Model Orchestration Engine • 7 Loaded Checkpoints</p>
              </div>
            </div>
            <span className="text-xs font-mono text-sage-500 hidden sm:inline">
              Session: #agri-session-preview
            </span>
          </div>

          {/* Chat Messages */}
          <div className="space-y-4 mb-6">
            
            {/* User message */}
            <div className="flex items-start gap-3 justify-end">
              <div className="bg-forest-800 text-white rounded-2xl rounded-tr-xs p-4 max-w-lg text-xs sm:text-sm shadow-sm">
                <p className="font-medium">
                  "I noticed small dark brown specks with yellow rings on my tomato leaves in Bogura. Also, what should I expect for weekly tomato wholesale price?"
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-forest-200 flex items-center justify-center text-forest-800 shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            </div>

            {/* AI Assistant response */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-forest-900 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-cream-100/90 border border-sage-200 text-charcoal-900 rounded-2xl rounded-tl-xs p-4 sm:p-5 max-w-xl text-xs sm:text-sm space-y-3">
                <div className="flex items-center gap-2 text-forest-800 font-semibold text-xs pb-1 border-b border-sage-200">
                  <Sparkles className="w-3.5 h-3.5 text-forest-600" />
                  <span>Invoked 2 Research Models: [tomato_disease_v3, tomato_price]</span>
                </div>

                <div className="bg-white rounded-xl p-3 border border-sage-200">
                  <div className="flex items-center justify-between text-xs font-bold text-charcoal-900 mb-1">
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <Eye className="w-3.5 h-3.5" /> Pathology Detection (tomato_disease_v3)
                    </span>
                    <span className="text-forest-700 bg-forest-50 px-2 py-0.5 rounded">
                      Early Blight (91.4% Softmax)
                    </span>
                  </div>
                  <p className="text-[11px] text-charcoal-600">
                    Symptom matches Alternaria solani progression. Recommended immediate isolation of symptomatic foliage.
                  </p>
                </div>

                <div className="bg-white rounded-xl p-3 border border-sage-200">
                  <div className="flex items-center justify-between text-xs font-bold text-charcoal-900 mb-1">
                    <span className="text-amber-800">
                      Market Price Forecast (tomato_price)
                    </span>
                    <span className="font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                      Baseline: 48.50 BDT/kg
                    </span>
                  </div>
                  <p className="text-[11px] text-charcoal-600">
                    Last-observed wholesale price benchmark remains recommended due to empirical historical test set MAE (5.84 vs 9.61 BDT/kg).
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    Scientific Caveat: PlantDoc real-world F1 is ~0.44; verify with a local agricultural extension officer.
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Illustrative Input bar */}
          <div className="relative flex items-center bg-white rounded-xl border border-sage-300 p-2 opacity-80 cursor-not-allowed">
            <span className="text-xs text-sage-400 pl-3">
              Ask about crops, disease diagnostics, weather anomalies, or prices...
            </span>
            <button
              type="button"
              disabled
              className="ml-auto w-8 h-8 rounded-lg bg-forest-800 text-white flex items-center justify-center cursor-not-allowed"
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </div>

          <p className="text-center text-[11px] text-sage-600 mt-3 font-medium">
            Illustrative preview of Phase D2 full conversational workspace. Full interactive chat releases in Phase D2.
          </p>
        </div>

      </div>
    </section>
  );
}
