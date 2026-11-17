import { useEffect, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Beaker, Calculator, CalendarDays, ChevronRight, FileCheck2, MapPin, Plus, Sprout, Tractor, TrendingUp, Users, Wheat } from 'lucide-react';
import type { FarmProfile, SoilTest } from '../../../types/index.ts';
import { farmApi, soilApi } from '../../../services/api.ts';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { CropRecommendationTool } from '../tools/CropRecommendationTool.tsx';
import { RegionalYieldTool } from '../tools/RegionalYieldTool.tsx';
import SoilTestForm from '../soil/SoilTestForm.tsx';
import { BudgetPanel } from './BudgetPanel.tsx';
import { CommunityPanel } from './CommunityPanel.tsx';
import { MachinePanel, PassportPanel, RescuePanel } from './ServicesPanel.tsx';
import { Card, errText, Feedback, metric } from './shared.tsx';
import './FarmHub.css';

export type HubPage = 'farm_plan' | 'farm_finance' | 'farm_community' | 'farm_services';
export const isHubPage = (page: string): page is HubPage =>
  page === 'farm_plan' || page === 'farm_finance' || page === 'farm_community' || page === 'farm_services';
const nature = [
  ['soil', 'মাটি বিশ্লেষণ', 'Soil analysis', Beaker],
  ['crop', 'ফসল উপদেষ্টা', 'Crop advisor', Sprout],
  ['yield', 'ফলন পূর্বাভাস', 'Yield forecast', TrendingUp],
] as const;
const services = [
  ['machines', 'যন্ত্রপাতি', 'Machinery', Tractor],
  ['rescue', 'জরুরি ফসল', 'Crop rescue', Wheat],
  ['passport', 'কৃষক পাসপোর্ট', 'Farm passport', FileCheck2],
] as const;
const titles = {
  farm_plan: ['মাটি ও ফসল পরিকল্পনা', 'Soil & crop planning', 'মাটির পরীক্ষা, ফসল বাছাই ও আঞ্চলিক ধানের ফলন এক জায়গায়।'],
  farm_finance: ['বাজেট ও লাভের হিসাব', 'Budget & profit', 'স্থানীয় দর ও শ্রমঘণ্টা দিয়ে নগদ খরচ এবং প্রকৃত লাভ বুঝুন।'],
  farm_community: ['কৃষক কমিউনিটি', 'Farm community', 'এলাকার কৃষকদের সঙ্গে দল গড়ুন এবং অভিজ্ঞতা বিনিময় করুন।'],
  farm_services: ['খামার সেবা ও রেকর্ড', 'Farm services & records', 'যন্ত্রের বুকিং, জরুরি ফসল এবং মৌসুমের রেকর্ড।'],
} as const;

