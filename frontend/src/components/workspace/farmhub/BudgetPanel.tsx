import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight, Bookmark, CalendarDays, CircleHelp, ClipboardList, Clock3, Coins, FolderOpen,
  Plus, Scale, Search, Sprout, Trash2, Wallet,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.tsx';
import { Feedback, metric, money } from './shared.tsx';
import {
  costsFor, fromRecord, priceLabels, readDraft, readNumber, salesFor,
  seasonHint, stages, startBudget, toPayload, writeDraft,
  type Budget, type FarmBudgetRecord, type Page, type PriceKey, type Summary,
} from './budgetModel.ts';
import {
  BudgetActions, BudgetCard, BudgetHint, BudgetRow, ExpenseEditor, FarmBudgetHero,
  NumericField, ProfitStat, StepStrip, TextField,
} from './BudgetWidgets.tsx';
import { budgetError, fetchBudgetSummary, removeBudget, saveBudget, useBudgetRecords, type BudgetNotice } from './budgetConnection.ts';
import './BudgetPanel.css';

export type { FarmBudgetRecord } from './budgetModel.ts';
type Props = { farmId: number | null; farmName?: string; farmArea?: number; onCalendar?: () => void };
const entry = [
  ['বাজেট দিয়ে শুরু', 'হাতে কত টাকা আছে লিখুন।', 'বাজেট লিখুন', Wallet, 'limit'],
  ['কাজ দিয়ে শুরু', 'জমি প্রস্তুতি, বীজ বা শ্রমের খরচ যোগ করুন।', 'খরচ যোগ করুন', ClipboardList, 'work'],
  ['ক্রেতার দর তুলনা', 'প্রস্তাবিত দামে খরচ উঠবে কি না দেখুন।', 'দর তুলনা করুন', Scale, 'compare'],
] as const;

