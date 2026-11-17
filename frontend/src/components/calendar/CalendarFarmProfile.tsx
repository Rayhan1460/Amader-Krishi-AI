import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Layers, MapPin, Plus, Ruler, Sprout, SquarePen, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { BDDivisionsMap, FarmCreatePayload, FarmProfile } from '../../types/index.ts';

const DIVISIONS: Record<string,string> = {
  Dhaka:'ঢাকা', Chattogram:'চট্টগ্রাম', Rajshahi:'রাজশাহী', Khulna:'খুলনা',
  Barishal:'বরিশাল', Sylhet:'সিলেট', Rangpur:'রংপুর', Mymensingh:'ময়মনসিংহ',
};
const DISTRICTS: Record<string,string> = {
  ...DIVISIONS, Gazipur:'গাজীপুর', Narayanganj:'নারায়ণগঞ্জ', Tangail:'টাঙ্গাইল', Faridpur:'ফরিদপুর',
  Manikganj:'মানিকগঞ্জ', Munshiganj:'মুন্সিগঞ্জ', Narsingdi:'নরসিংদী', Kishoreganj:'কিশোরগঞ্জ', Gopalganj:'গোপালগঞ্জ',
  Madaripur:'মাদারীপুর', Rajbari:'রাজবাড়ী', Shariatpur:'শরীয়তপুর', "Cox's Bazar":'কক্সবাজার', Cumilla:'কুমিল্লা',
  Feni:'ফেনী', Brahmanbaria:'ব্রাহ্মণবাড়িয়া', Noakhali:'নোয়াখালী', Chandpur:'চাঁদপুর', Lakshmipur:'লক্ষ্মীপুর',
  Khagrachhari:'খাগড়াছড়ি', Rangamati:'রাঙামাটি', Bandarban:'বান্দরবান', Bogura:'বগুড়া', Pabna:'পাবনা',
  Sirajganj:'সিরাজগঞ্জ', Naogaon:'নওগাঁ', Natore:'নাটোর', 'Chapai Nawabganj':'চাঁপাইনবাবগঞ্জ', Joypurhat:'জয়পুরহাট',
  Jashore:'যশোর', Kushtia:'কুষ্টিয়া', Satkhira:'সাতক্ষীরা', Bagerhat:'বাগেরহাট', Jhenaidah:'ঝিনাইদহ',
  Chuadanga:'চুয়াডাঙ্গা', Magura:'মাগুরা', Meherpur:'মেহেরপুর', Narail:'নড়াইল', Patuakhali:'পটুয়াখালী',
  Bhola:'ভোলা', Pirojpur:'পিরোজপুর', Barguna:'বরগুনা', Jhalokati:'ঝালকাঠি', Moulvibazar:'মৌলভীবাজার',
  Habiganj:'হবিগঞ্জ', Sunamganj:'সুনামগঞ্জ', Dinajpur:'দিনাজপুর', Kurigram:'কুড়িগ্রাম', Gaibandha:'গাইবান্ধা',
  Nilphamari:'নীলফামারী', Lalmonirhat:'লালমনিরহাট', Thakurgaon:'ঠাকুরগাঁও', Panchagarh:'পঞ্চগড়',
  Jamalpur:'জামালপুর', Netrokona:'নেত্রকোণা', Sherpur:'শেরপুর',
};
const SOILS: Record<string,string> = { Loam:'দোআঁশ', 'Sandy Loam':'বেলে দোআঁশ', Clay:'এঁটেল', Alluvial:'পলিমাটি', Sandy:'বেলে' };
const UNITS: Record<string,string> = { Decimal:'শতক', Shatak:'শতক', Bigha:'বিঘা', Acre:'একর', Hectare:'হেক্টর', Katha:'কাঠা', 'Sq Ft':'বর্গফুট', 'Sq Metre':'বর্গমিটার' };
export function farmLocation(farm: FarmProfile, bangla: boolean) {
  return [farm.upazila, bangla ? (DISTRICTS[farm.district] ?? farm.district) : farm.district].filter(Boolean).join(', ');
}

export function soilName(value: string | null | undefined, bangla: boolean) {
  return value ? (bangla ? (SOILS[value] ?? value) : value) : (bangla ? 'জানা নেই' : 'Unknown');
}

