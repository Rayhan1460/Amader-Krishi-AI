import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, MapPin, PackageCheck, Phone, Plus, Search, Truck, Users, Wheat } from 'lucide-react';
import { LotPanel } from './LotPanel.tsx';
import { errText, Feedback, Field, hub, metric, money, useHub } from './shared.tsx';
import './GroupSelling.css';

type SaleStatus = 'open' | 'ready' | 'sold' | 'cancelled';
type Sale = { id: number; name: string; district: string; crop: string; description: string; wanted: string; target: number; declared: number; verified: number; members: number; joined: boolean; status: SaleStatus };
type Details = { is_leader: boolean; leader: { name: string; phone: string | null }; members: {id: number; name: string; self: boolean}[]; offers: {id: number; buyer: string; rate: number; quantity: number; notes: string}[] };
const text: Record<SaleStatus, string> = { open: 'সংগ্রহ চলছে', ready: 'চূড়ান্ত লট প্রস্তুত', sold: 'বিক্রি সম্পন্ন', cancelled: 'বিক্রি বাতিল' };
const sample: Sale = { id: 0, name: 'বগুড়া ধান সংগ্রহ দল', district: 'বগুড়া', crop: 'ধান', description: 'একসঙ্গে মান যাচাই করে ধানের লট প্রস্তুত করা হচ্ছে।', wanted: 'স্থানীয় আড়তের চাহিদা ১,০০০ কেজি শুকনা ধান।', target: 1000, declared: 750, verified: 750, members: 18, joined: false, status: 'open' };

function Status({ status }: { status: SaleStatus }) {
  return <span className="gs-status" data-status={status}>{text[status]}</span>;
}
function Progress({ sale }: {sale: Sale}) {
  return <div className="gs-progress">
    <div><strong>{metric(sale.verified)} কেজি</strong><span>লক্ষ্য {metric(sale.target)} কেজি</span></div>
    <progress max={sale.target} value={Math.min(sale.target, sale.verified)} aria-label="লক্ষ্যের বিপরীতে যাচাইকৃত ওজন"/>
    <p>আর প্রয়োজন {metric(Math.max(0, sale.target - sale.verified))} কেজি</p>
  </div>;
}

