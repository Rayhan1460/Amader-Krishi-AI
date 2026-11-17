import { Sprout } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-charcoal-950 text-cream-200 border-t border-charcoal-800 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-forest-900 flex items-center justify-center text-emerald-400">
                <Sprout className="w-5 h-5" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-cream-50">
                AgriSphere<span className="text-emerald-400">.AI</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-sage-400 max-w-sm mb-4 leading-relaxed">
              AgriSphere AI unifies seven original machine learning models to deliver precision agricultural intelligence from soil to market.
            </p>
            <p className="text-[11px] text-sage-500 font-mono">
              Research Pipeline: TensorFlow 2.21 • Scikit-Learn 1.6 • FastAPI
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-cream-100 mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-sage-400">
              <li>
                <a href="#capabilities" className="hover:text-emerald-400 transition-colors">
                  Capabilities
                </a>
              </li>
              <li>
                <a href="#models" className="hover:text-emerald-400 transition-colors">
                  Research Models
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#limitations" className="hover:text-emerald-400 transition-colors">
                  Scientific Caveats
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-emerald-400 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Research & Compliance */}
          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-cream-100 mb-4">
              Scientific Standards
            </h4>
            <ul className="space-y-2.5 text-xs text-sage-400">
              <li>PlantVillage / PlantDoc Dual-Val</li>
              <li>Station-Held-Out Flood Splits</li>
              <li>Empirical Price Baselines</li>
              <li>Deterministic SHA-256 Checksums</li>
              <li>Zero Synthetic Hallucinations</li>
            </ul>
          </div>

        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-8 border-t border-charcoal-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-sage-500">
          <p>
            &copy; {new Date().getFullYear()} AgriSphere AI. All rights reserved. For agricultural research and decision support only.
          </p>
          <div className="flex items-center gap-6">
            <span>Research Edition v0.1.0</span>
            <span>FastAPI + SQLite Backend</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
