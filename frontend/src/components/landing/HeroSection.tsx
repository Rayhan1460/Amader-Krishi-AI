import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Cpu, Sparkles, Activity, Layers, TrendingUp, SunMedium } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { BRAND } from '../../styles/designTokens.ts';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';

export function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-40 lg:pb-32 overflow-hidden bg-subtle-mesh">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[500px] bg-forest-400/15 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[350px] sm:w-[450px] h-[450px] bg-gold-400/12 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Brand & Value Proposition */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 mb-5">
              <Badge variant="forest" size="md" dot>
                {t('গবেষণা যাচাইকৃত প্ল্যাটফর্ম • ৭টি এআই মডেল সক্রিয়', 'Research-Validated Platform • 7 Active AI Models')}
              </Badge>
              <span className="hidden sm:inline-flex items-center text-xs font-semibold text-gold-800 bg-gold-100/80 px-2.5 py-1 rounded-full border border-gold-300">
                {t('বাংলাদেশ কৃষি প্রেক্ষাপট', 'Bangladesh Agronomic Baseline')}
              </span>
            </div>

            {/* Official Tagline Badge */}
            <div className="mb-3">
              <span className="font-bengali text-sm sm:text-base font-semibold text-gold-700 bg-gold-50/90 px-3.5 py-1.5 rounded-xl border border-gold-200/80 inline-flex items-center gap-2 shadow-2xs">
                <SunMedium className="w-4 h-4 text-gold-600 shrink-0" />
                {BRAND.tagline}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-bengali font-bold text-4xl sm:text-5xl lg:text-6xl text-forest-950 tracking-tight leading-[1.15] mb-5">
              {t('মাটি থেকে বাজার,', 'From Soil to Market,')} <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-forest-800 via-forest-600 to-emerald-600">
                {t('স্মার্ট কৃষির নতুন দিগন্ত।', 'One Integrated AI System.')}
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="font-bengali text-lg sm:text-xl font-semibold text-forest-900 mb-3 tracking-normal">
              {BRAND.platformName} — {t('বাংলাদেশের কৃষকদের জন্য নির্ভরযোগ্য কৃত্রিম বুদ্ধিমত্তা।', 'Reliable Agricultural Intelligence for Bangladesh.')}
            </p>

            {/* Supporting Description */}
            <p className="font-bengali text-base sm:text-lg text-charcoal-700 max-w-2xl mb-8 leading-relaxed">
              {t(
                'গাছের পাতার রোগ নির্ণয় (টমেটো ও ধান), মাটির পুষ্টি অনুযায়ী উপযুক্ত ফসল নির্বাচন, বিভাগীয় মৌসুমি ফলন পূর্বাভাস, ভৌগোলিক বন্যা ঝুঁকি নিরূপণ এবং পাইকারি বাজার দর বিশ্লেষণ—সবকিছু এখন একটি সমন্বিত ও নির্ভরযোগ্য প্ল্যাটফর্মে।',
                'Unifying foliar disease diagnosis (tomato and rice), soil nutrient crop matching, seasonal yield regression, geospatial flood susceptibility, and wholesale market price benchmarks into one scientifically grounded system.'
              )}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10">
              <Link to="/register">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto font-bengali font-bold text-base shadow-lg shadow-forest-900/25 bg-forest-800 hover:bg-forest-900 text-gold-300 py-3.5 px-6"
                  rightIcon={<ArrowRight className="w-4 h-4 text-gold-400" />}
                >
                  {t('বিনামূল্যে শুরু করুন', 'Get Started Free')}
                </Button>
              </Link>
              <a href="#models">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto font-bengali font-semibold text-base py-3.5 px-6 border-sage-300"
                  leftIcon={<Cpu className="w-4 h-4 text-forest-700" />}
                >
                  {t('৭টি এআই মডেল এক্সপ্লোর করুন', 'Explore 7 AI Models')}
                </Button>
              </a>
            </div>

            {/* Trust Points */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-sage-200/90 w-full text-xs sm:text-sm font-bengali font-medium text-charcoal-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                <span>{t('বৈজ্ঞানিক সত্যতা যাচাই', 'Zero Hallucinations')}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-forest-600 shrink-0" />
                <span>{t('SHA-256 ফাইল সিকিউরিটি', 'SHA-256 Verified')}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                <Sparkles className="w-4 h-4 text-gold-600 shrink-0" />
                <span>{t('বাস্তব বাজার বেসলাইন দর', 'Baseline-First Pricing')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Agricultural Intelligence Hub Console Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Outer decorative card frame */}
              <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/90 relative z-10 backdrop-blur-xl bg-white/85">
                
                {/* Header of the Hub */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-sage-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-bengali text-xs font-bold uppercase tracking-wider text-forest-950">
                      {t('সক্রিয় কৃষি বুদ্ধিমত্তা হাব', 'Active Intelligence Hub')}
                    </span>
                  </div>
                  <span className="font-english text-[11px] font-bold text-forest-700 bg-forest-50 px-2.5 py-1 rounded-md border border-forest-200">
                    7 / 7 ONLINE
                  </span>
                </div>

                {/* Soil-to-Market Quick Matrix Cards */}
                <div className="space-y-3">
                  
                  {/* Item 1: Foliar Vision Diagnostic */}
                  <div className="p-3.5 rounded-2xl bg-forest-50/80 border border-forest-100 flex items-center justify-between hover:bg-forest-100/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bengali font-bold text-xs sm:text-sm text-forest-950">
                          {t('টমেটো ও ধান পাতার রোগ নির্ণয়', 'Foliar Pathology Vision')}
                        </p>
                        <p className="font-english text-[11px] text-sage-700">
                          MobileNetV2 (8 classes) • Keras CNN (7 classes)
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      AI Active
                    </span>
                  </div>

                  {/* Item 2: Soil Suitability & Crop Recommendation */}
                  <div className="p-3.5 rounded-2xl bg-gold-50/70 border border-gold-200/60 flex items-center justify-between hover:bg-gold-100/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gold-600 text-white flex items-center justify-center shadow-xs">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bengali font-bold text-xs sm:text-sm text-forest-950">
                          {t('মাটি ও জলবায়ু উপযোগী ২২ ফসল', 'Precision Crop Suitability')}
                        </p>
                        <p className="font-english text-[11px] text-sage-700">
                          Random Forest • Macro F1: 0.993
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gold-900 bg-gold-200 px-2 py-0.5 rounded-md">
                      22 Crops
                    </span>
                  </div>

                  {/* Item 3: Regional Yield Forecasting */}
                  <div className="p-3.5 rounded-2xl bg-sage-50 border border-sage-200/80 flex items-center justify-between hover:bg-sage-100/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bengali font-bold text-xs sm:text-sm text-forest-950">
                          {t('বিভাগীয় ফলন পূর্বাভাস (টন/হেক্টর)', 'Regional Crop Yield Forecaster')}
                        </p>
                        <p className="font-english text-[11px] text-sage-700">
                          Pipeline Regression • Test MAE: 0.26 t/ha
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-forest-800 bg-forest-100 px-2 py-0.5 rounded-md">
                      t/ha Unit
                    </span>
                  </div>

                  {/* Item 4: Commodity Market Baseline */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-between hover:bg-amber-100/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-earth-600 text-white flex items-center justify-center shadow-xs">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bengali font-bold text-xs sm:text-sm text-forest-950">
                          {t('টমেটো ও বোরো ধান পাইকারি দর', 'Wholesale Price Baselines')}
                        </p>
                        <p className="font-english text-[11px] text-sage-700">
                          Empirical Baseline Priority (BDT/kg)
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded-md">
                      BDT / kg
                    </span>
                  </div>

                </div>

                {/* Footer status bar in console card */}
                <div className="mt-5 pt-4 border-t border-sage-200 flex items-center justify-between text-xs text-sage-700">
                  <span className="font-bengali">
                    {t('শতভাগ ব্যক্তিগত ও অফলাইন সক্ষমতা', '100% Private & Locally Grounded')}
                  </span>
                  <Link
                    to="/register"
                    className="font-bengali font-bold text-forest-700 hover:text-forest-900 inline-flex items-center gap-1 group"
                  >
                    <span>{t('ট্রাই করুন', 'Try Console')}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

              </div>

              {/* Decorative background glow accents behind card */}
              <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -top-6 -left-6 w-48 h-48 bg-gold-400/15 rounded-full blur-2xl pointer-events-none" />

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export default HeroSection;
