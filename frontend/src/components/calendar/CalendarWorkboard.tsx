import { useMemo } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { CalendarTask } from '../../types/index.ts';
import type { CropStage } from './cropPlannerApi.ts';
import { calendarDate, shiftDays, shiftMonth, weekStart } from './calendarDates.ts';

export type CalendarView = 'month' | 'week' | 'agenda';

interface CalendarWorkboardProps {
  view: CalendarView;
  today: string;
  date: string;
  tasks: CalendarTask[];
  previewStages?: CropStage[];
  cropDates: CropStage[];
  hasFarm: boolean;
  isLoading: boolean;
  isActionPending: boolean;
  onChangeDate: (date: string) => void;
  onChangeView: (view: CalendarView) => void;
  onAdd: (date: string) => void;
  onEdit: (task: CalendarTask) => void;
  onToggle: (task: CalendarTask) => void;
  onDelete: (task: CalendarTask) => void;
}

export function CalendarWorkboard({ view, today, date, tasks, previewStages, cropDates, hasFarm, isLoading, isActionPending, onChangeDate, onChangeView, onAdd, onEdit, onToggle, onDelete }: CalendarWorkboardProps) {
  const { t, lang } = useLanguage();
  const locale = lang === 'bn' ? 'bn-BD' : 'en-BD';
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const shortDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dayNumber = new Intl.NumberFormat(locale);
  const weekdays = lang === 'bn' ? ['শনি','রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র'] : ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
  const dayTasks = useMemo(() => {
    const byDate = new Map<string,CalendarTask[]>();
    const sorted = [...tasks].sort((a,b) => a.due_date.localeCompare(b.due_date) || (a.due_time ?? '').localeCompare(b.due_time ?? ''));
    for (const task of sorted) {
      const list = byDate.get(task.due_date) ?? [];
      list.push(task);
      byDate.set(task.due_date,list);
    }
    return byDate;
  }, [tasks]);
  const first = shiftMonth(date,0);
  const firstCell = view === 'month' ? weekStart(first) : weekStart(date);
  const nextMonth = shiftMonth(date,1);
  const lastCell = view === 'month' ? shiftDays(weekStart(shiftDays(nextMonth,-1)),6) : shiftDays(firstCell,6);
  const calendarDays = [];
  for (let cell = firstCell; cell <= lastCell; cell = shiftDays(cell,1)) calendarDays.push(cell);
  const previewByDate = useMemo(() => {
    const dates = new Map<string, CropStage[]>();
    for (const stage of previewStages ?? []) {
      const stages = dates.get(stage.date) ?? [];
      stages.push(stage);
      dates.set(stage.date, stages);
    }
    return dates;
  }, [previewStages]);
  const selectedTasks = dayTasks.get(date) ?? [];
  const selectedStages = previewByDate.get(date) ?? [];
  const savedCropDates = new Map<string, CropStage[]>();
  for (const item of cropDates) {
    const items = savedCropDates.get(item.date) ?? [];
    items.push(item);
    savedCropDates.set(item.date, items);
  }
  const selectedCropDates = savedCropDates.get(date) ?? [];
  const otherTaskDates = [...dayTasks.keys()].filter((key) => key !== date);
  const navigate = (step: number) => onChangeDate(view === 'month' ? shiftMonth(date,step) : shiftDays(date,step * 7));
  const taskRows = (items: CalendarTask[]) => (
    <ul className="acc-task-list">
      {items.map((task) => {
        const completed = task.status === 'completed';
        const overdue = task.status === 'pending' && task.due_date < today;
        const time = task.due_time?.slice(0,5);
        return (
          <li key={task.id} className="acc-task" data-category={task.category} data-completed={completed}>
            <button type="button" className="acc-button acc-icon acc-check" disabled={isActionPending} onClick={() => onToggle(task)}
              aria-label={completed ? t('কাজ আবার চালু করুন','Reopen task') : t('সম্পন্ন করুন','Mark complete')} aria-pressed={completed}>
              {completed ? <Check size={17} /> : <Circle size={17} />}
            </button>
            <div className="acc-task-text"><strong>{task.title}</strong>
              <small>{[time && (lang === 'bn' ? time.replace(/\d/g, (n) => '০১২৩৪৫৬৭৮৯'[Number(n)]) : time), task.crop_name, task.farm_name, overdue && t('সময় পেরিয়েছে','Overdue')].filter(Boolean).join(' · ')}</small>
              {task.notes && <details><summary>{t('নোট দেখুন','View notes')}</summary><p>{task.notes}</p></details>}
              {task.source_org && <small>{task.source_org}</small>}
            </div>
            <div className="acc-task-buttons">
              <button type="button" className="acc-button acc-icon" disabled={isActionPending} onClick={() => onEdit(task)} aria-label={t('কাজের সময় বদলান','Reschedule task')}><Pencil size={15} /></button>
              <button type="button" className="acc-button acc-icon" disabled={isActionPending} onClick={() => onDelete(task)} aria-label={t('কাজ মুছুন','Delete task')}><Trash2 size={15} /></button>
            </div>
          </li>
        );
      })}
    </ul>
  );
  return (
    <section id="acc-calendar-grid" className="acc-workboard" aria-label={t('কৃষিকাজের সময়সূচি','Farm work schedule')}>
      <header className="acc-board-controls">
        <div className="acc-segment" role="group" aria-label={t('ক্যালেন্ডার ভিউ','Calendar view')}>
          {([['month',t('মাস','Month')],['week',t('সপ্তাহ','Week')],['agenda',t('কাজের তালিকা','Agenda')]] as const).map(([mode,label]) =>
            <button key={mode} type="button" aria-pressed={view === mode} onClick={() => onChangeView(mode)}>{label}</button>)}
        </div>
        <div className="acc-date-nav">
          <button type="button" className="acc-button acc-icon" aria-label={t('আগের সময়','Previous period')} onClick={() => navigate(-1)}><ChevronLeft size={18} /></button>
          <span aria-live="polite">{view === 'month' ? monthFormat.format(calendarDate(date)) : shortDate.format(calendarDate(firstCell)) + ' – ' + shortDate.format(calendarDate(lastCell))}</span>
          <button type="button" className="acc-button acc-icon" aria-label={t('পরের সময়','Next period')} onClick={() => navigate(1)}><ChevronRight size={18} /></button>
          <button type="button" className="acc-button acc-today" onClick={() => onChangeDate(today)}>{t('আজ','Today')}</button>
        </div>
      </header>
      {previewStages?.length ? <div className="acc-preview-nav" aria-label={t('পরিকল্পনার গুরুত্বপূর্ণ তারিখ','Plan milestones')}>
        <span>{t('প্রস্তাবিত সূচি','Proposed plan')}</span>
        {[
          [t('বপন','Sow'), previewStages.find((stage) => stage.category === 'sowing')],
          [t('পরিচর্যা','Care'), previewStages.find((stage) => !['land_preparation','sowing','transplanting','harvest_planning'].includes(stage.category))],
          [t('ফসল কাটা','Harvest'), previewStages.find((stage) => stage.category === 'harvest_planning')],
        ].map(([label,stage]) => typeof stage === 'object' ? <button key={String(label)} type="button" className="acc-button" onClick={() => onChangeDate(stage.date)}>{String(label)} · {shortDate.format(calendarDate(stage.date))}</button> : null)}
      </div> : null}
      <div className="acc-board-grid" data-view={view} aria-busy={isLoading}>
        <div className="acc-grid-panel">
          <div className="acc-weekdays" aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="acc-date-grid">
            {calendarDays.map((cell) => {
              const items = dayTasks.get(cell) ?? [];
              const stages = previewByDate.get(cell) ?? [];
              const savedDates = savedCropDates.get(cell) ?? [];
              const markers = [...items, ...stages, ...savedDates].slice(0,2);
              return (
                <button type="button" key={cell} data-date={cell} data-selected={cell === date} data-other={view === 'month' && cell.slice(0,7) !== date.slice(0,7)}
                  aria-label={fullDate.format(calendarDate(cell)) + (items.length ? ' · ' + dayNumber.format(items.length) + ' ' + t('কাজ','tasks') : '') + (savedDates.length ? ' · ' + dayNumber.format(savedDates.length) + ' ' + t('ফসলের তারিখ','crop dates') : '') + (stages.length ? ' · ' + dayNumber.format(stages.length) + ' ' + t('প্রস্তাবিত কাজ','proposed tasks') : '')}
                  aria-pressed={cell === date} aria-current={cell === today ? 'date' : undefined} onClick={() => onChangeDate(cell)}>
                  <time dateTime={cell}>{dayNumber.format(calendarDate(cell).getUTCDate())}</time>
                  <span className="acc-day-markers" aria-hidden="true">
                    {markers.map((item) => <span key={item.id} data-category={item.category} data-draft={stages.some((stage) => stage.id === item.id)}>{'title_en' in item && lang === 'en' ? item.title_en : item.title}</span>)}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
        <section className="acc-day-panel" aria-label={t('নির্বাচিত দিনের কাজ','Selected day tasks')}>
          <div className="acc-day-head"><span className="acc-day-icon"><Clock size={19} /></span>
            <div><h2>{date === today ? t('আজকের কাজ','Tasks today') : t('দিনের কাজ','Tasks for the day')}</h2><p>{fullDate.format(calendarDate(date))}</p></div>
          </div>
          {selectedTasks.length > 0 && taskRows(selectedTasks)}
          {selectedStages.length > 0 && <ul className="acc-draft-list">{selectedStages.map((stage) =>
            <li key={stage.id} data-category={stage.category}><span>{t('প্রস্তাবিত','Proposed')}</span><strong>{t(stage.title,stage.title_en)}</strong>
              <small>{shortDate.format(calendarDate(stage.date))} – {shortDate.format(calendarDate(stage.end_date))}</small><p>{t(stage.action,stage.action_en)}</p></li>)}</ul>}
          {selectedCropDates.length > 0 && <ul className="acc-draft-list acc-crop-date-list">{selectedCropDates.map((item) =>
            <li key={item.id} data-category={item.category}><span>{t('ফসলের প্রোফাইল','Crop profile')}</span><strong>{t(item.title,item.title_en)}</strong></li>)}</ul>}
          {selectedTasks.length === 0 && selectedStages.length === 0 && selectedCropDates.length === 0 && <p className="acc-muted">{isLoading ? t('কাজ লোড হচ্ছে…','Loading tasks…') : t('এই দিনে কোনো কাজ নির্ধারিত নেই।','No tasks are scheduled for this day.')}</p>}
          <button type="button" className="acc-button" onClick={() => onAdd(date)}><Plus size={17} />{hasFarm ? t('এই দিনে কাজ যোগ করুন','Add task on this day') : t('কাজ সেভ করতে খামার যোগ করুন','Add a farm to save tasks')}</button>
        </section>
      </div>
      {view === 'agenda' && otherTaskDates.length > 0 && (
        <details className="acc-agenda">
          <summary>{t('অন্যান্য দিনের কাজ','Tasks for other dates')}</summary>
          <div>{otherTaskDates.map((key) => (
            <section key={key}><h3><CalendarDays size={16} />{key.slice(0,4) === today.slice(0,4) ? fullDate.format(calendarDate(key)) : shortDate.format(calendarDate(key)) + ' ' + dayNumber.format(calendarDate(key).getUTCFullYear())}</h3>
              {taskRows(dayTasks.get(key) ?? [])}
            </section>
          ))}</div>
        </details>
      )}
    </section>
  );
}
