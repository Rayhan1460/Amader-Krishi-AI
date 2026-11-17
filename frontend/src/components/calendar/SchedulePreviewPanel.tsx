import { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sprout,
  Save,
  Check,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type {
  ScheduleGenerateResult,
  GeneratedTaskItem,
  FarmProfile,
  FarmWeatherForecastResponse,
} from '../../types/index.ts';
import { farmLocation, soilName } from './CalendarFarmProfile.tsx';
import { CalendarModal } from './CalendarModal.tsx';

interface SchedulePreviewPanelProps {
  preview: ScheduleGenerateResult;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tasks: GeneratedTaskItem[]) => Promise<void>;
  isConfirming: boolean;
  farm?: FarmProfile;
  forecast?: FarmWeatherForecastResponse | null;
  errorMessage?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  land_preparation: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  sowing: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  transplanting: 'text-green-400 bg-green-400/10 border-green-400/30',
  irrigation: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  nutrient_management: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  crop_observation: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  harvest_planning: 'text-gold-400 bg-gold-400/10 border-gold-400/30',
  general: 'text-sage-300 bg-sage-400/10 border-sage-400/30',
};

export function SchedulePreviewPanel({
  preview,
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  farm,
  forecast,
  errorMessage,
}: SchedulePreviewPanelProps) {
  const { t, lang } = useLanguage();
  const bn = lang === 'bn';
  const number = new Intl.NumberFormat(bn ? 'bn-BD' : 'en-BD');
  const forecastByDate = new Map((forecast?.status === 'unavailable' ? [] : forecast?.forecast ?? []).map((day) => [day.date, day]));
  const [editableTasks, setEditableTasks] = useState<GeneratedTaskItem[]>(preview.tasks);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleToggleInclude = (index: number) => {
    setEditableTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, included: !item.included } : item))
    );
  };

  const handleDateChange = (index: number, newDate: string) => {
    setEditableTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, due_date: newDate } : item))
    );
  };

  const includedCount = editableTasks.filter((t) => t.included).length;
  const invalidDates = editableTasks.some((task) => task.included && !task.due_date);

  const handleSave = async () => {
    await onConfirm(editableTasks);
  };

  return (
    <CalendarModal labelId="acc-schedule-preview-title" onClose={onClose} pending={isConfirming}>
      <div className="bg-forest-950 border border-forest-750 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-cream-50">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-forest-800 bg-gradient-to-r from-forest-900 via-forest-950 to-forest-900 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gold-400/20 text-gold-400 flex items-center justify-center border border-gold-400/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-400/20 text-gold-300 font-mono">
                    Phase F4B
                  </span>
                  <h3 id="acc-schedule-preview-title" className="font-bold text-lg sm:text-xl text-cream-50">
                    {t('বিজ্ঞানসম্মত কৃষি সময়সূচি পর্যালোচনা ও অনুমোদন', 'Scientific Crop Schedule Review & Confirmation')}
                  </h3>
                </div>
                <p className="text-xs text-sage-300 mt-0.5">
                  {t('কার্যক্রমগুলো পর্যালোচনা করুন, প্রয়োজন অনুযায়ী তারিখ পরিবর্তন করুন এবং ক্যালেন্ডারে সংরক্ষণ করুন।', 'Review recommended tasks, adapt dates to your soil/field condition, and save to calendar.')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('বন্ধ করুন','Close')}
              disabled={isConfirming}
              className="p-1.5 rounded-xl hover:bg-forest-800 text-sage-400 hover:text-cream-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {errorMessage && <p className="acc-error" role="alert">{errorMessage}</p>}
          {farm && <p className="acc-plan-context">{t('খামারের অবস্থান ও মাটি','Farm location and soil')} · {farmLocation(farm,bn)} · {soilName(farm.soil_type,bn)}</p>}
          {preview.status === 'success' && <p className="acc-plan-context">
            {t('পূর্বাভাস পাওয়া গেলে কাজের তারিখের পাশে দেখানো হবে। সেচের সময় ঠিক করার আগে জমির মাটির আর্দ্রতা দেখে নিন।','Available forecasts appear beside each task date. Check soil moisture before setting irrigation dates.')}
          </p>}
          {/* Metadata Card */}
          <div className="p-4 rounded-2xl bg-forest-900/90 border border-forest-750 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-sage-400 block text-[11px]">{t('খামার', 'Farm')}</span>
              <strong className="text-cream-50 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span>{preview.farm_name}</span>
              </strong>
            </div>

            <div>
              <span className="text-sage-400 block text-[11px]">{t('ফসল ও জাত', 'Crop & Variety')}</span>
              <strong className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <Sprout className="w-3.5 h-3.5 shrink-0" />
                <span>{preview.crop_name_bn || preview.crop_name}</span>
              </strong>
            </div>

            <div>
              <span className="text-sage-400 block text-[11px]">{t('রোপণ / বপনের তারিখ', 'Planting Date')}</span>
              <strong className="text-gold-300 font-mono text-[13px] block mt-0.5">
                📅 {preview.planting_date}
              </strong>
            </div>

            <div>
              <span className="text-sage-400 block text-[11px]">{t('সম্ভাব্য কর্তনকাল', 'Est. Harvest Date')}</span>
              <strong className="text-gold-400 font-mono text-[13px] block mt-0.5">
                🌾 {preview.estimated_harvest_date}
              </strong>
            </div>
          </div>

          {/* Scientific Provenance Banner */}
          <div className="p-3.5 rounded-2xl bg-forest-900/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold text-cream-100">
                  {t('সরকারি গবেষণা নির্দেশিকা:', 'Official Agricultural Standard:')}{' '}
                  <span className="text-gold-300">{preview.source_agency}</span>
                </span>
                <span className="text-[11px] text-sage-400 block">
                  {t('রেফারেন্স সংস্করণ:', 'Version:')} {preview.source_version}
                </span>
              </div>
            </div>

            {preview.source_url && (
              <a
                href={preview.source_url.split(" & ")[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-forest-800 hover:bg-forest-750 text-sky-400 text-[11px] border border-forest-700 shrink-0 self-start sm:self-auto"
              >
                <span>{t('সরকারি সূত্র যাচাই', 'Verify Source')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Warnings & Recommendations */}
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs space-y-1">
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Already Generated Notice */}
          {preview.already_generated && (
            <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-600/40 text-sky-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {t(
                  'এই ফসল ও বপন তারিখের জন্য ইতোমধ্যে ক্যালেন্ডারে সময়সূচি সংরক্ষিত রয়েছে। বিদ্যমান কাজ বদলাতে ক্যালেন্ডারে গিয়ে তারিখ সম্পাদনা করুন।',
                  'A schedule has already been generated and saved for this crop and planting date. To change a saved task, edit its date in the calendar.'
                )}
              </span>
            </div>
          )}

          {/* Unsupported crop fallback display */}
          {preview.status === 'unsupported' ? (
            <div className="p-6 rounded-2xl bg-forest-900/60 border border-forest-800 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <h4 className="font-bold text-base text-cream-100">
                {t('এই ফসলের জন্য স্বয়ংক্রিয় টেমপ্লেট প্রস্তুতিাধীন', 'Template in Preparation for this Crop')}
              </h4>
              <p className="text-sage-300 max-w-md mx-auto">
                {t(preview.support_message_bn ?? '',preview.support_message_en ?? '') || t('বর্তমানে বোরো ধান, আমন ধান, আউশ ধান এবং শীতকালীন টমেটোর জন্য শতভাগ ভেরিফায়েড টেমপ্লেট সক্রিয় রয়েছে।', 'Verified templates are currently available for Boro, Aman, Aus Rice and Winter Tomato.')}
              </p>
              <p className="text-xs text-gold-300">
                {t('আপনি ক্যালেন্ডারের "+ নতুন কাজ যোগ করুন" বোতাম দিয়ে সহজেই আপনার ব্যক্তিগত সময়সূচি তৈরি করতে পারেন।', 'You can easily add custom farming tasks anytime using "+ Add New Task".')}
              </p>
            </div>
          ) : (
            /* Tasks Review List */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-sage-300 pb-1 border-b border-forest-800">
                <span className="font-semibold text-cream-100">
                  {t('প্রস্তাবিত কৃষি কার্যক্রম তালিকা', 'Recommended Farming Activities')} ({includedCount}/{editableTasks.length} {t('নির্বাচিত', 'selected')})
                </span>
                <span className="text-[11px] text-sage-400">
                  {t('তারিখ পরিবর্তনযোগ্য • ঐচ্ছিক কাজ বাদ দেওয়া যাবে', 'Dates are editable • Optional tasks can be toggled')}
                </span>
              </div>

              {editableTasks.map((task, idx) => {
                const isExpanded = expandedIndex === idx;
                const dayForecast = forecastByDate.get(task.due_date);
                const catColor = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.general;

                return (
                  <div
                    key={task.temp_id || idx}
                    className={`rounded-2xl border transition-all ${
                      task.included
                        ? 'bg-forest-900/80 border-forest-750'
                        : 'bg-forest-950/50 border-forest-900 opacity-60'
                    }`}
                  >
                    <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Checkbox & Title */}
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleInclude(idx)}
                          aria-label={task.title}
                          aria-pressed={task.included}
                          className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            task.included
                              ? 'bg-gold-500 border-gold-400 text-forest-950'
                              : 'bg-forest-900 border-forest-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-sage-400">
                              #{idx + 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catColor}`}>
                              {task.category}
                            </span>
                            {task.is_optional && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-forest-800 text-sage-400 border border-forest-700">
                                {t('ঐচ্ছিক', 'Optional')}
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-cream-50 leading-snug">
                            {task.title}
                          </h4>
                        </div>
                      </div>

                      {/* Date & Controls */}
                      <div className="flex items-center gap-2 pl-8 sm:pl-0 shrink-0">
                        <div>
                          <label className="text-[10px] text-sage-400 block mb-0.5">{t('নির্ধারিত তারিখ', 'Due Date')}</label>
                          <input
                            type="date"
                            aria-label={t('কাজের তারিখ','Task date') + ' · ' + task.title}
                            value={task.due_date}
                            disabled={!task.included}
                            onChange={(e) => handleDateChange(idx, e.target.value)}
                            className="px-2 py-1 rounded-xl bg-forest-950 border border-forest-700 text-gold-300 font-mono text-xs focus:outline-none focus:border-gold-500 disabled:opacity-50"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                          aria-expanded={isExpanded}
                          aria-label={t('কাজের বিস্তারিত','Task details')}
                          className="mt-3 p-1.5 rounded-lg hover:bg-forest-800 text-sage-400 hover:text-cream-50 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {dayForecast && <p className="acc-plan-context px-4 pb-2">
                      {t(dayForecast.condition_bn,dayForecast.condition_en)} · {t('বৃষ্টির সম্ভাবনা','Rain chance')} {number.format(dayForecast.precipitation_probability_max)}%
                    </p>}
                    {/* Expandable Agronomic Detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-forest-800/60 text-xs space-y-2 bg-forest-950/40">
                        <div className="p-2.5 rounded-xl bg-forest-900 border border-forest-800 text-sage-200 leading-relaxed whitespace-pre-line">
                          {task.notes}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-sage-400 pt-1">
                          <span>
                            <strong>{t('বৈজ্ঞানিক ভিত্তি:', 'Basis:')}</strong> {task.scientific_basis}
                          </span>
                          <span className="font-mono text-[10px]">
                            {task.source_reference}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-forest-800 bg-forest-950 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-850 text-sage-300 transition-colors cursor-pointer text-xs"
          >
            {t('বাতিল', 'Cancel')}
          </button>

          {preview.status === 'success' && (
            <button
              type="button"
              disabled={isConfirming || includedCount === 0 || invalidDates || preview.already_generated}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-forest-950 font-bold text-xs border border-gold-400 shadow-lg disabled:opacity-50 cursor-pointer transition-all hover:scale-[1.02]"
            >
              {isConfirming ? (
                <span>{t('ক্যালেন্ডারে সংরক্ষণ হচ্ছে...', 'Saving to Calendar...')}</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    {t(
                      `পরিকল্পনা নিশ্চিত ও সংরক্ষণ করুন (${includedCount}টি কাজ)`,
                      `Confirm & Save to Calendar (${includedCount} tasks)`
                    )}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </CalendarModal>
  );
}
