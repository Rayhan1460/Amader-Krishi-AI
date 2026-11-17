import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Card } from '../common/Card.tsx';
import { Badge } from '../common/Badge.tsx';

export function LimitationsSection() {
  const { t } = useLanguage();

  const caveats = [
    {
      modelId: 'tomato_disease_v3',
      title: t('টমেটো রোগ নির্ণয়: ল্যাব বনাম বাস্তব মাঠের ব্যবধান', 'Tomato Disease Dual-Validation Gap'),
      tag: t('কম্পিউটার ভিশন', 'Computer Vision'),
      finding: t(
        'ল্যাবরেটরি প্ল্যান্টভিলেজ ডেটায় ৯৮%+ নির্ভুলতা পেলেও বাস্তব মাঠের জটিল আলো ও ছায়াযুক্ত ছবিতে (PlantDoc) ম্যাক্রো F1 নেমে আসে ~০.৪৪০ এ।',
        'While lab validation on PlantVillage achieves >98% accuracy, evaluation on in-the-wild PlantDoc imagery drops to ~0.440 macro F1.'
      ),
      action: t(
        'যেকোনো রাসায়নিক কীটনাশক বা বালাইনাশক প্রয়োগের পূর্বে স্থানীয় কৃষি কর্মকর্তার প্রত্যক্ষ পরামর্শ নেওয়া বাধ্যতামূলক।',
        'Independent field inspection and human agronomist verification are mandatory before chemical application.'
      ),
    },
    {
      modelId: 'rice_disease',
      title: t('ধানের রোগ নির্ণয়: ৭টি শ্রেণির ডেটাসেট সীমাবদ্ধতা', 'Rice Disease Dataset Generalization'),
      tag: t('কম্পিউটার ভিশন', 'Computer Vision'),
      finding: t(
        '৭টি রোগের উপর প্রশিক্ষিত (ভ্যালিডেশন নির্ভুলতা ৫৭.৩৫% ও ম্যাক্রো F1 ৫৪.৭৭%)। রোগলক্ষণ পুষ্টিঘাটতির মতো লক্ষণের সাথে সাদৃশ্যপূর্ণ হতে পারে।',
        'Trained across 7 disease classes with 57.35% validation accuracy and 54.77% macro F1. Chlorosis may overlap with nutrient deficiencies.'
      ),
      action: t(
        'ফলাফলকে সহায়ক পরামর্শ হিসেবে গ্রহণ করতে হবে, চূড়ান্ত প্যাথলজিক্যাল সিদ্ধান্ত নয়।',
        'Results must be treated as diagnostic aids, not definitive phytopathological confirmations.'
      ),
    },
    {
      modelId: 'crop_recommendation',
      title: t('২২ ফসল নির্বাচন: ল্যাব বেঞ্চমার্ক ও জমির বাস্তবতা', 'Public Benchmark vs Bangladesh Soil'),
      tag: t('মৃত্তিকা ও ফসল', 'Agronomy'),
      finding: t(
        'মডেলটির ভিত্তি ২২টি ফসলের পাবলিক বেঞ্চমার্ক ডেটাসেট (ম্যাক্রো F1 ০.৯৯৩), যা বাংলাদেশের সব উপজেলার বাস্তব মাটির ভৌত স্যাম্পল নয়।',
        'The underlying dataset is a standard 22-crop benchmark rather than an empirical soil core repository from all Bangladesh Upazilas.'
      ),
      action: t(
        'উপজেলা কৃষি সম্প্রসারণ অধিদপ্তরের (ডিএই) বাৎসরিক মাটির পুষ্টি নীতিমালার সাথে মিলিয়ে সিদ্ধান্ত নিতে হবে।',
        'Should be cross-referenced with local Upazila Agriculture Office (DAE) seasonal soil advisories.'
      ),
    },
    {
      modelId: 'regional_crop_yield',
      title: t('ফলন পূর্বাভাস: বিভাগীয় গড় বনাম নির্দিষ্ট খামার', 'Regional Scope vs Farm-Level Estimates'),
      tag: t('ফলন পূর্বাভাস', 'Yield Forecasting'),
      finding: t(
        'মডেলটি জেলা ও বিভাগভিত্তিক সামগ্রিক গড় ফলন হিসেব করে। ক্ষুদ্র একক খামারের সূক্ষ্ম ফলন হিসেবের জন্য এটি উপযুক্ত নয়।',
        'Yield predictions operate on district-level aggregated trends. Not calibrated for micro-plot farm yield guarantees.'
      ),
      action: t(
        'ম্যাক্রো প্রবণতা ও আঞ্চলিক তুলনামূলক পরিকল্পনার জন্য সহায়ক তথ্য হিসেবে ব্যবহারযোগ্য।',
        'Useful primarily for macro-trend division comparisons and regional supply planning.'
      ),
    },
    {
      modelId: 'tomato_price & boro_rice_price',
      title: t('বাজার দর পূর্বাভাস: বেসলাইন অগ্রাধিকার নীতি', 'Empirical Baseline Superiority Policy'),
      tag: t('বাজার অর্থনীতি', 'Market Pricing'),
      finding: t(
        'ঐতিহাসিক টেস্টে দেখা গেছে পূর্ববর্তী সপ্তাহের পাইকারি দর (Baseline MAE: ৫.৮৪ টাকা) মেশিন লার্নিং অনুমানের (৯.৬২ টাকা) চেয়ে কম ত্রুটিপূর্ণ।',
        'On historical holdout evaluation, the simple "last-observed weekly wholesale price" baseline achieves lower MAE than ML models (5.84 vs 9.61 BDT/kg).'
      ),
      action: t(
        'আমাদের প্ল্যাটফর্ম বাস্তবসম্মতভাবে পূর্ববর্তী সপ্তাহের বেসলাইন দরকেই প্রধান পরামর্শ হিসেবে তুলে ধরে।',
        'Amader Krishi AI strictly presents the empirical last-price baseline as primary advice, showing ML purely as supplementary.'
      ),
    },
  ];

  return (
    <section id="limitations" className="py-20 sm:py-24 bg-cream-50 dark:bg-forest-950/60 relative border-t border-sage-200 dark:border-forest-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="amber" size="md" dot className="mb-4">
            {t('দায়িত্বশীল এআই ও বৈজ্ঞানিক সততা', 'Responsible AI & Scientific Integrity')}
          </Badge>
          <h2 className="font-bengali font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 dark:text-cream-50 tracking-tight mb-5">
            {t('কৃত্রিম আত্মবিশ্বাস নয়,', 'No Inflated Claims,')} <br />
            <span className="text-earth-600 dark:text-amber-400">
              {t('প্রমাণের ভিত্তিতে বিজ্ঞান ও নম্রতা।', 'Scientific Humility and Real Data.')}
            </span>
          </h2>
          <p className="font-bengali text-base sm:text-lg text-charcoal-700 dark:text-sage-300 leading-relaxed">
            {t(
              'আমরা কৃষকের মেহনতকে সম্মান করি। তাই প্রতিটি মডেলের সীমাবদ্ধতা ও মাঠপর্যায়ের প্রয়োজনীয় যাচাইকরণ নির্দেশিকা আমরা উন্মুক্ত ও স্পষ্টভাবে প্রকাশ করি।',
              'We respect the livelihood of farmers. Every model failure mode and validation caveat is explicitly disclosed.'
            )}
          </p>
        </div>

        {/* Caveats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caveats.map((item) => (
            <Card
              key={item.modelId}
              variant="white"
              className="border-amber-200/80 dark:border-forest-800 bg-white/95 dark:bg-forest-900/90 p-6 flex flex-col justify-between shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bengali text-[11px] font-bold text-amber-900 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md">
                    {item.tag}
                  </span>
                  <span className="font-english text-[10px] font-mono text-sage-600 dark:text-sage-400">
                    {item.modelId}
                  </span>
                </div>

                <h3 className="font-bengali font-bold text-base text-forest-950 dark:text-cream-50 mb-3 leading-snug">
                  {item.title}
                </h3>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-950 dark:text-amber-200 font-bengali">
                    <span className="font-bold block mb-1">
                      {t('গবেষণায় প্রাপ্ত ফলাফল:', 'Empirical Finding:')}
                    </span>
                    {item.finding}
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200 font-bengali">
                    <span className="font-bold block mb-1">
                      {t('দায়িত্বশীল করণীয়:', 'Action Required:')}
                    </span>
                    {item.action}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-sage-200 dark:border-forest-800 flex items-center gap-2 text-[11px] text-sage-600 dark:text-sage-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-forest-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bengali">
                  {t('ডিএই (DAE) কৃষি কর্মকর্তার যাচাই সাপেক্ষে', 'Requires Field DAE Verification')}
                </span>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </section>
  );
}

export default LimitationsSection;
