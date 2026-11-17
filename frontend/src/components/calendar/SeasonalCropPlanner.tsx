import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, Sprout, Wheat } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { getErrorMessage } from '../../services/api.ts';
import type { CropScheduleTemplate, FarmProfile, ScheduleConfirmResult } from '../../types/index.ts';
import { calendarDate, shiftDays, shiftMonth } from './calendarDates.ts';
import { farmLocation, soilName } from './CalendarFarmProfile.tsx';
import { SowingDatePicker } from './SowingDatePicker.tsx';
import { loadCropCatalog, loadCropMonth, nextSowingMonth, saveCropPlan, type CropOption, type CropPlan } from './cropPlannerApi.ts';

interface SeasonalCropPlannerProps {
  month: string;
  farm?: FarmProfile;
  onMonth: (month: string) => void;
  onShowPlan: (plan: CropPlan | null) => void;
  onSave: (result: ScheduleConfirmResult, plantingDate: string) => void;
  onAddFarm: () => void;
  onAddCustomCrop: (name: string, date: string) => void;
}

function plannerError(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 404 && error.response.data?.detail === 'Not Found') {
      return 'ক্যালেন্ডার API-তে প্রয়োজনীয় রুট পাওয়া যায়নি। AgriSphere চালু আছে কি না দেখে আবার চেষ্টা করুন।';
    }
    return getErrorMessage(error);
  }
  return error instanceof Error ? error.message : getErrorMessage(error);
}

