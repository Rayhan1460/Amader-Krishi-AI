import { useState, useEffect } from 'react';
import {
  Activity,
  MapPin,
  Maximize2,
  Layers,
  Sprout,
  Calendar,
  Clock,
  AlertTriangle,
  Sun,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Plus,
  ChevronRight,
  Info,
  ExternalLink,
  ChevronDown,
  FlaskConical,
  Eye,
  PackageCheck,
} from 'lucide-react';
import { farmApi, farmTwinApi, soilApi, cultivationApi, harvestApi } from '../../services/api.ts';
import type {
  FarmProfile,
  FarmOverviewResponse,
  FarmAIShortcut,
  FarmCropSummaryItem,
  FarmTaskSummaryItem,
  FarmScheduleProgressItem,
  SoilTest,
  CultivationActivity,
  CropObservation,
  HarvestRecord,
  HarvestSummaryResponse,
} from '../../types/index.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { WorkspaceTab } from './WorkspaceSidebar.tsx';

interface FarmDigitalTwinViewProps {
  onNavigateToTab?: (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => void;
  onNavigateToModel?: (modelId: string, prefill?: Record<string, any>) => void;
  onOpenCalendar?: () => void;
}

export function FarmDigitalTwinView({
  onNavigateToTab,
  onNavigateToModel,
  onOpenCalendar,
}: FarmDigitalTwinViewProps) {
  const { t } = useLanguage();
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [overview, setOverview] = useState<FarmOverviewResponse | null>(null);
  const [latestSoilTest, setLatestSoilTest] = useState<SoilTest | null>(null);
  const [recentActivities, setRecentActivities] = useState<CultivationActivity[]>([]);
  const [recentObservations, setRecentObservations] = useState<CropObservation[]>([]);
  const [latestHarvest, setLatestHarvest] = useState<HarvestRecord | null>(null);
  const [harvestSummary, setHarvestSummary] = useState<HarvestSummaryResponse | null>(null);
  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Initial Load: Fetch User's Farms
  useEffect(() => {
    let isMounted = true;
    async function loadFarms() {
      setLoadingFarms(true);
      try {
        const farmList = await farmApi.listFarms();
        if (isMounted) {
          setFarms(farmList);
          if (farmList.length > 0) {
            setSelectedFarmId(farmList[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.response?.data?.detail || 'খামারের তালিকা লোড করতে ব্যর্থ হয়েছে।');
        }
      } finally {
        if (isMounted) setLoadingFarms(false);
      }
    }
    loadFarms();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Farm Overview, Soil, Activities, and Harvest whenever selectedFarmId changes
  useEffect(() => {
    if (!selectedFarmId) {
      setLatestSoilTest(null);
      setLatestHarvest(null);
      setHarvestSummary(null);
      return;
    }
    let isMounted = true;
    async function fetchOverview() {
      setLoadingOverview(true);
      setErrorMessage(null);
      try {
        const [data, soilTests, acts, obs, hSummary, hRecords] = await Promise.all([
          farmTwinApi.getOverview(selectedFarmId!),
          soilApi.getFarmSoilTests(selectedFarmId!).catch(() => [] as SoilTest[]),
          cultivationApi.listActivities({ farm_id: selectedFarmId!, limit: 3 }).catch(() => [] as CultivationActivity[]),
          cultivationApi.listObservations({ farm_id: selectedFarmId!, limit: 3 }).catch(() => [] as CropObservation[]),
          harvestApi.getFarmSummary(selectedFarmId!).catch(() => null as HarvestSummaryResponse | null),
          harvestApi.listFarmRecords(selectedFarmId!).catch(() => [] as HarvestRecord[]),
        ]);
        if (isMounted) {
          setOverview(data);
          setLatestSoilTest(soilTests && soilTests.length > 0 ? soilTests[0] : null);
          setRecentActivities(acts || []);
          setRecentObservations(obs || []);
          setHarvestSummary(hSummary);
          setLatestHarvest(hRecords && hRecords.length > 0 ? hRecords[0] : null);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.response?.data?.detail || 'ডিজিটাল টুইন তথ্য লোড করতে ব্যর্থ হয়েছে।');
        }
      } finally {
        if (isMounted) setLoadingOverview(false);
      }
    }
    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, [selectedFarmId]);

  const handleRefresh = async () => {
    if (!selectedFarmId) return;
    setLoadingOverview(true);
    try {
      const [data, soilTests, acts, obs, hSummary, hRecords] = await Promise.all([
        farmTwinApi.getOverview(selectedFarmId),
        soilApi.getFarmSoilTests(selectedFarmId).catch(() => [] as SoilTest[]),
        cultivationApi.listActivities({ farm_id: selectedFarmId, limit: 3 }).catch(() => [] as CultivationActivity[]),
        cultivationApi.listObservations({ farm_id: selectedFarmId, limit: 3 }).catch(() => [] as CropObservation[]),
        harvestApi.getFarmSummary(selectedFarmId).catch(() => null as HarvestSummaryResponse | null),
        harvestApi.listFarmRecords(selectedFarmId).catch(() => [] as HarvestRecord[]),
      ]);
      setOverview(data);
      setLatestSoilTest(soilTests && soilTests.length > 0 ? soilTests[0] : null);
      setRecentActivities(acts || []);
      setRecentObservations(obs || []);
      setHarvestSummary(hSummary);
      setLatestHarvest(hRecords && hRecords.length > 0 ? hRecords[0] : null);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || 'তথ্য রিফ্রেশ করতে ব্যর্থ হয়েছে।');
    } finally {
      setLoadingOverview(false);
    }
  };

  const handleShortcutClick = (shortcut: FarmAIShortcut) => {
    if (onNavigateToModel) {
      onNavigateToModel(shortcut.model_id, shortcut.prefill_data);
    } else if (onNavigateToTab) {
      onNavigateToTab('tools', shortcut.model_id);
    }
  };

  // Render Loading State
  if (loadingFarms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center text-cream-100">
        <RefreshCw className="w-8 h-8 text-gold-400 animate-spin mb-4" />
        <p className="font-bengali text-base font-semibold">{t('ডিজিটাল টুইন লোড হচ্ছে...', 'Loading Farm Digital Twin...')}</p>
        <p className="text-xs text-sage-400 mt-1">{t('খামার প্রোফাইল ও ফসলের তথ্য যাচাই করা হচ্ছে', 'Verifying farm profiles and crops')}</p>
      </div>
    );
  }

  // Render Zero Farms Empty State
  if (farms.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in-up pb-12" data-testid="farm-digital-twin-view">
        <div className="bg-forest-900/80 rounded-3xl p-8 border border-forest-800 text-cream-100 max-w-2xl mx-auto my-12 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mx-auto mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h2 className="font-bengali font-bold text-2xl text-cream-50 mb-2">
            {t('কোনো খামার প্রোফাইল পাওয়া যায়নি', 'No Farm Profile Found')}
          </h2>
          <p className="font-bengali text-sm text-sage-300 max-w-md mx-auto mb-6 leading-relaxed">
            {t(
              'ফার্ম ডিজিটাল টুইন ৩৬০° ড্যাশবোর্ড সক্রিয় করতে প্রথমে আপনার অন্তত একটি খামারের প্রোফাইল যুক্ত করুন।',
              'To activate the Farm Digital Twin 360° Dashboard, please add at least one farm profile.'
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              if (onOpenCalendar) onOpenCalendar();
              else if (onNavigateToTab) onNavigateToTab('calendar');
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-400 hover:bg-gold-300 text-forest-950 font-bold text-sm transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('নতুন খামার প্রোফাইল তৈরি করুন', 'Create New Farm Profile')}</span>
          </button>
        </div>
      </div>
    );
  }

  const farm = overview?.farm;
  const cropsSummary = overview?.crops_summary;
  const tasksSummary = overview?.tasks_summary;
  const schedulesSummary = overview?.schedules_summary;
  const weather = overview?.weather_summary;
  const shortcuts = overview?.ai_shortcuts || [];
  const twinMeta = overview?.twin_metadata;

  return (
    <div className="space-y-6 animate-fade-in-up pb-12" data-testid="farm-digital-twin-view">
      
      {/* 1. Header & Farm Selector Bar */}
      <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ৩৬০° ডিজিটাল প্রোফাইল • Digital Twin
              </span>
              <span className="text-xs text-sage-400 font-mono">
                {farms.length} {t('টি খামার তালিকাভুক্ত', 'Farms Registered')}
              </span>
            </div>
            <h1 className="font-bengali font-bold text-2xl lg:text-3xl text-cream-50">
              {farm ? farm.name : t('ফার্ম ডিজিটাল টুইন', 'Farm Digital Twin')}
            </h1>
            <p className="font-bengali text-xs text-sage-300 mt-1 max-w-2xl">
              {t(
                'আপনার খামারের ভূমি, মাটি, চলমান ফসল, পরিক্রমা এবং লাইভ আবহাওয়ার সমন্বিত ডিজিটাল প্রতিচ্ছবি।',
                'Synthesized 360-degree digital overview of your farm, soil, active crops, schedule execution, and weather.'
              )}
            </p>
          </div>

          {/* Farm Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px]">
              <label htmlFor="farm-selector" className="sr-only">খামার নির্বাচন করুন</label>
              <select
                id="farm-selector"
                value={selectedFarmId || ''}
                onChange={(e) => setSelectedFarmId(Number(e.target.value))}
                className="w-full appearance-none px-4 py-2.5 pr-9 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali text-xs font-semibold focus:outline-none focus:border-gold-400 transition-colors cursor-pointer"
                data-testid="farm-selector-dropdown"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.district} • {f.area} {f.area_unit})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-sage-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadingOverview}
              title="তথ্য রিফ্রেশ করুন"
              className="p-2.5 rounded-xl bg-forest-800 hover:bg-forest-750 border border-forest-700 text-cream-100 transition-colors disabled:opacity-50 cursor-pointer"
              data-testid="refresh-twin-btn"
            >
              <RefreshCw className={`w-4 h-4 text-gold-400 ${loadingOverview ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenCalendar) onOpenCalendar();
                else if (onNavigateToTab) onNavigateToTab('calendar');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 text-cream-100 font-bengali text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-gold-300" />
              <span>{t('নতুন খামার', 'New Farm')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Honest Digital Twin Disclosure Card */}
      <div
        className="rounded-2xl p-4 bg-emerald-950/40 border border-emerald-800/60 text-cream-100 flex items-start gap-3 shadow-xs"
        data-testid="twin-honesty-disclaimer"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-900/60 border border-emerald-700/60 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-300 font-bengali">
              স্বচ্ছ ও দায়িত্বশীল ডিজিটাল টুইন ঘোষণা (Digital Record Synthesis)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-forest-900 text-sage-300 border border-forest-800">
              No Physical IoT Claim
            </span>
          </div>
          <p className="font-bengali text-sage-200 leading-relaxed text-[11px]">
            {twinMeta?.disclaimer_bn ||
              'এই ডিজিটাল খামার প্রোফাইলটি আপনার সংরক্ষিত খামার ও ফসলের রেকর্ড, পরিক্রমা এবং ওপেন-মেটিও আবহাওয়ার তথ্যের ভিত্তিতে সংকলিত। এটি কোনো কৃত্রিম উপগ্রহ, আইওটি সেন্সর বা লাইভ শারীরিক সিমুলেশন নয়।'}
          </p>
          <p className="text-[10px] text-sage-400 font-sans italic">
            {twinMeta?.disclaimer_en ||
              'This digital farm twin is synthesized strictly from your recorded farm, crop, and calendar data plus Open-Meteo weather intelligence.'}
          </p>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-bengali flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. Four Core Spec & Identity Cards */}
      {farm && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="twin-identity-grid">
          
          {/* Card 1: Geographic Location */}
          <div className="rounded-2xl p-4 bg-forest-900/80 border border-forest-800 text-cream-100 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sage-400 font-bengali">
                {t('ভৌগোলিক অবস্থান', 'Location & Geo')}
              </span>
              <div className="w-7 h-7 rounded-lg bg-forest-800 flex items-center justify-center text-gold-400">
                <MapPin className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <h3 className="font-bengali font-bold text-lg text-cream-100 mb-0.5">
                {farm.upazila ? `${farm.upazila}, ` : ''}{farm.district}
              </h3>
              <p className="font-bengali text-xs text-sage-300">
                {farm.division} বিভাগ {farm.village ? `• গ্রাম: ${farm.village}` : ''}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-forest-800/80 text-[10px] font-mono text-gold-300 flex items-center justify-between">
              <span>স্থানাঙ্ক:</span>
              <span>
                {farm.latitude ? `${farm.latitude.toFixed(4)}° N, ${farm.longitude?.toFixed(4)}° E` : 'জেলা কেন্দ্রস্থল'}
              </span>
            </div>
          </div>

          {/* Card 2: Land Area & Dimensions */}
          <div className="rounded-2xl p-4 bg-forest-900/80 border border-forest-800 text-cream-100 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sage-400 font-bengali">
                {t('জমির পরিমাপ ও আয়তন', 'Land Scale')}
              </span>
              <div className="w-7 h-7 rounded-lg bg-forest-800 flex items-center justify-center text-gold-400">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="font-mono font-bold text-2xl text-cream-50">{farm.area}</span>
                <span className="font-bengali text-xs text-sage-300 font-semibold">{farm.area_unit}</span>
              </div>
              <p className="font-bengali text-xs text-sage-300">
                {farm.area_unit.toLowerCase() === 'decimal'
                  ? `≈ ${(farm.area / 33).toFixed(2)} বিঘা`
                  : farm.area_unit.toLowerCase() === 'bigha'
                  ? `≈ ${(farm.area * 33).toFixed(1)} শতাংশ`
                  : 'কৃষি জমি'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-forest-800/80 text-[10px] text-sage-400 flex items-center justify-between font-bengali">
              <span>ব্যবহারযোগ্য অবস্থা:</span>
              <span className="font-semibold text-emerald-300">সক্রিয় খামার</span>
            </div>
          </div>

          {/* Card 3: Soil & Environmental Profile */}
          <div className="rounded-2xl p-4 bg-forest-900/80 border border-forest-800 text-cream-100 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sage-400 font-bengali">
                {t('মাটি ও পরিবেশ প্রোফাইল', 'Soil Profile')}
              </span>
              <div className="w-7 h-7 rounded-lg bg-forest-800 flex items-center justify-center text-gold-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <h3 className="font-bengali font-bold text-base text-cream-100 mb-0.5">
                {farm.soil_type || t('উর্বর পলি দোআঁশ মাটি', 'Fertile Loam Soil')}
              </h3>
              <p className="font-bengali text-xs text-sage-300 truncate">
                {farm.notes || t('স্বাভাবিক সেচ সুবিধা সম্পন্ন', 'Normal irrigation access')}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-forest-800/80 text-[10px] text-sage-400 flex items-center justify-between font-bengali">
              <span>মাটির শ্রেণী:</span>
              <span className="font-semibold text-gold-300">{farm.soil_type || 'প্রাকৃতিক'}</span>
            </div>
          </div>

          {/* Card 4: Digital Twin Synthesis Status */}
          <div className="rounded-2xl p-4 bg-forest-900/80 border border-forest-800 text-cream-100 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sage-400 font-bengali">
                {t('টুইন কার্যকারিতা সারাংশ', 'Twin Activity')}
              </span>
              <div className="w-7 h-7 rounded-lg bg-forest-800 flex items-center justify-center text-emerald-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <span className="font-mono font-bold text-2xl text-gold-300">
                  {cropsSummary?.active_crops_count || 0}
                </span>
                <span className="font-bengali text-xs text-sage-400 block">{t('চলমান ফসল', 'Active Crops')}</span>
              </div>
              <div className="h-8 w-px bg-forest-800" />
              <div>
                <span className="font-mono font-bold text-2xl text-cream-100">
                  {tasksSummary?.pending_tasks || 0}
                </span>
                <span className="font-bengali text-xs text-sage-400 block">{t('ক্যালেন্ডার কাজ', 'Pending Tasks')}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-forest-800/80 text-[10px] text-sage-400 flex items-center justify-between font-bengali">
              <span>পরিক্রমা স্থিতি:</span>
              <span className="font-semibold text-emerald-400">
                {schedulesSummary?.active_schedules_count || 0} টি সক্রিয় শিডিউল
              </span>
            </div>
          </div>

        </div>
      )}

      {/* 3.5. Compact Soil Summary Card (Phase F5B Integration) */}
      {farm && (
        <div
          data-testid="twin-soil-summary"
          className="rounded-3xl p-5 bg-forest-900/80 border border-forest-800 text-cream-100 shadow-sm space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-forest-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bengali font-bold text-base text-cream-100">
                  {t('মাটির স্বাস্থ্য ও ল্যাবরেটরি সারাংশ', 'Soil Health & Lab Summary')}
                </h3>
                <p className="font-bengali text-xs text-sage-400">
                  {latestSoilTest
                    ? `${t('সর্বশেষ নমুনা:', 'Latest Sample:')} ${latestSoilTest.sample_date} • ${latestSoilTest.sample_label}`
                    : t('কোনো মাটির পরীক্ষার রেকর্ড পাওয়া যায়নি', 'No soil test records on file for this farm')}
                </p>
              </div>
            </div>

            {/* Action Buttons: Full Soil Health Dashboard & AI Crop Recommendation */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {onNavigateToModel && (
                <button
                  type="button"
                  data-testid="twin-crop-recommendation-btn"
                  onClick={() => onNavigateToModel('crop_recommendation', selectedFarmId ? { farm_id: selectedFarmId } : undefined)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bengali text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Sprout className="w-3.5 h-3.5" />
                  <span>{t('AI ফসল সুপারিশ দেখুন', 'View AI Crop Recommendation')}</span>
                </button>
              )}
              {onNavigateToTab && (
                <button
                  type="button"
                  data-testid="view-full-soil-dashboard-btn"
                  onClick={() => onNavigateToTab('soil_health', selectedFarmId ? String(selectedFarmId) : undefined)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-950 hover:bg-forest-800 border border-amber-500/40 text-amber-300 font-bengali text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <span>{t('বিস্তারিত মাটির ড্যাশবোর্ড দেখুন', 'View Full Soil Dashboard')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {latestSoilTest ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-forest-950/70 border border-forest-800/80">
                <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('মাটির পিএইচ (pH)', 'Soil pH')}</span>
                <span className="font-mono font-bold text-base text-emerald-300">
                  {latestSoilTest.soil_ph !== null && latestSoilTest.soil_ph !== undefined
                    ? latestSoilTest.soil_ph.toFixed(1)
                    : t('তথ্য পাওয়া যায়নি', 'Data unavailable')}
                </span>
                <span className="text-[9px] text-sage-500 block mt-0.5 font-mono">
                  {latestSoilTest.ph_measurement_method || 'Standard'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-forest-950/70 border border-forest-800/80">
                <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('নাইট্রোজেন (N)', 'Nitrogen (N)')}</span>
                <span className="font-mono font-bold text-base text-amber-300">
                  {latestSoilTest.nitrogen_n !== null && latestSoilTest.nitrogen_n !== undefined
                    ? `${latestSoilTest.nitrogen_n} ${latestSoilTest.measurement_unit_n}`
                    : t('তথ্য পাওয়া যায়নি', 'Data unavailable')}
                </span>
                <span className="text-[9px] text-sage-500 block mt-0.5 font-bengali">উপলব্ধ নাইট্রোজেন</span>
              </div>

              <div className="p-3 rounded-2xl bg-forest-950/70 border border-forest-800/80">
                <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('ফসফরাস ও পটাশ (P / K)', 'P & K')}</span>
                <span className="font-mono font-bold text-base text-cream-100">
                  {latestSoilTest.phosphorus_p ?? '-'}/{latestSoilTest.potassium_k ?? '-'}{' '}
                  <span className="text-[10px] text-sage-400 font-normal">({latestSoilTest.measurement_unit_p})</span>
                </span>
                <span className="text-[9px] text-sage-500 block mt-0.5 font-bengali">ম্যাক্রোনিউট্রিয়েন্ট</span>
              </div>

              <div className="p-3 rounded-2xl bg-forest-950/70 border border-forest-800/80">
                <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('উৎস ও মাটির ধরন', 'Source & Texture')}</span>
                <span className="font-bengali font-semibold text-xs text-gold-300 block truncate">
                  {latestSoilTest.test_source === 'laboratory' ? 'ল্যাবরেটরি' : 'কৃষক'} • {latestSoilTest.soil_type || farm?.soil_type || t('দোআঁশ', 'Loam')}
                </span>
                <span className="text-[9px] text-sage-500 block mt-0.5 font-mono truncate">
                  {latestSoilTest.laboratory_name || 'Field Observation'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 px-3 rounded-xl bg-forest-950/40 border border-forest-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-bengali text-sage-300">
              <span>{t('এই খামারের জন্য এখনো মাটির ল্যাবরেটরি টেস্ট সংরক্ষিত নেই। উপযুক্ত সার ও পুষ্টি নির্ধারণে টেস্ট যোগ করুন।', 'No soil test records saved for this farm yet.')}</span>
              {onNavigateToTab && (
                <button
                  type="button"
                  data-testid="twin-add-soil-btn"
                  onClick={() => onNavigateToTab('soil_health', selectedFarmId ? String(selectedFarmId) : undefined)}
                  className="text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer shrink-0"
                >
                  {t('+ মাটির পরীক্ষা যোগ করুন', '+ Add Soil Test')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3.5 Recent Field Monitoring & Cultivation Operations (Phase F5D-2) */}
      <div className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center text-teal-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bengali font-bold text-lg text-cream-50">
                {t('সাম্প্রতিক মাঠ পর্যবেক্ষণ ও চাষাবাদ কার্যক্রম', 'Recent Field Scouting & Operations')}
              </h2>
              <p className="font-bengali text-xs text-sage-400">
                {recentActivities.length} {t('কার্যক্রম', 'Activities')} • {recentObservations.length} {t('পর্যবেক্ষণ', 'Observations')}
              </p>
            </div>
          </div>

          {onNavigateToTab && (
            <button
              type="button"
              data-testid="twin-view-monitoring-btn"
              onClick={() => onNavigateToTab('crop_monitoring', selectedFarmId ? String(selectedFarmId) : undefined)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-950 hover:bg-forest-800 border border-teal-500/40 text-teal-300 font-bengali text-xs font-semibold transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <span>{t('সম্পূর্ণ মনিটরিং ড্যাশবোর্ড', 'Open Monitoring Dashboard')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentActivities.length === 0 && recentObservations.length === 0 ? (
          <div className="py-4 px-4 rounded-2xl bg-forest-950/40 border border-forest-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-bengali text-sage-300">
            <span>{t('এই খামারে এখনো কোনো চাষাবাদ কার্যক্রম বা মাঠ পর্যবেক্ষণ রেকর্ড করা হয়নি।', 'No field activities or observations logged for this farm yet.')}</span>
            {onNavigateToTab && (
              <button
                type="button"
                data-testid="twin-record-first-activity-btn"
                onClick={() => onNavigateToTab('crop_monitoring', selectedFarmId ? String(selectedFarmId) : undefined)}
                className="text-teal-400 hover:text-teal-300 underline font-semibold cursor-pointer shrink-0"
              >
                {t('+ কার্যক্রম রেকর্ড করুন', '+ Log Activity')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bengali">
            {recentActivities.slice(0, 2).map((act) => (
              <div key={act.id} className="p-3 rounded-2xl bg-forest-950/70 border border-forest-800/80 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gold-500/15 text-gold-300 border border-gold-500/30">
                      {act.activity_type}
                    </span>
                    <span className="text-[10px] font-mono text-sage-400">{act.activity_date}</span>
                  </div>
                  <h4 className="font-bold text-cream-100">{act.title}</h4>
                  {act.farmer_notes && <p className="text-[11px] text-sage-400 mt-1 line-clamp-1">{act.farmer_notes}</p>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  {act.status}
                </span>
              </div>
            ))}
            {recentObservations.slice(0, 2).map((obs) => (
              <div key={obs.id} className="p-3 rounded-2xl bg-forest-950/70 border border-forest-800/80 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      {t('মাঠ পর্যবেক্ষণ', 'Observation')}
                    </span>
                    <span className="text-[10px] font-mono text-sage-400">{obs.observation_date}</span>
                  </div>
                  <h4 className="font-bold text-cream-100">{obs.title}</h4>
                  {obs.visible_symptoms && <p className="text-[11px] text-amber-200/90 mt-1 line-clamp-1">{obs.visible_symptoms}</p>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
                  {obs.farmer_reported_condition}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3.7. Compact Harvest Summary Card (Phase F5E-3 Integration) */}
      <div
        className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md"
        data-testid="twin-harvest-summary"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-forest-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bengali font-bold text-base text-cream-50">
                {t('ফসল সংগ্রহ ও ফলন সারসংক্ষেপ', 'Harvest & Actual Yield Summary')}
              </h3>
              <p className="font-bengali text-xs text-sage-400">
                {latestHarvest
                  ? `${t('সর্বশেষ কর্তন:', 'Latest Harvest:')} ${latestHarvest.harvest_date} • ${latestHarvest.harvest_label}`
                  : t('এই খামারের জন্য কোনো ফসল সংগ্রহের তথ্য নেই', 'No harvest records on file for this farm')}
              </p>
            </div>
          </div>

          <button
            data-testid="view-full-harvest-dashboard-btn"
            onClick={() => onNavigateToTab && onNavigateToTab('harvest', selectedFarmId ? String(selectedFarmId) : undefined)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-700 text-xs font-semibold text-emerald-300 border border-forest-700 transition-all font-bengali w-fit cursor-pointer"
          >
            <span>{t('ফসল সংগ্রহ ড্যাশবোর্ড দেখুন', 'View Full Harvest Dashboard')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Harvest Summary Metrics Grid */}
        {harvestSummary && harvestSummary.total_records_count > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 rounded-2xl bg-forest-950/60 border border-forest-800">
              <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('মোট সংগ্রহ', 'Total Harvested')}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-white font-mono">{harvestSummary.total_measured_quantity_kg.toLocaleString()}</span>
                <span className="text-[10px] text-sage-400">কেজি</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-forest-950/60 border border-forest-800">
              <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('লট সংখ্যা', 'Harvest Lots')}</span>
              <span className="text-base font-bold text-gold-300 font-mono">{harvestSummary.total_records_count}</span>
              <span className="text-[10px] text-sage-400 block">{harvestSummary.partial_harvests_count} {t('আংশিক', 'partial')} • {harvestSummary.final_harvests_count} {t('চূড়ান্ত', 'final')}</span>
            </div>

            <div className="p-3 rounded-2xl bg-forest-950/60 border border-forest-800">
              <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('উৎস সত্যতা', 'Provenance')}</span>
              <span className="text-xs font-semibold text-emerald-400 block">{harvestSummary.weighed_records_count}টি ওজনকৃত</span>
              <span className="text-[10px] text-amber-300/90">{harvestSummary.farmer_estimated_records_count}টি আনুমানিক</span>
            </div>

            <div className="p-3 rounded-2xl bg-forest-950/60 border border-forest-800">
              <span className="text-[10px] text-sage-400 font-bengali block mb-0.5">{t('প্রকৃত ফলন হার', 'Yield Rate')}</span>
              {harvestSummary.overall_yield_metric?.calculation_status === 'calculated' ? (
                <div>
                  <span className="text-sm font-bold text-gold-300">{harvestSummary.overall_yield_metric.yield_t_ha} t/ha</span>
                  <span className="text-[10px] text-sage-400 block">≈ {harvestSummary.overall_yield_metric.yield_kg_decimal} কেজি/শতক</span>
                </div>
              ) : (
                <span className="text-xs text-sage-400 italic block">{t('তথ্য পাওয়া যায়নি', 'N/A')}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-2xl bg-forest-950/40 border border-dashed border-forest-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sage-400 font-bengali">
            <span>{t('এই খামারের জন্য এখনও কোনো ফসল কাটার তথ্য রেকর্ড করা হয়নি।', 'No harvest records saved for this farm yet.')}</span>
            <button
              data-testid="twin-add-harvest-btn"
              onClick={() => onNavigateToTab && onNavigateToTab('harvest', selectedFarmId ? String(selectedFarmId) : undefined)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex-shrink-0 cursor-pointer"
            >
              {t('+ ফসল কর্তন যোগ করুন', '+ Add Harvest Record')}
            </button>
          </div>
        )}
      </div>

      {/* 4. Active Crops & Phenology Section */}
      <div className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bengali font-bold text-lg text-cream-50">
                {t('খামারের চলমান ফসল ও জাত বিন্যাস', 'Active Crops & Varieties')}
              </h2>
              <p className="font-bengali text-xs text-sage-400">
                {cropsSummary?.total_crops || 0} টি ফসল নিবন্ধিত রয়েছে
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onOpenCalendar) onOpenCalendar();
              else if (onNavigateToTab) onNavigateToTab('calendar');
            }}
            className="text-xs font-bengali text-gold-400 hover:text-gold-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{t('ক্যালেন্ডারে দেখুন', 'View in Calendar')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {cropsSummary && cropsSummary.crops.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="crops-summary-grid">
            {cropsSummary.crops.map((c: FarmCropSummaryItem) => (
              <div
                key={c.id}
                className="rounded-2xl p-4 bg-forest-950/70 border border-forest-750 text-cream-100 flex flex-col justify-between hover:border-gold-400/40 transition-colors shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                      {c.status_bn}
                    </span>
                    <span className="text-xs font-bengali text-sage-400">
                      {c.season_bn} মৌসুম
                    </span>
                  </div>

                  <h3 className="font-bengali font-bold text-lg text-cream-50 mb-1">
                    {c.crop_name_bn}
                  </h3>
                  {c.variety && (
                    <p className="text-xs text-gold-300 font-medium mb-3">
                      জাত: <span className="font-semibold">{c.variety}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 pt-3 border-t border-forest-800 text-xs font-bengali text-sage-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sage-400">রোপণ / বপনের তারিখ:</span>
                    <span className="font-mono text-cream-100">{c.sowing_date}</span>
                  </div>
                  {c.expected_harvest_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sage-400">প্রত্যাশিত কর্তন:</span>
                      <span className="font-mono text-cream-100">{c.expected_harvest_date}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-forest-950/50 border border-dashed border-forest-800 text-center text-sage-400 font-bengali text-xs">
            {t('এই খামারে এখনও কোনো ফসল যুক্ত করা হয়নি।', 'No crops added to this farm yet.')}
          </div>
        )}
      </div>

      {/* 5. Schedule Progress & Calendar Tasks Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sub-Card A: Crop Schedule Progress */}
        <div className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bengali font-bold text-lg text-cream-50">
                  {t('ফসলের পরিক্রমা ও সময়সূচি বাস্তবায়ন', 'Schedule Execution Progress')}
                </h2>
                <p className="font-bengali text-xs text-sage-400">
                  {schedulesSummary?.total_schedules || 0} টি বৈজ্ঞানিক পরিক্রমা কার্যকর
                </p>
              </div>
            </div>

            {schedulesSummary && schedulesSummary.schedules.length > 0 ? (
              <div className="space-y-4" data-testid="schedules-progress-list">
                {schedulesSummary.schedules.map((s: FarmScheduleProgressItem) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-2xl bg-forest-950/60 border border-forest-750 text-cream-100 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bengali font-bold text-sm text-cream-100">
                        {s.crop_name_bn} পরিক্রমা ({s.source_agency})
                      </span>
                      <span className="font-mono text-xs font-bold text-gold-300">
                        {s.progress_percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-forest-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-gold-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, s.progress_percent))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-sage-400 font-bengali pt-1">
                      <span>
                        সম্পন্ন: <strong className="text-emerald-300 font-mono">{s.completed_tasks}</strong> / {s.total_tasks} টি কাজ
                      </span>
                      <span>বপন: {s.planting_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-forest-950/40 border border-dashed border-forest-800 text-center text-sage-400 font-bengali text-xs">
                {t('কোনো পরিক্রমা শিডিউল নিশ্চিত করা হয়নি। ক্যালেন্ডারে গিয়ে নতুন শিডিউল তৈরি করুন।', 'No confirmed schedules yet. Generate one in the calendar.')}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-forest-800/80 flex items-center justify-between text-xs font-bengali">
            <span className="text-sage-400">তথ্যসূত্র: BAMIS / BRRI / BARI</span>
            <button
              type="button"
              onClick={() => {
                if (onOpenCalendar) onOpenCalendar();
                else if (onNavigateToTab) onNavigateToTab('calendar');
              }}
              className="text-gold-400 hover:text-gold-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t('শিডিউল পরিচালনা করুন', 'Manage Schedules')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-Card B: Upcoming & Overdue Tasks */}
        <div className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bengali font-bold text-lg text-cream-50">
                    {t('জরুরি ও আসন্ন ক্যালেন্ডার কাজ', 'Upcoming & Priority Tasks')}
                  </h2>
                  <p className="font-bengali text-xs text-sage-400">
                    {tasksSummary?.overdue_tasks || 0} টি মেয়াদোত্তীর্ণ • {tasksSummary?.pending_tasks || 0} টি অপেক্ষমাণ
                  </p>
                </div>
              </div>

              {tasksSummary && tasksSummary.overdue_tasks > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700/60 animate-pulse">
                  {tasksSummary.overdue_tasks} টি বকেয়া
                </span>
              )}
            </div>

            {/* Overdue alert banner if present */}
            {tasksSummary && tasksSummary.overdue_tasks > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs font-bengali flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  আপনার খামারে <strong>{tasksSummary.overdue_tasks}টি কাজের নির্ধারিত সময় পার হয়ে গেছে</strong>। অতিসত্বর সম্পন্ন করুন।
                </span>
              </div>
            )}

            {/* Upcoming tasks list */}
            {tasksSummary && tasksSummary.upcoming_tasks.length > 0 ? (
              <div className="space-y-2.5" data-testid="upcoming-tasks-list">
                {tasksSummary.upcoming_tasks.map((tItem: FarmTaskSummaryItem) => (
                  <div
                    key={tItem.id}
                    className="p-3 rounded-xl bg-forest-950/60 border border-forest-750 flex items-center justify-between gap-3 text-cream-100"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bengali font-bold text-xs text-cream-100 truncate">
                          {tItem.title}
                        </span>
                        {tItem.is_due_today && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
                            আজকের
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-sage-400 font-bengali">
                        {tItem.category_bn} {tItem.crop_name ? `• ${tItem.crop_name}` : ''}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-semibold text-gold-300 block">
                        {tItem.due_date}
                      </span>
                      <span className="text-[10px] text-sage-400 font-bengali uppercase">
                        {tItem.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-forest-950/40 border border-dashed border-forest-800 text-center text-sage-400 font-bengali text-xs">
                {t('আসন্ন কোনো নির্ধারিত কাজ নেই।', 'No upcoming tasks scheduled.')}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-forest-800/80 text-right">
            <button
              type="button"
              onClick={() => {
                if (onOpenCalendar) onOpenCalendar();
                else if (onNavigateToTab) onNavigateToTab('calendar');
              }}
              className="text-xs font-bengali text-gold-400 hover:text-gold-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{t('সম্পূর্ণ ক্যালেন্ডার খুলুন', 'Open Full Calendar')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* 6. Live Weather Intelligence & Risk Advisories */}
      <div className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bengali font-bold text-lg text-cream-50">
                {t('হাইপার-লোকাল আবহাওয়া ও কৃষি পরামর্শ', 'Hyper-Local Weather Intelligence')}
              </h2>
              <p className="font-bengali text-xs text-sage-400">
                {weather?.location_label_bn || farm?.district}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bengali text-sage-400">
            <a
              href="https://bmd.gov.bd/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300 underline"
            >
              <span>BMD পোর্টাল</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <a
              href="https://www.bamis.gov.bd/en/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300 underline"
            >
              <span>BAMIS পোর্টাল</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {weather && weather.status === 'ok' ? (
          <div className="space-y-4" data-testid="weather-overview-panel">
            {/* Weather Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl p-3 bg-forest-950/60 border border-forest-750 text-cream-100">
                <span className="text-[10px] text-sage-400 block font-bengali">তাপমাত্রা</span>
                <span className="font-mono font-bold text-xl text-cream-50">
                  {weather.temp_max !== null && weather.temp_min !== null
                    ? `${weather.temp_min?.toFixed(0)}° - ${weather.temp_max?.toFixed(0)}° C`
                    : 'তথ্য নেই'}
                </span>
                <span className="text-[11px] text-gold-300 font-bengali block mt-0.5">
                  {weather.condition_bn}
                </span>
              </div>

              <div className="rounded-xl p-3 bg-forest-950/60 border border-forest-750 text-cream-100">
                <span className="text-[10px] text-sage-400 block font-bengali">বৃষ্টিপাতের সম্ভাবনা</span>
                <span className="font-mono font-bold text-xl text-emerald-300">
                  {weather.precipitation_prob}%
                </span>
                <span className="text-[11px] text-sage-400 font-bengali block mt-0.5">
                  পরিমাণ: {weather.precipitation_mm.toFixed(1)} মিমি
                </span>
              </div>

              <div className="rounded-xl p-3 bg-forest-950/60 border border-forest-750 text-cream-100">
                <span className="text-[10px] text-sage-400 block font-bengali">বাতাসের আর্দ্রতা</span>
                <span className="font-mono font-bold text-xl text-cream-50">
                  {weather.humidity}%
                </span>
                <span className="text-[11px] text-sage-400 font-bengali block mt-0.5">
                  গড় আপেক্ষিক
                </span>
              </div>

              <div className="rounded-xl p-3 bg-forest-950/60 border border-forest-750 text-cream-100">
                <span className="text-[10px] text-sage-400 block font-bengali">বাতাসের সর্বোচ্চ বেগ</span>
                <span className="font-mono font-bold text-xl text-cream-50">
                  {weather.wind_kmh.toFixed(1)}
                </span>
                <span className="text-[11px] text-sage-400 font-bengali block mt-0.5">
                  কিমি / ঘণ্টা
                </span>
              </div>
            </div>

            {/* Active Advisories if any */}
            {weather.active_advisories && weather.active_advisories.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-gold-300 font-bengali block">
                  সক্রিয় কৃষি আবহাওয়া সতর্কতা ({weather.advisories_count}টি):
                </span>
                {weather.active_advisories.map((adv: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs font-bengali flex items-start gap-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-100 block">{adv.title_bn}</strong>
                      <p className="text-[11px] text-amber-200/90 mt-0.5">{adv.reason_bn}</p>
                      <p className="text-[10px] text-amber-300/80 mt-1 italic">
                        পরামর্শ: {adv.action_suggestion_bn}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-forest-950/40 border border-dashed border-forest-800 text-center text-sage-400 font-bengali text-xs">
            {t(
              'আবহাওয়া সার্ভার থেকে এই মুহূর্তে লাইভ তথ্য পাওয়া যায়নি। নেটওয়ার্ক সংযোগ স্বাভাবিক হলে স্বয়ংক্রিয়ভাবে হালনাগাদ হবে।',
              'Live weather data unavailable right now. Will update automatically.'
            )}
          </div>
        )}
      </div>

      {/* 7. Tailored AI Model Shortcuts */}
      <div className="bg-forest-900/80 rounded-3xl p-6 border border-forest-800 shadow-md">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center text-gold-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bengali font-bold text-lg text-cream-50">
              {t('আপনার খামারের উপযোগী এআই বুদ্ধিমত্তা শর্টকাট', 'Tailored AI Intelligence Shortcuts')}
            </h2>
            <p className="font-bengali text-xs text-sage-400">
              {t(
                'খামারের মাটি, অবস্থান ও ফসলের ভিত্তিতে প্রস্তুতকৃত ৭টি গবেষণা মডেলের দ্রুত প্রবেশপথ',
                'Pre-configured shortcuts to our 7 research models tailored for your farm'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="ai-shortcuts-grid">
          {shortcuts.map((sc: FarmAIShortcut) => (
            <div
              key={sc.id}
              className="rounded-2xl p-4 bg-forest-950/70 border border-forest-750 text-cream-100 flex flex-col justify-between hover:border-gold-400/50 transition-colors shadow-xs group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-forest-800 flex items-center justify-center text-gold-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                    {sc.category}
                  </span>
                </div>

                <h3 className="font-bengali font-bold text-base text-cream-100 mb-1 group-hover:text-gold-300 transition-colors">
                  {sc.title_bn}
                </h3>
                <p className="font-bengali text-xs text-sage-300 leading-relaxed mb-4">
                  {sc.desc_bn}
                </p>
              </div>

              <div className="pt-3 border-t border-forest-800 flex items-center justify-between text-xs">
                <code className="text-[10px] font-mono text-sage-400 truncate max-w-[120px]">
                  {sc.model_id}
                </code>
                <button
                  type="button"
                  onClick={() => handleShortcutClick(sc)}
                  className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300 font-semibold cursor-pointer"
                >
                  <span className="font-bengali">{t('মডেলে যান', 'Open Model')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
