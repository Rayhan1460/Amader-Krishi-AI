import { useState, useEffect, type FormEvent } from 'react';
import {
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Play,
  History,
  ShieldAlert,
  Beaker,
  Info,
  Calendar,
  Building,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import {
  farmApi,
  soilApi,
  cropRecommendationApi,
  getErrorMessage,
} from '../../../services/api.ts';
import type {
  FarmProfile,
  SoilTest,
  ModelReadinessAssessment,
  FarmCropRecommendationResponse,
} from '../../../types/index.ts';
import { Button } from '../../common/Button.tsx';

import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface FarmCropRecommendationPanelProps {
  initialFarmId?: number | null;
  onViewHistory?: (recordId: number) => void;
  onNavigateToTab?: (tab: WorkspaceTab, arg?: string, extraId?: number) => void;
}

export const CROP_LABELS_BN: Record<string, { bn: string; en: string }> = {
  apple: { bn: 'আপেল', en: 'Apple' },
  banana: { bn: 'কলা', en: 'Banana' },
  blackgram: { bn: 'মাষকলাই ডাল', en: 'Blackgram' },
  chickpea: { bn: 'ছোলা', en: 'Chickpea' },
  coconut: { bn: 'নারিকেল', en: 'Coconut' },
  coffee: { bn: 'কফি', en: 'Coffee' },
  cotton: { bn: 'তুলা', en: 'Cotton' },
  grapes: { bn: 'আঙ্গুর', en: 'Grapes' },
  jute: { bn: 'পাট', en: 'Jute' },
  kidneybeans: { bn: 'শিম / রাজমা', en: 'Kidney Beans' },
  lentil: { bn: 'মসুর ডাল', en: 'Lentil' },
  maize: { bn: 'ভুট্টা', en: 'Maize' },
  mango: { bn: 'আম', en: 'Mango' },
  mothbeans: { bn: 'মথ ডাল', en: 'Moth Beans' },
  mungbean: { bn: 'মুগ ডাল', en: 'Mungbean' },
  muskmelon: { bn: 'বাঙ্গি', en: 'Muskmelon' },
  orange: { bn: 'কমলা', en: 'Orange' },
  papaya: { bn: 'পেঁপে', en: 'Papaya' },
  pigeonpeas: { bn: 'অড়হর ডাল', en: 'Pigeonpeas' },
  pomegranate: { bn: 'ডালিম / বেদানা', en: 'Pomegranate' },
  rice: { bn: 'ধান', en: 'Rice' },
  watermelon: { bn: 'তরমুজ', en: 'Watermelon' },
};

export function FarmCropRecommendationPanel({
  initialFarmId,
  onViewHistory,
  onNavigateToTab,
}: FarmCropRecommendationPanelProps) {
  const { t } = useLanguage();

  // Farm & Soil state
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId || null);
  const [soilTests, setSoilTests] = useState<SoilTest[]>([]);
  const [selectedSoilTestId, setSelectedSoilTestId] = useState<number | null>(null);

  // Readiness state
  const [readiness, setReadiness] = useState<ModelReadinessAssessment | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // Manual 7-Feature Form State
  const [formData, setFormData] = useState({
    N: '',
    P: '',
    K: '',
    temperature: '',
    humidity: '',
    ph: '',
    rainfall: '',
  });

  const [disclaimerConfirmed, setDisclaimerConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<FarmCropRecommendationResponse | null>(null);

  // Load farms on mount
  useEffect(() => {
    let isMounted = true;
    async function loadFarms() {
      try {
        const farmList = await farmApi.listFarms();
        if (isMounted) {
          setFarms(farmList);
          if (farmList.length > 0) {
            if (initialFarmId && farmList.some((f) => f.id === initialFarmId)) {
              setSelectedFarmId(initialFarmId);
            } else if (!selectedFarmId) {
              setSelectedFarmId(farmList[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load farms:', err);
      }
    }
    loadFarms();
    return () => {
      isMounted = false;
    };
  }, [initialFarmId]);

  // When selectedFarmId changes, load its soil tests and readiness assessment
  useEffect(() => {
    if (!selectedFarmId) {
      setSoilTests([]);
      setReadiness(null);
      setSelectedSoilTestId(null);
      return;
    }

    let isMounted = true;

    async function loadFarmSoilAndReadiness() {
      setLoadingReadiness(true);
      setReadinessError(null);
      setPredictionResult(null);
      setFormError(null);

      // Cleanly reset manual inputs on farm change to prevent silent cross-farm reuse
      setFormData({
        N: '',
        P: '',
        K: '',
        temperature: '',
        humidity: '',
        ph: '',
        rainfall: '',
      });
      setDisclaimerConfirmed(false);

      try {
        const tests = await soilApi.getFarmSoilTests(selectedFarmId!);
        if (!isMounted) return;
        setSoilTests(tests);

        const readinessData = await cropRecommendationApi.getReadiness(
          selectedFarmId!,
          selectedSoilTestId || undefined
        );
        if (!isMounted) return;
        setReadiness(readinessData);
      } catch (err) {
        if (isMounted) {
          setReadinessError(getErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setLoadingReadiness(false);
        }
      }
    }

    loadFarmSoilAndReadiness();

    return () => {
      isMounted = false;
    };
  }, [selectedFarmId, selectedSoilTestId]);

  // Handle farm change
  const handleFarmSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null;
    setSelectedFarmId(val);
    setSelectedSoilTestId(null);
  };

  // Handle soil test change
  const handleSoilTestSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null;
    setSelectedSoilTestId(val);
  };

  // Form input change
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  // Reset form
  const handleResetForm = () => {
    setFormData({
      N: '',
      P: '',
      K: '',
      temperature: '',
      humidity: '',
      ph: '',
      rainfall: '',
    });
    setFormError(null);
    setPredictionResult(null);
    setDisclaimerConfirmed(false);
  };

  // Preset experimental values for fast research exploration
  const handleApplyResearchPreset = (presetName: string) => {
    if (presetName === 'rice_floodplain') {
      setFormData({
        N: '90',
        P: '42',
        K: '43',
        temperature: '23.5',
        humidity: '82.0',
        ph: '6.5',
        rainfall: '220.0',
      });
    } else if (presetName === 'winter_maize') {
      setFormData({
        N: '80',
        P: '48',
        K: '20',
        temperature: '21.0',
        humidity: '65.0',
        ph: '6.2',
        rainfall: '75.0',
      });
    } else if (presetName === 'pulses_chickpea') {
      setFormData({
        N: '40',
        P: '65',
        K: '80',
        temperature: '19.0',
        humidity: '55.0',
        ph: '7.2',
        rainfall: '65.0',
      });
    }
    setFormError(null);
    setPredictionResult(null);
  };

  // Form submission to thin authenticated adapter
  const handleSubmitPrediction = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) {
      setFormError(t('অনুগ্রহ করে একটি খামার নির্বাচন করুন।', 'Please select a farm profile.'));
      return;
    }

    if (!disclaimerConfirmed) {
      setFormError(
        t(
          'গবেষণা মডেল ব্যবহারের শর্তাবলি ও বৈজ্ঞানিক সীমাবদ্ধতা নিশ্চিত করতে হবে।',
          'You must acknowledge the research benchmark limitations before running inference.'
        )
      );
      return;
    }

    // Physical and domain validation
    const parsedFeatures: Record<string, number> = {};
    const requiredKeys = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'] as const;

    for (const k of requiredKeys) {
      const strVal = formData[k].trim();
      if (!strVal) {
        setFormError(
          t(
            `'${k}' বৈশিষ্ট্যটির মান প্রদান করা আবশ্যক।`,
            `Feature '${k}' is required and cannot be empty.`
          )
        );
        return;
      }
      const num = parseFloat(strVal);
      if (isNaN(num)) {
        setFormError(
          t(
            `'${k}' অবশ্যই একটি সংখ্যা হতে হবে।`,
            `Feature '${k}' must be a valid number.`
          )
        );
        return;
      }
      parsedFeatures[k] = num;
    }

    // Range checks
    if (parsedFeatures.N < 0 || parsedFeatures.P < 0 || parsedFeatures.K < 0) {
      setFormError(t('নাইট্রোজেন, ফসফরাস ও পটাশিয়ামের মান ঋণাত্মক হতে পারে না।', 'N, P, and K values must be non-negative.'));
      return;
    }
    if (parsedFeatures.ph < 0 || parsedFeatures.ph > 14) {
      setFormError(t('মাটির pH অবশ্যই ০.০ থেকে ১৪.০ এর মধ্যে হতে হবে।', 'Soil pH must be between 0.0 and 14.0.'));
      return;
    }
    if (parsedFeatures.humidity < 0 || parsedFeatures.humidity > 100) {
      setFormError(t('আর্দ্রতা ০% থেকে ১০০% এর মধ্যে হতে হবে।', 'Humidity must be between 0% and 100%.'));
      return;
    }
    if (parsedFeatures.rainfall < 0) {
      setFormError(t('বৃষ্টিপাত ঋণাত্মক হতে পারে না।', 'Rainfall must be non-negative.'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await cropRecommendationApi.predictFarmCrop({
        farm_id: selectedFarmId,
        soil_test_id: selectedSoilTestId || undefined,
        features: parsedFeatures,
        user_confirmed_disclaimer: true,
        input_source_mode: 'manual_research',
      });
      setPredictionResult(response);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  return (
    <div className="space-y-6" data-testid="farm-crop-recommendation-panel">
      {/* Header Banner */}
      <div className="bg-forest-950 rounded-3xl p-6 border border-forest-800 shadow-md text-cream-50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-gold-500/20 border border-gold-500/40 text-gold-300">
                <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('খামারভিত্তিক এআই ফসল সুপারিশ', 'Farm-Aware AI Crop Recommendation')}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-forest-800 text-sage-300">
                Scikit-Learn • 22 Classes
              </span>
            </div>
            <h2 className="font-bengali font-bold text-2xl text-cream-50">
              {t('মাটি ও জলবায়ু উপাত্তভিত্তিক ফসল শ্রেণী নির্ধারণ', 'Data-Informed 22-Crop Class Analysis for Your Farmland')}
            </h2>
            <p className="font-bengali text-xs text-sage-300 leading-relaxed">
              {t(
                'আপনার সংরক্ষিত খামারের মৃত্তিকা পরীক্ষার উপাত্ত এবং স্থানীয় জলবায়ুর বৈজ্ঞানিক সামঞ্জস্য যাচাই করে আন্তর্জাতিক ২২-ফসলি মডেলের মাধ্যমে পরীক্ষণমূলক সুপারিশ বিশ্লেষণ করুন।',
                'Evaluate the scientific compatibility of your farm soil tests and local climate, then run experimental crop recommendations on the verified 22-class model.'
              )}
            </p>
          </div>

          {/* Quick Stats or Navigation */}
          {onNavigateToTab && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigateToTab('soil_health', selectedFarmId ? String(selectedFarmId) : undefined)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-forest-900 text-gold-300 border border-forest-800 hover:bg-forest-850 hover:border-gold-400/40 transition-colors cursor-pointer"
              >
                <Beaker className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('মাটির স্বাস্থ্য ড্যাশবোর্ড', 'Soil Health Dashboard')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selectors Bar: Farm Selector & Soil Test Selector */}
      <div className="bg-white rounded-2xl p-5 border border-sage-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Farm Selector */}
          <div>
            <label className="block text-xs font-bold text-charcoal-800 font-bengali mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-forest-700" />
              <span>{t('খামার নির্বাচন করুন', 'Select Farm Profile')}</span>
              <span className="text-red-500">*</span>
            </label>
            <select
              data-testid="farm-selector"
              value={selectedFarmId || ''}
              onChange={handleFarmSelect}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-cream-50/50 text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
            >
              {farms.length === 0 ? (
                <option value="">{t('কোনো সংরক্ষিত খামার পাওয়া যায়নি', 'No registered farms found')}</option>
              ) : (
                farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name} — {farm.district}, {farm.upazila} ({farm.area} {farm.area_unit})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Soil Test Selector */}
          <div>
            <label className="block text-xs font-bold text-charcoal-800 font-bengali mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-forest-700" />
              <span>{t('মৃত্তিকা পরীক্ষা নির্বাচন (ঐচ্ছিক)', 'Select Soil Test (Optional)')}</span>
            </label>
            <select
              data-testid="soil-test-selector"
              value={selectedSoilTestId || ''}
              onChange={handleSoilTestSelect}
              disabled={soilTests.length === 0}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-cream-50/50 text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent disabled:opacity-50 transition-all"
            >
              <option value="">
                {soilTests.length > 0
                  ? t('সর্বশেষ মৃত্তিকা পরীক্ষা (স্বয়ংক্রিয় রেফারেন্স)', 'Latest Soil Test (Automatic Reference)')
                  : t('কোনো মৃত্তিকা পরীক্ষা সংরক্ষিত নেই', 'No soil tests recorded for this farm')}
              </option>
              {soilTests.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.sample_label || `Test #${st.id}`} ({st.sample_date}) — {st.test_source === 'laboratory' ? (st.laboratory_name || 'Lab') : 'Field Kit'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedFarm && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sage-100 text-[11px] text-sage-700">
            <span className="font-semibold text-charcoal-800">{selectedFarm.name}:</span>
            <span>{selectedFarm.division} বিভাগ</span>
            <span>•</span>
            <span>{selectedFarm.district}, {selectedFarm.upazila}</span>
            <span>•</span>
            <span>আয়তন: {selectedFarm.area} {selectedFarm.area_unit}</span>
            {selectedFarm.soil_type && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-sage-100 font-medium text-forest-800">
                  {selectedFarm.soil_type}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* STEP 3: Input Readiness Panel */}
      {selectedFarmId && (
        <div data-testid="crop-readiness-panel" className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sage-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-forest-50 text-forest-700 flex items-center justify-center">
                <Beaker className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bengali font-bold text-sm text-charcoal-900">
                  {t('ইনপুট প্রস্তুতি ও বৈজ্ঞানিক নিরীক্ষা', 'Input Readiness & Scientific Audit')}
                </h3>
                <p className="text-[11px] text-sage-600 font-bengali">
                  {t('মডেল ইনপুট ও মৃত্তিকা নথির সামঞ্জস্য যাচাই', 'Contract compatibility between model input and farm records')}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span
                data-testid="readiness-status-badge"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{t('গবেষণামূলক ইনপুট আবশ্যক', 'Manual Research Input Required')}</span>
              </span>
            </div>
          </div>

          {/* Loading state */}
          {loadingReadiness && (
            <div className="py-6 text-center text-xs text-sage-600 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-forest-600" />
              <span>{t('মৃত্তিকা উপাত্ত ও প্রস্তুতি যাচাই করা হচ্ছে...', 'Auditing soil measurements and model compatibility...')}</span>
            </div>
          )}

          {/* Error state */}
          {readinessError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{readinessError}</span>
            </div>
          )}

          {/* Readiness Details */}
          {!loadingReadiness && readiness && (
            <div className="space-y-4">
              {/* Critical Policy Notice: Auto-prefill Disabled */}
              <div
                data-testid="auto-prefill-disabled-banner"
                className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1.5"
              >
                <div className="flex items-center gap-2 font-bold font-bengali text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{t('স্বয়ংক্রিয় পূরণ বন্ধ রাখা হয়েছে (Auto-prefill Disabled)', 'Automatic Prefill Disabled')}</span>
                </div>
                <p className="font-bengali text-[11px] leading-relaxed text-amber-800">
                  {t(
                    'বাংলাদেশের মৃত্তিকা ল্যাবরেটরির এনপিকে একক (যেমন meq/100g বা ppm) এবং আবহাওয়ার তাৎক্ষণিক লাইভ রিডিং আন্তর্জাতিক ২২-ফসলি মডেলের প্রশিক্ষণ এককের সাথে অসঙ্গতিপূর্ণ। মডেল বিভ্রান্তি ও ভুল সুপারিশ রোধে সংরক্ষিত মান শুধুমাত্র রেফারেন্স হিসেবে নিচে প্রদর্শিত হলো। ইনপুট ফিল্ডে স্বয়ংক্রিয়ভাবে মান ইনজেক্ট করা হবে না।',
                    'Bangladeshi soil laboratory units (e.g. meq/100g, ppm) and live weather readings are not calibrated to the training benchmark distribution. To prevent erroneous crop advice, stored readings are displayed as reference only and will not be auto-injected.'
                  )}
                </p>
              </div>

              {/* Stored Soil Measurement Context Card */}
              <div data-testid="soil-reference-card" className="p-4 rounded-xl bg-cream-50/60 border border-sage-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bengali font-bold text-charcoal-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-forest-700" />
                    <span>{t('খামারে সংরক্ষিত মৃত্তিকা পরীক্ষার রেফারেন্স উপাত্ত:', 'Recorded Soil Reference Readings:')}</span>
                  </span>
                  {readiness.soil_test_date && (
                    <span className="text-[11px] font-mono text-sage-600">
                      তারিখ: {readiness.soil_test_date} ({readiness.soil_test_lab || readiness.soil_test_source || 'ল্যাবরেটরি'})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* Nitrogen */}
                  <div className="p-2.5 rounded-lg bg-white border border-sage-200">
                    <div className="text-[10px] text-sage-500 font-mono">Nitrogen (N)</div>
                    <div className="text-sm font-bold text-charcoal-900">
                      {readiness.features.N.available_value !== null
                        ? `${readiness.features.N.available_value} ${readiness.features.N.available_unit || ''}`
                        : t('তথ্য পাওয়া যায়নি', 'Data not available')}
                    </div>
                    <div className="text-[9px] text-amber-700 font-mono mt-0.5">একক যাচাইকৃত নয়</div>
                  </div>

                  {/* Phosphorus */}
                  <div className="p-2.5 rounded-lg bg-white border border-sage-200">
                    <div className="text-[10px] text-sage-500 font-mono">Phosphorus (P)</div>
                    <div className="text-sm font-bold text-charcoal-900">
                      {readiness.features.P.available_value !== null
                        ? `${readiness.features.P.available_value} ${readiness.features.P.available_unit || ''}`
                        : t('তথ্য পাওয়া যায়নি', 'Data not available')}
                    </div>
                    <div className="text-[9px] text-amber-700 font-mono mt-0.5">একক যাচাইকৃত নয়</div>
                  </div>

                  {/* Potassium */}
                  <div className="p-2.5 rounded-lg bg-white border border-sage-200">
                    <div className="text-[10px] text-sage-500 font-mono">Potassium (K)</div>
                    <div className="text-sm font-bold text-charcoal-900">
                      {readiness.features.K.available_value !== null
                        ? `${readiness.features.K.available_value} ${readiness.features.K.available_unit || ''}`
                        : t('তথ্য পাওয়া যায়নি', 'Data not available')}
                    </div>
                    <div className="text-[9px] text-amber-700 font-mono mt-0.5">একক যাচাইকৃত নয়</div>
                  </div>

                  {/* Soil pH */}
                  <div className="p-2.5 rounded-lg bg-white border border-sage-200">
                    <div className="text-[10px] text-sage-500 font-mono">Soil pH</div>
                    <div className="text-sm font-bold text-charcoal-900">
                      {readiness.features.ph.available_value !== null
                        ? `${readiness.features.ph.available_value}`
                        : t('তথ্য পাওয়া যায়নি', 'Data not available')}
                    </div>
                    <div className="text-[9px] text-emerald-700 font-mono mt-0.5">স্কেল ০-১৪ সামঞ্জস্যপূর্ণ</div>
                  </div>
                </div>

                {/* Weather Note */}
                <div className="text-[11px] font-bengali text-sage-700 flex items-start gap-1.5 pt-1">
                  <HelpCircle className="w-3.5 h-3.5 text-sage-500 shrink-0 mt-0.5" />
                  <span>
                    {t(
                      'আবহাওয়ার তাপমাত্রা, আর্দ্রতা ও বৃষ্টিপাত: মডেলটিতে মৌসুমি গড় জলবায়ুর মান প্রয়োজন। লাইভ পূর্বাভাস বা ২৪ ঘণ্টার বৃষ্টিপাত (০-২০ মিমি) সরাসরি পাস করা হলে মডেল ত্রুটিপূর্ণ ফসল সুপারিশ করবে।',
                      'Temperature, humidity & rainfall: The model expects seasonal growth cycle averages. Passing daily forecast precipitation (0-20mm) would violate training distributions.'
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Manual Research Input Form */}
      <div className="bg-white rounded-2xl p-6 border border-sage-200 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-sage-100">
          <div>
            <h3 className="font-bengali font-bold text-sm text-charcoal-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-forest-700" />
              <span>{t('গবেষণামূলক ইনপুট ফরম (৭টি আবশ্যক বৈশিষ্ট্য)', 'Manual Research Inputs (7 Required Features)')}</span>
            </h3>
            <p className="text-[11px] text-sage-600 font-bengali">
              {t('আন্তর্জাতিক বেঞ্চমার্ক পরিসরের আলোকে স্পষ্ট সংখ্যাসূচক মান প্রবেশ করান', 'Provide explicit numeric parameters within model benchmark bounds')}
            </p>
          </div>

          {/* Research Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-sage-500 font-bengali mr-1">{t('নমুনা প্রিসেট:', 'Presets:')}</span>
            <button
              type="button"
              onClick={() => handleApplyResearchPreset('rice_floodplain')}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-sage-50 text-forest-800 border border-sage-200 hover:bg-forest-50 hover:border-forest-300 transition-colors cursor-pointer"
            >
              ধান (Rice Delta)
            </button>
            <button
              type="button"
              onClick={() => handleApplyResearchPreset('winter_maize')}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-sage-50 text-forest-800 border border-sage-200 hover:bg-forest-50 hover:border-forest-300 transition-colors cursor-pointer"
            >
              ভুট্টা (Winter Maize)
            </button>
            <button
              type="button"
              onClick={() => handleApplyResearchPreset('pulses_chickpea')}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-sage-50 text-forest-800 border border-sage-200 hover:bg-forest-50 hover:border-forest-300 transition-colors cursor-pointer"
            >
              ছোলা (Chickpea)
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmitPrediction} data-testid="crop-input-form" className="space-y-5">
          {/* NPK Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Nitrogen (N)
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-N"
                type="number"
                step="any"
                value={formData.N}
                onChange={(e) => handleInputChange('N', e.target.value)}
                placeholder="e.g. 90"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">বেঞ্চমার্ক অনুপাত (০ - ১৪০)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Phosphorus (P)
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-P"
                type="number"
                step="any"
                value={formData.P}
                onChange={(e) => handleInputChange('P', e.target.value)}
                placeholder="e.g. 42"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">বেঞ্চমার্ক অনুপাত (৫ - ১৪৫)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                Potassium (K)
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-K"
                type="number"
                step="any"
                value={formData.K}
                onChange={(e) => handleInputChange('K', e.target.value)}
                placeholder="e.g. 43"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">বেঞ্চমার্ক অনুপাত (৫ - ২০৫)</span>
            </div>
          </div>

          {/* Environmental Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                তাপমাত্রা (°C)
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-temperature"
                type="number"
                step="any"
                value={formData.temperature}
                onChange={(e) => handleInputChange('temperature', e.target.value)}
                placeholder="e.g. 23.5"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">মৌসুমি গড় (৮.৮ - ৪৩.৭ °C)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                আর্দ্রতা (%)
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-humidity"
                type="number"
                step="any"
                value={formData.humidity}
                onChange={(e) => handleInputChange('humidity', e.target.value)}
                placeholder="e.g. 80.0"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">মৌসুমি গড় (১৪ - ১০০ %)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                মাটির pH
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-ph"
                type="number"
                step="any"
                value={formData.ph}
                onChange={(e) => handleInputChange('ph', e.target.value)}
                placeholder="e.g. 6.5"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">স্কেল ০ - ১৪ (বেঞ্চমার্ক ৩.৫ - ৯.৯)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-800 mb-1">
                বৃষ্টিপাত (mm)
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                data-testid="input-rainfall"
                type="number"
                step="any"
                value={formData.rainfall}
                onChange={(e) => handleInputChange('rainfall', e.target.value)}
                placeholder="e.g. 200.0"
                required
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-sage-300 bg-white text-charcoal-900 focus:outline-hidden focus:ring-2 focus:ring-forest-600 focus:border-transparent transition-all"
              />
              <span className="text-[10px] text-sage-500 font-mono block mt-1">মৌসুমি মোট (২০ - ২৯৮.৬ মিমি)</span>
            </div>
          </div>

          {/* Explicit Research Limitations Disclaimer Acknowledgment */}
          <div data-testid="scientific-caveats-box" className="p-4 rounded-xl bg-forest-950 text-cream-100 border border-forest-800 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bengali font-bold text-xs text-gold-300">
                  {t('বৈজ্ঞানিক সীমাবদ্ধতা ও গবেষণা শর্তাবলি', 'Scientific Limitations & Research Disclaimer')}
                </h4>
                <p className="font-bengali text-[11px] text-sage-300 leading-relaxed">
                  {t(
                    'এই মডেলটি একটি উন্মুক্ত আন্তর্জাতিক গবেষণা বেঞ্চমার্ক ডাটাবেসের ওপর প্রশিক্ষিত (Accuracy 99.3%, Macro F1 0.993)। এটি বাংলাদেশের কৃষি সম্প্রসারণ অধিদপ্তর (DAE) বা বিএআরআই/এসআরডিআই দ্বারা মাঠপর্যায়ে সরাসরি সার সুপারিশ বা সরকারি কৃষি পরামর্শ হিসেবে প্রত্যয়িত নয়। বাস্তব কৃষিকাজে আপনার উপজেলা কৃষি অফিসার বা মৃত্তিকা বিজ্ঞানীদের সাথে পরামর্শ করুন।',
                    'This model is trained on a public benchmark dataset (99.3% accuracy). It is NOT certified field extension advice for Bangladesh farmland. Consult your local Upazila Agriculture Officer for certified soil recommendations.'
                  )}
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-2 border-t border-forest-800/80 cursor-pointer">
              <input
                data-testid="disclaimer-checkbox"
                type="checkbox"
                checked={disclaimerConfirmed}
                onChange={(e) => setDisclaimerConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-forest-700 text-forest-600 focus:ring-gold-400"
              />
              <span className="font-bengali text-xs font-medium text-cream-200">
                {t(
                  'আমি বৈজ্ঞানিক সীমাবদ্ধতা ও গবেষণা শর্তাবলি বুঝেছি এবং পরীক্ষামূলকভাবে এআই সুপারিশ দেখতে সম্মত হচ্ছি।',
                  'I acknowledge the scientific research limitations and agree to proceed with experimental AI inference.'
                )}
              </span>
            </label>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div data-testid="crop-prediction-error" className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800 font-bengali">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              data-testid="predict-crop-btn"
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting || !disclaimerConfirmed}
              leftIcon={<Play className="w-4 h-4" />}
              className="font-bengali font-bold"
            >
              {t('ফসল সুপারিশ বিশ্লেষণ করুন', 'Compute Crop Recommendation')}
            </Button>

            <Button
              data-testid="reset-form-btn"
              type="button"
              variant="ghost"
              size="md"
              onClick={handleResetForm}
              leftIcon={<RefreshCw className="w-4 h-4 text-sage-600" />}
              className="font-bengali"
            >
              {t('রিসেট', 'Reset Form')}
            </Button>
          </div>
        </form>
      </div>

      {/* STEP 5: Model Prediction Result Display */}
      {predictionResult && (
        <div data-testid="crop-prediction-result" className="bg-white rounded-3xl p-6 border-2 border-forest-600 shadow-md space-y-5 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sage-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-forest-50 text-forest-800 border border-forest-200 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-forest-700" />
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-forest-100 text-forest-800 font-semibold">
                  ANALYSIS COMPLETED • MODEL: crop_recommendation
                </span>
                <h3 className="font-bengali font-bold text-lg text-charcoal-900 mt-0.5">
                  {t('এআই ফসল সুপারিশ ফলাফল', 'AI Crop Recommendation Result')}
                </h3>
              </div>
            </div>

            {/* View History Button */}
            {predictionResult.record_id && onViewHistory && (
              <button
                data-testid="view-history-btn"
                type="button"
                onClick={() => onViewHistory(predictionResult.record_id!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sage-50 text-forest-900 border border-sage-200 hover:bg-forest-50 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-forest-700" />
                <span>{t('প্রেডিকশন ইতিহাসে দেখুন', 'View in History')}</span>
              </button>
            )}
          </div>

          {/* Primary Recommended Crop Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-forest-950 via-forest-900 to-forest-950 text-cream-50 border border-gold-500/40 shadow-sm">
            <div className="text-[11px] font-mono text-gold-400 font-semibold mb-1">
              PRIMARY RECOMMENDED CROP CLASS (২২-ফসলি শ্রেণী)
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2
                data-testid="recommended-crop-name"
                className="font-bengali font-bold text-3xl text-cream-50"
              >
                {CROP_LABELS_BN[predictionResult.prediction.recommended_crop]?.bn || predictionResult.prediction.recommended_crop}
              </h2>
              <span className="text-base text-gold-300 font-medium">
                ({CROP_LABELS_BN[predictionResult.prediction.recommended_crop]?.en || predictionResult.prediction.recommended_crop})
              </span>
            </div>
            <p className="font-bengali text-xs text-sage-300 mt-2 leading-relaxed max-w-2xl">
              {t(
                'প্রদত্ত মৃত্তিকা ও জলবায়ু পরামিতির ভিত্তিতে ২২-ফসলি র্যান্ডম ফরেস্ট মডেল এই ফসল শ্রেণীটিকে শীর্ষ শ্রেণী হিসেবে চিহ্নিত করেছে। এটি কোনো নির্দিষ্ট জাত বা ফলনের নিশ্চয়তা নির্দেশ করে না।',
                'Based on the provided soil and environmental parameters, the 22-class Random Forest model classified this crop category as the top match. This indicates a general crop class, not a specific cultivar, guaranteed suitability, or yield.'
              )}
            </p>
          </div>

          {/* Alternative Candidates */}
          {predictionResult.prediction.top_alternatives && (
            <div className="space-y-2">
              <h4 className="font-bengali font-bold text-xs text-charcoal-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-forest-700" />
                <span>{t('বিকল্প সম্ভাব্য ফসল শ্রেণী (মডেলের আনক্যালিব্রেটেড সম্ভাব্যতা স্কোর):', 'Alternative Candidate Crop Classes (Uncalibrated Model Probability Scores):')}</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(predictionResult.prediction.top_alternatives).map(([cropKey, prob]) => (
                  <div key={cropKey} className="p-3 rounded-xl bg-cream-50/70 border border-sage-200">
                    <div className="font-bengali font-bold text-xs text-charcoal-900">
                      {CROP_LABELS_BN[cropKey]?.bn || cropKey}
                    </div>
                    <div className="text-[10px] text-sage-600 font-mono">
                      {CROP_LABELS_BN[cropKey]?.en || cropKey}
                    </div>
                    <div className="text-xs font-mono font-bold text-forest-800 mt-1">
                      {(prob * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bengali text-sage-600 italic">
                {t(
                  '* প্রদর্শিত শতাংশ মান মডেলের আনক্যালিব্রেটেড সিদ্ধান্ত-বৃক্ষ সম্ভাব্যতা (Uncalibrated Ensemble Probabilities); এটি মাঠে ফলন বা লাভজনকতার নিশ্চয়তা দেয় না।',
                  '* Displayed percentages represent raw, uncalibrated decision tree ensemble probabilities; they do not guarantee field suitability, yield, or profit.'
                )}
              </p>
            </div>
          )}

          {/* Submitted Parameters Summary */}
          <div className="p-4 rounded-xl bg-sage-50/60 border border-sage-200 text-xs space-y-2">
            <span className="font-semibold text-charcoal-800 font-bengali">
              {t('দাখিলকৃত ইনপুট উপাত্ত ও প্রেডিকশন মেটাডাটা:', 'Submitted Inputs & Prediction Metadata:')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-sage-800 font-mono">
              <div>খামার: <span className="font-semibold text-charcoal-900">{predictionResult.farm_name}</span></div>
              <div>N: <span className="font-semibold">{predictionResult.submitted_features.N}</span></div>
              <div>P: <span className="font-semibold">{predictionResult.submitted_features.P}</span></div>
              <div>K: <span className="font-semibold">{predictionResult.submitted_features.K}</span></div>
              <div>তাপমাত্রা: <span className="font-semibold">{predictionResult.submitted_features.temperature}°C</span></div>
              <div>আর্দ্রতা: <span className="font-semibold">{predictionResult.submitted_features.humidity}%</span></div>
              <div>pH: <span className="font-semibold">{predictionResult.submitted_features.ph}</span></div>
              <div>বৃষ্টিপাত: <span className="font-semibold">{predictionResult.submitted_features.rainfall} mm</span></div>
            </div>
          </div>

          {/* Official Caveat */}
          <div
            data-testid="scientific-caveat-banner"
            className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 font-bengali leading-relaxed flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{t('অফিসিয়াল রিসার্চ নোটিশ (গবেষণা সীমাবদ্ধতা):', 'Official Research Notice (Limitations):')}</span>{' '}
              {predictionResult.scientific_caveat}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