export function SeasonalCropPlanner({ month, farm, onMonth, onShowPlan, onSave, onAddFarm, onAddCustomCrop }: SeasonalCropPlannerProps) {
  const { t, lang } = useLanguage();
  const [catalog, setCatalog] = useState<{ key: string; options: CropOption[] } | null>(null);
  const [selection, setSelection] = useState('');
  const [allCrops, setAllCrops] = useState<CropScheduleTemplate[]>();
  const [allCropsError, setAllCropsError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [customName, setCustomName] = useState('');
  const custom = selection === 'custom';
  const [sowing, setSowing] = useState<{ key: string; date: string } | null>(null);
  const [preview, setPreview] = useState<{ key: string; plan: CropPlan | null } | null>(null);
  const [loadedError, setLoadedError] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const farmId = farm?.id;
  const scopeKey = [month, farmId, farm?.division, retry].join('|');
  const options = catalog?.key === scopeKey ? catalog.options : null;
  const option = options?.find((entry) => entry.template_id === selection);
  const templateId = option?.template_id;
  const dateKey = month + '|' + selection;
  const sowingDate = sowing?.key === dateKey ? sowing.date : undefined;
  const requestKey = scopeKey + '|' + templateId + '|' + (sowingDate ?? '');
  const plan = preview?.key === requestKey ? preview.plan : null;
  const persistKey = [farmId, templateId, plan?.planting_date].join('|');
  const isSaved = savedKey === persistKey;
  const error = loadedError?.key === scopeKey || loadedError?.key === requestKey ? loadedError.message : '';
  const monthFormat = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-BD', { timeZone:'UTC', month:'long', year:'numeric' });
  const dateFormat = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-BD', { timeZone:'UTC', day:'numeric', month:'short', year:'numeric' });
  const readableDate = (date: string) => dateFormat.format(calendarDate(date));
  const availableIds = new Set(options?.map((item) => item.template_id));
  const otherCrops = allCrops?.filter((item) => !availableIds.has(item.template_id)) ?? [];
  const moveTo = options && selection && !option && !custom ? nextSowingMonth(selection, month) : undefined;
  const from = custom ? month + '-01' : option?.month_from;
  const to = custom ? shiftDays(shiftMonth(month + '-01',1),-1) : option?.month_to;
  const chosenDate = sowingDate ?? plan?.planting_date;
  const harvest = plan?.stages.find((stage) => stage.category === 'harvest_planning');
  const care = plan?.stages.filter((stage) => !['land_preparation','sowing','transplanting','harvest_planning'].includes(stage.category)) ?? [];

  useEffect(() => {
    const controller = new AbortController();
    loadCropCatalog(controller.signal).then((crops) => {
      if (!controller.signal.aborted) {
        setAllCrops(crops);
        setAllCropsError('');
      }
    }).catch((reason) => {
      if (!controller.signal.aborted) setAllCropsError(plannerError(reason));
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    loadCropMonth({ month, farm_id: farmId }, controller.signal).then(({ options }) => {
      if (!controller.signal.aborted) setCatalog({ key:scopeKey, options });
    }).catch((reason) => {
      if (!controller.signal.aborted) setLoadedError({ key:scopeKey, message:plannerError(reason) });
    });
    return () => controller.abort();
  }, [scopeKey, month, farmId]);

  useEffect(() => {
    if (!templateId) return;
    const controller = new AbortController();
    loadCropMonth({ month, farm_id:farmId, template_id:templateId, planting_date:sowingDate }, controller.signal).then(({ plan }) => {
      if (!controller.signal.aborted) setPreview({ key:requestKey, plan });
    }).catch((reason) => {
      if (!controller.signal.aborted) setLoadedError({ key:requestKey, message:plannerError(reason) });
    });
    return () => controller.abort();
  }, [requestKey, month, farmId, templateId, sowingDate]);

  useEffect(() => {
    onShowPlan(isSaved ? null : plan);
    return () => onShowPlan(null);
  }, [plan, isSaved, onShowPlan]);

  const updateMonth = (direction: number) => {
    const nextMonth = shiftMonth(month + '-01', direction).slice(0,7);
    setShowPicker(false);
    onMonth(nextMonth);
    setSaveError('');
  };

  const save = async () => {
    if (!plan || pending) return;
    if (!farmId) { onAddFarm(); return; }
    setPending(true);
    setSaveError('');
    try {
      const response = await saveCropPlan({ farm_id:farmId, template_id:plan.template_id, planting_date:plan.planting_date });
      setSavedKey(persistKey);
      onSave(response, plan.planting_date);
    } catch (reason) {
      setSaveError(plannerError(reason));
    } finally {
      setPending(false);
    }
  };

  return (
    <section id="acc-season-planner" className="acc-season" aria-labelledby="acc-season-title">
      <header className="acc-season-head">
        <span className="acc-season-icon"><Sprout size={22} /></span>
        <div><h2 id="acc-season-title">{t('মাস ধরে ফসল বাছাই','Find crops by month')}</h2>
          <p>{farm ? farmLocation(farm,lang === 'bn') + ' · ' + soilName(farm.soil_type,lang === 'bn') : t('খামার ছাড়াও বপন ও পরিচর্যার সূচি দেখতে পারবেন।','Explore crop schedules before adding a farm.')}</p></div>
      </header>

      <div className="acc-season-fields">
        <div className="acc-season-field">
          <span>{t('১. কোন মাসে বুনবেন?','1. Sowing month')}</span>
          <div className="acc-month-input">
            <button type="button" className="acc-button acc-icon" aria-label={t('আগের বপনের মাস','Previous sowing month')} disabled={pending || month === '2000-01'} onClick={() => updateMonth(-1)}><ChevronLeft size={17} /></button>
            <label><b aria-hidden="true">{monthFormat.format(calendarDate(month + '-01'))}</b>
              <input type="month" aria-label={t('বপনের মাস','Sowing month')} value={month} min="2000-01" max="2099-12" disabled={pending}
                onChange={(event) => {
                  if (/^(20\d{2})-(0[1-9]|1[0-2])$/.test(event.target.value)) { setShowPicker(false); onMonth(event.target.value); setSaveError(''); }
                }} />
            </label>
            <button type="button" className="acc-button acc-icon" aria-label={t('পরের বপনের মাস','Next sowing month')} disabled={pending || month === '2099-12'} onClick={() => updateMonth(1)}><ChevronRight size={17} /></button>
          </div>
        </div>
        <label className="acc-season-field">{t('২. কোন ফসল ফলাবেন?','2. Crop')}
          <select value={selection} disabled={pending} onChange={(event) => {
            setSelection(event.target.value); setSowing(null); setShowPicker(false); setSaveError('');
          }}>
            <option value="" disabled>{t('ফসল বেছে নিন','Choose a crop')}</option>
            {!!options?.length && <optgroup label={t('এই মাসে বপন করা যায়','Can be sown this month')}>
              {options.map((entry) => <option key={entry.template_id} value={entry.template_id}>{t(entry.crop_bn,entry.crop)} · {t(entry.season_bn,entry.season)}</option>)}
            </optgroup>}
            {otherCrops.length > 0 && <optgroup label={t('অন্য মাসের ফসল','Crops for other months')}>
              {otherCrops.map((entry) => <option key={entry.template_id} value={entry.template_id}>{t(entry.crop_bn,entry.crop)} · {t(entry.season_bn,entry.season)}</option>)}
            </optgroup>}
            <option value="custom">{t('অন্য ফসল · নিজে যোগ করুন','Other crop · add your own')}</option>
          </select>
        </label>
        <div className="acc-season-field">
          <span>{t('৩. বপনের তারিখ','3. Sowing date')}</span>
          <button type="button" className="acc-button acc-date-pick" disabled={!from || !to || pending} onClick={() => setShowPicker(true)}
            aria-haspopup="dialog" aria-label={t('বপনের তারিখ বেছে নিন','Choose a sowing date')}>
            <CalendarDays size={17} />{chosenDate ? readableDate(chosenDate) : t('ক্যালেন্ডার থেকে বেছে নিন','Choose from calendar')}
          </button>
          {from && to && <small className="acc-sowing-help">{readableDate(from)} – {readableDate(to)}</small>}
        </div>
      </div>

      {showPicker && from && to && <SowingDatePicker month={month} from={from} to={to} value={chosenDate} formatDate={readableDate}
        onClose={() => setShowPicker(false)} onSelect={(date) => {
          setSowing({key:dateKey,date}); setShowPicker(false); setSaveError('');
        }} />}
      {moveTo && moveTo !== month && <div className="acc-season-switch">
        <p>{t('এই মাসে নির্বাচিত ফসলের বপনের সময় নেই।','The selected crop has no sowing dates this month.')}</p>
        <button type="button" className="acc-button" onClick={() => { onMonth(moveTo); setSaveError(''); }}>
          {t('বপনের মাসে যান','Go to sowing month')} · {monthFormat.format(calendarDate(moveTo + '-01'))}
        </button>
      </div>}
      {options && selection && !option && !custom && (!moveTo || moveTo === month) && <p className="acc-season-note">
        {t('এই খামার বা মাসের জন্য নির্বাচিত ফসলের বপনের তারিখ পাওয়া যায়নি।','No sowing dates were found for this crop and farm or month.')}
      </p>}
      {allCropsError && <p className="acc-season-note">{t('অন্য মাসের ফসলের তালিকা লোড হয়নি।','Crops for other months could not be loaded.')} <button type="button" className="acc-button" onClick={() => setRetry((value) => value + 1)}>{t('আবার চেষ্টা করুন','Retry')}</button></p>}
      {custom && <div className="acc-season-switch">
        <label className="acc-season-field">{t('ফসলের নাম','Crop name')}<input value={customName} maxLength={100}
          onChange={(event) => setCustomName(event.target.value)} placeholder={t('যেমন আলু বা ভুট্টা','For example Potato or Maize')} /></label>
        <div><p>{t('এই ফসলের কাজ ও সম্ভাব্য ফসল কাটার তারিখ নিজে যোগ করতে পারবেন।','You can enter your own tasks and estimated harvest date for this crop.')}</p>
          <button type="button" className="acc-button acc-primary" disabled={customName.trim().length < 2 || !sowingDate}
            onClick={() => { if (sowingDate) onAddCustomCrop(customName.trim(),sowingDate); }}>
            {farmId ? t('ফসলের তথ্য যোগ করুন','Add crop details') : t('খামার তৈরি করুন','Create a farm')}
          </button></div>
      </div>}

      {error && <p className="acc-error" role="alert">{error}{' '}<button type="button" className="acc-button" onClick={() => setRetry((value) => value + 1)}>{t('আবার চেষ্টা করুন','Retry')}</button></p>}
      {!error && !selection && options?.length === 0 && <p className="acc-season-note">{t('এই মাসে বপনের জন্য যাচাই করা টেমপ্লেট নেই। অন্য মাস দেখুন অথবা হাতে কাজ যোগ করুন।','There is no verified sowing template for this month. Try another month or add a task yourself.')}</p>}
      {!error && !custom && (!options || (option && !plan)) && <p className="acc-season-note" role="status">{t('কৃষি পরিকল্পনা লোড হচ্ছে…','Loading crop plan…')}</p>}

      {plan && option && (
        <>
          <div className="acc-season-stages">
            <div><Sprout size={18} /><span>{t('বপন','Sow')}</span><strong>{readableDate(plan.planting_date)}</strong></div>
            <div><ClipboardList size={18} /><span>{t('পরিচর্যার সময়','Crop care')}</span><strong>{care.length ? readableDate(care[0].date) + ' – ' + readableDate(care[care.length - 1].end_date) : '—'}</strong></div>
            <div><Wheat size={18} /><span>{t('সম্ভাব্য ফসল কাটা','Estimated harvest')}</span><strong>{harvest ? readableDate(harvest.date) + ' – ' + readableDate(harvest.end_date) : readableDate(plan.harvest_date)}</strong></div>
          </div>
          <div className="acc-season-foot">
            <details><summary>{t('বপনের সময়সীমা ও সূত্র','Sowing window and sources')}</summary>
              <p>{readableDate(option.sowing_from)} – {readableDate(option.sowing_to)} · {option.source_agency}</p>
              {option.sources.map((url,index) => <a href={url} key={url} target="_blank" rel="noreferrer">{t('সরকারি সূত্র','Official source')} {index + 1} <ExternalLink size={13} /></a>)}
            </details>
            <button type="button" className="acc-button acc-primary" disabled={pending || isSaved} onClick={save}>
              <CalendarDays size={17} />{pending ? t('সংরক্ষণ হচ্ছে…','Saving…') : isSaved ? t('ক্যালেন্ডারে সেভ হয়েছে','Saved to calendar') : farmId ? t('ক্যালেন্ডারে সেভ করুন','Save to calendar') : t('খামার তৈরি করে সেভ করুন','Add a farm to save')}
            </button>
          </div>
          {saveError && <p className="acc-error" role="alert">{saveError}</p>}
        </>
      )}
    </section>
  );
}
