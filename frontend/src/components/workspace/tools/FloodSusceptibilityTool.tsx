import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ChevronDown, CircleHelp, FlaskConical, History, RotateCcw, Waves } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { predictionApi, getErrorMessage } from '../../../services/api.ts';
import type { PredictionResponse } from '../../../types/index.ts';

const numberFields = ['elevation_m', 'slope_deg', 'dist_to_river_m', 'drainage_density_km_per_km2'] as const;
type NumericField = typeof numberFields[number];
type Terrain = Record<NumericField | 'landcover_class', string>;

const emptyTerrain: Terrain = {
  elevation_m: '', slope_deg: '', dist_to_river_m: '', drainage_density_km_per_km2: '', landcover_class: '',
};

const scenarios = [
  { id: 'river', bn: 'নদীর পাড়ের নিচু জমি', en: 'Riverbank lowland', terrain: ['3.5', '0.6', '120', '4.2', 'Agricultural'] },
  { id: 'upland', bn: 'উঁচু জমি', en: 'Upland terrace', terrain: ['38', '5.8', '2800', '0.8', 'Forest'] },
  { id: 'haor', bn: 'হাওর এলাকার নিচু জমি', en: 'Haor basin lowland', terrain: ['4.8', '0.9', '320', '3.1', 'Water'] },
] as const;

function parseField(value: string) {
  const input = value.trim().replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
  return /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input) ? Number(input.replace(',', '.')) : NaN;
}

interface Props {
  onViewHistory?: (recordId: number) => void;
}

