import { useState, type FormEvent } from 'react';
import { Download, Tractor } from 'lucide-react';
import type { FarmBudgetRecord } from './BudgetPanel.tsx';
import { Card, dhakaDay, errText, Feedback, Field, hub, metric, money, useHub } from './shared.tsx';

type Machine = { id: number; name: string; district: string; unit: string; operator: string; owner: string; rate: number; mine: boolean; notes: string; reserved: string[]; rating: { count: number; owner: number; operator: number } | null };
type Booking = { id: number; machine: string; day: string; status: string; owner: boolean; requester: string; notes: string; cost: number; shared: boolean; units: number; reviewed: boolean };
const states = { pending: 'অপেক্ষায়', approved: 'অনুমোদিত', declined: 'প্রত্যাখ্যাত', cancelled: 'বাতিল', completed: 'সম্পন্ন' };

function useMutation() {
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); setVersion(v => v + 1); setNotice(message); }
    catch (failure) { setError(errText(failure)); }
    finally { setBusy(false); }
  }
  return { version, error, busy, notice, run };
}

export function MachinePanel({ district }: { district?: string }) {
  const [nearby, setNearby] = useState(false);
  const [machine, setMachine] = useState<Machine>();
  const [units, setUnits] = useState('');
  const state = useMutation();
  const filter = nearby && district ? `?district=${encodeURIComponent(district)}` : '';
  const machines = useHub<Machine[]>(`/machines${filter}`, state.version, 30000);
  const bookings = useHub<Booking[]>('/bookings', state.version, 12000);

  function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    void state.run(async () => { await hub.post('/machines', { ...payload, rate: Number(payload.rate) }); form.reset(); }, 'যন্ত্রটি তালিকাভুক্ত হয়েছে।');
  }

  function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!machine) return;
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    void state.run(async () => {
      await hub.post(`/machines/${machine.id}/book`, { ...payload, units: Number(payload.units), shared: payload.shared === 'on' });
      setMachine(undefined); setUnits('');
    }, 'বুকিংয়ের অনুরোধ মালিকের কাছে জমা হয়েছে।');
  }

  return <div className="fh-stack">
    <Feedback error={state.error} pending={state.busy}/>{state.notice && <p role="status">{state.notice}</p>}
    <div className="fh-columns">
      <Card title="এলাকার যন্ত্রপাতি">
        {district && <button aria-pressed={nearby} type="button" onClick={() => setNearby(x => !x)}>আমার জেলা · {district}</button>}
        <Feedback error={machines?.error} pending={!machines}/>
        {machines?.data?.length === 0 && <p>এই তালিকায় এখনও কোনো যন্ত্র নেই।</p>}
        {machines?.data?.map(item => <div className="fh-row" key={item.id}><div><strong>{item.name}</strong>
          <p>{item.district} · {money(item.rate)} / {item.unit === 'hour' ? 'ঘণ্টা' : 'বিঘা'}</p>
          <p>মালিক {item.owner} · চালক {item.operator}</p>{item.rating && <p>মালিক {metric(item.rating.owner)}/৫ · চালক {metric(item.rating.operator)}/৫ · {metric(item.rating.count)}টি রেটিং</p>}{item.notes && <p>{item.notes}</p>}
          {!!item.reserved?.length && <p>বুক আছে · {item.reserved.join(', ')}</p>}</div>
          {!item.mine && <button type="button" onClick={() => { setMachine(item); setUnits(''); }}>তারিখ চান</button>}
        </div>)}
      </Card>
      <Card title="নিজের যন্ত্র তালিকাভুক্ত করুন">
        <form className="fh-stack" onSubmit={register}>
          <div className="fh-fields">
            <Field label="যন্ত্রের নাম"><input name="name" required maxLength={120}/></Field>
            <Field label="জেলা"><input name="district" required maxLength={120} defaultValue={district}/></Field>
            <Field label="চালকের নাম"><input name="operator" required maxLength={120}/></Field>
            <Field label="ভাড়ার একক"><select name="unit"><option value="hour">ঘণ্টা</option><option value="bigha">বিঘা</option></select></Field>
            <Field label="একক দর (৳)"><input type="number" name="rate" required min=".01" step=".01" max="100000000"/></Field>
          </div><Field label="সেবার বিবরণ"><textarea name="notes" maxLength={2000}/></Field>
          <button type="submit" className="fh-primary" disabled={state.busy}><Tractor size={17}/>যন্ত্র যোগ করুন</button>
        </form>
      </Card>
    </div>
    {machine && <Card title={`${machine.name} · বুকিং অনুরোধ`}>
      <form className="fh-stack" onSubmit={request} key={machine.id}>
        <div className="fh-fields"><Field label="তারিখ"><input type="date" name="day" min={dhakaDay()} required/></Field>
          <Field label={machine.unit === 'hour' ? 'কত ঘণ্টা' : 'কত বিঘা'}><input type="number" name="units" min=".01" max={machine.unit === 'hour' ? 24 : 100000000} step=".01" value={units} onChange={e => setUnits(e.target.value)} required/></Field>
        </div>
        <label className="fh-check"><input type="checkbox" name="shared"/>একাধিক কৃষকের হয়ে একসঙ্গে অনুরোধ</label>
        <Field label="কাজের বিবরণ বা যৌথ ব্যবহারের তথ্য"><textarea name="notes" maxLength={2000}/></Field>
        <div className="fh-actions"><strong>আনুমানিক ভাড়া {units ? money(Number(units) * machine.rate) : '—'}</strong>
          <button type="submit" className="fh-primary" disabled={state.busy}>অনুরোধ পাঠান</button>
          <button type="button" onClick={() => setMachine(undefined)}>বন্ধ করুন</button></div>
      </form>
    </Card>}
    <Card title="যন্ত্রের বুকিং ও সেবার হিসাব">
      <Feedback error={bookings?.error} pending={!bookings}/>
      {bookings?.data?.length === 0 && <p>এখনও বুকিং নেই।</p>}
      {bookings?.data?.map(item => {
        const actions = item.status === 'pending'
          ? item.owner ? [['approved', 'অনুমোদন'], ['declined', 'প্রত্যাখ্যান']] : [['cancelled', 'বাতিল করুন']]
          : item.owner && item.status === 'approved' && item.day <= dhakaDay() ? [['completed', 'সম্পন্ন করুন']] : [];
        return <div className="fh-row" key={item.id}><div><strong>{item.machine} · {states[item.status as keyof typeof states]}</strong>
          <p>{item.day} · {money(item.cost)}{item.shared && ' · যৌথ'}{item.owner && ` · ${item.requester}`}</p>{item.notes && <p>{item.notes}</p>}</div>
          <div className="fh-actions">{actions.map(([status, label]) => <button key={status} type="button" disabled={state.busy} onClick={() => void state.run(() => hub.patch(`/bookings/${item.id}`, { status }), 'বুকিংয়ের অবস্থা বদলেছে।')}>{label}</button>)}</div>
          {!item.owner && item.status === 'completed' && !item.reviewed && <form className="fh-actions" onSubmit={e => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            void state.run(() => hub.post(`/bookings/${item.id}/rating`, { owner_rating: Number(fields.get('owner')), operator_rating: Number(fields.get('operator')) }), 'রেটিং দেওয়া হয়েছে।');
          }}><Field label="মালিকের রেটিং"><select name="owner">{[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}</select></Field>
            <Field label="চালকের রেটিং"><select name="operator">{[5,4,3,2,1].map(n => <option key={n}>{n}</option>)}</select></Field>
            <button disabled={state.busy}>রেটিং দিন</button></form>}
          </div>;
      })}
    </Card>
  </div>;
}

