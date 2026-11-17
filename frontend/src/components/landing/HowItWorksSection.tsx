import { UploadCloud, Cpu, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Badge } from '../common/Badge.tsx';

export function HowItWorksSection() {
  const { t } = useLanguage();

  const steps = [
    {
      step: '০১',
      stepEn: '01',
      icon: UploadCloud,
      title: t('১. মাঠের ডেটা বা ছবি প্রদান', '1. Submit Field Data or Foliar Photos'),
      description: t(
        'স্মার্টফোন দিয়ে ফসলের পাতার স্পষ্ট ছবি তুলুন অথবা মাটির এনপিকে পুষ্টি স্কোর, আবহাওয়া ও ভৌগোলিক তথ্য প্রদান করুন।',
        'Capture clear crop leaf photos via mobile camera or input soil NPK metrics, local weather parameters, and historical price records.'
      ),
      details: [
        t('জেপিজি, পিএনজি ও ওয়েবপি ছবির স্বয়ংক্রিয় প্রসেসিং', 'Automated JPEG, PNG, and WebP processing up to 5 MiB'),
        t('২২৪x২২৪ আরজিবি টেন্সর রূপান্তর', 'Standardized 224x224 RGB tensor input formatting'),
        t('সুরক্ষিত ও দ্রুত ডেটা ভ্যালিডেশন', 'Secure, validated tabular schema normalization'),
      ],
    },
    {
      step: '০২',
      stepEn: '02',
      icon: Cpu,
      title: t('২. নির্ধারিত এআই মডেলে প্রক্রিয়াকরণ', '2. Dedicated AI Model Execution'),
      description: t(
        'কোনো কল্পিত উত্তর নয়—ফাস্টএপিআই ব্যাকএন্ড সরাসরি প্রশিক্ষিত কেরাস ও সাইকিট-লার্ন মডেল আর্কিটেকচারে ডেটা চালনা করে।',
        'Direct algorithmic inference against verified Keras and scikit-learn model weights with zero probabilistic hallucination.'
      ),
      details: [
        t('টেনসরফ্লো ২.২১ মোবাইলনেট ও সিএনএন বিশ্লেষণ', 'TensorFlow 2.21 MobileNetV2 & CNN feature extraction'),
        t('সাইকিট-লার্ন ১.৬ র্যান্ডম ফরেস্ট ক্লাসিফায়ার', 'Scikit-Learn 1.6 ensemble tree classifications'),
        t('এসএইচএ-২৫৬ চেকসাম যাচাইকৃত নিরাপত্তা', 'SHA-256 audited local research model checkpoints'),
      ],
    },
    {
      step: '০৩',
      stepEn: '03',
      icon: ClipboardCheck,
      title: t('৩. বিজ্ঞানভিত্তিক পরামর্শ ও বাজার সিদ্ধান্ত', '3. Grounded Advice & Market Strategy'),
      description: t(
        'রোগের সুনির্দিষ্ট নাম, সঠিক বিকল্প ফসল, বন্যা ঝুঁকির শতকরা হার অথবা বাজার দর বেসলাইন পর্যালোচনা সাথে সাথে পেয়ে যান।',
        'Receive immediate diagnosis, ranked alternative crops, flood risk probabilities, and empirical price baselines.'
      ),
      details: [
        t('সফটম্যাক্স আত্মবিশ্বাস সূচক স্বচ্ছতা', 'Softmax class probability distribution transparency'),
        t('বাস্তব বাজার বেসলাইন অগ্রাধিকার নীতি', 'Last-observed empirical price baseline comparisons'),
        t('ভবিষ্যৎ নিরীক্ষার জন্য স্বয়ংক্রিয় হিস্ট্রি সংরক্ষণ', 'Auditable user-isolated prediction history logged in SQLite'),
      ],
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-24 bg-white dark:bg-forest-950/40 relative overflow-hidden border-y border-sage-200 dark:border-forest-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="sage" size="md" dot className="mb-4">
            {t('সহজ ৩ ধাপের কার্যপ্রণালী', 'Simple 3-Step Workflow')}
          </Badge>
          <h2 className="font-bengali font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 dark:text-cream-50 tracking-tight mb-5">
            {t('মাঠের তথ্য থেকে', 'From Field Observation to')} <br />
            <span className="text-forest-600 dark:text-emerald-400">
              {t('সঠিক ও নির্ভরযোগ্য কৃষি সিদ্ধান্তে।', 'Actionable Agricultural Decisions.')}
            </span>
          </h2>
          <p className="font-bengali text-base sm:text-lg text-charcoal-700 dark:text-sage-300 leading-relaxed">
            {t(
              'কৃষক, উপসহকারী কৃষি কর্মকর্তা (এসএএও) এবং গবেষকদের জন্য তৈরি একটি স্বচ্ছ ও বিজ্ঞানসম্মত বুদ্ধিমত্তা পাইপলাইন।',
              'An auditable, scientifically grounded decision-support pipeline engineered for Bangladesh agro-ecological zones.'
            )}
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative bg-cream-50/90 dark:bg-forest-900/80 rounded-3xl p-7 sm:p-8 border border-sage-200 dark:border-forest-800 hover:border-forest-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-bengali font-extrabold text-3xl sm:text-4xl text-forest-300 dark:text-forest-700">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-forest-800 dark:bg-forest-800 text-white flex items-center justify-center shadow-md">
                      <Icon className="w-6 h-6 text-gold-300" />
                    </div>
                  </div>

                  <h3 className="font-bengali font-bold text-xl text-forest-950 dark:text-cream-50 mb-3 tracking-tight">
                    {item.title}
                  </h3>

                  <p className="font-bengali text-sm text-charcoal-700 dark:text-sage-300 mb-6 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-sage-200 dark:border-forest-800">
                  <ul className="space-y-2.5">
                    {item.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2.5 text-xs text-forest-950 dark:text-sage-200 font-bengali font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-forest-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default HowItWorksSection;
