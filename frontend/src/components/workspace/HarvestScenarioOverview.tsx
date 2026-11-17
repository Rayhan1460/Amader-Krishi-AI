// UI-09: farmer-entered scenario calculator. Never substitutes hypothetical prices for live quotes.
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  ArrowRight, CircleHelp, Clock3, Info, MapPin, PackageCheck,
  Plus, Scale, ShieldCheck, Sparkles, Truck, Warehouse,
} from 'lucide-react';
import type { FarmProfile, FarmCrop, HarvestSummaryResponse } from '../../types/index.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import './HarvestLovable.css';
import './HarvestPremium2026.css';

interface Props {
  farms: FarmProfile[];
  farmCrops: FarmCrop[];
  selectedFarmId: number | null;
  selectedCropId: number | null;
  onFarmChange: (id: number) => void;
  onCropChange: (id: number | null) => void;
  onAddHarvest: () => void;
  loadingFarms: boolean;
  summary: HarvestSummaryResponse | null;
}

type ScenarioKey = 'sell' | 'store' | 'transport';
type InputKey = 'localPrice' | 'localCost' | 'futurePrice' | 'storageCost' | 'storageLoss' | 'destinationPrice' | 'transportCost' | 'transitLoss';

const blank = {
  localPrice: '', localCost: '', futurePrice: '', storageCost: '', storageLoss: '',
  destinationPrice: '', transportCost: '', transitLoss: '',
};

function numeric(raw: string, allowZero = true): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) ? value : null;
}

function validLoss(raw: string): number | null {
  const value = numeric(raw);
  return value !== null && value <= 100 ? value : null;
}

function money(amount: number): string {
  const number = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 2 }).format(Math.abs(amount));
  return amount < 0 ? `−৳${number}` : `৳${number}`;
}

function quantity(amount: number): string {
  return new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 1 }).format(amount);
}

