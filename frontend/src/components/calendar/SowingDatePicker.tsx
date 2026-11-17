import { CalendarDays, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { CalendarModal } from './CalendarModal.tsx';
import { calendarDate, shiftDays, shiftMonth, weekStart } from './calendarDates.ts';

interface SowingDatePickerProps {
  month: string;
  from: string;
  to: string;
  value?: string;
  formatDate: (date: string) => string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

export function SowingDatePicker({ month, from, to, value, formatDate, onSelect, onClose }: SowingDatePickerProps) {
  const { t, lang } = useLanguage();
  const locale = lang === 'bn' ? 'bn-BD' : 'en-BD';
  const formattedMonth = new Intl.DateTimeFormat(locale, { timeZone:'UTC', month:'long', year:'numeric' }).format(calendarDate(month + '-01'));
  const number = new Intl.NumberFormat(locale);
  const weekdays = lang === 'bn' ? ['শনি','রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র'] : ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
  const days = [];
  const end = shiftMonth(month + '-01', 1);
  for (let day = weekStart(month + '-01'); day < end; day = shiftDays(day, 1)) days.push(day);
  return (
    <CalendarModal labelId="acc-sowing-picker-title" onClose={onClose}>
      <div className="acc-sowing-panel">
        <header><span className="acc-season-icon"><CalendarDays size={21} /></span>
          <div><h3 id="acc-sowing-picker-title">{t('বপনের তারিখ বেছে নিন','Choose a sowing date')}</h3><p>{formattedMonth}</p></div>
          <button type="button" className="acc-button acc-icon" aria-label={t('বন্ধ করুন','Close')} onClick={onClose}><X size={18} /></button>
        </header>
        <p className="acc-sowing-range">{t('বেছে নেওয়া যাবে','Available dates')} · {formatDate(from)} – {formatDate(to)}</p>
        <div className="acc-sowing-grid" aria-label={formattedMonth}>
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          {days.map((day) => day.slice(0,7) !== month ? <span key={day} aria-hidden="true" /> : (
            <button key={day} type="button" disabled={day < from || day > to} aria-label={formatDate(day)}
              aria-pressed={value === day} onClick={() => onSelect(day)}>{number.format(calendarDate(day).getUTCDate())}</button>
          ))}
        </div>
      </div>
    </CalendarModal>
  );
}
