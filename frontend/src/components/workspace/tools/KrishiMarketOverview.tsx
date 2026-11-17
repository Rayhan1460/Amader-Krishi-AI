import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight, BadgeInfo, CalendarDays, CheckCircle2,
  ChevronDown, ClipboardList, Compass, MapPin,
  Plus, Search, ShieldAlert, Sprout, Trash2, Truck, X,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import './KrishiMarketLovable.css';

type Commodity = 'tomato_price' | 'boro_rice_price';
type DivisionKey = 'rangpur' | 'rajshahi' | 'mymensingh' | 'dhaka' | 'sylhet' | 'khulna' | 'barishal' | 'chattogram';

type PriceNote = {
  id: string;
  commodity: Commodity;
  division: DivisionKey;
  district: string;
  market: string;
  date: string;
  price: number;
  transportPerKg: number | null;
  provenance: 'visited' | 'phone' | 'personal';
};

type Division = {
  key: DivisionKey;
  bn: string;
  en: string;
  pinX: number;
  pinY: number;
  districts: readonly [string, string][];
};

const DIVISIONS: readonly Division[] = [
  { key: 'rangpur', bn: 'রংপুর', en: 'Rangpur', pinX: 180, pinY: 67, districts: [
    ['রংপুর','Rangpur'], ['দিনাজপুর','Dinajpur'], ['কুড়িগ্রাম','Kurigram'], ['গাইবান্ধা','Gaibandha'],
    ['লালমনিরহাট','Lalmonirhat'], ['নীলফামারী','Nilphamari'], ['পঞ্চগড়','Panchagarh'], ['ঠাকুরগাঁও','Thakurgaon'],
  ] },
  { key: 'rajshahi', bn: 'রাজশাহী', en: 'Rajshahi', pinX: 194, pinY: 149, districts: [
    ['রাজশাহী','Rajshahi'], ['বগুড়া','Bogura'], ['পাবনা','Pabna'], ['নওগাঁ','Naogaon'], ['নাটোর','Natore'],
    ['চাঁপাইনবাবগঞ্জ','Chapainawabganj'], ['জয়পুরহাট','Joypurhat'], ['সিরাজগঞ্জ','Sirajganj'],
  ] },
  { key: 'mymensingh', bn: 'ময়মনসিংহ', en: 'Mymensingh', pinX: 263, pinY: 150, districts: [
    ['ময়মনসিংহ','Mymensingh'], ['জামালপুর','Jamalpur'], ['নেত্রকোণা','Netrokona'], ['শেরপুর','Sherpur'],
  ] },
  { key: 'dhaka', bn: 'ঢাকা', en: 'Dhaka', pinX: 291, pinY: 237, districts: [
    ['ঢাকা','Dhaka'], ['ফরিদপুর','Faridpur'], ['গাজীপুর','Gazipur'], ['গোপালগঞ্জ','Gopalganj'],
    ['কিশোরগঞ্জ','Kishoreganj'], ['মাদারীপুর','Madaripur'], ['মানিকগঞ্জ','Manikganj'], ['মুন্সিগঞ্জ','Munshiganj'],
    ['নারায়ণগঞ্জ','Narayanganj'], ['নরসিংদী','Narsingdi'], ['রাজবাড়ী','Rajbari'], ['শরীয়তপুর','Shariatpur'], ['টাঙ্গাইল','Tangail'],
  ] },
  { key: 'sylhet', bn: 'সিলেট', en: 'Sylhet', pinX: 334, pinY: 136, districts: [
    ['সিলেট','Sylhet'], ['সুনামগঞ্জ','Sunamganj'], ['হবিগঞ্জ','Habiganj'], ['মৌলভীবাজার','Moulvibazar'],
  ] },
  { key: 'khulna', bn: 'খুলনা', en: 'Khulna', pinX: 208, pinY: 259, districts: [
    ['খুলনা','Khulna'], ['বাগেরহাট','Bagerhat'], ['সাতক্ষীরা','Satkhira'], ['যশোর','Jashore'], ['নড়াইল','Narail'],
    ['মাগুরা','Magura'], ['ঝিনাইদহ','Jhenaidah'], ['কুষ্টিয়া','Kushtia'], ['মেহেরপুর','Meherpur'], ['চুয়াডাঙ্গা','Chuadanga'],
  ] },
  { key: 'barishal', bn: 'বরিশাল', en: 'Barishal', pinX: 284, pinY: 287, districts: [
    ['বরিশাল','Barishal'], ['ভোলা','Bhola'], ['পটুয়াখালী','Patuakhali'], ['বরগুনা','Barguna'], ['পিরোজপুর','Pirojpur'], ['ঝালকাঠি','Jhalokati'],
  ] },
  { key: 'chattogram', bn: 'চট্টগ্রাম', en: 'Chattogram', pinX: 362, pinY: 296, districts: [
    ['চট্টগ্রাম','Chattogram'], ['কক্সবাজার','Cox’s Bazar'], ['কুমিল্লা','Cumilla'], ['চাঁদপুর','Chandpur'],
    ['ব্রাহ্মণবাড়িয়া','Brahmanbaria'], ['ফেনী','Feni'], ['নোয়াখালী','Noakhali'], ['লক্ষ্মীপুর','Lakshmipur'],
    ['খাগড়াছড়ি','Khagrachhari'], ['রাঙামাটি','Rangamati'], ['বান্দরবান','Bandarban'],
  ] },
];

