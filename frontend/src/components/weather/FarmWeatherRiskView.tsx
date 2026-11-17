import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Cloud, CloudFog, CloudLightning,
  CloudOff, CloudRain, CloudSun, Droplets, MapPin, RefreshCw, Sun, Waves, Wind,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { farmApi, weatherApi } from '../../services/api.ts';
import type { FarmProfile, FarmWeatherForecastResponse } from '../../types/index.ts';
import { FloodSusceptibilityTool } from '../workspace/tools/FloodSusceptibilityTool.tsx';
import './FarmWeatherRiskView.css';

const REFRESH_MS = 15 * 60 * 1000;
const DHAKA = 'Asia/Dhaka';
const dateKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: DHAKA, year: 'numeric', month: '2-digit', day: '2-digit',
});

function WeatherIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name === 'sun' ? Sun : name === 'cloud-sun' ? CloudSun
    : name === 'cloud-fog' ? CloudFog
    : name === 'cloud-lightning' || name === 'cloud-hail' ? CloudLightning
    : name?.startsWith('cloud-rain') || name === 'cloud-drizzle' ? CloudRain : Cloud;
  return <Icon className={className} aria-hidden="true" />;
}

function useWeatherForecast(farmId: number | null) {
  const [forecast, setForecast] = useState<FarmWeatherForecastResponse | null>(null);
  const [pendingFarm, setPendingFarm] = useState<number | null>(null);
  const [failedFarm, setFailedFarm] = useState<number | null>(null);
  const refresh = useRef<() => void>(() => {});
  const [today, setToday] = useState(() => dateKey.format(new Date()));

  useEffect(() => {
    if (farmId === null) return;
    let disposed = false;
    let pending = false;
    let lastLoad = 0;

    async function load(force = false) {
      if (disposed || pending || farmId === null) return;
      pending = true;
      lastLoad = Date.now();
      setToday(dateKey.format(new Date()));
      setPendingFarm(farmId);
      setFailedFarm(null);
      try {
        const data = await weatherApi.getForecast(farmId, force);
        if (disposed) return;
        if (data.status === 'unavailable' || !data.forecast?.some((day) => day.date >= dateKey.format(new Date()))) {
          setFailedFarm(farmId);
        } else {
          setForecast(data);
        }
      } catch {
        if (!disposed) setFailedFarm(farmId);
      } finally {
        pending = false;
        if (!disposed) setPendingFarm(null);
      }
    }

    function refreshVisible() {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad >= REFRESH_MS) {
        void load();
      }
    }

    refresh.current = () => { void load(true); };
    void load();
    const timer = window.setInterval(refreshVisible, REFRESH_MS);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      disposed = true;
      refresh.current = () => {};
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [farmId]);

  return {
    forecast: forecast?.location.farm_id === farmId ? forecast : null,
    loading: pendingFarm !== null && pendingFarm === farmId,
    failed: failedFarm !== null && failedFarm === farmId,
    today,
    refresh: () => refresh.current(),
  };
}

interface Props {
  initialFarmId?: number | null;
  onOpenCalendar?: () => void;
  onViewHistory?: (recordId: number) => void;
}

