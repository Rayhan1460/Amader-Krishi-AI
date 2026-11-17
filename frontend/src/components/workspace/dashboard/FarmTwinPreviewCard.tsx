import { useState, useMemo } from 'react';
import { Activity, Layers, Sprout, ArrowRight, Info } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { FarmCropSummaryItem, FarmProfileDetail } from '../../../types/index.ts';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface FarmTwinPreviewCardProps {
  farm?: FarmProfileDetail | null;
  crops?: FarmCropSummaryItem[];
  onNavigateToTab: (tab: WorkspaceTab) => void;
  isLoading?: boolean;
}

export function FarmTwinPreviewCard({
  farm,
  crops = [],
  onNavigateToTab,
  isLoading = false,
}: FarmTwinPreviewCardProps) {
  const { lang, t } = useLanguage();
  const [selectedPlotIndex, setSelectedPlotIndex] = useState(0);

  // Active plots from real farm crops
  const activePlots = useMemo(() => {
    if (crops.length > 0) {
      return crops.map((c, idx) => ({
        id: c.id,
        label: lang === 'bn' ? `প্লট ${String.fromCharCode(65 + idx)}` : `Plot ${String.fromCharCode(65 + idx)}`,
        cropName: lang === 'bn' ? c.crop_name_bn || c.crop_name : c.crop_name,
        variety: c.variety,
        stage: c.season ? (lang === 'bn' ? `${c.season_bn || c.season} মৌসুম` : `${c.season} season`) : (lang === 'bn' ? 'বর্ধনশীল পর্যায়' : 'Vegetative Stage'),
        area: farm?.area ? `${Math.round(farm.area / Math.max(1, crops.length))} ${farm.area_unit || (lang === 'bn' ? 'শতাংশ' : 'decimal')}` : null,
        status: c.status,
      }));
    }
    return [];
  }, [crops, farm, lang]);

  const currentPlot = activePlots[selectedPlotIndex] || activePlots[0] || null;

  return (
    <div className="bg-[#082b1f] border border-[#1b4332] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-[#1b4332]/80">
      <div>
        {/* Header matching 02_dashboard_reference.png */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-[#e9ad46]" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {lang === 'bn' ? 'ফার্ম ডিজিটাল টুইন' : 'Farm Digital Twin'}
            </h2>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#153f2e] text-[#a7b9ae] border border-[#1b4332]">
              {lang === 'bn' ? 'স্কেমেটিক নকশা' : 'Schematic'}
            </span>
          </div>

          <button
            onClick={() => onNavigateToTab('farm_twin')}
            className="text-xs font-medium text-[#a7b9ae] hover:text-[#e9ad46] transition-colors flex items-center gap-1"
          >
            <span>{t('টুইন ওভারভিউ', 'Twin 360°')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="h-44 bg-[#062519] rounded-xl animate-pulse" />
        ) : activePlots.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#062519] flex items-center justify-center text-[#a7b9ae] mb-2.5">
              <Layers className="w-5 h-5 text-[#e9ad46]" />
            </div>
            <p className="text-sm font-semibold text-white">
              {lang === 'bn' ? 'ডিজিটাল টুইনে কোনো প্লট নিবন্ধিত নেই' : 'No plots registered in Digital Twin'}
            </p>
            <p className="text-xs text-[#a7b9ae] mt-1 max-w-xs">
              {lang === 'bn'
                ? 'আপনার খামারের ফসল ও জমির পরিমাণ যোগ করে ডিজিটাল টুইন সক্রিয় করুন।'
                : 'Register crops and land plots to activate the real-time Farm Digital Twin.'}
            </p>
            <button
              onClick={() => onNavigateToTab('farm_twin')}
              className="mt-3 px-3 py-1.5 rounded-lg bg-[#153f2e] hover:bg-[#1e5841] text-xs font-semibold text-[#e9ad46] border border-[#e9ad46]/30 transition-all cursor-pointer"
            >
              {lang === 'bn' ? 'ডিজিটাল টুইন খুলুন' : 'Open Digital Twin'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Left side: Interactive schematic plot boxes */}
            <div className="md:col-span-7 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {activePlots.slice(0, 4).map((plot, idx) => {
                  const isSelected = selectedPlotIndex === idx;
                  return (
                    <button
                      key={plot.id}
                      onClick={() => setSelectedPlotIndex(idx)}
                      className={`text-left p-3.5 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0d2e20] border-2 border-[#e9ad46] shadow-md ring-2 ring-[#e9ad46]/20'
                          : 'bg-[#062519] border border-[#1b4332] hover:border-[#1b4332]/80 hover:bg-[#093021]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold ${isSelected ? 'text-[#e9ad46]' : 'text-white'}`}>
                          {plot.label}
                        </span>
                        <Sprout className={`w-3.5 h-3.5 ${isSelected ? 'text-[#e9ad46]' : 'text-emerald-400'}`} />
                      </div>
                      <p className="text-xs font-medium text-white truncate">
                        {plot.cropName}
                      </p>
                      {plot.area && (
                        <p className="text-[11px] text-[#a7b9ae] mt-0.5">
                          {plot.area}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Soil Zone indicator box matching reference */}
              <div
                onClick={() => onNavigateToTab('soil_health')}
                className="p-2.5 rounded-xl bg-[#062519]/70 border border-[#1b4332] hover:border-[#e9ad46]/40 transition-colors flex items-center justify-between cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 text-[#a7b9ae]">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'bn' ? 'মাটি পরীক্ষার জোন' : 'Soil Testing Zone'}</span>
                </div>
                <span className="text-[11px] font-semibold text-[#e9ad46]">
                  {farm?.soil_type || (lang === 'bn' ? 'দোআঁশ মাটি' : 'Loamy soil')}
                </span>
              </div>
            </div>

            {/* Right side: Selected plot verified details */}
            {currentPlot && (
              <div className="md:col-span-5 p-3.5 rounded-xl bg-[#062519] border border-[#1b4332] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">
                      {currentPlot.label} ({currentPlot.cropName})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                      {currentPlot.status === 'active' ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : currentPlot.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#a7b9ae]">
                    {currentPlot.area ? `${currentPlot.area} · ` : ''}
                    <span className="text-cream-100 font-medium">{currentPlot.stage}</span>
                  </p>

                  {currentPlot.variety && (
                    <p className="text-[11px] text-[#a7b9ae] mt-1">
                      {lang === 'bn' ? 'জাত:' : 'Variety:'} <span className="text-white">{currentPlot.variety}</span>
                    </p>
                  )}

                  {/* Stage Progress based on verified stages */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-[#a7b9ae]">
                      <span>{lang === 'bn' ? 'পর্যায় অগ্রগতি' : 'Stage progress'}</span>
                      <span className="text-white font-medium">{currentPlot.stage}</span>
                    </div>
                    <div className="w-full bg-[#082b1f] h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-[#e9ad46] h-full rounded-full w-3/4" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#1b4332]/60 text-[10px] text-[#a7b9ae] flex items-center gap-1">
                  <Info className="w-3 h-3 text-[#e9ad46] shrink-0" />
                  <span>{lang === 'bn' ? 'স্কেমেটিক প্লট নকশা (ক্যাডাস্ট্রাল জরিপ নয়)' : 'Schematic representation'}</span>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="mt-4 pt-3 border-t border-[#1b4332]/60 flex items-center justify-between text-xs text-[#a7b9ae]">
        <span>
          {lang === 'bn'
            ? 'পূর্ণাঙ্গ ৩৬০° ডিজিটাল টুইন ও ফসল পর্যালোচনা'
            : 'Explore full 360° twin and harvest tracking'}
        </span>
        <button
          onClick={() => onNavigateToTab('farm_twin')}
          className="text-[#e9ad46] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{lang === 'bn' ? 'ডিজিটাল টুইন দেখুন' : 'View Full Twin'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