export function FloodSusceptibilityTool({ onViewHistory }: Props) {
  const { t, lang } = useLanguage();
  const [form, setForm] = useState<Terrain>(emptyTerrain);
  const [example, setExample] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<keyof Terrain | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const fields = {
    elevation_m: { name: t('জমির উচ্চতা', 'Elevation'), unit: t('মিটার', 'm'), example: '5.2' },
    slope_deg: { name: t('জমির ঢাল', 'Slope'), unit: t('ডিগ্রি', '°'), example: '1.2' },
    dist_to_river_m: { name: t('নদী থেকে দূরত্ব', 'Distance to river'), unit: t('মিটার', 'm'), example: '250' },
    drainage_density_km_per_km2: { name: t('পানিপথের ঘনত্ব', 'Drainage density'), unit: t('কিমি/বর্গকিমি', 'km/km²'), example: '3.4' },
  };
  const landcover = [
    ['Agricultural', t('ফসলি জমি', 'Cropland')],
    ['Water', t('জলাশয় / হাওর', 'Water / wetland')],
    ['Forest', t('বন / গাছপালা', 'Forest / vegetation')],
    ['Urban', t('বসতি / শহর', 'Built-up area')],
    ['Bareland', t('খোলা মাটি / চর', 'Bare ground / sandbar')],
  ];
  const format = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { maximumFractionDigits: 2 });
  const prediction = result?.prediction;
  const category = prediction?.susceptibility_category;
  const high = category === 'High Susceptibility';
  const low = category === 'Low Susceptibility';
  const score = prediction?.susceptibility_probability;
  const hasScore = typeof score === 'number' && score >= 0 && score <= 1;

  function clearResult() {
    setError('');
    setInvalid(null);
    setResult(null);
  }

  function updateField(key: keyof Terrain, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    clearResult();
  }

  function applyScenario(scenario: typeof scenarios[number]) {
    const [elevation_m, slope_deg, dist_to_river_m, drainage_density_km_per_km2, landcover_class] = scenario.terrain;
    setForm({ elevation_m, slope_deg, dist_to_river_m, drainage_density_km_per_km2, landcover_class });
    setExample(scenario.id);
    setAdvanced(true);
    clearResult();
  }

  async function analyse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    clearResult();
    const elevation = parseField(form.elevation_m);
    const slope = parseField(form.slope_deg);
    const distance = parseField(form.dist_to_river_m);
    const drainage = parseField(form.drainage_density_km_per_km2);
    const values = [elevation, slope, distance, drainage];
    const valid = [Number.isFinite(elevation), slope >= 0 && slope <= 90,
      Number.isFinite(distance) && distance >= 0, Number.isFinite(drainage) && drainage >= 0];
    const invalidIndex = valid.indexOf(false);
    const invalidKey = invalidIndex >= 0 ? numberFields[invalidIndex] : !form.landcover_class ? 'landcover_class' : null;
    if (invalidKey) {
      if (invalidKey === 'drainage_density_km_per_km2' || invalidKey === 'landcover_class') setAdvanced(true);
      setInvalid(invalidKey);
      const label = invalidKey === 'landcover_class' ? t('জমির ধরন', 'Land cover') : fields[invalidKey].name;
      setError(invalidKey === 'slope_deg' ? t('ঢাল ০ থেকে ৯০ ডিগ্রির মধ্যে লিখুন।', 'Enter a slope between 0 and 90 degrees.')
        : t(`“${label}” ঘরে সঠিক তথ্য দিন।`, `Enter a valid value for “${label}”.`));
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>(`[name="${invalidKey}"]`)?.focus();
      });
      return;
    }
    const data = {
      elevation_m: values[0], slope_deg: values[1], dist_to_river_m: values[2],
      drainage_density_km_per_km2: values[3], landcover_class: form.landcover_class,
    };
    setLoading(true);
    try {
      const response = await predictionApi.predict('flood_susceptibility', { data });
      if (typeof response?.prediction?.susceptibility_category !== 'string') throw new Error('Invalid prediction response');
      setResult(response);
      requestAnimationFrame(() => {
        const panel = resultRef.current;
        if (panel && panel.getBoundingClientRect().top > window.innerHeight - 140) {
          panel.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
      });
    } catch (failure) {
      const detail = getErrorMessage(failure);
      setError(lang === 'bn' && !/[\u0980-\u09ff]/.test(detail)
        ? 'বিশ্লেষণ করা যায়নি। একটু পরে আবার চেষ্টা করুন।' : detail);
    } finally {
      setLoading(false);
    }
  }

  function renderField(key: NumericField) {
    const field = fields[key];
    return <label key={key} className="farm-weather__field">
      <span>{field.name} <small>({field.unit})</small></span>
      <input name={key} type="text" inputMode="decimal" value={form[key]} aria-required="true"
        aria-invalid={invalid === key} onChange={(event) => updateField(key, event.target.value)}
        placeholder={t('যেমন', 'e.g.') + ' ' + field.example} />
    </label>;
  }

  return (
    <div className="farm-weather__risk-grid">
      <form ref={formRef} className="farm-weather__terrain" onSubmit={analyse} noValidate aria-busy={loading}>
        <fieldset disabled={loading}>
          <legend className="farm-weather__legend"><FlaskConical size={16} aria-hidden="true" />{t('নমুনা দিয়ে দেখে নিন', 'Try an example')}</legend>
          <div className="farm-weather__examples">
            {scenarios.map((scenario) => <button key={scenario.id} type="button" onClick={() => applyScenario(scenario)}>
              {t(scenario.bn, scenario.en)}
            </button>)}
          </div>
          {example && <p className="farm-weather__notice" role="status">
            {t('নমুনার তথ্য ব্যবহার হচ্ছে। নিজের জমির জন্য সব তথ্য যাচাই করে বদলান।', 'Example values are loaded. Review and replace all values for your own land.')}
          </p>}
          <div className="farm-weather__fields">
            {numberFields.slice(0, 3).map(renderField)}
          </div>
          <button className="farm-weather__expand" type="button" aria-expanded={advanced} aria-controls="farm-weather-terrain-advanced"
            onClick={() => setAdvanced((open) => !open)}>
            {t('আরও জমির তথ্য', 'More terrain details')}
            <ChevronDown size={17} aria-hidden="true" />
            <small>{t('বিশ্লেষণের জন্য প্রয়োজন', 'Required for analysis')}</small>
          </button>
          <div id="farm-weather-terrain-advanced" hidden={!advanced}>
            <div className="farm-weather__fields farm-weather__fields--advanced">
              {renderField('drainage_density_km_per_km2')}
              <label className="farm-weather__field">
                <span>{t('জমির ধরন', 'Land cover')}</span>
                <select name="landcover_class" value={form.landcover_class} aria-required="true"
                  aria-invalid={invalid === 'landcover_class'} onChange={(event) => updateField('landcover_class', event.target.value)}>
                  <option value="">{t('ধরন বাছুন', 'Choose land cover')}</option>
                  {landcover.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>
          {error && <p className="farm-weather__error" role="alert">{error}</p>}
          <div className="farm-weather__actions">
            <button className="farm-weather__primary" type="submit">
              <Waves size={19} aria-hidden="true" />
              {loading ? t('বিশ্লেষণ হচ্ছে…', 'Analysing…') : t('ঝুঁকি বিশ্লেষণ করুন', 'Analyse susceptibility')}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button className="farm-weather__secondary" type="button" onClick={() => {
              setForm(emptyTerrain);
              setExample(null);
              setAdvanced(false);
              clearResult();
            }}>
              <RotateCcw size={16} aria-hidden="true" /> {t('মুছুন', 'Reset')}
            </button>
          </div>
        </fieldset>
      </form>

      <div ref={resultRef} className="farm-weather__risk-info" data-level={high ? 'high' : low ? 'low' : undefined} aria-live="polite">
        <span className="farm-weather__risk-icon"><Waves size={24} aria-hidden="true" /></span>
        <h3>{t('বিশ্লেষণের ফলাফল', 'Assessment result')}</h3>
        {result ? <>
          <strong className="farm-weather__risk-level">{high ? t('বন্যাপ্রবণতা বেশি', 'High susceptibility')
            : low ? t('বন্যাপ্রবণতা কম', 'Low susceptibility') : category}</strong>
          {hasScore && <p>{t('উচ্চ প্রবণতার মডেল স্কোর', 'Model score for high susceptibility')} · {format.format(score * 100)}%</p>}
          {example && <p>{t('নমুনা বা সম্পাদিত নমুনা থেকে পাওয়া ফল', 'Result from an example or edited example')}</p>}
          {result.record_id != null && onViewHistory && <button className="farm-weather__text-button" type="button"
            onClick={() => onViewHistory(result.record_id!)}>
            <History size={16} aria-hidden="true" />{t('বিশ্লেষণের ইতিহাস দেখুন', 'View assessment history')}
          </button>}
        </> : <p>{loading ? t('জমির তথ্য বিশ্লেষণ করা হচ্ছে।', 'Analysing the terrain data.')
          : t('জমির তথ্য পূরণ করে বিশ্লেষণ চালালে এখানে ফলাফল দেখা যাবে।', 'Enter the terrain details and run the assessment to see the result.')}</p>}
        <div className="farm-weather__risk-note"><CircleHelp size={17} aria-hidden="true" />
          <span>{t('এটি জমির বৈশিষ্ট্যভিত্তিক মডেলের হিসাব। চলতি বন্যার সতর্কতার জন্য সরকারি পূর্বাভাস দেখুন।',
            'This model uses terrain characteristics. Check official forecasts for current flood alerts.')}</span>
        </div>
        <a href="https://ffwc.gov.bd/" target="_blank" rel="noreferrer">{t('সরকারি বন্যা পূর্বাভাস', 'Official flood forecasts')} ↗</a>
      </div>
    </div>
  );
}