function SoilPanel({ farmId, goCrop }: { farmId: number; goCrop: () => void }) {
  const [state, setState] = useState<{ items?: SoilTest[]; error?: string }>({});
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    setState({});
    void soilApi.getFarmSoilTests(farmId).then(items => {
      if (current) setState({ items: [...items].sort((a,b) => b.sample_date.localeCompare(a.sample_date) || b.id - a.id) });
    }).catch(error => { if (current) setState({ error: errText(error) }); });
    return () => { current = false; };
  }, [farmId, version]);

  const test = state.items?.[0];
  const values = [
    ['মাটির pH', test?.soil_ph, ''],
    ['জৈব পদার্থ', test?.organic_matter_percent, '%'],
    ['মাটির আর্দ্রতা', test?.soil_moisture_percent, '%'],
    ['নাইট্রোজেন (N)', test?.nitrogen_n, test?.measurement_unit_n],
    ['ফসফরাস (P)', test?.phosphorus_p, test?.measurement_unit_p],
    ['পটাশিয়াম (K)', test?.potassium_k, test?.measurement_unit_k],
  ] as const;
  return <div className="fh-plan-grid">
    <div className="fh-stack">
      <section className="fh-card">
        <header className="fh-split"><div><h2>সর্বশেষ মাটির পরীক্ষা</h2>
          {test && <p className="fh-muted">{test.sample_date} · {test.test_source === 'laboratory' ? 'ল্যাব রিপোর্ট' : 'কৃষকের পরীক্ষা'}</p>}</div>
          <button type="button" onClick={() => setOpen(true)}><Plus size={16}/>নতুন পরীক্ষা</button>
        </header>
        <Feedback error={state.error} pending={!state.items}/>
        {state.error && <button type="button" onClick={() => setVersion(v => v + 1)}>আবার চেষ্টা করুন</button>}
        {state.items?.length === 0 && <p className="fh-muted">এই খামারে এখনও মাটির পরীক্ষা যোগ করা হয়নি।</p>}
        {test && <dl className="fh-summary">{values.map(([label, value, unit]) => <div key={label}>
          <dt>{label}</dt><dd><strong>{metric(value)}</strong>{value != null && unit && <small> {unit}</small>}</dd>
        </div>)}</dl>}
        {test && <p className="fh-muted">রিপোর্টের মূল একক দেখানো হচ্ছে।</p>}
      </section>
      {!!state.items?.length && <section className="fh-card"><details><summary>মাটির পরীক্ষার ইতিহাস · {metric(state.items.length)}</summary>
        {state.items.map(item => <div className="fh-row" key={item.id}><strong>{item.sample_label || 'মাটির নমুনা'}</strong><span>{item.sample_date} · pH {metric(item.soil_ph)}</span></div>)}
      </details></section>}
    </div>
    <section className="fh-next"><Sprout size={22}/><h2>জমির জন্য ফসল বাছুন</h2>
      <p>এই খামারের মাটির রিপোর্ট থেকে পাওয়া তথ্য ফসল উপদেষ্টায় পর্যালোচনা করুন।</p>
      <button type="button" onClick={goCrop}>ফসল উপদেষ্টায় যান <ArrowRight size={17}/></button></section>
    {open && <SoilTestForm farmId={farmId} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setVersion(v => v + 1); }}/>}
  </div>;
}

