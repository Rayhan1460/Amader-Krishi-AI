import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { BRAND } from '../../styles/designTokens.ts';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { Button } from '../common/Button.tsx';

export function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="py-20 sm:py-28 bg-forest-950 text-cream-100 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gold-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-forest-500/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        {/* Emblem */}
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" variant="dark" showText={false} animate={true} />
        </div>

        {/* Tagline Pill */}
        <div className="inline-flex items-center gap-2 mb-5">
          <span className="font-bengali text-xs sm:text-sm font-semibold text-gold-300 bg-forest-900/90 px-4 py-1 rounded-full border border-gold-500/30 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-gold-400 inline mr-1" />
            {BRAND.tagline}
          </span>
        </div>

        <h2 className="font-bengali font-bold text-3xl sm:text-4xl lg:text-5xl text-cream-50 tracking-tight mb-5 leading-tight">
          {t('স্মার্ট কৃষির নতুন দিগন্তে', 'Empower Your Farm With')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-emerald-400 to-teal-300">
            {t('আপনার খামারকে যুক্ত করুন আজই।', 'Authentic Agricultural Intelligence.')}
          </span>
        </h2>

        <p className="font-bengali text-base sm:text-lg text-sage-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t(
            'আজই বিনামূল্যে অ্যাকাউন্ট তৈরি করে ৭টি বিশেষায়িত এআই মডেল, পাতার রোগ নির্ণয়ক এবং বাজার দর সহচর ব্যবহার শুরু করুন।',
            'Create a free research account today to access precision foliar vision tools, soil crop suitability matching, and market price benchmarks.'
          )}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link to="/register" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto font-bengali font-bold text-base bg-gold-400 hover:bg-gold-500 text-forest-950 shadow-lg shadow-gold-500/20 py-3.5 px-8"
              rightIcon={<ArrowRight className="w-4 h-4 text-forest-950" />}
            >
              {t('বিনামূল্যে অ্যাকাউন্ট তৈরি করুন', 'Create Free Account')}
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto font-bengali font-semibold text-base border-forest-700 text-cream-100 hover:bg-forest-900 py-3.5 px-6"
            >
              {t('লগইন করুন', 'Sign In to Workspace')}
            </Button>
          </Link>
        </div>

        <p className="font-bengali text-xs text-sage-400 mt-6">
          {t('কোনো ফি নেই • শতভাগ সুরক্ষিত ও স্থানীয় এআই ব্যাকএন্ডের সাথে যুক্ত', 'No subscription required • 100% private, locally auditable research backend')}
        </p>

      </div>
    </section>
  );
}

export default CTASection;
