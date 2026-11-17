import React from 'react';
import { AlertTriangle, CloudRain, Wind, Thermometer, Calendar, ChevronRight } from 'lucide-react';
import type { CalendarWeatherAdvisory } from '../../types/index.ts';

interface WeatherAdvisoryBannerProps {
  advisories: CalendarWeatherAdvisory[];
  onOpenRescheduleModal: (advisory: CalendarWeatherAdvisory) => void;
}

export const WeatherAdvisoryBanner: React.FC<WeatherAdvisoryBannerProps> = ({
  advisories,
  onOpenRescheduleModal,
}) => {
  if (!advisories || advisories.length === 0) return null;

  const getVariableIcon = (variable: string) => {
    switch (variable) {
      case 'precipitation':
        return <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />;
      case 'wind':
        return <Wind className="w-5 h-5 text-teal-400 shrink-0" />;
      case 'temperature_high':
      case 'temperature_low':
      case 'fog':
        return <Thermometer className="w-5 h-5 text-amber-400 shrink-0" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-600/50 rounded-2xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-amber-400">
          <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
          <h3 className="text-sm font-bold tracking-wide uppercase">
            কৃষি ক্যালেন্ডার আবহাওয়া সতর্কতা ({advisories.length}টি পরামর্শ সক্রিয়)
          </h3>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          কার্যক্রম পর্যালোচনা প্রয়োজন
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {advisories.map((adv) => (
          <div
            key={adv.advisory_id}
            className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/90 border border-amber-700/30 hover:border-amber-500/60 transition-all shadow-md group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getVariableIcon(adv.weather_variable)}
                  <span className="text-xs font-bold text-cream-100">{adv.title_bn}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {adv.task_due_date}
                </span>
              </div>

              <div className="mt-2 text-xs text-slate-300">
                <strong className="text-amber-300">কাজের নাম: </strong>
                {adv.task_title}
              </div>

              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                {adv.reason_bn}
              </p>

              <div className="mt-2 text-[11px] text-emerald-400 bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-800/40">
                💡 {adv.action_suggestion_bn}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 italic">
                {adv.uncertainty_disclosure_bn.slice(0, 35)}...
              </span>
              <button
                onClick={() => onOpenRescheduleModal(adv)}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 text-xs font-medium rounded-lg border border-amber-500/40 transition-all active:scale-95 group-hover:bg-amber-600 group-hover:text-cream-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>তারিখ পর্যালোচনা</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