// Schematic national outline for visual orientation, NOT a cadastral/administrative boundary.
// Districts are selected from the real 64-district list above; dots denote divisions, not district positions.
const BANGLADESH_PATH = 'M 149.3 37 L 148.1 41.1 L 152.8 42.3 L 155.8 48.2 L 145.8 60 L 138.7 63.5 L 133.4 78.3 L 135.1 85.4 L 142.2 84.8 L 152.8 93.6 L 152.8 97.8 L 158.7 103.7 L 172.9 103.7 L 175.8 106.6 L 177 114.3 L 180.6 115.5 L 182.9 120.2 L 177.6 125.5 L 154 124.9 L 150.5 139.7 L 144.6 144.4 L 137.5 141.4 L 131 157.4 L 136.9 166.8 L 155.2 177.4 L 163.4 178.6 L 167 176.8 L 171.1 179.8 L 170.5 187.4 L 167.6 192.2 L 169.9 195.7 L 169.9 202.2 L 162.3 207.5 L 159.9 219.3 L 172.3 231.1 L 168.8 240.5 L 169.3 244.1 L 176.4 244.1 L 181.7 247.6 L 181.7 250.6 L 177 255.3 L 178.2 264.1 L 182.9 270 L 180.6 277.1 L 183.5 283 L 186.5 303.1 L 189.4 307.8 L 188.8 316.1 L 191.2 321.4 L 191.8 332 L 198.8 336.1 L 198.8 331.4 L 203 328.5 L 207.7 332 L 207.7 335.5 L 213 333.8 L 217.7 337.3 L 222.4 334.9 L 224.8 330.8 L 233.1 328.5 L 230.1 317.8 L 234.2 314.9 L 238.4 317.8 L 238.4 320.2 L 242.5 320.2 L 244.9 322.6 L 244.3 328.5 L 251.4 332 L 256.7 328.5 L 257.3 320.8 L 262.6 314.9 L 267.3 313.7 L 273.2 316.1 L 269.1 313.1 L 269.1 309.6 L 273.8 306 L 277.9 309 L 276.1 315.5 L 279.7 319.6 L 285 316.1 L 288.5 308.4 L 288.5 294.8 L 276.7 274.2 L 277.9 269.5 L 274.4 266.5 L 274.4 263.6 L 277.3 260.6 L 283.2 263 L 282.6 267.7 L 295.6 284.8 L 302.7 284.8 L 306.8 288.9 L 306.8 291.9 L 312.1 282.4 L 311.5 277.7 L 322.8 271.2 L 335.7 285.4 L 346.4 304.3 L 348.7 323.1 L 351.7 327.9 L 351.1 333.2 L 355.2 336.1 L 352.8 340.8 L 347.5 340.3 L 348.7 350.3 L 358.1 360.9 L 358.1 372.1 L 368.8 387.5 L 368.8 378.6 L 364 373.9 L 364.6 368.6 L 362.9 365.6 L 366.4 358.6 L 372.9 354.4 L 378.8 359.1 L 385.3 359.7 L 388.2 365.6 L 390.6 363.3 L 387.1 349.7 L 387.1 323.1 L 385.3 320.8 L 386.5 310.8 L 382.9 281.3 L 378.2 273.6 L 378.2 269.5 L 374.1 265.9 L 374.1 255.9 L 371.7 248.8 L 374.1 238.2 L 368.2 224 L 368.2 219.3 L 362.9 215.8 L 356.4 219.9 L 351.1 218.1 L 352.2 229.9 L 344.6 235.8 L 341 243.5 L 343.4 255.3 L 338.7 260.6 L 331 262.4 L 326.3 258.8 L 321.6 245.9 L 316.9 247.6 L 312.7 244.7 L 312.7 238.2 L 304.5 218.1 L 309.8 208.7 L 309.2 202.8 L 319.8 191.6 L 330.4 191.6 L 342.2 183.3 L 346.9 186.9 L 348.1 185.7 L 347.5 175.7 L 351.7 172.7 L 359.9 172.1 L 359.3 168 L 364 161.5 L 364 156.2 L 367 150.9 L 367 144.4 L 371.1 141.4 L 375.3 143.8 L 381.2 143.2 L 381.8 140.2 L 373.5 133.2 L 356.4 124.3 L 345.8 127.3 L 341 126.1 L 342.8 132.6 L 338.7 135.5 L 335.1 133.2 L 328.1 133.2 L 325.7 127.9 L 312.1 123.7 L 289.1 128.4 L 280.3 126.1 L 261.4 126.7 L 236.6 117.8 L 231.9 117.8 L 227.8 113.7 L 231.3 96.6 L 228.3 88.3 L 229.5 74.2 L 223.6 63.5 L 220.7 61.2 L 218.3 63.5 L 220.1 70 L 214.2 74.8 L 203.6 74.2 L 192.4 64.7 L 189.4 67.7 L 185.3 67.7 L 180 63 L 174.1 63.5 L 171.7 61.2 L 172.3 55.9 L 167 52.3 L 164.6 47.6 Z';
const STORAGE_KEY = 'amader-krishi-market-notes-v1';
function currentLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
const MAX_STORED_NOTES = 300;

