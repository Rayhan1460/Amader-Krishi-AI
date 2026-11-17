import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudRain,
  Database,
  FileJson,
  Filter,
  History,
  Layers,
  Leaf,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Waves,
  X,
} from 'lucide-react';
import { historyApi, getErrorMessage } from '../../services/api.ts';
import type { PredictionRecord } from '../../types/index.ts';
import './PredictionHistoryView.css';

interface PredictionHistoryViewProps {
  initialRecordId?: number | null;
}

type StatusTone = 'low' | 'medium' | 'high' | 'neutral';

const MODEL_OPTIONS = [
  ['all', 'সব AI মডেল'],
  ['flood_susceptibility', 'বন্যার ঝুঁকি'],
  ['tomato_disease_v3', 'টমেটোর রোগ'],
  ['rice_disease', 'ধানের রোগ'],
  ['crop_recommendation', 'ফসল নির্বাচন'],
  ['regional_crop_yield', 'ফসল উৎপাদন'],
  ['tomato_price', 'টমেটোর বাজারদর'],
  ['boro_rice_price', 'বোরো ধানের দাম'],
] as const;

const MODEL_NAMES: Record<string, string> = {
  flood_susceptibility: 'বন্যাপ্রবণতা বিশ্লেষণ',
  tomato_disease_v3: 'টমেটো রোগ শনাক্তকরণ',
  rice_disease: 'ধানের রোগ শনাক্তকরণ',
  crop_recommendation: 'ফসল নির্বাচনের পরামর্শ',
  regional_crop_yield: 'ফসল উৎপাদনের পূর্বাভাস',
  tomato_price: 'টমেটোর বাজারদর',
  boro_rice_price: 'বোরো ধানের বাজারদর',
};

const FIELD_NAMES: Record<string, string> = {
  elevation: 'জমির উচ্চতা',
  elevation_m: 'জমির উচ্চতা (মিটার)',
  slope: 'জমির ঢাল',
  slope_deg: 'জমির ঢাল (ডিগ্রি)',
  dist_to_river: 'নদী থেকে দূরত্ব',
  river_distance: 'নদী থেকে দূরত্ব',
  river_distance_m: 'নদী থেকে দূরত্ব (মিটার)',
  rainfall: 'বৃষ্টিপাত',
  rainfall_mm: 'বৃষ্টিপাত (মিমি)',
  population_density: 'জনঘনত্ব',
  landcover_class: 'ভূমি ব্যবহারের ধরন',
  land_cover: 'ভূমির ধরন',
  soil_type: 'মাটির ধরন',
  location: 'অবস্থান',
  district: 'জেলা',
  crop: 'ফসল',
  crop_type: 'ফসলের ধরন',
  area: 'জমির পরিমাণ',
};

function readableModel(modelId: string) {
  return MODEL_NAMES[modelId] || modelId.replace(/_/g, ' ');
}

function isFlood(modelId: string) {
  return modelId.toLowerCase().includes('flood');
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) ? n : null;
}

function modelProbability(response: Record<string, unknown>): number | null {
  const raw = response.susceptibility_probability ?? response.risk_probability ?? response.probability;
  const n = asNumber(raw);
  return n !== null && n >= 0 && n <= 1 ? n * 100 : null;
}

function riskLabel(response: Record<string, unknown>): { text: string; tone: StatusTone } {
  const category = String(response.susceptibility_category ?? response.risk_level ?? '').toLowerCase();
  if (category.includes('low') || category.includes('কম')) return { text: 'ঝুঁকি কম', tone: 'low' };
  if (category.includes('moderate') || category.includes('medium') || category.includes('মাঝারি')) return { text: 'ঝুঁকি মাঝারি', tone: 'medium' };
  if (category.includes('high') || category.includes('severe') || category.includes('উচ্চ') || category.includes('বেশি')) {
    return { text: 'ঝুঁকি বেশি', tone: 'high' };
  }
  return { text: category ? String(response.susceptibility_category ?? response.risk_level) : 'বিশ্লেষণ সম্পন্ন', tone: 'neutral' };
}

