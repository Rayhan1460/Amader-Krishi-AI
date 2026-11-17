import {
  Sprout,
  Droplets,
  Layers,
  ShieldCheck,
  Sparkles,
  Calendar,
  ExternalLink,
  Info,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type {
  CropScheduleTemplate,
  CropScheduleTemplateStage,
  GeneratedTaskItem,
} from '../../types/index.ts';

interface GrowthTimelineProps {
  template?: CropScheduleTemplate | null;
  tasks?: GeneratedTaskItem[];
  plantingDate?: string;
  activeStageId?: string;
  onSelectStage?: (stageId: string) => void;
}

const CATEGORY_MAP: Record<string, { labelBn: string; labelEn: string; icon: any; color: string }> = {
  land_preparation: {
    labelBn: 'জমি প্রস্তুতি',
    labelEn: 'Land Prep',
    icon: Sprout,
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  },
  sowing: {
    labelBn: 'বীজ বপন',
    labelEn: 'Sowing',
    icon: Sprout,
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  },
  transplanting: {
    labelBn: 'চারা রোপণ',
    labelEn: 'Transplanting',
    icon: Sprout,
    color: 'text-green-400 bg-green-400/10 border-green-400/30',
  },
  irrigation: {
    labelBn: 'সেচ ব্যবস্থাপনা',
    labelEn: 'Irrigation',
    icon: Droplets,
    color: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  },
  nutrient_management: {
    labelBn: 'সুষম পুষ্টি ও সার',
    labelEn: 'Nutrients',
    icon: Layers,
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  },
  crop_observation: {
    labelBn: 'ফসল পরিদর্শন',
    labelEn: 'Scouting',
    icon: ShieldCheck,
    color: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  },
  harvest_planning: {
    labelBn: 'ফসল কর্তন ও সংগ্রহ',
    labelEn: 'Harvest Planning',
    icon: Sparkles,
    color: 'text-gold-400 bg-gold-400/10 border-gold-400/30',
  },
  general: {
    labelBn: 'সাধারণ খামার কাজ',
    labelEn: 'General',
    icon: Calendar,
    color: 'text-sage-300 bg-sage-400/10 border-sage-400/30',
  },
};

function toBnDigits(num: number | string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function GrowthTimeline({
  template,
  tasks,
  plantingDate,
  activeStageId,
  onSelectStage,
}: GrowthTimelineProps) {
  const { t, lang } = useLanguage();

  if (!template && (!tasks || tasks.length === 0)) {
    return (
      <div className="p-8 rounded-3xl bg-forest-950/70 border border-forest-800 text-center text-sage-300 font-bengali">
        <Info className="w-8 h-8 text-gold-400 mx-auto mb-2 opacity-70" />
        <p className="text-sm">
          {t('কোনো ফসলের টাইমলাইন নির্বাচন করা হয়নি। উপরে একটি ফসল বা টেমপ্লেট নির্বাচন করুন।', 'No crop timeline selected. Please select a crop or template above.')}
        </p>
      </div>
    );
  }

  const stages: CropScheduleTemplateStage[] = template?.stages || [];
  const cropTitle = template?.crop_bn || tasks?.[0]?.title || t('ফসল বৃদ্ধি পর্যায়ক্রম', 'Crop Growth Lifecycle');
  const agency = template?.source_agency || tasks?.[0]?.source_agency || 'BRRI / BAMIS / BARI';
  const sourceRef = template?.source_version || tasks?.[0]?.source_reference || 'Official Agricultural Standard';

  return (
    <div className="space-y-6 font-bengali">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-forest-950 via-forest-900 to-forest-950 border border-forest-750 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gold-400/20 text-gold-300 border border-gold-400/30">
                {template?.season_bn ? `${template.season_bn} মৌসুম` : t('বিজ্ঞানসম্মত সময়সূচি', 'Scientific Schedule')}
              </span>
              {template?.variety && (
                <span className="px-2 py-0.5 rounded-full text-[10px] text-sage-300 bg-forest-800/80 border border-forest-700">
                  {template.variety}
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-cream-50 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-400" />
              <span>{cropTitle} {t('— বৈজ্ঞানিক বৃদ্ধি পরিক্রমা', '— Growth Lifecycle Timeline')}</span>
            </h3>
            <p className="text-xs text-sage-300 mt-1 max-w-xl">
              {template?.recommended_sowing_window && (
                <span>
                  {t('অনুমোদিত বপন/রোপণ সময়কাল:', 'Recommended planting window:')}{' '}
                  <strong className="text-gold-300">{template.recommended_sowing_window}</strong>
                </span>
              )}
            </p>
          </div>

          {/* Agency Badge */}
          <div className="shrink-0 p-3 rounded-2xl bg-forest-900/90 border border-forest-750 text-right sm:text-right">
            <span className="text-[10px] text-sage-400 uppercase tracking-wider block font-mono">
              {t('গবেষণা ও তথ্য উৎস', 'Source Provenance')}
            </span>
            <span className="text-xs font-bold text-cream-100 flex items-center justify-end gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{agency}</span>
            </span>
            <span className="text-[10px] text-gold-400/90 block mt-0.5 font-mono">
              {sourceRef}
            </span>
            {template?.source_url && (
              <a
                href={template.source_url.split(" & ")[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline mt-1"
              >
                <span>{t('সরকারি সূত্র দেখুন', 'View Official Source')}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>

        {template?.limitations && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">{t('গুরুত্বপূর্ণ সীমাবদ্ধতা ও সতর্কতা:', 'Important Advisory & Limitations:')} </strong>
              <span>{template.limitations}</span>
            </div>
          </div>
        )}
      </div>

      {/* Visual Timeline Cards */}
      <div className="relative pl-6 sm:pl-8 border-l-2 border-forest-800 space-y-6 ml-2 sm:ml-4">
        {stages.map((stage, idx) => {
          const meta = CATEGORY_MAP[stage.recommended_category] || CATEGORY_MAP.general;
          const IconComp = meta.icon;
          const isSelected = activeStageId === stage.stage_id;

          const dayText =
            lang === 'bn'
              ? `দিন ${toBnDigits(stage.day_offset_start)} – ${toBnDigits(stage.day_offset_end)}`
              : `Day ${stage.day_offset_start} – ${stage.day_offset_end}`;

          // Correlate with calculated date if planting date is provided
          let calculatedDateStr: string | null = null;
          if (plantingDate) {
            try {
              const dt = new Date(plantingDate);
              dt.setDate(dt.getDate() + stage.day_offset_start);
              calculatedDateStr = dt.toISOString().split('T')[0];
            } catch {
              calculatedDateStr = null;
            }
          }

          return (
            <div
              key={stage.stage_id || idx}
              onClick={() => onSelectStage?.(stage.stage_id)}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-forest-900 border-gold-500 shadow-xl'
                  : 'bg-forest-950 hover:bg-forest-900/80 border-forest-800 hover:border-forest-700'
              }`}
            >
              {/* Dot on timeline line */}
              <div
                className={`absolute -left-[31px] sm:-left-[39px] top-6 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-gold-500 border-cream-50 scale-110 shadow-md shadow-gold-500/50'
                    : 'bg-forest-900 border-forest-700 group-hover:border-gold-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-forest-950' : 'bg-gold-400'}`} />
              </div>

              {/* Stage Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gold-300 bg-gold-400/10 px-2.5 py-0.5 rounded-lg border border-gold-400/20">
                    {dayText}
                  </span>
                  {calculatedDateStr && (
                    <span className="text-[11px] font-mono text-sage-300 bg-forest-900 px-2 py-0.5 rounded-lg border border-forest-800">
                      📅 {calculatedDateStr}
                    </span>
                  )}
                  {stage.is_optional && (
                    <span className="text-[10px] text-sage-400 border border-sage-500/30 px-1.5 py-0.2 rounded">
                      {t('ঐচ্ছিক', 'Optional')}
                    </span>
                  )}
                </div>

                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.color}`}>
                  <IconComp className="w-3 h-3" />
                  <span>{lang === 'bn' ? meta.labelBn : meta.labelEn}</span>
                </span>
              </div>

              {/* Stage Title */}
              <h4 className="text-base sm:text-lg font-bold text-cream-50 group-hover:text-gold-200 transition-colors">
                {stage.stage_name_bn}
                <span className="text-xs font-normal text-sage-400 ml-2 font-mono">
                  ({stage.stage_name})
                </span>
              </h4>

              {/* Agronomic Action Instruction */}
              <div className="mt-2.5 p-3 rounded-xl bg-forest-900/90 border border-forest-800/80 text-xs text-cream-100 leading-relaxed">
                <strong className="text-emerald-400 font-semibold">{t('করণীয় কাজ:', 'Recommended Action:')} </strong>
                <span>{stage.action_bn}</span>
              </div>

              {/* Technical / Agronomic Notes */}
              {stage.notes_bn && (
                <p className="mt-2 text-xs text-sage-300 leading-relaxed">
                  <span className="text-gold-400 font-medium">💡 {t('পরামর্শ:', 'Agronomic Note:')} </span>
                  {stage.notes_bn}
                </p>
              )}

              {/* Scientific Basis Footer */}
              <div className="mt-3 pt-2.5 border-t border-forest-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-sage-400">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{t('বৈজ্ঞানিক ভিত্তি:', 'Basis:')} {stage.scientific_basis}</span>
                </span>
                <span className="font-mono text-[10px] text-sage-400">
                  {stage.source_reference}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
