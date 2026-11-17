// Premium Historical Market Price Intelligence Console (Phase F5E-5)
// Models: tomato_price & boro_rice_price (RandomForestRegressor)
// Strictly enforces 10-feature historical wholesale inputs, baseline supremacy (lag_1),
// mathematical accuracy in error reporting, and explicit input provenance disclosure.

import { useState, useMemo, useEffect, type FormEvent } from 'react';
import {
  TrendingUp,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Play,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Layers,
  ShieldCheck,
  History,
} from 'lucide-react';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { useLanguage } from '../../../context/LanguageContext.tsx';

interface MarketPriceToolProps {
  initialCommodity?: 'tomato_price' | 'boro_rice_price';
  onViewHistory?: (recordId: number) => void;
}

// 10-Feature Schema Specification
export const MARKET_PRICE_FEATURES = [
  {
    key: 'lag_1',
    nameBn: 'পূর্ববর্তী সপ্তাহের পাইকারি দর (lag_1)',
    nameEn: 'Previous Week Wholesale Price (lag_1)',
    unit: 'BDT/kg',
    descriptionBn: 'সর্বশেষ পর্যবেক্ষিত সাপ্তাহিক পাইকারি দর — এটিই মূল বেসলাইন পূর্বাভাস।',
    descriptionEn: 'Last observed weekly wholesale price — serves as empirical baseline benchmark.',
  },
  {
    key: 'lag_2',
    nameBn: '২ সপ্তাহ পূর্বের পাইকারি দর (lag_2)',
    nameEn: '2 Weeks Prior Wholesale Price (lag_2)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ২য় সপ্তাহের পাইকারি দর।',
    descriptionEn: 'Wholesale price 2 weeks prior.',
  },
  {
    key: 'lag_3',
    nameBn: '৩ সপ্তাহ পূর্বের পাইকারি দর (lag_3)',
    nameEn: '3 Weeks Prior Wholesale Price (lag_3)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ৩য় সপ্তাহের পাইকারি দর।',
    descriptionEn: 'Wholesale price 3 weeks prior.',
  },
  {
    key: 'lag_4',
    nameBn: '৪ সপ্তাহ পূর্বের পাইকারি দর (lag_4)',
    nameEn: '4 Weeks Prior Wholesale Price (lag_4)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ৪র্থ সপ্তাহের পাইকারি দর।',
    descriptionEn: 'Wholesale price 4 weeks prior.',
  },
  {
    key: 'lag_8',
    nameBn: '৮ সপ্তাহ পূর্বের পাইকারি দর (lag_8)',
    nameEn: '8 Weeks Prior Wholesale Price (lag_8)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ৮ম সপ্তাহের পাইকারি দর।',
    descriptionEn: 'Wholesale price 8 weeks prior.',
  },
  {
    key: 'lag_12',
    nameBn: '১২ সপ্তাহ পূর্বের পাইকারি দর (lag_12)',
    nameEn: '12 Weeks Prior Wholesale Price (lag_12)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ১২শ সপ্তাহের পাইকারি দর।',
    descriptionEn: 'Wholesale price 12 weeks prior.',
  },
  {
    key: 'past_mean_4',
    nameBn: 'বিগত ৪ সপ্তাহের রোলিং গড় (past_mean_4)',
    nameEn: 'Past 4-Week Rolling Mean (past_mean_4)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ৪ সপ্তাহের পাইকারি মূল্যের সাধারণ গড়।',
    descriptionEn: 'Arithmetic mean of prior 4 weekly wholesale prices.',
  },
  {
    key: 'past_mean_8',
    nameBn: 'বিগত ৮ সপ্তাহের রোলিং গড় (past_mean_8)',
    nameEn: 'Past 8-Week Rolling Mean (past_mean_8)',
    unit: 'BDT/kg',
    descriptionBn: 'পূর্ববর্তী ৮ সপ্তাহের পাইকারি মূল্যের সাধারণ গড়।',
    descriptionEn: 'Arithmetic mean of prior 8 weekly wholesale prices.',
  },
  {
    key: 'month',
    nameBn: 'মৌসুমের মাস (month)',
    nameEn: 'Calendar Month (month)',
    unit: '১ - ১২',
    descriptionBn: 'পূর্বাভাস পরিধির ক্যালেন্ডার মাস।',
    descriptionEn: 'Calendar month index (1 to 12).',
  },
  {
    key: 'week_of_month',
    nameBn: 'মাসের সপ্তাহ (week_of_month)',
    nameEn: 'Week of Month (week_of_month)',
    unit: '১ - ৫',
    descriptionBn: 'সংশ্লিষ্ট মাসের সপ্তাহিক ক্রম।',
    descriptionEn: 'Ordinal week index within month (1 to 5).',
  },
];

