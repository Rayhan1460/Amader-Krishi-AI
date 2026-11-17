import { isAxiosError } from 'axios';
import { api, calendarApi, farmApi } from '../../services/api.ts';
import type { CropScheduleTemplate, ScheduleConfirmResult } from '../../types/index.ts';
import { shiftDays, shiftMonth, todayInDhaka } from './calendarDates.ts';

export interface CropOption {
  template_id: string;
  crop: string;
  crop_bn: string;
  season: string;
  season_bn: string;
  sowing_from: string;
  sowing_to: string;
  month_from: string;
  month_to: string;
  source_agency: string;
  sources: string[];
}

export interface CropStage {
  id: string;
  title: string;
  title_en: string;
  category: string;
  date: string;
  end_date: string;
  action: string;
  action_en: string;
  source: string;
}

export interface CropPlan {
  template_id: string;
  planting_date: string;
  harvest_date: string;
  stages: CropStage[];
}

interface MonthlyCropResponse {
  month: string;
  options: CropOption[];
  plan: CropPlan | null;
}

type CropMonthRequest = { month: string; farm_id?: number; template_id?: string; planting_date?: string };
type CropPlanSave = { farm_id: number; template_id: string; planting_date: string };

// Only fall back for an unregistered route. Ownership and validation responses
// from the new API must reach the caller unchanged.
function isMissingRoute(error: unknown) {
  return isAxiosError(error) && error.response?.status === 404 && error.response.data?.detail === 'Not Found';
}

// Older template endpoints return the sowing windows as display text.
const sowingWindows: Record<string, readonly [string, string]> = {
  bamis_brri_boro_rice_v1: ['11-15', '12-15'],
  bamis_brri_aman_rice_v1: ['06-15', '07-15'],
  bamis_brri_aus_rice_v1: ['03-15', '04-15'],
  bamis_bari_winter_tomato_v1: ['09-15', '10-15'],
};
export async function loadCropCatalog(signal: AbortSignal) {
  const { data } = await api.get<CropScheduleTemplate[]>('/calendar/schedule/templates', { signal });
  if (!Array.isArray(data)) throw new Error('ফসলের তালিকা পাওয়া যায়নি।');
  return data.filter((template) => sowingWindows[template.template_id] && template.stages.length);
}

export function nextSowingMonth(templateId: string, month: string) {
  const window = sowingWindows[templateId];
  if (!window) return undefined;
  const start = window[0].slice(0,2);
  const end = window[1].slice(0,2);
  const displayed = month.slice(5,7);
  if (displayed >= start && displayed <= end) return month;
  const year = Number(month.slice(0,4)) + (displayed > end ? 1 : 0);
  return year <= 2099 ? String(year) + '-' + start : undefined;
}

const minDate = (a: string, b: string) => a < b ? a : b;
const maxDate = (a: string, b: string) => a > b ? a : b;

function monthOptions(templates: CropScheduleTemplate[], month: string, division?: string): CropOption[] {
  const first = month + '-01';
  const last = shiftDays(shiftMonth(first, 1), -1);
  return templates.flatMap((template) => {
    const window = sowingWindows[template.template_id];
    if (!window || !template.stages.length || (division && !template.applicable_regions.some((region) => region.toLowerCase() === division.toLowerCase()))) {
      return [];
    }
    const year = month.slice(0, 4);
    const sowingFrom = year + '-' + window[0];
    const sowingTo = year + '-' + window[1];
    const monthFrom = maxDate(first, sowingFrom);
    const monthTo = minDate(last, sowingTo);
    if (monthFrom > monthTo) return [];
    return [{
      template_id: template.template_id,
      crop: template.crop,
      crop_bn: template.crop_bn,
      season: template.season,
      season_bn: template.season_bn,
      sowing_from: sowingFrom,
      sowing_to: sowingTo,
      month_from: monthFrom,
      month_to: monthTo,
      source_agency: template.source_agency,
      sources: template.source_url.split(' & '),
    }];
  });
}

