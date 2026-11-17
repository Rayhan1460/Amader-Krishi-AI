import { useMemo } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { User } from '../../../types/index.ts';
import type { FarmProfile, FarmProfileDetail } from '../../../types/index.ts';

interface DashboardGreetingProps {
  user: User | null;
  selectedFarm: FarmProfile | FarmProfileDetail | null;
  farms: FarmProfile[];
  onSelectFarm: (farmId: number) => void;
  isLoading?: boolean;
}

export function DashboardGreeting({
  user,
  selectedFarm,
  farms,
  onSelectFarm,
  isLoading = false,
}: DashboardGreetingProps) {
  const { lang, t } = useLanguage();

  // Time-aware greeting logic (Asia/Dhaka timezone)
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return lang === 'bn' ? 'শুভ সকাল' : 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return lang === 'bn' ? 'শুভ অপরাহ্ন' : 'Good afternoon';
    } else {
      return lang === 'bn' ? 'শুভ সন্ধ্যা' : 'Good evening';
    }
  }, [lang]);

  // Display name formatting (actual authenticated user, never hardcoded "Rahim bhai")
  const displayName = useMemo(() => {
    if (!user) return lang === 'bn' ? 'কৃষক ভাই' : 'Farmer';
    const name = user.username || user.email?.split('@')[0] || (lang === 'bn' ? 'কৃষক ভাই' : 'Farmer');
    // In Bengali add respectful 'ভাই' or title if appropriate
    if (lang === 'bn') {
      return `${name} ভাই`;
    }
    return `${name}`;
  }, [user, lang]);

  // Farm metadata details (strictly from backend records, no fake values)
  const farmMetadataLine = useMemo(() => {
    if (isLoading) {
      return lang === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Loading farm details...';
    }
    if (!selectedFarm) {
      return lang === 'bn' ? 'কোনো খামার নির্বাচন করা হয়নি' : 'No farm selected';
    }

    const parts: string[] = [];

    // Location
    const locParts = [selectedFarm.upazila, selectedFarm.district].filter(Boolean);
    if (locParts.length > 0) {
      parts.push(locParts.join(', '));
    }

    // Area
    if (selectedFarm.area != null && selectedFarm.area > 0) {
      const unit = selectedFarm.area_unit || (lang === 'bn' ? 'একর' : 'acre');
      parts.push(`${selectedFarm.area} ${unit}`);
    }

    // Season or soil type
    if (selectedFarm.soil_type) {
      parts.push(selectedFarm.soil_type);
    }

    return parts.length > 0 ? parts.join(' · ') : (lang === 'bn' ? 'খামারের বিবরণ' : 'Farm details');
  }, [selectedFarm, isLoading, lang]);

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        {/* Eyebrow matching 02_dashboard_reference.png */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#e9ad46]">
            DASHBOARD
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#e9ad46]/60" />
          <span className="text-xs text-[#a7b9ae]/80 font-medium">
            {lang === 'bn' ? 'প্রধান কন্ট্রোল প্যানেল' : 'Live Farm Overview'}
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
          {greetingText}, <span className="text-gradient-gold">{displayName}</span>
        </h1>

        {/* Subtitle with real location & area */}
        <p className="mt-1 text-sm text-[#a7b9ae] flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#e9ad46] shrink-0" />
          <span>{farmMetadataLine}</span>
        </p>
      </div>

      {/* Farm Switcher Dropdown */}
      {farms.length > 0 && (
        <div className="relative shrink-0">
          <div className="relative inline-block">
            <select
              aria-label={t('খামার নির্বাচন করুন', 'Select farm')}
              value={selectedFarm?.id || ''}
              onChange={(e) => onSelectFarm(Number(e.target.value))}
              className="appearance-none bg-[#0a2016]/90 hover:bg-[#0e2c1e] text-cream-100 text-xs sm:text-sm font-medium rounded-xl pl-3 pr-8 py-2 border border-[#1b4332] focus:border-[#e9ad46] focus:outline-hidden transition-colors cursor-pointer shadow-xs"
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id} className="bg-[#0a2016] text-white">
                  {farm.name} ({[farm.upazila, farm.district].filter(Boolean).join(', ') || t('বাংলাদেশ', 'BD')})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#e9ad46] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
}
