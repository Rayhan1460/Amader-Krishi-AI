// Premium Regional Crop Yield AI Research Panel (Phase F5E-4A)
// Model: regional_crop_yield (ColumnTransformer + RandomForestRegressor)
// Strictly enforces 20-feature input schema, authentic inference, and explicit scientific disclaimers.

import { useState, useMemo, type FormEvent } from 'react';
import {
  Layers,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Play,
  CheckCircle2,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  CloudRain,
  Satellite,
  Droplet,
  ExternalLink,
} from 'lucide-react';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { YieldLovableOverview } from './YieldLovableOverview.tsx';
import './YieldLovable.css';

interface RegionalYieldToolProps {
  initialDistrict?: string;
  onViewHistory?: (recordId: number) => void;
}

// 18 Supported Districts in original training corpus
export const SUPPORTED_DISTRICTS = [
  'Bogra',
  'Bogura',
  'Chandpur',
  'Chittagong',
  'Chuadanga',
  'Comilla',
  "Cox's Bazar",
  'Dinajpur',
  'Feni',
  'Jessor',
  'Khagrachhari',
  'Khulna',
  'Kushtia',
  'Noakhali',
  'Rajshahi',
  'Rangamati',
  'Rangpur',
  'Satkhira',
];

// 3 Supported Macro Divisions
export const SUPPORTED_DIVISIONS = ['Chittagong', 'Khulna', 'North region'];

// 3 Supported Rice Seasons
export const SUPPORTED_SEASONS = ['Aman', 'Aus', 'Boro'];

// District to Macro Division Mapping
const DISTRICT_TO_DIVISION: Record<string, string> = {
  Bogra: 'North region',
  Bogura: 'North region',
  Dinajpur: 'North region',
  Rajshahi: 'North region',
  Rangpur: 'North region',
  Chandpur: 'Chittagong',
  Chittagong: 'Chittagong',
  Comilla: 'Chittagong',
  "Cox's Bazar": 'Chittagong',
  Feni: 'Chittagong',
  Khagrachhari: 'Chittagong',
  Noakhali: 'Chittagong',
  Rangamati: 'Chittagong',
  Chuadanga: 'Khulna',
  Jessor: 'Khulna',
  Khulna: 'Khulna',
  Kushtia: 'Khulna',
  Satkhira: 'Khulna',
};

// Benchmark Historical Scenarios
const PRESETS = [
  {
    id: 'bogura_aman',
    nameBn: 'বগুড়া আমন বেঞ্চমার্ক (২০১৪)',
    nameEn: 'Bogura Aman Benchmark (2014)',
    data: {
      Year: '2014',
      District: 'Bogura',
      Division: 'North region',
      Season: 'Aman',
      Rain: '1200.0',
      Sunshine: '6.5',
      Wind: '2.1',
      TempRange: '8.5',
      NDVI_mean_season: '0.65',
      NDVI_max_season: '0.82',
      NDVI_integral: '15.4',
      NDVI_anom: '0.02',
      Pct_irrigated: '60.0',
      NDVI_peak_month: '9',
      NDVI_peak_doy: '260',
      NDVI_mean_trend2: '0.001',
      Rain_ma3: '1180.0',
      Sunshine_ma3: '6.3',
      NDVI_mean_season_ma3: '0.64',
      ndvi_rain_interaction: '780.0',
    },
  },
  {
    id: 'dinajpur_boro',
    nameBn: 'দিনাজপুর বোরো বেঞ্চমার্ক (২০১৪)',
    nameEn: 'Dinajpur Boro Benchmark (2014)',
    data: {
      Year: '2014',
      District: 'Dinajpur',
      Division: 'North region',
      Season: 'Boro',
      Rain: '210.0',
      Sunshine: '7.2',
      Wind: '1.8',
      TempRange: '13.5',
      NDVI_mean_season: '0.58',
      NDVI_max_season: '0.76',
      NDVI_integral: '14.1',
      NDVI_anom: '-0.01',
      Pct_irrigated: '85.0',
      NDVI_peak_month: '3',
      NDVI_peak_doy: '85',
      NDVI_mean_trend2: '-0.001',
      Rain_ma3: '230.0',
      Sunshine_ma3: '7.1',
      NDVI_mean_season_ma3: '0.59',
      ndvi_rain_interaction: '121.8',
    },
  },
  {
    id: 'comilla_aus',
    nameBn: 'কুমিল্লা আউশ বেঞ্চমার্ক (২০১৩)',
    nameEn: 'Comilla Aus Benchmark (2013)',
    data: {
      Year: '2013',
      District: 'Comilla',
      Division: 'Chittagong',
      Season: 'Aus',
      Rain: '950.0',
      Sunshine: '6.1',
      Wind: '2.3',
      TempRange: '9.2',
      NDVI_mean_season: '0.61',
      NDVI_max_season: '0.79',
      NDVI_integral: '14.8',
      NDVI_anom: '0.01',
      Pct_irrigated: '45.0',
      NDVI_peak_month: '6',
      NDVI_peak_doy: '175',
      NDVI_mean_trend2: '0.002',
      Rain_ma3: '980.0',
      Sunshine_ma3: '6.0',
      NDVI_mean_season_ma3: '0.60',
      ndvi_rain_interaction: '579.5',
    },
  },
];

