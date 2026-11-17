import { useState } from 'react';
import { Eye, Layers, Waves, TrendingUp, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Card } from '../common/Card.tsx';
import { Badge } from '../common/Badge.tsx';

interface ModelCardData {
  id: string;
  name: string;
  nameBn: string;
  category: 'vision' | 'agronomy' | 'risk' | 'market';
  categoryLabel: string;
  categoryLabelBn: string;
  type: string;
  framework: string;
  sha256Prefix: string;
  inputSummary: string;
  inputSummaryBn: string;
  outputSummary: string;
  outputSummaryBn: string;
  metrics: string;
  caveat: string;
  caveatBn: string;
  icon: typeof Eye;
}

export function ModelCardsSection() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'vision' | 'agronomy' | 'risk' | 'market'>('all');

  const models: ModelCardData[] = [
    {
      id: 'tomato_disease_v3',
      name: 'Tomato Disease Diagnosis',
      nameBn: 'টমেটো পাতার রোগ নির্ণয়',
      category: 'vision',
      categoryLabel: 'Computer Vision',
      categoryLabelBn: 'কম্পিউটার ভিশন',
      type: 'MobileNetV2 CNN',
      framework: 'TensorFlow 2.21',
      sha256Prefix: '9d7adb96...',
      inputSummary: '224x224 RGB Leaf Image Tensor',
      inputSummaryBn: '২২৪x২২৪ আরজিবি পাতার ছবি',
      outputSummary: '8 Pathology Classes + Softmax Confidence',
      outputSummaryBn: '৮টি রোগ শ্রেণি ও প্রবাবিলিটি স্কোর',
      metrics: 'PlantVillage F1: ~0.90 | PlantDoc Macro F1: ~0.44',
      caveat: 'Experimental checkpoint. Softmax scores are uncalibrated; field verification by agronomists required.',
      caveatBn: 'পরীক্ষামূলক মডেল। সফটম্যাক্স স্কোর অপ্রমাণিত; মাঠপর্যায়ে কৃষি কর্মকর্তার প্রত্যক্ষ পর্যবেক্ষণ আবশ্যক।',
      icon: Eye,
    },
    {
      id: 'rice_disease',
      name: 'Rice Leaf Condition Classifier',
      nameBn: 'ধান পাতার রোগ ও স্বাস্থ্য নির্ণয়',
      category: 'vision',
      categoryLabel: 'Computer Vision',
      categoryLabelBn: 'কম্পিউটার ভিশন',
      type: 'Custom CNN',
      framework: 'TensorFlow 2.21',
      sha256Prefix: 'fd8223a1...',
      inputSummary: '224x224 RGB Leaf Image Tensor',
      inputSummaryBn: '২২৪x২২৪ আরজিবি ধানের পাতার ছবি',
      outputSummary: '7 Conditions (Healthy, Blast, Tungro, Scald, etc.)',
      outputSummaryBn: '৭টি স্বাস্থ্য অবস্থা (ব্লাস্ট, টুংরো, লিফ ফোল্ডার ইত্যাদি)',
      metrics: 'Validation Accuracy: 57.35% | Macro F1: 54.77%',
      caveat: 'Trained on 7 distinct conditions; chlorosis may visually overlap with nutrient deficiencies.',
      caveatBn: '৭টি অবস্থার উপর প্রশিক্ষিত; পুষ্টিহীনতার লক্ষণের সাথে দৃশ্যায়ন সাদৃশ্য থাকতে পারে।',
      icon: Eye,
    },
    {
      id: 'crop_recommendation',
      name: 'Precision Crop Recommendation',
      nameBn: 'মৃত্তিকা ও জলবায়ু উপযোগী ফসল নির্বাচন',
      category: 'agronomy',
      categoryLabel: 'Agronomy',
      categoryLabelBn: 'মৃত্তিকা ও কৃষিবিদ্যা',
      type: 'Random Forest Classifier',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '8280d325...',
      inputSummary: 'Soil N, P, K, Temperature, Humidity, pH, Rainfall',
      inputSummaryBn: 'মাটির নাইট্রোজেন, ফসফরাস, পটাশিয়াম, পিএইচ ও আবহাওয়া',
      outputSummary: 'Primary Recommended Crop + Top-5 Alternatives',
      outputSummaryBn: 'প্রধান সুপারিশকৃত ফসল ও শীর্ষ ৫ বিকল্প',
      metrics: 'Benchmark Macro F1: 0.993 across 22 Crops',
      caveat: 'Public 22-crop benchmark; suitability envelope, not farm yield guarantee.',
      caveatBn: '২২টি ফসলের বেঞ্চমার্ক এনভেলপ; ফলনের নিশ্চয়তা নয়, পরিবেশগত উপযোগিতা নির্দেশক।',
      icon: Layers,
    },
    {
      id: 'regional_crop_yield',
      name: 'Regional Crop Yield Forecasting',
      nameBn: 'বিভাগীয় মৌসুমি ফলন পূর্বাভাস',
      category: 'agronomy',
      categoryLabel: 'Agronomy',
      categoryLabelBn: 'মৃত্তিকা ও কৃষিবিদ্যা',
      type: 'Pipeline Regressor',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '8f75c90b...',
      inputSummary: '20 Features: District, Division, Season, Weather, NDVI',
      inputSummaryBn: '২০টি ফিচার: জেলা, বিভাগ, মৌসুম, আবহাওয়া ও এনডিভিআই সূচক',
      outputSummary: 'Continuous Yield Forecast (tonnes/ha)',
      outputSummaryBn: 'সম্ভাব্য গড় ফলন পূর্বাভাস (টন/হেক্টর এককে)',
      metrics: 'Historical Test MAE: 0.260 source units',
      caveat: 'Divisional regional aggregates; not suitable for micro-plot specific estimations.',
      caveatBn: 'বিভাগীয় সামগ্রিক ঐতিহাসিক গড়; ক্ষুদ্র প্রান্তিক প্লটের জন্য প্রযোজ্য নয়।',
      icon: Layers,
    },
    {
      id: 'flood_susceptibility',
      name: 'Flood Susceptibility Index',
      nameBn: 'ভৌগোলিক বন্যা ঝুঁকি মূল্যায়ন',
      category: 'risk',
      categoryLabel: 'Risk & Climate',
      categoryLabelBn: 'ঝুঁকি ও দুর্যোগ',
      type: 'Binary Classifier',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '25c0ba62...',
      inputSummary: 'Elevation, Slope, River Distance, Drainage Density, Landcover',
      inputSummaryBn: 'উচ্চতা, ঢাল, নদীর দূরত্ব, নিষ্কাশন ঘনত্ব ও ভূমিরূপ',
      outputSummary: 'Binary Risk (Low vs High) + Probability',
      outputSummaryBn: 'ঝুঁকি শ্রেণি (স্বল্প বনাম উচ্চ) ও ঝুঁকির শতকরা হার',
      metrics: 'Station-held-out AP: 0.716 | F1: 0.702',
      caveat: 'Scores terrain topographical vulnerability; NOT a live cyclone or real-time storm flash alert.',
      caveatBn: 'ভৌগোলিক ভূসংস্থানগত ঝুঁকি নির্দেশক; এটি কোনো লাইভ সাইক্লোন বা আকস্মিক ঝড় সতর্কতা নয়।',
      icon: Waves,
    },
    {
      id: 'tomato_price',
      name: 'Tomato Wholesale Market Price',
      nameBn: 'টমেটো পাইকারি বাজার দর পূর্বাভাস',
      category: 'market',
      categoryLabel: 'Market Pricing',
      categoryLabelBn: 'বাজার অর্থনীতি',
      type: 'Lag-1 Baseline + Random Forest',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: 'd1ac325e...',
      inputSummary: 'Historical Price Lags (1, 2, 3, 4, 8, 12), Rolling Means, Month',
      inputSummaryBn: 'পূর্ববর্তী সপ্তাহের দর (১, ২, ৩, ৪...), চলমান গড় ও মাস',
      outputSummary: 'Wholesale BDT/kg Recommendation + Baseline Disclosure',
      outputSummaryBn: 'সুপারিশকৃত পাইকারি দর (টাকা/কেজি) ও বেসলাইন তুলনা',
      metrics: 'Baseline MAE 5.84 BDT/kg < ML MAE 9.62 BDT/kg',
      caveat: 'Empirical Baseline Superiority: Last-observed price beats ML model on validation; presented primarily.',
      caveatBn: 'বেসলাইন অগ্রাধিকার নীতি: পূর্ববর্তী সপ্তাহের দর এআই মডেলের চেয়ে কম ত্রুটিপূর্ণ (৫.৮৪ বনাম ৯.৬২ টাকা)।',
      icon: TrendingUp,
    },
    {
      id: 'boro_rice_price',
      name: 'Boro Rice Wholesale Price',
      nameBn: 'বোরো ধান পাইকারি বাজার দর পূর্বাভাস',
      category: 'market',
      categoryLabel: 'Market Pricing',
      categoryLabelBn: 'বাজার অর্থনীতি',
      type: 'Lag-1 Baseline + Random Forest',
      framework: 'Scikit-Learn 1.6',
      sha256Prefix: '914e70a4...',
      inputSummary: 'Historical Price Lags (1, 2, 3, 4, 8, 12), Rolling Means, Month',
      inputSummaryBn: 'পূর্ববর্তী সপ্তাহের দর (১, ২, ৩, ৪...), চলমান গড় ও মাস',
      outputSummary: 'Wholesale BDT/kg Recommendation + Baseline Disclosure',
      outputSummaryBn: 'সুপারিশকৃত পাইকারি দর (টাকা/কেজি) ও বেসলাইন তুলনা',
      metrics: 'Baseline MAE 0.737 BDT/kg < ML MAE 0.753 BDT/kg',
      caveat: 'Empirical Baseline Superiority: Last-observed price achieves lower error; baseline is primary advice.',
      caveatBn: 'বেসলাইন অগ্রাধিকার নীতি: পূর্ববর্তী সপ্তাহের বাস্তব দর এআই মডেলের চেয়ে নির্ভরযোগ্য (০.৭৪ বনাম ০.৭৫ টাকা)।',
      icon: TrendingUp,
    },
  ];

  const filteredModels = filter === 'all' ? models : models.filter((m) => m.category === filter);

  return (
    <section id="models" className="py-20 sm:py-24 bg-cream-100 dark:bg-forest-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <Badge variant="forest" size="md" dot className="mb-4">
            {t('গবেষণা যাচাইকৃত ৭টি মডেল', 'Verified 7-Model Suite')}
          </Badge>
          <h2 className="font-bengali font-bold text-3xl sm:text-4xl lg:text-5xl text-forest-950 dark:text-cream-50 tracking-tight mb-4">
            {t('সরাসরি প্রশিক্ষিত এআই মডেল সমূহ', 'Original Trained Machine Learning Models')}
          </h2>
          <p className="font-bengali text-base sm:text-lg text-sage-800 dark:text-sage-300 leading-relaxed">
            {t(
              'কোনো অনুমাননির্ভর বা সাধারণ লার্জ ল্যাঙ্গুয়েজ মডেল নয়—প্রত্যেকটি মডেল নির্ধারিত কৃষি ডেটাসেট ও অ্যালগরিদমের মাধ্যমে বাস্তবায়ন ও যাচাই করা হয়েছে।',
              'Zero hallucination wrappers. Every model runs authentic weights loaded into isolated runtime environments with verified checksums.'
            )}
          </p>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {[
              { id: 'all', label: t('সকল মডেল (৭)', 'All Models (7)') },
              { id: 'vision', label: t('কম্পিউটার ভিশন (২)', 'Computer Vision (2)') },
              { id: 'agronomy', label: t('মৃত্তিকা ও ফসল (২)', 'Soil & Agronomy (2)') },
              { id: 'risk', label: t('ঝুঁকি নিরূপণ (১)', 'Risk Assessment (1)') },
              { id: 'market', label: t('পাইকারি বাজার দর (২)', 'Market Pricing (2)') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`font-bengali px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-forest-800 text-gold-300 shadow-md shadow-forest-900/20'
                    : 'bg-white/80 dark:bg-forest-900 text-charcoal-700 dark:text-sage-300 hover:bg-forest-50 border border-sage-200 dark:border-forest-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredModels.map((model) => {
            const Icon = model.icon;
            return (
              <Card
                key={model.id}
                variant="white"
                hoverEffect
                className="flex flex-col justify-between border-sage-200 dark:border-forest-800 bg-white/95 dark:bg-forest-900/90 shadow-sm hover:shadow-md"
              >
                <div>
                  {/* Card Top: Icon & Framework Tag */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-forest-50 dark:bg-forest-800 border border-forest-200 dark:border-forest-700 flex items-center justify-center shadow-2xs">
                      <Icon className="w-5 h-5 text-forest-700 dark:text-emerald-400" />
                    </div>
                    <span className="font-english text-[11px] font-bold text-forest-800 dark:text-forest-200 bg-forest-100/70 dark:bg-forest-800 px-2.5 py-1 rounded-md border border-forest-200 dark:border-forest-700">
                      {model.framework}
                    </span>
                  </div>

                  {/* Title & Technical Model ID */}
                  <h3 className="font-bengali font-bold text-lg text-forest-950 dark:text-cream-50 leading-snug mb-1">
                    {t(model.nameBn, model.name)}
                  </h3>
                  <p className="font-english text-xs font-mono text-sage-600 dark:text-sage-400 mb-4">
                    ID: {model.id}
                  </p>

                  {/* Input / Output Spec */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="p-2.5 rounded-xl bg-sage-50 dark:bg-forest-950/60 border border-sage-200/80 dark:border-forest-800/80">
                      <span className="font-bengali font-bold text-forest-900 dark:text-forest-200 block mb-0.5">
                        {t('ইনপুট স্পেসিফিকেশন:', 'Input Specification:')}
                      </span>
                      <span className="font-bengali text-charcoal-700 dark:text-sage-300">
                        {t(model.inputSummaryBn, model.inputSummary)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-sage-50 dark:bg-forest-950/60 border border-sage-200/80 dark:border-forest-800/80">
                      <span className="font-bengali font-bold text-forest-900 dark:text-forest-200 block mb-0.5">
                        {t('আউটপুট রেজাল্ট:', 'Output Metric:')}
                      </span>
                      <span className="font-bengali text-charcoal-700 dark:text-sage-300">
                        {t(model.outputSummaryBn, model.outputSummary)}
                      </span>
                    </div>
                  </div>

                  {/* Key Benchmark Metric */}
                  <div className="mb-4">
                    <span className="font-english text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 inline-block">
                      {model.metrics}
                    </span>
                  </div>
                </div>

                {/* Research Caveat Banner */}
                <div className="pt-3 border-t border-sage-200 dark:border-forest-800">
                  <div className="flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-800/50">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span className="font-bengali leading-tight">
                      {t(model.caveatBn, model.caveat)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default ModelCardsSection;