function readNotes(): PriceNote[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const valid = new Set(DIVISIONS.map((division) => division.key));
    return data.filter((item): item is PriceNote => {
      if (!item || typeof item !== 'object') return false;
      const n = item as Partial<PriceNote>;
      return typeof n.id === 'string' &&
        (n.commodity === 'tomato_price' || n.commodity === 'boro_rice_price') &&
        valid.has(n.division as DivisionKey) &&
        typeof n.district === 'string' && typeof n.market === 'string' && typeof n.date === 'string' &&
        typeof n.price === 'number' && Number.isFinite(n.price) && n.price > 0 &&
        (n.transportPerKg == null || (typeof n.transportPerKg === 'number' && Number.isFinite(n.transportPerKg) && n.transportPerKg >= 0));
    }).slice(0, MAX_STORED_NOTES);
  } catch { return []; }
}

function formatMoney(value: number, language: string, decimals = 0): string {
  return value.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-BD', { maximumFractionDigits: decimals });
}
function provenanceLabel(p: PriceNote['provenance'], language: string): string {
  if (p === 'visited') return language === 'bn' ? 'বাজারে গিয়ে জেনেছি' : 'Observed at market';
  if (p === 'phone') return language === 'bn' ? 'ফোনে জেনেছি' : 'By phone';
  return language === 'bn' ? 'নিজের নোট' : 'Personal note';
}