const EMPTY_FORM = {
  Year: '',
  District: '',
  Division: '',
  Season: '',
  Rain: '',
  Sunshine: '',
  Wind: '',
  TempRange: '',
  NDVI_mean_season: '',
  NDVI_max_season: '',
  NDVI_integral: '',
  NDVI_anom: '',
  Pct_irrigated: '',
  NDVI_peak_month: '',
  NDVI_peak_doy: '',
  NDVI_mean_trend2: '',
  Rain_ma3: '',
  Sunshine_ma3: '',
  NDVI_mean_season_ma3: '',
  ndvi_rain_interaction: '',
};

const DISTRICT_ALIASES: Record<string, string> = {
  'বগুড়া': 'Bogura', 'বগুড়া': 'Bogura', 'চাঁদপুর': 'Chandpur', 'চট্টগ্রাম': 'Chittagong',
  'chattogram': 'Chittagong', 'চুয়াডাঙ্গা': 'Chuadanga', 'চুয়াডাঙ্গা': 'Chuadanga',
  'কুমিল্লা': 'Comilla', 'cumilla': 'Comilla', 'কক্সবাজার': "Cox's Bazar",
  'দিনাজপুর': 'Dinajpur', 'ফেনী': 'Feni', 'যশোর': 'Jessor', 'jashore': 'Jessor',
  'jessore': 'Jessor', 'খাগড়াছড়ি': 'Khagrachhari', 'খাগড়াছড়ি': 'Khagrachhari',
  'খুলনা': 'Khulna', 'কুষ্টিয়া': 'Kushtia', 'কুষ্টিয়া': 'Kushtia', 'নোয়াখালী': 'Noakhali',
  'নোয়াখালী': 'Noakhali', 'রাজশাহী': 'Rajshahi', 'রাঙ্গামাটি': 'Rangamati',
  'রাঙামাটি': 'Rangamati', 'রংপুর': 'Rangpur', 'সাতক্ষীরা': 'Satkhira',
};

