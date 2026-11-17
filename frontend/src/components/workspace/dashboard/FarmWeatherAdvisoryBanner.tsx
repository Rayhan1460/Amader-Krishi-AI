import { useMemo } from 'react';
import {
  AlertTriangle,
  Calendar,
  CloudRain,
  Eye,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { FarmActionItem } from '../../../types/index.ts';
import type { FarmWeatherOverview } from '../../../types/index.ts';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface FarmWeatherAdvisoryBannerProps {
  actions: FarmActionItem[];
  weatherSummary?: FarmWeatherOverview | null;
  onNavigateToTab: (tab: WorkspaceTab, modelId?: string) => void;
  isLoading?: boolean;
}

export function FarmWeatherAdvisoryBanner({
  actions = [],
  weatherSummary,
  onNavigateToTab,
  isLoading = false,
}: FarmWeatherAdvisoryBannerProps) {
  const { lang, t } = useLanguage();

  // Find the highest priority action item from real backend rules
  const activeNotice = useMemo(() => {
    if (actions.length > 0) {
      // Sort: high > medium > low
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const sorted = [...actions].sort(
        (a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
      );
      return sorted[0];
    }
    return null;
  }, [actions]);

  // Weather fallback if no calendar/observation action but weather has high precipitation
  const weatherNotice = useMemo(() => {
    if (activeNotice) return null;
    if (
      weatherSummary &&
      weatherSummary.status === 'ok' &&
      ((weatherSummary.precipitation_prob ?? 0) >= 50 || (weatherSummary.precipitation_mm ?? 0) >= 10)
    ) {
      return {
        title:
          lang === 'bn'
            ? `বৃষ্টিপাতের পূর্বাভাস: ${weatherSummary.precipitation_mm} মিমি (${weatherSummary.precipitation_prob}% সম্ভাবনা)। সেচ সমন্বয় করুন।`
            : `Rain forecast: ${weatherSummary.precipitation_mm}mm (${weatherSummary.precipitation_prob}% prob). Adjust irrigation.`,
        source: lang === 'bn' ? 'আবহাওয়া পূর্বাভাস' : 'Weather Forecast',
        destinationTab: 'tools' as WorkspaceTab,
        modelId: 'flood_susceptibility',
      };
    }
    return null;
  }, [activeNotice, weatherSummary, lang]);

  if (isLoading) {
    return (
      <div className="w-full bg-[#072418]/60 border border-[#1b4332] rounded-xl p-3 mb-6 animate-pulse">
        <div className="h-4 bg-[#153f2e] rounded-sm w-3/4" />
      </div>
    );
  }

  // If no action or weather notice, display a calm status banner
  if (!activeNotice && !weatherNotice) {
    return (
      <div className="w-full bg-[#072418]/80 border border-[#1b4332] rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#a7b9ae]">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {lang === 'bn'
              ? 'খামারের সকল কার্যক্রম স্বাভাবিক রয়েছে। নতুন কোনো জরুরি সতর্কতা নেই।'
              : 'All farm activities are currently on track. No urgent advisories pending.'}
          </span>
        </div>
        <button
          onClick={() => onNavigateToTab('calendar')}
          className="text-xs font-semibold text-[#e9ad46] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>{lang === 'bn' ? 'ক্যালেন্ডার' : 'Calendar'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Render active actionable review notice
  const icon =
    activeNotice?.rule_id.includes('weather') || weatherNotice
      ? CloudRain
      : activeNotice?.rule_id.includes('task')
      ? Calendar
      : activeNotice?.rule_id.includes('observation')
      ? Eye
      : AlertTriangle;

  const IconComponent = icon;
  const title =
    activeNotice
      ? lang === 'bn'
        ? activeNotice.title_bn
        : activeNotice.title_en
      : weatherNotice?.title;

  const explanation =
    activeNotice
      ? lang === 'bn'
        ? activeNotice.explanation_bn
        : activeNotice.explanation_en
      : null;

  const destinationTab = (activeNotice?.destination_tab || weatherNotice?.destinationTab || 'calendar') as WorkspaceTab;
  const modelId = weatherNotice?.modelId;

  return (
    <div className="w-full bg-[#072418] border border-[#e9ad46]/35 rounded-xl px-4 py-3 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:border-[#e9ad46]/60 transition-colors">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-1.5 rounded-lg bg-[#e9ad46]/10 text-[#e9ad46] shrink-0 mt-0.5 sm:mt-0">
          <IconComponent className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-white">
              {title}
            </span>
            {activeNotice?.source_module && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#153f2e] text-[#a7b9ae] border border-[#1b4332]">
                {activeNotice.source_module}
              </span>
            )}
          </div>
          {explanation && (
            <p className="text-xs text-[#a7b9ae] mt-0.5 leading-relaxed">
              {explanation}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => onNavigateToTab(destinationTab, modelId)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#153f2e] hover:bg-[#1c553e] text-xs font-semibold text-[#e9ad46] border border-[#e9ad46]/30 transition-all shrink-0 self-end sm:self-center cursor-pointer"
      >
        <span>{t('পর্যালোচনা করুন', 'Review')}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
