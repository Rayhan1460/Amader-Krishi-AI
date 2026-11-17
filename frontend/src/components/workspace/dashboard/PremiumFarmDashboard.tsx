import { useEffect, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, CircleAlert, ClipboardList,
  CloudSun, Droplets, Home, LayoutGrid, Leaf, MapPin, Plus, ScanLine, Sparkles, Sprout, TrendingUp,
  WalletCards, Wheat, Wind,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { farmApi, farmIntelligenceApi } from '../../../services/api.ts';
import type { FarmActionItem, FarmProfile, FarmUnifiedIntelligenceResponse } from '../../../types/index.ts';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';
import { FarmBudgetCalculator } from './FarmBudgetCalculator.tsx';
import { FarmWeatherAdvisoryBanner } from './FarmWeatherAdvisoryBanner.tsx';
import './FarmDashboard.css';

interface PremiumFarmDashboardProps {
  initialFarmId?: number | null;
  onNavigateToTab: (tab: WorkspaceTab, modelId?: string) => void;
  onSelectFarmId?: (farmId: number) => void;
}

interface FarmDetails {
  farmId: number;
  intelligence: FarmUnifiedIntelligenceResponse | null;
  actions: FarmActionItem[] | null;
}

export function PremiumFarmDashboard({
  initialFarmId = null, onNavigateToTab, onSelectFarmId,
}: PremiumFarmDashboardProps) {
  const { t, lang } = useLanguage();
  const [farms, setFarms] = useState<FarmProfile[] | null>(null);
  const [selection, setSelection] = useState<number | null>(initialFarmId);
  const [farmError, setFarmError] = useState(false);
  const [details, setDetails] = useState<FarmDetails | null>(null);
  const [farmsAttempt, setFarmsAttempt] = useState(0);
  const [detailsAttempt, setDetailsAttempt] = useState(0);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [showFarmTools, setShowFarmTools] = useState(false);

  useEffect(() => {
    let current = true;
    farmApi.listFarms().then((loaded) => {
      if (!current) return;
      setFarms(loaded);
      setFarmError(false);
    }).catch(() => {
      if (current) setFarmError(true);
    });
    return () => { current = false; };
  }, [farmsAttempt]);

  const farm = farms?.find((item) => item.id === selection) ?? farms?.find((item) => item.is_active) ?? farms?.[0];
  const farmId = farm?.id;

  useEffect(() => {
    if (farmId != null) onSelectFarmId?.(farmId);
  }, [farmId, onSelectFarmId]);

  useEffect(() => {
    if (farmId == null) return;
    let current = true;
    void Promise.allSettled([
      farmIntelligenceApi.getIntelligence(farmId),
      farmIntelligenceApi.getActions(farmId),
    ]).then(([intelligence, actions]) => {
      if (!current) return;
      setDetails({
        farmId,
        intelligence: intelligence.status === 'fulfilled' ? intelligence.value : null,
        actions: actions.status === 'fulfilled' ? actions.value.actions ?? [] : null,
      });
    });
    return () => { current = false; };
  }, [farmId, detailsAttempt]);

  const activeDetails = details?.farmId === farmId ? details : null;
  const intel = activeDetails?.intelligence;
  const loading = farms === null && !farmError;
  const weather = intel?.weather_summary?.status === 'ok' ? intel.weather_summary : null;
  const tasks = intel?.tasks_summary;
  const activeCrops = intel?.crops_summary.active_crops_count;
  const dueToday = tasks?.due_today_tasks;
  const completed = tasks?.completed_tasks;
  const location = farm && [farm.upazila, farm.district].filter(Boolean).join(', ');
  const locale = lang === 'bn' ? 'bn-BD' : 'en-BD';
  const formatter = new Intl.NumberFormat(locale);
  const count = (value: number | null | undefined, unit = '') =>
    value == null || !Number.isFinite(value) ? '—' : formatter.format(value) + unit;
  const todayLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka',
  }).format(new Date());
  const goCalendar = () => onNavigateToTab('calendar');
  const goWeather = () => onNavigateToTab('tools', 'flood_susceptibility');

  const dueTodayTasks = tasks?.all_tasks.filter((task) => task.is_due_today) ?? [];
  const previewTasks = Array.from(new Map(
    [...dueTodayTasks, ...(tasks?.overdue_tasks_list ?? []), ...(tasks?.upcoming_tasks ?? [])]
      .filter((task) => task.status === 'pending' || task.status === 'in_progress')
      .map((task) => [task.id, task]),
  ).values()).slice(0, 3);

  const shortcuts = [
    { title: t('বাজেট ও লাভ', 'Budget and profit'), note: t('খরচ ও নিজের শ্রমের হিসাব', 'Costs and the value of your work'), icon: WalletCards, theme: 'lime', action: () => setCalculatorOpen(true) },
    { title: t('ফসলের স্বাস্থ্য', 'Crop health'), note: t('ফসলের ছবি দিয়ে পর্যবেক্ষণ', 'Check a crop from a photo'), icon: ScanLine, theme: 'mint', action: () => onNavigateToTab('crop_monitoring', farmId?.toString()) },
    { title: t('বাজার পূর্বাভাস', 'Market outlook'), note: t('টমেটো ও বোরো চালের দাম', 'Tomato and Boro rice price tools'), icon: TrendingUp, theme: 'sand', action: () => onNavigateToTab('tools', 'tomato_price') },
    { title: t('ফসল ও গুদাম', 'Harvest and storage'), note: t('ফসল কাটা ও সংরক্ষণের হিসাব', 'Track harvest and storage'), icon: Wheat, theme: 'moss', action: () => onNavigateToTab('harvest', farmId?.toString()) },
  ];

  const activity = [
    { label: t('সম্পন্ন', 'Completed'), value: completed, colour: 'green' },
    { label: t('আজকের কাজ', 'Due today'), value: dueToday, colour: 'lime' },
    { label: t('সময় পেরিয়েছে', 'Overdue'), value: tasks?.overdue_tasks, colour: 'ochre' },
  ];

  const progressValue = tasks?.total_tasks && completed != null
    ? Math.max(0, Math.min(100, Math.round(completed / tasks.total_tasks * 100)))
    : null;

  return (
    <div className="farm-dash">
      <div className="farm-dash-wrap">
        <header className="farm-dash-top">
          <div>
            <h1>{t('আমার খামার', 'My farm')}</h1>
            <p>{todayLabel}</p>
          </div>
          {farms && farms.length > 1 && (
            <label className="farm-dash-select">
              <MapPin aria-hidden="true" />
              <select aria-label={t('খামার নির্বাচন করুন', 'Select farm')} value={farmId ?? ''}
                onChange={(event) => setSelection(Number(event.target.value))}>
                {farms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          )}
          {farms?.length === 1 && location && (
            <span className="farm-dash-top-location"><MapPin aria-hidden="true" />{location}</span>
          )}
        </header>

        <section className="farm-dash-hero" aria-labelledby="farm-dash-title">
          <div className="farm-dash-hero-content">
            <p className="farm-dash-hero-tag"><Sprout aria-hidden="true" />{t('খামারের সারাংশ', 'Farm overview')}</p>
            <h2 id="farm-dash-title">{farm?.name ?? t('খামারের পরিকল্পনা শুরু করুন', 'Start your farm plan')}</h2>
            {farm ? (
              <p className="farm-dash-location"><MapPin aria-hidden="true" />
                {[location, farm.soil_type].filter(Boolean).join(' · ')}
              </p>
            ) : (
              <p>{t('আপনার জমি, ফসল ও পরিচর্যার কাজ এক জায়গায় রাখুন।', 'Keep your fields, crops and care schedule in one place.')}</p>
            )}
            <div className="farm-dash-hero-actions">
              {!loading && !farmError && (
                <button className="farm-dash-primary" type="button"
                  onClick={() => farm ? onNavigateToTab('smart_center', farmId?.toString()) : goCalendar()}>
                  {farm ? <ArrowUpRight aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {farm ? t('খামারের বিস্তারিত', 'Farm details') : t('খামার যোগ করুন', 'Add a farm')}
                </button>
              )}
              <button className="farm-dash-primary farm-dash-secondary" type="button" onClick={() => setCalculatorOpen(true)}>
                <WalletCards aria-hidden="true" />{t('বাজেট হিসাব', 'Budget calculator')}
              </button>
            </div>
            {loading && <p className="farm-dash-status" role="status">{t('খামারের তথ্য লোড হচ্ছে…', 'Loading farm profiles…')}</p>}
          </div>
          <dl className="farm-dash-stats">
            <div><span className="farm-dash-stat-icon"><Leaf aria-hidden="true" /></span><dt>{t('জমির আকার', 'Field area')}</dt><dd>{farm ? count(farm.area, ` ${farm.area_unit}`) : '—'}</dd></div>
            <div><span className="farm-dash-stat-icon"><Sprout aria-hidden="true" /></span><dt>{t('চলতি ফসল', 'Active crops')}</dt><dd>{count(activeCrops)}</dd></div>
            <div><span className="farm-dash-stat-icon"><CalendarDays aria-hidden="true" /></span><dt>{t('আজকের কাজ', 'Due today')}</dt><dd>{count(dueToday)}</dd></div>
          </dl>
        </section>

        {farmError && (
          <div className="farm-dash-alert" role="alert">
            <CircleAlert aria-hidden="true" /><span>{t('খামারের তালিকা লোড হয়নি।', 'The farm list could not be loaded.')}</span>
            <button type="button" onClick={() => { setFarmError(false); setFarmsAttempt((attempt) => attempt + 1); }}>{t('আবার চেষ্টা করুন', 'Try again')}</button>
          </div>
        )}
        {farm && activeDetails && (!intel || activeDetails.actions === null) && (
          <div className="farm-dash-alert" role="alert">
            <CircleAlert aria-hidden="true" /><span>{t('খামারের সব তথ্য পাওয়া যায়নি।', 'Some farm details are unavailable.')}</span>
            <button type="button" onClick={() => { setDetails(null); setDetailsAttempt((attempt) => attempt + 1); }}>{t('আবার চেষ্টা করুন', 'Try again')}</button>
          </div>
        )}
        {farm && !activeDetails && <p className="farm-dash-loading" role="status">{t('পরিচর্যার তথ্য লোড হচ্ছে…', 'Loading crop care data…')}</p>}

        <div className="farm-dash-brief">
          <section className="farm-dash-panel farm-dash-weather" aria-labelledby="farm-weather-title">
            <div className="farm-dash-panel-heading">
              <span className="farm-dash-glyph"><CloudSun aria-hidden="true" /></span>
              <h2 id="farm-weather-title">{t('আজকের আবহাওয়া', "Today's weather")}</h2>
              <button className="farm-dash-icon-link" type="button" aria-label={t('আবহাওয়া ও ঝুঁকি দেখুন', 'Open weather and risk')} onClick={goWeather}><ArrowUpRight aria-hidden="true" /></button>
            </div>
            <div className="farm-dash-weather-body">
              <strong>{count(weather?.temp_current, '°')}<span className="sr-only">{weather?.temp_current != null && t(' সেলসিয়াস', ' Celsius')}</span></strong>
              <div><b>{weather ? t(weather.condition_bn, weather.condition_en) : t('স্থানীয় আবহাওয়া', 'Local weather')}</b>
                <p>{weather ? t(weather.location_label_bn, weather.location_label_en) : !farm ? t('খামার যোগ করলে এখানে দেখা যাবে', 'Add a farm to see local conditions') : !activeDetails ? t('আবহাওয়া লোড হচ্ছে…', 'Loading weather…') : t('এখন তথ্য পাওয়া যাচ্ছে না', 'Currently unavailable')}</p></div>
            </div>
            <dl className="farm-dash-weather-facts">
              <div><dt><Droplets aria-hidden="true" />{t('আর্দ্রতা', 'Humidity')}</dt><dd>{count(weather?.humidity, '%')}</dd></div>
              <div><dt><Wind aria-hidden="true" />{t('বাতাস', 'Wind')}</dt><dd>{count(weather?.wind_kmh, t(' কিমি/ঘণ্টা', ' km/h'))}</dd></div>
            </dl>
          </section>

          <section className="farm-dash-panel farm-dash-tasks" aria-labelledby="farm-tasks-title">
            <div className="farm-dash-panel-heading">
              <span className="farm-dash-glyph"><ClipboardList aria-hidden="true" /></span>
              <h2 id="farm-tasks-title">{t('পরিচর্যার কাজ', 'Crop care tasks')}</h2>
              <button className="farm-dash-icon-link" type="button" aria-label={t('কৃষি ক্যালেন্ডার খুলুন', 'Open the farm calendar')} onClick={goCalendar}><ArrowUpRight aria-hidden="true" /></button>
            </div>
            {previewTasks.length > 0 ? (
              <ul className="farm-dash-task-list">
                {previewTasks.map((task) => (
                  <li key={task.id}><button type="button" onClick={goCalendar}>
                    <span className="farm-dash-task-dot" data-overdue={task.is_overdue} aria-hidden="true" />
                    <span><b>{task.title}</b><small>{task.crop_name || t(task.category_bn, task.category)}</small></span>
                    <span className="farm-dash-task-time" data-overdue={task.is_overdue}>{task.is_overdue ? t('সময় পেরিয়েছে', 'Overdue') : task.is_due_today ? t('আজ', 'Today') : task.due_date}</span>
                  </button></li>
                ))}
              </ul>
            ) : (
              <div className="farm-dash-empty"><b>{!farm ? t('পরের কাজটি ঠিক করুন', 'Plan your next task') : !activeDetails ? t('কাজ লোড হচ্ছে…', 'Loading tasks…') : !intel ? t('কাজের তথ্য পাওয়া যায়নি', 'Task data unavailable') : t('আসন্ন কাজ নেই', 'No upcoming work')}</b>
                <p>{t('কৃষি ক্যালেন্ডারে সেচ, সার ও পরিচর্যার সময় যোগ করুন।', 'Schedule irrigation, fertilising and crop care in the calendar.')}</p>
                <button className="farm-dash-text" type="button" onClick={goCalendar}>{t('ক্যালেন্ডার খুলুন', 'Open calendar')}<ArrowRight aria-hidden="true" /></button></div>
            )}
          </section>

          <section className="farm-dash-panel farm-dash-progress" aria-labelledby="farm-progress-title">
            <div className="farm-dash-panel-heading">
              <span className="farm-dash-glyph"><TrendingUp aria-hidden="true" /></span>
              <h2 id="farm-progress-title">{t('কাজের অগ্রগতি', 'Work progress')}</h2>
              {progressValue != null && <span className="farm-dash-percent" title={t('মোট কাজের মধ্যে সম্পন্ন', 'Share of all tasks completed')}>{count(progressValue, '%')}</span>}
            </div>
            <dl className="farm-dash-activity">
              {activity.map(({ label, value, colour }) => (
                <div className="farm-dash-activity-row" key={label}>
                  <dt>{label}</dt><dd>{count(value)}</dd>
                  <span className="farm-dash-meter" aria-hidden="true"><span data-colour={colour}
                    style={{ width: `${tasks?.total_tasks && value != null ? Math.max(0, Math.min(100, value / tasks.total_tasks * 100)) : 0}%` }} /></span>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <button className="farm-dash-ai" type="button" onClick={() => onNavigateToTab('chat')}>
          <span className="farm-dash-ai-symbol"><Sparkles aria-hidden="true" /></span>
          <span><strong>{t('আমাদের কৃষি AI', 'Amader Krishi AI')}</strong><small>{t('ফসল, মাটি বা পরিচর্যা নিয়ে বাংলায় প্রশ্ন করুন', 'Ask about crops, soil or crop care')}</small></span>
          <ArrowRight aria-hidden="true" />
        </button>

        {activeDetails?.actions?.length ? (
          <div className="farm-dash-advisories">
            <FarmWeatherAdvisoryBanner actions={activeDetails.actions} weatherSummary={intel?.weather_summary}
              onNavigateToTab={onNavigateToTab} />
          </div>
        ) : null}

        <section className="farm-dash-quick" aria-labelledby="farm-dash-quick-title">
          <h2 id="farm-dash-quick-title">{t('খামারের টুল', 'Farm tools')}</h2>
          <div className="farm-dash-shortcuts">
            {shortcuts.map(({ title, note, icon: Icon, theme, action }) => (
              <button type="button" className="farm-dash-tile" onClick={action} key={title}>
                <span className="farm-dash-glyph" data-theme={theme}><Icon aria-hidden="true" /></span>
                <ArrowUpRight aria-hidden="true" className="farm-dash-arrow" />
                <strong>{title}</strong>
                <span>{note}</span>
              </button>
            ))}
          </div>
          <button className="farm-dash-text farm-dash-more" type="button" aria-expanded={showFarmTools} aria-controls="farm-dash-tools"
            onClick={() => setShowFarmTools((open) => !open)}>
            {showFarmTools ? t('অতিরিক্ত টুল বন্ধ করুন', 'Hide more tools') : t('আরও টুল দেখুন', 'More tools')}<ChevronDown aria-hidden="true" />
          </button>
          <div className="farm-dash-tools" id="farm-dash-tools" hidden={!showFarmTools}>
            <button type="button" onClick={() => onNavigateToTab('soil_health', farmId?.toString())}><Leaf aria-hidden="true" />{t('মাটি বিশ্লেষণ', 'Soil analysis')}<ArrowRight aria-hidden="true" /></button>
            <button type="button" onClick={goWeather}><CloudSun aria-hidden="true" />{t('আবহাওয়া ও ঝুঁকি', 'Weather and risk')}<ArrowRight aria-hidden="true" /></button>
            <button type="button" onClick={() => onNavigateToTab('tools', 'crop_recommendation')}><Sprout aria-hidden="true" />{t('ফসল উপদেষ্টা', 'Crop advisor')}<ArrowRight aria-hidden="true" /></button>
          </div>
        </section>

        <nav className="farm-dash-mobile-nav" aria-label={t('খামারের নেভিগেশন', 'Farm navigation')}>
          <button type="button" aria-current="page" onClick={() => window.scrollTo({ top: 0 })}><Home aria-hidden="true" /><span>{t('হোম', 'Home')}</span></button>
          <button type="button" onClick={goCalendar}><CalendarDays aria-hidden="true" /><span>{t('ক্যালেন্ডার', 'Calendar')}</span></button>
          <button type="button" className="farm-dash-mobile-chat" onClick={() => onNavigateToTab('chat')}><span className="farm-dash-mobile-chat-icon"><Sparkles aria-hidden="true" /></span><span>{t('AI চ্যাট', 'AI chat')}</span></button>
          <button type="button" onClick={() => onNavigateToTab('tools', 'tomato_price')}><TrendingUp aria-hidden="true" /><span>{t('বাজার', 'Market')}</span></button>
          <a href="#farm-dash-quick-title"><LayoutGrid aria-hidden="true" /><span>{t('টুল', 'Tools')}</span></a>
        </nav>
        {calculatorOpen && <FarmBudgetCalculator onClose={() => setCalculatorOpen(false)} />}
      </div>
    </div>
  );
}
