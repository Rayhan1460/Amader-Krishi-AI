import { useState, useEffect, useMemo, useCallback } from 'react';

import {

  Sprout,

  Eye,

  Calendar as CalendarIcon,

  Plus,

  Trash2,

  Edit3,

  AlertTriangle,

  CheckCircle2,

  RefreshCw,

  Info,

  ChevronDown,

  X,

  Droplets,

  Layers,

  Wrench,

  Filter,

  ShieldCheck,

  CalendarCheck,

  Sparkles,

  Activity,

  UploadCloud,

  Image as ImageIcon,

} from 'lucide-react';

import { farmApi, calendarApi, cultivationApi, predictionApi, getErrorMessage } from '../../services/api.ts';

import type {

  FarmProfile,

  FarmCrop,

  CalendarTask,

  CultivationActivity,

  CultivationActivityCreatePayload,

  CultivationActivityUpdatePayload,

  CultivationActivityType,

  CultivationActivityStatus,

  CropObservation,

  CropObservationCreatePayload,

  CropObservationUpdatePayload,

  CropObservationCondition,

  CultivationTimelineItem,

  CropDiseaseModelSupport,

  PredictionResponse,

} from '../../types/index.ts';

import { useLanguage } from '../../context/LanguageContext.tsx';

import { useAuth } from '../../context/AuthContext.tsx';

import type { WorkspaceTab } from './WorkspaceSidebar.tsx';



interface CropMonitoringDashboardProps {

  initialFarmId?: number | null;

  initialCropId?: number | null;

  onNavigateToTab?: (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => void;

  onOpenCalendar?: () => void;

}



const ACTIVITY_TYPES: { id: CultivationActivityType; labelBn: string; labelEn: string; icon: any; color: string }[] = [

  { id: 'land_preparation', labelBn: 'জমি প্রস্তুতি ও চাষ', labelEn: 'Land Preparation', icon: Sprout, color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },

  { id: 'sowing', labelBn: 'বীজ বপন / চারা রোপণ', labelEn: 'Sowing / Transplanting', icon: Sprout, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },

  { id: 'irrigation', labelBn: 'সেচ ও পানি ব্যবস্থাপনা', labelEn: 'Irrigation & Water', icon: Droplets, color: 'text-sky-400 bg-sky-400/10 border-sky-400/30' },

  { id: 'nutrient_management', labelBn: 'সার ও পুষ্টি প্রয়োগ', labelEn: 'Nutrient & Fertilizer', icon: Layers, color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },

  { id: 'crop_inspection', labelBn: 'মাঠ ও ফসল পরিদর্শন', labelEn: 'Crop Inspection', icon: Eye, color: 'text-teal-400 bg-teal-400/10 border-teal-400/30' },

  { id: 'field_maintenance', labelBn: 'আগাছা পরিষ্কার ও পরিচর্যা', labelEn: 'Field Maintenance', icon: Wrench, color: 'text-sage-300 bg-sage-400/10 border-sage-400/30' },

  { id: 'harvest', labelBn: 'ফসল কর্তন ও সংগ্রহ', labelEn: 'Harvest & Collection', icon: Sparkles, color: 'text-gold-400 bg-gold-400/10 border-gold-400/30' },

  { id: 'other', labelBn: 'অন্যান্য খামার কাজ', labelEn: 'Other Activity', icon: CalendarIcon, color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },

];



const ACTIVITY_STATUSES: { id: CultivationActivityStatus; labelBn: string; labelEn: string; color: string }[] = [

  { id: 'completed', labelBn: 'সম্পন্ন', labelEn: 'Completed', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },

  { id: 'in_progress', labelBn: 'চলমান', labelEn: 'In Progress', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },

  { id: 'planned', labelBn: 'পরিকল্পিত', labelEn: 'Planned', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },

  { id: 'cancelled', labelBn: 'বাতিল', labelEn: 'Cancelled', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },

];



const OBSERVATION_CONDITIONS: { id: CropObservationCondition; labelBn: string; labelEn: string; color: string; icon: any }[] = [

  { id: 'healthy', labelBn: 'সুস্থ ও স্বাভাবিক', labelEn: 'Healthy & Normal', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: CheckCircle2 },

  { id: 'minor_issue', labelBn: 'সামান্য লক্ষণ / সমস্যা', labelEn: 'Minor Issue', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: AlertTriangle },

  { id: 'moderate_issue', labelBn: 'মাঝারি লক্ষণ / পরিচর্যা প্রয়োজন', labelEn: 'Moderate Issue', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', icon: AlertTriangle },

  { id: 'severe_issue', labelBn: 'মারাত্মক লক্ষণ / আশু ব্যবস্থা', labelEn: 'Severe Issue', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: AlertTriangle },

  { id: 'unknown', labelBn: 'অস্পষ্ট / পর্যবেক্ষণাধীন', labelEn: 'Unknown / Monitoring', color: 'bg-gray-500/20 text-gray-300 border-gray-500/40', icon: Info },

];



function formatDiseaseClassName(raw: string): string {

  if (!raw) return '';

  const clean = raw.replace(/^Tomato___/i, '').replace(/_/g, ' ');

  const BANGLA_MAP: Record<string, string> = {

    'Bacterial spot': 'ব্যাকটেরিয়া ঘটিত দাগ (Bacterial Spot)',

    'Early blight': 'আর্লি ব্লাইট / আগাম ধসা (Early Blight)',

    'Late blight': 'লেইট ব্লাইট / নাবী ধসা (Late Blight)',

    'Leaf Mold': 'পাতার ছত্রাক / লিফ মোল্ড (Leaf Mold)',

    'Septoria leaf spot': 'সেপটোরিয়া পাতার দাগ (Septoria Leaf Spot)',

    'Spider mites Two-spotted spider mite': 'লাল মাকড় আক্রমণ (Spider Mites)',

    'Tomato Yellow Leaf Curl Virus': 'হলুদ পাতা কোঁকড়ানো ভাইরাস (Yellow Leaf Curl Virus)',

    'healthy': 'সুস্থ ও স্বাভাবিক পাতা (Healthy)',

    'Healthy': 'সুস্থ ও স্বাভাবিক পাতা (Healthy)',

    'Insect': 'পোকার আক্রমণ (Insect Damage)',

    'Leaf Scald': 'পাতার ঝলসানো রোগ (Leaf Scald)',

    'Rice Blast': 'ধানের ব্লাস্ট রোগ (Rice Blast)',

    'Rice Leaffolder': 'পাতা মোড়ানো পোকা (Rice Leaffolder)',

    'Rice Stripes': 'ধানের ডোরা দাগ রোগ (Rice Stripes)',

    'Rice Tungro': 'টুংরো ভাইরাস রোগ (Rice Tungro)',

  };

  return BANGLA_MAP[clean] || clean;

}



export function CropMonitoringDashboard({

  initialFarmId,

  initialCropId,

  onNavigateToTab,

  onOpenCalendar,

}: CropMonitoringDashboardProps) {

  const { t } = useLanguage();

  const { isDemo } = useAuth();



  // Primary Selection State

  const [farms, setFarms] = useState<FarmProfile[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId || null);

  const [crops, setCrops] = useState<FarmCrop[]>([]);

  const [selectedCropId, setSelectedCropId] = useState<number | 'all'>(initialCropId || 'all');

  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);



  // Records State

  const [activities, setActivities] = useState<CultivationActivity[]>([]);

  const [observations, setObservations] = useState<CropObservation[]>([]);



  // UI State

  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'activities' | 'observations' | 'disease_analysis'>('timeline');

  const [timelineTypeFilter, setTimelineTypeFilter] = useState<'all' | 'activities' | 'observations'>('all');

  const [filterStartDate, setFilterStartDate] = useState<string>('');

  const [filterEndDate, setFilterEndDate] = useState<string>('');



  // Disease AI State (Phase F5D-3)

  const [diseaseSupport, setDiseaseSupport] = useState<CropDiseaseModelSupport | null>(null);

  const [loadingDiseaseSupport, setLoadingDiseaseSupport] = useState<boolean>(false);

  const [selectedLeafFile, setSelectedLeafFile] = useState<File | null>(null);

  const [leafPreviewUrl, setLeafPreviewUrl] = useState<string | null>(null);

  const [isSyntheticSample, setIsSyntheticSample] = useState<boolean>(false);

  const [isAnalyzingDisease, setIsAnalyzingDisease] = useState<boolean>(false);

  const [diseaseError, setDiseaseError] = useState<string | null>(null);

  const [diseaseResult, setDiseaseResult] = useState<PredictionResponse | null>(null);

  const [showLinkSelector, setShowLinkSelector] = useState<boolean>(false);

  const [selectedObsToLink, setSelectedObsToLink] = useState<number | ''>('');

  const [isLinking, setIsLinking] = useState<boolean>(false);

  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);



