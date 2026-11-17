import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Beaker,
  Building2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Info,
  Leaf,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sprout,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { FarmCropRecommendationResponse, PredictionResponse } from '../../../types/index.ts';
import { PredictionResultCard } from '../PredictionResultCard.tsx';
import { CROP_LABELS_BN, FarmCropRecommendationPanel } from './FarmCropRecommendationPanel.tsx';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';
import './CropAdvisorLovable.css';

interface CropRecommendationToolProps {
  fixedFarm?: boolean;
  initialFarmId?: number | null;
  onViewHistory?: (recordId: number) => void;
  onNavigateToTab?: (tab: WorkspaceTab, arg?: string, extraId?: number) => void;
}

type FeatureInputs = {
  N: string;
  P: string;
  K: string;
  temperature: string;
  humidity: string;
  ph: string;
  rainfall: string;
};

type CropCardData = { key: string | null; probability: number | null };
const EMPTY_INPUTS: FeatureInputs = {
  N: '', P: '', K: '', temperature: '', humidity: '', ph: '', rainfall: '',
};

// Research examples only; never shown as current field measurements.
const RESEARCH_PRESETS: { name: string; values: FeatureInputs }[] = [
  { name: 'Rice — research example', values: { N: '90', P: '42', K: '43', temperature: '23.6', humidity: '80.3', ph: '6.5', rainfall: '220.5' } },
  { name: 'Jute — research example', values: { N: '78', P: '46', K: '40', temperature: '25.0', humidity: '79.5', ph: '6.7', rainfall: '175.0' } },
  { name: 'Maize — research example', values: { N: '80', P: '48', K: '20', temperature: '22.0', humidity: '65.0', ph: '6.2', rainfall: '70.0' } },
  { name: 'Chickpea — research example', values: { N: '40', P: '65', K: '80', temperature: '18.5', humidity: '55.0', ph: '7.1', rainfall: '65.0' } },
];

const FEATURES: { key: keyof FeatureInputs; bn: string; en: string; suffix: string }[] = [
  { key: 'N', bn: 'নাইট্রোজেন (N)', en: 'Nitrogen (N)', suffix: '' },
  { key: 'P', bn: 'ফসফরাস (P)', en: 'Phosphorus (P)', suffix: '' },
  { key: 'K', bn: 'পটাসিয়াম (K)', en: 'Potassium (K)', suffix: '' },
  { key: 'temperature', bn: 'তাপমাত্রা', en: 'Temperature', suffix: '°C' },
  { key: 'humidity', bn: 'আপেক্ষিক আর্দ্রতা', en: 'Humidity', suffix: '%' },
  { key: 'ph', bn: 'মাটির pH', en: 'Soil pH', suffix: '' },
  { key: 'rainfall', bn: 'বৃষ্টিপাত', en: 'Rainfall', suffix: 'mm' },
];