export function CalendarFarmProfile({ farm, cropCount, onAdd, onEdit }: {
  farm?: FarmProfile;
  cropCount: number;
  onAdd: () => void;
  onEdit: (farm: FarmProfile) => void;
}) {
  const { t, lang } = useLanguage();
  const bn = lang === 'bn';
  const number = new Intl.NumberFormat(bn ? 'bn-BD' : 'en-BD');
  return (
    <section className="acc-profile" aria-labelledby="acc-profile-title">
      <div className="acc-profile-photo" aria-hidden="true"><span><MapPin /></span></div>
      <div className="acc-profile-content">
        <div className="acc-profile-head">
          <div><span className="acc-kicker"><Sprout size={15} />{t('আমার খামার', 'My farm')}</span>
            <h2 id="acc-profile-title">{farm?.name ?? t('আপনার প্রথম খামার', 'Your first farm')}</h2></div>
          {farm && <button type="button" className="acc-button" onClick={onAdd}><Plus size={17} />{t('নতুন খামার', 'Add farm')}</button>}
        </div>
        {farm && <dl className="acc-farm-facts" key={farm.id}>
          <div><MapPin /><dt>{t('অবস্থান','Location')}</dt><dd>{farmLocation(farm, bn)}</dd></div>
          <div><Ruler /><dt>{t('জমির পরিমাণ','Land area')}</dt><dd>{number.format(farm.area)} {bn ? (UNITS[farm.area_unit] ?? farm.area_unit) : farm.area_unit}</dd></div>
          <div><Layers /><dt>{t('মাটির ধরন','Soil')}</dt><dd>{soilName(farm.soil_type, bn)}</dd></div>
          <div><Sprout /><dt>{t('চলতি ফসল','Active crops')}</dt><dd>{number.format(cropCount)}</dd></div>
        </dl>}
        {!farm && <p className="acc-muted">{t('জমির অবস্থান, পরিমাণ ও মাটির তথ্য দিয়ে খামারের ক্যালেন্ডার চালু করুন।','Add your location, area and soil to start your farm calendar.')}</p>}
        <button type="button" className="acc-button acc-primary" onClick={() => farm ? onEdit(farm) : onAdd()}>
          {farm ? <SquarePen size={16} /> : <Plus size={18} />}
          {farm ? t('প্রোফাইল সম্পাদনা','Edit profile') : t('প্রথম খামার তৈরি করুন','Create your first farm')}
        </button>
      </div>
    </section>
  );
}