  // Loading & Feedback

  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);

  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);



  // Modals

  const [showActivityModal, setShowActivityModal] = useState<boolean>(false);

  const [editingActivity, setEditingActivity] = useState<CultivationActivity | null>(null);

  const [showObservationModal, setShowObservationModal] = useState<boolean>(false);

  const [editingObservation, setEditingObservation] = useState<CropObservation | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'activity' | 'observation'; id: number; title: string } | null>(null);



  // Activity Form Fields

  const [actCropId, setActCropId] = useState<number | ''>('');

  const [actType, setActType] = useState<CultivationActivityType>('irrigation');

  const [actDate, setActDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [actTitle, setActTitle] = useState<string>('');

  const [actStatus, setActStatus] = useState<CultivationActivityStatus>('completed');

  const [actDescription, setActDescription] = useState<string>('');

  const [actFarmerNotes, setActFarmerNotes] = useState<string>('');

  const [actCalendarTaskId, setActCalendarTaskId] = useState<number | ''>('');



  // Observation Form Fields

  const [obsCropId, setObsCropId] = useState<number | ''>('');

  const [obsDate, setObsDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [obsTitle, setObsTitle] = useState<string>('');

  const [obsGrowthStage, setObsGrowthStage] = useState<string>('');

  const [obsCondition, setObsCondition] = useState<CropObservationCondition>('healthy');

  const [obsVisibleSymptoms, setObsVisibleSymptoms] = useState<string>('');

  const [obsGrowthNotes, setObsGrowthNotes] = useState<string>('');

  const [obsActivityId, setObsActivityId] = useState<number | ''>('');

  const [obsPredictionRecordId, setObsPredictionRecordId] = useState<number | null>(null);



  // Form validation errors

  const [formError, setFormError] = useState<string | null>(null);



  // 1. Initial Load: Fetch user farms

  useEffect(() => {

    let isMounted = true;

    async function loadFarms() {

      setLoadingFarms(true);

      try {

        const farmList = await farmApi.listFarms();

        if (isMounted) {

          setFarms(farmList);

          if (farmList.length > 0) {

            const defaultFarmId = initialFarmId && farmList.some(f => f.id === initialFarmId)

              ? initialFarmId

              : farmList[0].id;

            setSelectedFarmId(defaultFarmId);

          }

        }

      } catch (err) {

        if (isMounted) setErrorMessage(getErrorMessage(err));

      } finally {

        if (isMounted) setLoadingFarms(false);

      }

    }

    loadFarms();

    return () => { isMounted = false; };

  }, [initialFarmId]);



  // 2. Fetch Crops, Calendar Tasks, Activities, and Observations when farm changes

  const loadFarmRecords = useCallback(async (farmId: number) => {

    setLoadingRecords(true);

    setErrorMessage(null);

    try {

      const [cropsList, tasksList, actList, obsList] = await Promise.all([

        farmApi.listCropsForFarm(farmId).catch(() => [] as FarmCrop[]),

        calendarApi.listTasks({ farm_id: farmId }).catch(() => [] as CalendarTask[]),

        cultivationApi.listActivities({ farm_id: farmId, limit: 200 }).catch(() => [] as CultivationActivity[]),

        cultivationApi.listObservations({ farm_id: farmId, limit: 200 }).catch(() => [] as CropObservation[]),

      ]);



      setCrops(cropsList);

      setCalendarTasks(tasksList);

      setActivities(actList);

      setObservations(obsList);



      // Verify or default crop selection

      if (initialCropId && cropsList.some((c: FarmCrop) => c.id === initialCropId)) {

        setSelectedCropId(initialCropId);

      } else if (cropsList.length > 0 && selectedCropId !== 'all' && !cropsList.some((c: FarmCrop) => c.id === selectedCropId)) {

        setSelectedCropId('all');

      }

    } catch (err) {

      setErrorMessage(getErrorMessage(err));

    } finally {

      setLoadingRecords(false);

    }

  }, [initialCropId, selectedCropId]);



  useEffect(() => {

    if (selectedFarmId) {

      loadFarmRecords(selectedFarmId);

    } else {

      setCrops([]);

      setCalendarTasks([]);

      setActivities([]);

      setObservations([]);

    }

  }, [selectedFarmId, loadFarmRecords]);



  // 3. Fetch Disease Model Support for Selected Crop (Phase F5D-3)

  useEffect(() => {

    let isMounted = true;

    if (typeof selectedCropId === 'number') {

      setLoadingDiseaseSupport(true);

      setDiseaseError(null);

      cultivationApi.checkCropDiseaseModel(selectedCropId)

        .then((res) => {

          if (isMounted) setDiseaseSupport(res);

        })

        .catch(() => {

          if (isMounted) setDiseaseSupport(null);

        })

        .finally(() => {

          if (isMounted) setLoadingDiseaseSupport(false);

        });

    } else {

      setDiseaseSupport(null);

      setLoadingDiseaseSupport(false);

    }

    return () => { isMounted = false; };

  }, [selectedCropId]);



  // Selected Farm Profile Object

  const selectedFarm = useMemo(() => {

    return farms.find(f => f.id === selectedFarmId) || null;

  }, [farms, selectedFarmId]);



  // Selected Crop Object

  const selectedCrop = useMemo(() => {

    if (selectedCropId === 'all') return null;

    return crops.find(c => c.id === selectedCropId) || null;

  }, [crops, selectedCropId]);



  // Filtered Activities

  const filteredActivities = useMemo(() => {

    return activities.filter(a => {

      if (selectedCropId !== 'all' && a.crop_id !== selectedCropId) return false;

      if (filterStartDate && a.activity_date < filterStartDate) return false;

      if (filterEndDate && a.activity_date > filterEndDate) return false;

      return true;

    });

  }, [activities, selectedCropId, filterStartDate, filterEndDate]);



  // Filtered Observations

  const filteredObservations = useMemo(() => {

    return observations.filter(o => {

      if (selectedCropId !== 'all' && o.crop_id !== selectedCropId) return false;

      if (filterStartDate && o.observation_date < filterStartDate) return false;

      if (filterEndDate && o.observation_date > filterEndDate) return false;

      return true;

    });

  }, [observations, selectedCropId, filterStartDate, filterEndDate]);



  // Unified Chronological Timeline Items

  const timelineItems = useMemo((): CultivationTimelineItem[] => {

    const items: CultivationTimelineItem[] = [];



    if (timelineTypeFilter === 'all' || timelineTypeFilter === 'activities') {

      filteredActivities.forEach(a => {

        items.push({

          id: `act-${a.id}`,

          rawId: a.id,

          type: 'activity',

          date: a.activity_date,

          title: a.title,

          crop_id: a.crop_id,

          crop_name: a.crop_name || crops.find(c => c.id === a.crop_id)?.crop_name,

          farm_id: a.farm_id,

          farm_name: a.farm_name || selectedFarm?.name,

          statusOrCondition: a.status,

          notes: a.farmer_notes || a.description,

          activityType: a.activity_type,

          calendarTaskId: a.calendar_task_id,

          rawActivity: a,

        });

      });

    }



    if (timelineTypeFilter === 'all' || timelineTypeFilter === 'observations') {

      filteredObservations.forEach(o => {

        items.push({

          id: `obs-${o.id}`,

          rawId: o.id,

          type: 'observation',

          date: o.observation_date,

          title: o.title,

          crop_id: o.crop_id,

          crop_name: o.crop_name || crops.find(c => c.id === o.crop_id)?.crop_name,

          farm_id: o.farm_id,

          farm_name: o.farm_name || selectedFarm?.name,

          statusOrCondition: o.farmer_reported_condition,

          notes: o.growth_notes,

          growthStage: o.plant_growth_stage,

          visibleSymptoms: o.visible_symptoms,

          rawObservation: o,

        });

      });

    }



    // Sort descending by date, then by raw ID

    return items.sort((a, b) => {

      if (b.date !== a.date) return b.date.localeCompare(a.date);

      return b.rawId - a.rawId;

    });

  }, [filteredActivities, filteredObservations, timelineTypeFilter, crops, selectedFarm]);



  // ---------------------------------------------------------------------------

  // Activity Modal Handlers

  // ---------------------------------------------------------------------------

  const handleOpenAddActivity = () => {

    setEditingActivity(null);

    setActCropId(selectedCropId !== 'all' ? selectedCropId : (crops[0]?.id || ''));

    setActType('irrigation');

    setActDate(new Date().toISOString().split('T')[0]);

    setActTitle('');

    setActStatus('completed');

    setActDescription('');

    setActFarmerNotes('');

    setActCalendarTaskId('');

    setFormError(null);

    setShowActivityModal(true);

  };



  const handleOpenEditActivity = (act: CultivationActivity) => {

    setEditingActivity(act);

    setActCropId(act.crop_id);

    setActType(act.activity_type as CultivationActivityType);

    setActDate(act.activity_date);

    setActTitle(act.title);

    setActStatus(act.status as CultivationActivityStatus);

    setActDescription(act.description || '');

    setActFarmerNotes(act.farmer_notes || '');

    setActCalendarTaskId(act.calendar_task_id || '');

    setFormError(null);

    setShowActivityModal(true);

  };



  const handleSaveActivity = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!selectedFarmId) {

      setFormError('অনুগ্রহ করে প্রথমে একটি খামার নির্বাচন করুন।');

      return;

    }

    if (!actCropId) {

      setFormError('অনুগ্রহ করে নির্দিষ্ট ফসলের প্লট নির্বাচন করুন।');

      return;

    }

    if (!actTitle.trim()) {

      setFormError('কার্যক্রমের শিরোনাম দেওয়া আবশ্যক।');

      return;

    }

    if (!actDate) {

      setFormError('কার্যক্রম সম্পাদনের তারিখ নির্বাচন করুন।');

      return;

    }



    setSubmitting(true);

    setFormError(null);

    try {

      if (editingActivity) {

        const payload: CultivationActivityUpdatePayload = {

          activity_type: actType,

          activity_date: actDate,

          title: actTitle.trim(),

          description: actDescription.trim() || null,

          farmer_notes: actFarmerNotes.trim() || null,

          status: actStatus,

          calendar_task_id: actCalendarTaskId ? Number(actCalendarTaskId) : null,

        };

        const updated = await cultivationApi.updateActivity(editingActivity.id, payload);

        setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));

        setSuccessMessage(t('চাষাবাদ কার্যক্রম সফলভাবে হালনাগাদ হয়েছে।', 'Activity updated successfully.'));

      } else {

        const payload: CultivationActivityCreatePayload = {

          farm_id: selectedFarmId,

          crop_id: Number(actCropId),

          activity_type: actType,

          activity_date: actDate,

          title: actTitle.trim(),

          description: actDescription.trim() || null,

          farmer_notes: actFarmerNotes.trim() || null,

          status: actStatus,

          calendar_task_id: actCalendarTaskId ? Number(actCalendarTaskId) : null,

        };

        const created = await cultivationApi.createActivity(payload);

        setActivities(prev => [created, ...prev]);

        setSuccessMessage(t('নতুন চাষাবাদ কার্যক্রম সংরক্ষিত হয়েছে।', 'Activity recorded successfully.'));

      }

      setActiveSubTab('activities');

      setShowActivityModal(false);

    } catch (err) {

      setFormError(getErrorMessage(err));

    } finally {

      setSubmitting(false);

    }

  };



  // ---------------------------------------------------------------------------

  // Observation Modal Handlers

  // ---------------------------------------------------------------------------

  const handleOpenAddObservation = () => {

    setEditingObservation(null);

    setObsCropId(selectedCropId !== 'all' ? selectedCropId : (crops[0]?.id || ''));

    setObsDate(new Date().toISOString().split('T')[0]);

    setObsTitle('');

    setObsGrowthStage('');

    setObsCondition('healthy');

    setObsVisibleSymptoms('');

    setObsGrowthNotes('');

    setObsActivityId('');

    setObsPredictionRecordId(null);

    setFormError(null);

    setShowObservationModal(true);

  };



  const handleOpenEditObservation = (obs: CropObservation) => {

    setEditingObservation(obs);

    setObsCropId(obs.crop_id);

    setObsDate(obs.observation_date);

    setObsTitle(obs.title);

    setObsGrowthStage(obs.plant_growth_stage || '');

    setObsCondition(obs.farmer_reported_condition as CropObservationCondition);

    setObsVisibleSymptoms(obs.visible_symptoms || '');

    setObsGrowthNotes(obs.growth_notes || '');

    setObsActivityId(obs.activity_id || '');

    setObsPredictionRecordId(obs.prediction_record_id || null);

    setFormError(null);

    setShowObservationModal(true);

  };



  const handleSaveObservation = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!selectedFarmId) {

      setFormError('অনুগ্রহ করে প্রথমে একটি খামার নির্বাচন করুন।');

      return;

    }

    if (!obsCropId) {

      setFormError('অনুগ্রহ করে নির্দিষ্ট ফসলের প্লট নির্বাচন করুন।');

      return;

    }

    if (!obsTitle.trim()) {

      setFormError('পর্যবেক্ষণের শিরোনাম দেওয়া আবশ্যক।');

      return;

    }

    if (!obsDate) {

      setFormError('মাঠ পরিদর্শনের তারিখ নির্বাচন করুন।');

      return;

    }



    setSubmitting(true);

    setFormError(null);

    try {

      if (editingObservation) {

        const payload: CropObservationUpdatePayload = {

          observation_date: obsDate,

          title: obsTitle.trim(),

          plant_growth_stage: obsGrowthStage.trim() || null,

          growth_notes: obsGrowthNotes.trim() || null,

          visible_symptoms: obsVisibleSymptoms.trim() || null,

          farmer_reported_condition: obsCondition,

          activity_id: obsActivityId ? Number(obsActivityId) : null,

          prediction_record_id: obsPredictionRecordId ? Number(obsPredictionRecordId) : null,

        };

        const updated = await cultivationApi.updateObservation(editingObservation.id, payload);

        setObservations(prev => prev.map(o => o.id === updated.id ? updated : o));

        setSuccessMessage(t('মাঠ পর্যবেক্ষণ সফলভাবে হালনাগাদ হয়েছে।', 'Observation updated successfully.'));

      } else {

        const payload: CropObservationCreatePayload = {

          farm_id: selectedFarmId,

          crop_id: Number(obsCropId),

          observation_date: obsDate,

          title: obsTitle.trim(),

          plant_growth_stage: obsGrowthStage.trim() || null,

          growth_notes: obsGrowthNotes.trim() || null,

          visible_symptoms: obsVisibleSymptoms.trim() || null,

          farmer_reported_condition: obsCondition,

          activity_id: obsActivityId ? Number(obsActivityId) : null,

          prediction_record_id: obsPredictionRecordId ? Number(obsPredictionRecordId) : null,

        };

        const created = await cultivationApi.createObservation(payload);

        setObservations(prev => [created, ...prev]);

        setSuccessMessage(t('মাঠ পর্যবেক্ষণ তথ্য সংরক্ষিত হয়েছে।', 'Observation recorded successfully.'));

      }

      setActiveSubTab('observations');

      setShowObservationModal(false);

    } catch (err) {

      setFormError(getErrorMessage(err));

    } finally {

      setSubmitting(false);

    }

  };



  // ---------------------------------------------------------------------------

  // Disease AI Handlers (Phase F5D-3)

  // ---------------------------------------------------------------------------

  const handleLeafFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;



    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {

      setDiseaseError(t('অনুগ্রহ করে একটি বৈধ JPEG, PNG, বা WebP ছবি নির্বাচন করুন।', 'Please select a valid JPEG, PNG, or WebP image.'));

      return;

    }

    if (file.size > 5 * 1024 * 1024) {

      setDiseaseError(t('ছবির আকার সর্বোচ্চ ৫ মেগাবাইট অতিক্রম করেছে।', 'Image exceeds the maximum allowed size of 5 MiB.'));

      return;

    }



    setDiseaseError(null);

    setSelectedLeafFile(file);

    setLeafPreviewUrl(URL.createObjectURL(file));

    setIsSyntheticSample(false);

    setDiseaseResult(null);

    setLinkSuccess(null);

  };



  const handleGenerateSyntheticSample = (modelId: 'tomato_disease_v3' | 'rice_disease') => {

    setDiseaseError(null);

    setDiseaseResult(null);

    setLinkSuccess(null);



    const canvas = document.createElement('canvas');

    canvas.width = 224;

    canvas.height = 224;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;



    // Background

    ctx.fillStyle = modelId === 'tomato_disease_v3' ? '#1f3d2b' : '#1b3b22';

    ctx.fillRect(0, 0, 224, 224);



    if (modelId === 'tomato_disease_v3') {

      // Leaf shape

      ctx.beginPath();

      ctx.ellipse(112, 112, 75, 100, Math.PI / 8, 0, 2 * Math.PI);

      ctx.fillStyle = '#4d7a42';

      ctx.fill();

      ctx.lineWidth = 2;

      ctx.strokeStyle = '#2d5225';

      ctx.stroke();



      // Central vein

      ctx.beginPath();

      ctx.moveTo(112, 20);

      ctx.lineTo(112, 204);

      ctx.strokeStyle = '#2d5225';

      ctx.lineWidth = 3;

      ctx.stroke();



      // Lesions (simulating early blight concentric spots)

      ctx.beginPath();

      ctx.arc(95, 85, 18, 0, 2 * Math.PI);

      ctx.fillStyle = '#5c3920';

      ctx.fill();

      ctx.beginPath();

      ctx.arc(95, 85, 9, 0, 2 * Math.PI);

      ctx.fillStyle = '#2b1b10';

      ctx.fill();

    } else {

      // Rice blade (slender elongated leaf)

      ctx.beginPath();

      ctx.moveTo(112, 10);

      ctx.quadraticCurveTo(145, 112, 112, 214);

      ctx.quadraticCurveTo(80, 112, 112, 10);

      ctx.fillStyle = '#528243';

      ctx.fill();

      ctx.lineWidth = 2;

      ctx.strokeStyle = '#2e5422';

      ctx.stroke();



      // Rice blast diamond-shaped lesions with gray center

      ctx.beginPath();

      ctx.ellipse(112, 90, 10, 24, 0, 0, 2 * Math.PI);

      ctx.fillStyle = '#8c5e32';

      ctx.fill();

      ctx.beginPath();

      ctx.ellipse(112, 90, 5, 14, 0, 0, 2 * Math.PI);

      ctx.fillStyle = '#d1cfc0';

      ctx.fill();

    }



    canvas.toBlob((blob) => {

      if (!blob) return;

      const file = new File(

        [blob],

        'synthetic_research_sample.png',

        { type: 'image/png' }

      );

      setSelectedLeafFile(file);

      setLeafPreviewUrl(URL.createObjectURL(file));

      setIsSyntheticSample(true);

    }, 'image/png');

  };



  const handleResetLeafFile = () => {

    setSelectedLeafFile(null);

    setLeafPreviewUrl(null);

    setIsSyntheticSample(false);

    setDiseaseResult(null);

    setDiseaseError(null);

    setLinkSuccess(null);

    const input = document.getElementById('leaf-upload-input') as HTMLInputElement | null;

    if (input) input.value = '';

  };



  const handleRunDiseaseAnalysis = async () => {

    if (!selectedLeafFile) {

      setDiseaseError(t('অনুগ্রহ করে আক্রান্ত পাতার একটি ছবি আপলোড করুন।', 'Please upload a leaf image to analyze.'));

      return;

    }

    if (!diseaseSupport?.model_id) {

      setDiseaseError(t('এই ফসলের জন্য কোনো সক্রিয় রোগ মডেল পাওয়া যায়নি।', 'No active disease model found for this crop parcel.'));

      return;

    }



    setIsAnalyzingDisease(true);

    setDiseaseError(null);

    setLinkSuccess(null);



    try {

      const res = await predictionApi.predictImage(diseaseSupport.model_id, selectedLeafFile);

      setDiseaseResult(res);

    } catch (err) {

      setDiseaseError(getErrorMessage(err));

    } finally {

      setIsAnalyzingDisease(false);

    }

  };



  const handleConfirmLinkPrediction = async () => {

    if (!selectedObsToLink) {

      setDiseaseError(t('অনুগ্রহ করে একটি পর্যবেক্ষণ নির্বাচন করুন।', 'Please select an observation to link.'));

      return;

    }

    if (!diseaseResult?.record_id) {

      setDiseaseError(t('সংযুক্ত করার জন্য কোনো সংরক্ষিত প্রেডিকশন রেকর্ড পাওয়া যায়নি।', 'No saved prediction record available to link.'));

      return;

    }



    setIsLinking(true);

    setDiseaseError(null);

    try {

      const updated = await cultivationApi.linkPrediction(Number(selectedObsToLink), diseaseResult.record_id);

      setObservations(prev => prev.map(o => o.id === updated.id ? updated : o));

      setLinkSuccess(t(`পর্যবেক্ষণ #${selectedObsToLink} এর সাথে এআই ফলাফল সফলভাবে যুক্ত হয়েছে!`, `AI prediction linked to observation #${selectedObsToLink}!`));

      setShowLinkSelector(false);

      setSelectedObsToLink('');

    } catch (err) {

      setDiseaseError(getErrorMessage(err));

    } finally {

      setIsLinking(false);

    }

  };



  const handleUnlinkPrediction = async (obsId: number) => {

    try {

      const updated = await cultivationApi.unlinkPrediction(obsId);

      setObservations(prev => prev.map(o => o.id === obsId ? updated : o));

      setSuccessMessage(t('পর্যবেক্ষণ থেকে এআই প্রেডিকশন সফলভাবে বিচ্ছিন্ন করা হয়েছে।', 'AI prediction successfully unlinked from observation.'));

    } catch (err) {

      setErrorMessage(getErrorMessage(err));

    }

  };



  const handleCreateObservationWithPrediction = () => {

    if (!diseaseResult?.record_id || !selectedCrop) return;

    setEditingObservation(null);

    setObsCropId(selectedCrop.id);

    setObsDate(new Date().toISOString().split('T')[0]);

    setObsTitle(t(`এআই পাতা রোগ পর্যবেক্ষণ - ${formatDiseaseClassName(diseaseResult.prediction.predicted_class)}`, `AI Leaf Disease Observation - ${diseaseResult.prediction.predicted_class}`));

    setObsGrowthStage('');

    setObsCondition('minor_issue');

    setObsVisibleSymptoms(t(

      `এআই মডেল পূর্বাভাস: ${formatDiseaseClassName(diseaseResult.prediction.predicted_class)} (মডেল স্কোর: ${(diseaseResult.prediction.confidence * 100).toFixed(1)}%)`,

      `AI Model Prediction: ${diseaseResult.prediction.predicted_class} (Score: ${(diseaseResult.prediction.confidence * 100).toFixed(1)}%)`

    ));

    setObsGrowthNotes('');

    setObsActivityId('');

    setObsPredictionRecordId(diseaseResult.record_id);

    setFormError(null);

    setShowObservationModal(true);

  };



  // ---------------------------------------------------------------------------

  // Delete Handler

  // ---------------------------------------------------------------------------

  const handleConfirmDelete = async () => {

    if (!confirmDelete) return;

    setSubmitting(true);

    try {

      if (confirmDelete.type === 'activity') {

        await cultivationApi.deleteActivity(confirmDelete.id);

        setActivities(prev => prev.filter(a => a.id !== confirmDelete.id));

        setSuccessMessage(t('কার্যক্রম রেকর্ড মুছে ফেলা হয়েছে।', 'Activity record deleted.'));

      } else {

        await cultivationApi.deleteObservation(confirmDelete.id);

        setObservations(prev => prev.filter(o => o.id !== confirmDelete.id));

        setSuccessMessage(t('পর্যবেক্ষণ রেকর্ড মুছে ফেলা হয়েছে।', 'Observation record deleted.'));

      }

      setConfirmDelete(null);

    } catch (err) {

      setErrorMessage(getErrorMessage(err));

    } finally {

      setSubmitting(false);

    }

  };



  // Helper to format date in Bangla

  const formatBnDate = (isoDate: string) => {

    if (!isoDate) return '';

    try {

      const [y, m, d] = isoDate.split('-');

      return `${d}/${m}/${y}`;

    } catch {

      return isoDate;

    }

  };



  return (

    <div

      data-testid="crop-monitoring-dashboard"

      className="space-y-6 animate-fade-in-up"

    >

      {/* Top Demo Notification Banner (if active demo mode) */}

      {isDemo && (

        <div

          data-testid="demo-warning-banner"

          className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-xs font-bengali shadow-xs"

        >

          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

          <div className="space-y-0.5">

            <span className="font-bold text-amber-300 block">

              {t('ডেমো অ্যাকাউন্টে পর্যবেক্ষণ সেশন সক্রিয়', 'Ephemeral Demo Session Active')}

            </span>

            <p className="text-amber-200/90 leading-relaxed">

              {t(

                'আপনি একটি সাময়িক ডেমো সেশনে আছেন। এখানে তৈরি করা সকল চাষাবাদ ও পর্যবেক্ষণ রেকর্ড আপনার বর্তমান ব্রাউজার সেশনেই সীমাবদ্ধ থাকবে এবং সেশন শেষে স্বয়ংক্রিয়ভাবে মুছে যাবে। স্থায়ী রেকর্ড সংরক্ষণে প্রকৃত অ্যাকাউন্ট দিয়ে লগইন করুন।',

                'You are currently in an ephemeral guest session. Recorded activities and scouting notes are restricted to this session and will not persist permanently.'

              )}

            </p>

          </div>

        </div>

      )}



      {/* Main Header & Farm Controls */}

      <div className="bg-forest-900/90 rounded-3xl p-6 border border-forest-800 shadow-md">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

          <div>

            <div className="inline-flex items-center gap-2 mb-2">

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">

                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />

                {t('মাঠ পর্যায়ের ফসল পর্যবেক্ষণ ও ট্র্যাকিং', 'Field Monitoring & Cultivation Tracker')}

              </span>

              <span className="text-xs text-sage-400 font-mono">

                {activities.length} {t('কার্যক্রম', 'Activities')} • {observations.length} {t('পর্যবেক্ষণ', 'Observations')}

              </span>

            </div>

            <h1 className="font-bengali font-bold text-2xl text-cream-50 flex items-center gap-3">

              <Eye className="w-6 h-6 text-gold-400" />

              <span>{t('ফসল পর্যবেক্ষণ ও চাষাবাদ সময়রেখা', 'Crop Monitoring & Cultivation Timeline')}</span>

            </h1>

            <p className="font-bengali text-xs text-sage-300 mt-1 max-w-2xl">

              {t(

                'জমির প্রকৃত চাষাবাদ কার্যক্রম লিপিবদ্ধ করুন, ফসলের দৈহিক বৃদ্ধি পর্যবেক্ষণ করুন এবং ক্যালেন্ডার টাস্কের সাথে মাঠের কাজের সরাসরি সংযোগ রাখুন।',

                'Log actual field activities, scout crop growth stages and field symptoms, and maintain a truthful chronological timeline for each crop parcel.'

              )}

            </p>

          </div>



          {/* Quick Action Buttons */}

          <div className="flex flex-wrap items-center gap-2.5">

            {onNavigateToTab && selectedFarmId && (

              <button

                type="button"

                data-testid="open-farm-twin-btn"

                onClick={() => onNavigateToTab('farm_twin', String(selectedFarmId))}

                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest-950/80 hover:bg-forest-800 border border-forest-750 text-sage-200 font-bengali text-xs font-semibold transition-colors cursor-pointer shadow-xs"

              >

                <Activity className="w-3.5 h-3.5 text-sage-400" />

                <span>{t('ফার্ম ডিজিটাল টুইন', 'Farm Digital Twin')}</span>

              </button>

            )}



            {onOpenCalendar && (

              <button

                type="button"

                data-testid="open-calendar-btn"

                onClick={onOpenCalendar}

                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-forest-950/80 hover:bg-forest-800 border border-forest-750 text-sage-200 font-bengali text-xs font-semibold transition-colors cursor-pointer shadow-xs"

              >

                <CalendarIcon className="w-3.5 h-3.5 text-sage-400" />

                <span>{t('কৃষি ক্যালেন্ডার', 'Agri Calendar')}</span>

              </button>

            )}



            {selectedFarmId && crops.length > 0 && (

              <>

                <button

                  type="button"

                  data-testid="add-observation-btn"

                  onClick={handleOpenAddObservation}

                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-750 border border-teal-500/40 text-teal-300 font-bengali text-xs font-bold transition-all shadow-xs cursor-pointer"

                >

                  <Eye className="w-3.5 h-3.5" />

                  <span>{t('+ মাঠ পর্যবেক্ষণ', '+ Field Observation')}</span>

                </button>



                <button

                  type="button"

                  data-testid="add-activity-btn"

                  onClick={handleOpenAddActivity}

                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 via-gold-400 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-forest-950 font-bengali text-xs font-bold transition-all shadow-md cursor-pointer"

                >

                  <Plus className="w-4 h-4 text-forest-950" />

                  <span>{t('+ নতুন কার্যক্রম', '+ Record Activity')}</span>

                </button>

              </>

            )}

          </div>

        </div>



        {/* Farm & Crop Selectors Bar */}

        <div className="mt-6 pt-5 border-t border-forest-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

            {/* Farm Selector */}

            <div className="flex items-center gap-2">

              <span className="text-xs font-bengali font-semibold text-sage-300 whitespace-nowrap">

                {t('খামার:', 'Farm:')}

              </span>

              <div className="relative">

                <select

                  data-testid="farm-selector"

                  value={selectedFarmId || ''}

                  onChange={(e) => {

                    const fid = Number(e.target.value);

                    setSelectedFarmId(fid);

                    setSelectedCropId('all');

                  }}

                  disabled={loadingFarms || farms.length === 0}

                  className="appearance-none px-3.5 py-2 pr-9 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali text-xs font-semibold focus:outline-none focus:border-gold-400/80 transition-colors cursor-pointer"

                >

                  {farms.length === 0 ? (

                    <option value="">{t('কোনো খামার পাওয়া যায়নি', 'No farms found')}</option>

                  ) : (

                    farms.map((f) => (

                      <option key={f.id} value={f.id}>

                        {f.name} ({f.district || f.upazila || t('বাংলাদেশ', 'BD')})

                      </option>

                    ))

                  )}

                </select>

                <ChevronDown className="w-3.5 h-3.5 text-sage-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

              </div>

            </div>



            {/* Crop Parcel Selector */}

            {selectedFarmId && crops.length > 0 && (

              <div className="flex items-center gap-2">

                <span className="text-xs font-bengali font-semibold text-sage-300 whitespace-nowrap">

                  {t('ফসল প্লট:', 'Crop Parcel:')}

                </span>

                <div className="relative">

                  <select

                    data-testid="crop-selector"

                    value={selectedCropId}

                    onChange={(e) => {

                      const val = e.target.value;

                      setSelectedCropId(val === 'all' ? 'all' : Number(val));

                    }}

                    className="appearance-none px-3.5 py-2 pr-9 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali text-xs font-semibold focus:outline-none focus:border-gold-400/80 transition-colors cursor-pointer"

                  >

                    <option value="all">{t('সকল ফসল (একত্রে দেখুন)', 'All Crops (Combined)')}</option>

                    {crops.map((c) => (

                      <option key={c.id} value={c.id}>

                        {c.crop_name} {c.variety ? `(${c.variety})` : ''} • {c.season}

                      </option>

                    ))}

                  </select>

                  <ChevronDown className="w-3.5 h-3.5 text-sage-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                </div>

              </div>

            )}

          </div>



          {/* Quick Refresh Button */}

          {selectedFarmId && (

            <button

              type="button"

              onClick={() => loadFarmRecords(selectedFarmId)}

              disabled={loadingRecords}

              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sage-300 hover:text-cream-50 hover:bg-forest-800 text-xs font-bengali transition-colors cursor-pointer"

              title="তথ্য রিফ্রেশ করুন"

            >

              <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin text-gold-400' : ''}`} />

              <span>{t('রিফ্রেশ', 'Refresh')}</span>

            </button>

          )}

        </div>

      </div>



      {/* Notifications / Feedback Messages */}

      {errorMessage && (

        <div className="rounded-2xl p-4 bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-center justify-between text-xs font-bengali shadow-xs animate-fade-in">

          <div className="flex items-center gap-2.5">

            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />

            <span>{errorMessage}</span>

          </div>

          <button

            type="button"

            onClick={() => setErrorMessage(null)}

            className="text-sage-400 hover:text-cream-100 p-1"

          >

            <X className="w-4 h-4" />

          </button>

        </div>

      )}



      {successMessage && (

        <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center justify-between text-xs font-bengali shadow-xs animate-fade-in">

          <div className="flex items-center gap-2.5">

            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />

            <span>{successMessage}</span>

          </div>

          <button

            type="button"

            onClick={() => setSuccessMessage(null)}

            className="text-sage-400 hover:text-cream-100 p-1"

          >

            <X className="w-4 h-4" />

          </button>

        </div>

      )}



      {/* Active Crop Summary Card (if specific crop is selected) */}

      {selectedCrop && (

        <div

          data-testid="active-crop-summary"

          className="rounded-3xl p-5 bg-forest-900/70 border border-forest-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"

        >

          <div className="flex items-center gap-3.5">

            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">

              <Sprout className="w-5 h-5" />

            </div>

            <div>

              <div className="flex items-center gap-2">

                <h3 className="font-bengali font-bold text-base text-cream-50">

                  {selectedCrop.crop_name}

                </h3>

                {selectedCrop.variety && (

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-forest-800 border border-forest-700 text-gold-300">

                    {selectedCrop.variety}

                  </span>

                )}

                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">

                  {selectedCrop.season || t('চলতি মৌসুম', 'Active Season')}

                </span>

              </div>

              <p className="text-xs text-sage-400 font-bengali mt-0.5">

                {t('রোপণ / বপনের তারিখ:', 'Sowing Date:')} <span className="text-cream-100 font-mono">{formatBnDate(selectedCrop.sowing_date || '')}</span> • {t('স্ট্যাটাস:', 'Status:')} <span className="text-cream-100 font-semibold">{selectedCrop.status}</span>

              </p>

            </div>

          </div>



          <div className="flex items-center gap-3 text-xs font-bengali text-sage-300 border-t md:border-t-0 pt-3 md:pt-0 border-forest-800">

            <div className="bg-forest-950/70 px-3 py-1.5 rounded-xl border border-forest-800 text-center">

              <span className="text-[10px] text-sage-400 block">{t('কার্যক্রম', 'Activities')}</span>

              <span className="font-bold text-sm text-gold-400 font-mono">

                {activities.filter(a => a.crop_id === selectedCrop.id).length}

              </span>

            </div>

            <div className="bg-forest-950/70 px-3 py-1.5 rounded-xl border border-forest-800 text-center">

              <span className="text-[10px] text-sage-400 block">{t('পর্যবেক্ষণ', 'Observations')}</span>

              <span className="font-bold text-sm text-teal-300 font-mono">

                {observations.filter(o => o.crop_id === selectedCrop.id).length}

              </span>

            </div>

            <div className="bg-forest-950/70 px-3 py-1.5 rounded-xl border border-forest-800 text-center">

              <span className="text-[10px] text-sage-400 block">{t('ক্যালেন্ডার কাজ', 'Tasks')}</span>

              <span className="font-bold text-sm text-emerald-300 font-mono">

                {selectedCrop.task_count || 0}

              </span>

            </div>



            {/* Disease Model Status Badge / Shortcut */}

            {diseaseSupport && diseaseSupport.is_supported && (

              <button

                type="button"

                data-testid="crop-disease-shortcut-btn"

                onClick={() => setActiveSubTab('disease_analysis')}

                className="px-3 py-1.5 rounded-xl bg-forest-950/80 hover:bg-forest-800 border border-gold-500/40 text-gold-300 flex items-center gap-1.5 text-xs font-bengali font-semibold transition-all cursor-pointer shadow-xs"

              >

                <Sparkles className="w-3.5 h-3.5 text-gold-400" />

                <span>{t('AI পাতা রোগ বিশ্লেষণ', 'AI Disease Vision')}</span>

              </button>

            )}

            {diseaseSupport && !diseaseSupport.is_supported && (

              <div className="px-3 py-1.5 rounded-xl bg-forest-950/60 border border-sage-800 text-sage-400 flex items-center gap-1 text-[11px] font-bengali">

                <Info className="w-3 h-3 text-sage-500" />

                <span>{t('রোগ এআই নেই', 'No Disease Model')}</span>

              </div>

            )}

          </div>

        </div>

      )}



      {/* Main Sub-Navigation Tabs */}

      <div className="flex items-center justify-between border-b border-forest-800 pb-2">

        <div className="flex items-center gap-2 flex-wrap">

          <button

            type="button"

            data-testid="tab-timeline"

            onClick={() => setActiveSubTab('timeline')}

            className={`px-4 py-2 rounded-xl text-xs font-bengali font-bold transition-all cursor-pointer ${

              activeSubTab === 'timeline'

                ? 'bg-forest-800 text-gold-300 border border-gold-500/40 shadow-xs'

                : 'text-sage-400 hover:text-cream-100 hover:bg-forest-900/60'

            }`}

          >

            {t('সমন্বিত সময়রেখা', 'Unified Timeline')} ({timelineItems.length})

          </button>



          <button

            type="button"

            data-testid="tab-activities"

            onClick={() => setActiveSubTab('activities')}

            className={`px-4 py-2 rounded-xl text-xs font-bengali font-bold transition-all cursor-pointer ${

              activeSubTab === 'activities'

                ? 'bg-forest-800 text-gold-300 border border-gold-500/40 shadow-xs'

                : 'text-sage-400 hover:text-cream-100 hover:bg-forest-900/60'

            }`}

          >

            {t('চাষাবাদ কার্যক্রম', 'Cultivation Activities')} ({filteredActivities.length})

          </button>



          <button

            type="button"

            data-testid="tab-observations"

            onClick={() => setActiveSubTab('observations')}

            className={`px-4 py-2 rounded-xl text-xs font-bengali font-bold transition-all cursor-pointer ${

              activeSubTab === 'observations'

                ? 'bg-forest-800 text-gold-300 border border-gold-500/40 shadow-xs'

                : 'text-sage-400 hover:text-cream-100 hover:bg-forest-900/60'

            }`}

          >

            {t('মাঠ পর্যবেক্ষণ', 'Field Observations')} ({filteredObservations.length})

          </button>



          <button

            type="button"

            data-testid="tab-disease-analysis"

            onClick={() => setActiveSubTab('disease_analysis')}

            className={`px-4 py-2 rounded-xl text-xs font-bengali font-bold transition-all cursor-pointer flex items-center gap-1.5 ${

              activeSubTab === 'disease_analysis'

                ? 'bg-forest-800 text-gold-300 border border-gold-500/40 shadow-xs'

                : 'text-sage-400 hover:text-cream-100 hover:bg-forest-900/60'

            }`}

          >

            <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'disease_analysis' ? 'text-gold-400' : 'text-sage-400'}`} />

            <span>{t('AI পাতা রোগ বিশ্লেষণ', 'AI Disease Vision')}</span>

            {diseaseSupport && diseaseSupport.is_supported && (

              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />

            )}

          </button>

        </div>



        {/* Date Filter Quick Reset */}

        {(filterStartDate || filterEndDate) && (

          <button

            type="button"

            onClick={() => {

              setFilterStartDate('');

              setFilterEndDate('');

            }}

            className="text-[11px] font-bengali text-gold-400 hover:underline cursor-pointer"

          >

            {t('তারিখ ফিল্টার মুছুন', 'Reset Date Filter')}

          </button>

        )}

      </div>



      {/* --------------------------------------------------------------------- */}

      {/* 1. TIMELINE VIEW */}

      {/* --------------------------------------------------------------------- */}

      {activeSubTab === 'timeline' && (

        <div data-testid="timeline-container" className="space-y-4">

          {/* Timeline Filter Toolbar */}

          <div className="p-3.5 rounded-2xl bg-forest-900/60 border border-forest-800 flex flex-wrap items-center justify-between gap-3 text-xs">

            <div className="flex items-center gap-2">

              <Filter className="w-3.5 h-3.5 text-sage-400" />

              <span className="font-bengali font-semibold text-sage-300">{t('ধরণ অনুযায়ী:', 'Type:')}</span>

              <div className="inline-flex rounded-xl bg-forest-950 p-1 border border-forest-800">

                <button

                  type="button"

                  data-testid="timeline-filter-all"

                  onClick={() => setTimelineTypeFilter('all')}

                  className={`px-2.5 py-1 rounded-lg text-xs font-bengali font-semibold transition-colors cursor-pointer ${

                    timelineTypeFilter === 'all'

                      ? 'bg-forest-800 text-cream-50 shadow-xs'

                      : 'text-sage-400 hover:text-cream-100'

                  }`}

                >

                  {t('সব', 'All')}

                </button>

                <button

                  type="button"

                  data-testid="timeline-filter-activities"

                  onClick={() => setTimelineTypeFilter('activities')}

                  className={`px-2.5 py-1 rounded-lg text-xs font-bengali font-semibold transition-colors cursor-pointer ${

                    timelineTypeFilter === 'activities'

                      ? 'bg-forest-800 text-gold-300 shadow-xs'

                      : 'text-sage-400 hover:text-cream-100'

                  }`}

                >

                  {t('কার্যক্রম', 'Activities')}

                </button>

                <button

                  type="button"

                  data-testid="timeline-filter-observations"

                  onClick={() => setTimelineTypeFilter('observations')}

                  className={`px-2.5 py-1 rounded-lg text-xs font-bengali font-semibold transition-colors cursor-pointer ${

                    timelineTypeFilter === 'observations'

                      ? 'bg-forest-800 text-teal-300 shadow-xs'

                      : 'text-sage-400 hover:text-cream-100'

                  }`}

                >

                  {t('পর্যবেক্ষণ', 'Observations')}

                </button>

              </div>

            </div>



            {/* Date Filters */}

            <div className="flex items-center gap-2">

              <span className="font-bengali text-sage-400 text-xs">{t('তারিখ সীমা:', 'Date Range:')}</span>

              <input

                type="date"

                data-testid="timeline-start-date"

                value={filterStartDate}

                onChange={(e) => setFilterStartDate(e.target.value)}

                className="px-2.5 py-1 rounded-lg bg-forest-950 border border-forest-750 text-cream-100 text-xs font-mono focus:outline-none focus:border-gold-400"

              />

              <span className="text-sage-500 font-mono">-</span>

              <input

                type="date"

                data-testid="timeline-end-date"

                value={filterEndDate}

                onChange={(e) => setFilterEndDate(e.target.value)}

                className="px-2.5 py-1 rounded-lg bg-forest-950 border border-forest-750 text-cream-100 text-xs font-mono focus:outline-none focus:border-gold-400"

              />

            </div>

          </div>



          {/* Timeline Stream */}

          {loadingRecords ? (

            <div className="py-12 text-center text-sage-400 font-bengali">

              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-400 mb-2" />

              <p>{t('সময়রেখার তথ্য লোড হচ্ছে...', 'Loading timeline records...')}</p>

            </div>

          ) : timelineItems.length === 0 ? (

            <div className="py-12 px-6 rounded-3xl bg-forest-900/40 border border-dashed border-forest-800 text-center space-y-3">

              <div className="w-12 h-12 rounded-2xl bg-forest-800/80 mx-auto flex items-center justify-center text-sage-400">

                <CalendarIcon className="w-6 h-6" />

              </div>

              <h4 className="font-bengali font-bold text-base text-cream-100">

                {t('কোনো সময়রেখা রেকর্ড নেই', 'No timeline entries recorded')}

              </h4>

              <p className="font-bengali text-xs text-sage-400 max-w-md mx-auto">

                {t(

                  'এই খামার বা ফসলের জন্য এখনো কোনো চাষাবাদ কার্যক্রম বা মাঠ পর্যবেক্ষণ লিপিবদ্ধ করা হয়নি। নতুন কার্যক্রম রেকর্ড করতে উপরের বাটনে ক্লিক করুন।',

                  'No field activities or scouting notes recorded for this farm parcel yet.'

                )}

              </p>

              {crops.length > 0 && (

                <div className="flex items-center justify-center gap-3 pt-2">

                  <button

                    type="button"

                    onClick={handleOpenAddActivity}

                    className="px-3.5 py-2 rounded-xl bg-gold-500 text-forest-950 font-bengali text-xs font-bold hover:bg-gold-400 cursor-pointer"

                  >

                    {t('+ প্রথম কার্যক্রম রেকর্ড করুন', '+ Log First Activity')}

                  </button>

                  <button

                    type="button"

                    onClick={handleOpenAddObservation}

                    className="px-3.5 py-2 rounded-xl bg-forest-800 border border-teal-500/40 text-teal-300 font-bengali text-xs font-bold hover:bg-forest-750 cursor-pointer"

                  >

                    {t('+ প্রথম পর্যবেক্ষণ লিপিবদ্ধ করুন', '+ Log First Observation')}

                  </button>

                </div>

              )}

            </div>

          ) : (

            <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-forest-800/80 before:z-0">

              {timelineItems.map((item) => {

                const isAct = item.type === 'activity';

                const actDef = isAct ? ACTIVITY_TYPES.find(t => t.id === item.activityType) : null;

                const condDef = !isAct ? OBSERVATION_CONDITIONS.find(c => c.id === item.statusOrCondition) : null;

                const statusDef = isAct ? ACTIVITY_STATUSES.find(s => s.id === item.statusOrCondition) : null;



                return (

                  <div

                    key={item.id}

                    data-testid={`timeline-item-${item.id}`}

                    className="relative z-10 pl-11 group"

                  >

                    {/* Node Dot / Icon */}

                    <div

                      className={`absolute left-2.5 top-3.5 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 shadow-xs ${

                        isAct

                          ? 'bg-forest-950 border-gold-400 text-gold-400'

                          : 'bg-forest-950 border-teal-400 text-teal-300'

                      }`}

                    >

                      {isAct ? (

                        <Sprout className="w-2.5 h-2.5" />

                      ) : (

                        <Eye className="w-2.5 h-2.5" />

                      )}

                    </div>



                    {/* Timeline Item Card */}

                    <div className="rounded-2xl p-4 bg-forest-900/90 border border-forest-800/90 hover:border-forest-700 transition-colors shadow-sm">

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="font-mono text-xs text-gold-300 font-semibold bg-forest-950 px-2 py-0.5 rounded-md border border-forest-800">

                            {formatBnDate(item.date)}

                          </span>



                          <span

                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${

                              isAct

                                ? actDef?.color || 'text-gold-300 bg-gold-400/10 border-gold-400/30'

                                : 'text-teal-300 bg-teal-500/10 border-teal-500/30'

                            }`}

                          >

                            {isAct ? (actDef?.labelBn || item.activityType) : t('মাঠ পর্যবেক্ষণ', 'Field Observation')}

                          </span>



                          {item.crop_name && (

                            <span className="text-[11px] font-bengali text-sage-300">

                              • {item.crop_name}

                            </span>

                          )}



                          {item.calendarTaskId && (

                            <span

                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1"

                              title="ক্যালেন্ডার টাস্কের সাথে যুক্ত (টাস্কের স্ট্যাটাস অপরিবর্তিত)"

                            >

                              <CalendarCheck className="w-3 h-3" />

                              <span>{t('টাস্ক লিংকড', 'Task Linked')}</span>

                            </span>

                          )}

                        </div>



                        {/* Status or Condition Badge */}

                        <div className="flex items-center gap-2">

                          {isAct && statusDef && (

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusDef.color}`}>

                              {statusDef.labelBn}

                            </span>

                          )}



                          {!isAct && condDef && (

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${condDef.color}`}>

                              <condDef.icon className="w-3 h-3" />

                              <span>{condDef.labelBn}</span>

                            </span>

                          )}



                          {/* Action Menu */}

                          <div className="flex items-center gap-1">

                            <button

                              type="button"

                              data-testid={`edit-timeline-${item.id}`}

                              onClick={() => {

                                if (isAct && item.rawActivity) handleOpenEditActivity(item.rawActivity);

                                else if (!isAct && item.rawObservation) handleOpenEditObservation(item.rawObservation);

                              }}

                              className="p-1 rounded-lg text-sage-400 hover:text-gold-300 hover:bg-forest-800 transition-colors"

                              title="সম্পাদনা করুন"

                            >

                              <Edit3 className="w-3.5 h-3.5" />

                            </button>

                            <button

                              type="button"

                              data-testid={`delete-timeline-${item.id}`}

                              onClick={() => {

                                setConfirmDelete({

                                  type: item.type,

                                  id: item.rawId,

                                  title: item.title,

                                });

                              }}

                              className="p-1 rounded-lg text-sage-400 hover:text-rose-400 hover:bg-forest-800 transition-colors"

                              title="মুছে ফেলুন"

                            >

                              <Trash2 className="w-3.5 h-3.5" />

                            </button>

                          </div>

                        </div>

                      </div>



                      {/* Title & Content */}

                      <h4 className="font-bengali font-bold text-sm text-cream-100 mt-2">

                        {item.title}

                      </h4>



                      {item.growthStage && (

                        <p className="text-xs text-sage-300 font-bengali mt-1">

                          <span className="text-sage-400 font-semibold">{t('বৃদ্ধির পর্যায়:', 'Growth Stage:')}</span> {item.growthStage}

                        </p>

                      )}



                      {item.visibleSymptoms && (

                        <div className="mt-2 p-2.5 rounded-xl bg-forest-950/70 border border-amber-500/20 text-xs font-bengali text-amber-200/90 leading-relaxed">

                          <span className="font-bold text-amber-300 block mb-0.5">{t('চাক্ষুষ লক্ষণ / নোট:', 'Observed Symptoms:')}</span>

                          {item.visibleSymptoms}

                        </div>

                      )}



                      {item.notes && !item.visibleSymptoms && (

                        <p className="text-xs text-sage-300 font-bengali mt-1 line-clamp-2">

                          {item.notes}

                        </p>

                      )}

                    </div>

                  </div>

                );

              })}

            </div>

          )}

        </div>

      )}



      {/* --------------------------------------------------------------------- */}

      {/* 2. CULTIVATION ACTIVITIES TAB */}

      {/* --------------------------------------------------------------------- */}

      {activeSubTab === 'activities' && (

        <div className="space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            <h3 className="font-bengali font-bold text-base text-cream-50 flex items-center gap-2">

              <Sprout className="w-5 h-5 text-gold-400" />

              <span>{t('চাষাবাদ ও পরিচর্যার কার্যতালিকা', 'Cultivation & Maintenance Operations')}</span>

            </h3>



            {selectedFarmId && crops.length > 0 && (

              <button

                type="button"

                onClick={handleOpenAddActivity}

                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bengali text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"

              >

                <Plus className="w-4 h-4" />

                <span>{t('+ নতুন কার্যক্রম যোগ করুন', '+ Log Activity')}</span>

              </button>

            )}

          </div>



          {filteredActivities.length === 0 ? (

            <div className="py-12 text-center rounded-3xl bg-forest-900/40 border border-dashed border-forest-800 text-sage-400 font-bengali">

              <p>{t('কোনো চাষাবাদ কার্যক্রম পাওয়া যায়নি।', 'No cultivation activities found.')}</p>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {filteredActivities.map((act) => {

                const actDef = ACTIVITY_TYPES.find(t => t.id === act.activity_type);

                const statusDef = ACTIVITY_STATUSES.find(s => s.id === act.status);



                return (

                  <div

                    key={act.id}

                    data-testid={`activity-card-${act.id}`}

                    className="rounded-2xl p-4 bg-forest-900/90 border border-forest-800 hover:border-forest-750 transition-colors shadow-sm flex flex-col justify-between"

                  >

                    <div>

                      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-forest-800/80">

                        <div className="flex items-center gap-2">

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actDef?.color || 'text-gold-300'}`}>

                            {actDef?.labelBn || act.activity_type}

                          </span>

                          <span className="text-[11px] font-bengali text-sage-400">

                            {act.crop_name}

                          </span>

                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusDef?.color || 'text-sage-300'}`}>

                          {statusDef?.labelBn || act.status}

                        </span>

                      </div>



                      <h4 className="font-bengali font-bold text-sm text-cream-100">

                        {act.title}

                      </h4>

                      <p className="font-mono text-xs text-gold-300/80 mt-1">

                        {t('তারিখ:', 'Date:')} {formatBnDate(act.activity_date)}

                      </p>



                      {act.description && (

                        <p className="text-xs text-sage-300 font-bengali mt-2 line-clamp-2">

                          {act.description}

                        </p>

                      )}



                      {act.farmer_notes && (

                        <div className="mt-2.5 p-2 rounded-xl bg-forest-950/60 border border-forest-800 text-[11px] font-bengali text-sage-300">

                          <span className="font-bold text-gold-400/90 block mb-0.5">{t('কৃষকের মাঠ নোট:', 'Farmer Notes:')}</span>

                          {act.farmer_notes}

                        </div>

                      )}

                    </div>



                    <div className="pt-3 mt-3 border-t border-forest-800/80 flex items-center justify-between text-xs">

                      <span className="text-[10px] font-mono text-sage-500">

                        ID: #{act.id} {act.calendar_task_id ? `• Task #${act.calendar_task_id}` : ''}

                      </span>

                      <div className="flex items-center gap-2">

                        <button

                          type="button"

                          data-testid={`edit-activity-btn-${act.id}`}

                          title="সম্পাদনা করুন"

                          onClick={() => handleOpenEditActivity(act)}

                          className="px-2.5 py-1 rounded-lg text-sage-300 hover:text-cream-100 hover:bg-forest-800 font-bengali transition-colors cursor-pointer"

                        >

                          {t('সম্পাদনা', 'Edit')}

                        </button>

                        <button

                          type="button"

                          data-testid={`delete-activity-btn-${act.id}`}

                          title="মুছে ফেলুন"

                          onClick={() => setConfirmDelete({ type: 'activity', id: act.id, title: act.title })}

                          className="px-2.5 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-bengali transition-colors cursor-pointer"

                        >

                          {t('মুছুন', 'Delete')}

                        </button>

                      </div>

                    </div>

                  </div>

                );

              })}

            </div>

          )}

        </div>

      )}



      {/* --------------------------------------------------------------------- */}

      {/* 3. CROP OBSERVATIONS TAB */}

      {/* --------------------------------------------------------------------- */}

      {activeSubTab === 'observations' && (

        <div className="space-y-4">

          {/* Prominent Agronomic Honesty & Observation Banner */}

          <div className="rounded-2xl p-4 bg-teal-500/10 border border-teal-500/30 text-teal-200 text-xs font-bengali flex items-start gap-3 shadow-xs">

            <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />

            <div className="space-y-1">

              <span className="font-bold text-teal-300 block">

                {t('বিজ্ঞানসম্মত মাঠ পর্যবেক্ষণ ও স্বাস্থ্য সতর্কতা', 'Farmer Field Scouting & Observation Policy')}

              </span>

              <p className="text-teal-200/90 leading-relaxed">

                {t(

                  'মাঠ পর্যবেক্ষণ সরাসরি কৃষকের চাক্ষুষ পর্যবেক্ষণ ও অভিজ্ঞতালব্ধ লক্ষণ নির্দেশ করে। এখানে রেকর্ডকৃত "সুস্থ" বা "মারাত্মক সমস্যা" কৃষকের নিজস্ব রেটিং এবং এটি কোনো স্বয়ংক্রিয় এআই রোগ নির্ণয় নয়। লক্ষণ দেখা দিলে উপসহকারী কৃষি কর্মকর্তা বা পরীক্ষাগারের পরামর্শ গ্রহণ করুন।',

                  'Observations reflect direct farmer field scouting notes. These qualitative conditions are farmer-reported, not automated AI disease diagnoses or chemical dosage prescriptions.'

                )}

              </p>

            </div>

          </div>



          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            <h3 className="font-bengali font-bold text-base text-cream-50 flex items-center gap-2">

              <Eye className="w-5 h-5 text-teal-400" />

              <span>{t('মাঠের পর্যবেক্ষণ ও ফসলের লক্ষণ ইতিহাস', 'Crop Scouting & Symptoms History')}</span>

            </h3>



            {selectedFarmId && crops.length > 0 && (

              <button

                type="button"

                onClick={handleOpenAddObservation}

                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-750 border border-teal-500/40 text-teal-300 font-bengali text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"

              >

                <Plus className="w-4 h-4" />

                <span>{t('+ মাঠ পর্যবেক্ষণ যোগ করুন', '+ Log Observation')}</span>

              </button>

            )}

          </div>



          {filteredObservations.length === 0 ? (

            <div className="py-12 text-center rounded-3xl bg-forest-900/40 border border-dashed border-forest-800 text-sage-400 font-bengali">

              <p>{t('কোনো মাঠ পর্যবেক্ষণ পাওয়া যায়নি।', 'No field observations recorded.')}</p>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {filteredObservations.map((obs) => {

                const condDef = OBSERVATION_CONDITIONS.find(c => c.id === obs.farmer_reported_condition);



                return (

                  <div

                    key={obs.id}

                    data-testid={`observation-card-${obs.id}`}

                    className="rounded-2xl p-4 bg-forest-900/90 border border-forest-800 hover:border-forest-750 transition-colors shadow-sm flex flex-col justify-between"

                  >

                    <div>

                      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-forest-800/80">

                        <span className="text-[11px] font-bengali text-sage-300 font-semibold">

                          {obs.crop_name}

                        </span>

                        {condDef && (

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${condDef.color}`}>

                            <condDef.icon className="w-3 h-3" />

                            <span>{condDef.labelBn}</span>

                          </span>

                        )}

                      </div>



                      <h4 className="font-bengali font-bold text-sm text-cream-100">

                        {obs.title}

                      </h4>

                      <p className="font-mono text-xs text-teal-300/90 mt-1">

                        {t('তারিখ:', 'Date:')} {formatBnDate(obs.observation_date)}

                      </p>



                      {obs.plant_growth_stage && (

                        <p className="text-xs text-sage-300 font-bengali mt-2">

                          <span className="text-sage-400 font-semibold">{t('বৃদ্ধির পর্যায়:', 'Growth Stage:')}</span> {obs.plant_growth_stage}

                        </p>

                      )}



                      {obs.visible_symptoms && (

                        <div className="mt-2.5 p-2.5 rounded-xl bg-forest-950/70 border border-amber-500/20 text-xs font-bengali text-amber-200/90 leading-relaxed">

                          <span className="font-bold text-amber-300 block mb-0.5">{t('চাক্ষুষ লক্ষণ / ক্ষতের বিবরণ:', 'Observed Symptoms:')}</span>

                          {obs.visible_symptoms}

                        </div>

                      )}



                      {obs.growth_notes && (

                        <p className="text-xs text-sage-300 font-bengali mt-2 line-clamp-2">

                          {obs.growth_notes}

                        </p>

                      )}



                      {/* Linked AI Disease Prediction (Phase F5D-3) */}

                      {obs.prediction_record_id && (

                        <div

                          data-testid={`linked-prediction-badge-${obs.id}`}

                          className="mt-2.5 p-2.5 rounded-xl bg-forest-950/80 border border-gold-500/30 text-xs font-bengali text-gold-200 flex items-center justify-between gap-2 shadow-xs"

                        >

                          <div className="flex items-center gap-2">

                            <Sparkles className="w-4 h-4 text-gold-400 shrink-0" />

                            <div>

                              <span className="font-semibold text-gold-300 block">

                                {t('সংযুক্ত এআই প্রেডিকশন:', 'Linked AI Vision:')}{' '}

                                <span className="font-mono text-cream-50 font-bold">#{obs.prediction_record_id}</span>

                              </span>

                              {obs.prediction_summary?.predicted_class && (

                                <span className="text-[11px] text-teal-300 font-medium block">

                                  {formatDiseaseClassName(obs.prediction_summary.predicted_class)}

                                  {obs.prediction_summary.confidence !== undefined && obs.prediction_summary.confidence !== null && (

                                    <span className="ml-1 text-sage-400 font-mono text-[10px]">

                                      ({(obs.prediction_summary.confidence * 100).toFixed(1)}%)

                                    </span>

                                  )}

                                </span>

                              )}

                            </div>

                          </div>

                          <button

                            type="button"

                            data-testid={`unlink-prediction-btn-${obs.id}`}

                            title={t('লিংক বিচ্ছিন্ন করুন', 'Unlink Prediction')}

                            onClick={() => handleUnlinkPrediction(obs.id)}

                            className="p-1 rounded-lg text-sage-400 hover:text-rose-400 hover:bg-forest-900 transition-colors cursor-pointer"

                          >

                            <X className="w-3.5 h-3.5" />

                          </button>

                        </div>

                      )}

                    </div>



                    <div className="pt-3 mt-3 border-t border-forest-800/80 flex items-center justify-between text-xs">

                      <span className="text-[10px] font-mono text-sage-500">

                        ID: #{obs.id} • {t('উৎস: কৃষক', 'Source: Farmer')}

                      </span>

                      <div className="flex items-center gap-2">

                        <button

                          type="button"

                          data-testid={`edit-observation-btn-${obs.id}`}

                          title="সম্পাদনা করুন"

                          onClick={() => handleOpenEditObservation(obs)}

                          className="px-2.5 py-1 rounded-lg text-sage-300 hover:text-cream-100 hover:bg-forest-800 font-bengali transition-colors cursor-pointer"

                        >

                          {t('সম্পাদনা', 'Edit')}

                        </button>

                        <button

                          type="button"

                          data-testid={`delete-observation-btn-${obs.id}`}

                          title="মুছে ফেলুন"

                          onClick={() => setConfirmDelete({ type: 'observation', id: obs.id, title: obs.title })}

                          className="px-2.5 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-bengali transition-colors cursor-pointer"

                        >

                          {t('মুছুন', 'Delete')}

                        </button>

                      </div>

                    </div>

                  </div>

                );

              })}

            </div>

          )}

        </div>

      )}



      {/* --------------------------------------------------------------------- */}

      {/* 4. AI LEAF DISEASE ANALYSIS VIEW (Phase F5D-3) */}

      {/* --------------------------------------------------------------------- */}

      {activeSubTab === 'disease_analysis' && (

        <div data-testid="disease-analysis-container" className="space-y-6 animate-fade-in">

          {/* Header Banner */}

          <div className="rounded-3xl p-6 bg-gradient-to-r from-forest-900 via-forest-850 to-forest-900 border border-forest-750 shadow-md">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              <div className="flex items-center gap-3.5">

                <div className="w-12 h-12 rounded-2xl bg-gold-400/10 border border-gold-500/30 flex items-center justify-center text-gold-400 shrink-0">

                  <Sparkles className="w-6 h-6" />

                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <h3 className="font-bengali font-bold text-lg text-cream-50">

                      {t('AI পাতা রোগ বিশ্লেষণ', 'AI Leaf Disease Vision Analysis')}

                    </h3>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gold-500/20 text-gold-300 border border-gold-500/40">

                      {t('গবেষণা মডেল', 'Research Model')}

                    </span>

                  </div>

                  <p className="text-xs text-sage-300 font-bengali mt-0.5">

                    {t(

                      'আক্রান্ত গাছের পাতার ছবি আপলোড করে আসল ডিপ-লার্নিং মডেলের মাধ্যমে লক্ষণ বিশ্লেষণ করুন।',

                      'Upload an affected leaf photo to run inference using the original deep learning vision models.'

                    )}

                  </p>

                </div>

              </div>



              {onNavigateToTab && (

                <button

                  type="button"

                  data-testid="view-history-btn"

                  onClick={() => onNavigateToTab('history')}

                  className="px-3.5 py-2 rounded-xl bg-forest-950/80 hover:bg-forest-800 border border-forest-750 text-sage-300 hover:text-cream-100 text-xs font-bengali font-semibold transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"

                >

                  <Activity className="w-4 h-4 text-gold-400" />

                  <span>{t('প্রেডিকশন ইতিহাস দেখুন', 'Prediction History')}</span>

                </button>

              )}

            </div>

          </div>



          {/* Case A: No specific crop parcel selected */}

          {(!selectedCrop || selectedCropId === 'all') && (

            <div

              data-testid="select-crop-prompt-card"

              className="p-8 rounded-3xl bg-forest-900/60 border border-forest-800 text-center font-bengali space-y-3"

            >

              <Sprout className="w-10 h-10 text-sage-400 mx-auto" />

              <h4 className="font-bold text-base text-cream-100">

                {t('অনুগ্রহ করে একটি নির্দিষ্ট ফসল নির্বাচন করুন', 'Please Select a Specific Crop Parcel')}

              </h4>

              <p className="text-xs text-sage-300 max-w-md mx-auto leading-relaxed">

                {t(

                  'পাতা রোগ নির্ণয় সেবাটি ফসল-নির্দিষ্ট (টমেটো বা ধান)। উপরের ড্রপডাউন থেকে আপনার খামারের একটি নিবন্ধিত ফসল নির্বাচন করুন।',

                  'Foliar disease vision analysis is parcel-specific (Tomato or Rice). Please select a registered crop parcel from the dropdown above.'

                )}

              </p>

            </div>

          )}



          {/* Case B: Crop Selected but Loading Disease Support */}

          {selectedCrop && selectedCropId !== 'all' && loadingDiseaseSupport && (

            <div className="py-12 text-center rounded-3xl bg-forest-900/40 border border-forest-800 text-sage-300 font-bengali flex items-center justify-center gap-2 text-xs">

              <RefreshCw className="w-4 h-4 animate-spin text-gold-400" />

              <span>{t('ফসলের এআই মডেল যাচাই করা হচ্ছে...', 'Checking disease model compatibility...')}</span>

            </div>

          )}



          {/* Case C: Crop Selected and UNSUPPORTED */}

          {selectedCrop && selectedCropId !== 'all' && !loadingDiseaseSupport && diseaseSupport && !diseaseSupport.is_supported && (

            <div

              data-testid="unsupported-crop-card"

              className="p-6 rounded-3xl bg-forest-900/80 border border-amber-500/30 text-amber-200 font-bengali space-y-4 shadow-sm"

            >

              <div className="flex items-start gap-3.5">

                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />

                <div className="space-y-1.5">

                  <h4 className="font-bold text-base text-amber-300">

                    {t('ফসলটি এআই পাতা রোগ মডেলের আওতাভুক্ত নয়', 'Crop Parcel Not Supported by Disease Vision Models')}

                  </h4>

                  <p className="text-xs text-amber-100/90 leading-relaxed">

                    {diseaseSupport.unsupported_reason}

                  </p>

                  <p className="text-xs text-sage-300 leading-relaxed">

                    {t(

                      'আমাদের বিদ্যমান কম্পিউটার ভিশন মডেলগুলো বিশেষভাবে টমেটো ও ধান ফসলের জন্য প্রশিক্ষিত। ভুল রোগ নির্ণয় এড়াতে অন্যান্য ফসলের জন্য স্বয়ংক্রিয় প্রেডিকশন বন্ধ রাখা হয়েছে। আপনি সাধারণ মাঠ পর্যবেক্ষণ হিসেবে লক্ষণগুলো লিখে রাখতে পারেন।',

                      'Our existing computer vision models are specifically trained for Tomato and Rice leaves. To avoid false diagnoses, automated predictions are disabled for other crops. You may still record manual field scouting observations.'

                    )}

                  </p>

                </div>

              </div>



              <div className="pt-3 border-t border-forest-800 flex items-center gap-3">

                <button

                  type="button"

                  data-testid="goto-observations-btn"

                  onClick={() => setActiveSubTab('observations')}

                  className="px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-750 border border-teal-500/40 text-teal-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"

                >

                  <Eye className="w-3.5 h-3.5" />

                  <span>{t('মাঠ পর্যবেক্ষণ নোট লিখুন', 'Write Scouting Observation')}</span>

                </button>

              </div>

            </div>

          )}



          {/* Case D: Crop Selected and SUPPORTED */}

          {selectedCrop && selectedCropId !== 'all' && !loadingDiseaseSupport && diseaseSupport && diseaseSupport.is_supported && (

            <div data-testid="supported-crop-card" className="space-y-6">

              {/* Model & Scope Card */}

              <div data-testid="disease-model-banner" className="p-5 rounded-3xl bg-forest-900/80 border border-forest-800 space-y-3">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">

                  <div className="flex items-center gap-2.5">

                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />

                    <h4 className="font-bengali font-bold text-sm text-cream-100">

                      {diseaseSupport.model_name_bn} ({diseaseSupport.model_name_en})

                    </h4>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-forest-950 border border-forest-700 text-gold-300">

                      {diseaseSupport.model_id}

                    </span>

                  </div>

                  <span className="text-xs font-bengali text-sage-400">

                    {t('আওতাভুক্ত রোগ ও অবস্থা:', 'Supported Conditions:')}{' '}

                    <strong className="text-gold-300 font-mono">{diseaseSupport.supported_classes.length}</strong>

                  </span>

                </div>



                {/* Research Caveat Alert */}

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-xs font-bengali flex items-start gap-2.5">

                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

                  <div className="space-y-1">

                    <span className="font-bold text-amber-300 block">

                      {t('গবেষণামূলক মডেল সংক্রান্ত তথ্য ও মাঠ পর্যায় সীমাবদ্ধতা:', 'Research Checkpoint & Field Domain Limitations:')}

                    </span>

                    <p className="leading-relaxed">

                      {diseaseSupport.field_limitations}

                    </p>

                    <p className="text-[11px] text-amber-300/80">

                      {diseaseSupport.caveat}

                    </p>

                  </div>

                </div>

              </div>



              {/* Upload Dropzone & Controls */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Left: Upload Box */}

                <div className="rounded-3xl p-5 bg-forest-900/90 border border-forest-800 space-y-4">

                  <h4 className="font-bengali font-bold text-sm text-cream-100 flex items-center gap-2">

                    <UploadCloud className="w-4 h-4 text-gold-400" />

                    <span>{t('পাতার ছবি নির্বাচন বা আপলোড করুন', 'Select or Upload Leaf Image')}</span>

                  </h4>



                  {/* Dropzone */}

                  <div data-testid="leaf-image-upload"

                    onClick={() => {

                      const input = document.getElementById('leaf-upload-input');

                      if (input) input.click();

                    }}

                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${

                      selectedLeafFile

                        ? 'border-emerald-500/50 bg-emerald-500/5'

                        : 'border-forest-750 hover:border-gold-500/40 bg-forest-950/60 hover:bg-forest-950/90'

                    }`}

                  >

                    <input

                      id="leaf-upload-input"

                      type="file"

                      data-testid="leaf-image-input"

                      accept="image/jpeg,image/png,image/webp"

                      onChange={handleLeafFileChange}

                      className="hidden"

                    />



                    {selectedLeafFile && leafPreviewUrl ? (

                      <div className="space-y-3">

                        {isSyntheticSample && (

                          <div

                            data-testid="synthetic-sample-badge"

                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bengali font-medium"

                          >

                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />

                            <span>{t('কৃত্রিম ল্যাব নমুনা — মাঠের বাস্তব ফলাফল নয়', 'Synthetic Lab Sample — Not a Field Diagnosis')}</span>

                          </div>

                        )}

                        <img

                          src={leafPreviewUrl}

                          alt="Leaf Preview"

                          data-testid="leaf-image-preview"

                          className="w-44 h-44 object-cover rounded-2xl border border-forest-700 shadow-md mx-auto"

                        />

                        <div className="text-xs font-mono text-sage-300">

                          {selectedLeafFile.name} ({(selectedLeafFile.size / 1024).toFixed(1)} KB)

                        </div>

                        <span className="text-[11px] font-bengali text-gold-400 hover:underline block">

                          {t('অন্য ছবি বাছাই করতে ক্লিক করুন', 'Click to choose different image')}

                        </span>

                      </div>

                    ) : (

                      <div className="space-y-2 py-4">

                        <div className="w-12 h-12 rounded-2xl bg-forest-800/80 border border-forest-700 text-gold-400 flex items-center justify-center mx-auto">

                          <ImageIcon className="w-6 h-6" />

                        </div>

                        <p className="text-xs font-bengali font-semibold text-cream-100">

                          {t('আক্রান্ত পাতার পরিষ্কার ছবি আপলোড করুন', 'Upload clear photo of affected leaf')}

                        </p>

                        <p className="text-[11px] font-bengali text-sage-400">

                          {t('সমর্থিত ফরম্যাট: JPEG, PNG, WebP (সর্বোচ্চ ৫ মেগাবাইট)', 'Supported: JPEG, PNG, WebP (Max 5 MiB)')}

                        </p>

                      </div>

                    )}

                  </div>



                  {/* Synthetic Sample Button for research testing */}

                  <div className="flex items-center justify-between pt-2">

                    <button

                      type="button"

                      data-testid="load-sample-leaf-btn"

                      onClick={() => handleGenerateSyntheticSample(diseaseSupport.model_id!)}

                      className="text-xs font-bengali font-semibold text-gold-400 hover:text-gold-300 hover:underline flex items-center gap-1.5 cursor-pointer"

                    >

                      <Sparkles className="w-3.5 h-3.5" />

                      <span>{t('ডেমো / কৃত্রিম নমুনা পাতা লোড করুন', 'Load Demo / Synthetic Research Sample')}</span>

                    </button>



                    {selectedLeafFile && (

                      <button

                        type="button"

                        onClick={handleResetLeafFile}

                        className="text-xs font-bengali text-rose-400 hover:underline cursor-pointer"

                      >

                        {t('বাতিল', 'Cancel')}

                      </button>

                    )}

                  </div>



                  {diseaseError && (

                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-bengali">

                      {diseaseError}

                    </div>

                  )}



                  {/* Submit Button */}

                  <button

                    type="button"

                    data-testid="start-disease-analysis-btn"

                    disabled={!selectedLeafFile || isAnalyzingDisease}

                    onClick={handleRunDiseaseAnalysis}

                    className={`w-full py-3 rounded-xl font-bengali font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${

                      !selectedLeafFile || isAnalyzingDisease

                        ? 'bg-forest-800 text-sage-500 cursor-not-allowed border border-forest-750'

                        : 'bg-gradient-to-r from-gold-500 via-gold-400 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-forest-950'

                    }`}

                  >

                    {isAnalyzingDisease ? (

                      <>

                        <RefreshCw className="w-4 h-4 animate-spin text-forest-950" />

                        <span>{t('এআই মডেল বিশ্লেষণ করছে...', 'Model Running Inference...')}</span>

                      </>

                    ) : (

                      <>

                        <Sparkles className="w-4 h-4 text-forest-950" />

                        <span>{t('এআই রোগ বিশ্লেষণ শুরু করুন', 'Start AI Disease Analysis')}</span>

                      </>

                    )}

                  </button>

                </div>



                {/* Right: Results or Instructions */}

                <div className="space-y-4">

                  {diseaseResult ? (

                    <div

                      data-testid="disease-result-card"

                      className="rounded-3xl p-5 bg-forest-900/90 border border-forest-750 shadow-md space-y-4 animate-fade-in"

                    >

                      <div className="flex items-center justify-between pb-3 border-b border-forest-800">

                        <div className="flex items-center gap-2">

                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />

                          <h4 className="font-bengali font-bold text-sm text-cream-50">

                            {t('বিশ্লেষণ ফলাফল', 'Inference Analysis Output')}

                          </h4>

                        </div>

                        <span className="text-[11px] font-mono text-sage-400">

                          #{diseaseResult.record_id || 'unlogged'}

                        </span>

                      </div>



                      {isSyntheticSample && (

                        <div

                          data-testid="result-synthetic-warning"

                          className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bengali flex items-center gap-2"

                        >

                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />

                          <span>{t('কৃত্রিম ল্যাব নমুনা — মাঠের বাস্তব ফলাফল নয়', 'Synthetic Lab Sample — Not a Field Diagnosis')}</span>

                        </div>

                      )}



                      {/* Top Diagnosis */}

                      <div className="p-4 rounded-2xl bg-forest-950/80 border border-forest-800 space-y-2">

                        <span className="text-[11px] font-bengali text-sage-400 font-semibold block">

                          {t('সম্ভাব্য প্রাথমিক রোগ / অবস্থা:', 'Top Predicted Diagnosis:')}

                        </span>

                        <div className="flex flex-wrap items-center justify-between gap-2">

                          <h3 className="font-bengali font-bold text-base text-gold-300">

                            {formatDiseaseClassName(diseaseResult.prediction.predicted_class)}

                          </h3>

                          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-gold-400/10 border border-gold-400/30 text-gold-300">

                            {t('মডেল স্কোর (Uncalibrated):', 'Score (Uncalibrated):')}{' '}

                            {(diseaseResult.prediction.confidence * 100).toFixed(1)}%

                          </span>

                        </div>

                        <p className="text-[10px] font-mono text-sage-500">

                          Class: {diseaseResult.prediction.predicted_class}

                        </p>

                      </div>



                      {/* Class Probabilities Distribution */}

                      {diseaseResult.prediction.class_probabilities && (

                        <div className="space-y-2 pt-1">

                          <span className="text-xs font-bengali font-semibold text-sage-300 block">

                            {t('সম্ভাবনা বিন্যাস (Class Probabilities):', 'Class Probabilities Breakdown:')}

                          </span>

                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">

                            {Object.entries(diseaseResult.prediction.class_probabilities)

                              .sort(([, a], [, b]) => (b as number) - (a as number))

                              .map(([cls, prob]) => {

                                const p = prob as number;

                                const isTop = cls === diseaseResult.prediction.predicted_class;

                                return (

                                  <div key={cls} className="space-y-0.5">

                                    <div className="flex items-center justify-between text-[11px] font-bengali">

                                      <span className={isTop ? 'font-bold text-cream-100' : 'text-sage-400'}>

                                        {formatDiseaseClassName(cls)}

                                      </span>

                                      <span className="font-mono text-[10px] text-sage-400">

                                        {(p * 100).toFixed(1)}%

                                      </span>

                                    </div>

                                    <div className="w-full h-1.5 rounded-full bg-forest-950 overflow-hidden">

                                      <div

                                        className={`h-full rounded-full ${

                                          isTop ? 'bg-gold-400' : 'bg-forest-700'

                                        }`}

                                        style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}

                                      />

                                    </div>

                                  </div>

                                );

                              })}

                          </div>

                        </div>

                      )}



                      {/* Scientific Honesty Notice */}

                      <div className="p-3 rounded-xl bg-forest-950 border border-forest-800 text-[11px] font-bengali text-sage-300 leading-relaxed">

                        <span className="font-semibold text-gold-400/90 block mb-0.5">

                          {t('বৈজ্ঞানিক সততা ও সতর্কতা:', 'Scientific Honesty & Disclaimer:')}

                        </span>

                        {t(

                          'এটি পরীক্ষামূলক এআই মডেলের পূর্বাভাস, কোনো আনুষ্ঠানিক কৃষি চিকিৎসাপত্র নয়। সুস্থ দেখালেও উদ্ভিদে সুপ্ত রোগ থাকতে পারে। কোনো রাসায়নিক কীটনাশক প্রয়োগের পূর্বে স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।',

                          'This is an experimental research model output, not clinical advice. Healthy classification does not guarantee the plant is disease-free. Consult your local agricultural officer before applying chemicals.'

                        )}

                      </div>



                      {/* Link to Observation Actions */}

                      <div className="pt-3 border-t border-forest-800 space-y-3">

                        {linkSuccess && (

                          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bengali">

                            {linkSuccess}

                          </div>

                        )}



                        <div className="flex flex-wrap items-center gap-2">

                          <button

                            type="button"

                            data-testid="link-to-observation-btn"

                            onClick={() => setShowLinkSelector(!showLinkSelector)}

                            className="px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-750 border border-teal-500/40 text-teal-300 font-bengali font-semibold text-xs transition-colors cursor-pointer"

                          >

                            <Eye className="w-3.5 h-3.5" />

                            <span>{t('মাঠ পর্যবেক্ষণের সাথে যুক্ত করুন', 'Link to Observation')}</span>

                          </button>



                          <button

                            type="button"

                            data-testid="create-observation-with-pred-btn"

                            onClick={handleCreateObservationWithPrediction}

                            className="px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-750 border border-forest-700 text-cream-100 font-bengali font-semibold text-xs transition-colors cursor-pointer"

                          >

                            <Plus className="w-3.5 h-3.5 text-gold-400" />

                            <span>{t('নতুন পর্যবেক্ষণে সংরক্ষণ', 'Save as New Observation')}</span>

                          </button>

                        </div>



                        {/* Inline Observation Linker */}

                        {showLinkSelector && (

                          <div className="p-3.5 rounded-2xl bg-forest-950 border border-forest-800 space-y-2.5 font-bengali text-xs">

                            <label className="block text-sage-300 font-semibold">

                              {t('বিদ্যমান পর্যবেক্ষণ নির্বাচন করুন:', 'Select Existing Observation:')}

                            </label>

                            <div className="flex items-center gap-2">

                              <select

                                data-testid="link-observation-select"

                                value={selectedObsToLink}

                                onChange={(e) => setSelectedObsToLink(Number(e.target.value))}

                                className="flex-1 px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-100 focus:outline-none focus:border-teal-400"

                              >

                                <option value="">{t('পর্যবেক্ষণ বেছে নিন...', 'Choose observation...')}</option>

                                {observations

                                  .filter((o) => o.crop_id === selectedCrop.id)

                                  .map((o) => (

                                    <option key={o.id} value={o.id}>

                                      #{o.id} - {o.title} ({formatBnDate(o.observation_date)})

                                    </option>

                                  ))}

                              </select>

                              <button

                                type="button"

                                data-testid="confirm-link-btn"

                                disabled={!selectedObsToLink || isLinking}

                                onClick={handleConfirmLinkPrediction}

                                className={`px-3 py-2 rounded-xl font-bold transition-all cursor-pointer ${

                                  !selectedObsToLink || isLinking

                                    ? 'bg-forest-800 text-sage-500 cursor-not-allowed'

                                    : 'bg-teal-500 hover:bg-teal-400 text-forest-950'

                                }`}

                              >

                                {isLinking ? t('যুক্ত হচ্ছে...', 'Linking...') : t('সংযুক্ত করুন', 'Link')}

                              </button>

                            </div>

                          </div>

                        )}

                      </div>

                    </div>

                  ) : (

                    /* Blank state placeholder */

                    <div className="h-full rounded-3xl p-6 bg-forest-900/40 border border-dashed border-forest-800 text-center flex flex-col items-center justify-center font-bengali space-y-2 text-sage-400">

                      <Sparkles className="w-8 h-8 text-forest-750" />

                      <p className="text-xs font-semibold text-sage-300">

                        {t('কোনো ফলাফল প্রদর্শিত হয়নি', 'No analysis output yet')}

                      </p>

                      <p className="text-[11px] max-w-xs text-sage-400">

                        {t(

                          'বামে পাতার ছবি আপলোড করে বা গবেষণা টেস্ট পাতা লোড করে "এআই রোগ বিশ্লেষণ শুরু করুন" চাপুন।',

                          'Upload a leaf photo on the left or load a research test leaf and click "Start AI Disease Analysis".'

                        )}

                      </p>

                    </div>

                  )}

                </div>

              </div>

            </div>

          )}

        </div>

      )}



      {/* --------------------------------------------------------------------- */}

      {/* ACTIVITY MODAL (Add / Edit) */}

      {/* --------------------------------------------------------------------- */}

      {showActivityModal && (

        <div

          data-testid="activity-modal"

          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/80 backdrop-blur-sm animate-fade-in"

        >

          <div className="bg-forest-900 border border-forest-750 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between pb-4 border-b border-forest-800">

              <h3 className="font-bengali font-bold text-lg text-cream-50 flex items-center gap-2">

                <Sprout className="w-5 h-5 text-gold-400" />

                <span>

                  {editingActivity

                    ? t('চাষাবাদ কার্যক্রম সম্পাদনা', 'Edit Cultivation Activity')

                    : t('নতুন চাষাবাদ কার্যক্রম রেকর্ড', 'Record Cultivation Activity')}

                </span>

              </h3>

              <button

                type="button"

                onClick={() => setShowActivityModal(false)}

                className="text-sage-400 hover:text-cream-50 p-1.5 rounded-lg hover:bg-forest-800"

              >

                <X className="w-5 h-5" />

              </button>

            </div>



            {formError && (

              <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-bengali">

                {formError}

              </div>

            )}



            <form onSubmit={handleSaveActivity} className="space-y-4 mt-4 text-xs font-bengali">

              {/* Crop Parcel Select */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('ফসলের প্লট *', 'Crop Parcel *')}

                </label>

                <select

                  data-testid="activity-crop-select"

                  value={actCropId}

                  onChange={(e) => setActCropId(Number(e.target.value))}

                  required

                  className="w-full px-3.5 py-2.5 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-gold-400"

                >

                  <option value="">{t('ফসল নির্বাচন করুন', 'Select Crop')}</option>

                  {crops.map((c) => (

                    <option key={c.id} value={c.id}>

                      {c.crop_name} {c.variety ? `(${c.variety})` : ''} • {c.season}

                    </option>

                  ))}

                </select>

              </div>



              {/* Activity Category & Status Row */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div>

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('কার্যক্রমের ধরণ *', 'Activity Type *')}

                  </label>

                  <select

                    data-testid="activity-type-select"

                    value={actType}

                    onChange={(e) => setActType(e.target.value as CultivationActivityType)}

                    className="w-full px-3.5 py-2.5 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-gold-400"

                  >

                    {ACTIVITY_TYPES.map((t) => (

                      <option key={t.id} value={t.id}>

                        {t.labelBn}

                      </option>

                    ))}

                  </select>

                </div>



                <div>

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('অগ্রগতির অবস্থা *', 'Status *')}

                  </label>

                  <select

                    data-testid="activity-status-select"

                    value={actStatus}

                    onChange={(e) => setActStatus(e.target.value as CultivationActivityStatus)}

                    className="w-full px-3.5 py-2.5 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-gold-400"

                  >

                    {ACTIVITY_STATUSES.map((s) => (

                      <option key={s.id} value={s.id}>

                        {s.labelBn}

                      </option>

                    ))}

                  </select>

                </div>

              </div>



              {/* Date & Title Row */}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div>

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('তারিখ *', 'Date *')}

                  </label>

                  <input

                    type="date"

                    data-testid="activity-date-input"

                    value={actDate}

                    onChange={(e) => setActDate(e.target.value)}

                    required

                    className="w-full px-3 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-mono focus:outline-none focus:border-gold-400"

                  />

                </div>



                <div className="sm:col-span-2">

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('কার্যক্রমের শিরোনাম *', 'Title *')}

                  </label>

                  <input

                    type="text"

                    data-testid="activity-title-input"

                    value={actTitle}

                    onChange={(e) => setActTitle(e.target.value)}

                    placeholder={t('উদা: ইউরিয়া উপরিপ্রয়োগ, সেচ প্রদান ইত্যাদি', 'e.g. Irrigation, Top dressing')}

                    required

                    maxLength={200}

                    className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-gold-400"

                  />

                </div>

              </div>



              {/* Optional Calendar Task Link */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('ক্যালেন্ডার টাস্কের সাথে যুক্ত করুন (ঐচ্ছিক)', 'Link to Calendar Task (Optional)')}

                </label>

                <select

                  data-testid="activity-calendar-task-select"

                  value={actCalendarTaskId}

                  onChange={(e) => setActCalendarTaskId(e.target.value ? Number(e.target.value) : '')}

                  className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-gold-400"

                >

                  <option value="">{t('কোনো ক্যালেন্ডার টাস্ক যুক্ত নয়', 'No Task Linked')}</option>

                  {calendarTasks.map((task) => (

                    <option key={task.id} value={task.id}>

                      #{task.id} • {task.title} ({task.due_date}) [{task.status}]

                    </option>

                  ))}

                </select>

                <p className="text-[11px] text-sage-400 font-bengali mt-1">

                  {t(

                    '* টাস্ক যুক্ত করলে তা কেবল তথ্যসূত্র হিসেবে সংযুক্ত থাকবে; টাস্কের স্ট্যাটাস স্বয়ংক্রিয়ভাবে পরিবর্তিত হবে না।',

                    '* Linking a task only associates the record; the calendar task status will remain unchanged.'

                  )}

                </p>

              </div>



              {/* Farmer Notes */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('কৃষকের মাঠ মন্তব্য / বিবরণ', 'Farmer Notes / Description')}

                </label>

                <textarea

                  data-testid="activity-notes-input"

                  value={actFarmerNotes}

                  onChange={(e) => setActFarmerNotes(e.target.value)}

                  rows={3}

                  placeholder={t('কাজের বিস্তারিত পরিমাণ বা অবস্থা উল্লেখ করতে পারেন...', 'Additional notes...')}

                  className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-gold-400 resize-none"

                />

              </div>



              {/* Submit Buttons */}

              <div className="pt-3 border-t border-forest-800 flex items-center justify-end gap-3">

                <button

                  type="button"

                  onClick={() => setShowActivityModal(false)}

                  className="px-4 py-2 rounded-xl text-sage-300 hover:text-cream-100 font-bengali hover:bg-forest-800 cursor-pointer"

                >

                  {t('বাতিল', 'Cancel')}

                </button>

                <button

                  type="submit"

                  data-testid="save-activity-btn"

                  disabled={submitting}

                  className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bengali font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"

                >

                  {submitting

                    ? t('সংরক্ষণ হচ্ছে...', 'Saving...')

                    : editingActivity

                    ? t('হালনাগাদ করুন', 'Update Activity')

                    : t('সংরক্ষণ করুন', 'Save Activity')}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}



      {/* --------------------------------------------------------------------- */}

      {/* OBSERVATION MODAL (Add / Edit) */}

      {/* --------------------------------------------------------------------- */}

      {showObservationModal && (

        <div

          data-testid="observation-modal"

          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/80 backdrop-blur-sm animate-fade-in"

        >

          <div className="bg-forest-900 border border-forest-750 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between pb-4 border-b border-forest-800">

              <h3 className="font-bengali font-bold text-lg text-cream-50 flex items-center gap-2">

                <Eye className="w-5 h-5 text-teal-400" />

                <span>

                  {editingObservation

                    ? t('মাঠ পর্যবেক্ষণ সম্পাদনা', 'Edit Crop Observation')

                    : t('নতুন মাঠ পর্যবেক্ষণ লিপিবদ্ধকরণ', 'Log Crop Observation')}

                </span>

              </h3>

              <button

                type="button"

                onClick={() => setShowObservationModal(false)}

                className="text-sage-400 hover:text-cream-50 p-1.5 rounded-lg hover:bg-forest-800"

              >

                <X className="w-5 h-5" />

              </button>

            </div>



            {formError && (

              <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-bengali">

                {formError}

              </div>

            )}



            <form onSubmit={handleSaveObservation} className="space-y-4 mt-4 text-xs font-bengali">

              {/* Crop Parcel Select */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('ফসলের প্লট *', 'Crop Parcel *')}

                </label>

                <select

                  data-testid="observation-crop-select"

                  value={obsCropId}

                  onChange={(e) => setObsCropId(Number(e.target.value))}

                  required

                  className="w-full px-3.5 py-2.5 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400"

                >

                  <option value="">{t('ফসল নির্বাচন করুন', 'Select Crop')}</option>

                  {crops.map((c) => (

                    <option key={c.id} value={c.id}>

                      {c.crop_name} {c.variety ? `(${c.variety})` : ''} • {c.season}

                    </option>

                  ))}

                </select>

              </div>



              {/* Date & Title Row */}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div>

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('তারিখ *', 'Date *')}

                  </label>

                  <input

                    type="date"

                    data-testid="observation-date-input"

                    value={obsDate}

                    onChange={(e) => setObsDate(e.target.value)}

                    required

                    className="w-full px-3 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-mono focus:outline-none focus:border-teal-400"

                  />

                </div>



                <div className="sm:col-span-2">

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('পর্যবেক্ষণের শিরোনাম *', 'Title *')}

                  </label>

                  <input

                    type="text"

                    data-testid="observation-title-input"

                    value={obsTitle}

                    onChange={(e) => setObsTitle(e.target.value)}

                    placeholder={t('উদা: কুশি পর্যায়ের স্বাস্থ্য পর্যবেক্ষণ', 'e.g. Tillering stage scouting')}

                    required

                    maxLength={200}

                    className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400"

                  />

                </div>

              </div>



              {/* Condition & Growth Stage */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div>

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('কৃষক-রিপোর্টেড সার্বিক অবস্থা *', 'Farmer-Reported Condition *')}

                  </label>

                  <select

                    data-testid="observation-condition-select"

                    value={obsCondition}

                    onChange={(e) => setObsCondition(e.target.value as CropObservationCondition)}

                    className="w-full px-3.5 py-2.5 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400"

                  >

                    {OBSERVATION_CONDITIONS.map((c) => (

                      <option key={c.id} value={c.id}>

                        {c.labelBn}

                      </option>

                    ))}

                  </select>

                </div>



                <div>

                  <label className="block text-sage-300 font-semibold mb-1">

                    {t('বৃদ্ধির পর্যায়', 'Growth Stage')}

                  </label>

                  <input

                    type="text"

                    data-testid="observation-growth-stage-input"

                    value={obsGrowthStage}

                    onChange={(e) => setObsGrowthStage(e.target.value)}

                    placeholder={t('উদা: চারা, কুশি, ফুল আসা, পরিপক্বতা', 'e.g. Vegetative, Tillering, Flowering')}

                    maxLength={100}

                    className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400"

                  />

                </div>

              </div>



              {/* Visible Symptoms */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('চাক্ষুষ কোনো সমস্যা বা অস্বাভাবিক লক্ষণ', 'Observed Symptoms / Issues')}

                </label>

                <textarea

                  data-testid="observation-symptoms-input"

                  value={obsVisibleSymptoms}

                  onChange={(e) => setObsVisibleSymptoms(e.target.value)}

                  rows={2}

                  placeholder={t('পাতার দাগ, হলুদাভাব বা পোকার উপদ্রব থাকলে বর্ণনা করুন...', 'Visible symptoms note...')}

                  className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400 resize-none"

                />

              </div>



              {/* General Growth Notes */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('সাধারণ মাঠ মন্তব্য', 'General Notes')}

                </label>

                <textarea

                  data-testid="observation-notes-input"

                  value={obsGrowthNotes}

                  onChange={(e) => setObsGrowthNotes(e.target.value)}

                  rows={2}

                  placeholder={t('অন্যান্য মন্তব্য...', 'Other notes...')}

                  className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400 resize-none"

                />

              </div>



              {/* Optional Associated Activity */}

              <div>

                <label className="block text-sage-300 font-semibold mb-1">

                  {t('সম্পর্কিত চাষাবাদ কার্যক্রম (ঐচ্ছিক)', 'Associated Activity (Optional)')}

                </label>

                <select

                  value={obsActivityId}

                  onChange={(e) => setObsActivityId(e.target.value ? Number(e.target.value) : '')}

                  className="w-full px-3.5 py-2 rounded-xl bg-forest-950 border border-forest-750 text-cream-100 font-bengali focus:outline-none focus:border-teal-400"

                >

                  <option value="">{t('কোনো কার্যক্রম যুক্ত নয়', 'No Activity Linked')}</option>

                  {activities.map((act) => (

                    <option key={act.id} value={act.id}>

                      #{act.id} • {act.title} ({act.activity_date})

                    </option>

                  ))}

                </select>

              </div>



              {/* Submit Buttons */}

              <div className="pt-3 border-t border-forest-800 flex items-center justify-end gap-3">

                <button

                  type="button"

                  onClick={() => setShowObservationModal(false)}

                  className="px-4 py-2 rounded-xl text-sage-300 hover:text-cream-100 font-bengali hover:bg-forest-800 cursor-pointer"

                >

                  {t('বাতিল', 'Cancel')}

                </button>

                <button

                  type="submit"

                  data-testid="save-observation-btn"

                  disabled={submitting}

                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-forest-950 font-bengali font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"

                >

                  {submitting

                    ? t('সংরক্ষণ হচ্ছে...', 'Saving...')

                    : editingObservation

                    ? t('হালনাগাদ করুন', 'Update Observation')

                    : t('সংরক্ষণ করুন', 'Save Observation')}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}



      {/* --------------------------------------------------------------------- */}

      {/* DELETE CONFIRMATION MODAL */}

      {/* --------------------------------------------------------------------- */}

      {confirmDelete && (

        <div

          data-testid="delete-modal"

          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/80 backdrop-blur-sm animate-fade-in"

        >

          <div className="bg-forest-900 border border-forest-750 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4">

            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">

              <Trash2 className="w-6 h-6" />

            </div>



            <div>

              <h3 className="font-bengali font-bold text-base text-cream-100">

                {confirmDelete.type === 'activity'

                  ? t('কার্যক্রম রেকর্ড মুছে ফেলতে চান?', 'Delete activity record?')

                  : t('পর্যবেক্ষণ রেকর্ড মুছে ফেলতে চান?', 'Delete observation record?')}

              </h3>

              <p className="font-bengali text-xs text-sage-300 mt-1 line-clamp-2">

                "{confirmDelete.title}"

              </p>

              <p className="text-[11px] text-rose-300 font-bengali mt-2">

                {t('এই পদক্ষেপটি অপরিবর্তনীয়। তথ্য স্থায়ীভাবে মুছে যাবে।', 'This action cannot be undone.')}

              </p>

            </div>



            <div className="flex items-center justify-center gap-3 pt-2">

              <button

                type="button"

                data-testid="cancel-delete-btn"

                onClick={() => setConfirmDelete(null)}

                className="px-4 py-2 rounded-xl text-sage-300 hover:text-cream-100 font-bengali hover:bg-forest-800 cursor-pointer text-xs"

              >

                {t('বাতিল', 'Cancel')}

              </button>

              <button

                type="button"

                data-testid="confirm-delete-btn"

                disabled={submitting}

                onClick={handleConfirmDelete}

                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bengali text-xs font-bold transition-all shadow-md cursor-pointer"

              >

                {submitting ? t('মুছে ফেলা হচ্ছে...', 'Deleting...') : t('হ্যাঁ, মুছে ফেলুন', 'Yes, Delete')}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}