export function FarmWeatherRiskView({ initialFarmId, onOpenCalendar, onViewHistory }: Props) {
  const { t, lang } = useLanguage();
  const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
  const [farmList, setFarmList] = useState<FarmProfile[] | null>(null);
  const [farmError, setFarmError] = useState(false);
  const [farmRetry, setFarmRetry] = useState(0);
  const [pickedFarm, setPickedFarm] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setFarmError(false);
    void farmApi.listFarms()
      .then((farms) => {
        if (!disposed) setFarmList(farms.filter((farm) => farm.is_active));
      })
      .catch(() => {
        if (!disposed) setFarmError(true);
      });
    return () => { disposed = true; };
  }, [farmRetry]);

  const farm = farmList?.find((item) => item.id === pickedFarm)
    ?? farmList?.find((item) => item.id === initialFarmId)
    ?? farmList?.[0];
  const { forecast, loading, failed, today, refresh } = useWeatherForecast(farm?.id ?? null);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { timeZone: DHAKA, day: 'numeric', month: 'long' });
  const stamp = new Intl.DateTimeFormat(locale, {
    timeZone: DHAKA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
  const days = (forecast?.forecast ?? []).filter((day) => day.date >= today).slice(0, 7);
  const selectedDay = days.find((day) => day.date === pickedDate) ?? days[0];
  const current = days[0]?.date === today ? forecast?.current : undefined;
  const updated = forecast?.generated_at ? new Date(forecast.generated_at) : null;
  const cached = forecast?.is_cached || failed;
  const stale = !!forecast?.message_bn || failed;
  const hasCurrentTemp = current?.as_of?.slice(0, 10) === today && current.temp_current != null;
  const stats = selectedDay ? [
    { Icon: CloudRain, label: t('বৃষ্টির সম্ভাবনা', 'Chance of rain'), value: `${number.format(selectedDay.precipitation_probability_max)}%` },
    { Icon: Droplets, label: t('গড় আর্দ্রতা', 'Mean humidity'), value: `${number.format(selectedDay.relative_humidity_mean)}%` },
    { Icon: Wind, label: t('সর্বোচ্চ বাতাস', 'Max wind'), value: `${number.format(selectedDay.wind_speed_max_kmh)} ${t('কিমি/ঘণ্টা', 'km/h')}` },
  ] : [];

  return (
    <div className="farm-weather">
      <header className="farm-weather__hero">
        <div className="farm-weather__hero-content">
          <span className="farm-weather__hero-icon"><CloudSun size={24} aria-hidden="true" /></span>
          <h1>{t('আবহাওয়া ও বন্যার ঝুঁকি', 'Weather & flood risk')}</h1>
          <p>{t('খামারের পূর্বাভাস দেখুন, জমির বন্যাপ্রবণতা যাচাই করুন।', 'See your farm’s forecast and assess its flood susceptibility.')}</p>
          <a className="farm-weather__hero-link" href="#farm-weather-forecast">
            {t('পূর্বাভাস দেখুন', 'View forecast')} <ArrowDown size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      <section id="farm-weather-forecast" className="farm-weather__panel" aria-labelledby="farm-weather-title">
        <div className="farm-weather__section-head">
          <div className="farm-weather__section-title">
            <span className="farm-weather__icon"><CloudSun size={22} aria-hidden="true" /></span>
            <div>
              <h2 id="farm-weather-title">{t('খামারের আবহাওয়া', 'Farm weather')}</h2>
              <p>{t('৭ দিনের পূর্বাভাস', '7-day forecast')}</p>
            </div>
          </div>
          {farm && <div className="farm-weather__controls">
            <label className="farm-weather__select">
              <MapPin size={17} aria-hidden="true" />
              <select aria-label={t('খামার বাছুন', 'Select farm')} value={farm.id} onChange={(event) => {
                setPickedFarm(Number(event.target.value));
                setPickedDate(null);
              }}>
                {farmList?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.district}</option>)}
              </select>
            </label>
            <button className="farm-weather__icon-button" type="button" disabled={loading}
              aria-label={t('পূর্বাভাস রিফ্রেশ করুন', 'Refresh forecast')}
              title={t('পূর্বাভাস রিফ্রেশ করুন', 'Refresh forecast')} onClick={refresh}>
              <RefreshCw className={loading ? 'farm-weather__spin' : undefined} size={18} aria-hidden="true" />
            </button>
          </div>}
        </div>

        {(!farm || !selectedDay) && (
          <div className="farm-weather__empty" role="status">
            <CloudOff size={24} aria-hidden="true" />
            <div>
              <strong>{farmError ? t('খামারের তালিকা পাওয়া যায়নি', 'Could not load farms')
                : farmList === null || (farm && !failed) ? t('আবহাওয়ার তথ্য খোঁজা হচ্ছে…', 'Loading weather…')
                : farm ? t('পূর্বাভাস এখন পাওয়া যাচ্ছে না', 'Forecast is temporarily unavailable')
                : t('খামার যোগ করে স্থানীয় পূর্বাভাস দেখুন', 'Add a farm to see its local forecast')}</strong>
              {farmList?.length === 0 && onOpenCalendar &&
                <button className="farm-weather__text-button" type="button" onClick={onOpenCalendar}>
                  {t('কৃষি ক্যালেন্ডারে যান', 'Open farm calendar')} <ArrowRight size={16} aria-hidden="true" />
                </button>}
              {farmError && <button className="farm-weather__text-button" type="button" onClick={() => setFarmRetry((count) => count + 1)}>
                {t('আবার চেষ্টা করুন', 'Try again')}
              </button>}
            </div>
          </div>
        )}

        {forecast && selectedDay && <>
          <p className="farm-weather__location"><MapPin size={16} aria-hidden="true" />
            {lang === 'bn' ? forecast.location.location_label_bn : forecast.location.location_label_en}
          </p>
          {stale && <p className="farm-weather__notice" role="status">
            {t('নতুন তথ্য পাওয়া যায়নি। সর্বশেষ পাওয়া পূর্বাভাস দেখানো হচ্ছে।', 'New data is unavailable. Showing the last available forecast.')}
          </p>}
          <div className="farm-weather__weather-grid">
            <div className="farm-weather__today">
              <div>
                <p>{t('আজকের আবহাওয়া', 'Today’s weather')}</p>
                <strong>
                  {hasCurrentTemp && current?.temp_current != null ? `${number.format(current.temp_current)}°C`
                    : current ? `${number.format(current.temp_min)}°–${number.format(current.temp_max)}°C` : '—'}
                </strong>
                {current && <span>{lang === 'bn' ? current.condition_bn : current.condition_en}
                  {!hasCurrentTemp && t(' · পূর্বাভাস', ' · forecast')}</span>}
                {!current && <span>{t('আজকের তথ্য পাওয়া যায়নি', 'No data for today')}</span>}
              </div>
              <WeatherIcon name={current?.icon} className="farm-weather__sky-icon" />
            </div>
            <div className="farm-weather__details">
              <div className="farm-weather__days" role="group" aria-label={t('পূর্বাভাসের দিন বাছুন', 'Choose forecast day')}>
                {days.map((day) => (
                  <button key={day.date} type="button" aria-pressed={selectedDay.date === day.date}
                    onClick={() => setPickedDate(day.date)}>
                    <span>{day.date === today ? t('আজ', 'Today') : lang === 'bn' ? day.day_name_bn : day.day_name_en}</span>
                    <WeatherIcon name={day.icon} />
                    <strong>{number.format(day.temp_max)}°</strong>
                    <small>{number.format(day.temp_min)}°</small>
                  </button>
                ))}
              </div>
              <div className="farm-weather__day-label" aria-live="polite">
                <CalendarDays size={15} aria-hidden="true" />
                <strong>{date.format(new Date(`${selectedDay.date}T12:00:00+06:00`))}</strong>
                <span>{lang === 'bn' ? selectedDay.condition_bn : selectedDay.condition_en}</span>
              </div>
              <dl className="farm-weather__stats">
                {stats.map(({ Icon, label, value }) => (
                  <div key={label}><Icon size={19} aria-hidden="true" /><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </div>
          </div>
          <footer className="farm-weather__source">
            <a href={forecast?.provider_url ?? "https://open-meteo.com/"} target="_blank" rel="noreferrer">{forecast?.provider ?? "Open-Meteo"} <ArrowUpRight size={13} aria-hidden="true" /></a>
            {updated && Number.isFinite(updated.getTime()) && <span>
              {cached ? t('সংরক্ষিত তথ্য', 'Cached forecast') : t('তথ্য আনা হয়েছে', 'Data fetched')} · {stamp.format(updated)}
            </span>}
          </footer>
        </>}
      </section>

      <section id="farm-weather-flood" className="farm-weather__panel farm-weather__flood" aria-labelledby="farm-flood-title">
        <div className="farm-weather__section-head">
          <div className="farm-weather__section-title">
            <span className="farm-weather__icon farm-weather__icon--green"><Waves size={22} aria-hidden="true" /></span>
            <div>
              <h2 id="farm-flood-title">{t('জমির বন্যাপ্রবণতা', 'Land flood susceptibility')}</h2>
              <p>{t('জমির ভৌগোলিক তথ্য দিয়ে প্রবণতা যাচাই করুন।', 'Assess susceptibility from the terrain characteristics.')}</p>
            </div>
          </div>
        </div>
        <FloodSusceptibilityTool key={farm?.id ?? 'none'} onViewHistory={onViewHistory} />
      </section>
    </div>
  );
}