export function RegionalYieldTool({ onViewHistory, initialDistrict }: RegionalYieldToolProps) {
  const { t } = useLanguage();
  const farmDistrict = initialDistrict && SUPPORTED_DISTRICTS.find(d =>
    d.toLowerCase() === (DISTRICT_ALIASES[initialDistrict.trim().toLowerCase()] ?? initialDistrict.trim()).toLowerCase());
  const [formData, setFormData] = useState(() => initialDistrict
    ? { ...EMPTY_FORM, District: farmDistrict || '', Division: farmDistrict ? DISTRICT_TO_DIVISION[farmDistrict] : '' }
    : PRESETS[0].data);
  const [activePreset, setActivePreset] = useState<string>(initialDistrict ? 'custom' : 'bogura_aman');
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(!initialDistrict);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [showInputAudit, setShowInputAudit] = useState(false);
  const [showResearchInputs, setShowResearchInputs] = useState(false);
  const [resultInputKey, setResultInputKey] = useState<string | null>(null);
  const validResult = resultInputKey === JSON.stringify(formData) ? result : null;

  // Auto-calculate interaction product if components change
  const autoInteraction = useMemo(() => {
    const rain = parseFloat(formData.Rain);
    const ndvi = parseFloat(formData.NDVI_mean_season);
    if (!isNaN(rain) && !isNaN(ndvi)) {
      return (rain * ndvi).toFixed(1);
    }
    return '';
  }, [formData.Rain, formData.NDVI_mean_season]);

  // Missing Inputs Count
  const missingInputsCount = useMemo(() => {
    return Object.values(formData).filter((v) => v === undefined || v === null || String(v).trim() === '').length;
  }, [formData]);

  // Form Validity
  const isFormValid = useMemo(() => {
    if (missingInputsCount > 0) return false;
    if (!SUPPORTED_DISTRICTS.includes(formData.District)) return false;
    if (!SUPPORTED_DIVISIONS.includes(formData.Division)) return false;
    if (!SUPPORTED_SEASONS.includes(formData.Season)) return false;
    const numericKeys = [
      'Year',
      'Rain',
      'Sunshine',
      'Wind',
      'TempRange',
      'NDVI_mean_season',
      'NDVI_max_season',
      'NDVI_integral',
      'NDVI_anom',
      'Pct_irrigated',
      'NDVI_peak_month',
      'NDVI_peak_doy',
      'NDVI_mean_trend2',
      'Rain_ma3',
      'Sunshine_ma3',
      'NDVI_mean_season_ma3',
      'ndvi_rain_interaction',
    ];
    for (const k of numericKeys) {
      const val = parseFloat((formData as any)[k]);
      if (isNaN(val) || !isFinite(val)) return false;
    }
    return true;
  }, [formData, missingInputsCount]);

  // Handle Preset Click
  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setFormData(preset.data);
    setActivePreset(preset.id);
    setError(null);
    setResult(null);
  };

  // Handle Clear Inputs
  const handleClearInputs = () => {
    setFormData(EMPTY_FORM);
    setActivePreset('custom');
    setError(null);
    setResult(null);
  };

  // Handle District Change (Auto-suggest division)
  const handleDistrictChange = (district: string) => {
    const div = DISTRICT_TO_DIVISION[district] || formData.Division || 'North region';
    setFormData({
      ...formData,
      District: district,
      Division: div,
    });
    setActivePreset('custom');
  };

  // Submit Prediction
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (missingInputsCount > 0) {
      setError(
        t(
          `২০টি আবশ্যিক উপাত্তের মধ্যে ${missingInputsCount}টি তথ্য অসম্পূর্ণ। কোনো তথ্য ছাড়া মডেলটি নির্ভরযোগ্য ফলাফল দিতে পারে না।`,
          `Incomplete inputs: ${missingInputsCount} of 20 features are missing. The model cannot execute without complete data.`
        )
      );
      return;
    }

    if (!disclaimerAcknowledged) {
      setError(
        t(
          'অনুগ্রহ করে বৈজ্ঞানিক সীমাবদ্ধতা ও সতর্কবার্তা স্বীকার করে টিক দিন।',
          'Please acknowledge the scientific limitations disclaimer to proceed.'
        )
      );
      return;
    }

    const payload: Record<string, any> = {};
    const numericFields = [
      'Year',
      'Rain',
      'Sunshine',
      'Wind',
      'TempRange',
      'NDVI_mean_season',
      'NDVI_max_season',
      'NDVI_integral',
      'NDVI_anom',
      'Pct_irrigated',
      'NDVI_peak_month',
      'NDVI_peak_doy',
      'NDVI_mean_trend2',
      'Rain_ma3',
      'Sunshine_ma3',
      'NDVI_mean_season_ma3',
      'ndvi_rain_interaction',
    ];

    for (const [k, v] of Object.entries(formData)) {
      if (numericFields.includes(k)) {
        const num = parseFloat(v);
        if (isNaN(num) || !isFinite(num)) {
          setError(t(`'${k}' ক্ষেত্রে সঠিক সংখ্যা প্রদান করুন।`, `Field '${k}' must be a valid number.`));
          return;
        }
        payload[k] = num;
      } else {
        payload[k] = v;
      }
    }

    setIsSubmitting(true);
    try {
      const inputKey = JSON.stringify(formData);
      const res = await predictionApi.predict('regional_crop_yield', { data: payload });
      setResultInputKey(inputKey);
      setResult(res);
      setShowInputAudit(false);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="yield08-page space-y-6" data-testid="regional-yield-tool">
      <YieldLovableOverview
        t={t}
        formData={formData}
        predictedYield={validResult?.prediction?.predicted_yield}
        isSubmitting={isSubmitting}
        isFormOpen={showResearchInputs}
        onOpenForm={() => setShowResearchInputs((current) => !current)}
        onIrrigationChange={(value) => {
          setFormData((current) => ({ ...current, Pct_irrigated: String(value) }));
          setActivePreset('custom');
        }}
      />

      <div id="yield08-research-workspace" className={showResearchInputs ? 'yield08-research' : 'hidden'}>
      {/* 1. Header & Scientific Honesty Banner */}
      <div className="bg-forest-900/90 rounded-3xl p-6 sm:p-8 border border-forest-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-xl text-white font-bengali">
                  {t('গবেষণামূলক আঞ্চলিক ধান ফলন পূর্বাভাস', 'Regional Rice Yield AI Research Model')}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  {t('ম্যাক্রো মডেল', 'Macro Model')}
                </span>
              </div>
              <p className="text-xs text-sage-300 font-mono mt-0.5">
                Model: <code className="text-gold-300 font-bold">regional_crop_yield</code> • ColumnTransformer + RandomForest (Scikit-Learn)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-forest-950/80 px-3 py-1.5 rounded-xl border border-forest-800 text-sage-400">
            <span>20 Features Required</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">18 Districts</span>
            <span>•</span>
            <span className="text-gold-300 font-bold">3 Rice Seasons</span>
          </div>
        </div>

        {/* Explicit Research Limitation Notice */}
        <div className="bg-forest-950/90 rounded-2xl p-4 border border-amber-500/30 text-xs text-amber-200/90 font-bengali space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{t('বৈজ্ঞানিক সতর্কতা ও ব্যবহারের সীমাবদ্ধতা:', 'Scientific Honesty & Usage Limitations:')}</span>
          </div>
          <p className="leading-relaxed text-sage-300">
            {t(
              'এই মডেলটি বাংলাদেশ পরিসংখ্যান ব্যুরো (BBS) এর ঐতিহাসিক জেলাভিত্তিক ধানের ফলন, আবহাওয়া তথ্য ও স্যাটেলাইট এনডিভিআই সূচকের ওপর প্রশিক্ষিত। এটি ব্যক্তিগত খামারের বা কোনো নির্দিষ্ট প্লটের নিশ্চিত ফলন বা ভবিষ্যৎ উৎপাদনের নিশ্চয়তা নয়। এই আঞ্চলিক হারকে খামারের জমিতে গুণ করে প্রত্যাশিত লাভ বা নিশ্চিত আয় হিসাব করা কঠোরভাবে নিষিদ্ধ।',
              'This model is trained exclusively on BBS-level historical district rice yields, regional meteorological data, and satellite MODIS NDVI series. It is NOT an individual-farm harvest guarantee. Do not multiply regional t/ha by farm acreage as a dependable farm production forecast.'
            )}
          </p>
        </div>
      </div>

      {/* 2. Research Benchmark Presets */}
      <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-forest-800">
          <div>
            <span className="text-xs font-bold text-white font-bengali flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold-400" />
              <span>{t('ঐতিহাসিক গবেষণা সিনারিও নির্বাচন করুন:', 'Select Historical Research Benchmark Scenario:')}</span>
            </span>
            <p className="text-[11px] text-sage-400 font-bengali mt-0.5">
              {t(
                'মডেল পরীক্ষার জন্য সম্পূর্ণ ২০টি বাস্তব ঐতিহাসিক উপাত্তের বেঞ্চমার্ক লোড করুন',
                'Load verified historical 20-feature benchmarks to test model behavior'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`preset-${p.data.District.toLowerCase()}-btn`}
                onClick={() => handleApplyPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-bengali transition-all cursor-pointer border ${
                  activePreset === p.id
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-xs'
                    : 'bg-forest-800 border-forest-700 text-sage-300 hover:text-white hover:border-forest-600'
                }`}
              >
                {t(p.nameBn, p.nameEn)}
              </button>
            ))}
            <button
              type="button"
              data-testid="clear-inputs-btn"
              onClick={handleClearInputs}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold font-bengali bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:bg-rose-900/50 transition-colors cursor-pointer"
            >
              {t('ইনপুট খালি করুন', 'Clear All Inputs')}
            </button>
          </div>
        </div>

        {/* 3. Form with 4 Feature Groups */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Group A: Geographical & Season Context */}
          <div className="bg-forest-950/60 rounded-2xl p-4 sm:p-5 border border-forest-800/80">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-bengali mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{t('১. ভৌগোলিক ও সময়কাল উপাত্ত (৪টি প্যারামিটার)', '1. Geographic & Temporal Context (4 Features)')}</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* District */}
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('জেলা (District) *', 'District (18 Trained) *')}
                </label>
                <select
                  data-testid="input-district"
                  value={formData.District}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="">{t('-- জেলা নির্বাচন করুন --', '-- Select District --')}</option>
                  {SUPPORTED_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-sage-400 mt-1 block">১৮টি জেলা সীমাবদ্ধ</span>
              </div>

              {/* Division */}
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('প্রশাসনিক অঞ্চল (Division) *', 'Division (3 Regions) *')}
                </label>
                <select
                  data-testid="input-division"
                  value={formData.Division}
                  onChange={(e) => {
                    setFormData({ ...formData, Division: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="">{t('-- অঞ্চল নির্বাচন করুন --', '-- Select Region --')}</option>
                  {SUPPORTED_DIVISIONS.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-sage-400 mt-1 block">Chittagong, Khulna, North region</span>
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('ধানের মৌসুম (Rice Season) *', 'Rice Season (3 Crops) *')}
                </label>
                <select
                  data-testid="input-season"
                  value={formData.Season}
                  onChange={(e) => {
                    setFormData({ ...formData, Season: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="">{t('-- মৌসুম নির্বাচন করুন --', '-- Select Season --')}</option>
                  {SUPPORTED_SEASONS.map((s) => (
                    <option key={s} value={s}>
                      {s === 'Aman' ? 'Aman (আমন ধান)' : s === 'Aus' ? 'Aus (আউশ ধান)' : 'Boro (বোরো ধান)'}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-sage-400 mt-1 block">Aman, Aus, Boro শুধুমাত্র</span>
              </div>

              {/* Year */}
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('বছর (Calendar Year) *', 'Analysis Year *')}
                </label>
                <input
                  type="number"
                  data-testid="input-year"
                  min="2000"
                  max="2035"
                  placeholder="2014"
                  value={formData.Year}
                  onChange={(e) => {
                    setFormData({ ...formData, Year: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">ঐতিহাসিক ডাটা ২০১৩-২০১৪</span>
              </div>
            </div>
          </div>

          {/* Group B: Agro-Climatic Parameters */}
          <div className="bg-forest-950/60 rounded-2xl p-4 sm:p-5 border border-forest-800/80">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider font-bengali mb-3 flex items-center gap-2">
              <CloudRain className="w-4 h-4" />
              <span>{t('২. আবহাওয়া ও জলবায়ু উপাত্ত (৪টি প্যারামিটার)', '2. Agro-Climatic Parameters (4 Features)')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('মোট বৃষ্টিপাত (Rain) *', 'Seasonal Rainfall *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    data-testid="input-rain"
                    placeholder="1200.0"
                    value={formData.Rain}
                    onChange={(e) => {
                      setFormData({ ...formData, Rain: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">mm</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">মৌসুমি মোট বৃষ্টিপাত (মিমি)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('দৈনিক সূর্যালোক (Sunshine) *', 'Sunshine Duration *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    data-testid="input-sunshine"
                    placeholder="6.5"
                    value={formData.Sunshine}
                    onChange={(e) => {
                      setFormData({ ...formData, Sunshine: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">hrs/day</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">দৈনিক গড় সূর্যালোক (ঘণ্টা)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('বাতাসের গতি (Wind) *', 'Wind Speed *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    data-testid="input-wind"
                    placeholder="2.1"
                    value={formData.Wind}
                    onChange={(e) => {
                      setFormData({ ...formData, Wind: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">m/s</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">বাতাসের গড় গতিবেগ</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('তাপমাত্রার পরিসীমা (TempRange) *', 'Diurnal Temp Range *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    data-testid="input-temprange"
                    placeholder="8.5"
                    value={formData.TempRange}
                    onChange={(e) => {
                      setFormData({ ...formData, TempRange: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">°C</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">সর্বোচ্চ ও সর্বনিম্ন তাপমাত্রার ব্যবধান</span>
              </div>
            </div>
          </div>

          {/* Group C: Satellite Vegetation Index Trajectories */}
          <div className="bg-forest-950/60 rounded-2xl p-4 sm:p-5 border border-forest-800/80">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-bengali mb-3 flex items-center gap-2">
              <Satellite className="w-4 h-4" />
              <span>{t('৩. স্যাটেলাইট এনডিভিআই সূচক উপাত্ত (৭টি প্যারামিটার)', '3. Satellite NDVI Trajectories (7 Features)')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('মৌসুমি গড় NDVI (NDVI_mean) *', 'Mean Seasonal NDVI *')}
                </label>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-mean"
                  placeholder="0.65"
                  value={formData.NDVI_mean_season}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_mean_season: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">গড় সবুজায়ন সূচক (-১ থেকে ১)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('সর্বোচ্চ NDVI (NDVI_max) *', 'Max Seasonal NDVI *')}
                </label>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-max"
                  placeholder="0.82"
                  value={formData.NDVI_max_season}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_max_season: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">মৌসুমের পিক সবুজায়ন সূচক</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('NDVI ইন্টিগ্রাল (NDVI_integral) *', 'NDVI Integral Area *')}
                </label>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-integral"
                  placeholder="15.4"
                  value={formData.NDVI_integral}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_integral: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">সবুজায়নের সময়কালীন ইন্টিগ্রাল ক্ষেত্রফল</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('NDVI বিচ্যুতি (NDVI_anom) *', 'NDVI Anomaly *')}
                </label>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-anom"
                  placeholder="0.02"
                  value={formData.NDVI_anom}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_anom: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">স্বাভাবিক গড়ের চেয়ে বিচ্যুতি</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('সর্বোচ্চ ঘনত্বের মাস (peak_month) *', 'Peak Greenness Month *')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  data-testid="input-ndvi-peak-month"
                  placeholder="9"
                  value={formData.NDVI_peak_month}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_peak_month: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">১ (জানুয়ারি) থেকে ১২ (ডিসেম্বর)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('সর্বোচ্চ ঘনত্বের দিন (peak_doy) *', 'Peak Day of Year *')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="366"
                  data-testid="input-ndvi-peak-doy"
                  placeholder="260"
                  value={formData.NDVI_peak_doy}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_peak_doy: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">বছরের ১ থেকে ৩৬৬ তম দিন</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('NDVI ২ বছরের ট্রেন্ড (trend2) *', '2-Year Trend Slope *')}
                </label>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-trend2"
                  placeholder="0.001"
                  value={formData.NDVI_mean_trend2}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_mean_trend2: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">২ বছরের এনডিভিআই পরিবর্তনের ঢাল</span>
              </div>
            </div>
          </div>

          {/* Group D: Irrigation & Multi-Year Aggregates */}
          <div className="bg-forest-950/60 rounded-2xl p-4 sm:p-5 border border-forest-800/80">
            <h3 className="text-xs font-bold text-gold-400 uppercase tracking-wider font-bengali mb-3 flex items-center gap-2">
              <Droplet className="w-4 h-4" />
              <span>{t('৪. সেচ কভারেজ ও বহুবর্ষীয় চলমান গড় (৫টি প্যারামিটার)', '4. Irrigation & Multi-Year Averages (5 Features)')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('জেলাভিত্তিক সেচ কভারেজ (Pct_irrigated) *', 'District Irrigation Coverage % *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    data-testid="input-pct-irrigated"
                    placeholder="60.0"
                    value={formData.Pct_irrigated}
                    onChange={(e) => {
                      setFormData({ ...formData, Pct_irrigated: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">%</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">BBS কৃষি শুমারির জেলা শতকরা হার</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('বৃষ্টিপাতের ৩ বছরের গড় (Rain_ma3) *', '3-Year Moving Avg Rainfall *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    data-testid="input-rain-ma3"
                    placeholder="1180.0"
                    value={formData.Rain_ma3}
                    onChange={(e) => {
                      setFormData({ ...formData, Rain_ma3: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">mm</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">বিগত ৩ বছরের মৌসুমি গড় বৃষ্টিপাত</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('সূর্যালোকের ৩ বছরের গড় (Sunshine_ma3) *', '3-Year Moving Avg Sunshine *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    data-testid="input-sunshine-ma3"
                    placeholder="6.3"
                    value={formData.Sunshine_ma3}
                    onChange={(e) => {
                      setFormData({ ...formData, Sunshine_ma3: e.target.value });
                      setActivePreset('custom');
                    }}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-sage-400">hrs/day</span>
                </div>
                <span className="text-[10px] text-sage-400 mt-1 block">বিগত ৩ বছরের দৈনিক গড় সূর্যালোক</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sage-300 mb-1.5 font-bengali">
                  {t('NDVI ৩ বছরের গড় (NDVI_ma3) *', '3-Year Moving Avg NDVI *')}
                </label>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-ma3"
                  placeholder="0.64"
                  value={formData.NDVI_mean_season_ma3}
                  onChange={(e) => {
                    setFormData({ ...formData, NDVI_mean_season_ma3: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">বিগত ৩ বছরের মৌসুমি গড় এনডিভিআই</span>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-sage-300 font-bengali">
                    {t('NDVI ও বৃষ্টির গুণফল (ndvi_rain_interaction) *', 'NDVI × Rain Interaction Term *')}
                  </label>
                  {autoInteraction && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ndvi_rain_interaction: autoInteraction })}
                      className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      {t(`হিসাবকৃত মান বসান (${autoInteraction})`, `Use Calculated (${autoInteraction})`)}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  data-testid="input-ndvi-rain-interaction"
                  placeholder="780.0"
                  value={formData.ndvi_rain_interaction}
                  onChange={(e) => {
                    setFormData({ ...formData, ndvi_rain_interaction: e.target.value });
                    setActivePreset('custom');
                  }}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <span className="text-[10px] text-sage-400 mt-1 block">
                  মডেলের ইন্টার‍্যাকশন প্যারামিটার (NDVI_mean_season × Rain)
                </span>
              </div>
            </div>
          </div>

          {/* Missing Inputs Warning */}
          {missingInputsCount > 0 && (
            <div
              className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 font-bengali flex items-start gap-3"
              data-testid="missing-inputs-warning"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-300">
                  {t(`২০টি আবশ্যিক উপাত্তের মধ্যে ${missingInputsCount}টি ইনপুট খালি রয়েছে!`, `${missingInputsCount} of 20 required features are missing!`)}
                </span>
                <p className="mt-1 leading-relaxed text-sage-300">
                  {t(
                    'আমাদের কৃষি এআই এর বিজ্ঞানসম্মত সততা নীতি অনুযায়ী, কোনো অনুপস্থিত উপাত্তের ক্ষেত্রে কাল্পনিক বা স্বয়ংক্রিয় কৃত্রিম মান বসানো কঠোরভাবে নিষিদ্ধ। প্রেডিকশন চালাতে সকল ফিল্ড পূরণ করুন অথবা উপরের ঐতিহাসিক বেঞ্চমার্ক লোড করুন।',
                    'In accordance with our scientific integrity policy, fabricating default satellite or climate values is strictly prohibited. Please complete all 20 fields or load a verified benchmark scenario.'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 font-bengali flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Disclaimer Checkbox & Submit Controls */}
          <div className="pt-2 border-t border-forest-800 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="research-disclaimer-checkbox"
                checked={disclaimerAcknowledged}
                onChange={(e) => setDisclaimerAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-emerald-600 bg-forest-800 border-forest-700 focus:ring-emerald-500"
              />
              <span className="text-xs text-sage-300 font-bengali leading-relaxed">
                {t(
                  'আমি স্বীকার করছি যে এটি বাংলাদেশ পরিসংখ্যান ব্যুরো (BBS) এর জেলাভিত্তিক ঐতিহাসিক চাল ফলনের একটি গবেষণামূলক ম্যাক্রো মডেল। আমি এই ফলাফলকে আমার ব্যক্তিগত খামার প্লটের নিশ্চিত উৎপাদন বা মুনাফার নিশ্চয়তা হিসেবে বিবেচনা করব না।',
                  'I acknowledge that this is a macro-regional research estimate for historical district-level rice production. I will not interpret this output as a guaranteed harvest or profit projection for any individual farm.'
                )}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid || !disclaimerAcknowledged}
                data-testid="submit-yield-btn"
                className={`px-6 py-3 rounded-2xl font-bold text-xs font-bengali flex items-center gap-2.5 transition-all shadow-md ${
                  isSubmitting || !isFormValid || !disclaimerAcknowledged
                    ? 'bg-forest-800 text-sage-500 border border-forest-700 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer hover:shadow-emerald-900/40'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('মডেল গণনা চলছে...', 'Running Real ML Inference...')}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-emerald-200" />
                    <span>{t('আঞ্চলিক ফলন পূর্বাভাস পরিচালনা করুন', 'Run Regional AI Yield Inference')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(PRESETS[0])}
                className="px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-sage-300 text-xs font-bengali border border-forest-700 transition-colors cursor-pointer"
              >
                {t('বগুড়া ডিফল্ট সিনারিওতে ফেরত যান', 'Reset to Bogura Default')}
              </button>
            </div>
          </div>
        </form>
      </div>
      </div>

      {/* 4. Real Prediction Result Card */}
      {validResult && validResult.prediction && (
        <div
          className="bg-forest-900/90 rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl space-y-6 animate-fade-in"
          data-testid="yield-result-card"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-forest-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono block">
                  ML Inference Verified
                </span>
                <h3 className="font-display font-black text-lg text-white font-bengali">
                  {t('গবেষণামূলক আঞ্চলিক ফলনের অনুমান', 'Research Regional Yield Estimate')}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-forest-950 text-gold-300 border border-gold-500/30">
                {formData.District} • {formData.Season} ({formData.Year})
              </span>
              {validResult.record_id && (
                <button
                  type="button"
                  data-testid="view-history-btn"
                  onClick={() => onViewHistory && onViewHistory(validResult.record_id!)}
                  className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>#{validResult.record_id}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Main Output Number */}
          <div className="bg-forest-950/80 rounded-2xl p-6 border border-forest-800 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-sage-400 uppercase tracking-wider font-bengali block mb-1">
                {t('মডেল প্রক্ষেপিত হেক্টর প্রতি ধানের উৎপাদন:', 'Model Forecasted Rice Yield:')}
              </span>
              <div className="flex items-baseline gap-3">
                <span
                  className="text-4xl sm:text-5xl font-black text-gold-300 font-mono tracking-tight"
                  data-testid="yield-output-value"
                >
                  {Number(validResult.prediction.predicted_yield).toFixed(3)}
                </span>
                <span
                  className="text-sm font-bold text-sage-300 font-bengali"
                  data-testid="yield-output-unit"
                >
                  {t('টন / হেক্টর (tonnes/ha)', 'tonnes/ha (unverified source unit)')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] font-bengali px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                ✓ Scikit-Learn 1.6 Pipeline
              </span>
              <span className="text-[11px] font-bengali px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                ⚠ গবেষণামূলক প্রক্ষেপণ
              </span>
            </div>
          </div>

          {/* Scientific Disclaimer Box */}
          <div
            className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200/90 font-bengali space-y-1.5"
            data-testid="yield-scientific-disclaimer"
          >
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('বিজ্ঞপ্তি ও বৈজ্ঞানিক সীমাবদ্ধতা:', 'Notice & Scientific Integrity Assurance:')}</span>
            </div>
            <p className="leading-relaxed text-sage-300">
              {t(
                'এই ফলাফলটি জেলা পর্যায়ের ম্যাক্রো পরিসংখ্যানভিত্তিক ঐতিহাসিক প্রক্ষেপণ। এটি কোনো নির্দিষ্ট প্লটের উৎপাদন নিশ্চয়তা দেয় না। এটিকে খামারের নিজস্ব জমিতে গুণ করে প্রত্যাশিত আয় বা লাভ হিসাব করবেন না। খামারের প্রকৃত ফসল সংগ্রহের তথ্য জানতে আমাদের "ফসল সংগ্রহ" ড্যাশবোর্ড ব্যবহার করুন।',
                'This result represents a macro-statistical projection for district-level planning. It does not constitute a guaranteed harvest for any specific farm plot. Do not multiply this figure by your cultivated land area to project farm income or profit.'
              )}
            </p>
          </div>

          {/* Collapsible 20-Feature Inputs Audit */}
          <div className="border border-forest-800 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowInputAudit(!showInputAudit)}
              className="w-full p-4 bg-forest-950/60 hover:bg-forest-950 flex items-center justify-between text-xs font-semibold text-sage-300 font-bengali transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>{t('মডেলে ব্যবহৃত ২০টি ইনপুট উপাত্তের অডিট দেখুন', 'Audit of All 20 Model Inputs Used')}</span>
              </div>
              {showInputAudit ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showInputAudit && (
              <div className="p-4 bg-forest-950 border-t border-forest-800 overflow-x-auto" data-testid="inputs-audit-table">
                <table className="w-full text-left text-xs font-mono text-sage-300">
                  <thead>
                    <tr className="border-b border-forest-800 text-[11px] text-sage-400 uppercase">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Feature Name</th>
                      <th className="py-2 px-3">Value</th>
                      <th className="py-2 px-3">Domain Unit / Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest-900">
                    {Object.entries(formData).map(([k, v], idx) => (
                      <tr key={k} className="hover:bg-forest-900/40">
                        <td className="py-1.5 px-3 text-sage-500">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-bold text-white">{k}</td>
                        <td className="py-1.5 px-3 text-emerald-300 font-semibold">{v}</td>
                        <td className="py-1.5 px-3 text-sage-400 text-[11px]">
                          {k === 'District'
                            ? 'BBS Trained District'
                            : k === 'Division'
                            ? 'Macro Region'
                            : k === 'Season'
                            ? 'Rice Crop Season'
                            : k === 'Rain' || k === 'Rain_ma3'
                            ? 'mm'
                            : k === 'Sunshine' || k === 'Sunshine_ma3'
                            ? 'hrs/day'
                            : k === 'Wind'
                            ? 'm/s'
                            : k === 'TempRange'
                            ? '°C'
                            : k === 'Pct_irrigated'
                            ? '%'
                            : k.startsWith('NDVI')
                            ? 'Index / Curve Area'
                            : 'Product Interaction'}
                        </td>
                      </tr>
                    ))}
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
