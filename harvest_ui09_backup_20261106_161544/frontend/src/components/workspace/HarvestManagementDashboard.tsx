// Premium Harvest Management & Actual Yield Tracking Dashboard (Phase F5E-3)
// Strictly connects to authenticated Harvest APIs, tracks physical provenance,
// enforces non-destructive workflow safety, and provides truthful actual yield calculations.

import { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Scale,
  X,
  Check,
  FileText,
  Filter,
  FlaskConical,
  ArrowRight,
} from 'lucide-react';
import { farmApi, cultivationApi, harvestApi } from '../../services/api.ts';
import type {
  FarmProfile,
  FarmCrop,
  CultivationActivity,
  HarvestRecord,
  HarvestRecordCreatePayload,
  HarvestRecordUpdatePayload,
  HarvestQuantitySource,
  HarvestType,
  HarvestSummaryResponse,
} from '../../types/index.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { WorkspaceTab } from './WorkspaceSidebar.tsx';

interface HarvestManagementDashboardProps {
  initialFarmId?: number | null;
  initialCropId?: number | null;
  onNavigateToTab?: (tab: WorkspaceTab, modelId?: string, extraId?: number) => void;
}

const AREA_UNITS = [
  'Bigha',
  'Decimal',
  'Acre',
  'Hectare',
  'Katha',
  'Sq Metre',
  'Sq Ft',
];

