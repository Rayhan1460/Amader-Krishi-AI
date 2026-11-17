import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, CircleHelp, ClipboardList, Pencil, Plus, Sprout, Trash2, Users, Wallet } from 'lucide-react';
import { metric, money } from './shared.tsx';
import {
  amountForLine, cleanNumber, isLabor, kinds, readNumber, stages,
  type Expense, type ExpenseKind, type Stage,
} from './budgetModel.ts';

export function BudgetCard({ title, hint, tone = '', children }: { title: string; hint?: string; tone?: string; children: ReactNode }) {
  return <section className={`fb-card ${tone}`}>
    <header><h3>{title}</h3>{hint && <p>{hint}</p>}</header>{children}
  </section>;
}

export function BudgetHint({ children }: { children: ReactNode }) {
  return <p className="fb-hint"><CircleHelp aria-hidden="true" size={17}/><span>{children}</span></p>;
}

export function TextField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="fb-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function NumericField({ label, value, onChange, unit, hint, required = false }:
  { label: string; value: string; onChange: (value: string) => void; unit: string; hint?: string; required?: boolean }) {
  return <TextField label={label} hint={hint}>
    <span className="fb-input"><input inputMode="decimal" maxLength={20} value={value} onChange={e => onChange(e.target.value)}
      required={required} placeholder="০"/><span aria-hidden="true">{unit}</span></span>
  </TextField>;
}

export function BudgetRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="fb-row"><span>{label}</span><strong>{value}</strong></div>;
}

export function BudgetActions({ back, onBack, next, onNext, children, busy = false }: {
  back: string; onBack: () => void; next?: string; onNext?: () => void; children?: ReactNode; busy?: boolean;
}) {
  return <div className="fb-actions">
    <button type="button" onClick={onBack} disabled={busy}><ArrowLeft size={17}/>{back}</button>
    <div className="fb-actions-right">{children}
      {next && <button type="button" className="fb-primary" onClick={onNext} disabled={busy}>{next}<ArrowRight size={17}/></button>}
    </div>
  </div>;
}

export function StepStrip({ step, workFirst }: { step: number; workFirst: boolean }) {
  const labels = workFirst ? ['খরচ', 'ফসল ও মৌসুম', 'ফলন ও দর', 'ফলাফল'] : ['শুরু', 'খরচ', 'ফলন ও দর', 'ফলাফল'];
  return <div className="fb-progress">
    <ol aria-label="হিসাবের ধাপ">{labels.map((label, index) => <li key={label} aria-current={index + 1 === step ? 'step' : undefined}
      data-done={index + 1 < step}><b>{metric(index + 1)}</b>{label}</li>)}</ol>
    <div className="fb-progress-mobile">ধাপ {metric(step)}/৪ · {labels[step - 1]}<progress value={step} max={4} aria-label="হিসাবের অগ্রগতি"/></div>
  </div>;
}

const expenseTemplates = [
  ['জমি প্রস্তুতি', 'land'], ['বীজ', 'input'], ['সার', 'input'], ['সেচ', 'machine'], ['মজুরি', 'hired'], ['পরিবহন', 'transport'],
] as const;
const emptyLine = (labor: boolean): Expense => ({
  key: '', name: '', kind: labor ? 'own' : 'input', stage: 'season', quantity: labor ? '' : '1', rate: '',
});

