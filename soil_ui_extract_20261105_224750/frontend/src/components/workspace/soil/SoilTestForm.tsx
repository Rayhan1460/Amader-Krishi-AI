import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, FlaskConical, Loader2, Save, X } from 'lucide-react';
import { soilApi } from '../../../services/api';
import type { SoilTestCreatePayload } from '../../../types';

interface SoilTestFormProps {
  farmId: number;
  onClose: () => void;
  onSaved: () => void;
}

type OptionalNumberField =
  | 'soil_ph'
  | 'nitrogen_n'
  | 'phosphorus_p'
  | 'potassium_k'
  | 'organic_matter_percent'
  | 'soil_moisture_percent'
  | 'electrical_conductivity';

const INITIAL_NUMBERS: Record<OptionalNumberField, string> = {
  soil_ph: '',
  nitrogen_n: '',
  phosphorus_p: '',
  potassium_k: '',
  organic_matter_percent: '',
  soil_moisture_percent: '',
  electrical_conductivity: '',
};

const FIELD_CLASS =
  'min-h-11 w-full rounded-xl border border-[#345d45] bg-[#07271b] px-3 py-2 text-sm text-[#f8f8f2] outline-none placeholder:text-[#708e7e] focus:border-[#e9ad46] focus:ring-1 focus:ring-[#e9ad46]/30';

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-xs font-medium text-[#cbded0]">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? 'পরিমাপ না থাকলে ফাঁকা রাখুন'}
        className={FIELD_CLASS}
      />
    </label>
  );
}

