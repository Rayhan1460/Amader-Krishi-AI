import { useMemo } from 'react';
import { CheckCircle2, ArrowRight, AlertCircle, Sprout } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { FarmTaskSummaryItem } from '../../../types/index.ts';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface TodayFarmTasksCardProps {
  tasks?: FarmTaskSummaryItem[];
  overdueTasks?: FarmTaskSummaryItem[];
  allTasks?: FarmTaskSummaryItem[];
  onNavigateToTab: (tab: WorkspaceTab) => void;
  isLoading?: boolean;
}

export function TodayFarmTasksCard({
  tasks = [],
  overdueTasks = [],
  allTasks = [],
  onNavigateToTab,
  isLoading = false,
}: TodayFarmTasksCardProps) {
  const { lang, t } = useLanguage();

  // Combine relevant tasks: overdue first, then today's/upcoming pending tasks
  const displayTasks = useMemo(() => {
    const list: (FarmTaskSummaryItem & { isOverdue?: boolean })[] = [];
    
    // Add overdue tasks marked
    overdueTasks.forEach((t) => {
      if (t.status !== 'completed') {
        list.push({ ...t, isOverdue: true });
      }
    });

    // Add today/pending tasks not already in list
    tasks.forEach((t) => {
      if (!list.some((existing) => existing.id === t.id) && t.status !== 'completed') {
        list.push(t);
      }
    });

    // Fallback: if list is empty, take any pending tasks from allTasks
    if (list.length === 0) {
      allTasks
        .filter((t) => t.status === 'pending' || t.status === 'in_progress')
        .slice(0, 4)
        .forEach((t) => list.push(t));
    }

    return list.slice(0, 4);
  }, [tasks, overdueTasks, allTasks]);

  return (
    <div className="bg-[#082b1f] border border-[#1b4332] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-[#1b4332]/80">
      <div>
        {/* Card Header matching 02_dashboard_reference.png */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {lang === 'bn' ? 'আজকের খামারের কাজ' : "Today's Farm Tasks"}
            </h2>
            {displayTasks.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#153f2e] text-[#e9ad46] border border-[#e9ad46]/20">
                {displayTasks.length}
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigateToTab('calendar')}
            className="text-xs font-medium text-[#a7b9ae] hover:text-[#e9ad46] transition-colors flex items-center gap-1"
          >
            <span>{t('সকল কাজ', 'View All')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#062519] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#062519] flex items-center justify-center text-[#a7b9ae] mb-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">
              {lang === 'bn' ? 'আজকের কোনো কাজ বাকি নেই!' : 'No tasks scheduled for today'}
            </p>
            <p className="text-xs text-[#a7b9ae] mt-1 max-w-xs">
              {lang === 'bn'
                ? 'কৃষি ক্যালেন্ডার থেকে নতুন কাজ যোগ করতে পারেন।'
                : 'Plan upcoming irrigation, fertilizing, or crop care in the calendar.'}
            </p>
            <button
              onClick={() => onNavigateToTab('calendar')}
              className="mt-3.5 px-3 py-1.5 rounded-lg bg-[#153f2e] hover:bg-[#1e5841] text-xs font-semibold text-[#e9ad46] border border-[#e9ad46]/30 transition-all cursor-pointer"
            >
              {lang === 'bn' ? '+ নতুন কাজ যোগ করুন' : '+ Open Calendar'}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onNavigateToTab('calendar')}
                className="group flex items-center justify-between p-3 rounded-xl bg-[#062519]/80 hover:bg-[#0d3625] border border-transparent hover:border-[#e9ad46]/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      task.isOverdue
                        ? 'text-amber-400'
                        : task.status === 'completed'
                        ? 'text-emerald-400'
                        : 'text-[#e9ad46]/80 group-hover:text-[#e9ad46]'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-white truncate group-hover:text-amber-200 transition-colors">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#a7b9ae]">
                      {task.crop_name && (
                        <span className="flex items-center gap-1 text-[#e9ad46]/90">
                          <Sprout className="w-3 h-3" />
                          <span>{task.crop_name}</span>
                        </span>
                      )}
                      {task.isOverdue ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />
                          {t('বাকি পড়েছে', 'Overdue')}
                        </span>
                      ) : (
                        <span>{task.due_date}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs font-mono font-medium text-[#a7b9ae] group-hover:text-white transition-colors">
                    {task.due_time || (task.due_date ? task.due_date.slice(5) : '08:00')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer link to calendar */}
      <div className="mt-4 pt-3 border-t border-[#1b4332]/60 flex items-center justify-between text-xs text-[#a7b9ae]">
        <span>
          {lang === 'bn'
            ? 'কার্যসূচি পরিবর্তনের জন্য ক্যালেন্ডার দেখুন'
            : 'View full schedule in Agricultural Calendar'}
        </span>
        <button
          onClick={() => onNavigateToTab('calendar')}
          className="text-[#e9ad46] font-semibold hover:underline inline-flex items-center gap-1"
        >
          <span>{lang === 'bn' ? 'ক্যালেন্ডার খুলুন' : 'Open Calendar'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
