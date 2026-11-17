import { useRef, useState, type FormEvent } from 'react';
import { BookmarkPlus, Check, LoaderCircle } from 'lucide-react';
import { cultivationApi, farmApi } from '../../../services/api.ts';
import type { FarmCrop } from '../../../types/index.ts';
import type { Crop, Language } from './cropHealthModel.ts';

export function LeafObservationForm({ crop, recordId, language }: {
  crop: Crop;
  recordId: number;
  language: Language;
}) {
  const t = (bn: string, en: string) => language === 'bn' ? bn : en;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState<FarmCrop[]>([]);
  const [choiceId, setChoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const busy = useRef(false);

  async function loadCrops() {
    setOpen(true);
    setLoading(true);
    setError('');
    try {
      const rows = await farmApi.listAllCrops();
      const matches = crop === 'rice' ? /ধান|আউশ|আমন|বোরো|\b(?:rice|paddy)\b/i : /টমেটো|\btomato\b/i;
      setChoices(rows.filter(row => matches.test(row.crop_name)));
    } catch { setError(t('খামারের ফসল আনা যায়নি।', 'Could not load your farm crops.')); }
    finally { setLoading(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const row = choices.find(item => String(item.id) === choiceId);
    if (!row || busy.current || saved) return;
    busy.current = true;
    setError('');
    setSaving(true);
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date());
      const date = ['year', 'month', 'day'].map(part => parts.find(token => token.type === part)?.value).join('-');
      await cultivationApi.createObservation({
        farm_id: row.farm_id, crop_id: row.id, observation_date: date,
        title: t('পাতা স্ক্যানের পর্যবেক্ষণ', 'Leaf scan observation'),
        visible_symptoms: notes.trim() || null, farmer_reported_condition: 'unknown',
        prediction_record_id: recordId,
      });
      setSaved(true);
    } catch { setError(t('নোট সেভ হয়নি। আবার চেষ্টা করুন।', 'Could not save the note. Try again.')); }
    finally { busy.current = false; setSaving(false); }
  }

  if (saved) return <p className="chs-notice" role="status"><Check size={18}/>{t('পর্যবেক্ষণের নোট খামারে সেভ হয়েছে।', 'Observation saved to the farm.')}</p>;
  if (!open) return <button type="button" className="chs-btn chs-primary" onClick={() => void loadCrops()}><BookmarkPlus size={18}/>{t('খামারে নোট করুন', 'Add farm note')}</button>;
  return <form className="chs-card chs-note" onSubmit={save}>
    <h2>{t('খামারে পর্যবেক্ষণের নোট', 'Farm observation note')}</h2>
    {loading && <p className="chs-inline" role="status"><LoaderCircle size={17} className="chs-spin"/>{t('ফসল আনা হচ্ছে…', 'Loading crops…')}</p>}
    {error && <p className="chs-notice chs-warn" role="alert">{error}</p>}
    {!loading && !choices.length && (error
      ? <button type="button" className="chs-btn" onClick={() => void loadCrops()}>{t('আবার চেষ্টা করুন', 'Try again')}</button>
      : <p>{t('খামারে এই ধরনের ফসল যোগ করলে এখানে স্ক্যানের নোট রাখতে পারবেন।', 'Add this crop to a farm to save scan notes here.')}</p>)}
    {choices.length > 0 && <>
      <label>{t('খামারের ফসল বাছুন', 'Choose a farm crop')}
        <select value={choiceId} onChange={event => setChoiceId(event.target.value)} required>
          <option value="">{t('ফসল বাছুন', 'Select crop')}</option>
          {choices.map(row => <option key={row.id} value={row.id}>{[row.farm_name || t(`খামার ${row.farm_id}`, `Farm ${row.farm_id}`), row.crop_name, row.variety, row.sowing_date].filter(Boolean).join(' · ')}</option>)}
        </select></label>
      <label>{t('কী লক্ষণ দেখেছেন?', 'What signs did you see?')}<textarea value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} /></label>
      <button type="submit" className="chs-btn chs-primary" disabled={saving || !choiceId}>{t('নোট সেভ করুন', 'Save note')}</button>
    </>}
  </form>;
}