export function GroupSelling({ district, onOpenChat }: { district?: string; onOpenChat: (id: number) => void }) {
  const [filter, setFilter] = useState<'all' | 'near' | 'mine'>('all');
  const [selected, setSelected] = useState<number>();
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [myJoins, setMyJoins] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const list = useHub<Sale[]>(filter === 'near' ? district ? `/group-sales?district=${encodeURIComponent(district)}` : null : '/group-sales', version, 15000);
  const picked = useHub<Sale[]>(selected ? `/group-sales?circle_id=${selected}` : null, version, 15000);
  const sale = selected === 0 ? sample : picked?.data?.[0] ?? list?.data?.find(item => item.id === selected);
  const joined = sale && (sale.joined || myJoins.includes(sale.id));
  const details = useHub<Details>(sale?.id && joined ? `/group-sales/${sale.id}/details` : null, version, 15000);
  const shown = (list?.data ?? []).filter(item => filter !== 'mine' || item.joined || myJoins.includes(item.id));

  async function action(work: () => Promise<void>, message: string) {
    if (busy) return;
    setError(''); setNotice(''); setBusy(true);
    try { await work(); setVersion(v => v + 1); setNotice(message); }
    catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void action(async () => {
      const created = await hub.post<{id: number}>('/circles', { ...data, target: Number(data.target) });
      setMyJoins(current => [...current, created.id]); setSelected(created.id); setCreating(false);
    }, 'দল তৈরি হয়েছে। এখন সদস্যরা যোগ দিতে পারবেন।');
  }

  function join(id: number) {
    void action(async () => {
      await hub.post(`/group-sales/${id}/join`);
      setMyJoins(current => current.includes(id) ? current : [...current, id]); setSelected(id);
    }, 'দলে যোগ দিয়েছেন। নিজের ফসলের ওজন জমা দিন।');
  }

  function offer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    void action(async () => {
      await hub.post(`/group-sales/${selected}/offers`, { ...data, quantity: Number(data.quantity) });
      setFormOpen(false);
    }, 'ক্রেতার প্রস্তাব সংরক্ষিত হয়েছে।');
  }

  return <section className="gs-shell" aria-label="দলীয় ফসল বিক্রি">
    {selected === undefined ? <>
      <header className="gs-hero">
        <div><span className="gs-mark"><Wheat size={24}/></span>
          <h2>একসঙ্গে ফসল বিক্রি</h2>
          <p>এলাকার কৃষকদের সঙ্গে ফসল সংগ্রহ করুন, ওজন যাচাই করুন এবং নিজের পাওনা দেখুন।</p></div>
        <div className="gs-hero-actions">
          <button type="button" className="fh-primary" onClick={() => setCreating(true)}><Plus size={18}/>নতুন দল তৈরি করুন</button>
          <button type="button" onClick={() => { setCreating(false); setFilter('near'); }}><MapPin size={18}/>কাছের চলমান দলে যোগ দিন</button>
        </div>
      </header>
      <div className="soc-filters" aria-label="দলের তালিকা">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>সব দল</button>
        <button type="button" aria-pressed={filter === 'near'} onClick={() => setFilter('near')}>আমার জেলা</button>
        <button type="button" aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>আমার দল</button>
      </div>
      {creating && <form className="soc-card gs-form" onSubmit={create}>
        <div className="soc-heading"><h2>নতুন দলীয় বিক্রির দল</h2><button type="button" onClick={() => setCreating(false)}>বন্ধ করুন</button></div>
        <div className="fh-fields">
          <Field label="দলের নাম"><input name="name" required maxLength={120}/></Field>
          <Field label="ফসলের নাম"><input name="crop" required maxLength={120}/></Field>
          <Field label="জেলা"><input name="district" defaultValue={district} required maxLength={120}/></Field>
          <Field label="লক্ষ্যমাত্রা (কেজি)"><input name="target" type="number" required min="1" max="10000000"/></Field>
        </div>
        <Field label="ক্রেতার চাহিদা (জানা থাকলে)"><textarea name="wanted" maxLength={2000}/></Field>
        <Field label="দলের সংক্ষিপ্ত বিবরণ"><textarea name="description" maxLength={2000}/></Field>
        <button type="submit" className="fh-primary" disabled={busy}>দল তৈরি করুন</button>
      </form>}
      <Feedback error={error} pending={busy || (!list && (filter !== 'near' || !!district))}/>
      {list?.error && <div className="soc-connection"><p>আসল দলের তালিকা এখন পাওয়া যাচ্ছে না। নিচে নমুনা দলের তথ্য দেখা যাবে।</p>
        <button type="button" onClick={() => setVersion(v => v + 1)}>আবার সংযোগ করুন</button></div>}
      {filter === 'near' && !district && <p className="soc-card">জেলা অনুযায়ী খুঁজতে কমিউনিটির উপরে একটি খামার বেছে নিন।</p>}
      {filter === 'near' && district && <p className="gs-sub"><MapPin size={16}/>চলমান দল · {district}</p>}
      {list?.data && shown.length === 0 && <p className="soc-card"><Search size={18}/> এই তালিকায় এখন কোনো আসল দল নেই।</p>}
      <div className="gs-grid">{[...(filter === 'all' ? [sample] : []), ...shown].map(item => <article className="soc-card gs-card" key={item.id}>
        <div className="soc-heading"><span className="gs-mark"><Wheat size={22}/></span><Status status={item.status}/></div>
        <div><span className="soc-tag">{item.crop}</span>{item.id === 0 && <span className="gs-sample">নমুনা</span>}<h3>{item.name}</h3></div>
        <p className="gs-sub"><MapPin size={16}/>{item.district}<Users size={16}/>{metric(item.members)} জন কৃষক</p>
        <Progress sale={item}/>
        {item.declared !== item.verified && <p className="gs-note">সদস্যদের জমা দেওয়া ওজন {metric(item.declared)} কেজি</p>}
        <p className="gs-demand"><strong>ক্রেতার চাহিদা</strong><br/>{item.wanted || 'চাহিদার তথ্য দেওয়া হয়নি।'}</p>
        <div className="gs-card-actions"><button type="button" onClick={() => {setSelected(item.id);setError('');setNotice('');}}>বিস্তারিত <ArrowRight size={16}/></button>
          {item.id !== 0 && item.status === 'open' && !item.joined && !myJoins.includes(item.id) && <button type="button" className="fh-primary" disabled={busy} onClick={() => join(item.id)}>যোগ দিন</button>}</div>
      </article>)}</div>
    </> : <>
      <div><button type="button" onClick={() => {setSelected(undefined);setError('');setNotice('');setFormOpen(false);}}><ArrowLeft size={17}/>দলের তালিকা</button></div>
      <Feedback error={error || picked?.error} pending={busy || (selected !== 0 && !picked)}/>
      {notice && <p role="status" className="soc-confirm">{notice}</p>}
      {sale && <header className="soc-card gs-form">
        <div className="soc-heading"><div><h2>{sale.name}</h2><p className="gs-sub"><MapPin size={16}/>{sale.district} · {sale.crop} · {metric(sale.members)} জন কৃষক</p></div><Status status={sale.status}/></div>
        <p>{sale.description}</p><Progress sale={sale}/>
        <p className="gs-demand"><strong>ক্রেতার চাহিদা</strong><br/>{sale.wanted || 'চাহিদার তথ্য দেওয়া হয়নি।'}</p>
        {sale.id === 0 && <p className="gs-note">এটি নমুনা। নিজের দলের সদস্য, ওজন ও পাওনা দেখতে একটি আসল দলে যোগ দিন।</p>}
        {!joined && sale.id !== 0 && sale.status === 'open' && <button type="button" className="fh-primary" disabled={busy} onClick={() => join(sale.id)}>দলে যোগ দিন</button>}
        {!!sale.id && joined && <div><button type="button" onClick={() => onOpenChat(sale.id)}>দলের চ্যাট ও কল <ArrowRight size={17}/></button></div>}
      </header>}
      {sale?.id === 0 && <div className="gs-detail-grid">
        <article className="soc-card gs-form"><h3>নমুনা সদস্য ও ওজন</h3><p>দলনেতা · আব্দুল করিম</p><p>আব্দুল করিম · ৩০০ কেজি</p><p>রোকেয়া বেগম · ২৫০ কেজি</p><p>মিজানুর রহমান · ২০০ কেজি</p><p className="gs-note">বাকি ১৫ সদস্য এখনো ওজন জমা দেননি।</p></article>
        <article className="soc-card gs-form"><h3>নমুনা দর ও পরিবহন</h3><p>আড়তের সম্ভাব্য দর ৳৩২/কেজি।</p><p>মোট পরিবহন ৳১,৫০০ হলে ২৫০ কেজির অংশ ৳৫০০।</p><p>২৫০ কেজির সম্ভাব্য পাওনা <strong>৳৭,৫০০</strong>।</p></article>
      </div>}
      {!!sale?.id && joined && <>
        <Feedback error={details?.error} pending={!details}/>
        {details?.data && <div className="gs-detail-grid">
          <article className="soc-card gs-form"><h3><Users size={19}/>দলনেতা</h3><strong>{details.data.leader.name}</strong>
            {details.data.leader.phone && <a className="fh-button" href={`tel:${details.data.leader.phone}`}><Phone size={17}/>দলনেতাকে কল</a>}
            <p>{metric(details.data.members.length)} জন সদস্য · ওজন ও গ্রেড নিচে দেখুন।</p>
          </article>
          <article className="soc-card gs-form"><div className="soc-heading"><h3><PackageCheck size={19}/>সম্ভাব্য ক্রেতার অফার</h3>
            {sale.status === 'open' && details.data.is_leader && <button type="button" onClick={() => setFormOpen(open => !open)}><Plus size={16}/>অফার লিখুন</button>}</div>
            <p className="gs-note">অফারগুলো দলনেতার রেকর্ড।</p>
            {!details.data.offers.length && <p>কোনো অফার লেখা হয়নি।</p>}
            {details.data.offers.map(row => <div className="gs-demand" key={row.id}><strong>{row.buyer}</strong><p>{money(row.rate)}/কেজি · {metric(row.quantity)} কেজি</p>{row.notes && <p>{row.notes}</p>}</div>)}
            {formOpen && details.data.is_leader && <form className="gs-form" onSubmit={offer}>
              <Field label="ক্রেতার নাম"><input name="buyer" required maxLength={120}/></Field>
              <Field label="প্রস্তাবিত দর (৳/কেজি)"><input name="rate" type="number" min=".01" max="100000" step=".01" required/></Field>
              <Field label="চাহিদার পরিমাণ (কেজি)"><input name="quantity" type="number" min="1" max="10000000" required/></Field>
              <Field label="অফারের নোট"><textarea name="notes" maxLength={2000}/></Field>
              <button type="submit" disabled={busy}>অফার সেভ করুন</button>
            </form>}
          </article>
        </div>}
        <LotPanel key={sale.id} circle={sale.id} version={version} busy={busy} roster={details?.data?.members}
          update={(path, data, final) => void action(async () => {
            if (final) await hub.post(path, data); else await hub.put(path, data);
          }, final ? 'ওজন ও গ্রেডসহ লট চূড়ান্ত হয়েছে।' : 'ফসলের তথ্য সংরক্ষিত হয়েছে।')}/>
        {details?.data?.is_leader && sale.status === 'ready' && <div className="soc-card gs-form">
          <h3><BadgeCheck size={19}/>বিক্রির অবস্থা</h3>
          <div className="gs-card-actions">{(['sold','cancelled'] as const).map(status => <button key={status} type="button" disabled={busy}
            onClick={() => { if (window.confirm(`অবস্থা “${text[status]}” হিসেবে সেভ করবেন?`)) void action(async () => {
              await hub.put(`/group-sales/${sale.id}/outcome`, { status });
            }, 'বিক্রির অবস্থা সেভ হয়েছে।'); }}>{text[status]} হিসেবে চিহ্নিত করুন</button>)}</div>
        </div>}
        <p className="gs-sub"><Truck size={17}/>পরিবহন খরচ যাচাইকৃত ওজনের অনুপাতে ভাগ হয়।</p>
      </>}
      {picked?.data?.length === 0 && <p className="soc-card">দলটি পাওয়া যায়নি।</p>}
    </>}
  </section>;
}