function asProbability(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function readCandidates(result: FarmCropRecommendationResponse | PredictionResponse | null): CropCardData[] {
  if (!result) return [];
  const raw: unknown = result.prediction;
  if (typeof raw !== 'object' || raw === null) {
    return typeof raw === 'string' && raw.length > 0 ? [{ key: raw, probability: null }] : [];
  }
  const data = raw as Record<string, unknown>;
  const primary = typeof data.recommended_crop === 'string' ? data.recommended_crop : null;
  const alternatives: [string, number][] = [];
  if (typeof data.top_alternatives === 'object' && data.top_alternatives !== null && !Array.isArray(data.top_alternatives)) {
    for (const [crop, value] of Object.entries(data.top_alternatives)) {
      const score = asProbability(value);
      if (score !== null) alternatives.push([crop, score]);
    }
  }
  alternatives.sort((a, b) => b[1] - a[1]);
  const candidates: CropCardData[] = [];
  if (primary) {
    candidates.push({ key: primary, probability: alternatives.find(([crop]) => crop === primary)?.[1] ?? null });
  }
  for (const [key, probability] of alternatives) {
    if (!candidates.some((item) => item.key === key)) candidates.push({ key, probability });
    if (candidates.length === 3) break;
  }
  return candidates.slice(0, 3);
}

function cropTitle(key: string, bengali: boolean): string {
  const known = CROP_LABELS_BN[key.toLowerCase()];
  return known ? (bengali ? known.bn : known.en) : key.replace(/_/g, ' ');
}

function CropCard({
  candidate, index, expanded, onExpand, bengali, ph,
}: {
  candidate?: CropCardData;
  index: number;
  expanded: boolean;
  onExpand: () => void;
  bengali: boolean;
  ph: number | null;
}) {
  const score = candidate?.probability ?? null;
  const hasCandidate = !!candidate?.key;
  const rankName = bengali ? `${['প্রথম', 'দ্বিতীয়', 'তৃতীয়'][index]} প্রার্থী` : `Candidate ${index + 1}`;
  const noScore = bengali ? 'স্কোর নেই' : 'Not reported';

  return (
    <article
      className="crop-advisor-candidate flex min-h-[355px] flex-col rounded-[19px] border border-[#204e38] bg-[#0a3022] p-5 sm:p-[21px]"
      data-testid={`crop-advisor-candidate-${index + 1}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#87b5a0]">
            {rankName}
          </p>
          <h3 className="truncate text-[18px] font-bold leading-snug text-[#f6f8f0]" title={candidate?.key ?? ''}>
            {hasCandidate ? cropTitle(candidate.key!, bengali) : (bengali ? 'ফলাফল অপেক্ষমাণ' : 'Awaiting result')}
          </h3>
        </div>
        <span className="shrink-0 text-right text-[21px] font-extrabold text-[#ebb04e]" aria-label="Model probability">
          {score === null ? '—' : `${(score * 100).toFixed(1)}%`}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
            <span className="font-medium text-[#f3f6ef]">{bengali ? 'মডেল সম্ভাব্যতা' : 'Model probability'}</span>
            <span className="font-semibold text-[#e9ac48]">{score === null ? noScore : `${(score * 100).toFixed(1)}%`}</span>
          </div>
          <div className="h-[10px] overflow-hidden rounded-full bg-[#002316]" aria-hidden="true">
            {score !== null && <div className="h-full rounded-full bg-[#eab04e] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${score * 100}%` }} />}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
            <span className="text-[#eef6ed]">{bengali ? 'মাটির pH ইনপুট' : 'Soil pH input'}</span>
            <span className="text-[#d2e5d8]">{ph === null ? '—' : ph.toString()}</span>
          </div>
          <div className="h-[9px] rounded-full bg-[#002316]" aria-label="No soil-fit percentage available" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[13px]">
            <span className="text-[#eef6ed]">{bengali ? 'বাজার চাহিদা' : 'Market demand'}</span>
            <span className="text-[#a6c3b3]">{bengali ? 'তথ্য নেই' : 'Not assessed'}</span>
          </div>
          <div className="h-[9px] rounded-full bg-[#002316]" aria-label="No market-demand assessment available" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-[#00291d]">
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-[12px] font-semibold text-[#f3f6ed] transition-colors hover:bg-[#164b35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eeb34e]"
        >
          {bengali ? 'কেন এই ফলাফল?' : 'Why this result?'}
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
      </div>
      {expanded && (
        <p className="mt-3 text-[12px] leading-[1.75] text-[#a8c6b6]">
          {!hasCandidate
            ? (bengali
              ? 'প্রথমে নিচের বিশ্লেষণ ফর্মে প্রকৃত পরিমাপ দিন। তখন মডেলের ফলাফল এখানে দেখা যাবে।'
              : 'Enter measured inputs in the analysis form below to show model results here.')
            : (bengali
              ? 'সাতটি দেওয়া ইনপুটের ভিত্তিতে গবেষণামূলক মডেল এই ফসলকে সম্ভাব্য শ্রেণি হিসেবে দেখিয়েছে। এই স্কোর মাঠে উপযোগিতা, আবহাওয়া বা বাজার চাহিদার নিশ্চয়তা নয়।'
              : 'The research model ranked this crop from seven submitted inputs. This score is not verified field suitability, weather fit, or market demand.')}
        </p>
      )}
    </article>
  );
}

export function CropRecommendationTool({ initialFarmId, onViewHistory, onNavigateToTab, fixedFarm }: CropRecommendationToolProps) {
  const { t, lang } = useLanguage();
  const bengali = lang === 'bn';
  const [activeSubMode, setActiveSubMode] = useState<'farm_aware' | 'general_presets'>('farm_aware');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [farmResult, setFarmResult] = useState<FarmCropRecommendationResponse | null>(null);
  const [generalResult, setGeneralResult] = useState<PredictionResponse | null>(null);
  const [formData, setFormData] = useState<FeatureInputs>({ ...EMPTY_INPUTS });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFarmId != null) {
      setActiveSubMode('farm_aware');
      setAnalysisOpen(true);
    }
  }, [initialFarmId]);

  const effectiveResult = activeSubMode === 'farm_aware' ? farmResult : generalResult;
  const candidates = readCandidates(effectiveResult);
  const phRaw = activeSubMode === 'farm_aware' ? farmResult?.submitted_features.ph : formData.ph;
  const ph = typeof phRaw === 'number' && Number.isFinite(phRaw)
    ? phRaw
    : typeof phRaw === 'string' && phRaw.trim() && Number.isFinite(Number(phRaw)) && generalResult
      ? Number(phRaw)
      : null;
  const sourceName = activeSubMode === 'farm_aware' ? farmResult?.farm_name : null;

  const handleModeSwitch = (mode: 'farm_aware' | 'general_presets') => {
    setActiveSubMode(mode);
    setExpanded(0);
    setError(null);
    setFarmResult(null);
    setGeneralResult(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values: Record<string, number> = {};
    for (const key of Object.keys(EMPTY_INPUTS) as (keyof FeatureInputs)[]) {
      const value = formData[key].trim();
      if (!value || !Number.isFinite(Number(value))) {
        setError(t('সাতটি ইনপুটের প্রতিটি ঘরে বৈধ সংখ্যা দিন।', 'Provide a valid number for all seven features.'));
        return;
      }
      values[key] = Number(value);
    }
    if (values.N < 0 || values.P < 0 || values.K < 0 || values.rainfall < 0 ||
        values.ph < 0 || values.ph > 14 || values.humidity < 0 || values.humidity > 100) {
      setError(t('N/P/K ও বৃষ্টিপাত ঋণাত্মক হতে পারে না; pH ০–১৪ এবং আর্দ্রতা ০–১০০ হতে হবে।', 'N/P/K and rainfall must not be negative; pH 0–14 and humidity 0–100.'));
      return;
    }
    setError(null);
    setGeneralResult(null);
    setIsSubmitting(true);
    try {
      const response = await predictionApi.predict('crop_recommendation', { data: values });
      setGeneralResult(response);
      setExpanded(0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="crop-advisor-workspace -mx-3 -my-3 min-h-[calc(100vh-6rem)] bg-[#002114] px-4 py-8 text-[#f5f8f2] sm:-mx-6 sm:-my-6 sm:px-7 lg:-mx-8 lg:-my-8 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-[1060px]">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.23em] text-[#e7aa45]">
              CROP ADVISOR <span className="font-bengali tracking-normal">· {t('ফসল উপদেষ্টা', 'Farm decision support')}</span>
            </p>
            <h1 className="font-bengali text-[28px] font-bold leading-tight tracking-tight text-[#f8f9f4] sm:text-[32px]">
              {t('আপনার জমির সম্ভাব্য ফসল', 'Potential crops for your farmland')}
            </h1>
            <p className="mt-2 max-w-[700px] font-bengali text-[13px] leading-6 text-[#a5c3b2]">
              {t('মাটি ও পরিবেশের ৭টি পরিমাপ থেকে পরীক্ষামূলক এআই ফলাফল। মৌসুমি উপযোগিতা বা বাজার চাহিদা আলাদাভাবে যাচাই করা হয়নি।',
                'Research-model rankings from seven soil and climate inputs. Seasonal suitability and market demand are not separately assessed.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAnalysisOpen((previous) => !previous)}
            aria-expanded={analysisOpen}
            aria-controls="crop-advisor-analysis"
            data-testid="crop-advisor-toggle-analysis"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#e9af4c] px-4 py-3 font-bengali text-[13px] font-bold text-[#102418] shadow-[0_4px_18px_rgba(0,0,0,.16)] transition hover:bg-[#f3bc60] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {analysisOpen ? <ChevronUp className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {analysisOpen ? t('ফর্ম গুটিয়ে রাখুন', 'Hide analysis form') : t('নতুন বিশ্লেষণ চালান', 'Start crop analysis')}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 xl:grid-cols-3" data-testid="crop-advisor-reference-cards">
          {[0, 1, 2].map((index) => (
            <CropCard
              key={index}
              index={index}
              candidate={candidates[index]}
              expanded={expanded === index}
              onExpand={() => setExpanded((current) => (current === index ? null : index))}
              bengali={bengali}
              ph={ph}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-2 rounded-xl border border-[#1e4b38] bg-[#072b1e] px-4 py-3 text-[12px] leading-5 text-[#b4d1be]">
          <Info className="mt-[2px] h-4 w-4 shrink-0 text-[#e9b357]" />
          <span>
            {effectiveResult
              ? t('প্রদর্শিত শতাংশ থাকলে তা মডেলের অক্যালিব্রেটেড শ্রেণি-সম্ভাবনা; বাস্তব মাঠের সফলতার হার নয়। আবহাওয়া-ফিট ও বাজার-চাহিদার নির্ভরযোগ্য আলাদা স্কোর নেই।',
                  'Any percentages shown are uncalibrated model class probabilities, not field success rates. No independent weather-fit or market-demand scores are available.')
              : t('এখনো কোনো ফসল অনুমান করা হয়নি। নিচের বিশ্লেষণ ফর্ম খুলে নিজের প্রকৃত পরিমাপ দিন। তিনটি কার্ডে ফলাফল না আসা পর্যন্ত ফসলের নাম বা শতাংশ বানিয়ে দেখানো হবে না।',
                  'No crop prediction yet. Open the form below and submit real measurements; the cards will not fabricate crop names or percentages.')}
            {sourceName && <span className="ml-1 font-semibold text-[#e9b357]">· {sourceName}</span>}
          </span>
        </div>

        <section id="crop-advisor-analysis" className="mt-7" aria-label={t('ফসল বিশ্লেষণ ফর্ম', 'Crop analysis form')}>
          {analysisOpen ? (
            <div className="crop-advisor-form space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#23503b] bg-[#092d20] p-3 sm:p-4">
                <div className="flex items-center gap-2 font-bengali text-[14px] font-semibold text-[#f5f8f1]">
                  <FlaskConical className="h-5 w-5 text-[#ebb34e]" />
                  {t('গবেষণামূলক ফসল বিশ্লেষণ', 'Research crop analysis')}
                </div>
                <div className="flex w-full flex-wrap rounded-xl border border-[#27523e] bg-[#001e14] p-1 sm:w-auto" role="group" aria-label="Crop analysis mode">
                  <button
                    type="button"
                    data-testid="mode-farm-aware-btn"
                    aria-pressed={activeSubMode === 'farm_aware'}
                    onClick={() => handleModeSwitch('farm_aware')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition sm:flex-none ${activeSubMode === 'farm_aware' ? 'bg-[#174935] text-[#f0b959]' : 'text-[#b9d0c2] hover:bg-[#0f3627]'}`}
                  >
                    <Building2 className="h-4 w-4" /> {t('খামারভিত্তিক', 'Farm-aware')}
                  </button>
                  <button
                    type="button"
                    data-testid="mode-general-presets-btn"
                    aria-pressed={activeSubMode === 'general_presets'}
                    onClick={() => handleModeSwitch('general_presets')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition sm:flex-none ${activeSubMode === 'general_presets' ? 'bg-[#174935] text-[#f0b959]' : 'text-[#b9d0c2] hover:bg-[#0f3627]'}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" /> {t('সাধারণ গবেষণা', 'General research')}
                  </button>
                </div>
              </div>

              {activeSubMode === 'farm_aware' ? (
                <FarmCropRecommendationPanel
                  fixedFarm={fixedFarm}
                  initialFarmId={initialFarmId}
                  onViewHistory={onViewHistory}
                  onNavigateToTab={onNavigateToTab}
                  onPredictionResult={(result) => { setFarmResult(result); if (result) setExpanded(0); }}
                />
              ) : (
                <div className="rounded-[20px] border border-[#25513e] bg-[#092f22] p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Beaker className="h-5 w-5 text-[#eab04e]" />
                    <h2 className="font-bengali text-[17px] font-bold text-[#f4f7ef]">{t('সাধারণ ফসল গবেষণা কনসোল', 'General crop research console')}</h2>
                    <span className="rounded-full border border-[#86632c] px-2 py-1 text-[10px] text-[#ecc177]">22 crop classes</span>
                  </div>
                  <p className="mb-4 text-[12px] leading-6 text-[#b0cfbd]">
                    {t('সাতটি ইনপুট নিজে দিন। নিচের Preset-গুলো শুধু গবেষণার নমুনা—আপনার জমির মাপ নয়।',
                      'Enter seven features manually. Presets below are illustrative research examples, not measurements from your farm.')}
                  </p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {RESEARCH_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => { setFormData({ ...preset.values }); setGeneralResult(null); setError(null); }}
                        className="rounded-lg border border-[#3c6a4d] bg-[#133d2b] px-3 py-2 text-[11px] text-[#f1d19a] transition hover:border-[#d6a34e]"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {FEATURES.map(({ key, bn, en, suffix }) => (
                        <label key={key} className="block">
                          <span className="mb-2 block text-[12px] font-medium text-[#e4f0e5]">{t(bn, en)}{suffix ? ` (${suffix})` : ''}</span>
                          <input
                            type="number"
                            step="any"
                            required
                            value={formData[key]}
                            onChange={(event) => { setFormData((previous) => ({ ...previous, [key]: event.target.value })); setGeneralResult(null); setError(null); }}
                            className="w-full rounded-xl border border-[#346149] bg-[#03291c] px-3 py-3 text-[14px] text-white outline-hidden placeholder:text-[#668c78] focus:border-[#ebbc67] focus:ring-2 focus:ring-[#eab04e]/20"
                            placeholder={t('পরিমাপ লিখুন', 'Enter value')}
                          />
                        </label>
                      ))}
                    </div>
                    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-[#a8564b] bg-[#421f1c] p-3 text-[12px] text-[#ffc6be]"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-[#e8ac47] px-4 py-3 text-[13px] font-bold text-[#122719] transition hover:bg-[#f6bf61] disabled:cursor-wait disabled:opacity-60">
                        <Play className="h-4 w-4" />{isSubmitting ? t('বিশ্লেষণ চলছে…', 'Analyzing…') : t('ফসল অনুমান করুন', 'Run recommendation')}
                      </button>
                      <button type="button" onClick={() => { setFormData({ ...EMPTY_INPUTS }); setGeneralResult(null); setError(null); }} className="inline-flex items-center gap-2 rounded-xl border border-[#396c52] px-4 py-3 text-[13px] text-[#e3ece3] hover:bg-[#154635]">
                        <RefreshCw className="h-4 w-4" />{t('রিসেট', 'Reset')}
                      </button>
                    </div>
                  </form>
                  {generalResult && (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#edba67]"><BarChart3 className="h-4 w-4" />{t('মূল মডেল ফলাফল', 'Original model result')}</div>
                      <PredictionResultCard result={generalResult} onViewHistory={onViewHistory} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#20503a] bg-[#092e21] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#124330] p-3"><Sprout className="h-6 w-6 text-[#edb454]" /></div>
                <div>
                  <h2 className="font-bengali text-[15px] font-bold text-[#f2f6ee]">{t('প্রকৃত তথ্য দিয়ে ফসল বিশ্লেষণ', 'Analyze crops using real inputs')}</h2>
                  <p className="mt-1 text-[12px] text-[#aecaba]">{t('খামার নির্বাচন অথবা সাতটি ইনপুট ব্যবহার করে গবেষণামূলক সুপারিশ দেখুন।', 'Select your farm or supply all seven model inputs.')}</p>
                </div>
              </div>
              <button type="button" onClick={() => setAnalysisOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#ad843b] px-3 py-2 text-[12px] font-semibold text-[#eec076] transition hover:bg-[#164734]">
                {t('ফর্ম খুলুন', 'Open form')} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
        <p className="mt-6 text-center text-[11px] leading-5 text-[#789f88]">
          <Leaf className="mr-1 inline h-3.5 w-3.5" />
          {t('এটি গবেষণামূলক সিদ্ধান্ত সহায়ক টুল। স্থানীয় কৃষি কর্মকর্তার পরামর্শের বিকল্প নয়।', 'Research decision support only; not a substitute for a local agricultural expert.')}
        </p>
      </div>
    </div>
  );
}
