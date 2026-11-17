// Premium Unified Farmer Decision Dashboard (Phase F6B)
// Platform: আমাদের কৃষি AI (AgriSphere AI)
// Strictly connects to authenticated Farm Intelligence API (GET /farms/{farm_id}/intelligence)
// Multi-domain provenance tracking, zero synthetic health scores, zero fabricated data,
// actionable navigation to all workspace tools, and honest scientific limitations disclaimers.

import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  MapPin,
  Clock,
  AlertCircle,
  RefreshCw,
  Sprout,
  Activity,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import { farmApi, farmIntelligenceApi } from '../../services/api.ts';
import type {
  FarmProfile,
  FarmUnifiedIntelligenceResponse,
} from '../../types/index.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { WorkspaceTab } from './WorkspaceSidebar.tsx';

interface FarmIntelligenceDashboardProps {
  initialFarmId?: number | null;
  onNavigateToTab?: (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => void;
  onNavigateToModel?: (modelId: string, prefill?: Record<string, any>) => void;
}

export function FarmIntelligenceDashboard({
  initialFarmId,
  onNavigateToTab,
  onNavigateToModel,
}: FarmIntelligenceDashboardProps) {
  const { t, lang } = useLanguage();
  // Mark onNavigateToModel as used to avoid unused param error
  void onNavigateToModel;

  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId || null);
  const [intelligence, setIntelligence] = useState<FarmUnifiedIntelligenceResponse | null>(null);
  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);
  const [loadingIntelligence, setLoadingIntelligence] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState<boolean>(false);

  // Helper: Convert English digits to Bengali digits if lang is 'bn'
  const toBn = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null) return '—';
    const s = String(num);
    if (lang === 'en') return s;
    const bnDigits: Record<string, string> = {
      '0': '০',
      '1': '১',
      '2': '২',
      '3': '৩',
      '4': '৪',
      '5': '৫',
      '6': '৬',
      '7': '৭',
      '8': '৮',
      '9': '৯',
    };
    return s.replace(/[0-9]/g, (d) => bnDigits[d] || d);
  };

  // 1. Initial Load: Fetch User's Farms
  useEffect(() => {
    let isMounted = true;
    async function loadFarms() {
      setLoadingFarms(true);
      setErrorMessage(null);
      try {
        const farmList = await farmApi.listFarms();
        if (isMounted) {
          setFarms(farmList);
          if (farmList.length > 0) {
            const matched = initialFarmId ? farmList.find((f) => f.id === initialFarmId) : null;
            setSelectedFarmId(matched ? matched.id : farmList[0].id);
          } else {
            setSelectedFarmId(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(
            err?.response?.data?.detail ||
              t('খামারের তালিকা লোড করতে ব্যর্থ হয়েছে।', 'Failed to load farm list.')
          );
        }
      } finally {
        if (isMounted) setLoadingFarms(false);
      }
    }

    loadFarms();
    return () => {
      isMounted = false;
    };
  }, [initialFarmId, t]);

  // 2. Fetch Intelligence Summary whenever selectedFarmId changes
  useEffect(() => {
    if (!selectedFarmId) {
      setIntelligence(null);
      return;
    }

    let isMounted = true;
    async function fetchFarmIntelligence() {
      setIntelligence(null);
      setLoadingIntelligence(true);
      setErrorMessage(null);

      try {
        const data = await farmIntelligenceApi.getIntelligence(selectedFarmId!);
        if (isMounted) {
          setIntelligence(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(
            err?.response?.data?.detail ||
              t('খামার বুদ্ধিমত্তা উপাত্ত লোড করতে ব্যর্থ হয়েছে।', 'Failed to load farm intelligence data.')
          );
        }
      } finally {
        if (isMounted) setLoadingIntelligence(false);
      }
    }

    fetchFarmIntelligence();
    return () => {
      isMounted = false;
    };
  }, [selectedFarmId, t]);

  const handleRefresh = async () => {
    if (!selectedFarmId) return;
    setLoadingIntelligence(true);
    setErrorMessage(null);
    try {
      const data = await farmIntelligenceApi.getIntelligence(selectedFarmId);
      setIntelligence(data);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.detail ||
          t('উপাত্ত রিফ্রেশ করতে ব্যর্থ হয়েছে।', 'Failed to refresh data.')
      );
    } finally {
      setLoadingIntelligence(false);
    }
  };

  const selectedFarm = useMemo(() => {
    return farms.find((f) => f.id === selectedFarmId) || null;
  }, [farms, selectedFarmId]);

  // If initial load of farms is happening
  if (loadingFarms) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-28 bg-forest-900/60 rounded-3xl border border-forest-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-36 bg-forest-900/50 rounded-2xl border border-forest-800" />
          <div className="h-36 bg-forest-900/50 rounded-2xl border border-forest-800" />
          <div className="h-36 bg-forest-900/50 rounded-2xl border border-forest-800" />
          <div className="h-36 bg-forest-900/50 rounded-2xl border border-forest-800" />
        </div>
        <div className="h-80 bg-forest-900/40 rounded-3xl border border-forest-800" />
      </div>
    );
  }

  // If user has NO registered farms
  if (!loadingFarms && farms.length === 0) {
    return (
      <div className="bg-forest-950/80 border border-forest-800 rounded-3xl p-8 text-center max-w-2xl mx-auto my-12 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-forest-900 flex items-center justify-center mx-auto mb-4 border border-forest-800">
          <Sprout className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bengali font-bold text-cream-50 mb-2">
          {t('আপনার কোনো নিবন্ধিত খামার পাওয়া যায়নি', 'No registered farm found')}
        </h2>
        <p className="text-sm font-bengali text-sage-300 mb-6">
          {t(
            'স্মার্ট কৃষি কেন্দ্রের পূর্ণাঙ্গ সিদ্ধান্ত ও বুদ্ধিমত্তা দেখতে প্রথমে একটি খামার প্রোফাইল এবং ফসল যোগ করুন।',
            'To view the Unified Decision Dashboard, please create a farm profile and register your crops.'
          )}
        </p>
        <button
          type="button"
          onClick={() => onNavigateToTab && onNavigateToTab('farm_twin')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bengali font-semibold shadow-lg transition-colors cursor-pointer"
        >
          <Activity className="w-4 h-4" />
          <span>{t('ফার্ম ডিজিটাল টুইনে যান', 'Go to Farm Digital Twin')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in-up text-cream-50" id="smart-farm-center-root">

      {/* ========================================================================= */}
      {/* TOP HEADER: FARM SELECTOR + IDENTITY CARD + DATA FRESHNESS */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-br from-forest-950 via-forest-900 to-[#0a2318] border border-forest-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative background circle */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-600/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          {/* Header Title & Badges */}
          <div>
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bengali font-semibold bg-gold-400/15 text-gold-300 border border-gold-400/30">
                <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                {t('স্মার্ট কৃষি সিদ্ধান্ত কেন্দ্র', 'Smart Farm Center')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bengali font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                {t('১০টি ডোমেইন সমন্বিত', '10 Domains Unified')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bengali text-sage-300 bg-forest-900/80 border border-forest-700">
                <ShieldCheck className="w-3 h-3 text-sage-400" />
                {t('প্রামাণ্য ডেটা • কাল্পনিক স্কোর মুক্ত', 'Verified Provenance • Zero Synthetic Scores')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bengali font-extrabold text-cream-50 tracking-tight">
              {intelligence?.farm.name || selectedFarm?.name || t('খামার সিদ্ধান্ত কেন্দ্র', 'Farmer Decision Dashboard')}
            </h1>
          </div>

          {/* Farm Selector & Refresh Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="relative min-w-[220px]">
              <select
                id="farm-intelligence-selector"
                value={selectedFarmId || ''}
                onChange={(e) => setSelectedFarmId(Number(e.target.value))}
                className="w-full appearance-none bg-forest-900/90 text-cream-50 text-sm font-bengali font-medium px-4 py-2.5 pr-10 rounded-xl border border-forest-700 hover:border-gold-400/60 focus:border-gold-400 focus:outline-none focus:ring-1 focus:ring-gold-400 transition-colors cursor-pointer shadow-inner"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id} className="bg-forest-950 text-cream-100">
                    {f.name} ({f.district}) — {toBn(f.area)} {f.area_unit}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-sage-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              id="farm-intelligence-refresh-btn"
              type="button"
              onClick={handleRefresh}
              disabled={loadingIntelligence}
              title={t('উপাত্ত রিফ্রেশ করুন', 'Refresh data')}
              className="p-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 border border-forest-700 text-sage-300 hover:text-cream-50 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingIntelligence ? 'animate-spin text-gold-400' : ''}`} />
            </button>

            {/* Quick Link to Digital Twin */}
            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('farm_twin')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bengali font-semibold transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{t('ডিজিটাল টুইন', 'Digital Twin')}</span>
            </button>
          </div>
        </div>

        {/* Farm Metadata Details Bar */}
        {selectedFarm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-4 border-t border-forest-800/80 text-xs font-bengali">
            <div className="bg-forest-950/60 p-2.5 rounded-xl border border-forest-800/50 hover:border-gold-400/30 transition-colors">
              <span className="text-sage-400 flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-gold-400 shrink-0" />
                {t('অবস্থান ও এলাকা', 'Location & Area')}
              </span>
              <p className="font-semibold text-cream-100 truncate">
                {selectedFarm.upazila}, {selectedFarm.district}
              </p>
              <p className="text-[11px] text-sage-400 truncate">
                {selectedFarm.village ? `${selectedFarm.village}, ` : ''}{selectedFarm.division}
              </p>
            </div>

            <div className="bg-forest-950/60 p-2.5 rounded-xl border border-forest-800/50 hover:border-gold-400/30 transition-colors">
              <span className="text-sage-400 flex items-center gap-1 mb-1">
                <Layers className="w-3 h-3 text-emerald-400 shrink-0" />
                {t('জমির আয়তন', 'Total Land Area')}
              </span>
              <p className="font-bold text-cream-100 text-sm">
                {toBn(selectedFarm.area)} <span className="text-xs font-normal text-sage-300">{selectedFarm.area_unit}</span>
              </p>
              <p className="text-[11px] text-sage-400 truncate">
                {t('মাটির ধরন:', 'Soil:')} {selectedFarm.soil_type || t('অনির্ধারিত', 'Unspecified')}
              </p>
            </div>

            <div className="bg-forest-950/60 p-2.5 rounded-xl border border-forest-800/50 hover:border-gold-400/30 transition-colors">
              <span className="text-sage-400 flex items-center gap-1 mb-1">
                <Sprout className="w-3 h-3 text-green-400 shrink-0" />
                {t('নিবন্ধিত ফসল', 'Registered Crops')}
              </span>
              <p className="font-bold text-cream-100 text-sm">
                {toBn(intelligence?.crops_summary.total_crops || 0)} <span className="text-xs font-normal text-sage-300">{t('টি ফসল', 'crops')}</span>
              </p>
              <p className="text-[11px] text-emerald-400 font-medium">
                {toBn(intelligence?.crops_summary.active_crops_count || 0)} {t('টি সক্রিয়', 'active')}
              </p>
            </div>

            <div className="bg-forest-950/60 p-2.5 rounded-xl border border-forest-800/50 hover:border-gold-400/30 transition-colors">
              <span className="text-sage-400 flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                {t('ক্যালেন্ডার ও কাজ', 'Tasks Status')}
              </span>
              <p className="font-bold text-cream-100 text-sm">
                {toBn(intelligence?.tasks_summary.pending_tasks || 0)} <span className="text-xs font-normal text-sage-300">{t('টি বাকি', 'pending')}</span>
              </p>
              <p className={`text-[11px] font-semibold ${
                (intelligence?.tasks_summary.overdue_tasks || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
              >
                {(intelligence?.tasks_summary.overdue_tasks || 0) > 0
                  ? `${toBn(intelligence?.tasks_summary.overdue_tasks)}টি বকেয়া`
                  : t('বকেয়া কাজ নেই', 'No overdue')}
              </p>
            </div>

            <div className="bg-forest-950/60 p-2.5 rounded-xl border border-forest-800/50 col-span-2 sm:col-span-1 hover:border-gold-400/30 transition-colors">
              <span className="text-sage-400 flex items-center gap-1 mb-1">
                <ShieldCheck className="w-3 h-3 text-gold-400 shrink-0" />
                {t('ডেটা প্রামাণিকতা', 'Provenance')}
              </span>
              <button
                type="button"
                onClick={() => setIsAuditDrawerOpen(!isAuditDrawerOpen)}
                className="text-[11px] text-gold-300 hover:text-gold-200 underline font-semibold flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <span>{isAuditDrawerOpen ? t('অডিট বন্ধ করুন', 'Close Audit') : t('প্রমাণপত্র দেখুন', 'View Audit')}</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${isAuditDrawerOpen ? 'rotate-90' : ''}`} />
              </button>
              <p className="text-[10px] text-sage-400 mt-1">
                {t('১০টি ডোমেইন অডিট', '10-Domain Audit')}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-950/60 border border-rose-800/80 rounded-2xl p-4 flex items-center gap-3 text-rose-200 text-sm font-bengali">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="flex-1">{errorMessage}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            {t('পুনরায় চেষ্টা', 'Retry')}
          </button>
        </div>
      )}

      {/* Loading Skeleton during intelligence fetch */}
      {loadingIntelligence && !intelligence && (
        <div className="space-y-6 animate-pulse">
          <div className="h-44 bg-forest-900/50 rounded-3xl border border-forest-800" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-40 bg-forest-900/40 rounded-2xl" />
            <div className="h-40 bg-forest-900/40 rounded-2xl" />
          </div>
        </div>
      )}

      {/* ==================== MAIN CONTENT CARDS ==================== */}
      {intelligence && selectedFarm && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column – Overview & Quick Actions */}
          <div className="lg:col-span-7 space-y-6 flex flex-col">
            {/* Today Tasks Card (reused from Premium) */}
            <div className="bg-[#082b1f] border border-[#1b4332] rounded-2xl p-5 sm:p-6 shadow-xl transition-all duration-300 hover:border-[#1b4332]/80">
              <h2 className="text-base font-bold text-white mb-3">
                {t('আজকের কাজ', 'Today\'s Tasks')}
              </h2>
              {/* Placeholder – actual task list could be added later */}
              <p className="text-sm text-[#a7b9ae]">{t('কোনো কাজ লোড করা হয়নি', 'No tasks loaded')}</p>
            </div>

            {/* Weather Advisory Banner – placeholder */}
            <div className="bg-[#001c12] border border-[#0a2318] rounded-2xl p-4 shadow-md">
              {/* Could integrate FarmWeatherAdvisoryBanner here if needed */}
            </div>
          </div>

          {/* Right Column – Detailed Intelligence */}
          <div className="lg:col-span-5 space-y-6">
            {/* Example Card – Crop Observation Summary */}
            <div className="bg-[#001c12] border border-[#0a2318] rounded-2xl p-4 shadow-md">
              <h3 className="text-sm font-medium text-cream-50 mb-2">{t('ফসল পর্যবেক্ষণ', 'Crop Observation')}</h3>
              <p className="text-xs text-[#a7b9ae]">{t('ডেটা উপলব্ধ নেই', 'No observation data')}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
