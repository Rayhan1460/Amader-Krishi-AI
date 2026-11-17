import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Trash2,
  MapPin,
  Sprout,
  Layers,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  BookOpen,
  CloudSun,
  CloudRain,
  Eye,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { farmApi, calendarApi, weatherApi, getErrorMessage } from '../../services/api.ts';
import { GrowthTimeline } from '../calendar/GrowthTimeline.tsx';
import { SchedulePreviewPanel } from '../calendar/SchedulePreviewPanel.tsx';
import { WeatherDashboardPanel } from '../weather/WeatherDashboardPanel.tsx';
import { CalendarModal } from '../calendar/CalendarModal.tsx';
import { SeasonalCropPlanner } from '../calendar/SeasonalCropPlanner.tsx';
import type { CropPlan, CropStage } from '../calendar/cropPlannerApi.ts';
import type { ScheduleConfirmResult } from '../../types/index.ts';
import { CalendarWorkboard, type CalendarView } from '../calendar/CalendarWorkboard.tsx';
import { CalendarFarmProfile, FarmProfileDialog, farmLocation, soilName } from '../calendar/CalendarFarmProfile.tsx';
import { calendarDate, shiftDays, todayInDhaka } from '../calendar/calendarDates.ts';
import '../calendar/SmartCalendar.css';
import { NotificationBell } from '../reminders/NotificationBell.tsx';
import type {
  FarmProfile,
  FarmCreatePayload,
  FarmCrop,
  CropCreatePayload,
  CalendarTask,
  TaskCreatePayload,
  FarmWeatherForecastResponse,
  BDDivisionsMap,
  CropScheduleTemplate,
  ScheduleGenerateResult,
  GeneratedTaskItem,
  CalendarWeatherAdvisory,
} from '../../types/index.ts';
import type { WorkspaceTab } from './WorkspaceSidebar.tsx';

interface WorkspaceCalendarViewProps {
  onBackToDashboard?: () => void;
  onNavigateToModel?: (modelId: string) => void;
  onNavigateToTab?: (tab: WorkspaceTab, modelIdOrFarmId?: string, extraId?: number) => void;
}