export function ExpenseEditor({ lines, onChange, onEditing }:
  { lines: Expense[]; onChange: (next: Expense[]) => void; onEditing: (active: boolean) => void }) {
  const [tab, setTab] = useState<'cash' | 'labor'>('cash');
  const [editor, setEditor] = useState<Expense>();
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const labor = tab === 'labor';
  const visible = lines.filter(line => isLabor(line.kind) === labor);
  const options = Object.entries(kinds).filter(([kind]) => isLabor(kind as ExpenseKind) === labor);

  function close() {
    onEditing(false); setEditor(undefined); setError('');
  }
  function begin(item: Expense) {
    onEditing(true); setEditor(item); setError(''); setAdvanced(item.quantity !== '1' && !labor);
  }
  function update(changes: Partial<Expense>) {
    setEditor(old => old ? { ...old, ...changes } : old); setError('');
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    try {
      const qty = readNumber(editor.quantity);
      const rate = readNumber(editor.rate);
      const name = editor.name.trim() || (labor ? kinds[editor.kind] : '');
      if (!name) throw new Error('খরচের নাম লিখুন।');
      if (qty == null || qty <= 0) throw new Error(labor ? 'কত ঘণ্টা কাজ করেছেন লিখুন।' : 'শূন্যের বেশি পরিমাণ লিখুন।');
      if (rate == null) throw new Error('টাকার পরিমাণ লিখুন।');
      const entry = { ...editor, name, quantity: cleanNumber(editor.quantity), rate: cleanNumber(editor.rate),
        key: editor.key || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`) };
      onChange(editor.key ? lines.map(line => line.key === editor.key ? entry : line) : [...lines, entry]);
      close();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  return <BudgetCard title="খরচের তালিকা" hint="প্রতিটি খরচ আলাদাভাবে লিখলে পরে খুঁজে পাওয়া সহজ হবে।">
    <div className="fb-toggle" aria-label="খরচের ধরন">
      <button type="button" aria-pressed={!labor} onClick={() => { setTab('cash'); close(); }}><Wallet size={16}/>নগদ খরচ</button>
      <button type="button" aria-pressed={labor} onClick={() => { setTab('labor'); close(); }}><Users size={16}/>নিজের ও পরিবারের শ্রম</button>
    </div>
    {editor ? <form className="fb-editor" onSubmit={add}>
      <h4>{editor.key ? 'খরচটি ঠিক করুন' : labor ? 'শ্রমের মূল্য যোগ করুন' : 'নতুন খরচ'}</h4>
      {!labor && !editor.key && <div className="fb-chips" aria-label="পরিচিত খরচ">
        {expenseTemplates.map(([name, kind]) => <button type="button" key={name} onClick={() => update({ name, kind })}>{name}</button>)}
      </div>}
      <div className="fb-fields">
        {!labor && <TextField label="খরচের নাম"><input autoFocus maxLength={120} value={editor.name} placeholder="যেমন সেচ" onChange={e => update({ name: e.target.value })} required/></TextField>}
        <TextField label={labor ? 'কার শ্রম' : 'খাত'}><select value={editor.kind} onChange={e => update({ kind: e.target.value as ExpenseKind })}>
          {options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></TextField>
        {(labor || advanced) && <NumericField label={labor ? 'কত ঘণ্টা কাজ করেছেন?' : 'পরিমাণ'} unit={labor ? 'ঘণ্টা' : 'একক'} value={editor.quantity}
          onChange={quantity => update({ quantity })} required/>}
        <NumericField label={labor ? 'ঘণ্টাপ্রতি স্থানীয় মজুরি' : advanced ? 'একক দর' : 'টাকার পরিমাণ'} unit="৳"
          value={editor.rate} onChange={rate => update({ rate })} required/>
        <TextField label="কখনের খরচ?"><select value={editor.stage} onChange={e => update({ stage: e.target.value as Stage })}>
          {Object.entries(stages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></TextField>
      </div>
      {!labor && <button type="button" className="fb-text" aria-expanded={advanced} onClick={() => {
        if (advanced) {
          try {
            const quantity = readNumber(editor.quantity);
            const rate = readNumber(editor.rate);
            update({ quantity: '1', rate: quantity == null || rate == null ? '' : String(amountForLine(quantity, rate)) });
          } catch (failure) { setError((failure as Error).message); return; }
        }
        setAdvanced(!advanced);
      }}><ChevronDown size={16}/>{advanced ? 'শুধু মোট টাকা লিখুন' : 'পরিমাণ ও একক দর দিয়ে লিখুন'}</button>}
      {error && <p role="alert" className="fb-error">{error}</p>}
      <div className="fb-buttons">
        <button type="submit" className="fb-primary">{editor.key ? 'পরিবর্তন রাখুন' : 'খরচ যোগ করুন'}</button>
        <button type="button" onClick={close}>বাদ দিন</button>
      </div>
    </form> : <button type="button" className="fb-add" disabled={lines.length >= 75} onClick={() => begin(emptyLine(labor))}>
      <Plus size={18}/>{labor ? 'শ্রমের মূল্য যোগ করুন' : 'খরচ যোগ করুন'}</button>}
    {!visible.length && <p className="fb-empty">{labor ? 'নিজের বা পরিবারের কেউ কাজ করলে ঘণ্টা ও স্থানীয় মজুরি লিখুন।' : 'এখনও কোনো নগদ খরচ যোগ হয়নি।'}</p>}
    {visible.length > 0 && <ul className="fb-expenses">
      {visible.map(line => <li key={line.key}>
        <span className="fb-icon" aria-hidden="true">{labor ? <Users size={19}/> : <ClipboardList size={19}/>}</span>
        <div><strong>{line.name}</strong><small>{kinds[line.kind]} · {stages[line.stage]}</small></div>
        <b>{money(amountForLine(Number(cleanNumber(line.quantity)), Number(cleanNumber(line.rate))))}</b>
        <div className="fb-icon-actions">
          <button type="button" aria-label={`${line.name} সম্পাদনা করুন`} title="সম্পাদনা করুন" onClick={() => begin(line)}><Pencil size={17}/></button>
          <button type="button" aria-label={`${line.name} মুছুন`} title="মুছুন" onClick={() => {
            onChange(lines.filter(item => item.key !== line.key)); if (editor?.key === line.key) close();
          }}><Trash2 size={17}/></button>
        </div>
      </li>)}
    </ul>}
  </BudgetCard>;
}

export function ProfitStat({ label, value, hint, emphasis = false }:
  { label: string; value: number | null; hint?: string; emphasis?: boolean }) {
  return <div className={`fb-stat${emphasis ? ' fb-stat-key' : ''}`}>
    <span>{label}</span><strong>{money(value)}{emphasis && value != null && <small>/কেজি</small>}</strong>
    {hint && <small>{hint}</small>}
  </div>;
}

export function FarmBudgetHero({ onStart }: { onStart: () => void }) {
  return <header className="fb-hero">
    <span><Sprout size={17} aria-hidden="true"/> খামারের হিসাব</span>
    <h1>বাজেট ও লাভ</h1>
    <p>চাষে কত খরচ হবে আর বিক্রি করে কত থাকতে পারে, সহজে হিসাব করুন।</p>
    <button type="button" className="fb-lime" onClick={onStart}>নতুন হিসাব শুরু করুন <ArrowRight size={18}/></button>
  </header>;
}
