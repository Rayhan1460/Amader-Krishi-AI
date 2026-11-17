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
  { key: 'rangpur', bn: 'রংপুর', en: 'Rangpur', pinX: 222, pinY: 90, districts: [
    ['রংপুর','Rangpur'], ['দিনাজপুর','Dinajpur'], ['কুড়িগ্রাম','Kurigram'], ['গাইবান্ধা','Gaibandha'],
    ['লালমনিরহাট','Lalmonirhat'], ['নীলফামারী','Nilphamari'], ['পঞ্চগড়','Panchagarh'], ['ঠাকুরগাঁও','Thakurgaon'],
  ] },
  { key: 'rajshahi', bn: 'রাজশাহী', en: 'Rajshahi', pinX: 240, pinY: 177, districts: [
    ['রাজশাহী','Rajshahi'], ['বগুড়া','Bogura'], ['পাবনা','Pabna'], ['নওগাঁ','Naogaon'], ['নাটোর','Natore'],
    ['চাঁপাইনবাবগঞ্জ','Chapainawabganj'], ['জয়পুরহাট','Joypurhat'], ['সিরাজগঞ্জ','Sirajganj'],
  ] },
  { key: 'mymensingh', bn: 'ময়মনসিংহ', en: 'Mymensingh', pinX: 305, pinY: 152, districts: [
    ['ময়মনসিংহ','Mymensingh'], ['জামালপুর','Jamalpur'], ['নেত্রকোণা','Netrokona'], ['শেরপুর','Sherpur'],
  ] },
  { key: 'dhaka', bn: 'ঢাকা', en: 'Dhaka', pinX: 305, pinY: 217, districts: [
    ['ঢাকা','Dhaka'], ['ফরিদপুর','Faridpur'], ['গাজীপুর','Gazipur'], ['গোপালগঞ্জ','Gopalganj'],
    ['কিশোরগঞ্জ','Kishoreganj'], ['মাদারীপুর','Madaripur'], ['মানিকগঞ্জ','Manikganj'], ['মুন্সিগঞ্জ','Munshiganj'],
    ['নারায়ণগঞ্জ','Narayanganj'], ['নরসিংদী','Narsingdi'], ['রাজবাড়ী','Rajbari'], ['শরীয়তপুর','Shariatpur'], ['টাঙ্গাইল','Tangail'],
  ] },
  { key: 'sylhet', bn: 'সিলেট', en: 'Sylhet', pinX: 338, pinY: 142, districts: [
    ['সিলেট','Sylhet'], ['সুনামগঞ্জ','Sunamganj'], ['হবিগঞ্জ','Habiganj'], ['মৌলভীবাজার','Moulvibazar'],
  ] },
  { key: 'khulna', bn: 'খুলনা', en: 'Khulna', pinX: 232, pinY: 269, districts: [
    ['খুলনা','Khulna'], ['বাগেরহাট','Bagerhat'], ['সাতক্ষীরা','Satkhira'], ['যশোর','Jashore'], ['নড়াইল','Narail'],
    ['মাগুরা','Magura'], ['ঝিনাইদহ','Jhenaidah'], ['কুষ্টিয়া','Kushtia'], ['মেহেরপুর','Meherpur'], ['চুয়াডাঙ্গা','Chuadanga'],
  ] },
  { key: 'barishal', bn: 'বরিশাল', en: 'Barishal', pinX: 308, pinY: 290, districts: [
    ['বরিশাল','Barishal'], ['ভোলা','Bhola'], ['পটুয়াখালী','Patuakhali'], ['বরগুনা','Barguna'], ['পিরোজপুর','Pirojpur'], ['ঝালকাঠি','Jhalokati'],
  ] },
  { key: 'chattogram', bn: 'চট্টগ্রাম', en: 'Chattogram', pinX: 404, pinY: 272, districts: [
    ['চট্টগ্রাম','Chattogram'], ['কক্সবাজার','Cox’s Bazar'], ['কুমিল্লা','Cumilla'], ['চাঁদপুর','Chandpur'],
    ['ব্রাহ্মণবাড়িয়া','Brahmanbaria'], ['ফেনী','Feni'], ['নোয়াখালী','Noakhali'], ['লক্ষ্মীপুর','Lakshmipur'],
    ['খাগড়াছড়ি','Khagrachhari'], ['রাঙামাটি','Rangamati'], ['বান্দরবান','Bandarban'],
  ] },
];

