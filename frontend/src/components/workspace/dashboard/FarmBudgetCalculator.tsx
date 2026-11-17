import { useEffect, useRef, useState } from 'react';
import { Calculator, X } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';

const EMPTY = { budget: '', inputs: '', care: '', hired: '', family: '', other: '', revenue: '', quantity: '' };
type Field = keyof typeof EMPTY;

export function FarmBudgetCalculator({ onClose }: { onClose: () => void }) {
  const { lang, t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(EMPTY);
  const [mode, setMode] = useState<'budget' | 'profit'>('budget');
  const formatter = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-BD', { maximumFractionDigits: 2 });
  const takaInPoisha = (key: Field) => Math.round((Number(values[key]) || 0) * 100);
  const cashCost = (takaInPoisha('inputs') + takaInPoisha('care') + takaInPoisha('hired') + takaInPoisha('other')) / 100;
  const trueCost = (Math.round(cashCost * 100) + takaInPoisha('family')) / 100;
  const isEntered = (key: Field) => values[key] !== '' && values[key] !== '.';
  const hasExpenses = (['inputs', 'care', 'hired', 'other', 'family'] as const).some(isEntered);
  const quantity = Number(values.quantity);
  const money = (value: number) => `${value < 0 ? '−' : ''}৳${formatter.format(Math.abs(value))}`;
  const dash = '—';

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const field = (key: Field, label: string) => (
    <label className="farm-dash-field" key={key}>
      <span>{label}</span>
      <input type="text" inputMode="decimal" value={values[key]} placeholder={t('০', '0')}
        onChange={(event) => {
          const next = event.target.value.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
          if (/^\d{0,10}(?:\.\d{0,2})?$/.test(next)) {
            setValues((current) => ({ ...current, [key]: next }));
          }
        }} />
    </label>
  );

  return (
    <dialog ref={dialog} className="farm-dash-dialog" onCancel={onClose} aria-labelledby="farm-dash-budget-title">
      <header className="farm-dash-dialog-head">
        <span className="farm-dash-glyph"><Calculator aria-hidden="true" /></span>
        <div>
          <h2 id="farm-dash-budget-title">{t('খামারের বাজেট ও লাভ', 'Farm budget and profit')}</h2>
          <p>{t('নিজের জানা দর বসিয়ে হিসাব করুন।', 'Calculate with the prices you know.')}</p>
        </div>
        <button type="button" className="farm-dash-close" onClick={onClose} aria-label={t('বন্ধ করুন', 'Close')}><X /></button>
      </header>
      <div className="farm-dash-modes" role="group" aria-label={t('হিসাবের ধরন', 'Calculation mode')}>
        <button type="button" aria-pressed={mode === 'budget'} onClick={() => setMode('budget')}>{t('বাজেট মেলান', 'Check budget')}</button>
        <button type="button" aria-pressed={mode === 'profit'} onClick={() => setMode('profit')}>{t('প্রকৃত লাভ দেখুন', 'Check profit')}</button>
      </div>
      <div className="farm-dash-fields">
        {mode === 'budget' && field('budget', t('আপনার বাজেট (৳)', 'Available budget (৳)'))}
        {field('inputs', t('বীজ, চারা ও সার (৳)', 'Seeds, seedlings and fertiliser (৳)'))}
        {field('care', t('সেচ ও পরিচর্যা (৳)', 'Irrigation and crop care (৳)'))}
        {field('hired', t('ভাড়া করা শ্রম (৳)', 'Hired labour (৳)'))}
        {field('other', t('জমি, যন্ত্র ও পরিবহন (৳)', 'Land, machinery and transport (৳)'))}
        {field('family', t('নিজ ও পরিবারের শ্রমের মূল্য (৳)', 'Value of your family’s labour (৳)'))}
        {mode === 'profit' && field('revenue', t('ফসল বিক্রির আয় (৳)', 'Crop sales revenue (৳)'))}
        {mode === 'profit' && field('quantity', t('বিক্রিযোগ্য ফলন (কেজি)', 'Saleable yield (kg)'))}
      </div>
      <dl className="farm-dash-totals" aria-live="polite">
        <div><dt>{t('নগদ খরচ', 'Cash expense')}</dt><dd>{hasExpenses ? money(cashCost) : dash}</dd></div>
        <div><dt>{t('শ্রমসহ প্রকৃত খরচ', 'Full cost including labour')}</dt><dd>{hasExpenses ? money(trueCost) : dash}</dd></div>
        {mode === 'budget' && <div><dt>{t('নগদ খরচের পর বাজেটের অবস্থা', 'Budget balance after cash expenses')}</dt><dd>{isEntered('budget') && hasExpenses ? money(takaInPoisha('budget') / 100 - cashCost) : dash}</dd></div>}
        {mode === 'profit' && <div><dt>{t('প্রকৃত লাভ বা লোকসান', 'Profit or loss')}</dt><dd>{isEntered('revenue') && hasExpenses ? money(takaInPoisha('revenue') / 100 - trueCost) : dash}</dd></div>}
        {mode === 'profit' && <div><dt>{t('খরচ ওঠার দর', 'Break-even price')}</dt><dd>{quantity > 0 && hasExpenses ? `${money(trueCost / quantity)} ${t('/ কেজি', '/ kg')}` : dash}</dd></div>}
      </dl>
    </dialog>
  );
}