// Fallback Administrative Divisions & Districts of Bangladesh
const FALLBACK_DIVISIONS: BDDivisionsMap = {
  Dhaka: ['Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Faridpur', 'Manikganj', 'Munshiganj', 'Narsingdi', 'Kishoreganj', 'Gopalganj', 'Madaripur', 'Rajbari', 'Shariatpur'],
  Chattogram: ['Chattogram', "Cox's Bazar", 'Cumilla', 'Feni', 'Brahmanbaria', 'Noakhali', 'Chandpur', 'Lakshmipur', 'Khagrachhari', 'Rangamati', 'Bandarban'],
  Rajshahi: ['Rajshahi', 'Bogura', 'Pabna', 'Sirajganj', 'Naogaon', 'Natore', 'Chapai Nawabganj', 'Joypurhat'],
  Khulna: ['Khulna', 'Jashore', 'Kushtia', 'Satkhira', 'Bagerhat', 'Jhenaidah', 'Chuadanga', 'Magura', 'Meherpur', 'Narail'],
  Barishal: ['Barishal', 'Patuakhali', 'Bhola', 'Pirojpur', 'Barguna', 'Jhalokati'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rangpur: ['Rangpur', 'Dinajpur', 'Kurigram', 'Gaibandha', 'Nilphamari', 'Lalmonirhat', 'Thakurgaon', 'Panchagarh'],
  Mymensingh: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
};

// Category details with Bangla and English translations
const TASK_CATEGORIES = [
  { id: 'land_preparation', labelBn: 'জমি প্রস্তুতি ও চাষ', labelEn: 'Land Preparation' },
  { id: 'sowing', labelBn: 'বীজ বপন', labelEn: 'Sowing' },
  { id: 'transplanting', labelBn: 'চারা রোপণ', labelEn: 'Transplanting' },
  { id: 'irrigation', labelBn: 'সেচ ও পানি নিষ্কাশন', labelEn: 'Irrigation & Drainage' },
  { id: 'nutrient_management', labelBn: 'সুষম সার ও পুষ্টি', labelEn: 'Nutrient & Fertilizer' },
  { id: 'crop_observation', labelBn: 'ফসল পরিদর্শন ও আগাছা দমন', labelEn: 'Scouting & Weeding' },
  { id: 'harvest_planning', labelBn: 'ফসল কর্তন ও সংগ্রহ', labelEn: 'Harvest Planning' },
  { id: 'general', labelBn: 'সাধারণ খামার কাজ', labelEn: 'General Farm Task' },
];

// Convert English digits to Bengali digits
function toBnDigits(num: number | string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function WorkspaceCalendarView({ onBackToDashboard, onNavigateToModel, onNavigateToTab }: WorkspaceCalendarViewProps) {
  const { t, lang } = useLanguage();

  // Core Data State
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [crops, setCrops] = useState<FarmCrop[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [divisions, setDivisions] = useState<BDDivisionsMap>(FALLBACK_DIVISIONS);
  const [templates, setTemplates] = useState<CropScheduleTemplate[]>([]);

  // UI & Filter State
  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const [now, setNow] = useState(() => new Date());
  const today = todayInDhaka(now);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const currentDate = pickedDate ?? today;
  const [chosenSowingMonth, setSowingMonth] = useState<string>();
  const sowingMonth = chosenSowingMonth ?? today.slice(0,7);
  const [cropDraft, setCropDraft] = useState<CropPlan | null>(null);
  const showPlanner = () => {
    setMainTab('calendar');
    requestAnimationFrame(() => document.getElementById('acc-season-planner')?.scrollIntoView({block:'start'}));
  };
  const chooseSowingMonth = (month: string) => {
    setSowingMonth(month);
    setPickedDate(month + '-01');
    setViewMode('month');
  };
  const [selectedFarmId, setSelectedFarmId] = useState<number | 'all'>(() => {
    const stored = Number(sessionStorage.getItem('agrisphere.calendar.farm'));
    return Number.isSafeInteger(stored) && stored > 0 ? stored : 'all';
  });
  const [selectedCropId, setSelectedCropId] = useState<number | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string | 'all'>('all');

  // Loading & Feedback State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionPending, setIsActionPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals State
  const [farmDialog, setFarmDialog] = useState<FarmProfile | 'new' | null>(null);
  const [isAddCropOpen, setIsAddCropOpen] = useState<boolean>(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState<boolean>(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  // Phase F4B & F4C: Smart Schedule, Timeline & Weather State
  const [mainTab, setMainTab] = useState<'calendar' | 'timeline' | 'weather' | 'provenance'>('calendar');
  const [isScheduleGenModalOpen, setIsScheduleGenModalOpen] = useState<boolean>(false);
  const [isSchedulePreviewOpen, setIsSchedulePreviewOpen] = useState<boolean>(false);
  const [schedulePreview, setSchedulePreview] = useState<ScheduleGenerateResult | null>(null);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState<boolean>(false);
  const [isConfirmingSchedule, setIsConfirmingSchedule] = useState<boolean>(false);
  const [planForecast, setPlanForecast] = useState<FarmWeatherForecastResponse | null>(null);
  const [selectedTimelineTemplate, setSelectedTimelineTemplate] = useState<CropScheduleTemplate | null>(null);

  // Phase F4C: Weather Intelligence & Smart Advisories State
  const [weatherState, setWeatherState] = useState<{
    key: string;
    forecast: FarmWeatherForecastResponse | null;
    advisories: CalendarWeatherAdvisory[] | null;
  } | null>(null);
  const [weatherRevision, setWeatherRevision] = useState(0);
  const loadSequence = useRef(0);
  const weatherRefresh = useRef<(() => void) | null>(null);
  const [selectedWeatherAdvisory, setSelectedWeatherAdvisory] = useState<CalendarWeatherAdvisory | null>(null);
  const [isWeatherRescheduleOpen, setIsWeatherRescheduleOpen] = useState<boolean>(false);
  const [weatherRescheduleDate, setWeatherRescheduleDate] = useState<string>('');
  const [isReschedulingWeather, setIsReschedulingWeather] = useState<boolean>(false);

  // Generator Form State
  const [genForm, setGenForm] = useState<{
    farm_id: number;
    crop_id: number;
    planting_date: string;
    variety: string;
    season: string;
  }>({
    farm_id: 0,
    crop_id: 0,
    planting_date: todayInDhaka(),
    variety: '',
    season: '',
  });

  // Crop Form State
  const [cropForm, setCropForm] = useState<CropCreatePayload & { farm_id: number }>({
    farm_id: 0,
    crop_name: 'Rice',
    variety: 'BRRI Dhan-28',
    season: 'Rabi',
    sowing_date: todayInDhaka(),
    transplanting_date: '',
    expected_harvest_date: '',
    status: 'planted',
    notes: '',
  });

  // Task Form State
  const [taskForm, setTaskForm] = useState<TaskCreatePayload>({
    farm_id: 0,
    crop_id: null,
    title: '',
    category: 'irrigation',
    due_date: todayInDhaka(),
    due_time: '08:00',
    priority: 'medium',
    notes: '',
  });

  // Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState<string>(todayInDhaka());
  const [rescheduleTime, setRescheduleTime] = useState<string>('08:00');
  const [rescheduleNotes, setRescheduleNotes] = useState<string>('');

  // Initial load
  const loadAllData = useCallback(async () => {
    const request = ++loadSequence.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [farmsData, cropsData, tasksData, divisionsData, templatesData] = await Promise.all([
        farmApi.listFarms(),
        farmApi.listAllCrops(),
        calendarApi.listTasks(),
        calendarApi.getDivisions().catch(() => FALLBACK_DIVISIONS),
        calendarApi.getTemplates().catch(() => []),
      ]);

      if (request !== loadSequence.current) return;
      setFarms(farmsData);
      setSelectedFarmId((current) => current === 'all' || farmsData.some((farm) => farm.id === current) ? current : 'all');
      setCrops(cropsData);
      setTasks(tasksData);
      if (divisionsData && Object.keys(divisionsData).length > 0) {
        setDivisions(divisionsData);
      }
      setTemplates(templatesData);

      if (farmsData.length) {
        setCropForm((prev) => farmsData.some((farm) => farm.id === prev.farm_id) ? prev : { ...prev, farm_id: farmsData[0].id });
        setTaskForm((prev) => farmsData.some((farm) => farm.id === prev.farm_id) ? prev : { ...prev, farm_id: farmsData[0].id, crop_id: null });
      }
      setWeatherRevision((revision) => revision + 1);
    } catch (err) {
      if (request === loadSequence.current) setErrorMessage(getErrorMessage(err));
    } finally {
      if (request === loadSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
    return () => { loadSequence.current += 1; };
  }, [loadAllData, today]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const profile = selectedFarmId === 'all'
    ? farms.find((farm) => farm.is_active) ?? farms[0]
    : farms.find((farm) => farm.id === selectedFarmId);
  const weatherFarmId = profile?.id;
  const weatherKey = profile ? [profile.id, profile.division, profile.district, profile.upazila, profile.updated_at].join('|') : '';
  const activeWeather = weatherState?.key === weatherKey ? weatherState : null;

  useEffect(() => {
    if (!weatherFarmId) return;
    let active = true;
    let running = false;
    const refresh = async (force = false) => {
      if (running) return;
      running = true;
      try {
        // Fetch the forecast first so the advisory request uses the provider cache.
        const forecast = await weatherApi.getForecast(weatherFarmId, force).catch(() => null);
        if (!active) return;
        const advisories = forecast && forecast.status !== 'unavailable'
          ? await weatherApi.getAdvisories(weatherFarmId).then((result) => result.advisories).catch(() => null)
          : null;
        if (active) setWeatherState({ key: weatherKey, forecast, advisories });
      } finally {
        running = false;
      }
    };
    const onVisible = () => { if (!document.hidden) void refresh(); };
    weatherRefresh.current = () => { void refresh(true); };
    if (!document.hidden) void refresh();
    const timer = window.setInterval(onVisible, 5 * 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      weatherRefresh.current = null;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [weatherFarmId, weatherKey, weatherRevision]);

  // Flash auto-dismiss for messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Filtered crops based on selected farm in forms or global filter
  const cropsForSelectedFarm = useMemo(() => {
    if (taskForm.farm_id) {
      return crops.filter((c) => c.farm_id === taskForm.farm_id);
    }
    return crops;
  }, [crops, taskForm.farm_id]);

  // Filtered tasks based on active filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedFarmId !== 'all' && task.farm_id !== selectedFarmId) return false;
      if (selectedCropId !== 'all' && task.crop_id !== selectedCropId) return false;
      if (selectedCategory !== 'all' && task.category !== selectedCategory) return false;
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'overdue' && (task.status !== 'pending' || task.due_date >= today)) return false;
        if (selectedStatus !== 'overdue' && task.status !== selectedStatus) return false;
      }
      return true;
    });
  }, [tasks, selectedFarmId, selectedCropId, selectedCategory, selectedStatus, today]);

  const selectFarm = (id: number | 'all') => {
    setSelectedFarmId(id);
    if (id === 'all') sessionStorage.removeItem('agrisphere.calendar.farm');
    else sessionStorage.setItem('agrisphere.calendar.farm', String(id));
    setSelectedCropId('all');
  };

  const saveFarm = async (payload: FarmCreatePayload) => {
    if (!farmDialog) return;
    try {
      const saved = farmDialog === 'new'
        ? await farmApi.createFarm(payload)
        : await farmApi.updateFarm(farmDialog.id, payload);
      selectFarm(saved.id);
      setFarms((current) => current.some((farm) => farm.id === saved.id)
        ? current.map((farm) => farm.id === saved.id ? saved : farm)
        : [...current, saved]);
      setFarmDialog(null);
      setMainTab('calendar');
      setSuccessMessage(t('খামারের তথ্য সংরক্ষিত হয়েছে।', 'Farm profile saved.'));
      void loadAllData();
    } catch (err) {
      return getErrorMessage(err);
    }
  };

  const openCropForm = (farmId?: number) => {
    setErrorMessage(null);
    if (!farmId) { setFarmDialog('new'); return; }
    setCropForm((prev) => ({ ...prev, farm_id: farmId, sowing_date: today }));
    setIsAddCropOpen(true);
  };

  const handleCreateCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropForm.farm_id || !cropForm.crop_name.trim()) return;

    if ([cropForm.transplanting_date, cropForm.expected_harvest_date].some((date) => date && date < cropForm.sowing_date)) {
      setErrorMessage(t('রোপণ বা ফসল কাটার তারিখ বপনের আগে হতে পারে না।','Transplanting or harvest must be on or after the sowing date.'));
      return;
    }

    setIsActionPending(true);
    setErrorMessage(null);
    try {
      const newCrop = await farmApi.addCrop(cropForm.farm_id, {
        crop_name: cropForm.crop_name,
        variety: cropForm.variety || undefined,
        season: cropForm.season,
        sowing_date: cropForm.sowing_date,
        transplanting_date: cropForm.transplanting_date || undefined,
        expected_harvest_date: cropForm.expected_harvest_date || undefined,
        status: cropForm.status,
        notes: cropForm.notes || undefined,
      });
      setSuccessMessage(t(`ফসল "${newCrop.crop_name}" খামারে সফলভাবে যুক্ত হয়েছে!`, `Crop "${newCrop.crop_name}" added successfully!`));
      selectFarm(newCrop.farm_id);
      setSelectedCropId(newCrop.id);
      setPickedDate(newCrop.sowing_date);
      setSelectedCategory('all');
      setSelectedStatus('all');
      setMainTab('calendar');
      setIsAddCropOpen(false);
      await loadAllData();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.farm_id || !taskForm.title.trim() || !taskForm.due_date) return;

    setIsActionPending(true);
    setErrorMessage(null);
    try {
      const newTask = await calendarApi.createTask({
        farm_id: taskForm.farm_id,
        crop_id: taskForm.crop_id ? Number(taskForm.crop_id) : null,
        title: taskForm.title.trim(),
        category: taskForm.category,
        due_date: taskForm.due_date,
        due_time: taskForm.due_time || undefined,
        priority: taskForm.priority,
        notes: taskForm.notes || undefined,
      });
      setSuccessMessage(t(`কাজ "${newTask.title}" ক্যালেন্ডারে যুক্ত হয়েছে!`, `Task "${newTask.title}" added to calendar!`));
      setIsAddTaskOpen(false);
      setPickedDate(newTask.due_date);
      setMainTab('calendar');
      setTaskForm((prev) => ({
        ...prev,
        title: '',
        notes: '',
      }));
      await loadAllData();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleToggleTaskStatus = async (task: CalendarTask) => {
    if (isActionPending) return;
    setIsActionPending(true);
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await calendarApi.patchTaskStatus(task.id, nextStatus);
      setSuccessMessage(
        nextStatus === 'completed'
          ? t(`"${task.title}" সম্পন্ন হিসেবে চিহ্নিত করা হলো`, `"${task.title}" marked as completed`)
          : t(`"${task.title}" কাজ পুনরায় সক্রিয় করা হলো`, `"${task.title}" reopened`)
      );
      await loadAllData();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !rescheduleDate) return;

    setIsActionPending(true);
    setErrorMessage(null);
    try {
      await calendarApi.rescheduleTask(selectedTask.id, {
        due_date: rescheduleDate,
        due_time: rescheduleTime || undefined,
        notes: rescheduleNotes ? rescheduleNotes.trim() : undefined,
      });
      setSuccessMessage(t(`কাজটির সময়সূচি সফলভাবে পরিবর্তন করা হয়েছে!`, `Task rescheduled successfully!`));
      setIsRescheduleOpen(false);
      setPickedDate(rescheduleDate);
      setSelectedTask(null);
      await loadAllData();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (isActionPending || !window.confirm(t('আপনি কি নিশ্চিত যে এই কাজটি মুছে ফেলতে চান?', 'Are you sure you want to delete this task?'))) {
      return;
    }

    try {
      setIsActionPending(true);
      await calendarApi.deleteTask(taskId);
      setSuccessMessage(t('কাজটি সফলভাবে মুছে ফেলা হয়েছে', 'Task deleted successfully'));
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
        setIsRescheduleOpen(false);
      }
      await loadAllData();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsActionPending(false);
    }
  };

  const openRescheduleModal = (task: CalendarTask) => {
    setErrorMessage(null);
    setSelectedTask(task);
    setRescheduleDate(task.due_date);
    setRescheduleTime(task.due_time || '08:00');
    setRescheduleNotes(task.notes || '');
    setIsRescheduleOpen(true);
  };

  const openAddTaskForDate = (dateStr: string) => {
    setErrorMessage(null);
    const farmId = profile?.id;
    if (!farmId) { setFarmDialog('new'); return; }
    setTaskForm((prev) => ({
      ...prev,
      due_date: dateStr,
      farm_id: farmId,
      crop_id: selectedCropId !== 'all' && crops.some((crop) => crop.id === selectedCropId && crop.farm_id === farmId)
        ? selectedCropId
        : prev.farm_id === farmId ? prev.crop_id : null,
    }));
    setIsAddTaskOpen(true);
  };

  // =========================================================================
  // PHASE F4B: SCHEDULE GENERATOR & CONFIRMATION HANDLERS
  // =========================================================================
  const handleOpenScheduleGenerator = (initialFarmId?: number, initialCropId?: number) => {
    setErrorMessage(null);
    const fId = initialFarmId ?? profile?.id;
    if (!fId) { setFarmDialog('new'); return; }
    const farmCrops = crops.filter((crop) => crop.farm_id === fId);
    const matchedCrop = farmCrops.find((crop) => crop.id === (initialCropId ?? selectedCropId)) ?? farmCrops[0];
    if (!matchedCrop && !crops.length) { openCropForm(fId); return; }

    setGenForm({
      farm_id: fId,
      crop_id: matchedCrop?.id ?? 0,
      planting_date: matchedCrop?.sowing_date || todayInDhaka(),
      variety: matchedCrop?.variety || '',
      season: matchedCrop?.season || 'Rabi',
    });
    setIsScheduleGenModalOpen(true);
  };

  const handleRunScheduleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.farm_id || !genForm.crop_id || !genForm.planting_date) return;

    if (isGeneratingSchedule) return;
    setIsGeneratingSchedule(true);
    setErrorMessage(null);
    try {
      const response = await calendarApi.generateSchedule({
        farm_id: genForm.farm_id,
        crop_id: genForm.crop_id,
        planting_date: genForm.planting_date,
        target_variety: genForm.variety || undefined,
        season: genForm.season || undefined,
      });
      setPlanForecast(null);
      setSchedulePreview(response);
      setIsScheduleGenModalOpen(false);
      setIsSchedulePreviewOpen(true);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  useEffect(() => {
    if (!isSchedulePreviewOpen || schedulePreview?.status !== 'success') return;
    let current = true;
    weatherApi.getForecast(schedulePreview.farm_id).then((forecast) => {
      if (current) setPlanForecast(forecast);
    }).catch(() => {});
    return () => { current = false; };
  }, [isSchedulePreviewOpen, schedulePreview]);

  const handleConfirmSchedule = async (tasksToConfirm: GeneratedTaskItem[]) => {
    if (!schedulePreview || isConfirmingSchedule) return;

    setIsConfirmingSchedule(true);
    setErrorMessage(null);
    try {
      const res = await calendarApi.confirmSchedule({
        farm_id: schedulePreview.farm_id,
        crop_id: schedulePreview.crop_id,
        template_id: schedulePreview.template_id || 'custom',
        planting_date: schedulePreview.planting_date,
        schedule_hash: schedulePreview.schedule_hash,
        tasks: tasksToConfirm,
      });

      setSuccessMessage(
        lang === 'bn'
          ? (res.message_bn || 'স্মার্ট কৃষি পরিকল্পনা সফলভাবে ক্যালেন্ডারে সংরক্ষিত হয়েছে!')
          : (res.message || 'Smart schedule confirmed and saved to calendar!')
      );
      setIsSchedulePreviewOpen(false);
      setSchedulePreview(null);
      selectFarm(schedulePreview.farm_id);
      setPickedDate(schedulePreview.planting_date);
      setMainTab('calendar');
      await loadAllData();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsConfirmingSchedule(false);
    }
  };

  // Helper for priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            {t('অতি জরুরি', 'Urgent')}
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            {t('উচ্চ', 'High')}
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            {t('সাধারণ', 'Normal')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-forest-800 text-sage-300 border border-forest-700">
            {t('নিম্ন', 'Low')}
          </span>
        );
    }
  };

  const locale = lang === 'bn' ? 'bn-BD' : 'en-BD';
  const bn = lang === 'bn';
  const number = new Intl.NumberFormat(locale);
  const clock = new Intl.DateTimeFormat(locale, { timeZone:'Asia/Dhaka', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(now);
  const dateLabel = new Intl.DateTimeFormat(locale, { timeZone:'UTC', weekday:'long', day:'numeric', month:'long' });
  const showCropPlan = useCallback((plan: CropPlan | null) => {
    setCropDraft(plan);
    if (plan) setPickedDate(plan.planting_date);
  }, []);
  const applySavedPlan = (result: ScheduleConfirmResult, plantingDate: string) => {
    setSuccessMessage(t(result.message_bn, result.message));
    selectFarm(result.farm_id);
    setPickedDate(plantingDate);
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedCropId(result.crop_id);
    setViewMode('month');
    setCropDraft(null);
    void loadAllData();
  };
  const cropsWithSchedules = new Set(tasks.filter((task) => task.is_generated).map((task) => task.crop_id));
  const cropDates: CropStage[] = crops.flatMap((crop) => {
    if (cropsWithSchedules.has(crop.id) || (selectedFarmId !== 'all' && selectedFarmId !== crop.farm_id) ||
        (selectedCropId !== 'all' && selectedCropId !== crop.id) || selectedStatus !== 'all') return [];
    const dates = [
      { date:crop.sowing_date, category:'sowing', bn:'বপন', en:'Sowing' },
      { date:crop.transplanting_date, category:'transplanting', bn:'চারা রোপণ', en:'Transplanting' },
      { date:crop.expected_harvest_date, category:'harvest_planning', bn:'সম্ভাব্য ফসল কাটা', en:'Estimated harvest' },
    ];
    return dates.flatMap(({ date, category, bn, en }) => !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      (selectedCategory !== 'all' && selectedCategory !== category) ? [] : [{
        id:`crop-${crop.id}-${category}`, date, end_date:date, category,
        title:crop.crop_name + ' · ' + bn, title_en:crop.crop_name + ' · ' + en,
        action:'', action_en:'', source:'',
      }]);
  });
  const forecast = activeWeather?.forecast;
  const advisoryTasks = new Map(tasks.map((task) => [task.id,task]));
  const selectedForecast = forecast?.status !== 'unavailable' ? forecast?.forecast.find((day) => day.date === currentDate) : undefined;
  const forecastUpdated = forecast?.generated_at ? new Intl.DateTimeFormat(locale, { timeZone:'Asia/Dhaka', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(forecast.generated_at)) : '';
  const advisories = activeWeather?.advisories?.filter((advisory) => advisory.task_due_date >= today && (advisoryTasks.get(advisory.task_id)?.status === 'pending' && advisoryTasks.get(advisory.task_id)?.due_date === advisory.task_due_date)) ?? [];
  const activeCrops = crops.filter((crop) => ['planned','planted','growing'].includes(crop.status));
  const nativeModel = onNavigateToModel ?? (onNavigateToTab ? (id: string) => onNavigateToTab('tools', id === 'flood_risk' ? 'flood_susceptibility' : id) : undefined);
  const openWeatherReschedule = (advisory: CalendarWeatherAdvisory) => {
    setSelectedWeatherAdvisory(advisory);
    const days = advisory.suggested_reschedule_days[0];
    setWeatherRescheduleDate(days ? shiftDays(advisory.task_due_date, days) : '');
    setErrorMessage(null);
    setIsWeatherRescheduleOpen(true);
  };

  return (
    <div className="acc-shell">
      {/* Toast Feedback */}
      {errorMessage && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bengali">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 rounded-lg hover:bg-rose-900/50 text-rose-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bengali font-semibold">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="p-1 rounded-lg hover:bg-emerald-900/50 text-emerald-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <header className="acc-hero">
        <div className="acc-hero-content">
          <span className="acc-hero-date"><CalendarClock size={15} aria-hidden="true" />{dateLabel.format(calendarDate(today))} · {clock} <small>{t('ঢাকা সময়','Dhaka time')}</small></span>
          <h1>{t('স্মার্ট কৃষি ক্যালেন্ডার','Smart farm calendar')}</h1>
          <p>{profile ? farmLocation(profile, bn) + ' · ' + soilName(profile.soil_type, bn) : t('বপন থেকে ফসল কাটা পর্যন্ত আপনার কাজের সূচি।','Plan your farm work from sowing to harvest.')}</p>
          <div className="acc-hero-actions">
            <button type="button" className="acc-button acc-primary" disabled={isLoading && !farms.length} onClick={showPlanner}><Sprout size={17} />{t('মাস ও ফসল বাছাই','Choose month and crop')}</button>
            <button type="button" className="acc-button" onClick={() => openCropForm(profile?.id)}><Layers size={17} />{t('ফসল যোগ করুন','Add crop')}</button>
            <button type="button" className="acc-button" onClick={() => openAddTaskForDate(currentDate)}><Plus size={18} />{t('নতুন কাজ','Add task')}</button>
          </div>
        </div>
      </header>
      <nav className="acc-nav" aria-label={t('কৃষি ক্যালেন্ডারের বিভাগ','Calendar sections')}>
        <div className="acc-nav-tabs">
          {([['calendar',CalendarIcon,t('ক্যালেন্ডার','Calendar')],['timeline',Sprout,t('ধাপ ও নির্দেশিকা','Stages and guidance')],['weather',CloudSun,t('আবহাওয়া','Weather')],['provenance',BookOpen,t('গবেষণা উৎস','Sources')]] as const)
            .map(([tab,Icon,label]) => <button type="button" className="acc-button" aria-pressed={mainTab === tab} key={tab} onClick={() => setMainTab(tab)}><Icon size={17} />{label}</button>)}
        </div>
        <div className="acc-nav-actions">
          {onNavigateToTab && <button type="button" className="acc-button acc-icon" data-testid="calendar-goto-monitoring-btn" aria-label={t('ফসল পর্যবেক্ষণ','Crop monitoring')} onClick={() => onNavigateToTab('crop_monitoring',profile ? String(profile.id) : undefined)}><Eye size={19} /></button>}
          <NotificationBell
            refreshKey={today + '-' + weatherRevision}
            onOpenReschedule={(id) => { const task = tasks.find((item) => item.id === id); if (task) openRescheduleModal(task); }}
            onSelectTask={(id) => { const task = tasks.find((item) => item.id === id); if (task) { selectFarm(task.farm_id); setSelectedCategory('all'); setSelectedStatus('all'); setMainTab('calendar'); setPickedDate(task.due_date); } }}
          />
        </div>
      </nav>
      {mainTab === 'calendar' && (
        <>
          <div className="acc-controls">
            <label><MapPin size={17} /><span className="acc-sr">{t('খামার','Farm')}</span>
              <select value={selectedFarmId} aria-label={t('খামার','Farm')} onChange={(e) => selectFarm(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">{t('সব খামার','All farms')}</option>
                {farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name} · {farmLocation(farm, bn)}</option>)}
              </select>
            </label>
            <details className="acc-filters">
              <summary>{t('কাজের ফিল্টার','Task filters')}</summary>
              <div>
                <label><span>{t('ফসল','Crop')}</span><select value={selectedCropId} onChange={(e) => setSelectedCropId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">{t('সব ফসল','All crops')}</option>{crops.filter((crop) => selectedFarmId === 'all' || crop.farm_id === selectedFarmId).map((crop) => <option key={crop.id} value={crop.id}>{crop.crop_name} {crop.variety}</option>)}</select></label>
                <label><span>{t('কাজের ধরন','Category')}</span><select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="all">{t('সব ধরন','All categories')}</option>{TASK_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{t(category.labelBn,category.labelEn)}</option>)}</select></label>
                <label><span>{t('অবস্থা','Status')}</span><select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="all">{t('সব অবস্থা','All statuses')}</option><option value="pending">{t('বাকি','Pending')}</option><option value="completed">{t('সম্পন্ন','Completed')}</option><option value="overdue">{t('সময় পেরিয়েছে','Overdue')}</option></select></label>
              </div>
            </details>
            <button type="button" className="acc-button acc-icon" aria-label={t('তথ্য আবার লোড করুন','Refresh data')} onClick={() => { weatherRefresh.current?.(); void loadAllData(); }} disabled={isLoading}><RefreshCw size={17} /></button>
            {crops.length > 0 && <button type="button" className="acc-button" onClick={() => handleOpenScheduleGenerator()}>{t('নিবন্ধিত ফসলের পরিকল্পনা','Plan registered crops')}</button>}
            <button type="button" className="acc-button acc-add-farm" onClick={() => setFarmDialog('new')} aria-label={t('নতুন খামার','Add farm')}><Sprout size={17} /><span>{t('নতুন খামার','Add farm')}</span></button>
          </div>
          <SeasonalCropPlanner month={sowingMonth} farm={profile} onMonth={chooseSowingMonth} onShowPlan={showCropPlan}
            onSave={applySavedPlan} onAddFarm={() => setFarmDialog('new')} onAddCustomCrop={(name, date) => {
              if (!profile) { setFarmDialog('new'); return; }
              setErrorMessage(null);
              setCropForm((previous) => ({ ...previous, farm_id:profile.id, crop_name:name, variety:'', sowing_date:date,
                transplanting_date:'', expected_harvest_date:'', notes:'', status:'planned', season:'Year-round' }));
              setIsAddCropOpen(true);
            }} />
          <CalendarWorkboard view={viewMode} today={today} date={currentDate} tasks={filteredTasks}
            previewStages={cropDraft?.stages} cropDates={cropDates} hasFarm={!!profile} isLoading={isLoading} isActionPending={isActionPending}
            onChangeDate={(date) => setPickedDate(date === today ? null : date)} onChangeView={setViewMode}
            onAdd={openAddTaskForDate} onEdit={openRescheduleModal} onToggle={handleToggleTaskStatus} onDelete={(task) => handleDeleteTask(task.id)} />
          {profile && (
            <section className="acc-weather" aria-label={t('খামারের আবহাওয়া','Farm weather')}>
              <span className="acc-weather-icon"><CloudSun size={23} /></span>
              <div className="acc-weather-detail"><strong>{profile.name} <span>·</span> {t('আবহাওয়া','Weather')}</strong>
                <p>{selectedForecast
                  ? [number.format(selectedForecast.temp_min) + '–' + number.format(selectedForecast.temp_max) + '°C', t(selectedForecast.condition_bn,selectedForecast.condition_en), t('বৃষ্টির সম্ভাবনা ','Rain chance ') + number.format(selectedForecast.precipitation_probability_max) + '%'].join(' · ')
                  : activeWeather ? t('এই তারিখের পূর্বাভাস পাওয়া যাচ্ছে না','Forecast unavailable for this date') : t('পূর্বাভাস লোড হচ্ছে…','Loading forecast…')}</p>
                <small>{dateLabel.format(calendarDate(currentDate))}{selectedForecast && forecast ? ' · Open-Meteo · ' + t(forecast.location.location_label_bn,forecast.location.location_label_en) : ''}</small>
                {forecast?.message_bn && <small className="acc-weather-note">{t(forecast.message_bn, forecast.message_en ?? t('সংরক্ষিত পূর্বাভাস দেখানো হচ্ছে।','Showing the last available forecast.'))}</small>}
                {selectedForecast && forecastUpdated && !forecast?.message_bn && <small className="acc-weather-note">{t('সর্বশেষ যাচাই','Last checked')} {forecastUpdated}</small>}
              </div>
              <button type="button" className="acc-button" onClick={() => setMainTab('weather')} aria-label={t('পূর্বাভাস দেখুন','View forecast')}><span className="acc-weather-button-text">{t('পূর্বাভাস দেখুন','View forecast')}</span><ArrowRight size={16} /></button>
            </section>
          )}
          {advisories.length > 0 && <section className="acc-advisories" aria-label={t('আবহাওয়ার সতর্কতা','Weather advisories')}>
            {advisories.map((advisory) => <div className="acc-advisory" key={advisory.advisory_id}>
              <CloudRain size={20} /><div><strong>{t(advisory.title_bn,advisory.title_en)}</strong><p>{advisory.task_title} · {t(advisory.reason_bn,advisory.reason_en)}</p></div>
              {advisory.can_reschedule && <button type="button" className="acc-button" onClick={() => openWeatherReschedule(advisory)}>{t('তারিখ পর্যালোচনা','Review date')}</button>}
            </div>)}
          </section>}
          {!isLoading && <CalendarFarmProfile farm={profile} cropCount={activeCrops.filter((crop) => crop.farm_id === profile?.id).length}
            onAdd={() => setFarmDialog('new')} onEdit={setFarmDialog} />}
          {isLoading && !farms.length && <p className="acc-loading" role="status">{t('খামারের তথ্য লোড হচ্ছে…','Loading your farms…')}</p>}
        </>
      )}
      {/* Contextual AI Models Recommendation Strip */}
      {nativeModel && mainTab === 'calendar' && <div className="acc-models p-4 rounded-2xl bg-forest-950 border border-forest-750 flex flex-col gap-3 text-xs font-bengali">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gold-400/20 text-gold-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-cream-100 flex items-center gap-1.5">
              <span>{t('ফসল বাছাই ও কৃষি সহায়তা', 'Crop selection and farm tools')}</span>
            </span>
            <p className="text-[11px] text-sage-300 mt-0.5">
              {t('ক্যালেন্ডারের ফসল ও খামারের তথ্যের ভিত্তিতে প্রাসঙ্গিক এআই মডেল ব্যবহার করুন:', 'Launch trained AI diagnostic & forecasting models matching your current crops:')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(!selectedCropId || selectedCropId === 'all' || crops.some(c => c.crop_name.toLowerCase().includes('rice') || c.crop_name.includes('ধান'))) && (
            <>
              <button
                type="button"
                onClick={() => nativeModel?.('rice_disease')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                <span>🌾 {t('ধানের রোগ নির্ণয়', 'Rice Leaf Disease')}</span>
              </button>
              <button
                type="button"
                onClick={() => nativeModel?.('boro_rice_price')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-gold-300 border border-gold-400/30 transition-colors cursor-pointer"
              >
                <span>📈 {t('বোরো ধান বাজারদর', 'Boro Rice Price')}</span>
              </button>
            </>
          )}

          {(!selectedCropId || selectedCropId === 'all' || crops.some(c => c.crop_name.toLowerCase().includes('tomato') || c.crop_name.includes('টমেটো'))) && (
            <>
              <button
                type="button"
                onClick={() => nativeModel?.('tomato_disease_v3')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                <span>🍅 {t('টমেটোর রোগ সনাক্তকরণ', 'Tomato Disease')}</span>
              </button>
              <button
                type="button"
                onClick={() => nativeModel?.('tomato_price')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-gold-300 border border-gold-400/30 transition-colors cursor-pointer"
              >
                <span>📊 {t('টমেটো বাজারদর', 'Tomato Price')}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => nativeModel?.('crop_recommendation')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-850 hover:bg-forest-800 text-cream-100 border border-forest-700 transition-colors cursor-pointer"
          >
            <span>🌱 {t('উপযুক্ত ফসল নির্বাচন', 'Crop Recommend')}</span>
          </button>

          <button
            type="button"
            onClick={() => nativeModel?.('regional_crop_yield')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-850 hover:bg-forest-800 text-cream-100 border border-forest-700 transition-colors cursor-pointer"
          >
            <span>⚖️ {t('আঞ্চলিক ফলন', 'Regional Yield')}</span>
          </button>

          <button
            type="button"
            onClick={() => nativeModel?.('flood_susceptibility')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-forest-850 hover:bg-forest-800 text-sky-300 border border-sky-500/30 transition-colors cursor-pointer"
          >
            <span>🌊 {t('বন্যা ঝুঁকি', 'Flood Risk')}</span>
          </button>
        </div>
      </div>}

      {/* Main Tab 2: Growth Timeline */}
      {mainTab === 'timeline' && (
        <div className="acc-related space-y-6 animate-fade-in-up">
          {/* Template Selector Bar */}
          <div className="p-4 rounded-2xl bg-forest-900/90 border border-forest-750 flex flex-wrap items-center justify-between gap-3 text-xs font-bengali">
            <div className="flex items-center gap-3">
              <Sprout className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-sage-400 block text-[11px]">{t('ফসল বা টেমপ্লেট নির্বাচন করুন:', 'Select Crop / Template:')}</span>
                <select
                  value={selectedTimelineTemplate?.template_id || (templates[0]?.template_id || '')}
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.template_id === e.target.value);
                    if (tpl) setSelectedTimelineTemplate(tpl);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-forest-950 border border-forest-750 text-cream-50 font-bold focus:outline-none focus:border-gold-500 mt-1"
                >
                  {templates.map((t) => (
                    <option key={t.template_id} value={t.template_id}>
                      {t.crop_bn} ({t.season_bn} মৌসুম) • {t.variety}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenScheduleGenerator();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-forest-950 text-xs font-bold border border-gold-400 shadow-md cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('নিবন্ধিত ফসলের পরিকল্পনা', 'Plan a registered crop')}</span>
              </button>
            </div>
          </div>

          {/* Growth Timeline Render */}
          <GrowthTimeline
            template={selectedTimelineTemplate || (templates.length > 0 ? templates[0] : null)}
            plantingDate={cropDraft?.planting_date ?? today}
          />
        </div>
      )}

      {/* Main Tab 3: Research Provenance & Standards */}
      {mainTab === 'provenance' && (
        <div className="acc-related space-y-6 animate-fade-in-up font-bengali">
          {/* Header info */}
          <div className="p-6 rounded-3xl bg-forest-950 border border-forest-800 text-cream-50 shadow-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-4 border-b border-forest-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-forest-800 border border-forest-700 flex items-center justify-center text-gold-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-cream-50">
                    {t('বাংলাদেশ কৃষি গবেষণা কাউন্সিল ও গবেষণা প্রতিষ্ঠানের স্বীকৃত মানদণ্ড', 'National Agricultural Research Standards & Provenance')}
                  </h3>
                  <p className="text-xs text-sage-300">
                    {t('সকল তথ্য BRRI, BARI, BAMIS ও DAE এর আনুষ্ঠানিক প্রকাশনা থেকে সংগ্রহ ও যাচাইকৃত', 'All schedules are sourced and verified from BRRI, BARI, BAMIS and DAE publications')}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-900 border border-forest-750 text-gold-300 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Phase F4B Verified • 100% Authentic</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => (
                <div
                  key={tpl.template_id}
                  className="p-5 rounded-2xl bg-forest-900/90 border border-forest-750 flex flex-col justify-between space-y-4 hover:border-gold-500/40 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono text-gold-400 font-bold bg-gold-400/10 px-2 py-0.5 rounded border border-gold-400/20">
                        {tpl.template_id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        {tpl.season_bn} মৌসুম
                      </span>
                    </div>

                    <h4 className="font-bold text-cream-50 text-base">
                      {tpl.crop_bn} <span className="text-sage-300 text-xs font-normal">({tpl.crop})</span>
                    </h4>
                    <p className="text-xs text-gold-300 mt-1 font-mono">
                      {tpl.variety}
                    </p>

                    <div className="mt-3 space-y-1.5 text-xs text-sage-300">
                      <p>
                        <strong className="text-cream-100">{t('উৎস সংস্থা:', 'Agency:')}</strong> {tpl.source_agency}
                      </p>
                      <p>
                        <strong className="text-cream-100">{t('সংস্করণ / প্রকাশনা:', 'Version:')}</strong> {tpl.source_version}
                      </p>
                      <p>
                        <strong className="text-cream-100">{t('রোপণ সময়কাল:', 'Sowing Window:')}</strong> {tpl.recommended_sowing_window}
                      </p>
                      <p className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded-xl border border-amber-900/40 mt-2">
                        <strong>{t('সীমাবদ্ধতা:', 'Limitations:')}</strong> {tpl.limitations}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-forest-800 flex items-center justify-between gap-2">
                    <a
                      href={tpl.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline"
                    >
                      <span>{t('সরকারি সূত্র দেখুন', 'View Source')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        handleOpenScheduleGenerator();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-gold-300 text-xs font-semibold border border-forest-700 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-gold-400" />
                      <span>{t('পরিকল্পনা তৈরি', 'Generate')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Return to Dashboard */}
      {onBackToDashboard && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-750 text-gold-300 text-xs font-bengali font-semibold border border-forest-700 transition-colors cursor-pointer shadow-sm"
          >
            <span>{t('ড্যাশবোর্ডে ফিরে যান', 'Return to Dashboard')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tab 4: Weather Dashboard & Forecast */}
      {mainTab === 'weather' && (
        <div className="acc-related space-y-6 animate-fade-in-up">
          <WeatherDashboardPanel
            farms={farms}
            selectedFarmId={profile?.id ?? null}
            onSelectFarm={selectFarm}
            forecastData={forecast ?? null}
            loading={!!profile && !activeWeather}
            error={activeWeather && (!forecast || forecast.status === 'unavailable') ? t('পূর্বাভাস এখন পাওয়া যাচ্ছে না।','The forecast is currently unavailable.') : undefined}
            onRefresh={() => weatherRefresh.current?.()}
            onNavigateToModel={nativeModel}
          />
        </div>
      )}

      {farmDialog && <FarmProfileDialog farm={farmDialog === 'new' ? undefined : farmDialog} divisions={divisions} onSave={saveFarm} onClose={() => setFarmDialog(null)} />}

      {/* =========================================================================
          MODAL 2: ADD CROP MODAL
          ========================================================================= */}
      {isAddCropOpen && (
        <CalendarModal labelId="acc-dialog-caption-1" onClose={() => setIsAddCropOpen(false)} pending={isActionPending}>
          <div className="bg-forest-950 border border-forest-800 rounded-3xl w-full max-w-lg p-6 text-cream-50 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-forest-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-400/20 text-emerald-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 id="acc-dialog-caption-1" className="font-bengali font-bold text-lg text-cream-50">
                  {t('খামারে ফসল চক্র নির্ধারণ করুন', 'Add Crop to Farm')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCropOpen(false)}
                aria-label={t('বন্ধ করুন', 'Close')}
                className="p-1 rounded-lg hover:bg-forest-850 text-sage-400 hover:text-cream-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && <p className="acc-error" role="alert">{errorMessage}</p>}
            <form onSubmit={handleCreateCrop} className="space-y-4 pt-4 text-xs font-bengali">
              {/* Select Farm */}
              <div>
                <label htmlFor="acc-crop-farm" className="block text-sage-300 font-semibold mb-1">
                  {t('খামার নির্বাচন করুন *', 'Select Farm *')}
                </label>
                <select id="acc-crop-farm"
                  value={cropForm.farm_id}
                  onChange={(e) => setCropForm({ ...cropForm, farm_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.upazila}, {f.district})
                    </option>
                  ))}
                </select>
              </div>

              {/* Crop Name & Variety */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-crop-name" className="block text-sage-300 font-semibold mb-1">
                    {t('ফসলের নাম *', 'Crop Name *')}
                  </label>
                  <input id="acc-crop-name"
                    type="text"
                    required
                    placeholder={t('যেমন: ধান (Rice)', 'e.g. Rice, Tomato')}
                    value={cropForm.crop_name}
                    onChange={(e) => setCropForm({ ...cropForm, crop_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div>
                  <label htmlFor="acc-crop-variety" className="block text-sage-300 font-semibold mb-1">
                    {t('জাত বা ভ্যারাইটি', 'Variety')}
                  </label>
                  <input id="acc-crop-variety"
                    type="text"
                    placeholder={t('যেমন: ব্রি ধান-২৮', 'e.g. BRRI Dhan-28')}
                    value={cropForm.variety || ''}
                    onChange={(e) => setCropForm({ ...cropForm, variety: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Season & Sowing Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-crop-season" className="block text-sage-300 font-semibold mb-1">
                    {t('মৌসুম *', 'Season *')}
                  </label>
                  <select id="acc-crop-season"
                    value={cropForm.season}
                    onChange={(e) => setCropForm({ ...cropForm, season: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  >
                    <option value="Rabi">{t('রবি (Rabi - শীতকালীন)', 'Rabi (Winter)')}</option>
                    <option value="Kharif-1">{t('খরিপ-১ (Kharif-1 - প্রাক-বর্ষা)', 'Kharif-1')}</option>
                    <option value="Kharif-2">{t('খরিপ-২ (Kharif-2 - বর্ষাকালীন)', 'Kharif-2')}</option>
                    <option value="Year-round">{t('বারোমাসি (Year-round)', 'Year-round')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="acc-sowing-date" className="block text-sage-300 font-semibold mb-1">
                    {t('বীজ বপনের তারিখ *', 'Sowing Date *')}
                  </label>
                  <input id="acc-sowing-date"
                    type="date"
                    required
                    value={cropForm.sowing_date}
                    onChange={(e) => setCropForm({ ...cropForm, sowing_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Transplanting & Expected Harvest */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-transplant-date" className="block text-sage-300 font-semibold mb-1">
                    {t('চারা রোপণের তারিখ', 'Transplanting Date (Optional)')}
                  </label>
                  <input id="acc-transplant-date"
                    type="date"
                    min={cropForm.sowing_date}
                    value={cropForm.transplanting_date || ''}
                    onChange={(e) => setCropForm({ ...cropForm, transplanting_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div>
                  <label htmlFor="acc-expected-harvest" className="block text-sage-300 font-semibold mb-1">
                    {t('সম্ভাব্য ফসল তোলার তারিখ', 'Expected Harvest Date')}
                  </label>
                  <input id="acc-expected-harvest"
                    type="date"
                    min={cropForm.sowing_date}
                    value={cropForm.expected_harvest_date || ''}
                    onChange={(e) => setCropForm({ ...cropForm, expected_harvest_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-forest-800">
                <button
                  type="button"
                  onClick={() => setIsAddCropOpen(false)}
                  className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-sage-300"
                >
                  {t('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bold disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {isActionPending ? t('যুক্ত হচ্ছে...', 'Adding...') : t('ফসল নিশ্চিত করুন', 'Confirm Crop')}
                </button>
              </div>
            </form>
          </div>
        </CalendarModal>
      )}

      {/* =========================================================================
          MODAL 3: ADD TASK MODAL
          ========================================================================= */}
      {isAddTaskOpen && (
        <CalendarModal labelId="acc-dialog-caption-2" onClose={() => setIsAddTaskOpen(false)} pending={isActionPending}>
          <div className="bg-forest-950 border border-forest-800 rounded-3xl w-full max-w-lg p-6 text-cream-50 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-forest-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gold-400/20 text-gold-400 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <h3 id="acc-dialog-caption-2" className="font-bengali font-bold text-lg text-cream-50">
                  {t('ক্যালেন্ডারে নতুন কাজ যোগ করুন', 'Add New Agricultural Task')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTaskOpen(false)}
                aria-label={t('বন্ধ করুন', 'Close')}
                className="p-1 rounded-lg hover:bg-forest-850 text-sage-400 hover:text-cream-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && <p className="acc-error" role="alert">{errorMessage}</p>}
            <form onSubmit={handleCreateTask} className="space-y-4 pt-4 text-xs font-bengali">
              {/* Select Farm */}
              <div>
                <label htmlFor="acc-task-farm" className="block text-sage-300 font-semibold mb-1">
                  {t('খামার নির্বাচন করুন *', 'Target Farm *')}
                </label>
                <select id="acc-task-farm"
                  value={taskForm.farm_id}
                  onChange={(e) => setTaskForm({ ...taskForm, farm_id: Number(e.target.value), crop_id: null })}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.district})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Crop (Optional) */}
              <div>
                <label htmlFor="acc-task-crop" className="block text-sage-300 font-semibold mb-1">
                  {t('সম্পর্কিত ফসল (ঐচ্ছিক)', 'Associated Crop (Optional)')}
                </label>
                <select id="acc-task-crop"
                  value={taskForm.crop_id || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, crop_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                >
                  <option value="">{t('নির্দিষ্ট কোনো ফসল নয় (সাধারণ খামার কাজ)', 'No specific crop (General farm task)')}</option>
                  {cropsForSelectedFarm.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.crop_name} {c.variety ? `(${c.variety})` : ''} - {c.season}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Title */}
              <div>
                <label htmlFor="acc-task-title" className="block text-sage-300 font-semibold mb-1">
                  {t('কাজের শিরোনাম *', 'Task Title *')}
                </label>
                <input id="acc-task-title"
                  type="text"
                  required
                  placeholder={t('যেমন: বোরো ধানের জমিতে ২য় কিস্তির ইউরিয়া প্রয়োগ', 'e.g. Apply 2nd urea dose')}
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-task-category" className="block text-sage-300 font-semibold mb-1">
                    {t('কাজের ক্যাটাগরি *', 'Category *')}
                  </label>
                  <select id="acc-task-category"
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  >
                    {TASK_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'bn' ? c.labelBn : c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="acc-task-priority" className="block text-sage-300 font-semibold mb-1">
                    {t('অগ্রাধিকার *', 'Priority *')}
                  </label>
                  <select id="acc-task-priority"
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  >
                    <option value="low">{t('নিম্ন (Low)', 'Low')}</option>
                    <option value="medium">{t('সাধারণ (Normal)', 'Normal')}</option>
                    <option value="high">{t('উচ্চ (High)', 'High')}</option>
                    <option value="urgent">{t('অতি জরুরি (Urgent)', 'Urgent')}</option>
                  </select>
                </div>
              </div>

              {/* Due Date & Due Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-task-date" className="block text-sage-300 font-semibold mb-1">
                    {t('নির্ধারিত তারিখ *', 'Due Date *')}
                  </label>
                  <input id="acc-task-date"
                    type="date"
                    required
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div>
                  <label htmlFor="acc-task-time" className="block text-sage-300 font-semibold mb-1">
                    {t('সময় (ঐচ্ছিক)', 'Due Time (Optional)')}
                  </label>
                  <input id="acc-task-time"
                    type="time"
                    value={taskForm.due_time ?? ''}
                    onChange={(e) => setTaskForm({ ...taskForm, due_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="acc-task-notes" className="block text-sage-300 font-semibold mb-1">
                  {t('কাজের বিস্তারিত নির্দেশনা / নোট', 'Instructions / Agronomic Notes')}
                </label>
                <textarea id="acc-task-notes"
                  rows={2}
                  placeholder={t('যেমন: জমিতে ২ ইঞ্চি পানি ধরে রেখে সকালে সার ছিটাবেন।', 'e.g. Ensure 2 inches of standing water before broadcasting...')}
                  value={taskForm.notes || ''}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-forest-800">
                <button
                  type="button"
                  onClick={() => setIsAddTaskOpen(false)}
                  className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-sage-300"
                >
                  {t('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bold disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {isActionPending ? t('যুক্ত হচ্ছে...', 'Adding...') : t('কাজ সংরক্ষণ করুন', 'Save Task')}
                </button>
              </div>
            </form>
          </div>
        </CalendarModal>
      )}

      {/* =========================================================================
          MODAL 4: TASK DETAILS & RESCHEDULE MODAL
          ========================================================================= */}
      {isRescheduleOpen && selectedTask && (
        <CalendarModal labelId="acc-dialog-caption-3" onClose={() => setIsRescheduleOpen(false)} pending={isActionPending}>
          <div className="bg-forest-950 border border-forest-800 rounded-3xl w-full max-w-lg p-6 text-cream-50 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-forest-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gold-400/20 text-gold-400 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h3 id="acc-dialog-caption-3" className="font-bengali font-bold text-lg text-cream-50">
                  {t('কাজের বিবরণ ও পুনঃনির্ধারণ', 'Task Details & Rescheduling')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRescheduleOpen(false)}
                aria-label={t('বন্ধ করুন', 'Close')}
                className="p-1 rounded-lg hover:bg-forest-850 text-sage-400 hover:text-cream-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-4 space-y-4 text-xs font-bengali">
              {/* Task Header & Status */}
              <div className="p-3.5 rounded-2xl bg-forest-900 border border-forest-750 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-sage-400">ID #{selectedTask.id}</span>
                  {getPriorityBadge(selectedTask.priority)}
                </div>
                <h4 className="font-bold text-sm sm:text-base text-cream-50">{selectedTask.title}</h4>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-sage-300">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gold-400" />
                    {selectedTask.farm_name || `খামার #${selectedTask.farm_id}`}
                  </span>
                  {selectedTask.crop_name && (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      {selectedTask.crop_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Toggle Action */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-forest-900 border border-forest-800">
                <div className="flex items-center gap-2">
                  <span className="text-sage-300">{t('কাজের বর্তমান অবস্থা:', 'Current Status:')}</span>
                  <span className={`font-bold ${selectedTask.status === 'completed' ? 'text-emerald-400' : 'text-gold-400'}`}>
                    {selectedTask.status === 'completed' ? t('সম্পন্ন', 'Completed') : t('বাকি আছে', 'Pending')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleTaskStatus(selectedTask);
                    setIsRescheduleOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedTask.status === 'completed'
                      ? 'bg-forest-800 text-sage-300 hover:bg-forest-750'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-forest-950 shadow-sm'
                  }`}
                >
                  {selectedTask.status === 'completed' ? t('পুনরায় সক্রিয় করুন', 'Reopen') : t('সম্পন্ন চিহ্নিত করুন', 'Mark Complete')}
                </button>
              </div>

              {/* Reschedule Form */}
              {errorMessage && <p className="acc-error" role="alert">{errorMessage}</p>}
            <form onSubmit={handleRescheduleSubmit} className="space-y-3 pt-2">
                <div className="font-bold text-cream-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gold-400" />
                  <span>{t('নতুন সময়সূচি নির্ধারণ (Reschedule):', 'Reschedule Task Date & Time:')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="acc-reschedule-date" className="block text-sage-300 mb-1">{t('নতুন তারিখ *', 'New Due Date *')}</label>
                    <input id="acc-reschedule-date"
                      type="date"
                      required
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="acc-reschedule-time" className="block text-sage-300 mb-1">{t('নতুন সময়', 'New Time')}</label>
                    <input id="acc-reschedule-time"
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                    />
                  </div>
                </div>

                {/* Quick Add Days Shortcuts */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-sage-400">{t('দ্রুত পেছান:', 'Quick Postpone:')}</span>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate(shiftDays(rescheduleDate || today, 1))}
                    className="px-2 py-1 rounded-lg bg-forest-800 hover:bg-forest-750 text-[11px] text-sage-300"
                  >
                    +১ দিন (+1 Day)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate(shiftDays(rescheduleDate || today, 3))}
                    className="px-2 py-1 rounded-lg bg-forest-800 hover:bg-forest-750 text-[11px] text-sage-300"
                  >
                    +৩ দিন (+3 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleDate(shiftDays(rescheduleDate || today, 7))}
                    className="px-2 py-1 rounded-lg bg-forest-800 hover:bg-forest-750 text-[11px] text-sage-300"
                  >
                    +৭ দিন (+7 Days)
                  </button>
                </div>

                <div>
                  <label htmlFor="acc-reschedule-notes" className="block text-sage-300 mb-1">{t('পুনঃনির্ধারণের কারণ / নোট', 'Reason / Reschedule Note')}</label>
                  <textarea id="acc-reschedule-notes"
                    rows={2}
                    placeholder={t('যেমন: ভারী বৃষ্টির কারণে ২ দিন পেছানো হলো', 'e.g. Postponed due to heavy rainfall...')}
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-forest-800">
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('কাজ মুছুন', 'Delete Task')}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRescheduleOpen(false)}
                      className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-sage-300"
                    >
                      {t('বাতিল', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isActionPending}
                      className="px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-forest-950 font-bold disabled:opacity-50 cursor-pointer shadow-md"
                    >
                      {isActionPending ? t('পরিবর্তন হচ্ছে...', 'Updating...') : t('পুনঃনির্ধারণ নিশ্চিত করুন', 'Confirm Reschedule')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </CalendarModal>
      )}

      {/* =========================================================================
          MODAL 5: SMART AGRICULTURAL SCHEDULE GENERATOR MODAL (Phase F4B)
          ========================================================================= */}
      {isScheduleGenModalOpen && (
        <CalendarModal labelId="acc-dialog-caption-4" onClose={() => setIsScheduleGenModalOpen(false)} pending={isGeneratingSchedule}>
          <div className="bg-forest-950 border border-gold-500/40 rounded-3xl w-full max-w-lg p-6 text-cream-50 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-forest-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold-400/20 text-gold-400 flex items-center justify-center border border-gold-400/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="acc-dialog-caption-4" className="font-bold text-lg text-cream-50">
                    {t('স্মার্ট কৃষি পরিকল্পনা জেনারেটর', 'Smart Crop Schedule Generator')}
                  </h3>
                  <span className="text-[11px] text-sage-300">
                    {t('BRRI / BAMIS / BARI বিজ্ঞানসম্মত গবেষণা মানদণ্ড', 'BRRI / BAMIS / BARI Verified Agricultural Standards')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleGenModalOpen(false)}
                aria-label={t('বন্ধ করুন', 'Close')}
                className="p-1 rounded-lg hover:bg-forest-850 text-sage-400 hover:text-cream-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && <p className="acc-error" role="alert">{errorMessage}</p>}
            <form onSubmit={handleRunScheduleGenerate} className="space-y-4 pt-4 text-xs">
              {/* Farm Selection */}
              <div>
                <label htmlFor="acc-plan-farm" className="block text-sage-300 font-semibold mb-1">
                  {t('খামার নির্বাচন করুন *', 'Select Farm *')}
                </label>
                <select id="acc-plan-farm"
                  required
                  value={genForm.farm_id}
                  onChange={(e) => {
                    const fId = Number(e.target.value);
                    const farmCrops = crops.filter((c) => c.farm_id === fId);
                    setGenForm({
                      ...genForm,
                      farm_id: fId,
                      crop_id: farmCrops[0]?.id || 0,
                      planting_date: farmCrops[0]?.sowing_date || today,
                      variety: farmCrops[0]?.variety || '',
                      season: farmCrops[0]?.season || 'Rabi',
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                >
                  <option value={0} disabled>{t('-- খামার নির্বাচন করুন --', '-- Select Farm --')}</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.district}, {f.division}) - {f.area} {f.area_unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Crop Selection */}
              <div>
                <label htmlFor="acc-plan-crop" className="block text-sage-300 font-semibold mb-1">
                  {t('ফসল নির্বাচন করুন *', 'Select Crop *')}
                </label>
                <select id="acc-plan-crop"
                  required
                  value={genForm.crop_id}
                  onChange={(e) => {
                    const cId = Number(e.target.value);
                    const selected = crops.find((c) => c.id === cId);
                    setGenForm({
                      ...genForm,
                      crop_id: cId,
                      variety: selected?.variety || '',
                      season: selected?.season || 'Rabi',
                      planting_date: selected?.sowing_date || genForm.planting_date,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                >
                  <option value={0} disabled>{t('-- ফসল নির্বাচন করুন --', '-- Select Crop --')}</option>
                  {crops
                    .filter((c) => genForm.farm_id === 0 || c.farm_id === genForm.farm_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.crop_name} {c.variety ? `(${c.variety})` : ''} - {c.season}
                      </option>
                    ))}
                </select>
                {crops.filter((c) => genForm.farm_id === 0 || c.farm_id === genForm.farm_id).length === 0 && (
                  <p className="text-[11px] text-amber-300 mt-1">
                    {t('এই খামারে কোনো ফসল যোগ করা হয়নি। আগে ফসল নির্ধারণ করুন।', 'No crops found for this farm. Please add a crop first.')}
                  </p>
                )}
              </div>

              {/* Planting / Sowing Date */}
              <div>
                <label htmlFor="acc-plan-date" className="block text-sage-300 font-semibold mb-1">
                  {t('বীজ বপন বা চারা রোপণের তারিখ *', 'Sowing or Planting Date *')}
                </label>
                <input id="acc-plan-date"
                  type="date"
                  required
                  value={genForm.planting_date}
                  onChange={(e) => setGenForm({ ...genForm, planting_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-gold-300 font-mono focus:outline-none focus:border-gold-500"
                />
                <span className="text-[10px] text-sage-400 mt-0.5 block">
                  {t('এই তারিখের ভিত্তিতে বীজতলা, সার প্রয়োগ, সেচ ও ধান কর্তনের দিন গণনা করা হবে।', 'All stage intervals will be scientifically calculated starting from this date.')}
                </span>
              </div>

              {/* Season & Variety (Optional override) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="acc-plan-season" className="block text-sage-300 font-semibold mb-1">
                    {t('মৌসুম (Season)', 'Season')}
                  </label>
                  <select id="acc-plan-season"
                    value={genForm.season}
                    onChange={(e) => setGenForm({ ...genForm, season: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  >
                    <option value="Rabi">{t('রবি (Rabi / শীতকালীন)', 'Rabi (Winter)')}</option>
                    <option value="Kharif-1">{t('খরিপ-১ (Kharif-1 / আউশ ও গ্রীষ্ম)', 'Kharif-1')}</option>
                    <option value="Kharif-2">{t('খরিপ-২ (Kharif-2 / আমন ও বর্ষা)', 'Kharif-2')}</option>
                    <option value="Year-round">{t('সারাবছর (Year-round)', 'Year-round')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="acc-plan-variety" className="block text-sage-300 font-semibold mb-1">
                    {t('জাত (Variety)', 'Variety')}
                  </label>
                  <input id="acc-plan-variety"
                    type="text"
                    placeholder={t('যেমন: ব্রি ধান-২৮, রতন', 'e.g. BRRI Dhan-28, Ratan')}
                    value={genForm.variety}
                    onChange={(e) => setGenForm({ ...genForm, variety: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>

              {/* Provenance note */}
              <div className="p-3 rounded-2xl bg-forest-900/60 border border-forest-800 text-[11px] text-sage-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {t(
                    'পরিকল্পনা তৈরির সাথে সাথেই কোনো টাস্ক ডেটাবেজে সরাসরি জমা হবে না। প্রথমে আপনি প্রিভিউ দেখে সময়সূচি সামঞ্জস্য করতে পারবেন।',
                    'Generates an interactive preview first. No changes are saved to your database until you confirm.'
                  )}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-forest-800">
                <button
                  type="button"
                  onClick={() => setIsScheduleGenModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-sage-300 cursor-pointer"
                >
                  {t('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingSchedule || !genForm.farm_id || !genForm.crop_id}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-forest-950 font-bold disabled:opacity-50 cursor-pointer shadow-md transition-all"
                >
                  {isGeneratingSchedule ? (
                    <span>{t('গণনা হচ্ছে...', 'Generating...')}</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{t('কৃষি পরিকল্পনা তৈরি করুন', 'Generate Schedule')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </CalendarModal>
      )}

      {/* =========================================================================
          MODAL 6: SCHEDULE PREVIEW & CONFIRMATION PANEL (Phase F4B)
          ========================================================================= */}
      {schedulePreview && (
        <SchedulePreviewPanel
          preview={schedulePreview}
          farm={farms.find((farm) => farm.id === schedulePreview.farm_id)}
          forecast={planForecast}
          errorMessage={errorMessage}
          isOpen={isSchedulePreviewOpen}
          onClose={() => setIsSchedulePreviewOpen(false)}
          onConfirm={handleConfirmSchedule}
          isConfirming={isConfirmingSchedule}
        />
      )}

      {/* =========================================================================
          MODAL 7: WEATHER RESCHEDULE MODAL (Phase F4C: FARMER APPROVAL REQUIRED)
          ========================================================================= */}
      {isWeatherRescheduleOpen && selectedWeatherAdvisory && (
        <CalendarModal labelId="acc-dialog-caption-5" onClose={() => setIsWeatherRescheduleOpen(false)} pending={isReschedulingWeather}>
          <div className="bg-forest-950 border border-amber-600/60 rounded-3xl w-full max-w-lg p-6 text-cream-50 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-forest-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <CloudRain className="w-4 h-4" />
                </div>
                <h3 id="acc-dialog-caption-5" className="font-bengali font-bold text-lg text-cream-50">
                  {t('আবহাওয়া সতর্কতায় কাজ পুনর্নির্ধারণ', 'Weather-Aware Task Rescheduling')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWeatherRescheduleOpen(false);
                  setSelectedWeatherAdvisory(null);
                }}
                aria-label={t('বন্ধ করুন', 'Close')}
                className="p-1 rounded-lg hover:bg-forest-850 text-sage-400 hover:text-cream-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && <p className="acc-error" role="alert">{errorMessage}</p>}
            <div className="space-y-4 pt-4 text-xs font-bengali">
              {/* Conflict Context Box */}
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-sm">{selectedWeatherAdvisory.title_bn}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px]">
                    বর্তমান তারিখ: {selectedWeatherAdvisory.task_due_date}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{selectedWeatherAdvisory.reason_bn}</p>
                <div className="text-[11px] text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                  💡 পরামর্শ: {selectedWeatherAdvisory.action_suggestion_bn}
                </div>
              </div>

              {/* Task Details */}
              <div className="p-3 bg-forest-900/60 rounded-xl border border-forest-800">
                <span className="text-sage-400 text-[11px]">নির্ধারিত কাজের নাম:</span>
                <div className="text-sm font-bold text-cream-50 mt-0.5">{selectedWeatherAdvisory.task_title}</div>
              </div>

              {/* Quick Shift Days */}
              <div>
                <label className="block text-sage-300 font-semibold mb-2">
                  {t('প্রস্তাবিত দিন পরিবর্তন (এক ক্লিকে):', 'Suggested Date Shift:')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedWeatherAdvisory.suggested_reschedule_days.map((days) => {
                    const shiftedStr = shiftDays(selectedWeatherAdvisory.task_due_date, days);
                    const isSelected = weatherRescheduleDate === shiftedStr;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setWeatherRescheduleDate(shiftedStr)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold shadow'
                            : 'bg-forest-900 border-forest-750 text-sage-300 hover:bg-forest-850'
                        }`}
                      >
                        <div className="text-xs">+{toBnDigits(days)} দিন</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{shiftedStr}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Date Input */}
              <div>
                <label htmlFor="acc-weather-task-date" className="block text-sage-300 font-semibold mb-1">
                  {t('অথবা নির্দিষ্ট নতুন তারিখ নির্ধারণ করুন:', 'Or Pick Custom Date:')}
                </label>
                <input id="acc-weather-task-date"
                  type="date"
                  min={today}
                  value={weatherRescheduleDate}
                  onChange={(e) => setWeatherRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-forest-900 border border-forest-750 text-cream-50 focus:outline-none focus:border-gold-500 font-mono"
                />
              </div>

              {/* Uncertainty & Autonomy Note */}
              <div className="text-[10px] text-slate-400 italic bg-forest-900/40 p-2.5 rounded-xl border border-forest-800">
                ⚠️ কৃষকের স্পষ্ট অনুমোদন ব্যতিরেকে স্বয়ংক্রিয়ভাবে কোনো তারিখ পরিবর্তিত হয় না। "পরিবর্তন নিশ্চিত করুন" বাটনে ক্লিক করলে আপনার ক্যালেন্ডারে নতুন তারিখটি সংরক্ষিত হবে।
              </div>

              {/* Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-forest-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsWeatherRescheduleOpen(false);
                    setSelectedWeatherAdvisory(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-sage-300 cursor-pointer"
                >
                  {t('বাতিল', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={isReschedulingWeather || !weatherRescheduleDate || weatherRescheduleDate < today || weatherRescheduleDate === selectedWeatherAdvisory.task_due_date}
                  onClick={async () => {
                    setIsReschedulingWeather(true);
                    try {
                      await calendarApi.rescheduleTask(selectedWeatherAdvisory.task_id, {
                        due_date: weatherRescheduleDate,
                        notes: t('আবহাওয়ার পূর্বাভাস অনুযায়ী তারিখ বদলানো হয়েছে।','Rescheduled after reviewing the forecast.'),
                      });
                      setPickedDate(weatherRescheduleDate);
                      selectFarm(selectedWeatherAdvisory.farm_id);
                      setSuccessMessage(
                        t(
                          `কাজটি সফলভাবে ${weatherRescheduleDate} তারিখে পুনর্নির্ধারণ করা হয়েছে।`,
                          `Task successfully rescheduled to ${weatherRescheduleDate}.`
                        )
                      );
                      setIsWeatherRescheduleOpen(false);
                      setSelectedWeatherAdvisory(null);
                      await loadAllData();
                    } catch (err) {
                      setErrorMessage(getErrorMessage(err));
                    } finally {
                      setIsReschedulingWeather(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold disabled:opacity-50 cursor-pointer shadow-md transition-all"
                >
                  {isReschedulingWeather ? (
                    <span>{t('সংরক্ষণ হচ্ছে...', 'Saving...')}</span>
                  ) : (
                    <>
                      <CalendarIcon className="w-4 h-4" />
                      <span>{t('পরিবর্তন নিশ্চিত করুন', 'Confirm Reschedule')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </CalendarModal>
      )}
    </div>
  );
}