export default function SoilTestForm({ farmId, onClose, onSaved }: SoilTestFormProps) {
  const [sampleLabel, setSampleLabel] = useState('');
  const [sampleDate, setSampleDate] = useState('');
  const [testSource, setTestSource] = useState<'laboratory' | 'farmer_entered'>('farmer_entered');
  const [laboratoryName, setLaboratoryName] = useState('');
  const [numbers, setNumbers] = useState<Record<OptionalNumberField, string>>(INITIAL_NUMBERS);
  const [unitN, setUnitN] = useState('mg/kg');
  const [unitP, setUnitP] = useState('mg/kg');
  const [unitK, setUnitK] = useState('mg/kg');
  const [soilType, setSoilType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, saving]);

  function updateNumber(field: OptionalNumberField, value: string) {
    setNumbers((current) => ({ ...current, [field]: value }));
  }

  function optionalNumber(field: OptionalNumberField): number | null {
    const raw = numbers[field].trim();
    return raw === '' ? null : Number(raw);
  }

  function validate(): string | null {
    if (!sampleLabel.trim()) return 'নমুনার নাম লিখুন।';
    if (!sampleDate) return 'নমুনা সংগ্রহের তারিখ নির্বাচন করুন।';
    const parsedDate = new Date(`${sampleDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== sampleDate) {
      return 'সঠিক নমুনার তারিখ দিন।';
    }
    for (const [field, raw] of Object.entries(numbers) as [OptionalNumberField, string][]) {
      if (raw.trim() === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) return `${field} এর জন্য সঠিক সংখ্যা দিন।`;
      if (value < 0) return 'পরিমাপের মান ঋণাত্মক হতে পারে না।';
      if (field === 'soil_ph' && value > 14) return 'মাটির pH ০–১৪ সীমার মধ্যে দিন।';
      if ((field === 'organic_matter_percent' || field === 'soil_moisture_percent') && value > 100) {
        return 'শতাংশ ০–১০০ এর মধ্যে দিন।';
      }
    }
    if ((numbers.nitrogen_n.trim() && !unitN.trim()) ||
        (numbers.phosphorus_p.trim() && !unitP.trim()) ||
        (numbers.potassium_k.trim() && !unitK.trim())) {
      return 'যে পুষ্টির মান দিয়েছেন, তার পরিমাপের এককও দিন।';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: SoilTestCreatePayload = {
      farm_id: farmId,
      sample_label: sampleLabel.trim(),
      sample_date: sampleDate,
      test_source: testSource,
      laboratory_name: testSource === 'laboratory' ? laboratoryName.trim() || null : null,
      nitrogen_n: optionalNumber('nitrogen_n'),
      phosphorus_p: optionalNumber('phosphorus_p'),
      potassium_k: optionalNumber('potassium_k'),
      soil_ph: optionalNumber('soil_ph'),
      organic_matter_percent: optionalNumber('organic_matter_percent'),
      soil_moisture_percent: optionalNumber('soil_moisture_percent'),
      electrical_conductivity: optionalNumber('electrical_conductivity'),
      measurement_unit_n: unitN.trim() || 'mg/kg',
      measurement_unit_p: unitP.trim() || 'mg/kg',
      measurement_unit_k: unitK.trim() || 'mg/kg',
      soil_type: soilType.trim() || null,
      farmer_notes: notes.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      await soilApi.createSoilTest(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'মাটির পরীক্ষার তথ্য সংরক্ষণ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-3 py-5 backdrop-blur-[3px] sm:px-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="soil-test-form-title"
        className="flex max-h-[92vh] w-full max-w-[690px] flex-col overflow-hidden rounded-[22px] border border-[#3e6746] bg-[#092719] text-[#f6f7ed] shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#2e503a] px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-[0.27em] text-[#e9ad46]">SOIL INTELLIGENCE</p>
            <h2 id="soil-test-form-title" className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <FlaskConical size={22} className="text-[#e9ad46]" /> নতুন মাটির পরীক্ষা
            </h2>
            <p className="mt-2 text-xs text-[#b1cbb9]">বাস্তবে পাওয়া পরিমাপ লিখুন। না পাওয়া মানগুলো ফাঁকা রাখতে পারবেন।</p>
          </div>
          <button
            type="button"
            aria-label="ফর্ম বন্ধ করুন"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-[#385d43] p-2 text-[#d5e3d7] transition-colors hover:bg-[#193d2a] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form id="soil-test-create-form" onSubmit={(event) => void handleSubmit(event)} className="overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-xs font-medium text-[#cbded0]">নমুনার নাম <span className="text-[#e9ad46]">*</span></span>
              <input
                autoFocus
                required
                maxLength={120}
                value={sampleLabel}
                onChange={(event) => setSampleLabel(event.target.value)}
                placeholder="যেমন: পূর্ব পাশের জমির নমুনা"
                className={FIELD_CLASS}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">নমুনা সংগ্রহের তারিখ <span className="text-[#e9ad46]">*</span></span>
              <input
                required
                type="date"
                value={sampleDate}
                onChange={(event) => setSampleDate(event.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">তথ্যের উৎস</span>
              <select value={testSource} onChange={(event) => setTestSource(event.target.value as 'laboratory' | 'farmer_entered')} className={FIELD_CLASS}>
                <option value="farmer_entered">কৃষকের দেওয়া তথ্য</option>
                <option value="laboratory">ল্যাবরেটরি রিপোর্ট</option>
              </select>
            </label>
            {testSource === 'laboratory' && (
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-medium text-[#cbded0]">ল্যাবরেটরির নাম (ঐচ্ছিক)</span>
                <input value={laboratoryName} onChange={(event) => setLaboratoryName(event.target.value)} placeholder="ল্যাবের নাম" className={FIELD_CLASS} />
              </label>
            )}
          </div>

          <div className="my-5 border-t border-[#315541]" />
          <p className="mb-4 text-sm font-semibold text-[#e9ad46]">পরিমাপের তথ্য · ঐচ্ছিক</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="মাটির pH (০–১৪)" value={numbers.soil_ph} onChange={(value) => updateNumber('soil_ph', value)} />
            <NumberField label="জৈব পদার্থ (%)" value={numbers.organic_matter_percent} onChange={(value) => updateNumber('organic_matter_percent', value)} />
            <NumberField label="নাইট্রোজেন (N)" value={numbers.nitrogen_n} onChange={(value) => updateNumber('nitrogen_n', value)} />
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">N-এর একক</span>
              <input value={unitN} onChange={(event) => setUnitN(event.target.value)} className={FIELD_CLASS} />
            </label>
            <NumberField label="ফসফরাস (P)" value={numbers.phosphorus_p} onChange={(value) => updateNumber('phosphorus_p', value)} />
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">P-এর একক</span>
              <input value={unitP} onChange={(event) => setUnitP(event.target.value)} className={FIELD_CLASS} />
            </label>
            <NumberField label="পটাসিয়াম (K)" value={numbers.potassium_k} onChange={(value) => updateNumber('potassium_k', value)} />
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">K-এর একক</span>
              <input value={unitK} onChange={(event) => setUnitK(event.target.value)} className={FIELD_CLASS} />
            </label>
            <NumberField label="মাটির আর্দ্রতা (%)" value={numbers.soil_moisture_percent} onChange={(value) => updateNumber('soil_moisture_percent', value)} />
            <NumberField label="ইলেকট্রিক্যাল কন্ডাক্টিভিটি (রিপোর্টের একক মিলিয়ে দিন)" value={numbers.electrical_conductivity} onChange={(value) => updateNumber('electrical_conductivity', value)} />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#a0bdab]">
            N, P, K-এর একক মূল রিপোর্টের সঙ্গে মিলিয়ে দিন। কোনো পরিমাপের একক নিশ্চিত না হলে মানটি লিখবেন না।
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">মাটির ধরন (ঐচ্ছিক)</span>
              <input value={soilType} onChange={(event) => setSoilType(event.target.value)} placeholder="যেমন: দোআঁশ" className={FIELD_CLASS} />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#cbded0]">নোট (ঐচ্ছিক)</span>
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="সংক্ষিপ্ত নোট" className={FIELD_CLASS} />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-700/50 bg-rose-950/40 p-3 text-sm text-rose-200">
              <AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </form>

        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[#2e503a] bg-[#0b2c1d] px-5 py-4 sm:px-7">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-10 rounded-xl border border-[#426750] px-4 text-sm font-medium text-[#d3e6d7] hover:bg-[#17422b] disabled:opacity-50">
            বাতিল
          </button>
          <button
            type="submit"
            form="soil-test-create-form"
            disabled={saving}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e9ad46] px-5 text-sm font-bold text-[#112013] hover:bg-[#f1bf65] disabled:opacity-60"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
          </button>
        </div>
      </section>
    </div>
  );
}
