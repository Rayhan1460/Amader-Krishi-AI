import { Eye, Layers, Waves, TrendingUp, Calendar, ShieldAlert, Cpu, MapPin, Sprout, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Badge } from '../common/Badge.tsx';

export function CapabilitiesSection() {
  const { t } = useLanguage();

  // Soil-to-Market Pipeline Stages
  const pipelineSteps = [
    {
      step: '০১',
      title: t('মাটি ও পুষ্টি বিশ্লেষণ', 'Soil & Nutrient Chemistry'),
      desc: t('নাইট্রোজেন, ফসফরাস, পটাশিয়াম ও পিএইচ (pH) মাত্রা নিরূপণ', 'Evaluating N-P-K chemistry and environmental pH envelopes'),
      icon: <Layers className="w-5 h-5 text-gold-400" />,
    },
    {
      step: '০২',
      title: t('উপযুক্ত ফসল বাছাই', 'Precision Crop Matching'),
      desc: t('২২টি ফসলের মধ্যে সর্বোচ্চ ফলনশীল জাত নির্বাচন', 'Ranked matching across 22 benchmark crop species'),
      icon: <Sprout className="w-5 h-5 text-emerald-400" />,
    },
    {
      step: '০৩',
      title: t('পাতাভিত্তিক রোগ নির্ণয়', 'Foliar Vision Diagnostics'),
      desc: t('টমেটো ও ধানের পাতার ছবি স্ক্যান করে রোগ প্রতিরোধ', 'MobileNetV2 & CNN pathology diagnosis for tomato & rice'),
      icon: <Eye className="w-5 h-5 text-blue-400" />,
    },
    {
      step: '০৪',
      title: t('ঝুঁকি ও ফলন পূর্বাভাস', 'Risk & Yield Regression'),
      desc: t('বন্যা ঝুঁকি ও বিভাগীয় সম্ভাব্য ফলন (টন/হেক্টর) নিরূপণ', 'Geospatial flood risk scoring and regional harvest yield forecast'),
      icon: <Waves className="w-5 h-5 text-teal-400" />,
    },
    {
      step: '০৫',
      title: t('বাজার দর পর্যালোচনা', 'Wholesale Price Baselines'),
      desc: t('টমেটো ও বোরো ধানের পাইকারি বাজার ট্রেন্ড ও সঠিক সিদ্ধান্ত', 'Empirical lag-1 baseline dominance for commodity pricing'),
      icon: <TrendingUp className="w-5 h-5 text-amber-400" />,
    },
  ];

  // Upcoming / Planned Modules Preview (Honestly Labeled)
  const plannedModules = [
    {
      icon: <Calendar className="w-6 h-6 text-gold-400" />,
      badge: t('পরিকল্পিত সংস্করণ • Phase F2', 'Planned Feature • Phase F2'),
      title: t('স্মার্ট কৃষি বর্ষপঞ্জি', 'Smart Agricultural Calendar'),
      desc: t(
        'খরিপ-১, খরিপ-২ এবং রবি মৌসুমের জন্য উপযুক্ত রোপণ, সেচ, সার প্রয়োগ এবং ফসল কাটার স্বয়ংক্রিয় সময়সূচি তৈরির ডায়নামিক ক্যালেন্ডার।',
        'Season-aware dynamic agricultural calendar for automated scheduling of sowing, irrigation, fertilizer application, and harvesting across Kharif and Rabi seasons.'
      ),
      status: t('পরিকল্পিত / Coming Soon', 'Planned / Coming Soon'),
    },
    {
      icon: <MapPin className="w-6 h-6 text-emerald-400" />,
      badge: t('পরিকল্পিত সংস্করণ', 'Planned Feature'),
      title: t('ফার্ম ডিজিটাল টুইন ও মাটি ব্যবস্থাপনা', 'Farm Digital Twin & Soil Management'),
      desc: t(
        'নির্দিষ্ট প্লটের খামার ম্যাপিং, জমির স্থানাঙ্ক, মাটির আর্দ্রতা প্রোফাইল এবং স্তরভিত্তিক মাইক্রো-নিউট্রিয়েন্ট নিরীক্ষণ ড্যাশবোর্ড।',
        'Field parcel boundary mapping, digital terrain twin, moisture profiles, and multi-layer soil micro-nutrient health tracking.'
      ),
      status: t('পরিকল্পিত / Coming Soon', 'Planned / Coming Soon'),
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-teal-400" />,
      badge: t('পরিকল্পিত সংস্করণ', 'Planned Feature'),
      title: t('আবহাওয়া ও জলবায়ু ঝুঁকি পূর্বাভাস', 'Weather & Risk Intelligence'),
      desc: t(
        'উপজেলা পর্যায়ের মাইক্রো-ক্লাইমেট পূর্বাভাস, অতিবৃষ্টি, আকস্মিক বন্যা এবং খরা পরিস্থিতি নিরূপণে নির্ভরযোগ্য সতর্কবার্তা হাব।',
        'Upazila-level micro-climate alerts, monsoonal flash flood warnings, and localized agronomic drought susceptibility forecasting.'
      ),
      status: t('পরিকল্পিত / Coming Soon', 'Planned / Coming Soon'),
    },
    {
      icon: <Cpu className="w-6 h-6 text-blue-400" />,
      badge: t('পরিকল্পিত সংস্করণ', 'Planned Feature'),
      title: t('ফসল স্বাস্থ্য ও ফলন পরিকল্পনা', 'Crop Health & Yield Planning'),
      desc: t(
        'ফসলের বৃদ্ধি চক্র জুড়ে পাতার স্বাস্থ্য পর্যবেক্ষণ এবং মৌসুমি উৎপাদন লক্ষ্যমাত্রা নির্ধারণের ইন্টিগ্রেটেড পরিকল্পনা টুল।',
        'Multi-stage vegetative crop health tracking and seasonal harvest target planning with historical divisional benchmarks.'
      ),
      status: t('পরিকল্পিত / Coming Soon', 'Planned / Coming Soon'),
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-amber-400" />,
      badge: t('পরিকল্পিত সংস্করণ', 'Planned Feature'),
      title: t('বাজার বুদ্ধিমত্তা ও সরবরাহ চেইন পূর্বাভাস', 'Market Intelligence & Supply Insights'),
      desc: t(
        'কাঁচাবাজারের পাইকারি আড়ত দর, সরবরাহ সংকটের পূর্বানুমান এবং কৃষকের জন্য লাভজনক ফসল বিক্রির সময় নির্ধারণ বিশ্লেষণ।',
        'Wholesale market arrival forecasting, perishability risk assessment, and empirical harvest liquidation timing insights.'
      ),
      status: t('পরিকল্পিত / Coming Soon', 'Planned / Coming Soon'),
    },
  ];

  return (
    <section id="capabilities" className="py-20 sm:py-24 bg-forest-950 text-cream-100 relative overflow-hidden">
      {/* Decorative ambient patterns */}
      <div className="absolute inset-0 bg-subtle-grid opacity-15 pointer-events-none" />
      <div className="absolute -top-40 right-0 w-[500px] h-[500px] bg-forest-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 left-0 w-[500px] h-[500px] bg-gold-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section 1: Complete Soil-to-Market Vision Overview */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="charcoal" size="md" dot className="mb-4 text-gold-300 border-gold-800/60 bg-forest-900/80">
            {t('মাটি থেকে বাজার রূপরেখা', 'Soil-to-Market Vision')}
          </Badge>
          <h2 className="font-bengali font-bold text-3xl sm:text-4xl lg:text-5xl text-cream-50 tracking-tight mb-5">
            {t('একটি পূর্ণাঙ্গ এআই সমাধান,', 'One Integrated System,')} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-gold-300 to-amber-400">
              {t('কৃষকের প্রতিটি পদক্ষেপে বিশ্বস্ত সহযোগী।', 'Guiding Every Stage of Agriculture.')}
            </span>
          </h2>
          <p className="font-bengali text-base sm:text-lg text-sage-300 leading-relaxed">
            {t(
              'বীজ বপন থেকে শুরু করে ফসল তোলা ও বাজারে বিক্রি পর্যন্ত প্রতিটি সিদ্ধান্তকে ডেটা ও বৈজ্ঞানিক প্রমাণের ভিত্তিতে পরিচালিত করাই আমাদের লক্ষ্য।',
              'Connecting seed-to-soil chemistry, plant vision diagnostics, regional harvest forecasts, and wholesale price baselines into a single dependable pipeline.'
            )}
          </p>
        </div>

        {/* 5-Step Visual Soil-to-Market Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-20">
          {pipelineSteps.map((step, idx) => (
            <div
              key={step.step}
              className="glass-card-dark rounded-2xl p-5 border border-forest-800/80 hover:border-gold-500/50 transition-all duration-300 flex flex-col justify-between relative group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-english text-xs font-bold text-forest-400 bg-forest-900/80 px-2 py-0.5 rounded-md border border-forest-700/60">
                    {step.step}
                  </span>
                  <div className="p-2 rounded-xl bg-forest-900/60 border border-forest-800 group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                </div>
                <h3 className="font-bengali font-bold text-base text-cream-50 mb-1.5">
                  {step.title}
                </h3>
                <p className="font-bengali text-xs text-sage-300 leading-relaxed">
                  {step.desc}
                </p>
              </div>
              {idx < pipelineSteps.length - 1 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 text-gold-400/40">
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Section 2: Future Capabilities Preview (Honest Coming Soon Preview) */}
        <div className="pt-8 border-t border-forest-800/80">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <span className="font-bengali text-xs font-bold uppercase tracking-wider text-gold-400">
                {t('আগামীর উদ্ভাবন ও ফিচার রোডম্যাপ', 'Feature Roadmap & Architecture Preview')}
              </span>
              <h3 className="font-bengali font-bold text-2xl sm:text-3xl text-cream-50 mt-1">
                {t('আসন্ন উন্নত কৃষি সুবিধাসমূহ', 'Upcoming Smart Agricultural Modules')}
              </h3>
            </div>
            <p className="font-bengali text-xs sm:text-sm text-sage-400 mt-2 md:mt-0 max-w-md">
              {t(
                'এই ফিচারগুলো বর্তমানে গবেষণা ও উন্নয়ন পর্যায়ে রয়েছে এবং আগামী আপডেটে উন্মুক্ত হবে।',
                'These planned modules are currently in agronomic validation and will be released in subsequent phases.'
              )}
            </p>
          </div>

          {/* Grid of Planned Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plannedModules.map((mod) => (
              <div
                key={mod.title}
                className="rounded-3xl p-6 sm:p-7 bg-charcoal-900/90 border border-forest-800/70 hover:border-forest-700 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {/* Coming Soon Corner Ribbon / Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-forest-900 flex items-center justify-center border border-forest-800 shadow-sm">
                    {mod.icon}
                  </div>
                  <span className="font-bengali text-[11px] font-bold px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30">
                    {mod.status}
                  </span>
                </div>

                <div className="mb-4">
                  <h4 className="font-bengali font-bold text-lg text-cream-50 mb-2">
                    {mod.title}
                  </h4>
                  <p className="font-bengali text-xs sm:text-sm text-sage-300 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-forest-900 flex items-center justify-between text-[11px] text-sage-400">
                  <span className="font-bengali">
                    {t('গবেষণা যাচাইকরণে চলমান', 'Under Field Validation')}
                  </span>
                  <span className="font-english font-medium text-forest-400">
                    Phase F2 Preview
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}

export default CapabilitiesSection;
