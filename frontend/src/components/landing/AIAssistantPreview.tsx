import { Bot, User, Sparkles, Eye, TrendingUp, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Badge } from '../common/Badge.tsx';

export function AIAssistantPreview() {
  const { t } = useLanguage();

  return (
    <section className="py-20 sm:py-24 bg-cream-50/70 dark:bg-forest-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="forest" size="md" dot className="mb-3">
            {t('কৃষি এআই পরামর্শক • দ্বৈত ভাষা সাপোর্ট', 'Agricultural AI Assistant • Bilingual Engine')}
          </Badge>
          <h2 className="font-bengali font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 dark:text-cream-50 tracking-tight mb-4">
            {t('সরাসরি বাংলায় কথা বলুন এআই সহচরের সাথে', 'Conversational Agronomy in Bangla & English')}
          </h2>
          <p className="font-bengali text-base sm:text-lg text-charcoal-700 dark:text-sage-300 leading-relaxed">
            {t(
              'ফসলের রোগবালাই, সার প্রয়োগ ও বাজার দর সংক্রান্ত যেকোনো প্রশ্নে আমাদের কৃষি এআই তাত্ক্ষণিকভাবে সঠিক মডেল বিশ্লেষণ ও বৈজ্ঞানিক গাইডলাইন উপস্থাপন করে।',
              'Interact naturally with our multi-model intelligence engine. Ask questions in Bengali or English to receive instant model inferences and baseline comparisons.'
            )}
          </p>
        </div>

        {/* Mock Chat Interface Container */}
        <div className="max-w-3xl mx-auto glass-card rounded-3xl p-6 sm:p-8 shadow-xl border border-sage-200 dark:border-forest-800 bg-white/90 dark:bg-forest-900/90 backdrop-blur-md relative">
          
          {/* Header of Chat Mockup */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-sage-200 dark:border-forest-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-forest-800 dark:bg-forest-800 flex items-center justify-center text-gold-300 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bengali font-bold text-sm text-forest-950 dark:text-cream-50">
                    {t('আমাদের কৃষি এআই কো-পাইলট', 'Amader Krishi AI Co-Pilot')}
                  </span>
                  <span className="font-english text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    Active Engine
                  </span>
                </div>
                <p className="font-bengali text-xs text-sage-600 dark:text-sage-400">
                  {t('৭টি গবেষণা মডেল ইন্টিগ্রেশন • অফলাইন সক্ষমতা', '7 Model Orchestration • Fully Private & Offline-Capable')}
                </p>
              </div>
            </div>
            <span className="font-english text-xs font-mono text-sage-500 hidden sm:inline">
              Mode: Rule-Based / Gemini
            </span>
          </div>

          {/* Chat Messages Mockup */}
          <div className="space-y-4 mb-6">
            
            {/* User message in Bangla */}
            <div className="flex items-start gap-3 justify-end">
              <div className="bg-forest-800 text-white rounded-2xl rounded-tr-xs p-4 max-w-lg text-xs sm:text-sm shadow-sm font-bengali">
                <p className="font-medium">
                  {t(
                    '"বগুড়ায় আমার টমেটো গাছের পাতায় হলুদ বলয়সহ বাদামি দাগ দেখা যাচ্ছে। এই রোগের সমাধান কী এবং বর্তমান পাইকারি বাজারদর কেমন?"',
                    '"I noticed small dark brown specks with yellow rings on my tomato leaves in Bogura. What is the diagnosis and current wholesale market price?"'
                  )}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-forest-200 flex items-center justify-center text-forest-800 shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            </div>

            {/* AI Assistant response */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-forest-900 flex items-center justify-center text-gold-400 shrink-0 mt-1 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-cream-100/90 dark:bg-forest-950/80 border border-sage-200 dark:border-forest-800 text-charcoal-900 dark:text-cream-100 rounded-2xl rounded-tl-xs p-4 sm:p-5 max-w-xl text-xs sm:text-sm space-y-3">
                <div className="flex items-center gap-2 text-forest-800 dark:text-gold-400 font-semibold text-xs pb-1 border-b border-sage-200 dark:border-forest-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="font-bengali">
                    {t('২টি গবেষণা মডেল বিশ্লেষণ সম্পন্ন: [tomato_disease_v3, tomato_price]', 'Invoked 2 Research Models: [tomato_disease_v3, tomato_price]')}
                  </span>
                </div>

                {/* Model Result 1: Tomato Blight */}
                <div className="bg-white dark:bg-forest-900 rounded-xl p-3 border border-sage-200 dark:border-forest-800">
                  <div className="flex items-center justify-between text-xs font-bold text-charcoal-900 dark:text-cream-50 mb-1">
                    <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bengali">
                      <Eye className="w-3.5 h-3.5" /> {t('রোগ নির্ণয়:', 'Pathology Diagnosis:')}
                    </span>
                    <span className="text-forest-700 bg-forest-50 dark:bg-forest-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[11px] font-english">
                      Early Blight (91.4% Softmax)
                    </span>
                  </div>
                  <p className="font-bengali text-[11px] text-charcoal-700 dark:text-sage-300 leading-relaxed">
                    {t(
                      'উপসর্গগুলো অল্টারনারিয়া সোলানি (Alternaria solani) ছত্রাকজনিত আগাম ধ্বসা রোগের সাথে সাদৃশ্যপূর্ণ। রোগাক্রান্ত পাতা দ্রুত অপসারণ করুন এবং কৃষি কর্মকর্তার পরামর্শ নিন।',
                      'Symptoms correspond to Alternaria solani fungal progression. Isolate symptomatic foliage and seek field extension verification.'
                    )}
                  </p>
                </div>

                {/* Model Result 2: Tomato Wholesale Price Baseline */}
                <div className="bg-white dark:bg-forest-900 rounded-xl p-3 border border-sage-200 dark:border-forest-800">
                  <div className="flex items-center justify-between text-xs font-bold text-charcoal-900 dark:text-cream-50 mb-1">
                    <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-bengali">
                      <TrendingUp className="w-3.5 h-3.5" /> {t('বাজার পাইকারি দর পর্যালোচনা:', 'Market Price Benchmark:')}
                    </span>
                    <span className="font-english text-amber-800 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded text-[11px] font-bold">
                      Baseline: 48.50 BDT/kg
                    </span>
                  </div>
                  <p className="font-bengali text-[11px] text-charcoal-700 dark:text-sage-300 leading-relaxed">
                    {t(
                      'ঐতিহাসিক গবেষণায় দেখা গেছে পূর্ববর্তী সপ্তাহের পাইকারি দর (Baseline MAE: ৫.৮৪ টাকা) মেশিন লার্নিং অনুমানের (MAE: ৯.৬২ টাকা) চেয়ে অধিক নির্ভরযোগ্য। বেসলাইন দরকে প্রাধান্য দিন।',
                      'Validation demonstrates empirical lag-1 price baseline achieves lower error (5.84 vs 9.62 BDT/kg) than ML regression. Baseline is primary recommendation.'
                    )}
                  </p>
                </div>

                {/* Ethical Disclaimer Note */}
                <div className="flex items-center gap-2 pt-1 text-[10px] text-sage-600 dark:text-sage-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
                  <span className="font-bengali">
                    {t('গবেষণা পরামর্শমূলক সহায়তা • মাঠপর্যায়ে ডিএই (DAE) কর্মকর্তার যাচাই কাম্য', 'Research Advisory • Requires DAE Upazila Officer Confirmation')}
                  </span>
                </div>

              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

export default AIAssistantPreview;