function primaryResult(record: PredictionRecord) {
  const response = (record.response ?? {}) as Record<string, unknown>;
  if (isFlood(record.model_id)) return riskLabel(response).text;
  const crop = response.recommended_crop ?? response.predicted_class ?? response.predicted_crop;
  if (crop !== null && crop !== undefined && String(crop).trim()) return String(crop);
  const yieldValue = asNumber(response.predicted_yield);
  if (yieldValue !== null) return `${yieldValue.toFixed(2)} টন/হেক্টর`;
  const priceValue = asNumber(response.recommended_price ?? response.predicted_price);
  if (priceValue !== null) return `৳ ${priceValue.toFixed(2)}/কেজি`;
  return 'ফলাফল দেখতে ক্লিক করুন';
}

function formatDate(value: string, detail = false) {
  if (!value) return 'সময় পাওয়া যায়নি';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('bn-BD', detail
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayField(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'হ্যাঁ' : 'না';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ModelGlyph({ modelId }: { modelId: string }) {
  if (isFlood(modelId)) return <Waves size={21} strokeWidth={1.9} />;
  if (modelId.includes('disease')) return <Activity size={21} strokeWidth={1.9} />;
  if (modelId.includes('price')) return <TrendingUp size={21} strokeWidth={1.9} />;
  if (modelId.includes('crop') || modelId.includes('yield')) return <Leaf size={21} strokeWidth={1.9} />;
  return <Layers size={21} strokeWidth={1.9} />;
}

export function PredictionHistoryView({ initialRecordId }: PredictionHistoryViewProps) {
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialRecordId ?? null);
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const data = await historyApi.listHistory(100, modelFilter === 'all' ? undefined : modelFilter);
      setRecords(data);
      setSelectedId((current) => {
        if (initialRecordId && data.some((r) => r.id === initialRecordId)) return initialRecordId;
        if (current && data.some((r) => r.id === current)) return current;
        return data[0]?.id ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [modelFilter, initialRecordId]);

  useEffect(() => {
    void fetchHistory(true);
  }, [fetchHistory]);

  const sortedRecords = useMemo(() => [...records].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0) || b.id - a.id;
  }), [records]);

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return sortedRecords;
    return sortedRecords.filter((record) => [
      readableModel(record.model_id),
      record.model_id,
      `#${record.id}`,
      String(record.id),
      primaryResult(record),
      JSON.stringify(record.response ?? {}),
      JSON.stringify(record.request_payload ?? {}),
    ].join(' ').toLowerCase().includes(search));
  }, [sortedRecords, searchTerm]);

  const visibleSelection = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;
  const selectedResponse = (visibleSelection?.response ?? {}) as Record<string, unknown>;
  const selectedProbability = modelProbability(selectedResponse);
  const selectedRisk = riskLabel(selectedResponse);
  const requestFields = Object.entries((visibleSelection?.request_payload ?? {}) as Record<string, unknown>);
  const floodCount = records.filter((record) => isFlood(record.model_id)).length;
  const modelCount = new Set(records.map((record) => record.model_id)).size;
  const recentRecord = sortedRecords[0];

  const handleDelete = async (recordId: number) => {
    const confirmed = window.confirm(`রেকর্ড #${recordId} স্থায়ীভাবে মুছে ফেলতে চান? এটি ফেরত আনা যাবে না।`);
    if (!confirmed) return;
    setDeletingId(recordId);
    setError(null);
    try {
      await historyApi.deleteRecord(recordId);
      setRecords((current) => current.filter((record) => record.id !== recordId));
      setSelectedId((current) => current === recordId ? null : current);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setModelFilter('all');
  };

  return (
    <section data-testid="history-view" className="akh-page" aria-label="AI prediction audit history">
      <div className="akh-hero">
        <div className="akh-hero__content">
          <span className="akh-eyebrow"><Sparkles size={14} /> AI রেকর্ডস সেন্টার</span>
          <h1>বিশ্লেষণের <span>ইতিহাস</span></h1>
          <p>বন্যার ঝুঁকিসহ AI মডেলের পূর্ববর্তী ফলাফল, তথ্য ও সময় এক জায়গায় সহজে দেখুন।</p>
          <div className="akh-hero__trust"><ShieldCheck size={16} /> আপনার অ্যাকাউন্টের সংরক্ষিত বিশ্লেষণ</div>
        </div>
        <div className="akh-hero__art" aria-hidden="true"><History size={104} strokeWidth={0.85} /><span /><span /></div>
      </div>

      <div className="akh-stats" aria-label="ইতিহাসের সারসংক্ষেপ">
        <article className="akh-stat"><span className="akh-stat__icon"><Database size={21}/></span><div><span className="akh-stat__label">লোড হওয়া রেকর্ড</span><strong>{isLoading ? '—' : records.length.toLocaleString('bn-BD')}</strong><small>সাম্প্রতিক সর্বোচ্চ ১০০টি</small></div></article>
        <article className="akh-stat"><span className="akh-stat__icon akh-stat__icon--blue"><Waves size={22}/></span><div><span className="akh-stat__label">বন্যার বিশ্লেষণ</span><strong>{isLoading ? '—' : floodCount.toLocaleString('bn-BD')}</strong><small>সংরক্ষিত ঝুঁকি ফলাফল</small></div></article>
        <article className="akh-stat"><span className="akh-stat__icon akh-stat__icon--gold"><Layers size={22}/></span><div><span className="akh-stat__label">ব্যবহৃত AI মডেল</span><strong>{isLoading ? '—' : modelCount.toLocaleString('bn-BD')}</strong><small>এই তালিকায় পাওয়া গেছে</small></div></article>
        <article className="akh-stat akh-stat--date"><span className="akh-stat__icon akh-stat__icon--sage"><CalendarDays size={21}/></span><div><span className="akh-stat__label">সর্বশেষ বিশ্লেষণ</span><strong className="akh-stat__date">{recentRecord ? formatDate(recentRecord.timestamp) : '—'}</strong><small>সর্বশেষ রেকর্ডের সময়</small></div></article>
      </div>

      <div className="akh-shell">
        <div className="akh-toolbar">
          <div className="akh-toolbar__heading"><div className="akh-toolbar__mark"><History size={21}/></div><div><h2>আপনার সংরক্ষিত ফলাফল</h2><p>যেকোনো রেকর্ড বেছে বিস্তারিত দেখুন</p></div></div>
          <button className="akh-refresh" type="button" onClick={() => void fetchHistory()} disabled={isLoading || isRefreshing}><RefreshCw size={16} className={isRefreshing ? 'akh-spin' : ''}/><span>{isRefreshing ? 'আপডেট হচ্ছে...' : 'তালিকা রিফ্রেশ'}</span></button>
        </div>

        <div className="akh-filters">
          <div className="akh-search"><Search size={20}/><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="মডেল, ফলাফল বা রেকর্ড নম্বর খুঁজুন..." aria-label="বিশ্লেষণের ইতিহাস খুঁজুন"/>{searchTerm && <button type="button" aria-label="সার্চ মুছুন" onClick={() => setSearchTerm('')}><X size={16}/></button>}</div>
          <div className="akh-select"><Filter size={17}/><select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} aria-label="AI মডেল ফিল্টার">{MODEL_OPTIONS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><ChevronDown size={16} aria-hidden="true"/></div>
        </div>
        <div className="akh-chips" role="group" aria-label="দ্রুত ফিল্টার">
          <button type="button" className={modelFilter === 'all' ? 'is-active' : ''} onClick={() => setModelFilter('all')}><Layers size={15}/> সব ফলাফল</button>
          <button type="button" className={modelFilter === 'flood_susceptibility' ? 'is-active' : ''} onClick={() => setModelFilter('flood_susceptibility')}><Waves size={15}/> শুধু বন্যার ঝুঁকি</button>
          <span className="akh-chips__count">{filteredRecords.length.toLocaleString('bn-BD')}টি ফলাফল</span>
        </div>

        {error && <div className="akh-error" role="alert"><AlertCircle size={19}/><span>{error}</span><button type="button" onClick={() => void fetchHistory()} aria-label="আবার চেষ্টা করুন"><RefreshCw size={17}/></button></div>}

        <div className="akh-body">
          <div className="akh-list" aria-label="সংরক্ষিত রেকর্ড">
            {isLoading ? (
              <div className="akh-state" role="status"><Loader2 size={31} className="akh-spin"/><h3>ইতিহাস লোড হচ্ছে</h3><p>আপনার সংরক্ষিত বিশ্লেষণ আনা হচ্ছে...</p></div>
            ) : filteredRecords.length === 0 ? (
              <div className="akh-state"><div className="akh-state__icon"><Search size={29}/></div><h3>{searchTerm || modelFilter !== 'all' ? 'কোনো মিল পাওয়া যায়নি' : 'এখনো কোনো বিশ্লেষণ নেই'}</h3><p>{searchTerm || modelFilter !== 'all' ? 'অন্য শব্দ দিয়ে খুঁজুন অথবা ফিল্টার সরিয়ে দেখুন।' : 'একটি AI বিশ্লেষণ চালালে সেটি এখানে সংরক্ষিত হবে।'}</p>{(searchTerm || modelFilter !== 'all') && <button className="akh-reset" type="button" onClick={resetFilters}>সব ফলাফল দেখুন <ArrowRight size={15}/></button>}</div>
            ) : filteredRecords.map((record) => {
              const response = (record.response ?? {}) as Record<string, unknown>;
              const risk = riskLabel(response);
              const active = visibleSelection?.id === record.id;
              const prob = modelProbability(response);
              return (
                <button key={record.id} type="button" className={`akh-record ${active ? 'akh-record--active' : ''}`} onClick={() => setSelectedId(record.id)} aria-pressed={active}>
                  <span className={`akh-record__glyph ${isFlood(record.model_id) ? 'akh-record__glyph--flood' : ''}`}><ModelGlyph modelId={record.model_id}/></span>
                  <span className="akh-record__main"><span className="akh-record__top"><strong>{readableModel(record.model_id)}</strong><span className="akh-record__id">#{record.id}</span></span><span className="akh-record__result">{primaryResult(record)}</span><span className="akh-record__meta"><Clock3 size={13}/>{formatDate(record.timestamp, true)}<span className="akh-record__meta-dot"/>{record.model_id.replace(/_/g, ' ')}</span></span>
                  <span className="akh-record__aside">{isFlood(record.model_id) ? <span className={`akh-risk akh-risk--${risk.tone}`}>{risk.text}</span> : <span className="akh-complete"><CheckCircle2 size={14}/> সম্পন্ন</span>}{isFlood(record.model_id) && prob !== null && <small>{prob.toFixed(1)}% রিপোর্ট</small>}<span className="akh-record__arrow"><ArrowRight size={19}/></span></span>
                </button>
              );
            })}
          </div>

          <aside className="akh-detail" aria-label="নির্বাচিত বিশ্লেষণের বিস্তারিত">
            {!visibleSelection || isLoading ? (
              <div className="akh-detail__empty"><span><FileJson size={34}/></span><h3>বিশ্লেষণের বিস্তারিত</h3><p>বাম পাশের একটি ফলাফল নির্বাচন করলে এখানে তার তথ্য দেখা যাবে।</p></div>
            ) : (
              <div className="akh-detail__inner" key={visibleSelection.id}>
                <div className="akh-detail__head"><div className="akh-detail__head-label"><span className="akh-detail__mini">নির্বাচিত রেকর্ড</span><h3>বিশ্লেষণ #{visibleSelection.id}</h3></div><span className="akh-detail__check"><ShieldCheck size={17}/> সংরক্ষিত</span></div>
                <div className="akh-detail__model"><span className="akh-detail__model-icon"><ModelGlyph modelId={visibleSelection.model_id}/></span><div><small>AI মডেল</small><strong>{readableModel(visibleSelection.model_id)}</strong></div></div>
                <div className={`akh-outcome ${isFlood(visibleSelection.model_id) ? `akh-outcome--${selectedRisk.tone}` : ''}`}><div className="akh-outcome__eyebrow"><Sparkles size={15}/> বিশ্লেষণের ফলাফল</div><strong>{primaryResult(visibleSelection)}</strong>{isFlood(visibleSelection.model_id) && selectedProbability !== null && <><div className="akh-outcome__prob"><span>মডেলের রিপোর্ট করা সম্ভাবনা</span><b>{selectedProbability.toFixed(1)}%</b></div><div className="akh-outcome__track" aria-label={`মডেলের রিপোর্ট করা সম্ভাবনা ${selectedProbability.toFixed(1)} শতাংশ`}><span style={{ width: `${selectedProbability}%` }}/></div></>}{isFlood(visibleSelection.model_id) && <p className="akh-outcome__notice"><AlertCircle size={15}/> এটি ভূমির বন্যাপ্রবণতার মডেল; লাইভ বন্যা সতর্কতা নয়।</p>}</div>
                <div className="akh-detail__date"><CalendarDays size={17}/><div><small>বিশ্লেষণের সময়</small><span>{formatDate(visibleSelection.timestamp, true)}</span></div></div>
                <div className="akh-data-block"><div className="akh-data-block__title"><h4>ব্যবহৃত তথ্য</h4><span>{requestFields.length.toLocaleString('bn-BD')}টি ইনপুট</span></div>{requestFields.length ? <div className="akh-data-grid">{requestFields.slice(0, 12).map(([key, value]) => <div className="akh-data-item" key={key}><span>{FIELD_NAMES[key] || key.replace(/_/g, ' ')}</span><strong title={displayField(value)}>{displayField(value)}</strong></div>)}</div> : <p className="akh-no-data">এই রেকর্ডে ইনপুট তথ্য নেই।</p>}{requestFields.length > 12 && <p className="akh-more">সম্পূর্ণ ইনপুট নিচের কাঁচা তথ্যে দেখুন।</p>}</div>
                <details className="akh-raw"><summary><FileJson size={17}/> বিস্তারিত টেকনিক্যাল তথ্য <ChevronDown size={17}/></summary><div className="akh-raw__content"><span>Request payload</span><pre>{JSON.stringify(visibleSelection.request_payload, null, 2)}</pre><span>Model response</span><pre>{JSON.stringify(visibleSelection.response, null, 2)}</pre></div></details>
                <div className="akh-detail__bottom"><span><ShieldCheck size={15}/> শুধুমাত্র আপনার অ্যাকাউন্টের ইতিহাস</span><button type="button" className="akh-delete" onClick={() => void handleDelete(visibleSelection.id)} disabled={deletingId === visibleSelection.id}><Trash2 size={17}/>{deletingId === visibleSelection.id ? 'মুছে ফেলা হচ্ছে...' : 'রেকর্ড মুছুন'}</button></div>
              </div>
            )}
          </aside>
        </div>
      </div>
      <p className="akh-footnote"><CloudRain size={15}/> অতীতের AI বিশ্লেষণ দেখার জন্য এই পেজ। বর্তমান আবহাওয়া ও জরুরি সতর্কতার জন্য আবহাওয়া ও ঝুঁকি পেজ ব্যবহার করুন।</p>
    </section>
  );
}
