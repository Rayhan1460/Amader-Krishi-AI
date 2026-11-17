import type { FC } from 'react';
import {
  CloudSun,
  CloudRain,
  Sun,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  RotateCw,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Info,
  MapPin,
  Calendar,
} from 'lucide-react';
import type {
  FarmProfile,
  FarmWeatherForecastResponse,
  DailyForecastItem,
} from '../../types/index.ts';


interface WeatherDashboardPanelProps {
  farms: FarmProfile[];
  selectedFarmId: number | null;
  onSelectFarm: (farmId: number) => void;
  forecastData: FarmWeatherForecastResponse | null;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onNavigateToModel?: (modelId: string) => void;
}

export const WeatherDashboardPanel: FC<WeatherDashboardPanelProps> = ({
  farms,
  selectedFarmId,
  onSelectFarm,
  onNavigateToModel,
  forecastData,
  loading: isLoading,
  error,
  onRefresh,
}) => {
  const activeFarm = farms.find((farm) => farm.id === selectedFarmId) ?? null;
  const lastRefreshed = forecastData?.generated_at
    ? new Date(forecastData.generated_at).toLocaleTimeString('bn-BD', {timeZone:'Asia/Dhaka', hour:'2-digit', minute:'2-digit'})
    : '';

  const getWeatherIcon = (iconName: string, className: string = 'w-6 h-6') => {
    switch (iconName) {
      case 'sun':
        return <Sun className={`${className} text-amber-400`} />;
      case 'cloud-sun':
        return <CloudSun className={`${className} text-emerald-400`} />;
      case 'cloud-rain':
      case 'cloud-drizzle':
      case 'cloud-rain-heavy':
        return <CloudRain className={`${className} text-blue-400`} />;
      case 'cloud-lightning':
      case 'cloud-hail':
        return <CloudLightning className={`${className} text-purple-400`} />;
      default:
        return <CloudSun className={`${className} text-slate-400`} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Farm Selector & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-emerald-800/40 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <CloudSun className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
              কৃষি আবহাওয়া ও পূর্বাভাস কেন্দ্র
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                লাইভ ইন্টেলিজেন্স
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              ৭ দিনের আবহাওয়ার পূর্বাভাস ও কৃষিকাজের পরামর্শ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {farms.length > 0 && (
            <div className="relative">
              <select
                aria-label="খামার নির্বাচন করুন"
                value={activeFarm?.id || ''}
                onChange={(e) => onSelectFarm(Number(e.target.value))}
                className="bg-slate-800/90 text-cream-100 text-sm border border-emerald-700/50 rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:border-amber-400"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    🏡 {f.name} ({f.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading || !activeFarm}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700/50 hover:bg-emerald-600/60 text-cream-100 text-sm font-medium rounded-xl border border-emerald-500/40 transition-all shadow-md active:scale-95 disabled:opacity-50"
            title="পূর্বাভাস রিফ্রেশ করুন"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Location Transparency Banner */}
      {forecastData?.location && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              পূর্বাভাস রেফারেন্স অবস্থান:{' '}
              <strong className="text-slate-200">{forecastData.location.location_label_bn}</strong>
            </span>
          </div>
          {lastRefreshed && (
            <div className="text-slate-500 flex items-center gap-1.5 self-end sm:self-auto">
              <span>সর্বশেষ আপডেট: {lastRefreshed}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !forecastData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          <div className="h-64 bg-slate-800/50 rounded-2xl border border-slate-700/50" />
          <div className="md:col-span-2 h-64 bg-slate-800/50 rounded-2xl border border-slate-700/50" />
        </div>
      )}

      {/* Error / Unavailable Fallback State */}
      {error && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-lg font-semibold text-cream-100">আবহাওয়ার তথ্য এখন পাওয়া যাচ্ছে না</h3>
          <p className="text-sm text-slate-300 max-w-lg mx-auto">{error}</p>
          <div className="text-xs text-slate-400 pt-2">
            আপনার খামার, ফসল এবং কৃষি ক্যালেন্ডারের কাজগুলো কোনো বাধা ছাড়াই স্বাভাবিকভাবে কাজ করছে।
          </div>
        </div>
      )}

      {/* Main Weather Content */}
      {forecastData && forecastData.status !== 'unavailable' && forecastData.forecast.length > 0 && (
        <div className="space-y-6">
          {/* Top Row: Current Weather & Mini Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Weather Card */}
            <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-slate-900 border border-emerald-700/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    আজকের আবহাওয়া
                  </span>
                  <h3 className="text-2xl font-bold text-cream-50 mt-1">
                    {forecastData.current.condition_bn}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {forecastData.location.district} জেলা
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/50 shadow-md">
                  {getWeatherIcon(forecastData.current.icon, 'w-10 h-10')}
                </div>
              </div>

              {/* Temperature Display */}
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-5xl font-black text-amber-300 tracking-tight">
                  {forecastData.current.temp_max}°C
                </span>
                <span className="text-sm text-slate-400">
                  সর্বনিম্ন: <strong className="text-slate-300">{forecastData.current.temp_min}°C</strong>
                </span>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-800/80">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
                  <CloudRain className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-[11px] text-slate-400">বৃষ্টিপাত</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {forecastData.current.precipitation_mm} মিমি ({forecastData.current.precipitation_prob}%)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
                  <Droplets className="w-5 h-5 text-sky-400" />
                  <div>
                    <div className="text-[11px] text-slate-400">আর্দ্রতা</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {forecastData.current.humidity}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
                  <Wind className="w-5 h-5 text-teal-400" />
                  <div>
                    <div className="text-[11px] text-slate-400">বাতাস</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {forecastData.current.wind_kmh} কিমি/ঘ
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
                  <Thermometer className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-[11px] text-slate-400">তাপমাত্রা পরিসীমা</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {forecastData.current.temp_min} - {forecastData.current.temp_max}°C
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Forecast Grid */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-cream-100 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    ৭-দিনের আবহাওয়া পূর্বাভাস পরিক্রমা
                  </h3>
                  <span className="text-xs text-slate-400">দৈনিক বিশ্লেষণ</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {forecastData.forecast.map((day: DailyForecastItem) => {
                    const isToday = day.date === new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Dhaka'}).format(new Date());
                    return (
                      <div
                        key={day.date}
                        className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all ${
                          isToday
                            ? 'bg-emerald-950/40 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/30'
                            : 'bg-slate-800/50 border-slate-700/40 hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-300">
                          {isToday ? 'আজ' : day.day_name_bn}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {day.date.slice(5)}
                        </span>

                        <div className="my-2.5">
                          {getWeatherIcon(day.icon, 'w-7 h-7')}
                        </div>

                        <span className="text-xs font-semibold text-cream-50">
                          {day.temp_max}°
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {day.temp_min}°
                        </span>

                        {day.precipitation_sum_mm > 0 ? (
                          <div className="mt-2 text-[10px] text-blue-300 flex items-center gap-0.5 font-medium">
                            <Droplets className="w-3 h-3 text-blue-400 shrink-0" />
                            <span>{day.precipitation_sum_mm} মিমি</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-slate-500 font-medium">
                            বৃষ্টি নেই
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Forecast Temperature & Rain Visual Bars */}
              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>বৃষ্টিপাতের সম্ভাবনা (সর্বোচ্চ)</span>
                    <span className="text-blue-400">
                      {Math.max(...forecastData.forecast.map((f) => f.precipitation_probability_max))}%
                    </span>
                  </div>
                  <div className="flex items-end gap-1.5 h-10 pt-2">
                    {forecastData.forecast.map((f) => (
                      <div
                        key={f.date}
                        className="flex-1 bg-slate-700 rounded-t overflow-hidden flex flex-col justify-end"
                        title={`${f.date}: ${f.precipitation_probability_max}%`}
                      >
                        <div
                          className="bg-blue-500 rounded-t transition-all"
                          style={{ height: `${f.precipitation_probability_max}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>সর্বোচ্চ তাপমাত্রা সীমা</span>
                    <span className="text-amber-400">
                      {Math.max(...forecastData.forecast.map((f) => f.temp_max))}°C
                    </span>
                  </div>
                  <div className="flex items-end gap-1.5 h-10 pt-2">
                    {forecastData.forecast.map((f) => {
                      const maxT = Math.max(...forecastData.forecast.map((d) => d.temp_max));
                      const heightPct = Math.round((f.temp_max / (maxT || 40)) * 100);
                      return (
                        <div
                          key={f.date}
                          className="flex-1 bg-slate-700 rounded-t overflow-hidden flex flex-col justify-end"
                          title={`${f.date}: ${f.temp_max}°C`}
                        >
                          <div
                            className="bg-amber-500 rounded-t transition-all"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Government Severe Weather References (BMD & BAMIS) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-cream-100">
              জাতীয় দুর্যোগ ও আবহাওয়া রেফারেন্স (সরকারি দাপ্তরিক উৎস)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              আমাদের কৃষি AI প্ল্যাটফর্মের আবহাওয়া পূর্বাভাস একটি পরিসংখ্যানগত প্রযুক্তি নির্ভর সেবা। 
              ঘূর্ণিঝড়, জলোচ্ছ্বাস, প্লাবন বা জরুরি জাতীয় দুর্যোগ সতর্কবার্তার জন্য বাংলাদেশ সরকারের দাপ্তরিক বুলেটিন অনুসরণ করুন।
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <a
            href="https://bmd.gov.bd/web/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 text-slate-200 hover:text-emerald-400 transition-all text-xs group"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>বাংলাদেশ আবহাওয়া অধিদপ্তর (BMD)</span>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
          </a>

          <a
            href="https://www.bamis.gov.bd/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 text-slate-200 hover:text-emerald-400 transition-all text-xs group"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>কৃষি আবহাওয়া তথ্য পদ্ধতি (BAMIS - DAE)</span>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
          </a>

          <a
            href="http://ffwc.gov.bd/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 text-slate-200 hover:text-emerald-400 transition-all text-xs group"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র (FFWC)</span>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
          </a>
        </div>
      </div>

      {/* Static Flood Susceptibility Model Disclosure & Navigation */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-900/40 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-cream-100">
              এআই বন্যা ঝুঁকি মডেল (ভৌগোলিক সংবেদনশীলতা)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              প্ল্যাটফর্মে সংরক্ষিত মেশিন লার্নিং মডেলটি মাটির ধরন ও ভূমিরূপের ঐতিহাসিক সংবেদনশীলতা নিরূপণ করে। এটি রিয়েল-টাইম আকস্মিক বন্যা পূর্বাভাস নয়।
            </p>
          </div>
        </div>

        {onNavigateToModel && (
          <button
            onClick={() => onNavigateToModel('flood_risk')}
            className="shrink-0 px-4 py-2 bg-blue-700/50 hover:bg-blue-600/60 text-blue-100 text-xs font-semibold rounded-xl border border-blue-500/40 transition-all shadow-md active:scale-95"
          >
            বন্যা মডেল কনসোলে যান →
          </button>
        )}
      </div>

      {/* Source & Attribution Footnote */}
      <div className="text-center text-xs text-slate-400 py-2">
        আবহাওয়া পূর্বাভাস সরবরাহকারী: 
        <a
          href={forecastData?.provider_url ?? "https://open-meteo.com/"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:underline mx-1"
        >
          {forecastData?.provider ?? "Open-Meteo API (CC BY 4.0)"}
        </a>
        বাংলাদেশের কৃষকদের সহায়তায় ডেটা প্রক্রিয়াজাতকৃত।
      </div>
    </div>
  );
};
