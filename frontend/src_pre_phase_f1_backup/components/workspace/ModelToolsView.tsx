import { useState } from 'react';
import { Eye, Layers, Waves, TrendingUp } from 'lucide-react';
import { TomatoDiseaseTool } from './tools/TomatoDiseaseTool.tsx';
import { RiceDiseaseTool } from './tools/RiceDiseaseTool.tsx';
import { CropRecommendationTool } from './tools/CropRecommendationTool.tsx';
import { RegionalYieldTool } from './tools/RegionalYieldTool.tsx';
import { FloodSusceptibilityTool } from './tools/FloodSusceptibilityTool.tsx';
import { MarketPriceTool } from './tools/MarketPriceTool.tsx';

interface ModelToolsViewProps {
  initialModelId?: string;
  onViewHistory?: (recordId: number) => void;
}

export function ModelToolsView({
  initialModelId = 'tomato_disease_v3',
  onViewHistory,
}: ModelToolsViewProps) {
  const [activeModel, setActiveModel] = useState<string>(initialModelId);

  const tools = [
    {
      id: 'tomato_disease_v3',
      name: 'Tomato Disease',
      tag: 'Vision CNN',
      icon: Eye,
    },
    {
      id: 'rice_disease',
      name: 'Rice Condition',
      tag: 'Vision CNN',
      icon: Eye,
    },
    {
      id: 'crop_recommendation',
      name: 'Crop Recommend',
      tag: 'Soil NPK',
      icon: Layers,
    },
    {
      id: 'regional_crop_yield',
      name: 'Crop Yield',
      tag: 'Regression',
      icon: Layers,
    },
    {
      id: 'flood_susceptibility',
      name: 'Flood Risk',
      tag: 'Topography',
      icon: Waves,
    },
    {
      id: 'tomato_price',
      name: 'Tomato Price',
      tag: 'Wholesale BDT',
      icon: TrendingUp,
    },
    {
      id: 'boro_rice_price',
      name: 'Rice Price',
      tag: 'Wholesale BDT',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Model Navigation Pills */}
      <div className="bg-white rounded-2xl p-3 border border-sage-200 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = activeModel === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveModel(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-forest-800 text-white shadow-xs shadow-forest-900/20'
                    : 'bg-sage-50 text-charcoal-700 hover:bg-sage-100 hover:text-forest-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-sage-600'}`} />
                <span>{t.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-forest-900 text-emerald-300' : 'bg-sage-200 text-sage-800'
                  }`}
                >
                  {t.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Model Tool Rendered */}
      {activeModel === 'tomato_disease_v3' && (
        <TomatoDiseaseTool onViewHistory={onViewHistory} />
      )}
      {activeModel === 'rice_disease' && (
        <RiceDiseaseTool onViewHistory={onViewHistory} />
      )}
      {activeModel === 'crop_recommendation' && (
        <CropRecommendationTool onViewHistory={onViewHistory} />
      )}
      {activeModel === 'regional_crop_yield' && (
        <RegionalYieldTool onViewHistory={onViewHistory} />
      )}
      {activeModel === 'flood_susceptibility' && (
        <FloodSusceptibilityTool onViewHistory={onViewHistory} />
      )}
      {activeModel === 'tomato_price' && (
        <MarketPriceTool initialCommodity="tomato_price" onViewHistory={onViewHistory} />
      )}
      {activeModel === 'boro_rice_price' && (
        <MarketPriceTool initialCommodity="boro_rice_price" onViewHistory={onViewHistory} />
      )}
    </div>
  );
}