type PageProps = { page: HubPage; initialFarmId?: number | null; initialPlan?: string; onViewHistory?: (id: number) => void; onCalendar: () => void };
export function FarmHub({ page, initialFarmId, initialPlan, onViewHistory, onCalendar }: PageProps) {
  const { t } = useLanguage();
  const [farms, setFarms] = useState<FarmProfile[]>();
  const [choice, setChoice] = useState<number | null>(null);
  const [plan, setPlan] = useState(initialPlan === 'crop' || initialPlan === 'yield' ? initialPlan : 'soil');
  const [service, setService] = useState('machines');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (initialPlan === 'soil' || initialPlan === 'crop' || initialPlan === 'yield') setPlan(initialPlan);
  }, [initialPlan]);
  useEffect(() => {
    let current = true;
    setError('');
    void farmApi.listFarms().then(list => { if (current) setFarms(list.filter(f => f.is_active)); })
      .catch(failure => { if (current) setError(errText(failure)); });
    return () => { current = false; };
  }, [retry]);
  const farm = farms?.find(f => f.id === choice) ?? farms?.find(f => f.id === initialFarmId) ?? farms?.[0];
  const [bangla, english, caption] = titles[page];
  const tabs = page === 'farm_plan' ? nature : services;
  const selection = page === 'farm_plan' ? plan : service;
  const selectTab = page === 'farm_plan' ? setPlan : setService;
  function jumpToPlan(id: string) {
    setPlan(id);
    requestAnimationFrame(() => document.getElementById(`hub-tab-${id}`)?.focus());
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const id = tabs[next][0];
    selectTab(id);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#hub-tab-${id}`)?.focus();
  }

  const noFarm = <Card title="খামার বাছুন"><p>এই কাজের জন্য কৃষি ক্যালেন্ডার থেকে একটি খামার তৈরি করুন।</p>
    <button onClick={onCalendar} type="button"><CalendarDays size={16}/>কৃষি ক্যালেন্ডার</button></Card>;

  return <section className="farm-hub" aria-labelledby={page === 'farm_finance' ? undefined : 'farm-hub-title'} aria-label={page === 'farm_finance' ? bangla : undefined}>
    <div className="fh-top"><span>আমাদের কৃষি <ChevronRight size={15}/> {t(bangla, english)}</span>
      {farm && <label><MapPin size={17}/><select aria-label="খামার নির্বাচন করুন" value={farm.id} onChange={e => setChoice(Number(e.target.value))}>{farms?.map(item => <option value={item.id} key={item.id}>{item.name} · {item.district}</option>)}</select></label>}
    </div>
    {page !== 'farm_finance' && <header className="fh-hero"><h1 id="farm-hub-title">{t(bangla, english)}</h1><p>{caption}</p>
      {farm && <span><MapPin size={16}/>{farm.upazila}, {farm.district}{farm.soil_type && ` · ${farm.soil_type}`}</span>}
    </header>}
    <Feedback error={error} pending={!farms}/>
    {error && <button type="button" onClick={() => setRetry(v => v + 1)}>খামারের তালিকা আবার আনুন</button>}
    {(page === 'farm_plan' || page === 'farm_services') && <nav className="fh-tabs" role="tablist" aria-label={t(bangla, english)}>
      {tabs.map(([id, bn, en, Icon], index) => <button type="button" key={id} role="tab" id={`hub-tab-${id}`} aria-controls={`hub-pane-${id}`}
        aria-selected={selection === id} tabIndex={selection === id ? 0 : -1} onKeyDown={event => navigateTabs(event, index)} onClick={() => selectTab(id)}><Icon size={18}/>{t(bn, en)}</button>)}
    </nav>}
    {(page === 'farm_plan' || page === 'farm_services') && tabs.filter(([id]) => id !== selection).map(([id]) =>
      <div key={id} hidden role="tabpanel" id={`hub-pane-${id}`} aria-labelledby={`hub-tab-${id}`} />)}
    {page === 'farm_plan' && <div className="fh-tab-content" role="tabpanel" id={`hub-pane-${plan}`} aria-labelledby={`hub-tab-${plan}`} key={`${plan}-${farm?.id ?? ''}`}>
      {plan === 'soil' && (farm ? <SoilPanel farmId={farm.id} goCrop={() => jumpToPlan('crop')}/> : farms && noFarm)}
      {plan === 'crop' && <><div className="fh-stack fh-model"><CropRecommendationTool initialFarmId={farm?.id} onViewHistory={onViewHistory} fixedFarm={!!farm}/></div><div className="fh-actions"><button type="button" onClick={() => jumpToPlan('soil')}><Beaker size={16}/>মাটির রিপোর্টে ফিরুন</button><button type="button" onClick={() => jumpToPlan('yield')}><TrendingUp size={16}/>ধানের ফলন দেখুন</button></div></>}
      {plan === 'yield' && <div className="fh-model"><RegionalYieldTool initialDistrict={farm?.district} onViewHistory={onViewHistory}/></div>}
    </div>}
    {page === 'farm_finance' && <BudgetPanel key={farm?.id ?? 'none'} farmId={farm?.id ?? null} farmName={farm?.name} farmArea={farm?.standard_decimal_area} onCalendar={onCalendar}/>}
    {page === 'farm_community' && <CommunityPanel key={farm?.id ?? 'none'} district={farm?.district}/>}
    {page === 'farm_services' && <div className="fh-tab-content" role="tabpanel" id={`hub-pane-${service}`} aria-labelledby={`hub-tab-${service}`} key={`${service}-${farm?.id ?? ''}`}>
      {service === 'machines' ? <MachinePanel district={farm?.district}/> : !farm ? farms && noFarm
        : service === 'passport' ? <PassportPanel farmId={farm.id}/> : <RescuePanel farmId={farm.id}/>}
    </div>}
    <nav className="fh-shortcuts" aria-label="খামারের শর্টকাট"><button type="button" onClick={onCalendar}><CalendarDays size={17}/>পরিচর্যা ও রিমাইন্ডার</button>
      {page === 'farm_finance' && <span><Calculator size={16}/>বাংলাদেশি টাকা (৳)</span>}
      {page === 'farm_community' && <span><Users size={16}/>কৃষক দল</span>}
    </nav>
  </section>;
}
