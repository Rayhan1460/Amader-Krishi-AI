import { ArrowRight, BarChart3, Droplets, FlaskConical, Info, Layers, MapPin, Sprout, TrendingUp } from 'lucide-react';

interface YieldScenario {
  Year: string;
  District: string;
  Division: string;
  Season: string;
  Rain: string;
  Sunshine: string;
  Wind: string;
  TempRange: string;
  NDVI_mean_season: string;
  NDVI_max_season: string;
  NDVI_integral: string;
  NDVI_anom: string;
  Pct_irrigated: string;
  NDVI_peak_month: string;
  NDVI_peak_doy: string;
  NDVI_mean_trend2: string;
  Rain_ma3: string;
  Sunshine_ma3: string;
  NDVI_mean_season_ma3: string;
  ndvi_rain_interaction: string;
}

type Translator = (bn: string, en: string) => string;

interface YieldLovableOverviewProps {
  t: Translator;
  formData: YieldScenario;
  predictedYield: unknown;
  isFormOpen: boolean;
  isSubmitting: boolean;
  onOpenForm: () => void;
  onIrrigationChange: (value: number) => void;
}

const completenessGroups: Array<{ bn: string; en: string; keys: (keyof YieldScenario)[]; hintBn: string; hintEn: string }> = [
  {
    bn: 'জেলা, অঞ্চল ও মৌসুম', en: 'Region & crop season',
    keys: ['District', 'Division', 'Season', 'Year'],
    hintBn: 'ভৌগোলিক ও সময়কাল', hintEn: 'Geography and time',
  },
  {
    bn: 'আবহাওয়া ও জলবায়ু', en: 'Weather & climate',
    keys: ['Rain', 'Sunshine', 'Wind', 'TempRange'],
    hintBn: 'বৃষ্টি, রোদ, বাতাস ও তাপমাত্রা', hintEn: 'Rain, sunshine, wind and temperature',
  },
  {
    bn: 'স্যাটেলাইট NDVI', en: 'Satellite NDVI',
    keys: ['NDVI_mean_season', 'NDVI_max_season', 'NDVI_integral', 'NDVI_anom', 'NDVI_peak_month', 'NDVI_peak_doy', 'NDVI_mean_trend2'],
    hintBn: 'উদ্ভিদের সবুজায়ন সূচক', hintEn: 'Vegetation-index observations',
  },
  {
    bn: 'সেচ ও বহুবর্ষীয় গড়', en: 'Irrigation & rolling averages',
    keys: ['Pct_irrigated', 'Rain_ma3', 'Sunshine_ma3', 'NDVI_mean_season_ma3', 'ndvi_rain_interaction'],
    hintBn: 'সেচ ও চলমান গড় উপাত্ত', hintEn: 'Irrigation and historical averages',
  },
];

function validMeasurement(value: string): string {
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) ? String(n) : '—';
}