export function HarvestManagementDashboard({
  initialFarmId,
  initialCropId,
  onNavigateToTab,
}: HarvestManagementDashboardProps) {
  const { t } = useLanguage();

  // Farm and Crop State
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId || null);
  const [farmCrops, setFarmCrops] = useState<FarmCrop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<number | null>(initialCropId || null);
  const [activities, setActivities] = useState<CultivationActivity[]>([]);

  // Harvest Data State
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [harvestSummary, setHarvestSummary] = useState<HarvestSummaryResponse | null>(null);

  // Loading & Feedback State
  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [savingRecord, setSavingRecord] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtering State
  const [typeFilter, setTypeFilter] = useState<'all' | 'partial' | 'final'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'weighed' | 'farmer_estimated'>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Modals State
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<HarvestRecord | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<HarvestRecord | null>(null);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Form Input States
  const [formFarmId, setFormFarmId] = useState<number | ''>('');
  const [formCropId, setFormCropId] = useState<number | ''>('');
  const [formHarvestDate, setFormHarvestDate] = useState<string>('');
  const [formHarvestLabel, setFormHarvestLabel] = useState<string>('');
  const [formQuantityKg, setFormQuantityKg] = useState<string>('');
  const [formQuantitySource, setFormQuantitySource] = useState<HarvestQuantitySource>('weighed');
  const [formHarvestType, setFormHarvestType] = useState<HarvestType>('partial');
  const [formHarvestedArea, setFormHarvestedArea] = useState<string>('');
  const [formHarvestedAreaUnit, setFormHarvestedAreaUnit] = useState<string>('Bigha');
  const [formActivityId, setFormActivityId] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // 1. Fetch user farms on mount
  useEffect(() => {
    let isMounted = true;
    async function loadFarms() {
      setLoadingFarms(true);
      try {
        const farmList = await farmApi.listFarms();
        if (isMounted) {
          setFarms(farmList);
          if (farmList.length > 0) {
            const targetFarmId = initialFarmId && farmList.some(f => f.id === initialFarmId)
              ? initialFarmId
              : farmList[0].id;
            setSelectedFarmId(targetFarmId);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(t('খামার তালিকা লোড করতে ব্যর্থ হয়েছে।', 'Failed to load farms list.'));
        }
      } finally {
        if (isMounted) setLoadingFarms(false);
      }
    }
    loadFarms();
    return () => { isMounted = false; };
  }, [initialFarmId]);

  // 2. Fetch farm crops & cultivation activities when selectedFarmId changes
  useEffect(() => {
    if (!selectedFarmId) {
      setFarmCrops([]);
      setSelectedCropId(null);
      setActivities([]);
      return;
    }

    let isMounted = true;
    async function loadFarmMetadata() {
      try {
        const [crops, actList] = await Promise.all([
          farmApi.listCropsForFarm(selectedFarmId!),
          cultivationApi.listActivities({ farm_id: selectedFarmId! }).catch(() => [] as CultivationActivity[]),
        ]);
        if (isMounted) {
          setFarmCrops(crops);
          setActivities(actList);
          if (initialCropId && crops.some((c: FarmCrop) => c.id === initialCropId)) {
            setSelectedCropId(initialCropId);
          } else {
            setSelectedCropId(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(t('ফসলের তথ্য লোড করতে ব্যর্থ হয়েছে।', 'Failed to load farm crops.'));
        }
      }
    }
    loadFarmMetadata();
    return () => { isMounted = false; };
  }, [selectedFarmId, initialCropId]);

  // 3. Fetch harvest records and summary
  const fetchHarvestData = async () => {
    if (!selectedFarmId) {
      setHarvestRecords([]);
      setHarvestSummary(null);
      return;
    }

    setLoadingRecords(true);
    setErrorMessage(null);
    try {
      const params: Record<string, any> = { farm_id: selectedFarmId };
      if (selectedCropId) params.crop_id = selectedCropId;
      if (typeFilter !== 'all') params.harvest_type = typeFilter;
      if (sourceFilter !== 'all') params.quantity_source = sourceFilter;
      if (startDateFilter) params.start_date = startDateFilter;
      if (endDateFilter) params.end_date = endDateFilter;

      const [records, summary] = await Promise.all([
        harvestApi.listRecords(params),
        harvestApi.getFarmSummary(selectedFarmId, {
          crop_id: selectedCropId || undefined,
          start_date: startDateFilter || undefined,
          end_date: endDateFilter || undefined,
        }),
      ]);

      setHarvestRecords(records);
      setHarvestSummary(summary);
    } catch (err: any) {
      setErrorMessage(t('ফসল সংগ্রহ সংক্রান্ত তথ্য লোড করা যায়নি।', 'Failed to load harvest data.'));
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchHarvestData();
  }, [selectedFarmId, selectedCropId, typeFilter, sourceFilter, startDateFilter, endDateFilter]);

  // Current selected farm object
  const selectedFarm = useMemo(() => {
    return farms.find(f => f.id === selectedFarmId) || null;
  }, [farms, selectedFarmId]);

  // Open modal for Create
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setFormFarmId(selectedFarmId || (farms.length > 0 ? farms[0].id : ''));
    setFormCropId(selectedCropId || (farmCrops.length > 0 ? farmCrops[0].id : ''));
    setFormHarvestDate(new Date().toISOString().split('T')[0]);
    setFormHarvestLabel('');
    setFormQuantityKg('');
    setFormQuantitySource('weighed');
    setFormHarvestType('partial');
    setFormHarvestedArea('');
    setFormHarvestedAreaUnit(selectedFarm?.area_unit || 'Bigha');
    setFormActivityId('');
    setFormNotes('');
    setFormValidationError(null);
    setShowAddEditModal(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (rec: HarvestRecord) => {
    setEditingRecord(rec);
    setFormFarmId(rec.farm_id);
    setFormCropId(rec.crop_id);
    setFormHarvestDate(rec.harvest_date);
    setFormHarvestLabel(rec.harvest_label);
    setFormQuantityKg(String(rec.measured_quantity_kg));
    setFormQuantitySource(rec.quantity_source);
    setFormHarvestType(rec.harvest_type);
    setFormHarvestedArea(rec.harvested_area ? String(rec.harvested_area) : '');
    setFormHarvestedAreaUnit(rec.harvested_area_unit || selectedFarm?.area_unit || 'Bigha');
    setFormActivityId(rec.cultivation_activity_id ? String(rec.cultivation_activity_id) : '');
    setFormNotes(rec.farmer_notes || '');
    setFormValidationError(null);
    setShowAddEditModal(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationError(null);

    if (!formFarmId) {
      setFormValidationError(t('খামার নির্বাচন করুন।', 'Please select a farm.'));
      return;
    }
    if (!formCropId) {
      setFormValidationError(t('ফসল নির্বাচন করুন।', 'Please select a crop parcel.'));
      return;
    }
    if (!formHarvestLabel.trim()) {
      setFormValidationError(t('কর্তন লটের নাম বা লেবেল লিখুন।', 'Please enter a harvest label.'));
      return;
    }
    const qty = parseFloat(formQuantityKg);
    if (isNaN(qty) || qty <= 0) {
      setFormValidationError(t('সংগৃহীত ফসল পরিমাণ অবশ্যই শূন্যের বেশি হতে হবে।', 'Quantity must be a positive number.'));
      return;
    }

    let parsedArea: number | null = null;
    if (formHarvestedArea.trim()) {
      parsedArea = parseFloat(formHarvestedArea);
      if (isNaN(parsedArea) || parsedArea <= 0) {
        setFormValidationError(t('জমির ক্ষেত্রফল অবশ্যই ধনাত্মক সংখ্যা হতে হবে।', 'Harvested area must be a positive number.'));
        return;
      }
    }

    setSavingRecord(true);
    try {
      if (editingRecord) {
        const updatePayload: HarvestRecordUpdatePayload = {
          harvest_date: formHarvestDate,
          harvest_label: formHarvestLabel.trim(),
          measured_quantity_kg: qty,
          quantity_source: formQuantitySource,
          harvest_type: formHarvestType,
          harvested_area: parsedArea,
          harvested_area_unit: parsedArea ? formHarvestedAreaUnit : null,
          cultivation_activity_id: formActivityId ? Number(formActivityId) : null,
          farmer_notes: formNotes.trim() || null,
        };
        await harvestApi.updateRecord(editingRecord.id, updatePayload);
        setSuccessMessage(t('ফসল কর্তন রেকর্ড সফলভাবে হালনাগাদ করা হয়েছে।', 'Harvest record updated successfully.'));
      } else {
        const createPayload: HarvestRecordCreatePayload = {
          farm_id: Number(formFarmId),
          crop_id: Number(formCropId),
          harvest_date: formHarvestDate,
          harvest_label: formHarvestLabel.trim(),
          measured_quantity_kg: qty,
          quantity_source: formQuantitySource,
          harvest_type: formHarvestType,
          harvested_area: parsedArea,
          harvested_area_unit: parsedArea ? formHarvestedAreaUnit : null,
          cultivation_activity_id: formActivityId ? Number(formActivityId) : null,
          farmer_notes: formNotes.trim() || null,
        };
        await harvestApi.createRecord(createPayload);
        setSuccessMessage(t('নতুন ফসল কর্তন রেকর্ড সফলভাবে সংরক্ষিত হয়েছে।', 'New harvest record saved successfully.'));
      }

      setShowAddEditModal(false);
      await fetchHarvestData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setFormValidationError(
          t(
            'একই খামার, ফসল, তারিখ এবং পরিমাণের একটি রেকর্ড ইতিমধ্যে বিদ্যমান! অনুগ্রহ করে ভিন্ন লেবেল ব্যবহার করুন।',
            'An identical record already exists for this farm, crop, date, and quantity. Please use a distinct label.'
          )
        );
      } else {
        setFormValidationError(
          err.response?.data?.detail || t('সংরক্ষণে ত্রুটি দেখা দিয়েছে।', 'Failed to save harvest record.')
        );
      }
    } finally {
      setSavingRecord(false);
    }
  };

  // Delete Record Execution
  const handleDeleteRecord = async () => {
    if (!confirmDeleteRecord) return;
    setSavingRecord(true);
    try {
      await harvestApi.deleteRecord(confirmDeleteRecord.id);
      setSuccessMessage(t('রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।', 'Record deleted successfully.'));
      setConfirmDeleteRecord(null);
      await fetchHarvestData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(t('রেকর্ড মুছে ফেলা যায়নি।', 'Failed to delete harvest record.'));
    } finally {
      setSavingRecord(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCropId(null);
    setTypeFilter('all');
    setSourceFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  return (
    <div className="space-y-6 animate-fade-in-up" data-testid="harvest-management-dashboard">
      {/* 1. Header Banner & Farm Selector */}
      <div className="bg-forest-900/95 rounded-3xl p-6 sm:p-8 border border-forest-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-forest-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-800/80 border border-forest-700 text-xs text-sage-300 mb-3">
              <PackageCheck className="w-3.5 h-3.5 text-gold-400" />
              <span>{t('প্রকৃত ফসল সংগ্রহ ও ফলন ট্র্যাকিং', 'Actual Harvest & Yield Tracking')}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-bengali tracking-tight">
              {t('ফসল সংগ্রহ ও ফলন ব্যবস্থাপনা', 'Harvest Management & Actual Yield')}
            </h1>
            <p className="text-sm text-sage-300 font-bengali mt-1 max-w-2xl leading-relaxed">
              {t(
                'আপনার খামারে উৎপাদিত ফসলের সঠিক ওজন ও কর্তন তারিখ সংরক্ষণ করুন। স্ব-প্রতিবেদিত প্রকৃত পরিমাপের ভিত্তিতে হেক্টর প্রতি নির্ভরযোগ্য ফলন পর্যবেক্ষণ করুন।',
                'Track actual measured harvest quantities and harvest dates across your farm parcels with transparent yield metrics.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchHarvestData()}
              disabled={loadingRecords}
              className="p-3 rounded-2xl bg-forest-800/80 border border-forest-700 text-sage-300 hover:text-white hover:bg-forest-700/80 transition-all shadow-sm"
              title={t('রিফ্রেশ করুন', 'Refresh')}
            >
              <RefreshCw className={`w-5 h-5 ${loadingRecords ? 'animate-spin text-gold-400' : ''}`} />
            </button>

            <button
              onClick={handleOpenAddModal}
              disabled={!selectedFarmId || loadingFarms}
              data-testid="add-harvest-btn"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-forest-600 hover:from-emerald-500 hover:to-forest-500 text-white font-semibold shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/50 transition-all font-bengali disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5 text-gold-300" />
              <span>{t('+ নতুন ফসল কর্তন রেকর্ড', '+ Add Harvest Record')}</span>
            </button>
          </div>
        </div>

        {/* Farm & Crop Selection Toolbar */}
        <div className="mt-6 pt-6 border-t border-forest-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-sage-400 font-bengali mb-1.5">
              {t('খামার নির্বাচন করুন', 'Select Farm Profile')}
            </label>
            <select
              value={selectedFarmId || ''}
              onChange={(e) => setSelectedFarmId(Number(e.target.value))}
              disabled={loadingFarms || farms.length === 0}
              data-testid="harvest-farm-select"
              className="w-full bg-forest-800/90 border border-forest-700 text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali disabled:opacity-50"
            >
              {farms.length === 0 ? (
                <option value="">{t('কোনো খামার পাওয়া যায়নি', 'No farms available')}</option>
              ) : (
                farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name} ({farm.upazila}, {farm.district}) — {farm.area} {farm.area_unit}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-sage-400 font-bengali mb-1.5">
              {t('নির্দিষ্ট ফসল পার্সেল', 'Filter Crop Parcel')}
            </label>
            <select
              value={selectedCropId || ''}
              onChange={(e) => setSelectedCropId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingFarms || farmCrops.length === 0}
              data-testid="harvest-crop-select"
              className="w-full bg-forest-800/90 border border-forest-700 text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bengali disabled:opacity-50"
            >
              <option value="">{t('সব ফসল (All Crops)', 'All Crops on Farm')}</option>
              {farmCrops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.crop_name} {c.variety ? `(${c.variety})` : ''} - {c.season}
                </option>
              ))}
            </select>
          </div>

          {selectedFarm && (
            <div className="flex items-center gap-3 bg-forest-800/50 rounded-2xl p-3 border border-forest-700/60 text-xs text-sage-300">
              <Layers className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="font-semibold text-white font-bengali block">{selectedFarm.name}</span>
                <span>
                  {selectedFarm.area} {selectedFarm.area_unit} • {farmCrops.length} {t('টি ফসল চাষাধীন', 'Crops')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-800/60 text-emerald-200 flex items-center gap-3 font-bengali animate-fade-in shadow-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-800/60 text-rose-200 flex items-center gap-3 font-bengali animate-fade-in shadow-md">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="harvest-summary-cards">
        {/* Card 1: Total Recorded Quantity */}
        <div className="bg-forest-900/90 rounded-3xl p-5 border border-forest-800 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-sage-400 uppercase tracking-wider font-bengali">
              {t('মোট সংগৃহীত ফসল', 'Total Harvested')}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {harvestSummary ? harvestSummary.total_measured_quantity_kg.toLocaleString() : '0'}
            </span>
            <span className="text-xs text-sage-300 font-bengali font-bold">কেজি (kg)</span>
          </div>
          <p className="text-xs text-sage-400 font-bengali mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {harvestSummary && harvestSummary.total_records_count > 0
              ? `${harvestSummary.total_records_count} ${t('টি লট রেকর্ডভুক্ত', 'recorded lots')}`
              : t('তথ্য পাওয়া যায়নি', 'No data recorded')}
          </p>
        </div>

        {/* Card 2: Partial vs Final Harvests */}
        <div className="bg-forest-900/90 rounded-3xl p-5 border border-forest-800 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-sage-400 uppercase tracking-wider font-bengali">
              {t('কর্তনের ধরন', 'Harvest Types')}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-sage-300 font-bengali">{t('আংশিক কর্তন:', 'Partial:')}</span>
              <span className="text-white font-semibold">
                {harvestSummary ? `${harvestSummary.partial_quantity_kg} কেজি (${harvestSummary.partial_harvests_count}টি)` : '০'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-sage-300 font-bengali">{t('চূড়ান্ত কর্তন:', 'Final:')}</span>
              <span className="text-gold-300 font-semibold">
                {harvestSummary ? `${harvestSummary.final_quantity_kg} কেজি (${harvestSummary.final_harvests_count}টি)` : '০'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-sage-400 font-bengali mt-2 pt-2 border-t border-forest-800">
            {harvestSummary?.latest_harvest_date
              ? `${t('সর্বশেষ কর্তন:', 'Latest:')} ${harvestSummary.latest_harvest_date}`
              : t('তথ্য পাওয়া যায়নি', 'No date on record')}
          </p>
        </div>

        {/* Card 3: Measurement Provenance */}
        <div className="bg-forest-900/90 rounded-3xl p-5 border border-forest-800 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-sage-400 uppercase tracking-wider font-bengali">
              {t('পরিমাপের উৎস', 'Measurement Source')}
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-emerald-400 font-bengali flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {t('ওজনকৃত:', 'Weighed:')}
              </span>
              <span className="text-white font-semibold">
                {harvestSummary ? `${harvestSummary.weighed_quantity_kg} কেজি` : '০'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-amber-400 font-bengali flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {t('আনুমানিক:', 'Estimated:')}
              </span>
              <span className="text-white font-semibold">
                {harvestSummary ? `${harvestSummary.farmer_estimated_quantity_kg} কেজি` : '০'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-sage-400 font-bengali mt-2 pt-2 border-t border-forest-800">
            {t('ডিজিটাল স্কেল ও কৃষকের প্রাক্কলন পৃথক সংরক্ষিত', 'Weighed & estimated tracked separately')}
          </p>
        </div>

        {/* Card 4: Defensible Actual Yield per Hectare */}
        <div className="bg-forest-900/90 rounded-3xl p-5 border border-forest-800 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-sage-400 uppercase tracking-wider font-bengali">
              {t('প্রকৃত ফলন হার', 'Actual Yield Rate')}
            </span>
            <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          {harvestSummary?.overall_yield_metric?.calculation_status === 'calculated' ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-gold-300">
                  {harvestSummary.overall_yield_metric.yield_t_ha}
                </span>
                <span className="text-xs text-sage-300 font-bengali font-bold">টন/হেক্টর (t/ha)</span>
              </div>
              <p className="text-xs text-sage-300 font-bengali mt-1">
                ≈ {harvestSummary.overall_yield_metric.yield_kg_decimal} কেজি/শতক
              </p>
              <div className="mt-2 text-[10px] text-sage-400 font-bengali border-t border-forest-800 pt-1.5">
                {t('জমির পরিমাপ:', 'Plot Area:')} {harvestSummary.overall_yield_metric.harvested_area_display}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-lg font-bold text-sage-400 font-bengali block">
                {t('তথ্য পাওয়া যায়নি', 'Not Available')}
              </span>
              <p className="text-[11px] text-sage-400 font-bengali mt-1">
                {harvestSummary?.overall_yield_metric?.disclaimer_bn ||
                  t('নির্দিষ্ট ফসলের জমির পরিমাপ প্রয়োজন।', 'Requires single crop with plot area.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2.5 Regional Yield AI Research Navigation Banner (Phase F5E-4A) */}
      <div
        className="bg-forest-900/70 rounded-3xl p-5 border border-forest-800/80 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        data-testid="regional-yield-research-banner"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-gold-500/10 text-gold-400 border border-gold-500/20 shrink-0 mt-0.5">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm font-bengali">
                {t('গবেষণামূলক আঞ্চলিক ফলন পূর্বাভাস (AI রিসার্চ)', 'Regional Yield Research Forecast (AI Model)')}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30">
                {t('গবেষণামূলক', 'Research Only')}
              </span>
            </div>
            <p className="text-xs text-sage-300 font-bengali mt-1 max-w-2xl leading-relaxed">
              {t(
                'এই ড্যাশবোর্ডে শুধুমাত্র কৃষকের নিজস্ব প্রকৃত ফসল সংগ্রহের তথ্য রেকর্ড ও প্রদর্শিত হয়। স্যাটেলাইট এনডিভিআই ও আঞ্চলিক জলবায়ু উপাত্তভিত্তিক ম্যাক্রো পূর্বাভাস অন্বেষণ করতে আমাদের এআই রিসার্চ কনসোলে যান।',
                'This dashboard exclusively tracks actual farmer-reported harvest quantities. To explore macro-level satellite NDVI & climate yield forecasts, visit the AI Research Console.'
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="goto-regional-yield-btn"
          onClick={() => onNavigateToTab?.('tools', 'regional_crop_yield')}
          className="px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-cream-50 text-xs font-semibold font-bengali border border-forest-700 hover:border-gold-500/40 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
        >
          <span>{t('আঞ্চলিক এআই মডেল দেখুন', 'Explore Regional AI Model')}</span>
          <ArrowRight className="w-4 h-4 text-gold-400" />
        </button>
      </div>

      {/* 2.6 Historical Market Price Intelligence Banner (Phase F5E-4B) */}
      <div
        className="bg-forest-900/70 rounded-3xl p-5 border border-forest-800/80 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        data-testid="market-price-intelligence-banner"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm font-bengali">
                {t('ঐতিহাসিক পাইকারি বাজারদর ও মূল্য পূর্বাভাস (AI ইন্টেলিজেন্স)', 'Historical Wholesale Price Intelligence (AI Models)')}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {t('পাইকারি বেঞ্চমার্ক', 'Wholesale Benchmark')}
              </span>
            </div>
            <p className="text-xs text-sage-300 font-bengali mt-1 max-w-2xl leading-relaxed">
              {t(
                'ফসল সংগ্রহের প্রকৃত ওজন ও হিসাবের সাথে বাজারদর পূর্বাভাস সম্পূর্ণ পৃথক রাখা হয়েছে। টমেটো ও বোরো ধানের ঐতিহাসিক পাইকারি দাম এবং তুলনামূলক বেসলাইন বিশ্লেষণ দেখতে মার্কেট প্রাইস টুলে যান।',
                'Actual harvest yields remain strictly separated from market price forecasts. Visit the Market Price tool to analyze historical wholesale benchmarks and baseline comparisons for Tomato and Boro Rice.'
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="goto-market-price-btn"
          onClick={() => onNavigateToTab?.('tools', 'tomato_price')}
          className="px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-cream-50 text-xs font-semibold font-bengali border border-forest-700 hover:border-amber-500/40 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
        >
          <span>{t('বাজারদর অ্যানালিটিক্স দেখুন', 'View Market Intelligence')}</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </button>
      </div>

      {/* 3. Chronological Harvest Trend Chart */}
      {harvestRecords.length > 0 && (
        <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-xl" data-testid="harvest-trend-chart">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-white font-bengali flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>{t('ফসল সংগ্রহ ক্রম ও পরিমাণ চার্ট', 'Harvest Chronology & Quantity Trend')}</span>
              </h2>
              <p className="text-xs text-sage-400 font-bengali mt-0.5">
                {t(
                  'সংগৃহীত প্রতিটি লটের ওজন (কেজি) এবং পরিমাপের ধরন',
                  'Actual recorded lot quantities in kilograms and provenance type'
                )}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-bengali text-sage-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                {t('ওজনকৃত (Weighed)', 'Weighed')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" />
                {t('আনুমানিক (Estimated)', 'Estimated')}
              </span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-44 w-full flex items-end gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-forest-800/80 overflow-x-auto">
            {(() => {
              const sorted = [...harvestRecords].reverse(); // chronological
              const maxQty = Math.max(...sorted.map(r => r.measured_quantity_kg), 10);
              return sorted.map((rec) => {
                const heightPct = Math.max(12, Math.round((rec.measured_quantity_kg / maxQty) * 100));
                const isWeighed = rec.quantity_source === 'weighed';
                return (
                  <div
                    key={rec.id}
                    className="flex-1 min-w-[50px] max-w-[80px] flex flex-col items-center gap-1.5 group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-forest-950 border border-forest-700 text-white text-[11px] px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg font-bengali">
                      {rec.harvest_label}: {rec.measured_quantity_kg} kg ({isWeighed ? t('ওজনকৃত', 'Weighed') : t('আনুমানিক', 'Estimated')})
                    </div>

                    <span className="text-[10px] font-mono text-sage-300 font-semibold group-hover:text-gold-300">
                      {rec.measured_quantity_kg}
                    </span>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-xl transition-all duration-300 shadow-md ${
                        isWeighed
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300'
                          : 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-amber-300'
                      }`}
                    />

                    <span className="text-[10px] text-sage-400 font-mono truncate w-full text-center">
                      {rec.harvest_date.slice(5)}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 4. Filter Bar */}
      <div className="bg-forest-900/90 rounded-2xl p-4 border border-forest-800 shadow-md flex flex-wrap items-center justify-between gap-4" data-testid="harvest-filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-sage-400 font-bengali">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('ফিল্টার:', 'Filter:')}</span>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-forest-800 border border-forest-700 text-xs text-white rounded-xl px-3 py-1.5 font-bengali focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">{t('সকল কর্তন ধরন', 'All Harvest Types')}</option>
            <option value="partial">{t('শুধুমাত্র আংশিক কর্তন', 'Partial Only')}</option>
            <option value="final">{t('শুধুমাত্র চূড়ান্ত কর্তন', 'Final Only')}</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="bg-forest-800 border border-forest-700 text-xs text-white rounded-xl px-3 py-1.5 font-bengali focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">{t('সকল পরিমাপ উৎস', 'All Sources')}</option>
            <option value="weighed">{t('তুলাদণ্ডে ওজনকৃত', 'Weighed')}</option>
            <option value="farmer_estimated">{t('কৃষকের আনুমানিক', 'Farmer Estimated')}</option>
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="bg-forest-800 border border-forest-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            title={t('শুরুর তারিখ', 'Start Date')}
          />

          {/* End Date */}
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="bg-forest-800 border border-forest-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            title={t('শেষ তারিখ', 'End Date')}
          />
        </div>

        {(selectedCropId || typeFilter !== 'all' || sourceFilter !== 'all' || startDateFilter || endDateFilter) && (
          <button
            onClick={handleResetFilters}
            className="text-xs text-gold-300 hover:text-gold-200 font-bengali underline cursor-pointer"
          >
            {t('ফিল্টার রিসেট করুন', 'Reset Filters')}
          </button>
        )}
      </div>

      {/* 5. Harvest Records Table */}
      <div className="bg-forest-900/90 rounded-3xl border border-forest-800 shadow-xl overflow-hidden" data-testid="harvest-records-table">
        <div className="p-6 border-b border-forest-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-bengali flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>{t('ফসল কর্তনের ইতিহাস ও লট তালিকা', 'Harvest Records History & Log')}</span>
            </h2>
            <p className="text-xs text-sage-400 font-bengali mt-0.5">
              {t(
                'সংরক্ষিত প্রতিটি ফসল কর্তনের বিস্তারিত তথ্য, ওজন এবং পরিমাপের প্রমাণাদি',
                'Detailed history of each harvest batch with measured weight and provenance'
              )}
            </p>
          </div>
          <span className="text-xs font-mono text-sage-400 bg-forest-800 px-3 py-1 rounded-full border border-forest-700">
            {harvestRecords.length} {t('টি রেকর্ড', 'Records')}
          </span>
        </div>

        {loadingRecords ? (
          <div className="p-12 text-center text-sage-400 font-bengali flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-gold-400" />
            <span>{t('রেকর্ডসমূহ লোড হচ্ছে...', 'Loading harvest records...')}</span>
          </div>
        ) : harvestRecords.length === 0 ? (
          <div className="p-12 text-center text-sage-400 font-bengali" data-testid="harvest-empty-state">
            <PackageCheck className="w-12 h-12 text-forest-700 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">
              {t('এখনও কোনো ফসল সংগ্রহ বা কর্তনের তথ্য সংরক্ষণ করা হয়নি', 'No harvest records saved yet')}
            </h3>
            <p className="text-xs text-sage-400 max-w-md mx-auto mb-5">
              {t(
                'আপনার নির্বাচিত খামার ও ফসলের জন্য প্রথম কর্তন বা ফসল তোলার তথ্য যোগ করুন।',
                'Record the first harvest batch for your selected farm parcel.'
              )}
            </p>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all font-bengali"
            >
              <Plus className="w-4 h-4 text-gold-300" />
              <span>{t('+ প্রথম রেকর্ড যুক্ত করুন', '+ Add First Record')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bengali">
              <thead className="bg-forest-950/60 text-sage-400 text-[11px] uppercase tracking-wider border-b border-forest-800">
                <tr>
                  <th className="px-6 py-4">{t('তারিখ', 'Date')}</th>
                  <th className="px-6 py-4">{t('লেবেল ও ফসল', 'Label & Crop')}</th>
                  <th className="px-6 py-4">{t('কর্তনের ধরন', 'Harvest Type')}</th>
                  <th className="px-6 py-4">{t('পরিমাণ (কেজি)', 'Quantity (kg)')}</th>
                  <th className="px-6 py-4">{t('কর্তনকৃত জমি', 'Harvested Area')}</th>
                  <th className="px-6 py-4">{t('নোট ও বিবরণ', 'Notes')}</th>
                  <th className="px-6 py-4 text-right">{t('অ্যাকশন', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-800/60">
                {harvestRecords.map((r) => {
                  const isWeighed = r.quantity_source === 'weighed';
                  const isFinal = r.harvest_type === 'final';
                  return (
                    <tr key={r.id} className="hover:bg-forest-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-sage-300 whitespace-nowrap">
                        {r.harvest_date}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-white block text-sm">{r.harvest_label}</span>
                        <span className="text-[11px] text-sage-400">
                          {r.crop_name} {r.crop_variety ? `(${r.crop_variety})` : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isFinal
                              ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isFinal ? t('চূড়ান্ত কর্তন', 'Final') : t('আংশিক কর্তন', 'Partial')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-extrabold text-white font-mono">
                            {r.measured_quantity_kg.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-sage-400">কেজি</span>
                        </div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-medium ${
                            isWeighed ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isWeighed ? t('✓ তুলাদণ্ডে ওজনকৃত', '✓ Weighed') : t('⚠ কৃষকের প্রাক্কলন', '⚠ Estimated')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sage-300">
                        {r.harvested_area ? (
                          <span>
                            {r.harvested_area} {r.harvested_area_unit}
                          </span>
                        ) : (
                          <span className="text-sage-500 italic">{t('তথ্য পাওয়া যায়নি', 'N/A')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sage-300 max-w-xs truncate">
                        {r.farmer_notes || <span className="text-sage-500 italic">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            data-testid={`edit-harvest-btn-${r.id}`}
                            className="p-2 rounded-xl bg-forest-800 text-sage-300 hover:text-white hover:bg-forest-700 transition-all"
                            title={t('সম্পাদনা', 'Edit')}
                          >
                            <Edit3 className="w-4 h-4 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteRecord(r)}
                            data-testid={`delete-harvest-btn-${r.id}`}
                            className="p-2 rounded-xl bg-forest-800 text-sage-300 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
                            title={t('মুছে ফেলুন', 'Delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Add / Edit Modal */}
      {showAddEditModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          data-testid="harvest-modal"
        >
          <div className="bg-forest-900 border border-forest-700 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-forest-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-bengali">
                    {editingRecord
                      ? t('ফসল কর্তন রেকর্ড সম্পাদনা', 'Edit Harvest Record')
                      : t('নতুন ফসল কর্তন যোগ করুন', 'Add Harvest Record')}
                  </h3>
                  <p className="text-xs text-sage-400 font-bengali">
                    {t('প্রকৃত কর্তন তথ্য ও ওজন লিপিবদ্ধ করুন', 'Record measured harvest quantity and plot details')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="text-sage-400 hover:text-white p-2 rounded-xl bg-forest-800/80 hover:bg-forest-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formValidationError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs font-bengali flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4 font-bengali text-xs">
              {/* Farm & Crop Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('খামার *', 'Farm Profile *')}
                  </label>
                  <select
                    value={formFarmId}
                    onChange={(e) => setFormFarmId(Number(e.target.value))}
                    disabled={!!editingRecord}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('ফসল পার্সেল *', 'Crop Parcel *')}
                  </label>
                  <select
                    value={formCropId}
                    onChange={(e) => setFormCropId(Number(e.target.value))}
                    disabled={!!editingRecord}
                    data-testid="form-crop-select"
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    {farmCrops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.crop_name} {c.variety ? `(${c.variety})` : ''} - {c.season}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Batch Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('কর্তনের তারিখ *', 'Harvest Date *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={formHarvestDate}
                    onChange={(e) => setFormHarvestDate(e.target.value)}
                    data-testid="form-harvest-date"
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('কর্তন লট লেবেল *', 'Harvest Batch Label *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('উদা: ১ম তোলা, বোরো ধান কর্তন - লট ১', 'e.g. 1st Picking, Main Lot')}
                    value={formHarvestLabel}
                    onChange={(e) => setFormHarvestLabel(e.target.value)}
                    data-testid="form-harvest-label"
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Quantity (kg) & Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('সংগৃহীত পরিমাণ (কেজি) *', 'Measured Quantity (kg) *')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="0.0"
                    value={formQuantityKg}
                    onChange={(e) => setFormQuantityKg(e.target.value)}
                    data-testid="form-harvest-quantity"
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('পরিমাপের উৎস *', 'Quantity Source *')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormQuantitySource('weighed')}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                        formQuantitySource === 'weighed'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                          : 'bg-forest-800 border-forest-700 text-sage-400 hover:text-white'
                      }`}
                    >
                      {t('ওজনকৃত', 'Weighed')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormQuantitySource('farmer_estimated')}
                      className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                        formQuantitySource === 'farmer_estimated'
                          ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                          : 'bg-forest-800 border-forest-700 text-sage-400 hover:text-white'
                      }`}
                    >
                      {t('আনুমানিক', 'Estimated')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Harvest Type */}
              <div>
                <label className="block font-semibold text-sage-300 mb-1.5">
                  {t('কর্তনের ধরন *', 'Harvest Stage Type *')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      formHarvestType === 'partial'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-forest-800/80 border-forest-700 text-sage-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="harvest_type"
                      checked={formHarvestType === 'partial'}
                      onChange={() => setFormHarvestType('partial')}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold block">{t('আংশিক কর্তন', 'Partial Harvest')}</span>
                      <span className="text-[10px] text-sage-400 block">
                        {t('পরবর্তীতে আরও কর্তন করা হবে', 'Crop will produce further harvests')}
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      formHarvestType === 'final'
                        ? 'bg-gold-600/20 border-gold-500 text-white'
                        : 'bg-forest-800/80 border-forest-700 text-sage-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="harvest_type"
                      checked={formHarvestType === 'final'}
                      onChange={() => setFormHarvestType('final')}
                      className="text-gold-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold block text-gold-300">{t('চূড়ান্ত কর্তন', 'Final Harvest')}</span>
                      <span className="text-[10px] text-sage-400 block">
                        {t('ফসলের মৌসুম সমাপ্ত', 'Last batch for this crop')}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Optional Harvested Area & Unit */}
              <div className="p-4 rounded-2xl bg-forest-950/50 border border-forest-800">
                <span className="block font-semibold text-sage-300 mb-2">
                  {t('ঐচ্ছিক: কর্তনকৃত জমির পরিমাণ (ফলন হিসাবের জন্য)', 'Optional: Harvested Area (for Yield Calculation)')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={t('জমির ক্ষেত্রফল (উদা: ১.৫)', 'Area e.g. 1.5')}
                      value={formHarvestedArea}
                      onChange={(e) => setFormHarvestedArea(e.target.value)}
                      data-testid="form-harvest-area"
                      className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <select
                      value={formHarvestedAreaUnit}
                      onChange={(e) => setFormHarvestedAreaUnit(e.target.value)}
                      className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      {AREA_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Optional Cultivation Activity Link */}
              {activities.length > 0 && (
                <div>
                  <label className="block font-semibold text-sage-300 mb-1.5">
                    {t('সংশ্লিষ্ট মাঠ কার্যক্রম (ঐচ্ছিক)', 'Related Cultivation Activity (Optional)')}
                  </label>
                  <select
                    value={formActivityId}
                    onChange={(e) => setFormActivityId(e.target.value)}
                    className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">{t('কোনো কার্যক্রম লিঙ্ক নেই', 'None')}</option>
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.activity_date} — {a.title} ({a.activity_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Farmer Notes */}
              <div>
                <label className="block font-semibold text-sage-300 mb-1.5">
                  {t('কৃষকের মন্তব্য বা মাঠ নোট (ঐচ্ছিক)', 'Farmer Notes (Optional)')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('গুণগত মান, আর্দ্রতা বা বাজারজাতকরণের মন্তব্য...', 'Notes on grain quality, moisture, etc.')}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-forest-800 border border-forest-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-forest-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-sage-300 hover:text-white transition-all"
                >
                  {t('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingRecord}
                  data-testid="submit-harvest-btn"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {savingRecord ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-gold-300" />
                  ) : (
                    <Check className="w-4 h-4 text-gold-300" />
                  )}
                  <span>{editingRecord ? t('হালনাগাদ সংরক্ষণ', 'Update Record') : t('সংরক্ষণ করুন', 'Save Record')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Dialog */}
      {confirmDeleteRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="delete-confirm-modal"
        >
          <div className="bg-forest-900 border border-forest-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-fade-in font-bengali">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {t('ফসল কর্তন রেকর্ড মুছে ফেলবেন?', 'Delete Harvest Record?')}
            </h3>
            <p className="text-xs text-sage-300 leading-relaxed mb-4">
              {t(
                `আপনি কি নিশ্চিতভাবে "${confirmDeleteRecord.harvest_label}" (${confirmDeleteRecord.measured_quantity_kg} কেজি) রেকর্ডটি মুছে ফেলতে চান? এই পরিবর্তনটি অপরিবর্তনীয়।`,
                `Are you sure you want to delete this harvest record? This action cannot be undone.`
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteRecord(null)}
                className="px-4 py-2 rounded-xl bg-forest-800 text-sage-300 hover:text-white transition-all text-xs"
              >
                {t('বাতিল', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={savingRecord}
                data-testid="confirm-delete-btn"
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition-all"
              >
                {savingRecord ? t('মুছে ফেলা হচ্ছে...', 'Deleting...') : t('হ্যাঁ, মুছে ফেলুন', 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