// Archived Historical Benchmarks
const TOMATO_PRESETS = [
  {
    id: 'tomato_peak',
    nameBn: 'টমেটো পিক সিজন বেঞ্চমার্ক (ফেব্রু ২০২৬)',
    nameEn: 'Tomato Peak Season Benchmark (Feb 2026)',
    data: {
      lag_1: '45.0',
      lag_2: '42.5',
      lag_3: '40.0',
      lag_4: '38.0',
      lag_8: '35.0',
      lag_12: '32.0',
      past_mean_4: '41.38',
      past_mean_8: '38.25',
      month: '2',
      week_of_month: '3',
    },
  },
  {
    id: 'tomato_harvest_low',
    nameBn: 'ফসল তোলার পর সরবরাহ বৃদ্ধি (২৮ টাকা)',
    nameEn: 'Post-Harvest Influx Low (28 BDT)',
    data: {
      lag_1: '28.0',
      lag_2: '30.0',
      lag_3: '32.5',
      lag_4: '35.0',
      lag_8: '42.0',
      lag_12: '48.0',
      past_mean_4: '31.38',
      past_mean_8: '36.50',
      month: '2',
      week_of_month: '4',
    },
  },
  {
    id: 'tomato_monsoon_high',
    nameBn: 'বর্ষাকালীন সরবরাহ সংকট (৬৫ টাকা)',
    nameEn: 'Monsoon Scarcity Peak (65 BDT)',
    data: {
      lag_1: '65.0',
      lag_2: '60.0',
      lag_3: '58.0',
      lag_4: '54.0',
      lag_8: '48.0',
      lag_12: '42.0',
      past_mean_4: '59.25',
      past_mean_8: '53.60',
      month: '7',
      week_of_month: '2',
    },
  },
];

const BORO_PRESETS = [
  {
    id: 'boro_stable',
    nameBn: 'বোরো ধান স্থিতিশীল পাইকারি দর (ফেব্রু ২০২৬)',
    nameEn: 'Boro Rice Stable Wholesale (Feb 2026)',
    data: {
      lag_1: '29.2',
      lag_2: '28.8',
      lag_3: '28.5',
      lag_4: '28.0',
      lag_8: '27.5',
      lag_12: '27.0',
      past_mean_4: '28.62',
      past_mean_8: '28.15',
      month: '2',
      week_of_month: '3',
    },
  },
  {
    id: 'boro_harvest_dip',
    nameBn: 'বোরো কাটা মৌসুমে বাজারে সরবরাহ (২৬.৫ টাকা)',
    nameEn: 'Boro Harvest Season Influx (26.5 BDT)',
    data: {
      lag_1: '26.5',
      lag_2: '27.0',
      lag_3: '28.0',
      lag_4: '29.0',
      lag_8: '30.5',
      lag_12: '31.0',
      past_mean_4: '27.62',
      past_mean_8: '28.85',
      month: '5',
      week_of_month: '2',
    },
  },
];