export default function HarvestScenarioOverview({
  farms, farmCrops, selectedFarmId, selectedCropId,
  onFarmChange, onCropChange, onAddHarvest, loadingFarms, summary,
}: Props) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [inputs, setInputs] = useState<Record<InputKey, string>>({ ...blank });
  const [openScenario, setOpenScenario] = useState<ScenarioKey | null>(null);

  // Keep farm-specific working assumptions separate. Nothing is persisted or sent to an API.
  useEffect(() => {
    setAmount('');
    setInputs({ ...blank });
    setOpenScenario(null);
  }, [selectedFarmId, selectedCropId]);

  const batchKg = numeric(amount, false);
  const recorded = summary && summary.total_records_count > 0
    ? summary.total_measured_quantity_kg
    : null;
  const sliderMax = Math.max(100, Math.ceil((batchKg ?? 0) / 100) * 100, Math.ceil((recorded ?? 0) / 100) * 100);

  const scenarios = useMemo(() => {
    const sellPrice = numeric(inputs.localPrice, false);
    const sellCost = numeric(inputs.localCost);
    const futurePrice = numeric(inputs.futurePrice, false);
    const storageCost = numeric(inputs.storageCost);
    const storageLoss = validLoss(inputs.storageLoss);
    const destinationPrice = numeric(inputs.destinationPrice, false);
    const transportCost = numeric(inputs.transportCost);
    const transitLoss = validLoss(inputs.transitLoss);
    if (batchKg === null) return { sell: null, store: null, transport: null };
    return {
      sell: sellPrice === null || sellCost === null ? null : batchKg * sellPrice - sellCost,
      store: futurePrice === null || storageCost === null || storageLoss === null
        ? null : batchKg * (1 - storageLoss / 100) * futurePrice - storageCost,
      transport: destinationPrice === null || transportCost === null || transitLoss === null
        ? null : batchKg * (1 - transitLoss / 100) * destinationPrice - transportCost,
    };
  }, [batchKg, inputs]);

  const complete = scenarios.sell !== null && scenarios.store !== null && scenarios.transport !== null;
  const maxReturn = complete
    ? Math.max(scenarios.sell!, scenarios.store!, scenarios.transport!)
    : null;
  const best: ScenarioKey[] = complete
    ? (Object.keys(scenarios) as ScenarioKey[]).filter(key => Math.abs(scenarios[key]! - maxReturn!) < 0.01)
    : [];

  function field(key: InputKey, bn: string, en: string, suffix: string, isPercent = false) {
    return (
      <label className="harvest-lovable-field" key={key}>
        <span>{t(bn, en)}</span>
        <span className="harvest-lovable-field-row">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max={isPercent ? '100' : undefined}
            step="any"
            value={inputs[key]}
            placeholder={t('লিখুন', 'Enter')}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
            aria-label={t(bn, en)}
          />
          <small>{suffix}</small>
        </span>
      </label>
    );
  }

  const cards: Array<{
    key: ScenarioKey; titleBn: string; titleEn: string; subBn: string; subEn: string;
    icon: typeof MapPin; fields: Array<ReturnType<typeof field>>;
  }> = [
    {
      key: 'sell', titleBn: 'এখন স্থানীয় বাজারে বিক্রি', titleEn: 'Sell at local market now',
      subBn: 'আজকের যাচাইকৃত বাজারদর নিজে লিখুন', subEn: 'Enter today’s quoted market price',
      icon: MapPin,
      fields: [field('localPrice', 'এখনকার দাম', 'Current price', '৳/কেজি'), field('localCost', 'বিক্রির মোট খরচ (না থাকলে ০)', 'Total selling cost (0 if none)', '৳')],
    },
    {
      key: 'store', titleBn: 'সংরক্ষণ করে পরে বিক্রি', titleEn: 'Store and sell later',
      subBn: 'ভবিষ্যৎ দাম নিশ্চিত নয়—নিজের অনুমান লিখুন', subEn: 'Future price is uncertain; enter your assumption',
      icon: Warehouse,
      fields: [
        field('futurePrice', 'পরে সম্ভাব্য দাম (নিজের অনুমান)', 'Assumed future price', '৳/কেজি'),
        field('storageCost', 'সংরক্ষণের মোট খরচ', 'Total storage cost', '৳'),
        field('storageLoss', 'সম্ভাব্য নষ্ট/ওজন কমা', 'Assumed storage loss', '%', true),
      ],
    },
    {
      key: 'transport', titleBn: 'অন্য বাজারে নিয়ে বিক্রি', titleEn: 'Transport to another market',
      subBn: 'অন্য বাজারের দাম ও যাতায়াত খরচ লিখুন', subEn: 'Enter destination quote and delivery costs',
      icon: Truck,
      fields: [
        field('destinationPrice', 'অন্য বাজারে দাম', 'Destination market price', '৳/কেজি'),
        field('transportCost', 'পরিবহন ও অন্যান্য মোট খরচ', 'Total transport and other costs', '৳'),
        field('transitLoss', 'পথে নষ্ট/ওজন কমা', 'Assumed transit loss', '%', true),
      ],
    },
  ];

  return (
    <section className="harvest-lovable" data-testid="harvest-scenario-overview">
      <header className="harvest-lovable-hero">
        <div>
          <p className="harvest-lovable-kicker">{t('HARVEST & STORAGE · ফসল কাটা ও সংরক্ষণ', 'HARVEST & STORAGE')}</p>
          <h1>{t('এখন বিক্রি করবেন, নাকি সংরক্ষণ করবেন?', 'Sell now or store?')}</h1>
          <p>{t('নিজের ফসলের পরিমাণ, বাজারদর ও খরচ দিয়ে তিনটি পথ তুলনা করুন।', 'Compare three options using your own harvest quantity, quoted prices and expenses.')}</p>
        </div>
        <button type="button" className="harvest-lovable-add" onClick={onAddHarvest} disabled={!selectedFarmId || loadingFarms}>
          <Plus size={18} /> {t('নতুন ফসল কর্তন রেকর্ড', 'Add harvest record')}
        </button>
      </header>

      <div className="harvest-lovable-context">
        <label>
          {t('আপনার খামার', 'Your farm')}
          <select value={selectedFarmId ?? ''} disabled={loadingFarms || farms.length === 0}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onFarmChange(Number(e.target.value))}>
            {farms.length === 0 && <option value="">{t('খামার পাওয়া যায়নি', 'No farms available')}</option>}
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label>
          {t('ফসল নির্বাচন (ঐচ্ছিক)', 'Crop (optional)')}
          <select value={selectedCropId ?? ''} disabled={!selectedFarmId || farmCrops.length === 0}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onCropChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('সব ফসল', 'All crops')}</option>
            {farmCrops.map(c => <option key={c.id} value={c.id}>{c.crop_name}{c.variety ? ` · ${c.variety}` : ''}</option>)}
          </select>
        </label>
        <div className="harvest-lovable-recorded">
          <PackageCheck size={19} />
          <span>{t('নথিভুক্ত মোট ফসল', 'Recorded harvest')}</span>
          <strong>{recorded !== null ? `${quantity(recorded)} ${t('কেজি', 'kg')}` : '—'}</strong>
          {recorded !== null && recorded > 0 && <button type="button" onClick={() => setAmount(String(recorded))}>{t('এই পরিমাণ নিন', 'Use this quantity')}</button>}
        </div>
      </div>

      <div className="harvest-lovable-batch">
        <div className="harvest-lovable-batch-top">
          <label htmlFor="harvest-lovable-quantity">{t('কত কেজি ফসল তুলনা করবেন?', 'How many kg are you comparing?')}</label>
          <span className="harvest-lovable-number">
            <input id="harvest-lovable-quantity" type="number" min="0.01" step="any" inputMode="decimal"
              placeholder={t('পরিমাণ লিখুন', 'Enter quantity')} value={amount}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} />
            <b>{t('কেজি', 'kg')}</b>
          </span>
        </div>
        <input className="harvest-lovable-slider" type="range" min="1" max={sliderMax} step="1"
          disabled={batchKg === null} value={batchKg === null ? 1 : Math.min(sliderMax, Math.max(1, batchKg))}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} aria-label={t('ফসলের পরিমাণ পরিবর্তন করুন', 'Adjust batch quantity')} />
        <p className="harvest-lovable-hint"><Info size={14} /> {t('পরিমাণ না জানা থাকলে প্রথমে ফসল কর্তনের রেকর্ড যোগ করুন।', 'If you do not know the quantity, record your harvest first.')}</p>
      </div>

      <div className="harvest-lovable-grid">
        {cards.map(({ key, titleBn, titleEn, subBn, subEn, icon: Icon, fields }) => {
          const result = scenarios[key];
          const isBest = complete && best.includes(key);
          return (
            <article className={`harvest-lovable-card${isBest ? ' harvest-lovable-card-best' : ''}`} key={key}>
              <div className="harvest-lovable-card-heading">
                <div className="harvest-lovable-card-icon"><Icon size={21} /></div>
                {isBest && <span className="harvest-lovable-best-label"><Sparkles size={14} /> {t('হিসাবে বেশি', 'Highest calculated')}</span>}
              </div>
              <h2>{t(titleBn, titleEn)}</h2>
              <p className="harvest-lovable-card-desc">{t(subBn, subEn)}</p>
              <p className="harvest-lovable-value">{result === null ? '—' : money(result)}</p>
              <p className="harvest-lovable-value-label">{result === null
                ? t('হিসাব দেখতে দাম ও খরচ লিখুন', 'Enter price and cost to calculate')
                : t('আপনার দেওয়া তথ্য অনুযায়ী সম্ভাব্য নিট টাকা', 'Estimated net amount from your inputs')}</p>
              <div className="harvest-lovable-track" aria-hidden="true">
                {complete && maxReturn !== null && maxReturn > 0 && result !== null &&
                  <span style={{ width: `${Math.max(0, Math.min(100, result / maxReturn * 100))}%` }} />}
              </div>
              <button className="harvest-lovable-expand" type="button" aria-expanded={openScenario === key}
                onClick={() => setOpenScenario(prev => prev === key ? null : key)}>
                {openScenario === key ? t('তথ্য লুকান', 'Hide inputs') : t('দাম ও খরচ লিখুন', 'Enter prices & costs')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              {openScenario === key && <div className="harvest-lovable-inputs">{fields}</div>}
            </article>
          );
        })}
      </div>

      <div className="harvest-lovable-verdict" role="status">
        <Scale size={20} />
        <div>
          <strong>{complete
            ? best.length > 1
              ? t('হিসাবে একাধিক পথ সমান', 'Multiple options have equal calculated net amounts')
              : t('আপনার হিসাব অনুযায়ী বেশি নিট টাকা', 'Highest net amount using your figures')
            : t('তিনটি পথ তুলনা করতে বাকি তথ্য দিন', 'Enter the remaining details to compare all three options')}</strong>
          <p>{complete
            ? `${best.map(key => t(
                key === 'sell' ? 'এখন বিক্রি' : key === 'store' ? 'সংরক্ষণ' : 'পরিবহন',
                key === 'sell' ? 'Sell now' : key === 'store' ? 'Store' : 'Transport',
              )).join(', ')} · ${money(maxReturn!)}. ${t('এটি নিশ্চিত লাভ বা পরামর্শ নয়; দাম ও ক্ষতির হার বদলাতে পারে।', 'This is not a guaranteed profit or professional advice; future prices and losses can change.')}`
            : t('প্রতিটি Card-এ দাম, খরচ ও সম্ভাব্য ক্ষতি লিখুন। কোনো দাম বা খরচ নিজে থেকে ধরে নেওয়া হয়নি।', 'Fill prices, costs and assumed losses in each card. No values have been invented or assumed.')}</p>
        </div>
      </div>
      <p className="harvest-lovable-disclaimer"><ShieldCheck size={17} /> {t('এটি কৃষকের দেওয়া তথ্যভিত্তিক তুলনা; লাইভ বাজারদর, গুদামের প্রাপ্যতা, নিশ্চিত ভবিষ্যৎ দাম বা সরকারিভাবে যাচাইকৃত সংরক্ষণ পরামর্শ নয়। কোনো তথ্য Backend-এ সংরক্ষণ করা হয় না।', 'An input-based comparison, not live prices, verified storage availability, a future-price prediction or a guaranteed recommendation. These calculations are not saved to the backend.')}</p>
      <div className="harvest-lovable-footnote"><Clock3 size={17}/>{t('আপনার প্রকৃত Harvest Record ও ফলন হিসাব নিচের “বিস্তারিত রেকর্ড” অংশে অপরিবর্তিত আছে।', 'Your real harvest records and yield tracking remain available under “Detailed records” below.')}
        <CircleHelp size={16} />
      </div>
    </section>
  );
}