export function FarmProfileDialog({ farm, divisions, onSave, onClose }: {
  farm?: FarmProfile;
  divisions: BDDivisionsMap;
  onSave: (payload: FarmCreatePayload) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const areaInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({
    name:farm?.name ?? '', division:farm?.division ?? '', district:farm?.district ?? '', upazila:farm?.upazila ?? '',
    village:farm?.village ?? '', area:farm?.area.toString() ?? '', area_unit:farm?.area_unit ?? 'Decimal',
    soil_type:farm?.soil_type ?? '', notes:farm?.notes ?? '',
  });
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => { (step === 1 ? nameInput : areaInput).current?.focus(); }, [step]);
  const change = (name: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [name]: value, ...(name === 'division' ? { district:'', upazila:'' } : name === 'district' ? { upazila:'' } : {}) }));
    setError(undefined);
  };
  const choices = (options: string[], current: string) => current && !options.includes(current) ? [...options, current] : options;
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (step === 1) {
      if (form.name.trim().length < 2 || form.upazila.trim().length < 2) {
        setError(t('খামারের নাম ও উপজেলার নামে অন্তত ২টি অক্ষর দিন।','Enter at least two characters for the farm name and upazila.'));
        return;
      }
      setStep(2);
      return;
    }
    const areaText = form.area.trim().replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
    const area = Number(areaText);
    if (!/^\d+(?:\.\d+)?$/.test(areaText) || !Number.isFinite(area) || area <= 0) {
      setError(t('জমির পরিমাণ শূন্যের বেশি লিখুন। যেমন ২.৫','Enter a land area greater than zero, for example 2.5.'));
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const message = await onSave({
        ...form, name:form.name.trim(), upazila:form.upazila.trim(),
        village:form.village.trim(), area, notes:form.notes.trim(),
      });
      if (message) setError(message);
    } finally {
      setPending(false);
    }
  };
  const bn = lang === 'bn';
  return (
    <dialog ref={dialog} className="acc-dialog" aria-labelledby="acc-farm-dialog-title" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
      <header className="acc-dialog-hero"><div><Sprout aria-hidden="true" /><h2 id="acc-farm-dialog-title">{farm ? t('খামারের তথ্য সম্পাদনা','Edit farm profile') : t('নতুন খামার তৈরি করুন','Create a farm profile')}</h2></div>
        <button type="button" className="acc-button acc-icon" aria-label={t('বন্ধ করুন','Close')} onClick={onClose} disabled={pending}><X size={20} /></button>
      </header>
      <form onSubmit={handleSubmit}>
        <ol className="acc-steps">
          <li aria-current={step === 1 ? 'step' : undefined}><b>{t('১','1')}</b>{t('খামার ও অবস্থান','Farm and location')}</li>
          <li aria-current={step === 2 ? 'step' : undefined}><b>{t('২','2')}</b>{t('জমি ও মাটি','Land and soil')}</li>
        </ol>
        {error && <p className="acc-error" role="alert">{error}</p>}
        <fieldset className="acc-fields" key={step} disabled={pending} aria-label={step === 1 ? t('খামার ও অবস্থান','Farm and location') : t('জমি ও মাটি','Land and soil')}>
          {step === 1 ? <>
            <label className="acc-field-wide">{t('খামারের নাম','Farm name')}<input ref={nameInput} required minLength={2} maxLength={150} value={form.name} onChange={(e) => change('name',e.target.value)} placeholder={t('যেমন সবুজ খামার','For example Green Farm')} /></label>
            <label>{t('বিভাগ','Division')}<select required value={form.division} onChange={(e) => change('division',e.target.value)}><option value="">{t('বেছে নিন','Select')}</option>{choices(Object.keys(divisions), form.division).map((name) => <option key={name} value={name}>{bn ? (DIVISIONS[name] ?? name) : name}</option>)}</select></label>
            <label>{t('জেলা','District')}<select required disabled={!form.division} value={form.district} onChange={(e) => change('district',e.target.value)}><option value="">{t('বেছে নিন','Select')}</option>{choices(divisions[form.division] ?? [], form.district).map((name) => <option key={name} value={name}>{bn ? (DISTRICTS[name] ?? name) : name}</option>)}</select></label>
            <label>{t('উপজেলা','Upazila')}<input required minLength={2} maxLength={100} value={form.upazila} onChange={(e) => change('upazila',e.target.value)} placeholder={t('যেমন শিবগঞ্জ','For example Shibganj')} /></label>
            <label>{t('গ্রাম বা মৌজা (ঐচ্ছিক)','Village (optional)')}<input maxLength={150} value={form.village} onChange={(e) => change('village',e.target.value)} /></label>
          </> : <>
            <label>{t('জমির পরিমাণ','Land area')}<input ref={areaInput} required inputMode="decimal" maxLength={18} value={form.area} onChange={(e) => change('area',e.target.value)} placeholder={t('যেমন ২.৫','For example 2.5')} /></label>
            <label>{t('পরিমাপের একক','Unit')}<select value={form.area_unit} onChange={(e) => change('area_unit',e.target.value)}>{choices(Object.keys(UNITS),form.area_unit).map((name) => <option key={name} value={name}>{bn ? (UNITS[name] ?? name) : name}</option>)}</select></label>
            <label className="acc-field-wide">{t('মাটির ধরন','Soil type')}<select value={form.soil_type} onChange={(e) => change('soil_type',e.target.value)}><option value="">{t('জানা নেই','Unknown')}</option>{choices(Object.keys(SOILS),form.soil_type).map((name) => <option key={name} value={name}>{soilName(name,bn)}</option>)}</select></label>
            <label className="acc-field-wide">{t('নোট (ঐচ্ছিক)','Notes (optional)')}<textarea maxLength={1000} rows={2} value={form.notes} onChange={(e) => change('notes',e.target.value)} placeholder={t('যেমন জমিতে সেচের ব্যবস্থা আছে','For example irrigation is available')} /></label>
          </>}
        </fieldset>
        <footer className="acc-form-actions">
          <button type="button" className="acc-button" disabled={pending} onClick={() => { if (step === 1) onClose(); else { setError(undefined); setStep(1); } }}><ArrowLeft size={16} />{step === 1 ? t('বাতিল','Cancel') : t('পেছনে','Back')}</button>
          <button type="submit" className="acc-button acc-primary" disabled={pending}>{pending ? t('সংরক্ষণ হচ্ছে…','Saving…') : step === 1 ? t('পরের ধাপ','Next') : t('খামার সংরক্ষণ করুন','Save farm profile')}{step === 1 && <ArrowRight size={16} />}</button>
        </footer>
      </form>
    </dialog>
  );
}