export function YieldLovableOverview({
  t,
  formData,
  predictedYield,
  isFormOpen,
  isSubmitting,
  onOpenForm,
  onIrrigationChange,
}: YieldLovableOverviewProps) {
  const groups = completenessGroups.map((group) => {
    const complete = group.keys.filter((key) => String(formData[key] ?? '').trim() !== '').length;
    return { ...group, complete, percent: Math.round(complete / group.keys.length * 100) };
  });
  const completedCount = groups.reduce((total, group) => total + group.complete, 0);
  const currentYield = predictedYield === null || predictedYield === undefined || predictedYield === ''
    ? null : Number(predictedYield);
  const hasYield = currentYield !== null && Number.isFinite(currentYield);
  const irrigationRaw = formData.Pct_irrigated.trim() === '' ? NaN : Number(formData.Pct_irrigated);
  const irrigation = Number.isFinite(irrigationRaw) ? Math.max(0, Math.min(100, irrigationRaw)) : null;
  const location = [formData.District, formData.Season, formData.Year].filter(Boolean).join(' · ');

  return (
    <section className="yield08-overview" aria-label={t('আঞ্চলিক ধানের ফলন বিশ্লেষণ', 'Regional rice yield overview')}>
      <div className="yield08-heading">
        <div className="yield08-eyebrow"><TrendingUp size={14} aria-hidden="true" /> YIELD PREDICTION</div>
        <h1>{t('আঞ্চলিক ধানের ফলন পূর্বাভাস', 'Regional rice yield estimate')}</h1>
        <p>{t(
          'বাংলাদেশের ঐতিহাসিক জেলাভিত্তিক ধান ফলনের গবেষণামূলক বিশ্লেষণ। ব্যক্তিগত প্লটের ফসল বা লাভের নিশ্চয়তা নয়।',
          'Research estimate for historical district-level rice yield in Bangladesh—not a harvest or profit guarantee for a farm plot.'
        )}</p>
        <div className="yield08-scenario-meta"><MapPin size={14} aria-hidden="true" />{location || t('জেলা ও মৌসুম নির্বাচন বাকি', 'Select district and season')}</div>
      </div>

      <div className="yield08-grid">
        <article className="yield08-card yield08-estimate" aria-live="polite">
          <div className="yield08-card-eyebrow"><Sprout size={15} aria-hidden="true" /> {t('মডেলের অনুমান', 'MODEL ESTIMATE')}</div>
          <div className="yield08-number-row">
            <strong data-testid="yield-overview-value">{hasYield ? currentYield.toFixed(3) : '—'}</strong>
            <span>{t('টন/হেক্টর*', 'tonnes/ha*')}</span>
          </div>
          <p className="yield08-quiet">{hasYield
            ? t('প্রকৃত AI মডেল ইনফারেন্সের ফলাফল', 'Output returned by the actual ML model')
            : t('নিচে গবেষণামূলক বিশ্লেষণ চালালে ফলাফল দেখা যাবে', 'Run research inference to display the model output')}</p>

          <div className="yield08-irrigation">
            <div className="yield08-irrigation-head">
              <label htmlFor="yield08-irrigation-slider">{t('জেলাভিত্তিক সেচ কভারেজ', 'District irrigation coverage')}</label>
              <span>{irrigation === null ? '—' : `${irrigation.toFixed(1)}%`}</span>
            </div>
            <input
              id="yield08-irrigation-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={irrigation ?? 0}
              onChange={(event) => onIrrigationChange(Number(event.target.value))}
              aria-valuetext={irrigation === null ? t('পরিমাপ নেই', 'Not provided') : `${irrigation}%`}
            />
            <span className="yield08-footnote">{t('এটি Scenario Input; ব্যক্তিগত খামারের সেচ নয়।', 'Scenario input, not your individual farm irrigation.')}</span>
          </div>

          <button type="button" className="yield08-main-action" onClick={onOpenForm} aria-expanded={isFormOpen} aria-controls="yield08-research-workspace">
            {isSubmitting ? t('বিশ্লেষণ চলছে', 'Running analysis') : isFormOpen ? t('ইনপুট ফর্ম বন্ধ করুন', 'Close input form') : t('২০টি ইনপুট দিয়ে বিশ্লেষণ করুন', 'Open 20-input analysis')}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </article>

        <article className="yield08-card yield08-drivers">
          <div className="yield08-driver-topline">
            <h2><Layers size={18} aria-hidden="true" /> {t('বিশ্লেষণের জন্য প্রয়োজনীয় উপাত্ত', 'Model input readiness')}</h2>
            <span className="yield08-count">{completedCount}/20</span>
          </div>
          <p className="yield08-subnote">{t('চারটি বিভাগে ২০টি ইনপুটের পূর্ণতার অবস্থা। এগুলো ফলন-প্রভাব বা Feature Importance নয়।', 'Completeness across 20 inputs in four groups. These are NOT yield contributions or feature importance.')}</p>
          <div className="yield08-drivers-list">
            {groups.map((group) => (
              <div className="yield08-driver" key={group.en}>
                <div className="yield08-driver-label">
                  <span>{t(group.bn, group.en)}</span>
                  <b>{group.complete}/{group.keys.length}</b>
                </div>
                <div className="yield08-meter" role="meter" aria-label={t(group.bn, group.en)} aria-valuemin={0} aria-valuemax={group.keys.length} aria-valuenow={group.complete}>
                  <span style={{ width: `${group.percent}%` }} />
                </div>
                <p>{t(group.hintBn, group.hintEn)}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="yield08-fact-strip">
        <div><Droplets size={16} aria-hidden="true"/><span>{t('বৃষ্টি', 'Rain')}: <b>{validMeasurement(formData.Rain)} {formData.Rain.trim() ? 'mm' : ''}</b></span></div>
        <div><BarChart3 size={16} aria-hidden="true"/><span>NDVI: <b>{validMeasurement(formData.NDVI_mean_season)}</b></span></div>
        <div><FlaskConical size={16} aria-hidden="true"/><span>{t('মৌসুম', 'Season')}: <b>{formData.Season || '—'}</b></span></div>
        <div className="yield08-fact-caveat"><Info size={16} aria-hidden="true"/><span>{t('*মডেল সোর্সের একক স্বাধীনভাবে নিশ্চিত করা হয়নি; আঞ্চলিক গবেষণার প্রেক্ষাপটেই দেখুন।', '*Source yield unit is not independently verified; interpret only as a regional research estimate.')}</span></div>
      </div>
    </section>
  );
}
