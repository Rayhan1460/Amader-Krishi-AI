import { useMemo } from 'react';
import { Eye, Sprout, ArrowRight, FileText } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { FarmObservationIntelligenceSummary } from '../../../types/index.ts';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface CropObservationSummaryCardProps {
  totalCrops?: number;
  activeCropsCount?: number;
  observationsSummary?: FarmObservationIntelligenceSummary | null;
  onNavigateToTab: (tab: WorkspaceTab) => void;
  isLoading?: boolean;
}

export function CropObservationSummaryCard({
  totalCrops = 0,
  activeCropsCount = 0,
  observationsSummary,
  onNavigateToTab,
  isLoading = false,
}: CropObservationSummaryCardProps) {
  const { lang, t } = useLanguage();

  const latestObs = observationsSummary?.recent_observations?.[0] || null;
  const totalObs = observationsSummary?.total_observations_count ?? 0;

  // Cultivation progress metrics strictly based on verified records
  const cropsLabel = useMemo(() => {
    if (activeCropsCount === 0 && totalCrops === 0) {
      return lang === 'bn' ? 'কোনো ফসল নেই' : 'No crops';
    }
    const count = activeCropsCount > 0 ? activeCropsCount : totalCrops;
    return lang === 'bn' ? `${count}টি ফসল সক্রিয়` : `${count} Active Crops`;
  }, [activeCropsCount, totalCrops, lang]);

  return (
    <div className="bg-[#082b1f] border border-[#1b4332] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-[#1b4332]/80">
      <div>
        {/* Header matching 02_dashboard_reference.png */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#e9ad46]" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {lang === 'bn' ? 'ফসল পর্যবেক্ষণ' : 'Crop Monitoring'}
            </h2>
          </div>
          <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#153f2e] text-[#e9ad46] border border-[#e9ad46]/20">
            {totalObs > 0 ? (lang === 'bn' ? `${totalObs}টি রেকর্ড` : `${totalObs} logs`) : (lang === 'bn' ? 'পর্যবেক্ষণ' : 'Verified')}
          </span>
        </div>

        {/* Big Display Metric (Real active crop count) */}
        {isLoading ? (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-10 bg-[#062519] rounded-xl w-1/3" />
            <div className="h-4 bg-[#062519] rounded-sm w-1/2" />
          </div>
        ) : (
          <div className="py-2">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                {activeCropsCount || totalCrops || 0}
              </span>
              <div className="text-xs text-[#a7b9ae] font-medium leading-tight">
                <p className="text-emerald-400 font-semibold">{cropsLabel}</p>
                <p className="text-[11px] text-[#a7b9ae]/80">
                  {lang === 'bn' ? 'নিবন্ধিত চাষাবাদ' : 'Monitored plots'}
                </p>
              </div>
            </div>

            {/* Latest Farmer-Recorded Field Observation */}
            <div className="mt-4 pt-4 border-t border-[#1b4332]/60">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-[#a7b9ae] mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#e9ad46]" />
                <span>{lang === 'bn' ? 'সর্বশেষ মাঠ পর্যবেক্ষণ' : 'Latest Field Observation'}</span>
              </p>

              {latestObs ? (
                <div className="p-3 rounded-xl bg-[#062519]/90 border border-[#1b4332]/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-white flex items-center gap-1">
                      <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{latestObs.crop_name || t('ফসল', 'Crop')}</span>
                    </span>
                    <span className="text-[11px] text-[#a7b9ae] font-mono">
                      {latestObs.observation_date}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#a7b9ae]">
                      {lang === 'bn' ? 'অবস্থা:' : 'Condition:'}
                    </span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${latestObs.farmer_reported_condition?.toLowerCase().includes('healthy') ||
                        latestObs.farmer_reported_condition?.includes('স্বাভাবিক')
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}
                    >
                      {latestObs.farmer_reported_condition || (lang === 'bn' ? 'স্বাভাবিক' : 'Normal')}
                    </span>
                  </div>

                  {latestObs.visible_symptoms && (
                    <p className="text-[11px] text-[#a7b9ae] line-clamp-2 italic">
                      "{latestObs.visible_symptoms}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#062519]/60 border border-[#1b4332]/60 text-center text-xs text-[#a7b9ae]">
                  <span>{lang === 'bn' ? 'এখনো কোনো পর্যবেক্ষণ লিপিবদ্ধ নেই।' : 'No crop observations recorded yet.'}</span>
                </div>
              )}
            </div>

            {/* Verified Progress Bars strictly tied to real plots */}
            <div className="mt-4 space-y-2.5">
              <div>
                <div className="flex justify-between text-xs text-[#a7b9ae] mb-1">
                  <span>{lang === 'bn' ? 'মাঠ নিরীক্ষণ কাভারেজ' : 'Monitoring coverage'}</span>
                  <span className="font-semibold text-white">
                    {totalCrops > 0 ? `${Math.round((Math.min(totalObs, totalCrops) / totalCrops) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="w-full bg-[#062519] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-[#e9ad46] h-full rounded-full transition-all duration-500"
                    style={{
                      width: totalCrops > 0 ? `${Math.min(100, Math.round((Math.min(totalObs, totalCrops) / totalCrops) * 100))}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="mt-4 pt-3 border-t border-[#1b4332]/60 flex items-center justify-between text-xs text-[#a7b9ae]">
        <span>{lang === 'bn' ? 'বিস্তারিত পর্যবেক্ষণ লগ' : 'Full observation history'}</span>
        <button
          onClick={() => onNavigateToTab('crop_monitoring')}
          className="text-[#e9ad46] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{lang === 'bn' ? 'পর্যবেক্ষণ খুলুন' : 'Open Monitoring'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