export function MarketPriceTool({
  initialCommodity = 'tomato_price',
  onViewHistory,
}: MarketPriceToolProps) {
  const { t } = useLanguage();
  const [commodity, setCommodity] = useState<'tomato_price' | 'boro_rice_price'>(initialCommodity);

  const initialPreset = initialCommodity === 'tomato_price' ? TOMATO_PRESETS[0] : BORO_PRESETS[0];

  const [activePreset, setActivePreset] = useState<{ id: string; nameBn: string; nameEn: string } | null>({
    id: initialPreset.id,
    nameBn: initialPreset.nameBn,
    nameEn: initialPreset.nameEn,
  });

  const [formData, setFormData] = useState<Record<string, string>>({ ...initialPreset.data });

  useEffect(() => {
    if (initialCommodity && initialCommodity !== commodity) {
      setCommodity(initialCommodity);
      const newPreset = initialCommodity === 'tomato_price' ? TOMATO_PRESETS[0] : BORO_PRESETS[0];
      setActivePreset({ id: newPreset.id, nameBn: newPreset.nameBn, nameEn: newPreset.nameEn });
      setFormData({ ...newPreset.data });
      setResult(null);
      setError(null);
    }
  }, [initialCommodity]);

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  // Switch Commodity
  const handleCommodityChange = (newComm: 'tomato_price' | 'boro_rice_price') => {
    setCommodity(newComm);
    const newPreset = newComm === 'tomato_price' ? TOMATO_PRESETS[0] : BORO_PRESETS[0];
    setActivePreset({ id: newPreset.id, nameBn: newPreset.nameBn, nameEn: newPreset.nameEn });
    setFormData({ ...newPreset.data });
    setResult(null);
    setError(null);
  };

  // Check if any required feature is empty
  const isMissingInputs = useMemo(() => {
    return Object.values(formData).some((v) => !v.trim());
  }, [formData]);

  // Handle Preset Click
  const handleLoadPreset = (preset: typeof TOMATO_PRESETS[0]) => {
    setActivePreset({ id: preset.id, nameBn: preset.nameBn, nameEn: preset.nameEn });
    setFormData({ ...preset.data });
    setError(null);
    setResult(null);
  };

  // Handle field edits (invalidates preset provenance)
  const handleFieldChange = (key: string, val: string) => {
    setActivePreset(null);
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  // Clear all inputs
  const handleClearInputs = () => {
    setActivePreset(null);
    const cleared: Record<string, string> = {};
    for (const feat of MARKET_PRICE_FEATURES) {
      cleared[feat.key] = '';
    }
    setFormData(cleared);
    setError(null);
    setResult(null);
  };

  // Form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isMissingInputs) {
      setError(
        t(
          'অনুগ্রহ করে সকল ১০টি আবশ্যিক ইনপুট পূরণ করুন অথবা একটি সংরক্ষিত বেঞ্চমার্ক লোড করুন।',
          'Please provide all 10 required features or load a historical benchmark.'
        )
      );
      return;
    }

    if (!disclaimerAccepted) {
      setError(
        t(
          'অনুগ্রহ করে নিশ্চিতকরণ চেকবক্সে সম্মতি দিন যে এটি একটি ঐতিহাসিক গবেষণা বেঞ্চমার্ক।',
          'Please accept the scientific baseline disclaimer before running inference.'
        )
      );
      return;
    }

    setIsSubmitting(true);

    const payload: Record<string, number> = {};
    for (const [key, val] of Object.entries(formData)) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        setError(
          t(
            `'${key}' ঘরে সঠিক সংখ্যাগত মান দিন।`,
            `Field '${key}' must be a valid numeric value.`
          )
        );
        setIsSubmitting(false);
        return;
      }
      payload[key] = num;
    }

    try {
      const res = await predictionApi.predict(commodity, { data: payload });
      setResult(res);
      setIsAuditDrawerOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTomato = commodity === 'tomato_price';
  const presets = isTomato ? TOMATO_PRESETS : BORO_PRESETS;

  // Mathematically corrected empirical metrics:
  // Random Forest Test MAE is ~64.5% HIGHER than naive baseline for Tomato.
  const empiricalStats = isTomato
    ? {
        commodityBn: 'টমেটো (Tomato)',
        commodityEn: 'Tomato',
        modelTestMae: '৯.৬২',
        baselineTestMae: '৫.৮৪',
        errorDifferencePercent: '৬৪.৫%',
        modelTestMaeEn: '9.62',
        baselineTestMaeEn: '5.84',
        errorDifferencePercentEn: '64.5%',
      }
    : {
        commodityBn: 'বোরো ধান (Boro Rice)',
        commodityEn: 'Boro Rice',
        modelTestMae: '০.৭৫',
        baselineTestMae: '০.৭৪',
        errorDifferencePercent: '২.২%',
        modelTestMaeEn: '0.75',
        baselineTestMaeEn: '0.74',
        errorDifferencePercentEn: '2.2%',
      };

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Historical Data Cutoff Notice (February 22, 2026) */}
      <div className="bg-forest-950 rounded-3xl p-6 border border-forest-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-forest-900 text-amber-400 border border-forest-750">
                  {commodity}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {t('ঐতিহাসিক পাইকারি উপাত্ত', 'Historical Wholesale Data')}
                </span>
              </div>
              <h1 className="font-bengali font-bold text-xl sm:text-2xl text-cream-50 mt-1">
                {t('ঐতিহাসিক পাইকারি বাজারদর ও মূল্য পূর্বাভাস', 'Historical Wholesale Market Price Forecaster')}
              </h1>
            </div>
          </div>

          {/* Commodity Switcher Toggle */}
          <div className="flex items-center bg-forest-900/90 p-1.5 rounded-2xl border border-forest-800 shrink-0">
            <button
              type="button"
              data-testid="tomato-commodity-btn"
              onClick={() => handleCommodityChange('tomato_price')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold font-bengali transition-all cursor-pointer ${
                isTomato
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-sage-400 hover:text-cream-100 hover:bg-forest-800/60'
              }`}
            >
              {t('টমেটো পাইকারি দর', 'Tomato Wholesale')}
            </button>
            <button
              type="button"
              data-testid="rice-commodity-btn"
              onClick={() => handleCommodityChange('boro_rice_price')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold font-bengali transition-all cursor-pointer ${
                !isTomato
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-sage-400 hover:text-cream-100 hover:bg-forest-800/60'
              }`}
            >
              {t('বোরো ধান পাইকারি দর', 'Boro Rice Wholesale')}
            </button>
          </div>
        </div>

        {/* Explicit Historical Cutoff Alert */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-200">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              {t(
                'উপাত্তের সময়সীমা সমাপ্তি: ২২ ফেব্রুয়ারি, ২০২৬ (Department of Agricultural Marketing - DAM)',
                'Historical Series Cutoff: February 22, 2026 (Department of Agricultural Marketing - DAM)'
              )}
            </p>
            <p className="text-[11px] text-amber-200/90 leading-relaxed font-bengali">
              {t(
                'এই টাইম-সিরিজ মডেলটি শুধুমাত্র ২০২২ সালের ৮ জানুয়ারি থেকে ২০২৬ সালের ২২ ফেব্রুয়ারি পর্যন্ত বাংলাদেশ কৃষি বিপণন অধিদপ্তরের (DAM) সাপ্তাহিক পাইকারি মধ্যম মূল্যের ওপর প্রশিক্ষিত। এটি খুচরা বাজারের তাৎক্ষণিক বাজারদর নয় এবং ভবিষ্যতের কোনো কাল্পনিক দাম তৈরি করে না।',
                'This time-series model was trained strictly on weekly wholesale midpoint prices from the Department of Agricultural Marketing (DAM) between Jan 8, 2022 and Feb 22, 2026. It reflects historical wholesale benchmarks, not current retail bazar pricing.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Baseline Superiority & Scientific Discovery Banner */}
      <div
        className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md"
        data-testid="baseline-superiority-banner"
      >
        <div className="flex items-start gap-3.5 mb-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bengali font-bold text-base text-cream-50">
              {t(
                'বৈজ্ঞানিক সততা ও বেসলাইন নীতি: নেটিভ বেসলাইন কেন প্রধান প্রস্তাবিত মূল্য?',
                'Scientific Honesty: Why the Naive Last-Observed Baseline is Primary Advice'
              )}
            </h3>
            <p className="font-bengali text-xs text-sage-300 mt-1 leading-relaxed">
              {t(
                `আমাদের কৃষি AI-এর নিরপেক্ষ বৈজ্ঞানিক মূল্যায়নে দেখা গেছে যে স্বল্পমেয়াদী পাইকারি বাজারে পূর্ববর্তী সপ্তাহের মূল্যের সাধারণ অনুকরণ (Naive Baseline - lag_1) মেশিন লার্নিং মডেলের চেয়ে কম ত্রুটি নির্দেশ করে। ${empiricalStats.commodityBn}-এর ক্ষেত্রে টেস্ট সেটে র‍্যান্ডম ফরেস্ট মডেলের MAE ত্রুটি বেসলাইনের চেয়ে প্রায় ${empiricalStats.errorDifferencePercent} বেশি (মডেল MAE: ৯.৬২ বনাম বেসলাইন MAE: ৫.৮৪ BDT/kg)।`,
                `Empirical research shows that the last-observed weekly price (Naive Baseline - lag_1) achieves lower forecasting error than the Random Forest ML model. For ${empiricalStats.commodityEn}, Random Forest test MAE is approximately ${empiricalStats.errorDifferencePercentEn} higher than the naive baseline MAE (Model: 9.62 vs Baseline: 5.84 BDT/kg).`
              )}
            </p>
          </div>
        </div>

        {/* Empirical Evidence Grid (Mathematically Rigorous) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-forest-800 text-center">
          <div className="bg-forest-950/70 p-3 rounded-xl border border-forest-800">
            <span className="text-[11px] text-sage-400 font-bengali block">
              {t('প্রস্তাবিত বেসলাইন Test MAE', 'Recommended Baseline Test MAE')}
            </span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {empiricalStats.baselineTestMae} BDT/kg
            </span>
          </div>
          <div className="bg-forest-950/70 p-3 rounded-xl border border-forest-800">
            <span className="text-[11px] text-sage-400 font-bengali block">
              {t('র‍্যান্ডম ফরেস্ট এআই Test MAE', 'Random Forest Model Test MAE')}
            </span>
            <span className="text-base font-bold text-amber-400 font-mono">
              {empiricalStats.modelTestMae} BDT/kg
            </span>
          </div>
          <div className="bg-forest-950/70 p-3 rounded-xl border border-forest-800">
            <span className="text-[11px] text-sage-400 font-bengali block">
              {t('মডেলের ত্রুটির আধিক্য', 'Model Excess Error')}
            </span>
            <span className="text-base font-bold text-amber-300 font-mono">
              +{empiricalStats.errorDifferencePercent} {t('বেশি ত্রুটি (Higher MAE)', 'Higher MAE')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Archived Historical Benchmark Presets & Controls */}
      <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-forest-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <h2 className="font-bengali font-bold text-sm text-cream-100">
              {t('ঐতিহাসিক দৃশ্যপট ও আর্কাইভ বেঞ্চমার্ক:', 'Archived Historical Scenarios:')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="clear-inputs-btn"
              onClick={handleClearInputs}
              className="px-3 py-1.5 rounded-xl bg-forest-800/80 hover:bg-forest-800 text-sage-300 hover:text-red-400 text-xs font-bengali border border-forest-750 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('সব ইনপুট মুছুন', 'Clear All Inputs')}</span>
            </button>
            <button
              type="button"
              data-testid="reset-benchmark-btn"
              onClick={() => handleLoadPreset(presets[0])}
              className="px-3 py-1.5 rounded-xl bg-forest-800/80 hover:bg-forest-800 text-gold-400 text-xs font-bengali border border-forest-750 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('বেঞ্চমার্ক পুনরুদ্ধার', 'Reset Benchmark')}</span>
            </button>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-2.5 pt-4">
          {presets.map((p) => {
            const isSelected = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`preset-${p.id}`}
                onClick={() => handleLoadPreset(p)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bengali font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-forest-950/80 hover:bg-forest-850 text-sage-200 hover:text-gold-300 border border-forest-800 hover:border-gold-500/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-gold-400'}`} />
                <span>{t(p.nameBn, p.nameEn)}</span>
              </button>
            );
          })}
        </div>

        {/* Missing Inputs Warning */}
        {isMissingInputs && (
          <div
            className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200"
            data-testid="missing-inputs-warning"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 font-bengali">
                {t(
                  '১০টি আবশ্যিক ইনপুটের মধ্যে কিছু ইনপুট এখনো খালি রয়েছে।',
                  'Some of the 10 required features are missing.'
                )}
              </p>
              <p className="text-[11px] text-amber-200/80 font-bengali mt-0.5">
                {t(
                  'অনুগ্রহ করে উপরের যেকোনো সংরক্ষিত বেঞ্চমার্ক বোতামে চাপ দিন অথবা নিচের সকল ঘরে সংখ্যাগত মান প্রদান করুন।',
                  'Please select a historical scenario above or fill all 10 numeric fields below.'
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Complete 10-Feature Historical Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Recent Weekly Lags */}
        <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-400" />
            <h3 className="font-bengali font-bold text-sm text-cream-100">
              {t('ক. সাম্প্রতিক সাপ্তাহিক পাইকারি দর (Recent Weekly Lags)', 'A. Recent Weekly Wholesale Lags')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* lag_1 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-gold-300 font-bengali block mb-1">
                {t('পূর্ববর্তী সপ্তাহের দর (lag_1) *', 'Previous Week Price (lag_1) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-lag_1"
                  value={formData.lag_1}
                  onChange={(e) => handleFieldChange('lag_1', e.target.value)}
                  placeholder="e.g. 45.0"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('সর্বশেষ দাম (মূল বেসলাইন)', 'Last observed (primary baseline)')}
              </p>
            </div>

            {/* lag_2 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('২ সপ্তাহ পূর্বের দর (lag_2) *', '2 Weeks Prior (lag_2) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-lag_2"
                  value={formData.lag_2}
                  onChange={(e) => handleFieldChange('lag_2', e.target.value)}
                  placeholder="e.g. 42.5"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('পূর্ববর্তী ২য় সপ্তাহের দর', 'Wholesale price 2 weeks prior')}
              </p>
            </div>

            {/* lag_3 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('৩ সপ্তাহ পূর্বের দর (lag_3) *', '3 Weeks Prior (lag_3) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-lag_3"
                  value={formData.lag_3}
                  onChange={(e) => handleFieldChange('lag_3', e.target.value)}
                  placeholder="e.g. 40.0"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('পূর্ববর্তী ৩য় সপ্তাহের দর', 'Wholesale price 3 weeks prior')}
              </p>
            </div>

            {/* lag_4 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('৪ সপ্তাহ পূর্বের দর (lag_4) *', '4 Weeks Prior (lag_4) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-lag_4"
                  value={formData.lag_4}
                  onChange={(e) => handleFieldChange('lag_4', e.target.value)}
                  placeholder="e.g. 38.0"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('পূর্ববর্তী ৪র্থ সপ্তাহের দর', 'Wholesale price 4 weeks prior')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Historical Lags & Moving Averages */}
        <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h3 className="font-bengali font-bold text-sm text-cream-100">
              {t('খ. পূর্ববর্তী দীর্ঘমেয়াদী গতিবিধি ও রোলিং গড় (Longer Lags & Means)', 'B. Longer Historical Lags & Rolling Means')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* lag_8 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('৮ সপ্তাহ পূর্বের দর (lag_8) *', '8 Weeks Prior (lag_8) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-lag_8"
                  value={formData.lag_8}
                  onChange={(e) => handleFieldChange('lag_8', e.target.value)}
                  placeholder="e.g. 35.0"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('২ মাস পূর্বের দাম', 'Price 2 months prior')}
              </p>
            </div>

            {/* lag_12 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('১২ সপ্তাহ পূর্বের দর (lag_12) *', '12 Weeks Prior (lag_12) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-lag_12"
                  value={formData.lag_12}
                  onChange={(e) => handleFieldChange('lag_12', e.target.value)}
                  placeholder="e.g. 32.0"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('৩ মাস পূর্বের দাম', 'Price 3 months prior')}
              </p>
            </div>

            {/* past_mean_4 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('বিগত ৪ সপ্তাহের গড় (past_mean_4) *', 'Past 4-Week Mean (past_mean_4) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-past_mean_4"
                  value={formData.past_mean_4}
                  onChange={(e) => handleFieldChange('past_mean_4', e.target.value)}
                  placeholder="e.g. 41.38"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('১ মাসের রোলিং গড়', '1-month rolling mean')}
              </p>
            </div>

            {/* past_mean_8 */}
            <div className="p-3 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('বিগত ৮ সপ্তাহের গড় (past_mean_8) *', 'Past 8-Week Mean (past_mean_8) *')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  data-testid="input-past_mean_8"
                  value={formData.past_mean_8}
                  onChange={(e) => handleFieldChange('past_mean_8', e.target.value)}
                  placeholder="e.g. 38.25"
                  className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
                />
                <span className="text-[11px] font-mono text-sage-400 shrink-0">BDT/kg</span>
              </div>
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('২ মাসের রোলিং গড়', '2-month rolling mean')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Seasonal Horizon */}
        <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-bengali font-bold text-sm text-cream-100">
              {t('গ. মৌসুমি সময়কাল ও পূর্বাভাস পরিধি (Seasonal Horizon Timing)', 'C. Seasonal Horizon Timing')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* month */}
            <div className="p-3.5 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('মৌসুমের মাস (month: ১ - ১২) *', 'Calendar Month (1 - 12) *')}
              </label>
              <input
                type="number"
                min="1"
                max="12"
                required
                data-testid="input-month"
                value={formData.month}
                onChange={(e) => handleFieldChange('month', e.target.value)}
                placeholder="1 to 12"
                className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
              />
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('যেমন: ২ = ফেব্রুয়ারি, ৫ = মে, ৭ = জুলাই', 'e.g. 2 = February, 5 = May, 7 = July')}
              </p>
            </div>

            {/* week_of_month */}
            <div className="p-3.5 rounded-2xl bg-forest-950/80 border border-forest-800 focus-within:border-gold-400/60 transition-colors">
              <label className="text-xs font-semibold text-sage-200 font-bengali block mb-1">
                {t('মাসের সপ্তাহ (week_of_month: ১ - ৫) *', 'Week of Month (1 - 5) *')}
              </label>
              <input
                type="number"
                min="1"
                max="5"
                required
                data-testid="input-week_of_month"
                value={formData.week_of_month}
                onChange={(e) => handleFieldChange('week_of_month', e.target.value)}
                placeholder="1 to 5"
                className="w-full bg-transparent text-cream-50 font-mono text-sm focus:outline-hidden"
              />
              <p className="text-[10px] text-sage-400 font-bengali mt-1">
                {t('সংশ্লিষ্ট মাসের ১ম থেকে ৫ম সপ্তাহ', '1st to 5th ordinal week of the month')}
              </p>
            </div>
          </div>
        </div>

        {/* Mandatory Scientific Disclaimer Checkbox */}
        <div className="bg-forest-950/90 rounded-3xl p-5 border border-forest-800 shadow-md">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              data-testid="market-disclaimer-checkbox"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 rounded-md border-forest-700 bg-forest-900 text-gold-500 focus:ring-gold-400 focus:ring-offset-forest-950 cursor-pointer"
            />
            <span className="text-xs font-bengali text-sage-200 group-hover:text-cream-100 transition-colors leading-relaxed select-none">
              {t(
                'আমি স্বীকার করছি যে এই পূর্বাভাসটি শুধুমাত্র ঐতিহাসিক গবেষণার উদ্দেশ্যে তৈরি। নেটিভ বেসলাইন (lag_1) হলো প্রধান প্রস্তাবিত মূল্য এবং এটি কোনো লাইভ খুচরা বাজারদর নিশ্চয়তা দেয় না।',
                'I acknowledge that this model is for historical research benchmarks. The naive last-observed price (lag_1) is the recommended benchmark and this does not represent live retail market pricing.'
              )}
            </span>
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            data-testid="submit-market-price-btn"
            disabled={isMissingInputs || !disclaimerAccepted || isSubmitting}
            className={`px-6 py-3.5 rounded-2xl font-bengali font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              isMissingInputs || !disclaimerAccepted || isSubmitting
                ? 'bg-forest-800 text-sage-500 border border-forest-750 cursor-not-allowed opacity-60'
                : 'bg-gold-500 hover:bg-gold-400 text-forest-950 hover:shadow-gold-500/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('মূল্যায়ন চলছে...', 'Evaluating Price Model...')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {t(
                    `মূল্যায়ন সম্পন্ন করুন (${isTomato ? 'টমেটো' : 'বোরো ধান'})`,
                    `Run Price Evaluation (${isTomato ? 'Tomato' : 'Boro Rice'})`
                  )}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 5. Dedicated Baseline-Dominant Result Presentation */}
      {result && result.prediction && (
        <div
          className="bg-forest-950 rounded-3xl p-6 sm:p-8 border border-forest-800 shadow-2xl space-y-6 animate-fade-in-up"
          data-testid="market-price-result-card"
        >
          {/* Result Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-forest-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {t('মূল্যায়ন সম্পন্ন', 'Evaluation Complete')}
                  </span>
                  <span className="text-xs font-mono text-sage-400">
                    ID #{result.record_id || 'DEMO'}
                  </span>
                </div>
                <h3 className="font-bengali font-bold text-lg text-cream-50 mt-0.5">
                  {t('বাজারদর মূল্যায়ন ফলাফল ও বেসলাইন তুলনা', 'Market Price Evaluation & Baseline Comparison')}
                </h3>
              </div>
            </div>

            {/* History Shortcut */}
            {onViewHistory && result.record_id && (
              <button
                type="button"
                data-testid="view-history-btn"
                onClick={() => onViewHistory(result.record_id!)}
                className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-gold-300 text-xs font-semibold font-bengali border border-forest-750 transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"
              >
                <History className="w-3.5 h-3.5" />
                <span>{t('রেকর্ড হিস্ট্রি দেখুন', 'View in History')}</span>
              </button>
            )}
          </div>

          {/* Primary Recommended Price Card */}
          <div className="bg-gradient-to-br from-emerald-950/80 via-forest-900 to-forest-950 p-6 rounded-3xl border border-emerald-500/30 shadow-inner">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-emerald-400 font-bengali uppercase tracking-wider block mb-1">
                  {t('প্রাথমিক প্রস্তাবিত পাইকারি দর (গবেষণা যাচাইকৃত)', 'Primary Recommended Wholesale Benchmark')}
                </span>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-display font-extrabold text-3xl sm:text-4xl text-cream-50 font-mono tracking-tight"
                    data-testid="recommended-price-value"
                  >
                    {Number(result.prediction.recommended_price ?? result.prediction.baseline_price).toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-gold-300 font-mono">
                    BDT/kg
                  </span>
                  <span className="text-xs font-bengali text-sage-300 ml-2">
                    ({t('পাইকারি মধ্যম দর', 'Wholesale Midpoint')})
                  </span>
                </div>
              </div>

              <div className="bg-forest-950/80 px-4 py-3 rounded-2xl border border-emerald-500/20 text-right">
                <span className="text-[11px] font-bengali text-sage-400 block">
                  {t('প্রস্তাবনার ভিত্তি:', 'Recommendation Basis:')}
                </span>
                <span className="text-xs font-bold text-emerald-300 font-bengali">
                  {t('সর্বশেষ পর্যবেক্ষিত সাপ্তাহিক দর (lag_1)', 'Last-Observed Price Baseline (lag_1)')}
                </span>
              </div>
            </div>

            <p className="text-xs text-sage-300 font-bengali mt-3 pt-3 border-t border-forest-800/80 leading-relaxed">
              {t(
                'বিজ্ঞপ্তি: এই মূল্যটি পূর্ববর্তী সপ্তাহের পাইকারি রেকর্ড থেকে সরাসরি প্রাপ্ত। গবেষণায় প্রমাণিত যে স্বল্পমেয়াদী পণ্যমূল্য নির্ধারণে এই পদ্ধতিটি সবচেয়ে নির্ভরযোগ্য।',
                'Notice: This value reflects the direct last-observed weekly wholesale price. Empirical research confirms it yields lower forecasting error than ML regression.'
              )}
            </p>
          </div>

          {/* Baseline Value Provenance & Epistemological Disclosure (Task 5) */}
          <div
            className="p-4 rounded-2xl bg-forest-950/90 border border-forest-750 text-xs text-sage-300 font-bengali space-y-2 shadow-xs"
            data-testid="baseline-provenance-box"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-forest-800 text-gold-300 font-semibold border border-forest-700">
                PROVENANCE AUDIT
              </span>
              <span className="font-bold text-cream-100">
                {t('প্রদর্শিত বেসলাইন মূল্যের উৎস ও প্রাসঙ্গিকতা:', 'Displayed Baseline Value Provenance:')}
              </span>
            </div>

            {activePreset ? (
              <div className="p-2.5 rounded-xl bg-forest-900/60 border border-emerald-500/20 text-emerald-200">
                <span className="font-semibold block text-emerald-300 mb-0.5">
                  ✓ {t('উৎস: সংরক্ষিত ঐতিহাসিক গবেষণা দৃশ্যপট', 'Source: Archived Historical Benchmark Scenario')}
                </span>
                <p className="text-[11px] text-sage-300 leading-relaxed">
                  {t(
                    `এই মানটি (${formData.lag_1} BDT/kg) সংরক্ষিত বেঞ্চমার্ক '${t(activePreset.nameBn, activePreset.nameEn)}' থেকে লোড করা হয়েছে, যা ২০২২–২০২৬ সময়কালে বাংলাদেশ কৃষি বিপণন অধিদপ্তরের (DAM) রেকর্ডকৃত পাইকারি সাপ্তাহিক মধ্যম মূল্যের ওপর প্রতিষ্ঠিত।`,
                    `This value (${formData.lag_1} BDT/kg) was loaded directly from the archived scenario '${activePreset.nameEn}', reflecting recorded DAM weekly wholesale midpoint archives from 2022–2026.`
                  )}
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <span className="font-semibold block text-amber-300 mb-0.5">
                  ⚠ {t('উৎস: ব্যবহারকারীর প্রদত্ত ইনপুটভিত্তিক পারসিসটেন্স বেঞ্চমার্ক (Persistence Benchmark based on supplied input)', 'Source: Last-observation persistence benchmark based on supplied historical input')}
                </span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {t(
                    `এই বেসলাইনটি ব্যবহারকারীর স্ব-প্রদত্ত lag_1 ইনপুটের (${formData.lag_1} BDT/kg) ওপর ভিত্তি করে তৈরি। এটি কোনো স্বাধীনভাবে যাচাইকৃত বর্তমান পাইকারি বাজারদর নয় এবং এটি কোনো লাইভ মার্কেট রেকমেন্ডেশন বা নিশ্চিত বিক্রয়মূল্য নয়।`,
                    `This baseline benchmark is computed strictly from the user-entered lag_1 input (${formData.lag_1} BDT/kg). It is NOT an independently verified current wholesale price and MUST NOT be treated as a live market recommendation or guaranteed selling price.`
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Side-by-Side Comparison Card (Mathematically Rigorous) */}
          <div
            className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md space-y-4"
            data-testid="baseline-comparison-card"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bengali font-bold text-sm text-cream-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-gold-400" />
                <span>{t('বেসলাইন বনাম র‍্যান্ডম ফরেস্ট এআই তুলনামূলক বিশ্লেষণ', 'Baseline vs Random Forest ML Comparison')}</span>
              </h4>
              <span className="text-[10px] font-mono text-sage-400">
                Holdout Evaluation Metrics
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Naive Baseline */}
              <div className="p-5 rounded-2xl bg-forest-950/90 border border-emerald-500/40 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 font-bengali">
                    {t('১. নেটিভ বেসলাইন (Naive Baseline)', '1. Naive Baseline (lag_1)')}
                  </span>
                  <span className="text-[10px] font-bengali font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {t('সর্বনিম্ন টেস্ট ত্রুটি (প্রস্তাবিত)', 'Lowest Test Error (Recommended)')}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-cream-50 mb-1">
                  {Number(result.prediction.baseline_price).toFixed(2)} <span className="text-xs font-normal text-sage-400">BDT/kg</span>
                </div>
                <div className="space-y-1 text-[11px] text-sage-300 font-bengali pt-2 border-t border-forest-800">
                  <div className="flex justify-between">
                    <span>{t('পদ্ধতি:', 'Method:')}</span>
                    <span className="font-mono text-cream-100">lag_1 Persistence</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('ঐতিহাসিক টেস্ট MAE:', 'Historical Test MAE:')}</span>
                    <span className="font-mono text-emerald-400 font-semibold">{empiricalStats.baselineTestMae} BDT/kg</span>
                  </div>
                </div>
              </div>

              {/* Option B: Random Forest ML */}
              <div className="p-5 rounded-2xl bg-forest-950/90 border border-amber-500/30 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 font-bengali">
                    {t('২. র‍্যান্ডম ফরেস্ট মডেল (ML Regressor)', '2. Random Forest Regressor')}
                  </span>
                  <span className="text-[10px] font-bengali font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {t(`উচ্চতর ত্রুটি (+${empiricalStats.errorDifferencePercent} MAE)`, `Higher Error (+${empiricalStats.errorDifferencePercentEn} MAE)`)}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono text-amber-200 mb-1">
                  {Number(result.prediction.ml_forecast).toFixed(2)} <span className="text-xs font-normal text-sage-400">BDT/kg</span>
                </div>
                <div className="space-y-1 text-[11px] text-sage-300 font-bengali pt-2 border-t border-forest-800">
                  <div className="flex justify-between">
                    <span>{t('পদ্ধতি:', 'Method:')}</span>
                    <span className="font-mono text-cream-100">10-Feature RF Pipeline</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('ঐতিহাসিক টেস্ট MAE:', 'Historical Test MAE:')}</span>
                    <span className="font-mono text-amber-400 font-semibold">{empiricalStats.modelTestMae} BDT/kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Why Baseline Wins Explanation */}
            <div className="p-4 rounded-2xl bg-forest-950/60 border border-forest-800 text-xs text-sage-300 font-bengali leading-relaxed">
              <span className="font-bold text-gold-300 block mb-1">
                {t('কেন বেসলাইনের ত্রুটি কম?', 'Why Does the Baseline Have Lower Error?')}
              </span>
              {t(
                'কাঁচাবাজারের পাইকারি আড়তে সাপ্তাহিক দামের ধারাবাহিকতা খুব জোরালোভাবে কাজ করে। পূর্ববর্তী সপ্তাহের দাম সরাসরি তাৎক্ষণিক সরবরাহ ও চাহিদার ভারসাম্য প্রকাশ করে। সীমিত ডেটাসেটে নন-লিনিয়ার রিগ্রেশন অতিরিক্ত অস্থিতিশীলতা তৈরি করায় সাধারণ বেসলাইনটিই গবেষণায় বিজয়ী হয়েছে।',
                'Wholesale agricultural markets exhibit strong short-term inertia. The previous week price reflects current spot supply-demand equilibrium directly. Complex non-linear regression models introduce excess variance on small datasets, making the simple persistence baseline empirically superior.'
              )}
            </div>
          </div>

          {/* Expandable 10-Feature Inputs Audit Drawer */}
          <div
            className="bg-forest-900/80 rounded-3xl border border-forest-800 overflow-hidden shadow-md"
            data-testid="inputs-audit-drawer"
          >
            <button
              type="button"
              data-testid="toggle-audit-drawer-btn"
              onClick={() => setIsAuditDrawerOpen(!isAuditDrawerOpen)}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-forest-850/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-forest-950 flex items-center justify-center text-gold-400 border border-forest-800">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bengali font-bold text-sm text-cream-100">
                    {t('১০টি ইনপুট উপাত্ত নিরীক্ষা (Input Feature Audit)', '10-Feature Input Data Audit')}
                  </h4>
                  <p className="text-[11px] text-sage-400 font-bengali">
                    {t('মডেল মূল্যায়নে ব্যবহৃত সকল ইনপুটের বিস্তারিত তালিকা', 'Full table of 10 submitted features and definitions')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold">
                <span>{isAuditDrawerOpen ? t('লুকান', 'Hide') : t('দেখুন', 'Show')}</span>
                {isAuditDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isAuditDrawerOpen && (
              <div className="p-4 sm:p-6 border-t border-forest-800 bg-forest-950/70 overflow-x-auto">
                <table
                  className="w-full text-left text-xs border-collapse"
                  data-testid="inputs-audit-table"
                >
                  <thead>
                    <tr className="border-b border-forest-800 text-sage-400 font-mono text-[11px]">
                      <th className="pb-2.5 font-semibold">Feature Key</th>
                      <th className="pb-2.5 font-semibold font-bengali">{t('ফিচার বিবরণ', 'Feature Name')}</th>
                      <th className="pb-2.5 font-semibold">{t('প্রদত্ত মান', 'Submitted Value')}</th>
                      <th className="pb-2.5 font-semibold">{t('একক', 'Unit')}</th>
                      <th className="pb-2.5 font-semibold font-bengali">{t('বৈজ্ঞানিক সংজ্ঞা', 'Scientific Role')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest-850">
                    {MARKET_PRICE_FEATURES.map((feat) => {
                      const val = formData[feat.key] ?? 'N/A';
                      const isLag1 = feat.key === 'lag_1';
                      return (
                        <tr
                          key={feat.key}
                          className={`hover:bg-forest-900/60 transition-colors ${
                            isLag1 ? 'bg-emerald-950/30' : ''
                          }`}
                        >
                          <td className="py-2.5 pr-3 font-mono font-bold text-gold-300">
                            {feat.key}
                            {isLag1 && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-sans">
                                Primary
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-bengali text-cream-100">
                            {t(feat.nameBn, feat.nameEn)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono font-bold text-cream-50">
                            {val}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-sage-400">
                            {feat.unit}
                          </td>
                          <td className="py-2.5 text-sage-300 font-bengali text-[11px] leading-relaxed">
                            {t(feat.descriptionBn, feat.descriptionEn)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