export function BudgetPanel({ farmId, farmName, farmArea, onCalendar }: Props) {
  const { user } = useAuth();
  const storageKey = user ? `agrisphere:budget:v1:${user.id}:${farmId ?? 'no-farm'}` : '';
  const personalDraftKey = user ? `agrisphere:budget:v1:${user.id}:no-farm` : '';
  const [draft, setDraft] = useState(() => readDraft(storageKey) ?? readDraft(personalDraftKey));
  const movedDraft = useRef(false);
  const [editingExpense, setEditingExpense] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [budget, setBudget] = useState(() => startBudget('limit', 'estimate', farmArea));
  const [summary, setSummary] = useState<Summary>();
  const [calculationNotice, setCalculationNotice] = useState<BudgetNotice>();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [season, setSeason] = useState('');
  const [status, setStatus] = useState('');
  const [comparePlan, setComparePlan] = useState('');
  const [planChoices, setPlanChoices] = useState(['', '']);
  const [outlook, setOutlook] = useState({ low: '১৫', high: '১৫' });
  const screen = useRef<HTMLElement>(null);

  const records = useBudgetRecords(farmId, version);
  const saved = records?.data ?? [];
  const costs = costsFor(budget.lines);
  const planned = budget.kind === 'estimate';
  const workFirst = budget.mode === 'work';
  const ready = budget.lines.length > 0 && !!budget.crop.trim() && !!budget.season.trim();
  const visible = saved.filter(item => (!status || item.kind === status)
    && (!season || item.season === season) && `${item.crop} ${item.season}`.toLowerCase().includes(search.trim().toLowerCase()));

  function go(next: Page) {
    setError(''); setMessage(''); setCalculationNotice(undefined); setEditingExpense(false); setPage(next);
    requestAnimationFrame(() => {
      const heading = screen.current?.querySelector<HTMLElement>('[data-fb-heading]');
      heading?.focus({ preventScroll: true });
      screen.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  function begin(mode: Budget['mode'], kind: Budget['kind'] = 'estimate') {
    movedDraft.current = false;
    setBudget(startBudget(mode, kind, farmArea)); setDirty(true); setSummary(undefined);
    setPicking(false); go(mode === 'work' ? 'expenses' : 'start');
  }
  function edit(changes: Partial<Budget>) {
    setBudget(old => ({ ...old, ...changes })); setError(''); setMessage(''); setDirty(true); setSummary(undefined); setCalculationNotice(undefined);
  }
  function resume() {
    if (!draft) return;
    movedDraft.current = !!farmId && !readDraft(storageKey);
    setBudget(draft.budget); setDirty(true); setSummary(undefined); go(draft.page);
  }
  function draftHere(at: 'start' | 'expenses' | 'income', quiet = false) {
    const next = { budget, page: at };
    if (!writeDraft(storageKey, next)) {
      if (!quiet) setError('এই ডিভাইসে খসড়া রাখা যায়নি। পরে আবার চেষ্টা করুন।');
      return;
    }
    setDraft(next);
    if (!quiet) setMessage('খসড়া এই ডিভাইসে রাখা হয়েছে।');
  }
  function open(row: FarmBudgetRecord) {
    movedDraft.current = false;
    setBudget(fromRecord(row)); setSummary(row.result); setDirty(false); go('result');
  }
  function newActual() {
    setBudget(old => ({
      ...old, id: undefined, planId: old.id, plannedProfit: old.id ? summary?.profit : undefined,
      kind: 'actual', kg: '', sales: '', unit: '', incomeMode: 'total', offer: '',
    }));
    setSummary(undefined); setDirty(true); go('expenses');
    setMessage('পরিকল্পনার খরচগুলো এখানে আনা হয়েছে। বাস্তবে যেটুকু খরচ হয়েছে সেটি মিলিয়ে পরের ধাপে যান।');
  }
  function nextFromStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!budget.crop.trim() || !budget.season.trim()) throw new Error('ফসল ও মৌসুম লিখুন।');
      readNumber(budget.area);
      if (!workFirst && readNumber(budget.available) == null) throw new Error('হাতে থাকা বাজেট লিখুন।');
      draftHere(workFirst ? 'income' : 'expenses', true);
      go(workFirst ? 'income' : 'expenses');
    } catch (failure) { setError((failure as Error).message); }
  }
  function nextFromExpenses() {
    if (editingExpense) { setError('খরচটি যোগ করুন অথবা বাদ দিয়ে পরের ধাপে যান।'); return; }
    if (!budget.lines.length) { setError('পরের ধাপে যেতে অন্তত একটি খরচ যোগ করুন।'); return; }
    const next = workFirst && (!budget.crop.trim() || !budget.season.trim()) ? 'start' : 'income';
    draftHere(next, true); go(next);
  }
  function previewSales(): number | null {
    try { return salesFor(budget); } catch { return null; }
  }
  function amount(raw: string): number | null {
    try { return readNumber(raw); } catch { return null; }
  }
  async function run(work: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch (failure) {
      setError(budgetError(failure));
    } finally { operation.current = false; setBusy(false); }
  }
  function validPayload(forCompare = false) {
    if (!ready) throw new Error('প্রথমে ফসল, মৌসুম ও খরচ লিখে একটি হিসাব তৈরি করুন।');
    const payload = toPayload(budget);
    if (forCompare && (!payload.saleable_kg || payload.offer == null)) {
      throw new Error('দর তুলনার জন্য বিক্রিযোগ্য ফলন ও ক্রেতার প্রস্তাবিত দর লিখুন।');
    }
    return payload;
  }
  function calculate(compare = false, retry = false) {
    void run(async () => {
      const payload = validPayload(compare);
      if (!compare) draftHere('income', true);
      const result = await fetchBudgetSummary(payload);
      if (!compare && !retry) go('result');
      setSummary(result.summary);
      setCalculationNotice(result.notice);
      if (!result.notice) setMessage('সার্ভারের হিসাব পাওয়া গেছে।');
    });
  }
  function save(compared = false) {
    void run(async () => {
      if (!farmId) throw new Error('সেভ করতে ওপরে একটি খামার বেছে নিন।');
      const payload = { ...validPayload(compared), crop: budget.crop.trim(), season: budget.season.trim(),
        kind: budget.kind, farm_id: farmId, plan_id: budget.planId ?? null };
      const record = await saveBudget(payload, budget.id);
      if (!record?.id) throw new Error('সেভের তথ্য পাওয়া যায়নি। আমার হিসাব থেকে যাচাই করুন।');
      setBudget(fromRecord(record)); setSummary(record.result); setCalculationNotice(undefined); setDirty(false); setVersion(v => v + 1);
      if (draft?.budget.id === budget.id && draft?.budget.crop === budget.crop) {
        writeDraft(storageKey);
        if (movedDraft.current) writeDraft(personalDraftKey);
        movedDraft.current = false; setDraft(undefined);
      }
      setMessage(compared ? 'দর তুলনা এই হিসাবের সঙ্গে সেভ হয়েছে।' : 'হিসাব খামারে সেভ হয়েছে।');
    });
  }
  function remove(row: FarmBudgetRecord) {
    if (!window.confirm(`${row.crop} · ${row.season} হিসাবটি মুছবেন?`)) return;
    void run(async () => {
      await removeBudget(row.id);
      setVersion(v => v + 1);
      if (budget.id === row.id) {
        setBudget(startBudget('limit', 'estimate', farmArea)); setSummary(undefined); setComparePlan('');
      }
      if (draft?.budget.id === row.id) { writeDraft(storageKey); setDraft(undefined); }
      setMessage('হিসাবটি মুছে ফেলা হয়েছে।');
    });
  }
  function enterCompare(useCurrent = false) {
    if (!useCurrent) { movedDraft.current = false; setBudget(startBudget('work', 'estimate', farmArea)); }
    setComparePlan(useCurrent && budget.id ? String(budget.id) : '');
    if (!useCurrent) setDirty(false);
    setSummary(undefined); go('compare');
  }
  function chooseCompare(value: string) {
    const row = saved.find(item => String(item.id) === value);
    setComparePlan(value); setSummary(undefined); setCalculationNotice(undefined); setError(''); setMessage('');
    setBudget(row ? fromRecord(row) : startBudget('work', 'estimate', farmArea));
    setDirty(false);
  }

  const draftButton = (at: 'start' | 'expenses' | 'income') =>
    <button type="button" className="fb-draft" onClick={() => draftHere(at)} disabled={busy || editingExpense}><Bookmark size={16}/>খসড়া রাখুন</button>;
  const feedback = <div className="fb-feedback" aria-live="polite">
    {error && <p role="alert" className="fb-error">{error}</p>}
    {message && <p role="status" className="fb-success">{message}</p>}
  </div>;
  const connectionHint = calculationNotice && <div role="status">
    <BudgetHint>{calculationNotice.text}
      <button type="button" className="fb-text" disabled={busy} onClick={() => calculate(page === 'compare', true)}>
        {busy ? 'সার্ভার যাচাই হচ্ছে…' : 'সার্ভারে আবার চেষ্টা করুন'}
      </button><small className="block"><code dir="ltr">{calculationNotice.detail}</code></small>
    </BudgetHint>
  </div>;
  const needsFarm = !farmId && <BudgetHint>
    খামার বেছে নিলে হিসাব সেভ করতে পারবেন। ততক্ষণ খসড়া এই ডিভাইসে রাখতে পারবেন।
    {onCalendar && <button type="button" className="fb-text" onClick={onCalendar}><CalendarDays size={16}/>খামার যোগ করুন</button>}
  </BudgetHint>;
  const step = page === 'start' ? (workFirst ? 2 : 1) : page === 'expenses' ? (workFirst ? 1 : 2) : page === 'income' ? 3 : 4;
  const showingSteps = page === 'start' || page === 'expenses' || page === 'income';
  const heading = page === 'start' ? (workFirst ? 'ফসল ও মৌসুম লিখুন' : 'বাজেট দিয়ে শুরু')
    : page === 'expenses' ? 'খরচ যোগ করুন' : page === 'income' ? (planned ? 'কত টাকায় বিক্রি হতে পারে?' : 'বাস্তবে কত টাকায় বিক্রি হয়েছে?')
    : page === 'compare' ? 'ক্রেতার দর তুলনা' : 'আমার হিসাব';
  const nextStartLabel = workFirst ? 'ফলন ও দর' : 'খরচ যোগ করুন';

  return <section className="farm-budget" aria-label="বাজেট ও লাভ" ref={screen}>
    {page === 'home' ? <>
      <FarmBudgetHero onStart={() => { setPicking(true); requestAnimationFrame(() => screen.current?.querySelector<HTMLElement>('#fb-choose')?.focus()); }}/>
      <section className="fb-appear" aria-labelledby="fb-choose">
        <div className="fb-section-title">
          <h2 id="fb-choose" tabIndex={-1}>আপনি কী করতে চান?</h2>
        </div>
        {picking && <p className="fb-pick-help">নিচের কোন কাজটি দিয়ে শুরু করবেন, সেটি বেছে নিন।</p>}
        <div className="fb-choices">
          {entry.map(([title, description, action, Icon, mode]) => <button type="button" key={mode} className={`fb-choice fb-choice-${mode}`}
            onClick={() => mode === 'compare' ? enterCompare() : begin(mode)}>
            <span className="fb-icon"><Icon size={22}/></span><strong>{title}</strong><span>{description}</span><b>{action}<ArrowRight size={16}/></b>
          </button>)}
        </div>
      </section>
      <section className="fb-resume">
        <div className="fb-section-title"><h2>{draft ? 'শেষ যেখানে থেমেছিলেন' : 'আগের হিসাব'}</h2>
          <button type="button" onClick={() => go('saved')}><FolderOpen size={17}/>আমার হিসাব</button></div>
        {draft ? <div className="fb-resume-card">
          <span className="fb-icon"><Clock3 size={20}/></span><div><strong>{draft.budget.crop || 'অসম্পূর্ণ হিসাব'}</strong>
            <p>{draft.budget.season && draft.budget.season + ' · '}খসড়া · এই ডিভাইসে</p></div>
          <button type="button" className="fb-soft" onClick={resume}>হিসাব খুলুন<ArrowRight size={16}/></button>
        </div> : saved[0] && <div className="fb-resume-card"><span className="fb-icon"><Bookmark size={20}/></span><div>
          <strong>{saved[0].crop} · {saved[0].season}</strong><p>{saved[0].kind === 'actual' ? 'বাস্তব হিসাব' : 'পরিকল্পনা'}</p></div>
          <button type="button" className="fb-soft" onClick={() => open(saved[0])}>হিসাব খুলুন<ArrowRight size={16}/></button>
        </div>}
      </section>
    </> : <>
      {page !== 'result' && <header className="fb-heading fb-appear"><div>
        <h2 tabIndex={-1} data-fb-heading>{heading}</h2>
        <p>{page === 'start' ? 'যে ফসলের হিসাব করছেন, তার তথ্য দিন।' : page === 'expenses' ? 'যে কাজে কত টাকা লাগবে বা লেগেছে, একে একে লিখুন।' :
          page === 'income' ? 'ফসলের যে অংশ বিক্রি করা যাবে বা বিক্রি হয়েছে, সেটুকু ধরুন।' :
            page === 'compare' ? 'ক্রেতার দামে নিজের শ্রমসহ খরচ উঠবে কি না দেখুন।' : 'খসড়া, পরিকল্পনা ও মৌসুমের বাস্তব হিসাব এখানে পাবেন।'}</p>
      </div>{showingSteps && <span className="fb-tag">{planned ? 'পরিকল্পনা' : 'বাস্তব হিসাব'}</span>}</header>}
      {showingSteps && <StepStrip step={step} workFirst={workFirst}/>}
      {feedback}
    </>}

    {page === 'start' && <form id="fb-start-form" className="fb-screen fb-appear" onSubmit={nextFromStart}>
      <div className="fb-grid">
        <BudgetCard title="ফসল, মৌসুম ও বাজেট" hint="একটি ফসলের একটি মৌসুমের হিসাব রাখুন।">
          <div className="fb-fields">
            <TextField label="ফসল"><input value={budget.crop} maxLength={120} placeholder="যেমন টমেটো" required onChange={e => edit({crop:e.target.value})}/></TextField>
            <TextField label="মৌসুম ও বছর"><input value={budget.season} maxLength={120} placeholder={seasonHint()} required onChange={e => edit({season:e.target.value})}/></TextField>
            <NumericField label="জমির পরিমাণ (ঐচ্ছিক)" value={budget.area} onChange={area => edit({ area })} unit="শতক"/>
            <NumericField label={workFirst ? 'হাতে থাকা বাজেট (ঐচ্ছিক)' : 'হাতে থাকা বাজেট'} value={budget.available}
              onChange={available => edit({ available })} unit="৳" hint="চাষের কাজে যত টাকা বরাদ্দ আছে।" required={!workFirst}/>
          </div>
        </BudgetCard>
        <div className="fb-stack">
          <BudgetCard title="আপনার বাজেট" hint="চাষের জন্য বরাদ্দ নগদ" tone="fb-dark">
            <strong className="fb-total">{money(amount(budget.available))}</strong>
            <p>খরচ যোগ করলে বাজেটের কতটা বাকি আছে দেখতে পাবেন।</p>
          </BudgetCard>
          {!!budget.available && saved.some(row => row.kind === 'estimate' && row.result.cash <= (amount(budget.available) ?? -1)) &&
            <BudgetCard title="বাজেটের মধ্যে থাকা আগের পরিকল্পনা">
              {saved.filter(row => row.kind === 'estimate' && row.result.cash <= (amount(budget.available) ?? -1)).slice(0,3).map(row =>
                <BudgetRow key={row.id} label={row.crop + ' · ' + row.season} value={money(row.result.cash)}/>)}
            </BudgetCard>}
        </div>
      </div>
      <BudgetActions back={workFirst ? 'আগের ধাপ' : 'বাজেট ও লাভ'} onBack={() => go(workFirst ? 'expenses' : 'home')}>
        {draftButton('start')}<button type="submit" className="fb-primary">{nextStartLabel}<ArrowRight size={17}/></button>
      </BudgetActions>
    </form>}

    {page === 'expenses' && <div className="fb-screen fb-appear">
      <div className="fb-expense-hint" aria-live="polite"><span>যোগ করা {metric(budget.lines.length)}টি খরচ</span><strong>{money(costs.total)}</strong></div>
      <div className="fb-grid">
        <ExpenseEditor lines={budget.lines} onChange={lines => edit({lines})} onEditing={setEditingExpense}/>
        <div className="fb-stack">
          <BudgetCard title="মোট খরচ" hint="এখন পর্যন্ত যোগ করা নগদ খরচ" tone="fb-dark">
            <strong className="fb-total">{money(costs.cash)}</strong>
            <BudgetRow label="নিজের ও পরিবারের শ্রম" value={money(costs.labor)}/>
            <BudgetRow label="শ্রমসহ মোট" value={money(costs.total)}/>
          </BudgetCard>
          <BudgetHint>নিজের শ্রমও ধরুন। ২৮ ঘণ্টা × ঘণ্টায় ৳১০০ হলে শ্রমের মূল্য ৳২,৮০০।</BudgetHint>
        </div>
      </div>
      <BudgetActions back={workFirst ? 'বাজেট ও লাভ' : 'আগের ধাপ'} onBack={() => go(workFirst ? 'home' : 'start')}
        next={workFirst && !ready ? 'ফসল ও মৌসুম' : 'ফলন ও দর'} onNext={nextFromExpenses}>{draftButton('expenses')}</BudgetActions>
    </div>}

    {page === 'income' && <form className="fb-screen fb-appear" onSubmit={event => { event.preventDefault(); calculate(); }}>
      <fieldset disabled={busy} className="fb-grid">
        <BudgetCard title="ফলন ও বিক্রির দর" hint="আয় বা ফলন এখনও জানা না থাকলে ঘর ফাঁকা রেখে খরচের হিসাব দেখতে পারবেন।">
          <div className="fb-fields">
            <NumericField label={planned ? 'বিক্রিযোগ্য ফলন' : 'বাস্তবে বিক্রি হয়েছে'} unit="কেজি" value={budget.kg} onChange={kg => edit({ kg })}/>
            <TextField label="বিক্রির টাকা কীভাবে লিখবেন?"><select value={budget.incomeMode} onChange={e => edit({incomeMode:e.target.value as Budget['incomeMode']})}>
              <option value="unit">প্রতি কেজির দর</option><option value="total">মোট বিক্রির টাকা</option>
            </select></TextField>
            {budget.incomeMode === 'unit' ? <NumericField label="প্রতি কেজির বিক্রির দর" unit="৳/কেজি" value={budget.unit} onChange={unit => edit({unit})}/>
              : <NumericField label="মোট বিক্রির টাকা" unit="৳" value={budget.sales} onChange={sales => edit({sales})}/>}
          </div>
          <BudgetHint>দর বদলালে পরে ক্রেতার নতুন দামে হিসাব মিলিয়ে দেখতে পারবেন।</BudgetHint>
        </BudgetCard>
        <div className="fb-stack">
          <BudgetCard title={planned ? 'সম্ভাব্য বিক্রির আয়' : 'বাস্তব বিক্রির আয়'} tone="fb-dark"><strong className="fb-total">{money(previewSales())}</strong></BudgetCard>
          <BudgetCard title="আগের ধাপের খরচ">
            <BudgetRow label="নগদ খরচ" value={money(costs.cash)}/><BudgetRow label="নিজের ও পরিবারের শ্রম" value={money(costs.labor)}/>
          </BudgetCard>
        </div>
      </fieldset>
      <BudgetActions back="আগের ধাপ" onBack={() => go(workFirst ? 'start' : 'expenses')} busy={busy}>
        {draftButton('income')}<button type="submit" className="fb-primary" disabled={busy}>{busy ? 'হিসাব হচ্ছে…' : 'ফলাফল দেখুন'}<ArrowRight size={17}/></button>
      </BudgetActions>
    </form>}

    {page === 'result' && summary && <div className="fb-screen fb-appear">
      {connectionHint}
      <header className="fb-result" data-negative={summary.profit != null && summary.profit < 0}>
        <div><span>{planned ? 'পরিকল্পনার ফলাফল' : 'বাস্তব হিসাব'}</span><h2 tabIndex={-1} data-fb-heading>{budget.crop} · {budget.season}</h2>
          <p>{[budget.area ? `${metric(amount(budget.area))} শতক` : '', farmName].filter(Boolean).join(' · ')}</p></div>
        <div><strong>{money(summary.profit == null ? null : Math.abs(summary.profit))}</strong><p>
          {summary.profit == null ? 'বিক্রির আয় লিখলে লাভ বা ক্ষতি দেখা যাবে' : (planned ? 'সম্ভাব্য ' : 'বাস্তব ') + (summary.profit < 0 ? 'ক্ষতি' : summary.profit === 0 ? 'লাভ বা ক্ষতি নেই' : 'লাভ')}</p>
          {summary.profit != null && <p>বিক্রির আয় {money(previewSales())} − মোট খরচ {money(summary.economic)}</p>}</div>
      </header>
      <div className="fb-stats">
        <ProfitStat label="বিক্রির আয়" value={previewSales()} hint={planned ? 'সম্ভাব্য মোট বিক্রি' : 'বাস্তবে পাওয়া টাকা'}/>
        <ProfitStat label="মোট খরচ" value={summary.economic} hint="নিজের ও পরিবারের শ্রমসহ"/>
        <ProfitStat label="খরচ ওঠার দর" value={summary.break_even} hint={amount(budget.kg) ? `${metric(amount(budget.kg))} কেজি বিক্রি ধরলে` : 'বিক্রিযোগ্য ফলন লিখুন'} emphasis/>
      </div>
      <div className="fb-grid">
        <BudgetCard title="খরচের ভাগ">
          <BudgetRow label="নগদ খরচ" value={money(summary.cash)}/>
          <BudgetRow label="নিজের ও পরিবারের শ্রম" value={money(summary.costs.own + summary.costs.family)}/>
          {summary.economic > 0 && <div className="fb-costbar" aria-hidden="true"><span style={{width:`${summary.cash / summary.economic * 100}%`}}/></div>}
          <details><summary>কখন কত নগদ খরচ</summary>
            {Object.entries(stages).map(([key, label]) => <BudgetRow key={key} label={label}
              value={money(summary.phases[key as keyof typeof stages])}/>)}
            <BudgetRow label="ভাড়া করা শ্রমের খরচ" value={money(summary.costs.hired)}/>
          </details>
        </BudgetCard>
        <div className="fb-stack">
          {summary.budget_left != null && <BudgetCard title={summary.budget_left < 0 ? 'বাজেটের চেয়ে খরচ বেশি' : 'বাজেটে নগদ বাকি'}>
            <strong className="fb-total">{money(Math.abs(summary.budget_left))}</strong>
            <BudgetRow label="হাতে থাকা শুরুর বাজেট" value={money(amount(budget.available))}/>
            <BudgetRow label="বাদ যাবে নগদ খরচ" value={money(summary.cash)}/>
            <p>{money(amount(budget.available))} − {money(summary.cash)} = {money(summary.budget_left)}</p>
            <p>বিক্রির আগেই বাজেট থেকে কত টাকা হাতে থাকবে, এই কার্ডে তা দেখানো হয়েছে।</p>
          </BudgetCard>}
          {summary.cash_surplus != null && <BudgetCard title={summary.cash_surplus < 0 ? 'বিক্রির আয় থেকে নগদ ঘাটতি' : 'বিক্রির আয় থেকে নগদ উদ্বৃত্ত'}>
            <strong className="fb-total">{money(Math.abs(summary.cash_surplus))}</strong>
            <p>বিক্রির আয় {money(previewSales())} − নগদ খরচ {money(summary.cash)} = {money(summary.cash_surplus)}</p>
          </BudgetCard>}
          {!planned && budget.plannedProfit != null && summary.profit != null && <BudgetCard title="পরিকল্পনার সঙ্গে তুলনা">
            <BudgetRow label="পরিকল্পনায় লাভ বা ক্ষতি" value={money(budget.plannedProfit)}/>
            <BudgetRow label="পরিকল্পনার সঙ্গে পার্থক্য" value={money(summary.profit - budget.plannedProfit)}/>
          </BudgetCard>}
          {planned && <BudgetHint>দর বা ফলন বদলালে লাভও বদলাবে।</BudgetHint>}
        </div>
      </div>
      {needsFarm}
      <div className="fb-buttons">
        <button type="button" disabled={busy} onClick={() => enterCompare(true)}><Scale size={17}/>দর তুলনা করুন</button>
        {planned && <button type="button" disabled={busy} onClick={newActual}><Coins size={17}/>বাস্তব হিসাব লিখুন</button>}
        <button type="button" disabled={busy} onClick={() => go('expenses')}><ClipboardList size={17}/>খরচ সম্পাদনা</button>
      </div>
      <BudgetActions back="আমার হিসাব" onBack={() => go('saved')} busy={busy}>
        {farmId && (dirty || !budget.id ? <button type="button" className="fb-primary" disabled={busy} onClick={() => save()}>
          <Bookmark size={17}/>{busy ? 'সেভ হচ্ছে…' : 'হিসাব সেভ করুন'}</button> :
          <button type="button" className="fb-primary" onClick={() => go('home')}>বাজেট ও লাভে ফিরুন</button>)}
      </BudgetActions>
    </div>}

    {page === 'compare' && <form aria-label="ক্রেতার দর তুলনা" className="fb-screen fb-appear" onSubmit={event => { event.preventDefault(); calculate(true); }}>
      <fieldset disabled={busy} className="fb-grid">
        <BudgetCard title="ক্রেতার দর বসান" hint="যে হিসাবের সঙ্গে তুলনা করতে চান সেটি বেছে নিন।">
          <div className="fb-fields">
            <TextField label="হিসাব বেছে নিন"><select value={comparePlan} onChange={e => chooseCompare(e.target.value)}>
              <option value="">{ready && !budget.id ? `চলতি হিসাব · ${budget.crop}` : 'হিসাব বেছে নিন'}</option>
              {saved.map(row => <option key={row.id} value={row.id}>{row.crop} · {row.season} · {row.kind === 'actual' ? 'বাস্তব' : 'পরিকল্পনা'}</option>)}
              {!!budget.id && !saved.some(row => row.id === budget.id) && <option value={budget.id}>{budget.crop} · {budget.season}</option>}
            </select></TextField>
            <NumericField label="ক্রেতার প্রস্তাবিত দর" value={budget.offer} onChange={offer => edit({offer})} unit="৳/কেজি" required/>
          </div>
          {ready && <BudgetRow label="এই হিসাবের বিক্রিযোগ্য ফলন" value={amount(budget.kg) ? `${metric(amount(budget.kg))} কেজি` : 'এখনও লেখা হয়নি'}/>}
          {ready && !amount(budget.kg) && <BudgetHint>দর তুলনা করতে আগে বিক্রিযোগ্য ফলন লিখুন।
            <button type="button" className="fb-text" onClick={() => go('income')}>ফলন লিখুন<ArrowRight size={16}/></button>
          </BudgetHint>}
          {records?.error && <><Feedback error={records.error}/><button type="button" onClick={() => setVersion(v => v + 1)}>আবার চেষ্টা করুন</button></>}
          {!ready && <BudgetHint>সেভ করা হিসাব না থাকলে আগে একটি হিসাব তৈরি করুন।
            <button type="button" className="fb-text" onClick={() => begin('work')}>খরচ দিয়ে হিসাব শুরু করুন<ArrowRight size={16}/></button>
          </BudgetHint>}
          {ready && !!amount(budget.kg) && <div className="fb-buttons"><button type="submit" className="fb-primary">{busy ? 'হিসাব হচ্ছে…' : 'দর তুলনা করুন'}<ArrowRight size={17}/></button></div>}
        </BudgetCard>
        {summary && <BudgetCard title="এই দরে কত লাভ হতে পারে?" hint={`${metric(amount(budget.kg))} কেজির সবটাই এই দরে বিক্রি হলে`} tone="fb-dark">
          <strong className="fb-total">{money(summary.offer_profit == null ? null : Math.abs(summary.offer_profit))}
            {summary.offer_profit != null && (summary.offer_profit < 0 ? ' ক্ষতি' : summary.offer_profit === 0 ? ' লাভ বা ক্ষতি নেই' : ' লাভ')}</strong>
          <BudgetRow label="শ্রমসহ মোট খরচ" value={money(summary.economic)}/>
          <BudgetRow label="খরচ ওঠার দর" value={summary.break_even == null ? '—' : money(summary.break_even) + '/কেজি'}/>
          {summary.break_even != null && amount(budget.offer) != null &&
            <BudgetRow label="প্রস্তাব থেকে খরচ ওঠার দর বাদে" value={money(amount(budget.offer)! - summary.break_even) + '/কেজি'}/>}
        </BudgetCard>}
      </fieldset>
      <section className="fb-card">
        <details>
          <summary>দামের ধাপ (ঐচ্ছিক)</summary>
          <p>একই ফসল, মান, বাজার ও দিনের দর লিখুন। সব দর প্রতি কেজিতে।</p>
          <div className="fb-fields fb-price-fields">{Object.entries(priceLabels).map(([key, label]) =>
            <NumericField key={key} label={label} unit="৳/কেজি" value={budget.prices[key as PriceKey]}
              onChange={value => {
                setBudget(old => ({...old, prices:{...old.prices,[key]:value}}));
                setDirty(true); setError(''); setMessage('');
              }}/>)}</div>
          <BudgetRow label="খামারদর ও পরিবহন মিলিয়ে" value={amount(budget.prices.farm) != null && amount(budget.prices.transport) != null
            ? money(amount(budget.prices.farm)! + amount(budget.prices.transport)!) + '/কেজি' : '—'}/>
          <BudgetRow label="পাইকারি ও খুচরা দরের পার্থক্য" value={amount(budget.prices.wholesale) != null && amount(budget.prices.retail) != null
            ? money(amount(budget.prices.retail)! - amount(budget.prices.wholesale)!) + '/কেজি' : '—'}/>
        </details>
      </section>
      {summary && connectionHint}
      {summary && needsFarm}
      <BudgetActions back="বাজেট ও লাভ" onBack={() => go('home')} busy={busy}>
        {summary && farmId && <button type="button" className="fb-primary" onClick={() => save(true)} disabled={busy}><Bookmark size={17}/>তুলনা সেভ করুন</button>}
      </BudgetActions>
    </form>}

    {page === 'saved' && <div className="fb-screen fb-appear">
      {needsFarm}
      <div className="fb-buttons">
        <button className="fb-primary" type="button" onClick={() => begin('limit')}><Plus size={17}/>নতুন পরিকল্পনা</button>
        <button type="button" onClick={() => begin('work', 'actual')}><Plus size={17}/>নতুন বাস্তব হিসাব</button>
      </div>
      {draft && <BudgetCard title="এই ডিভাইসে রাখা খসড়া">
        <div className="fb-resume-card"><span className="fb-icon"><Clock3 size={20}/></span><div>
          <strong>{draft.budget.crop || 'অসম্পূর্ণ হিসাব'}</strong><p>{draft.budget.season || 'মৌসুম এখনও লেখা হয়নি'}</p></div>
          <button type="button" onClick={resume}>চালিয়ে যান<ArrowRight size={16}/></button></div>
      </BudgetCard>}
      {farmId && <BudgetCard title="সেভ করা হিসাব">
        <Feedback pending={!records} error={records?.error}/>
        {records?.error && <button type="button" onClick={() => setVersion(v => v + 1)}>আবার চেষ্টা করুন</button>}
        {records?.data && saved.length === 0 && <p className="fb-empty">এই খামারে এখনও কোনো হিসাব সেভ করা হয়নি।</p>}
        {saved.length > 0 && <>
          <div className="fb-fields fb-filters">
            <TextField label="ফসল খুঁজুন"><span className="fb-input"><Search size={17}/><input type="search"
              value={search} onChange={e => setSearch(e.target.value)} placeholder="যেমন টমেটো"/></span></TextField>
            <TextField label="মৌসুম"><select value={season} onChange={e => setSeason(e.target.value)}>
              <option value="">সব মৌসুম</option>{[...new Set(saved.map(row => row.season))].map(value => <option key={value}>{value}</option>)}</select></TextField>
            <TextField label="হিসাবের ধরন"><select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">সব হিসাব</option><option value="estimate">পরিকল্পনা</option><option value="actual">বাস্তব হিসাব</option></select></TextField>
          </div>
          {!visible.length && <p className="fb-empty">এই খোঁজে কোনো হিসাব পাওয়া যায়নি।</p>}
          <ul className="fb-records">{visible.map(row => <li key={row.id}>
            <div><strong>{row.crop}</strong><small>{row.season}</small></div><span className="fb-tag">{row.kind === 'actual' ? 'বাস্তব হিসাব' : 'পরিকল্পনা'}</span>
            <div><small>মোট খরচ</small><strong>{money(row.result.economic)}</strong></div>
            <div><small>{row.result.profit != null && row.result.profit < 0 ? 'ক্ষতি' : 'লাভ'}</small><strong>{money(row.result.profit == null ? null : Math.abs(row.result.profit))}</strong></div>
            <div className="fb-icon-actions">
              <button type="button" disabled={busy} className="fb-soft" onClick={() => open(row)}>হিসাব দেখুন<ArrowRight size={16}/></button>
              <button type="button" disabled={busy} aria-label={`${row.crop} হিসাব মুছুন`} onClick={() => remove(row)}><Trash2 size={16}/></button>
            </div>
          </li>)}</ul>
        </>}
      </BudgetCard>}
      {saved.filter(row => row.kind === 'estimate' && row.sales != null).length > 1 && <section className="fb-card">
        <details>
          <summary>দুটি পরিকল্পনার লাভ তুলনা</summary>
          <p>আপনার দেওয়া আয় বদলে সম্ভাব্য ভালো ও খারাপ পরিস্থিতি দেখুন। খরচ একই ধরা হয়েছে।</p>
          <div className="fb-fields">
            {planChoices.map((value, index) => <TextField key={index} label={`পরিকল্পনা ${metric(index + 1)}`}>
              <select value={value} onChange={e => setPlanChoices(old => old.map((id, i) => i === index ? e.target.value : id))}>
                <option value="">বেছে নিন</option>{saved.filter(row => row.kind === 'estimate' && row.sales != null).map(row =>
                  <option value={row.id} key={row.id}>{row.crop} · {row.season} · #{metric(row.id)}</option>)}</select>
            </TextField>)}
            <NumericField label="আয় কমলে" unit="%" value={outlook.low} onChange={low => setOutlook(old => ({...old,low}))}/>
            <NumericField label="আয় বাড়লে" unit="%" value={outlook.high} onChange={high => setOutlook(old => ({...old,high}))}/>
          </div>
          {[...new Set(planChoices)].map(id => saved.find(row => String(row.id) === id)).map(row => row && <div className="fb-scenario" key={row.id}>
            <strong>{row.crop} · {row.season}</strong>
            <BudgetRow label="আয় কমলে লাভ বা ক্ষতি" value={money(row.sales! * (1 - Math.min(amount(outlook.low) ?? 0,100)/100) - row.result.economic)}/>
            <BudgetRow label="বর্তমান পরিকল্পনায় লাভ বা ক্ষতি" value={money(row.result.profit)}/>
            <BudgetRow label="আয় বাড়লে লাভ বা ক্ষতি" value={money(row.sales! * (1 + Math.min(amount(outlook.high) ?? 0,100)/100) - row.result.economic)}/>
          </div>)}
        </details>
      </section>}
      <BudgetActions back="বাজেট ও লাভ" onBack={() => go('home')}/>
    </div>}
    {page === 'home' && feedback}
    {page === 'home' && <details className="fb-help"><summary><CircleHelp size={17}/> কোনটা দিয়ে শুরু করব?</summary>
      <p><Sprout size={16}/> টাকা বরাদ্দ করে থাকলে <strong>বাজেট দিয়ে শুরু</strong>। ইতিমধ্যে কিছু খরচ জানলে <strong>কাজ দিয়ে শুরু</strong>।</p>
    </details>}
  </section>;
}
