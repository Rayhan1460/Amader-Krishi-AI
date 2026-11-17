import { FarmerMarket } from '../market/ProduceMarket.tsx';
import { useState, useEffect } from 'react';
import { Eye, Layers, Waves, TrendingUp, Sparkles, Sprout } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { TomatoDiseaseTool } from './tools/TomatoDiseaseTool.tsx';
import { RiceDiseaseTool } from './tools/RiceDiseaseTool.tsx';
import { CropRecommendationTool } from './tools/CropRecommendationTool.tsx';
import { RegionalYieldTool } from './tools/RegionalYieldTool.tsx';
import { FarmWeatherRiskView } from '../weather/FarmWeatherRiskView.tsx';
import { MarketPriceTool } from './tools/MarketPriceTool.tsx';

import type { WorkspaceTab } from './WorkspaceSidebar.tsx';

interface ModelToolsViewProps {
  initialModelId?: string;
  initialFarmId?: number | null;
  onViewHistory?: (recordId: number) => void;
  onNavigateToTab?: (tab: WorkspaceTab, arg?: string, extraId?: number) => void;
}

export function ModelToolsView({
  initialModelId = 'tomato_disease_v3',
  initialFarmId,
  onViewHistory,
  onNavigateToTab,
}: ModelToolsViewProps) {
  const { t } = useLanguage();
  const [activeModel, setActiveModel] = useState<string>(initialModelId);

  useEffect(() => {
    if (initialModelId) {
      setActiveModel(initialModelId);
    }
  }, [initialModelId]);

  const tools = [
    {
      id: 'tomato_disease_v3',
      nameBn: 'টমেটো পাতা রোগ',
      nameEn: 'Tomato Disease',
      tag: 'Vision 8-Class',
      icon: Eye,
    },
    {
      id: 'rice_disease',
      nameBn: 'ধানের পাতা রোগ',
      nameEn: 'Rice Condition',
      tag: 'Vision 7-Class',
      icon: Eye,
    },
    {
      id: 'crop_recommendation',
      nameBn: 'উপযোগী ফসল',
      nameEn: 'Crop Recommend',
      tag: 'Soil NPK (22 Crops)',
      icon: Layers,
    },
    {
      id: 'regional_crop_yield',
      nameBn: 'আঞ্চলিক ফলন',
      nameEn: 'Crop Yield',
      tag: 'Regression (t/ha)',
      icon: Sprout,
    },
    {
      id: 'flood_susceptibility',
      nameBn: 'বন্যা ঝুঁকি স্কোর',
      nameEn: 'Flood Risk',
      tag: 'Station-Held-Out',
      icon: Waves,
    },
    {
      id: 'tomato_price',
      nameBn: 'টমেটো পাইকারি দর',
      nameEn: 'Tomato Price',
      tag: 'Baseline BDT/kg',
      icon: TrendingUp,
    },
    {
      id: 'boro_rice_price',
      nameBn: 'বোরো ধান দর',
      nameEn: 'Boro Rice Price',
      tag: 'Baseline BDT/kg',
      icon: TrendingUp,
    },
  ];

  if (activeModel === 'flood_susceptibility') {
    return (
      <FarmWeatherRiskView initialFarmId={initialFarmId} onViewHistory={onViewHistory}
        onOpenCalendar={onNavigateToTab ? () => onNavigateToTab('calendar') : undefined} />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Model Navigation Pills (Dark Botanical Palette) */}
      <div className="bg-forest-950 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-forest-800 shadow-md">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bengali font-bold text-gold-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span>{t('৭টি বৈজ্ঞানিক এআই মডেল নির্বাচন করুন:', 'Select Active AI Model Console:')}</span>
          </span>
          <span className="text-[10px] font-mono text-sage-400">
            Checkpoints 7/7 Verified
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {tools.map((item) => {
            const Icon = item.icon;
            const isActive = activeModel === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'flood_susceptibility' && onNavigateToTab) onNavigateToTab('tools', item.id);
                  else setActiveModel(item.id);
                }}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-forest-800 text-gold-300 border border-gold-400/50 shadow-xs'
                    : 'bg-forest-900/80 text-sage-300 border border-forest-850 hover:bg-forest-850 hover:text-cream-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-gold-400' : 'text-sage-400'}`} />
                <span className="font-bengali">{t(item.nameBn, item.nameEn)}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-forest-950 text-gold-400 border border-gold-400/30' : 'bg-forest-950 text-sage-400'
                  }`}
                >
                  {item.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Model Tool Rendered */}
      <div className="animate-fade-in-up">
        {activeModel === 'tomato_disease_v3' && (
          <TomatoDiseaseTool onViewHistory={onViewHistory} />
        )}
        {activeModel === 'rice_disease' && (
          <RiceDiseaseTool onViewHistory={onViewHistory} />
        )}
        {activeModel === 'crop_recommendation' && (
          <CropRecommendationTool
            initialFarmId={initialFarmId}
            onViewHistory={onViewHistory}
            onNavigateToTab={onNavigateToTab}
          />
        )}
        {activeModel === 'regional_crop_yield' && (
          <RegionalYieldTool onViewHistory={onViewHistory} />
        )}
        {activeModel === 'tomato_price' && (
          <FarmerMarket><MarketPriceTool initialCommodity="tomato_price" onViewHistory={onViewHistory} /></FarmerMarket>
        )}
        {activeModel === 'boro_rice_price' && (
          <FarmerMarket><MarketPriceTool initialCommodity="boro_rice_price" onViewHistory={onViewHistory} /></FarmerMarket>
        )}
      </div>

    </div>
  );
}
