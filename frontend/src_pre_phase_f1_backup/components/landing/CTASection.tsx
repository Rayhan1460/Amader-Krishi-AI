import { Link } from 'react-router-dom';
import { ArrowRight, Sprout } from 'lucide-react';
import { Button } from '../common/Button.tsx';

export function CTASection() {
  return (
    <section className="py-20 bg-forest-950 text-cream-100 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-forest-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        <div className="w-16 h-16 rounded-2xl bg-forest-800 border border-forest-600/40 mx-auto flex items-center justify-center text-emerald-400 mb-6 shadow-glow">
          <Sprout className="w-8 h-8" />
        </div>

        <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-cream-50 tracking-tight mb-6">
          Ready to Ground Your Decisions in <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-forest-300">
            Real Agricultural Science?
          </span>
        </h2>

        <p className="text-base sm:text-lg text-sage-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Create an account today and access seven specialized research models engineered for precision diagnosis, soil recommendations, and market clarity.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link to="/register" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold bg-emerald-600 hover:bg-emerald-500 text-forest-950 shadow-lg shadow-emerald-900/30"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Get Started Free
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full font-semibold border-sage-500 text-cream-100 hover:bg-forest-900"
            >
              Sign In to Workspace
            </Button>
          </Link>
        </div>

        <p className="text-xs text-sage-400 mt-6">
          No credit card required • Connected directly to deterministic research backend
        </p>

      </div>
    </section>
  );
}