async function loadFromTemplates(params: CropMonthRequest, signal: AbortSignal): Promise<MonthlyCropResponse> {
  const [response, farm] = await Promise.all([
    api.get<CropScheduleTemplate[]>('/calendar/schedule/templates', { signal }),
    params.farm_id === undefined ? undefined : api.get<{ division: string }>(`/farms/${params.farm_id}`, { signal }),
  ]);
  const templates = response.data;
  if (!Array.isArray(templates)) throw new Error('কৃষি ক্যালেন্ডারের টেমপ্লেট API থেকে তথ্য পাওয়া যায়নি।');
  const options = monthOptions(templates, params.month, farm?.data.division);
  if (!params.template_id) return { month: params.month, options, plan: null };
  const option = options.find((entry) => entry.template_id === params.template_id);
  const template = templates.find((entry) => entry.template_id === params.template_id);
  if (!option || !template) throw new Error('এই মাসে নির্বাচিত ফসলের বপনের সময় নেই।');
  const planting = params.planting_date ?? minDate(maxDate(todayInDhaka(), option.month_from), option.month_to);
  if (planting < option.month_from || planting > option.month_to) {
    throw new Error('এই ফসলের বপনের সময়সীমার মধ্যে একটি তারিখ বেছে নিন।');
  }
  return {
    month: params.month,
    options,
    plan: {
      template_id: template.template_id,
      planting_date: planting,
      harvest_date: shiftDays(planting, Math.max(...template.stages.map((stage) => stage.day_offset_end))),
      stages: template.stages.map((stage, index) => ({
        id: `gen_${stage.stage_id}_${index}`,
        title: stage.stage_name_bn,
        title_en: stage.stage_name,
        category: stage.recommended_category,
        date: shiftDays(planting, stage.day_offset_start),
        end_date: shiftDays(planting, stage.day_offset_end),
        action: stage.action_bn,
        action_en: stage.action_en,
        source: stage.source_reference ?? '',
      })),
    },
  };
}

export async function loadCropMonth(params: CropMonthRequest, signal: AbortSignal) {
  try {
    const response = await api.get<MonthlyCropResponse>('/calendar/crop-planner', { params, signal });
    if (Array.isArray(response.data?.options)) return response.data;
    // Older dev servers can return their HTML page for an unknown route.
    if (typeof response.data !== 'string' || !/^\s*</.test(response.data)) {
      throw new Error('কৃষি পরিকল্পনার API থেকে সঠিক তথ্য পাওয়া যায়নি।');
    }
  } catch (error) {
    if (!isMissingRoute(error)) throw error;
  }
  return loadFromTemplates(params, signal);
}

async function saveThroughExistingApi(params: CropPlanSave) {
  const [templates, farm, crops] = await Promise.all([
    calendarApi.getTemplates(),
    farmApi.getFarm(params.farm_id),
    farmApi.listCropsForFarm(params.farm_id),
  ]);
  const month = params.planting_date.slice(0, 7);
  const choice = monthOptions(templates, month, farm.division).find((option) => option.template_id === params.template_id);
  if (!choice || params.planting_date < choice.month_from || params.planting_date > choice.month_to) {
    throw new Error('এই ফসলের বপনের সময়সীমার মধ্যে একটি তারিখ বেছে নিন।');
  }
  const cropNames = [choice.crop, choice.crop_bn];
  if (choice.crop.endsWith(' Rice')) cropNames.push('Rice', 'ধান');
  if (choice.crop === 'Tomato') cropNames.push('টমেটো');
  const crop = crops.find((item) => item.sowing_date === params.planting_date && item.season === choice.season &&
    cropNames.some((name) => name.toLowerCase() === item.crop_name.trim().toLowerCase()))
    ?? await farmApi.addCrop(params.farm_id, {
      crop_name: choice.crop,
      season: choice.season,
      sowing_date: params.planting_date,
      status: 'planned',
    });
  const draft = await calendarApi.generateSchedule({ farm_id: params.farm_id, crop_id: crop.id, planting_date: params.planting_date });
  if (draft.status !== 'success' || draft.template_id !== params.template_id || !draft.tasks.length) {
    throw new Error('এই ফসলের কাজের সূচি তৈরি করা যায়নি।');
  }
  return calendarApi.confirmSchedule({
    farm_id: params.farm_id,
    crop_id: crop.id,
    template_id: draft.template_id,
    planting_date: draft.planting_date,
    schedule_hash: draft.schedule_hash,
    tasks: draft.tasks,
  });
}

// Older servers create a crop then save its schedule in separate requests.
// Reuse an in-flight save so repeated clicks share one request sequence.
const pendingSaves = new Map<string, Promise<ScheduleConfirmResult>>();

export function saveCropPlan(params: CropPlanSave) {
  const key = JSON.stringify(params);
  const existing = pendingSaves.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const response = await api.post<ScheduleConfirmResult>('/calendar/crop-planner/save', params);
      if (response.data?.success) return response.data;
      throw new Error('কৃষি পরিকল্পনা সেভের নিশ্চিতকরণ পাওয়া যায়নি।');
    } catch (error) {
      if (!isMissingRoute(error)) throw error;
      return saveThroughExistingApi(params);
    }
  })().finally(() => { pendingSaves.delete(key); });

  pendingSaves.set(key, request);
  return request;
}