type Passport = { farm: { name: string; district: string; upazila: string; area: number; unit: string }; crops: { id: number; name: string; season: string; sown: string; status: string; kg: number | null; notes?: string }[]; accounts: FarmBudgetRecord[] };
const cropStatus: Record<string, string> = { planned: 'পরিকল্পিত', planted: 'রোপণ হয়েছে', growing: 'বৃদ্ধি চলছে', harvested: 'ফসল তোলা হয়েছে', failed: 'ক্ষতি হয়েছে', active: 'চলমান' };
export function PassportPanel({ farmId }: { farmId: number }) {
  const [share, setShare] = useState({ production: true, financial: false, notes: false });
  const data = useHub<Passport>(`/passport/${farmId}`);
  function download(record: Passport) {
    const contents = [record.farm.name, `${record.farm.upazila}, ${record.farm.district}`, `জমি: ${metric(record.farm.area)} ${record.farm.unit}`];
    if (share.production) for (const crop of record.crops) {
      contents.push(`${crop.season} · ${crop.name} · ${crop.sown} · ${cropStatus[crop.status] ?? crop.status} · উৎপাদন ${metric(crop.kg)} কেজি`);
      if (share.notes && crop.notes) contents.push(crop.notes);
    }
    if (share.financial) for (const account of record.accounts) {
      contents.push(`${account.season} · ${account.crop} · খরচ ${money(account.result.economic)} · বিক্রি ${money(account.sales)} · লাভ ${money(account.result.profit)}`);
    }
    const url = URL.createObjectURL(new Blob(['\uFEFF', contents.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'agrisphere-passport.txt'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return <div className="fh-stack">
    <Feedback error={data?.error} pending={!data}/>
    {data?.data && <><Card title={data.data.farm.name}><p>{data.data.farm.upazila}, {data.data.farm.district} · {metric(data.data.farm.area)} {data.data.farm.unit}</p>
      <div className="fh-actions"><label className="fh-check"><input type="checkbox" checked={share.production} onChange={e => setShare({ ...share, production: e.target.checked })}/>চাষ ও উৎপাদন</label>
      <label className="fh-check"><input type="checkbox" checked={share.financial} onChange={e => setShare({ ...share, financial: e.target.checked })}/>আয় ও খরচ</label>
      <label className="fh-check"><input type="checkbox" checked={share.notes} disabled={!share.production} onChange={e => setShare({ ...share, notes: e.target.checked })}/>ক্ষতি ও নোট</label>
      <button type="button" className="fh-primary" onClick={() => download(data.data!)}><Download size={17}/>নির্বাচিত রেকর্ড ডাউনলোড</button></div></Card>
    <div className="fh-columns">
      <Card title="মৌসুমের ফসল ও উৎপাদন">{data.data.crops.length === 0 && <p>ফসলের রেকর্ড পাওয়া যায়নি।</p>}
        {data.data.crops.map(crop => <div className="fh-row" key={crop.id}><div><strong>{crop.name} · {crop.season}</strong><p>{crop.sown} · {cropStatus[crop.status] ?? crop.status} · {crop.kg == null ? 'ওজন নেই' : `${metric(crop.kg)} কেজি`}</p>{crop.notes && <p>{crop.notes}</p>}</div></div>)}</Card>
      <Card title="বাস্তব খরচ, শ্রম ও আয়">{data.data.accounts.length === 0 && <p>বাজেটের পাতায় ‘বাস্তব হিসাব’ সংরক্ষণ করুন।</p>}
        {data.data.accounts.map(item => <div className="fh-row" key={item.id}><div><strong>{item.crop} · {item.season}</strong>
          <p>বিক্রি {money(item.sales)} · খরচ {money(item.result.economic)} · লাভ/ক্ষতি {money(item.result.profit)}</p>
          <p>নিজের ও পরিবারের শ্রম {metric(item.lines.filter(x => ['own','family'].includes(x.kind)).reduce((total, x) => total + x.quantity, 0))} ঘণ্টা</p></div></div>)}</Card>
    </div></>}
  </div>;
}

type Rescue = { reports: { id: number; crop: string; kg: number; pickup_by: string; closed: boolean }[]; local: { crop: string; kg: number; farmers: number }[] };
export function RescuePanel({ farmId }: { farmId: number }) {
  const state = useMutation();
  const board = useHub<Rescue>(`/rescue?farm_id=${farmId}`, state.version, 30000);
  function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    void state.run(async () => { await hub.post('/rescue', { ...data, farm_id: farmId, quantity_kg: Number(data.quantity_kg) }); form.reset(); }, 'জরুরি ফসলের তথ্য সংরক্ষিত হয়েছে।');
  }
  return <div className="fh-stack">
    <Feedback error={state.error || board?.error} pending={state.busy || !board}/>{state.notice && <p role="status">{state.notice}</p>}
    <div className="fh-columns">
      <Card title="দ্রুত সংগ্রহ প্রয়োজন">
        <form className="fh-stack" onSubmit={report}>
          <Field label="ফসলের নাম"><input name="crop" maxLength={120} required/></Field>
          <Field label="পরিমাণ (কেজি)"><input type="number" name="quantity_kg" min="1" max="10000000" required/></Field>
          <Field label="সংগ্রহের শেষ তারিখ"><input type="date" name="pickup_by" min={dhakaDay()} required/></Field>
          <button className="fh-primary" type="submit" disabled={state.busy}>ফসলের তথ্য দিন</button>
        </form>
      </Card>
      <Card title="জেলায় আগামী সাত দিনের রিপোর্ট">
        <p className="fh-muted">কৃষকদের দেওয়া তথ্য থেকে একই ফসলের সম্মিলিত পরিমাণ দেখানো হচ্ছে।</p>
        {board?.data?.local.length === 0 && <p>একাধিক কৃষকের কাছ থেকে একই ফসলের রিপোর্ট আসেনি।</p>}
        {board?.data?.local.map(row => <div className="fh-row" key={row.crop}><strong>{row.crop}</strong><span>{metric(row.kg)} কেজি · {metric(row.farmers)} জন</span></div>)}
      </Card>
    </div>
    <Card title="আমার জরুরি ফসল">
      {board?.data?.reports.length === 0 && <p>আপনি এখনও কোনো রিপোর্ট দেননি।</p>}
      {board?.data?.reports.map(row => <div className="fh-row" key={row.id}><div><strong>{row.crop} · {metric(row.kg)} কেজি</strong><p>{row.pickup_by} · {row.closed ? 'বন্ধ' : 'খোলা'}</p></div>
      {!row.closed && <button type="button" disabled={state.busy} onClick={() => void state.run(() => hub.post(`/rescue/${row.id}/close`), 'রিপোর্ট বন্ধ হয়েছে।')}>রিপোর্ট বন্ধ করুন</button>}</div>)}
    </Card>
  </div>;
}
