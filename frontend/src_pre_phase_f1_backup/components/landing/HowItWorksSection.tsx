import { UploadCloud, Cpu, ClipboardCheck, ArrowRight } from 'lucide-react';
import { Badge } from '../common/Badge.tsx';

export function HowItWorksSection() {
  const steps = [
    {
      step: '01',
      icon: UploadCloud,
      title: 'Submit Field Parameters or Foliar Images',
      description:
        'Upload leaf photographs directly from mobile devices or enter soil NPK test scores, local temperature, precipitation, and past commodity wholesale records.',
      details: [
        'JPEG, PNG, WebP image parsing up to 5 MiB',
        'Direct 224x224 RGB tensor preprocessing',
        'Structured tabular parameter validation',
      ],
    },
    {
      step: '02',
      icon: Cpu,
      title: 'Deterministic Multi-Model Execution',
      description:
        'FastAPI routes the payload to the respective verified Keras or scikit-learn model artifacts. Zero random generation, zero mock data, pure mathematical inference.',
      details: [
        'TensorFlow 2.21 CNN feature extraction',
        'Scikit-learn 1.6 gradient & regression trees',
        'SHA-256 verified research checkpoints',
      ],
    },
    {
      step: '03',
      icon: ClipboardCheck,
      title: 'Actionable Advice with Grounded Caveats',
      description:
        'Receive immediate diagnosis, top-5 alternative crops, flood risk probabilities, or market price baselines alongside transparent research caveats.',
      details: [
        'Softmax calibrated class probabilities',
        'Last-observed price baseline comparisons',
        'Auditable prediction history logged to database',
      ],
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white relative overflow-hidden border-y border-sage-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="sage" size="md" dot className="mb-4">
            Workflow Overview
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 tracking-tight mb-6">
            From Raw Field Data to <br />
            <span className="text-forest-600">Actionable Agronomic Decisions.</span>
          </h2>
          <p className="text-base sm:text-lg text-charcoal-700 leading-relaxed">
            A three-stage pipeline designed for agronomists, extension officers, and modern farmers who demand verifiable science over automated guesswork.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative bg-cream-50/80 rounded-2xl p-8 border border-sage-200/90 hover:border-forest-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-display font-black text-3xl text-forest-300/80">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-md">
                      <Icon className="w-6 h-6 text-emerald-300" />
                    </div>
                  </div>

                  <h3 className="font-display font-bold text-xl text-charcoal-900 mb-3 tracking-tight">
                    {item.title}
                  </h3>

                  <p className="text-sm text-charcoal-600 mb-6 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-sage-200">
                  <ul className="space-y-2">
                    {item.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-2 text-xs text-forest-900 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-forest-600" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {index < 2 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-20 text-forest-400 pointer-events-none">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