// Schematic national outline for visual orientation, NOT a cadastral/administrative boundary.
// Districts are selected from the real 64-district list above; dots denote divisions, not district positions.
const BANGLADESH_PATH = 'M 148.8 279.2 L 152.9 275.8 L 159.2 278.1 L 163.4 274.7 L 171.9 281.5 L 183.4 281.5 L 188.7 286.1 L 190.8 283.8 L 201.2 286.1 L 207.6 283.8 L 214.9 290.6 L 223.3 290.6 L 229.6 282.6 L 232.8 300.9 L 248.5 295.2 L 246.4 298.6 L 258 311.1 L 271.6 308.9 L 274.8 299.7 L 279 298.6 L 280 300.9 L 282.1 298.6 L 285.2 302 L 295.8 299.7 L 300 303.2 L 300 315.7 L 311.5 340.8 L 323.1 346.5 L 333.6 338.5 L 337.8 340.8 L 339.9 335.1 L 335.7 331.7 L 334.6 326 L 347.2 318 L 354.6 319.1 L 353.5 295.2 L 355.6 292.9 L 353.5 284.9 L 357.7 284.9 L 360.9 280.4 L 368.2 294 L 375.6 295.2 L 372.4 302 L 375.6 312.3 L 380.8 319.1 L 385 319.1 L 393.4 330.5 L 392.4 339.6 L 395.5 341.9 L 400.8 343.1 L 408.1 337.4 L 412.3 339.6 L 415.4 337.4 L 419.7 326 L 423.9 326 L 429.1 319.1 L 429.1 313.4 L 435.4 316.8 L 435.4 327.1 L 445.9 321.4 L 440.7 320.3 L 435.4 307.7 L 428.1 299.7 L 422.8 303.2 L 424.9 297.5 L 420.7 292.9 L 423.9 288.3 L 420.7 284.9 L 420.7 278.1 L 422.8 276.9 L 429.1 287.2 L 434.4 283.8 L 427 272.4 L 425.9 275.8 L 414.4 271.2 L 413.4 265.5 L 406 256.4 L 408.1 254.1 L 403.9 242.7 L 410.2 238.2 L 412.3 241.6 L 414.4 238.2 L 415.4 241.6 L 416.5 237 L 419.7 238.2 L 420.7 234.8 L 416.5 234.8 L 415.4 231.3 L 404.9 225.6 L 404.9 223.4 L 402.9 225.6 L 401.8 222.2 L 394.4 226.8 L 382.9 222.2 L 366.1 225.6 L 360.9 223.4 L 362.9 218.8 L 356.7 205.1 L 352.4 186.9 L 354.6 168.6 L 352.4 153.8 L 355.6 127.6 L 351.4 111.6 L 353.5 104.8 L 351.4 103.7 L 351.4 96.8 L 353.5 95.7 L 354.6 74 L 348.2 53.5 L 335.7 42.1 L 333.6 50.1 L 336.7 59.2 L 331.4 58.1 L 312.6 67.2 L 307.3 67.2 L 303.1 70.6 L 304.1 78.6 L 300 77.4 L 301 82 L 289.5 83.1 L 291.6 87.7 L 294.7 87.7 L 294.7 93.4 L 289.5 93.4 L 289.5 96.8 L 293.6 100.2 L 286.3 102.5 L 286.3 119.6 L 280 119.6 L 277.9 126.5 L 265.3 129.9 L 263.2 133.3 L 249.6 131 L 240.1 123 L 238 125.3 L 222.2 120.8 L 222.2 117.3 L 229.6 118.5 L 233.8 115.1 L 228.6 110.5 L 217 107.1 L 213.8 102.5 L 222.2 88.8 L 233.8 92.3 L 243.2 86.6 L 248.5 78.6 L 263.2 79.7 L 258 74 L 263.2 67.2 L 262.1 62.6 L 258 62.6 L 262.1 59.2 L 261.1 56.9 L 244.3 54.6 L 234.8 50.1 L 230.7 52.4 L 212.8 50.1 L 207.6 44.4 L 186.6 38.7 L 146.7 34.1 L 130.9 35.3 L 109.9 30.7 L 106.8 35.3 L 115.2 38.7 L 114.1 46.7 L 120.4 51.2 L 112 62.6 L 98.3 62.6 L 95.2 59.2 L 86.8 59.2 L 75.2 53.5 L 92 63.8 L 101.5 74 L 109.9 74 L 119.3 79.7 L 123.6 76.3 L 133 75.2 L 131.9 77.4 L 140.4 79.7 L 140.4 83.1 L 149.8 82 L 161.4 87.7 L 170.8 87.7 L 168.7 91.1 L 178.2 93.4 L 194.9 103.7 L 204.4 115.1 L 211.8 111.6 L 202.3 116.2 L 202.3 118.5 L 209.7 121.9 L 203.3 121.9 L 205.5 123 L 205.5 143.6 L 212.8 160.7 L 209.7 158.4 L 210.7 162.9 L 223.3 174.3 L 233.8 168.6 L 241.2 173.2 L 247.5 173.2 L 249.6 169.8 L 248.5 173.2 L 253.8 174.3 L 254.8 178.9 L 252.7 181.2 L 253.8 177.8 L 250.6 174.3 L 242.2 177.8 L 246.4 193.7 L 255.8 206.3 L 260.1 219.9 L 267.4 227.9 L 276.9 232.5 L 279 230.2 L 280 235.9 L 273.7 232.5 L 268.5 234.8 L 270.6 250.7 L 276.9 257.6 L 274.8 266.7 L 272.6 256.4 L 266.4 247.3 L 265.3 227.9 L 252.7 215.4 L 253.8 206.3 L 241.2 200.6 L 246.4 200.6 L 238 176.6 L 233.8 175.5 L 228.6 178.9 L 224.3 176.6 L 223.3 182.3 L 219.1 183.5 L 218.1 186.9 L 209.7 167.5 L 205.5 175.5 L 206.5 186.9 L 203.3 181.2 L 192.9 178.9 L 182.4 170.9 L 170.8 172.1 L 158.2 183.5 L 159.2 188 L 145.6 197.1 L 143.5 196 L 140.4 202.8 L 143.5 207.4 L 147.7 205.1 L 143.5 208.5 L 143.5 212 L 150.9 212 L 159.2 205.1 L 154 209.7 L 154 213.1 L 157.2 214.2 L 154 216.5 L 156.1 218.8 L 171.9 221.1 L 183.4 214.2 L 178.2 219.9 L 180.2 222.2 L 176.1 221.1 L 170.8 224.5 L 159.2 222.2 L 158.2 226.8 L 156.1 223.4 L 146.7 221.1 L 142.4 231.3 L 144.6 235.9 L 148.8 237 L 144.6 239.3 L 139.3 233.6 L 139.3 240.5 L 135.1 240.5 L 136.2 243.9 L 142.4 246.2 L 146.7 242.7 L 152.9 243.9 L 160.3 240.5 L 166.6 242.7 L 175 239.3 L 166.6 243.9 L 161.4 241.6 L 152.9 243.9 L 165.6 248.4 L 170.8 247.3 L 171.9 249.6 L 147.7 246.2 L 144.6 250.7 L 139.3 249.6 L 136.2 253 L 137.2 256.4 L 147.7 255.3 L 151.9 257.6 L 146.7 257.6 L 142.4 262.1 L 134.1 263.3 L 133 261 L 131.9 267.8 L 142.4 269 L 140.4 271.2 L 142.4 274.7 L 162.4 278.1 L 149.8 276.9 L 148.8 279.2 Z';
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
            <svg className="km-country" viewBox="0 0 520 412" role="img" aria-label={t('বাংলাদেশের অবস্থান বোঝানোর মানচিত্র; বিভাগের কেন্দ্র নির্দেশক', 'Illustrative Bangladesh map with approximate division markers')}>
              <defs>
                <linearGradient id="km-land-fill" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#164938" /><stop offset="100%" stopColor="#115340" /></linearGradient>
                <pattern id="km-geo-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#4e9f7c" strokeWidth="0.6" opacity=".15" /></pattern>
                <clipPath id="km-bd-clip"><path d={BANGLADESH_PATH} /></clipPath>
              </defs>
              <rect x="0" y="0" width="520" height="412" fill="url(#km-geo-grid)" />
              <path d={BANGLADESH_PATH} fill="url(#km-land-fill)" stroke="#519d7a" strokeWidth="2.1" strokeLinejoin="round" />
              <g clipPath="url(#km-bd-clip)" opacity=".36" strokeLinecap="round" fill="none">
                <path d="M 181 85 Q 205 134 242 159 T 267 253 Q 274 279 328 310" stroke="#70b1a4" strokeWidth="2.7" />
                <path d="M 303 152 Q 283 196 288 216 T 275 295" stroke="#70b1a4" strokeWidth="2.2" />
                <path d="M 340 142 Q 335 203 376 239 T 408 342" stroke="#70b1a4" strokeWidth="1.8" />
              </g>
              <text x="22" y="385" fill="#76a38e" opacity=".6" fontSize="12" fontWeight="500">BANGLADESH</text>
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
                    <span className="km-marker-symbol" aria-hidden="true"><MapPin size={18} /></span>
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