interface KrishiMarketOverviewProps {
  commodity: Commodity;
  onCommodityChange: (value: Commodity) => void;
  onToggleResearch: () => void;
  researchOpen: boolean;
}

export function KrishiMarketOverview({ commodity, onCommodityChange, onToggleResearch, researchOpen }: KrishiMarketOverviewProps) {
  const { lang, t } = useLanguage();
  const [notes, setNotes] = useState<PriceNote[]>(readNotes);
  const [selectedDivision, setSelectedDivision] = useState<DivisionKey | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [district, setDistrict] = useState(DIVISIONS[1].districts[0][1]);
  const [market, setMarket] = useState('');
  const [price, setPrice] = useState('');
  const [transport, setTransport] = useState('');
  const [sampleDate, setSampleDate] = useState(() => currentLocalDate());
  const [provenance, setProvenance] = useState<PriceNote['provenance']>('visited');
  const [searchText, setSearchText] = useState('');
  const [batchKg, setBatchKg] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); setStorageError(''); }
    catch { setStorageError(t('এই ব্রাউজারে নোট সংরক্ষণ করা যাচ্ছে না।', 'Cannot save notes in this browser.')); }
  }, [notes]);

  const currentNotes = useMemo(() => notes.filter((n) => n.commodity === commodity), [notes, commodity]);
  const uniqueMarkets = useMemo(() => {
    const sorted = [...currentNotes].sort((a, b) => b.date.localeCompare(a.date));
    const seen = new Set<string>();
    return sorted.filter((n) => {
      const key = `${n.division}:${n.district.toLowerCase()}:${n.market.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [currentNotes]);
  const shownNotes = useMemo(() => uniqueMarkets.filter((n) => {
    const divisionMatch = selectedDivision === 'all' || n.division === selectedDivision;
    const searchMatch = `${n.district} ${n.market}`.toLowerCase().includes(searchText.trim().toLowerCase());
    return divisionMatch && searchMatch;
  }).sort((a, b) => b.price - a.price), [uniqueMarkets, selectedDivision, searchText]);
  const countByDivision = useMemo(() => {
    const count = new Map<DivisionKey, PriceNote[]>();
    for (const n of uniqueMarkets) count.set(n.division, [...(count.get(n.division) ?? []), n]);
    return count;
  }, [uniqueMarkets]);
  const selectedDivisionName = DIVISIONS.find((d) => d.key === selectedDivision);
  const qty = batchKg.trim() === '' ? null : Number(batchKg);
  const validQty = qty != null && Number.isFinite(qty) && qty > 0;
  const maxPrice = shownNotes.length ? Math.max(...shownNotes.map((n) => n.price)) : null;

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(price);
    const shipping = transport.trim() === '' ? null : Number(transport);
    const division = DIVISIONS.find((d) => d.districts.some((item) => item[1] === district));
    const today = currentLocalDate();
    if (!division || !market.trim() || market.trim().length > 70 || !Number.isFinite(amount) || amount <= 0 || amount > 100000 ||
      !sampleDate || sampleDate > today || (shipping != null && (!Number.isFinite(shipping) || shipping < 0 || shipping > 100000))) {
      setError(t('বাজারের নাম, সঠিক তারিখ ও প্রতি কেজির দাম যাচাই করো।', 'Please check the market name, date, and price per kg.'));
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotes((prev) => [{ id, commodity, division: division.key, district, market: market.trim(),
      date: sampleDate, price: amount, transportPerKg: shipping, provenance }, ...prev].slice(0, MAX_STORED_NOTES));
    setSelectedDivision('all');
    setMarket(''); setPrice(''); setTransport(''); setError(''); setShowForm(false);
  };

  const removeNote = (id: string) => { setNotes((prev) => prev.filter((n) => n.id !== id)); };
  const openNewNote = () => { setError(''); setShowForm(true); };

  return (
    <section className="km-root font-bengali" aria-label={t('কৃষি বাজার', 'KrishiMarket')} data-testid="krishimarket-farmer-dashboard">
      <header className="km-heading">
        <div>
          <p className="km-eyebrow">KRISHIMARKET <span>•</span> {t('কৃষকের বাজার', 'Farmer market')}</p>
          <h1>{t('কোন বাজারে ফসলের ভালো দাম?', 'Where can you get a better crop price?')}</h1>
          <p className="km-subtitle">{t('জেলা ও বাজারের নিজে সংগ্রহ করা দাম এক জায়গায় দেখুন।', 'View the district and market prices you have recorded.')}</p>
        </div>
        <button type="button" className="km-add-btn" onClick={openNewNote}>
          <Plus size={19} aria-hidden="true" /> {t('নতুন বাজারদর যোগ করুন', 'Add a market price')}
        </button>
      </header>

      <div className="km-action-line">
        <div className="km-commodity-switch" role="group" aria-label={t('ফসল বাছাই', 'Select a crop')}>
          <button type="button" aria-pressed={commodity === 'tomato_price'} className={commodity === 'tomato_price' ? 'active' : ''} onClick={() => onCommodityChange('tomato_price')}>
            <span aria-hidden="true">🍅</span> {t('টমেটো', 'Tomato')}
          </button>
          <button type="button" aria-pressed={commodity === 'boro_rice_price'} className={commodity === 'boro_rice_price' ? 'active' : ''} onClick={() => onCommodityChange('boro_rice_price')}>
            <span aria-hidden="true">🌾</span> {t('বোরো ধান', 'Boro rice')}
          </button>
        </div>
        <span className="km-historical-note"><BadgeInfo size={15} aria-hidden="true" /> {t('নিজের নোট • লাইভ বাজারদর নয়', 'Your notes • Not live prices')}</span>
      </div>

      <div className="km-main-grid">
        <section className="km-panel km-map-panel" aria-labelledby="km-map-title">
          <div className="km-panel-heading"><div><span className="km-kicker">01 / MAP</span><h2 id="km-map-title">{t('বাংলাদেশের বাজারের মানচিত্র', 'Bangladesh market map')}</h2></div><Compass size={23} aria-hidden="true" /></div>
          <p className="km-help">{t('মানচিত্রে একটি বিভাগের নাম চাপুন, সেই এলাকার নোট দেখাবে।', 'Choose a division to see your recorded market prices there.')}</p>
          <div className="km-map-frame">
            <div className="km-map-topline"><span className="km-map-live-dot" /> {t('৮ বিভাগ • ৬৪ জেলা', '8 divisions • 64 districts')}</div>
            <div className="km-map-stage">
            <svg className="km-country" viewBox="0 0 520 412" role="img" aria-label={t('বাংলাদেশের বাজারের মানচিত্র; বিভাগের আনুমানিক অবস্থান', 'Bangladesh market map with approximate division positions')}>
              <defs>
                <linearGradient id="km-land-fill" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#168c58" />
                  <stop offset="100%" stopColor="#0f7849" />
                </linearGradient>
                <pattern id="km-geo-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#bfcdbf" strokeWidth="0.8" opacity=".55" />
                </pattern>
                <filter id="km-land-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#154d37" floodOpacity="0.12" />
                </filter>
                <clipPath id="km-bd-clip"><path d={BANGLADESH_PATH} /></clipPath>
              </defs>
              <rect x="0" y="0" width="520" height="412" fill="url(#km-geo-grid)" />
              <path d={BANGLADESH_PATH} fill="url(#km-land-fill)" stroke="#eef7f0" strokeWidth="3.1" strokeLinejoin="round" filter="url(#km-land-shadow)" />
              <g clipPath="url(#km-bd-clip)" opacity=".9" strokeLinecap="round" fill="none">
                <path d="M 150 116 Q 180 111 211 128 T 246 189" stroke="#eef7f0" strokeWidth="2.6" />
                <path d="M 230 125 Q 244 147 255 174 T 271 242" stroke="#eef7f0" strokeWidth="2.2" />
                <path d="M 297 129 Q 306 160 294 193 T 318 243" stroke="#eef7f0" strokeWidth="1.9" />
                <path d="M 182 205 Q 205 195 225 213 T 245 258" stroke="#eef7f0" strokeWidth="1.8" opacity=".9" />
              </g>
              <text x="24" y="386" fill="#83a08e" opacity=".85" fontSize="12" fontWeight="700" letterSpacing="0.08em">BANGLADESH</text>
            </svg>
            <div className="km-marker-layer">
              {DIVISIONS.map((division) => {
                const count = countByDivision.get(division.key)?.length ?? 0;
                const isSelected = selectedDivision === division.key;
                return (
                  <button type="button" key={division.key} aria-pressed={isSelected} title={`${t(division.bn, division.en)} · ${count ? `${count} ${t('নোট', 'notes')}` : t('দর নেই', 'No price notes')}`}
                    className={`km-map-marker ${isSelected ? 'selected' : ''} ${count ? 'has-price' : ''}`}
                    style={{ left: `${(division.pinX / 520) * 100}%`, top: `${(division.pinY / 412) * 100}%` }}
                    onClick={() => setSelectedDivision(isSelected ? 'all' : division.key)}>
                    <span className="km-marker-symbol" aria-hidden="true"><span className="km-marker-dot" /></span>
                    <span className="km-marker-label">{t(division.bn, division.en)}</span>
                    {count > 0 && <span className="km-marker-count">{formatMoney(count, lang)} {t('দর', 'notes')}</span>}
                  </button>
                );
              })}
            </div>
            </div>
          </div>
          <div className="km-map-legend"><span><span className="km-legend-dot gold" /> {t('আপনার বাজারদর আছে', 'Price noted')}</span><span><span className="km-legend-dot pale" /> {t('দর যোগ করা হয়নি', 'No note yet')}</span></div>
          <p className="km-map-disclaimer">{t('মানচিত্রটি এলাকার ধারণা দেওয়ার জন্য; চিহ্নগুলো বিভাগের আনুমানিক অবস্থান, জেলার সীমানা নয়।', 'Illustrative map only. Markers show approximate division areas, not district boundaries.')}</p>
        </section>

        <section className="km-panel km-comparison-panel" aria-labelledby="km-comparison-title">
          <div className="km-panel-heading"><div><span className="km-kicker">02 / COMPARE</span><h2 id="km-comparison-title">{t('বাজারের দাম তুলনা করুন', 'Compare market prices')}</h2></div><ClipboardList size={23} aria-hidden="true" /></div>
          <div className="km-comparison-filter">
            <label className="km-region-select-wrap">
              <span className="sr-only">{t('বিভাগ বাছাই', 'Choose a division')}</span>
              <select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value as DivisionKey | 'all')}>
                <option value="all">{t('সব বিভাগ', 'All divisions')}</option>
                {DIVISIONS.map((division) => <option key={division.key} value={division.key}>{t(division.bn, division.en)}</option>)}
              </select><ChevronDown size={17} aria-hidden="true" />
            </label>
            <label className="km-search-wrap"><Search size={16} aria-hidden="true" /><span className="sr-only">{t('বাজার খুঁজুন', 'Search markets')}</span><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t('বাজার খুঁজুন', 'Search markets')} /></label>
          </div>
          <div className="km-batch-row"><label htmlFor="km-qty">{t('আপনার ফসল কত কেজি?', 'How many kg do you have?')}</label><div><input id="km-qty" type="number" min="0" step="any" value={batchKg} onChange={(e) => setBatchKg(e.target.value)} placeholder={t('যেমন: ১০০', 'e.g. 100')} /><span>{t('কেজি', 'kg')}</span></div></div>
          <div className="km-comparison-list" aria-live="polite">
            {shownNotes.length === 0 ? (
              <div className="km-no-data">
                <div className="km-no-data-icon"><MapPin size={28} /></div>
                <h3>{t('এখনো কোনো বাজারদর লেখা নেই', 'No market prices recorded yet')}</h3>
                <p>{selectedDivisionName
                  ? t(`${selectedDivisionName.bn} বিভাগের বাজারের দর নিজে সংগ্রহ করে যোগ করুন।`, `Add market prices you collected in ${selectedDivisionName.en}.`)
                  : t('যে বাজারের দর জানেন, তার নাম, জেলা ও তারিখ লিখুন। এরপর মানচিত্র ও তুলনায় দেখাবে।', 'Add a market name, district, date and a price you know. It will appear in the map and comparison.')}</p>
                <button className="km-empty-add" type="button" onClick={openNewNote}><Plus size={16} /> {t('প্রথম বাজারদর যোগ করুন', 'Add your first price')}</button>
              </div>
            ) : shownNotes.map((note) => {
              const division = DIVISIONS.find((d) => d.key === note.division);
              const districtRecord = division?.districts.find((d) => d[1] === note.district);
              const isHighest = maxPrice === note.price && shownNotes.length > 1;
              const transportKnown = note.transportPerKg != null;
              const afterTransport = transportKnown && validQty ? (note.price - note.transportPerKg!) * qty! : null;
              return (
                <article key={note.id} className={`km-price-card ${isHighest ? 'km-highest-price' : ''}`}>
                  <div className="km-price-row">
                    <div><h3>{note.market}</h3><p><MapPin size={13} /> {t(districtRecord?.[0] ?? note.district, note.district)} • {t(division?.bn ?? '', division?.en ?? '')}</p></div>
                    <div className="km-amount">৳{formatMoney(note.price, lang, 2)}<small>/{t('কেজি', 'kg')}</small></div>
                  </div>
                  <div className="km-price-facts"><span><CalendarDays size={13} /> {note.date}</span><span><BadgeInfo size={13} /> {provenanceLabel(note.provenance, lang)}</span></div>
                  <div className="km-price-foot">
                    {afterTransport !== null ? (
                      <span className={afterTransport >= 0 ? 'km-positive' : 'km-negative'}><Truck size={15} /> {t('পরিবহন বাদে প্রায়', 'After transport approx.')} ৳{formatMoney(afterTransport, lang, 2)}</span>
                    ) : (<span className="km-not-ready"><Truck size={15} /> {t('পরিবহনসহ মোট হিসাব নেই', 'No transport-adjusted total')}</span>)}
                    <div className="km-price-card-actions">{isHighest && <span className="km-highest-label"><ArrowUpRight size={14} /> {t('নোটকৃত বেশি দর', 'Highest noted')}</span>}
                      <button type="button" aria-label={`${note.market} ${t('মুছুন', 'delete')}`} title={t('এই নোট মুছুন', 'Delete this note')} onClick={() => removeNote(note.id)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="km-comparison-bottom"><ShieldAlert size={17} /><span>{t('এগুলো আপনার নিজের লেখা দর—যাচাইকৃত লাইভ বাজারদর নয়। তারিখ আলাদা হলে তুলনা বদলাতে পারে; বেশি দাম মানেই বেশি লাভ নয়।', 'These are your personal notes, not verified live market prices. Different dates may not be directly comparable; highest price does not mean highest profit.')}</span></div>
        </section>
      </div>

      <div className="km-lower-bar"><div><span className="km-round-icon"><Sprout size={21} /></span><div><h3>{t('কৃষকের জন্য সহজ, গবেষণার জন্য বিস্তারিত', 'Simple for farmers, detailed for researchers')}</h3><p>{t('ঐতিহাসিক বাজারদর পূর্বাভাসের ১০টি ইনপুট ও AI Model নিচে আলাদাভাবে আছে।', 'The historical 10-input AI prediction tool remains available below.')}</p></div></div><button type="button" className="km-research-btn" onClick={onToggleResearch} aria-expanded={researchOpen} aria-controls="market-price-research-panel">{researchOpen ? t('গবেষণার ফর্ম লুকান', 'Hide research tool') : t('ঐতিহাসিক AI বিশ্লেষণ খুলুন', 'Open historical AI research')} <ChevronDown size={18} className={researchOpen ? 'km-arrow-up' : ''} /></button></div>
      {storageError && <p className="km-storage-alert" role="alert">{storageError}</p>}

      {showForm && (
        <div className="km-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="km-modal" role="dialog" aria-modal="true" aria-labelledby="km-modal-title">
            <div className="km-modal-head"><div><p className="km-eyebrow">LOCAL PRICE NOTE</p><h2 id="km-modal-title">{t('নতুন বাজারদর যোগ করুন', 'Record a market price')}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label={t('বন্ধ করুন', 'Close')}><X size={22} /></button></div>
            <p className="km-modal-help"><BadgeInfo size={16} /> {t('নিজে জেনে নেওয়া দর লিখুন। এটি শুধু এই ব্রাউজারে সংরক্ষণ হবে—সরকারি বা লাইভ দর নয়।', 'Enter a price you learned yourself. Saved only in this browser; it is not an official or live price.')}</p>
            <form className="km-entry-form" onSubmit={saveNote}>
              <label>{t('জেলা', 'District')} <span>*</span><select required value={district} onChange={(e) => setDistrict(e.target.value)}>
                {DIVISIONS.map((division) => <optgroup key={division.key} label={t(division.bn, division.en)}>{division.districts.map((record) => <option key={record[1]} value={record[1]}>{t(record[0], record[1])}</option>)}</optgroup>)}
              </select></label>
              <label>{t('বাজারের নাম', 'Market name')} <span>*</span><input required maxLength={70} value={market} onChange={(e) => setMarket(e.target.value)} placeholder={t('যেমন: সদর বাজার', 'e.g. Sadar Bazar')} /></label>
              <div className="km-field-pair"><label>{t('দাম (৳/কেজি)', 'Price (৳/kg)')} <span>*</span><input type="number" min="0.01" max="100000" step="any" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('দর লিখুন', 'Enter price')} /></label><label>{t('যেদিন জেনেছেন', 'Date observed')} <span>*</span><input type="date" required max={currentLocalDate()} value={sampleDate} onChange={(e) => setSampleDate(e.target.value)} /></label></div>
              <div className="km-field-pair"><label>{t('পরিবহন খরচ (৳/কেজি)', 'Transport (৳/kg)')} <small>{t('ঐচ্ছিক', 'Optional')}</small><input type="number" min="0" max="100000" step="any" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder={t('জানা না থাকলে ফাঁকা', 'Leave empty if unknown')} /></label><label>{t('কীভাবে জেনেছেন?', 'How did you learn it?')}<select value={provenance} onChange={(e) => setProvenance(e.target.value as PriceNote['provenance'])}><option value="visited">{t('বাজারে গিয়ে', 'Visited market')}</option><option value="phone">{t('ফোনে জেনেছি', 'By phone')}</option><option value="personal">{t('নিজের নোট', 'Personal note')}</option></select></label></div>
              {error && <p role="alert" className="km-form-error">{error}</p>}
              <div className="km-form-buttons"><button type="button" className="km-cancel" onClick={() => setShowForm(false)}>{t('বাতিল', 'Cancel')}</button><button type="submit" className="km-submit"><CheckCircle2 size={18} /> {t('বাজারদর সংরক্ষণ', 'Save market note')}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
